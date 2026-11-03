import fs from "node:fs/promises";
import path from "node:path";
import { ERP_INBOX_POLL_SECONDS, ERP_PASSWORD, ERP_SYNC_INTERVAL_MINUTES, ERP_TRANSFER_DIR, ERP_URL, ERP_USER } from "../config/env.js";
import { importProductFile, recordFailedExport } from "./productImportService.js";

// Lab 2 file transfer between the Mini-ERP and the shop:
//   1. Export:  GET <ERP_URL>/rest/api/getProducts (CSV) is saved as inbox/erp-products_<YYYYMMDD-HHMMSS, UTC>.csv
//               (periodically with ERP_SYNC_INTERVAL_MINUTES, or on demand from the admin dashboard).
//   2. Import:  every .csv/.json file in inbox/ is imported, oldest first, then moved to archive/,
//               or to error/ together with <file>.error.txt when it was rejected.
// Files can also be put into inbox/ by hand, e.g. an export downloaded from the ERP in the browser.
const folders = {
  inbox: path.join(ERP_TRANSFER_DIR, "inbox"),
  archive: path.join(ERP_TRANSFER_DIR, "archive"),
  error: path.join(ERP_TRANSFER_DIR, "error")
};
// Exports following this name are complete (getProducts returns every product), so they deactivate missing products.
const EXPORT_FILE = /^erp-products_(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})\.(csv|json)$/i;
const pulledByThisServer = new Set();

export function timestamp(date = new Date()) {
  return date.toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 15);
}
export function exportedAtFromName(name) {
  const m = EXPORT_FILE.exec(name);
  return m ? new Date(Date.UTC(m[1], m[2] - 1, m[3], m[4], m[5], m[6])) : null;
}

async function ensureFolders() {
  for (const dir of Object.values(folders)) await fs.mkdir(dir, {recursive: true});
}
// Never overwrite: a file name that already exists in the target folder gets a numeric suffix.
async function freeName(dir, name) {
  const {name: base, ext} = path.parse(name);
  for (let n = 0; ; n++) {
    const candidate = n ? `${base}-${n}${ext}` : name;
    try { await fs.access(path.join(dir, candidate)); } catch { return candidate; }
  }
}
async function writeNote(dir, fileName, report) {
  if (report.status === "success") return;
  await fs.writeFile(path.join(dir, `${fileName}.${report.status === "failed" ? "error" : "skipped"}.txt`),
    `${report.status.toUpperCase()} at ${new Date(report.createdAt).toISOString()}\n${report.errors.join("\n")}\n`, "utf8");
}

export async function exportFromErp() {
  const url = new URL("/rest/api/getProducts", ERP_URL);
  let response;
  try {
    response = await fetch(url, {
      headers: {Authorization: `Basic ${Buffer.from(`${ERP_USER}:${ERP_PASSWORD}`).toString("base64")}`},
      signal: AbortSignal.timeout(15000)
    });
  } catch (error) {
    throw new Error(`The ERP at ${url.origin} is not reachable (${error.cause?.code || error.name}). Is it running (cds watch)?`);
  }
  if (response.status === 401 || response.status === 403) {
    throw new Error(`The ERP rejected the login of "${ERP_USER}" (HTTP ${response.status}). Check ERP_USER and ERP_PASSWORD in server/.env.`);
  }
  if (!response.ok) throw new Error(`The ERP export ${url} failed with HTTP ${response.status}.`);
  const content = await response.text();
  await ensureFolders();
  const fileName = await freeName(folders.inbox, `erp-products_${timestamp()}.csv`);
  // Written under a temporary name first, so the inbox never shows a half-written file.
  const temporary = path.join(folders.inbox, `${fileName}.part`);
  await fs.writeFile(temporary, content, "utf8");
  await fs.rename(temporary, path.join(folders.inbox, fileName));
  pulledByThisServer.add(fileName);
  return fileName;
}

async function importInbox() {
  await ensureFolders();
  const names = (await fs.readdir(folders.inbox)).filter(n => /\.(csv|json)$/i.test(n)).sort();
  const reports = [];
  for (const name of names) {
    const file = path.join(folders.inbox, name);
    const content = await fs.readFile(file, "utf8");
    // A database failure throws here and leaves the file in the inbox, so the next run retries it.
    const report = await importProductFile({
      fileName: name, content, source: pulledByThisServer.delete(name) ? "erp-export" : "inbox",
      fullSync: EXPORT_FILE.test(name), exportedAt: exportedAtFromName(name)
    });
    const target = report.status === "failed" ? folders.error : folders.archive;
    const targetName = await freeName(target, name);
    await fs.rename(file, path.join(target, targetName));
    await writeNote(target, targetName, report);
    reports.push(report);
  }
  return reports;
}

let inboxRun = null;
// Overlapping calls (timer, dashboard button) share one run instead of importing the same file twice.
export function processInbox() {
  inboxRun ??= importInbox().finally(() => { inboxRun = null; });
  return inboxRun;
}

// One complete transfer: export a fresh file from the ERP into the inbox, then import the inbox.
export async function syncFromErp() {
  try {
    await exportFromErp();
  } catch (error) {
    return {exportError: error.message, imports: [await recordFailedExport(error.message)]};
  }
  return {imports: await processInbox()};
}

// Keeps a copy of every uploaded file next to the transferred ones, so all imports can be traced back to a file.
export async function archiveUpload(originalName, content, report) {
  await ensureFolders();
  const dir = report.status === "failed" ? folders.error : folders.archive;
  const safeName = path.basename(String(originalName || "upload")).replace(/[^\w.-]+/g, "_").slice(0, 100);
  const name = await freeName(dir, `upload_${timestamp()}_${safeName}`);
  await fs.writeFile(path.join(dir, name), content, "utf8");
  await writeNote(dir, name, report);
}

export function transferSettings() {
  return {
    erpExportUrl: new URL("/rest/api/getProducts", ERP_URL).toString(),
    erpUser: ERP_USER,
    syncIntervalMinutes: ERP_SYNC_INTERVAL_MINUTES,
    inboxPollSeconds: ERP_INBOX_POLL_SECONDS,
    inboxFolder: folders.inbox,
    fileNamePattern: "erp-products_YYYYMMDD-HHMMSS.csv (UTC)"
  };
}

export function startErpTransfer() {
  const run = (job, label) => job().catch(error => console.error(`ERP transfer (${label}) failed:`, error.message));
  ensureFolders().then(() => run(processInbox, "inbox"), error => console.error("ERP transfer folders:", error.message));
  if (ERP_INBOX_POLL_SECONDS > 0) setInterval(() => run(processInbox, "inbox"), ERP_INBOX_POLL_SECONDS * 1000).unref();
  if (ERP_SYNC_INTERVAL_MINUTES > 0) setInterval(() => run(syncFromErp, "export"), ERP_SYNC_INTERVAL_MINUTES * 60000).unref();
  console.log(`ERP transfer: inbox ${folders.inbox}` +
    (ERP_INBOX_POLL_SECONDS > 0 ? ` (checked every ${ERP_INBOX_POLL_SECONDS}s)` : " (checked on demand)") +
    `, ERP export ${ERP_SYNC_INTERVAL_MINUTES > 0 ? `every ${ERP_SYNC_INTERVAL_MINUTES} min` : "on demand"} from ${ERP_URL}`);
}
