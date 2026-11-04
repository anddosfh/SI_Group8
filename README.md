# NOVA Gadgets — System Integration Labs 1 & 2

A full-stack electronics storefront inspired by minimalist product-led design. Uses an existing-style `client/` and `server/` structure.

## Categories and demo catalogue
- Phones: 4
- Headphones: 4
- Buds: 4
- Watches: 4
- All Products: 16 total

## Requirements
- Node.js 20+ (LTS) with npm, and Git
- Access to this GitHub repository and to the group's [Neon](https://neon.tech) project (ask for an invitation), or PostgreSQL 13+ installed locally (tested with PostgreSQL 18)
- For Lab 2: the course repository `systems-integration`, which contains the Mini-ERP
- No native C++ build tools required; the `pg` driver is pure JavaScript.

## Setup for group members

The commands are for PowerShell on Windows. Clone this repository and the course repository into the same folder (e.g. `C:\Users\<you>`) and run every command from there, so the relative paths below work. Use `npm.cmd` and `npx.cmd`: PowerShell's execution policy can block plain `npm`.

### 1. Get the code
```powershell
git clone https://github.com/anddosfh/SI_Group8.git
git clone https://codeberg.org/ceedee666/systems-integration.git
```
Skip the second clone if you already have the course repository. Later, `git pull` inside `SI_Group8` fetches the group's changes.

### 2. Database connection in `server/.env`
```powershell
Copy-Item SI_Group8\server\.env.example SI_Group8\server\.env
```
Then open `SI_Group8/server/.env` and pick one option. `DATABASE_URL` must appear only once without a leading `#`.

**Option A — shared Neon database (group work).** Put `#` in front of the local `DATABASE_URL` line and add the group's Neon connection string as `DATABASE_URL=...`. Copy it from the Neon console (**Connect**, the pooled string with a host ending in `-pooler…neon.tech`) after you were invited to the project, or get it privately from a group member. Replace its ending `sslmode=require&channel_binding=require` with `sslmode=verify-full`; it connects either way, but `pg` prints an SSL warning on every start otherwise.

To create the Neon project in the first place (one group member, once): sign up at https://neon.tech, create a free project in a region close to you (e.g. AWS Europe Central / Frankfurt) and invite the others in the project settings.

**Option B — local PostgreSQL.** Keep the default `DATABASE_URL`. Create its `nova` login role and the empty `nova_gadgets` database once; `psql` asks for the password of your PostgreSQL superuser `postgres`:
```powershell
cd SI_Group8\server
npm.cmd run db:setup
```

`server/.env` is listed in `.gitignore`; never commit it or paste the connection string into the repository or a chat. Leave `ERP_SYNC_INTERVAL_MINUTES=0` unless the group agreed that you run the periodic ERP export (see Lab 2 below). The API reads `.env` only at startup, so restart it after every change.

### 3. Terminal 1 — API
```powershell
cd SI_Group8\server
npm.cmd install
npm.cmd run dev
```
The startup message names the database host, so you can check which database you are on. The first start against an empty database creates the tables, the demo catalogue and the demo admin; later starts reuse what is there. Check: http://localhost:4000/api/health

### 4. Terminal 2 — frontend
```powershell
cd SI_Group8\client
npm.cmd install
npm.cmd run dev
```
Open http://localhost:5173 and sign in with the [demo admin](#demo-admin) to reach the admin dashboard.

### 5. Terminal 3 — Mini-ERP (Lab 2)
```powershell
Copy-Item SI_Group8\erp\test-data\de.fhaachen.simpleerp-Products.csv systems-integration\src\simple-erp\test\data\ -Force
cd systems-integration\src\simple-erp
npm.cmd install
npx.cmd cds watch
```
The copied file adds the 16 NOVA products to the ERP's test data ([erp/README.md](erp/README.md)). Check http://localhost:4004/rest/api/getProducts (sign in as `service-user` / `service-user`): the CSV lists 18 products. Then use **Pull from ERP now** in the shop's admin dashboard.

### Troubleshooting
| Problem | Fix |
|---|---|
| `npm` is not recognized in the VS Code terminal | Restart VS Code after installing Node.js. With a portable VS Code, append `;${env:PATH}` to `PATH` in the setting `terminal.integrated.env.windows`. |
| `EADDRINUSE` for port 4000, 5173 or 4004 | The program already runs in another terminal; stop it there with Ctrl+C. |
| The API cannot reach the database | Check `DATABASE_URL` in `server/.env` (only one active line), then restart the API. |
| **Pull from ERP now** reports the ERP as not reachable | Start the Mini-ERP (step 5) and keep its terminal open. |
| **Pull from ERP now** is rejected with "Safety stop" | The ERP runs without the NOVA products: copy the file again (step 5) and restart `cds watch`. |

## Lab 2 — product transfer from the Mini-ERP

The Mini-ERP is the master for product data (ID, name, description, price, stock); the shop imports it from files.

```text
Mini-ERP ── GET /rest/api/getProducts (CSV) ──▶ server/data/erp-transfer/inbox/erp-products_20261103-153000.csv
                                                        │ import (one transaction per file)
                                       success ─────────┴───────── rejected
                                          ▼                           ▼
                                   archive/<file>          error/<file> + <file>.error.txt
```

**ERP setup:** copy the ERP test data with the NOVA products into the ERP, see [erp/README.md](erp/README.md).

**When files are transferred** (`server/.env`, see `.env.example`):
- *On demand*: **Pull from ERP now** in the admin dashboard exports a file from the ERP into the inbox and imports it.
- *Periodically*: `ERP_SYNC_INTERVAL_MINUTES=5` does the same every 5 minutes. Default `0` (off): with the shared Neon database, enable it on one machine only, because every member's ERP keeps its own in-memory data.
- *Dropped files*: any `.csv`/`.json` put into `server/data/erp-transfer/inbox/` (e.g. an export downloaded in the browser) is picked up within `ERP_INBOX_POLL_SECONDS` (default 30).
- *Upload*: the dashboard also accepts a file directly; a copy is kept in `archive/` or `error/`.

**Naming convention:** `erp-products_YYYYMMDD-HHMMSS.csv` (UTC export time). Files with this name are complete exports: ERP products missing from them are deactivated, and a file that is not newer than the last imported export is skipped (moved to `archive/` with a `.skipped.txt` note), so a delayed old file cannot overwrite newer data. Files are written as `<name>.part` and renamed when complete, so a half-written file is never imported.

**File format** (the ERP's export): `productID,name,description,price,stock`, one product per line, price with currency (`1200.00 EUR`). The importer also reads other CSV layouts (`;` as separator, decimal commas, quoted values, headers such as `Product ID` or `Product Name`) and JSON (an array or `{"products": [...]}`).

| ERP field | Shop column | Rule |
|---|---|---|
| productID | `erp_product_id` | key for matching; required, max. 50 characters, unique per file |
| name | `name` | required |
| description | `description` | optional; empty keeps the shop's text |
| price (+ currency) | `price` | required, > 0; only EUR is accepted |
| stock | `stock` | whole number ≥ 0; checkout sells ERP products only while stock lasts |
| – | `category` | the ERP has none: new products get `Other`, existing ones keep theirs |
| – | `image` | new products get a placeholder, existing ones keep theirs |

**Error handling:** a file is imported completely or not at all. Every problem is reported with its line number (missing columns, missing or invalid price/stock, unsupported currency, duplicate product IDs, empty or oversized file, unclosed quotes). The ERP's export does not quote values, so commas inside a description split it into extra columns; the importer joins them back. A complete export that would deactivate more than half of the ERP products at once is rejected as a safety stop (typically an ERP that has not loaded its data yet). If the ERP is unreachable or rejects the login, the attempt is logged and the next interval tries again. Every run is listed under **Import history** in the admin dashboard (table `product_imports`).

**Consistency and limits:** the ERP is the source of truth for price and stock; products are matched only by `productID`, so importing the same file twice changes nothing. Shop orders reduce the shop's stock but do not reach the ERP yet (Lab 3), so the next import resets the stock to the ERP's figure. File transfer is simple and decoupled, but the shop is only as current as the last file.

## Product images
The demo products use SVG illustrations from `client/public/products/`; Vite serves that folder at `/products/…`, and each product's `image` column stores that path (e.g. `/products/nova-phone-one.svg`). To use another image, put the file into that folder, commit it so the whole group has it, and enter `/products/<file name>` as the image URL in the admin dashboard. Full `https://` image URLs work as well.

## Demo admin
Email: `admin@nova.local`
Password: `NovaAdmin123!`

The demo admin is created on first backend startup. Change the demo credentials and `JWT_SECRET` before any public deployment.

## Storage and limitations
The API stores users, products, orders and order items in PostgreSQL. The schema is in `server/src/database/schema.sql`; `server/src/database/db.js` applies it on every start and seeds the demo data into an empty database. Checkout runs in a single transaction and copies product names and prices into `order_items`, so later catalogue changes do not alter past orders. Change the `nova` role's password in `setup.sql` and `DATABASE_URL` before any shared or public deployment. `npm test` runs against the database in `DATABASE_URL`; on the shared Neon database its catalogue check fails once someone has added or removed products. Checkout creates an order but does not process real payments. This is a coursework prototype, not production commerce software.
