import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
export const PORT = Number(process.env.PORT || 4000);
export const JWT_SECRET = process.env.JWT_SECRET || "nova-lab-secret-change-before-deployment";
export const DATABASE_URL = process.env.DATABASE_URL || "postgres://nova:nova_local_dev@localhost:5432/nova_gadgets";

// Lab 2: product transfer from the Mini-ERP. The defaults match the ERP's local development setup (cds watch).
export const ERP_URL = process.env.ERP_URL || "http://localhost:4004";
export const ERP_USER = process.env.ERP_USER || "service-user";
export const ERP_PASSWORD = process.env.ERP_PASSWORD || "service-user";
// 0 = export from the ERP only on demand (admin dashboard). Enable it on one machine only when the group shares a database.
export const ERP_SYNC_INTERVAL_MINUTES = Number(process.env.ERP_SYNC_INTERVAL_MINUTES || 0);
// How often the inbox folder is checked for new files; 0 = only when an import is started from the dashboard.
export const ERP_INBOX_POLL_SECONDS = Number(process.env.ERP_INBOX_POLL_SECONDS ?? 30);
export const ERP_TRANSFER_DIR = path.resolve(process.env.ERP_TRANSFER_DIR ||
  path.join(path.dirname(fileURLToPath(import.meta.url)), "../../data/erp-transfer"));
