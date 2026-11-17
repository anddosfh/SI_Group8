import { test } from "node:test";
import assert from "node:assert/strict";
import { withLiveStock } from "../src/services/productService.js";

const rows = [
  {id: 1, erp_product_id: "NOVA-WATCH-LITE", name: "NOVA Watch Lite", price: 79, category: "Watches"},
  {id: 2, erp_product_id: "NOVA-PHONE-ONE", name: "NOVA Phone One", price: 499, category: "Phones"},
  {id: 3, erp_product_id: null, name: "Shop only", price: 10, category: "Other"},
  {id: 4, erp_product_id: "NOT-IN-ERP", name: "Gone", price: 5, category: "Other"}
];
const erp = [
  {uuid: "u1", productId: "NOVA-WATCH-LITE", price: 79, stock: 0},
  {uuid: "u2", productId: "NOVA-PHONE-ONE", price: 549, stock: 40}
];

test("adds live ERP stock and the ERP price", () => {
  const [watch, phone, shopOnly, gone] = withLiveStock(rows, erp);
  assert.deepEqual([watch.stock, watch.availability], [0, "out_of_stock"]);
  assert.deepEqual([phone.stock, phone.availability, phone.price], [40, "in_stock", 549]);
  assert.deepEqual([shopOnly.stock, shopOnly.availability, shopOnly.price], [null, "not_sold", 10]);
  assert.deepEqual([gone.stock, gone.availability], [null, "not_sold"]);
});

test("ERP unavailable: ERP products are unknown, shop prices stay", () => {
  const [watch, , shopOnly] = withLiveStock(rows, null);
  assert.deepEqual([watch.stock, watch.availability, watch.price], [null, "unknown", 79]);
  assert.equal(shopOnly.availability, "not_sold");
});
