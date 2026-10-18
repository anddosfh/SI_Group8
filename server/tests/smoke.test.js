import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { initDatabase, pool, query } from "../src/database/db.js";

before(initDatabase);
after(() => pool.end());

test("catalogue seeds 16 products across four categories", async () => {
  const {rows} = await query("SELECT category, count(*)::int AS count FROM products WHERE active GROUP BY category");
  assert.equal(rows.reduce((sum, r) => sum + r.count, 0), 16);
  for (const category of ["Phones", "Headphones", "Buds", "Watches"]) {
    assert.equal(rows.find(r => r.category === category)?.count, 4);
  }
});
