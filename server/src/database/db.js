import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";
import pg from "pg";
import { DATABASE_URL } from "../config/env.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const schema = fs.readFileSync(path.join(here, "schema.sql"), "utf8");

// pg returns NUMERIC (prices, totals) as strings by default; the API sends plain numbers.
pg.types.setTypeParser(pg.types.builtins.NUMERIC, Number);

export const pool = new pg.Pool({connectionString:DATABASE_URL});
// Without a listener, an idle connection dropped by the database server would crash the process.
pool.on("error", error => console.error("PostgreSQL connection error:", error.message));

export function query(text, params) {
  return pool.query(text, params);
}
export async function withTransaction(work) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

const demoProducts = [
  {erpId:"NOVA-PHONE-ONE",stock:40,name:"NOVA Phone One",description:"A balanced everyday smartphone with a clean, considered design.",price:499,category:"Phones",image:"/products/nova-phone-one.svg"},
  {erpId:"NOVA-PHONE-ONE-PRO",stock:25,name:"NOVA Phone One Pro",description:"A refined phone experience for people who want more from every day.",price:699,category:"Phones",image:"/products/nova-phone-one-pro.svg"},
  {erpId:"NOVA-PHONE-LITE",stock:60,name:"NOVA Phone Lite",description:"Essential performance and a lightweight form made for everyday life.",price:329,category:"Phones",image:"/products/nova-phone-lite.svg"},
  {erpId:"NOVA-PHONE-MAX",stock:18,name:"NOVA Phone Max",description:"A larger display and long-lasting power for your daily routines.",price:599,category:"Phones",image:"/products/nova-phone-max.svg"},
  {erpId:"NOVA-HEADPHONE-ONE",stock:35,name:"NOVA Headphone One",description:"Immersive sound with soft cushions and a comfortable over-ear fit.",price:179,category:"Headphones",image:"/products/nova-headphone-one.svg"},
  {erpId:"NOVA-HEADPHONE-STUDIO",stock:12,name:"NOVA Headphone Studio",description:"Detailed listening with a considered, studio-inspired sound profile.",price:229,category:"Headphones",image:"/products/nova-headphone-studio.svg"},
  {erpId:"NOVA-HEADPHONE-LITE",stock:80,name:"NOVA Headphone Lite",description:"Lightweight wireless listening for commutes, work and weekends.",price:99,category:"Headphones",image:"/products/nova-headphone-lite.svg"},
  {erpId:"NOVA-HEADPHONE-MAX",stock:20,name:"NOVA Headphone Max",description:"All-day comfort and rich sound in a minimal silhouette.",price:199,category:"Headphones",image:"/products/nova-headphone-max.svg"},
  {erpId:"NOVA-BUDS-ONE",stock:120,name:"NOVA Buds One",description:"Compact wireless buds with clear calls and balanced everyday sound.",price:89,category:"Buds",image:"/products/nova-buds-one.svg"},
  {erpId:"NOVA-BUDS-PRO",stock:45,name:"NOVA Buds Pro",description:"An elevated listening experience in a pocket-friendly charging case.",price:129,category:"Buds",image:"/products/nova-buds-pro.svg"},
  {erpId:"NOVA-BUDS-LITE",stock:150,name:"NOVA Buds Lite",description:"Simple, lightweight wireless audio for everyday listening.",price:49,category:"Buds",image:"/products/nova-buds-lite.svg"},
  {erpId:"NOVA-BUDS-SPORT",stock:3,name:"NOVA Buds Sport",description:"A secure fit and reliable sound for movement and active days.",price:79,category:"Buds",image:"/products/nova-buds-sport.svg"},
  {erpId:"NOVA-WATCH-ONE",stock:30,name:"NOVA Watch One",description:"A clean smartwatch interface for activity, time and notifications.",price:129,category:"Watches",image:"/products/nova-watch-one.svg"},
  {erpId:"NOVA-WATCH-PRO",stock:15,name:"NOVA Watch Pro",description:"A more advanced everyday watch with a bright, crisp display.",price:199,category:"Watches",image:"/products/nova-watch-pro.svg"},
  {erpId:"NOVA-WATCH-LITE",stock:0,name:"NOVA Watch Lite",description:"The essentials in a slim, lightweight smartwatch.",price:79,category:"Watches",image:"/products/nova-watch-lite.svg"},
  {erpId:"NOVA-WATCH-ACTIVE",stock:22,name:"NOVA Watch Active",description:"Activity tracking and practical daily features in a durable form.",price:149,category:"Watches",image:"/products/nova-watch-active.svg"}
];

// Creates the tables, then the demo catalogue (only into an empty products table) and the demo admin.
// The demo products carry the productID they have in the Mini-ERP (erp/test-data), so ERP imports update them.
export async function initDatabase() {
  await withTransaction(async client => {
    // Serialises concurrent starts (e.g. the dev server and the tests) so setup runs once.
    await client.query("SELECT pg_advisory_xact_lock(4711)");
    await client.query(schema);
    const {rows:[{count}]} = await client.query("SELECT count(*)::int AS count FROM products");
    if (count === 0) {
      for (const p of demoProducts) {
        await client.query("INSERT INTO products (erp_product_id, name, description, price, category, image, stock) VALUES ($1, $2, $3, $4, $5, $6, $7)", [p.erpId, p.name, p.description, p.price, p.category, p.image, p.stock]);
      }
    }
    // Databases seeded before the ERP link (Lab 1) get their demo products linked once, matched by name.
    for (const p of demoProducts) {
      await client.query(
        `UPDATE products SET erp_product_id = $1, stock = $2
          WHERE name = $3 AND erp_product_id IS NULL AND NOT EXISTS (SELECT 1 FROM products WHERE erp_product_id = $1)`,
        [p.erpId, p.stock, p.name]);
    }
    const {rowCount} = await client.query("SELECT 1 FROM users WHERE email = $1", ["admin@nova.local"]);
    if (rowCount === 0) {
      await client.query("INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, 'admin')", ["NOVA Admin", "admin@nova.local", await bcrypt.hash("NovaAdmin123!", 10)]);
    }
  });
}
