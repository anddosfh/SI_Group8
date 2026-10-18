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
  {name:"NOVA Phone One",description:"A balanced everyday smartphone with a clean, considered design.",price:499,category:"Phones",image:"https://placehold.co/700x600/e5e5df/242520?text=NOVA+PHONE+01"},
  {name:"NOVA Phone One Pro",description:"A refined phone experience for people who want more from every day.",price:699,category:"Phones",image:"https://placehold.co/700x600/e5e5df/242520?text=NOVA+PHONE+PRO"},
  {name:"NOVA Phone Lite",description:"Essential performance and a lightweight form made for everyday life.",price:329,category:"Phones",image:"https://placehold.co/700x600/e5e5df/242520?text=NOVA+PHONE+LITE"},
  {name:"NOVA Phone Max",description:"A larger display and long-lasting power for your daily routines.",price:599,category:"Phones",image:"https://placehold.co/700x600/e5e5df/242520?text=NOVA+PHONE+MAX"},
  {name:"NOVA Headphone One",description:"Immersive sound with soft cushions and a comfortable over-ear fit.",price:179,category:"Headphones",image:"https://placehold.co/700x600/e4e5e0/242520?text=NOVA+HEADPHONE+01"},
  {name:"NOVA Headphone Studio",description:"Detailed listening with a considered, studio-inspired sound profile.",price:229,category:"Headphones",image:"https://placehold.co/700x600/e4e5e0/242520?text=NOVA+STUDIO"},
  {name:"NOVA Headphone Lite",description:"Lightweight wireless listening for commutes, work and weekends.",price:99,category:"Headphones",image:"https://placehold.co/700x600/e4e5e0/242520?text=NOVA+HEADPHONE+LITE"},
  {name:"NOVA Headphone Max",description:"All-day comfort and rich sound in a minimal silhouette.",price:199,category:"Headphones",image:"https://placehold.co/700x600/e4e5e0/242520?text=NOVA+HEADPHONE+MAX"},
  {name:"NOVA Buds One",description:"Compact wireless buds with clear calls and balanced everyday sound.",price:89,category:"Buds",image:"https://placehold.co/700x600/e6e6e1/242520?text=NOVA+BUDS+01"},
  {name:"NOVA Buds Pro",description:"An elevated listening experience in a pocket-friendly charging case.",price:129,category:"Buds",image:"https://placehold.co/700x600/e6e6e1/242520?text=NOVA+BUDS+PRO"},
  {name:"NOVA Buds Lite",description:"Simple, lightweight wireless audio for everyday listening.",price:49,category:"Buds",image:"https://placehold.co/700x600/e6e6e1/242520?text=NOVA+BUDS+LITE"},
  {name:"NOVA Buds Sport",description:"A secure fit and reliable sound for movement and active days.",price:79,category:"Buds",image:"https://placehold.co/700x600/e6e6e1/242520?text=NOVA+BUDS+SPORT"},
  {name:"NOVA Watch One",description:"A clean smartwatch interface for activity, time and notifications.",price:129,category:"Watches",image:"https://placehold.co/700x600/e4e5df/242520?text=NOVA+WATCH+01"},
  {name:"NOVA Watch Pro",description:"A more advanced everyday watch with a bright, crisp display.",price:199,category:"Watches",image:"https://placehold.co/700x600/e4e5df/242520?text=NOVA+WATCH+PRO"},
  {name:"NOVA Watch Lite",description:"The essentials in a slim, lightweight smartwatch.",price:79,category:"Watches",image:"https://placehold.co/700x600/e4e5df/242520?text=NOVA+WATCH+LITE"},
  {name:"NOVA Watch Active",description:"Activity tracking and practical daily features in a durable form.",price:149,category:"Watches",image:"https://placehold.co/700x600/e4e5df/242520?text=NOVA+WATCH+ACTIVE"}
];

// Creates the tables, then the demo catalogue (only into an empty products table) and the demo admin.
export async function initDatabase() {
  await withTransaction(async client => {
    // Serialises concurrent starts (e.g. the dev server and the tests) so setup runs once.
    await client.query("SELECT pg_advisory_xact_lock(4711)");
    await client.query(schema);
    const {rows:[{count}]} = await client.query("SELECT count(*)::int AS count FROM products");
    if (count === 0) {
      for (const p of demoProducts) {
        await client.query("INSERT INTO products (name, description, price, category, image) VALUES ($1, $2, $3, $4, $5)", [p.name, p.description, p.price, p.category, p.image]);
      }
    }
    const {rowCount} = await client.query("SELECT 1 FROM users WHERE email = $1", ["admin@nova.local"]);
    if (rowCount === 0) {
      await client.query("INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, 'admin')", ["NOVA Admin", "admin@nova.local", await bcrypt.hash("NovaAdmin123!", 10)]);
    }
  });
}
