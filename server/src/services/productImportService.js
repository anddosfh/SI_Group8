import path from "node:path";
import { query, withTransaction } from "../database/db.js";
import { CATEGORIES } from "../validators/common.js";

// Lab 2: imports product files exported by the Mini-ERP into the catalogue.
// Main format: the CSV of GET /rest/api/getProducts ("productID,name,description,price,stock", price like "1200.00 EUR").
// Also accepted: other CSV layouts with recognisable headers (e.g. ";" and decimal commas from Excel) and JSON.

const DEFAULT_CATEGORY = "Other";
const SHOP_CURRENCY = "EUR";
const MAX_FILE_BYTES = 2 * 1024 * 1024;
const MAX_PRODUCTS = 5000;
const MAX_ERRORS = 100;

// Accepted CSV column names / JSON keys per field, compared without case, spaces and punctuation, in order of
// preference ("productID" wins over "ID", which is the ERP's internal UUID in its JSON API and CAP CSV files).
const COLUMN_ALIASES = {
  productId: ["productid", "erpproductid", "id"],
  name: ["name", "productname"],
  description: ["description", "productdescription"],
  price: ["price"],
  currency: ["currency", "currencycode"],
  stock: ["stock"],
  category: ["category"],
  image: ["image", "imageurl"]
};
const REQUIRED_COLUMNS = ["productId", "name", "price"];

class FileError extends Error {}
// Raised inside the import transaction to reject a file after looking at the database; rolls everything back.
class ImportRejected extends Error {}

const normalizeKey = key => String(key).toLowerCase().replace(/[^a-z0-9]/g, "");
const text = value => value === undefined || value === null ? "" : String(value).trim();

function resolveColumns(names) {
  const normalized = names.map(normalizeKey);
  const columns = {};
  for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
    const alias = aliases.find(a => normalized.includes(a));
    if (alias) columns[field] = normalized.indexOf(alias);
  }
  return columns;
}

function detectDelimiter(content) {
  const header = content.split(/\r?\n/, 1)[0];
  const [best] = [",", ";", "\t"].map(d => [d, header.split(d).length - 1]).sort((a, b) => b[1] - a[1]);
  return best[1] > 0 ? best[0] : ",";
}

// RFC 4180 CSV (quoted fields, "" escapes, line breaks inside quotes). A quote only starts a quoted field at the
// beginning of a field, so stray quotes in the ERP's unquoted values (e.g. 6.1" display) stay literal.
function parseCsv(content) {
  const delimiter = detectDelimiter(content);
  const records = [];
  let field = "", record = [], inQuotes = false, line = 1, recordLine = 1;
  for (let i = 0; i < content.length; i++) {
    const ch = content[i];
    if (inQuotes) {
      if (ch === '"' && content[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else { if (ch === "\n") line++; field += ch; }
    } else if (ch === '"' && field === "") inQuotes = true;
    else if (ch === delimiter) { record.push(field); field = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && content[i + 1] === "\n") i++;
      record.push(field);
      records.push({line: recordLine, cells: record});
      record = []; field = ""; line++; recordLine = line;
    } else field += ch;
  }
  if (inQuotes) throw new FileError(`Line ${recordLine}: a quoted value is never closed.`);
  if (field !== "" || record.length) { record.push(field); records.push({line: recordLine, cells: record}); }
  return {delimiter, records: records.filter(r => r.cells.some(c => c.trim() !== ""))};
}

function csvItems(content) {
  const {delimiter, records} = parseCsv(content);
  if (records.length === 0) throw new FileError("The file is empty.");
  const [header, ...rows] = records;
  const columns = resolveColumns(header.cells);
  const missing = REQUIRED_COLUMNS.filter(f => columns[f] === undefined);
  if (missing.length) {
    throw new FileError(`Line ${header.line}: column(s) ${missing.join(", ")} missing in the header "${header.cells.join(delimiter)}". ` +
      `Expected the ERP export header "productID,name,description,price,stock".`);
  }
  return rows.map(({line, cells}) => {
    const label = `Line ${line}`;
    // The ERP writes values without quotes, so a comma inside a description splits it into extra cells. Only the
    // description is free text, so the surplus cells are joined back into it.
    if (cells.length > header.cells.length && columns.description !== undefined) {
      const at = columns.description, extra = cells.length - header.cells.length;
      cells = [...cells.slice(0, at), cells.slice(at, at + extra + 1).join(delimiter), ...cells.slice(at + extra + 1)];
    }
    if (cells.length > header.cells.length) return {label, error: `${cells.length} values, but the header has ${header.cells.length} columns.`};
    const item = {};
    for (const [field, index] of Object.entries(columns)) item[field] = cells[index];
    return {label, item};
  });
}

function jsonItems(content) {
  let data;
  try { data = JSON.parse(content); }
  catch (error) { throw new FileError(`The file is not valid JSON (${error.message}).`); }
  const list = Array.isArray(data) ? data : data?.products;
  if (!Array.isArray(list)) throw new FileError('Expected a JSON array of products or an object with a "products" array.');
  return list.map((raw, index) => {
    const label = `Product ${index + 1}`;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {label, error: "is not an object."};
    const keys = Object.keys(raw);
    const columns = resolveColumns(keys);
    const item = {};
    for (const [field, at] of Object.entries(columns)) item[field] = raw[keys[at]];
    return {label, item};
  });
}

// "1200.00 EUR" (ERP export), "1.200,50 €", "EUR 89.99", 89.99 → {amount, currency} or {problem}.
function parsePrice(rawPrice, rawCurrency) {
  let currency = text(rawCurrency).toUpperCase();
  const tokens = text(rawPrice).split(/\s+/).filter(Boolean);
  const currencyToken = tokens.find(t => /^([A-Za-z]{3}|€)$/.test(t));
  if (currencyToken) {
    const fromPrice = currencyToken === "€" ? "EUR" : currencyToken.toUpperCase();
    if (currency && currency !== fromPrice) return {problem: `price currency ${fromPrice} does not match currency column ${currency}`};
    currency = fromPrice;
  }
  let number = tokens.filter(t => t !== currencyToken).join("").replace(/€/g, "");
  if (!number || number.toLowerCase() === "null") return {problem: "price is missing"};
  if (number.includes(",") && number.includes(".")) {
    const decimal = number.lastIndexOf(",") > number.lastIndexOf(".") ? "," : ".";
    number = number.replace(decimal === "," ? /\./g : /,/g, "").replace(",", ".");
  } else if (number.includes(",")) number = /,\d{1,2}$/.test(number) ? number.replace(/,(?=\d{1,2}$)/, ".").replace(/,/g, "") : number.replace(/,/g, "");
  else if ((number.match(/\./g) || []).length > 1) number = number.replace(/\./g, "");
  if (!/^-?\d+(\.\d+)?$/.test(number)) return {problem: `price "${text(rawPrice)}" is not a number`};
  const amount = Math.round(Number(number) * 100) / 100;
  if (amount <= 0) return {problem: `price must be greater than 0 (got ${text(rawPrice)})`};
  if (amount > 10000000) return {problem: `price ${text(rawPrice)} is unrealistically high`};
  return {amount, currency: currency || SHOP_CURRENCY};
}

function toProduct(item) {
  const problems = [];
  const productId = text(item.productId), name = text(item.name), description = text(item.description);
  const category = text(item.category), image = text(item.image), rawStock = text(item.stock);
  if (!productId) problems.push("product ID is missing");
  else if (productId.length > 50) problems.push("product ID is longer than 50 characters");
  if (!name) problems.push("name is missing");
  else if (name.length > 120) problems.push("name is longer than 120 characters");
  if (description.length > 500) problems.push("description is longer than 500 characters");
  const price = parsePrice(item.price, item.currency);
  if (price.problem) problems.push(price.problem);
  else if (price.currency !== SHOP_CURRENCY) problems.push(`currency ${price.currency} is not supported (the shop sells in ${SHOP_CURRENCY})`);
  let stock = null;
  if (rawStock !== "") {
    stock = Number(rawStock);
    if (!Number.isInteger(stock) || stock < 0 || stock > 1000000) problems.push(`stock must be a whole number of 0 or more (got "${rawStock}")`);
  }
  if (category && !CATEGORIES.includes(category)) problems.push(`category "${category}" is unknown (allowed: ${CATEGORIES.join(", ")})`);
  if (image.length > 1000) problems.push("image URL is longer than 1000 characters");
  if (problems.length) return {problems};
  // Empty optional values mean "not provided": they never overwrite what the shop already has.
  return {product: {productId, name, description: description || null, price: price.amount, stock, category: category || null, image: image || null}};
}

// Reads and validates a whole file. Returns every problem at once; a file with any problem is rejected completely.
export function parseProductFile(fileName, content) {
  if (typeof content !== "string") return {products: [], errors: ["The file content is missing."]};
  if (Buffer.byteLength(content) > MAX_FILE_BYTES) return {products: [], errors: [`The file is larger than ${MAX_FILE_BYTES / 1024 / 1024} MB.`]};
  content = content.replace(/^﻿/, "");
  const extension = path.extname(fileName || "").toLowerCase();
  const format = extension === ".json" ? "json" : [".csv", ".txt", ""].includes(extension) ? "csv" : null;
  if (!format) return {products: [], errors: [`Files of type "${extension}" are not supported. Use the ERP's CSV export (.csv) or JSON (.json).`]};
  if (!content.trim()) return {products: [], errors: ["The file is empty."]};
  let items;
  try { items = format === "json" ? jsonItems(content) : csvItems(content); }
  catch (error) { if (error instanceof FileError) return {products: [], errors: [error.message]}; throw error; }
  if (items.length === 0) return {products: [], errors: ["The file contains no products."]};
  if (items.length > MAX_PRODUCTS) return {products: [], errors: [`The file contains ${items.length} products; at most ${MAX_PRODUCTS} are allowed.`]};

  const errors = [], products = [], firstSeen = new Map();
  for (const {label, item, error} of items) {
    if (error) { errors.push(`${label}: ${error}`); continue; }
    const {product, problems} = toProduct(item);
    if (problems) { errors.push(...problems.map(p => `${label}: ${p}`)); continue; }
    if (firstSeen.has(product.productId)) { errors.push(`${label}: product ID ${product.productId} appears again (first in ${firstSeen.get(product.productId)}).`); continue; }
    firstSeen.set(product.productId, label.toLowerCase());
    products.push(product);
  }
  if (errors.length > MAX_ERRORS) errors.splice(MAX_ERRORS, errors.length - MAX_ERRORS, `… and ${errors.length - MAX_ERRORS} more problems.`);
  return {products, errors, total: items.length};
}

const money = value => `€${Number(value).toFixed(2)}`;
const placeholderImage = name => `https://placehold.co/700x600/e5e5df/242520?text=${encodeURIComponent(name)}`;

// Applies validated products: insert new ERP products, update changed ones, and with fullSync deactivate ERP products
// that are no longer exported. Products created in the shop itself (no erp_product_id) are never touched.
async function applyProducts(client, products, fullSync) {
  // One import at a time, also across group members' servers that share the database.
  await client.query("SELECT pg_advisory_xact_lock(4712)");
  const ids = products.map(p => p.productId);
  const {rows} = await client.query(
    "SELECT id, erp_product_id, name, description, price, category, image, stock, active FROM products WHERE erp_product_id = ANY($1::text[]) FOR UPDATE",
    [ids]);
  const existing = new Map(rows.map(r => [r.erp_product_id, r]));
  const result = {inserted: 0, updated: 0, unchanged: 0, deactivated: 0, changes: []};
  for (const p of products) {
    const row = existing.get(p.productId);
    if (!row) {
      await client.query(
        "INSERT INTO products (erp_product_id, name, description, price, category, image, stock) VALUES ($1, $2, $3, $4, $5, $6, $7)",
        [p.productId, p.name, p.description ?? "", p.price, p.category ?? DEFAULT_CATEGORY, p.image ?? placeholderImage(p.name), p.stock ?? 0]);
      result.inserted++;
      result.changes.push(`${p.productId}: new product "${p.name}" (${money(p.price)}, stock ${p.stock ?? 0})`);
      continue;
    }
    const next = {name: p.name, description: p.description ?? row.description, price: p.price, category: p.category ?? row.category,
      image: p.image ?? row.image, stock: p.stock ?? row.stock};
    const diffs = [];
    if (row.name !== next.name) diffs.push(`name "${row.name}" → "${next.name}"`);
    if (row.description !== next.description) diffs.push("description changed");
    if (Number(row.price) !== next.price) diffs.push(`price ${money(row.price)} → ${money(next.price)}`);
    if (row.category !== next.category) diffs.push(`category ${row.category} → ${next.category}`);
    if (row.image !== next.image) diffs.push("image changed");
    if (row.stock !== next.stock) diffs.push(`stock ${row.stock} → ${next.stock}`);
    if (!row.active) diffs.push("back in the ERP export, reactivated");
    if (!diffs.length) { result.unchanged++; continue; }
    await client.query(
      "UPDATE products SET name = $2, description = $3, price = $4, category = $5, image = $6, stock = $7, active = TRUE WHERE id = $1",
      [row.id, next.name, next.description, next.price, next.category, next.image, next.stock]);
    result.updated++;
    result.changes.push(`${p.productId}: ${diffs.join(", ")}`);
  }
  if (fullSync) {
    const {rows: [{active}]} = await client.query("SELECT count(*)::int AS active FROM products WHERE erp_product_id IS NOT NULL AND active");
    const {rows: gone} = await client.query(
      "UPDATE products SET active = FALSE WHERE erp_product_id IS NOT NULL AND active AND NOT (erp_product_id = ANY($1::text[])) RETURNING erp_product_id, name",
      [ids]);
    // A complete export that suddenly lacks most products is far more likely a broken, truncated or wrong export
    // (e.g. an ERP that has not loaded its data) than a real change, so the whole file is rejected.
    if (gone.length > 3 && gone.length > active / 2) {
      throw new ImportRejected(`Safety stop: this complete export would deactivate ${gone.length} of ${active} ERP products. ` +
        "Check the ERP data first. To import it anyway, upload it without \"complete export\".");
    }
    result.deactivated = gone.length;
    for (const g of gone) result.changes.push(`${g.erp_product_id}: "${g.name}" is no longer in the ERP export, deactivated`);
  }
  return result;
}

const importColumns = `id, file_name AS "fileName", source, status, full_sync AS "fullSync", exported_at AS "exportedAt",
  received, inserted, updated, unchanged, deactivated, errors, changes, created_at AS "createdAt"`;

async function logImport(entry, runner = {query}) {
  const {rows: [row]} = await runner.query(
    `INSERT INTO product_imports (file_name, source, status, full_sync, exported_at, received, inserted, updated, unchanged, deactivated, errors, changes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12::jsonb) RETURNING ${importColumns}`,
    [entry.fileName, entry.source, entry.status, Boolean(entry.fullSync), entry.exportedAt ?? null, entry.received ?? 0,
      entry.inserted ?? 0, entry.updated ?? 0, entry.unchanged ?? 0, entry.deactivated ?? 0,
      JSON.stringify(entry.errors ?? []), JSON.stringify((entry.changes ?? []).slice(0, 500))]);
  return row;
}

// Imports one product file and records the outcome in product_imports. Problems in the file are returned as a
// "failed" report, never thrown; only infrastructure errors (e.g. the database is down) throw.
// source: "upload" (admin dashboard), "inbox" (file dropped into the transfer folder), "erp-export" (fetched from the ERP).
export async function importProductFile({fileName, content, source, fullSync = false, exportedAt = null}) {
  const {products, errors, total = 0} = parseProductFile(fileName, content);
  const entry = {fileName, source, fullSync, exportedAt, received: total};
  if (errors.length) return logImport({...entry, status: "failed", errors});
  // Transferred exports must be newer than the last one imported, so a delayed old file cannot undo newer data.
  if (exportedAt && source !== "upload") {
    const {rows: [{last}]} = await query("SELECT max(exported_at) AS last FROM product_imports WHERE status = 'success'");
    if (last && exportedAt <= last) {
      return logImport({...entry, status: "skipped",
        errors: [`Exported ${exportedAt.toISOString()}, which is not newer than the last imported export (${last.toISOString()}).`]});
    }
  }
  try {
    return await withTransaction(async client => logImport({...entry, status: "success", ...await applyProducts(client, products, fullSync)}, client));
  } catch (error) {
    if (error instanceof ImportRejected) return logImport({...entry, status: "failed", errors: [error.message]});
    throw error;
  }
}

// Records an ERP export that never produced a file (ERP not reachable, login rejected, ...).
export function recordFailedExport(message) {
  return logImport({fileName: "(ERP export)", source: "erp-export", status: "failed", errors: [message]});
}

export async function listImports(limit = 20) {
  return (await query(`SELECT ${importColumns} FROM product_imports ORDER BY id DESC LIMIT $1`, [limit])).rows;
}
