# NOVA Gadgets — System Integration Labs 1 & 2

A full-stack electronics storefront inspired by minimalist product-led design. Uses an existing-style `client/` and `server/` structure.

## Categories and demo catalogue
- Phones: 4
- Headphones: 4
- Buds: 4
- Watches: 4
- All Products: 16 total

## Requirements
- Node.js 20+ recommended
- npm
- A PostgreSQL database: the group's shared [Neon](https://neon.tech) project, or PostgreSQL 13+ installed locally (tested with PostgreSQL 18)
- No native C++ build tools required; the `pg` driver is pure JavaScript.

## Run locally

The API connects to the database in `DATABASE_URL` from `server/.env` (copy `server/.env.example`). Tables, the demo catalogue and the demo admin are created automatically on the first API start against an empty database; later starts reuse what is there. The startup message names the database host, so you can check which database you are on.

### Option A — shared Neon database (group work)
One group member sets it up:
1. Create a free project at https://neon.tech (pick a region close to you, e.g. AWS Europe Central / Frankfurt).
2. In the project dashboard, open **Connect** and copy the connection string (the pooled one, host ending in `-pooler…neon.tech`).
3. Share that string with the group privately (it contains the database password), or invite the members to the Neon project.

Every group member, on their own machine:
1. Copy `server/.env.example` to `server/.env`.
2. Set `DATABASE_URL` to the Neon string. Replace its ending `sslmode=require&channel_binding=require` with `sslmode=verify-full`; it connects either way, but `pg` prints an SSL warning on every start otherwise.
3. Start the API as below.

`server/.env` is listed in `.gitignore`; never commit it or paste the string into the repository.

### Option B — local PostgreSQL
Create the `nova` login role and the empty `nova_gadgets` database once; `psql` asks for the password of your PostgreSQL superuser `postgres`. The default `DATABASE_URL` in `.env.example` points to it.
```powershell
cd "$HOME\Desktop\nova_si\server"
npm.cmd run db:setup
```

### Terminal 1 — API
```powershell
cd "$HOME\Desktop\nova_si\server"
npm.cmd install
npm.cmd run dev
```
API health: http://localhost:4000/api/health

### Terminal 2 — frontend
```powershell
cd "$HOME\Desktop\nova_si\client"
npm.cmd install
npm.cmd run dev
```
Open the Vite URL shown in the terminal (usually http://localhost:5173).

## Merge into the existing `nova_si` project
1. Back up the existing `nova_si` folder.
2. Extract this ZIP somewhere temporary.
3. Copy the `client` and `server` folders from this ZIP into your existing `nova_si` folder and allow replacement of old source files after backup.
4. Keep your group's `docs` and `tests` files if they contain coursework material you need. The server's new tests folder is optional.
5. Install dependencies in both folders using the commands above.

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
