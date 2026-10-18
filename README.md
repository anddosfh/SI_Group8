# NOVA Gadgets — System Integration Lab 1

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

## Demo admin
Email: `admin@nova.local`
Password: `NovaAdmin123!`

The demo admin is created on first backend startup. Change the demo credentials and `JWT_SECRET` before any public deployment.

## Storage and limitations
The API stores users, products, orders and order items in PostgreSQL. The schema is in `server/src/database/schema.sql`; `server/src/database/db.js` applies it on every start and seeds the demo data into an empty database. Checkout runs in a single transaction and copies product names and prices into `order_items`, so later catalogue changes do not alter past orders. Change the `nova` role's password in `setup.sql` and `DATABASE_URL` before any shared or public deployment. `npm test` runs against the database in `DATABASE_URL`; on the shared Neon database its catalogue check fails once someone has added or removed products. Checkout creates an order but does not process real payments. This is a coursework prototype, not production commerce software.
