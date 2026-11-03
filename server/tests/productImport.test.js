import test from "node:test";
import assert from "node:assert/strict";
import { parseProductFile } from "../src/services/productImportService.js";

// Exactly what the Mini-ERP's GET /rest/api/getProducts returned for its sample data.
const erpExport = "productID,name,description,price,stock\nDXTR1000,MTB,,1200.00 EUR,25\nGRVL1000,Gravel,,2300.00 EUR,15";

test("reads the ERP export: price with currency, empty description, stock", () => {
  const {products, errors} = parseProductFile("erp-products_20261103-153000.csv", erpExport);
  assert.deepEqual(errors, []);
  assert.deepEqual(products[0], {productId: "DXTR1000", name: "MTB", description: null, price: 1200, stock: 25, category: null, image: null});
  assert.equal(products[1].price, 2300);
});

test("joins a description that the unquoted ERP export split at its commas", () => {
  const csv = "productID,name,description,price,stock\r\nNOVA-HEADPHONE-LITE,NOVA Headphone Lite,Lightweight wireless listening for commutes, work and weekends.,99.00 EUR,80\r\n";
  const {products, errors} = parseProductFile("export.csv", csv);
  assert.deepEqual(errors, []);
  assert.equal(products[0].description, "Lightweight wireless listening for commutes, work and weekends.");
  assert.equal(products[0].stock, 80);
});

test("reads Excel-style CSV: BOM, semicolons, quotes, decimal comma, labelled headers", () => {
  const csv = '﻿Product ID;Product Name;Product Description;Price;Currency;Stock\n"NOVA-BUDS-PRO";"NOVA Buds Pro";"Pocket case; ""studio"" sound";"1.129,50";EUR;45\n';
  const {products, errors} = parseProductFile("products.csv", csv);
  assert.deepEqual(errors, []);
  assert.equal(products[0].productId, "NOVA-BUDS-PRO");
  assert.equal(products[0].description, 'Pocket case; "studio" sound');
  assert.equal(products[0].price, 1129.5);
});

test("rejects a file without the required columns", () => {
  const {errors} = parseProductFile("x.csv", "productID,name,stock\nA,B,1");
  assert.equal(errors.length, 1);
  assert.match(errors[0], /Line 1: column\(s\) price missing/);
});

test("reports every invalid line with its line number", () => {
  const csv = [
    "productID,name,description,price,stock",
    "A1,Valid,,10.00 EUR,1",
    "A2,Bad price,,abc EUR,1",
    "A3,Dollars,,10.00 USD,1",
    "A4,Negative stock,,10.00 EUR,-2",
    ",No ID,,10.00 EUR,1",
    "A1,Duplicate,,12.00 EUR,1",
    "A5,No price,,null EUR,3"
  ].join("\n");
  const {errors} = parseProductFile("x.csv", csv);
  assert.equal(errors.length, 6);
  assert.match(errors[0], /^Line 3: price "abc EUR" is not a number/);
  assert.match(errors[1], /^Line 4: currency USD is not supported/);
  assert.match(errors[2], /^Line 5: stock must be a whole number/);
  assert.match(errors[3], /^Line 6: product ID is missing/);
  assert.match(errors[4], /^Line 7: product ID A1 appears again \(first in line 2\)/);
  assert.match(errors[5], /^Line 8: price is missing/);
});

test("reads JSON from the ERP's REST API and prefers productID over the internal ID", () => {
  const json = JSON.stringify([{ID: "67d85897-dd5a-49b3-bf5c-64df5342b5c2", productID: "DXTR1000", name: "MTB", description: null, price: 1200, currency: "EUR", stock: 25}]);
  const {products, errors} = parseProductFile("products.json", json);
  assert.deepEqual(errors, []);
  assert.equal(products[0].productId, "DXTR1000");
});

test("reads the earlier JSON format with category and image", () => {
  const json = JSON.stringify({products: [{id: "ERP-001", name: "Test", description: "d", price: 89.99, category: "Headphones", stock: 12, image: "/products/x.svg"}]});
  const {products, errors} = parseProductFile("test-products.json", json);
  assert.deepEqual(errors, []);
  assert.equal(products[0].category, "Headphones");
  assert.equal(products[0].image, "/products/x.svg");
});

test("rejects empty files, header-only files, unknown categories and other file types", () => {
  assert.deepEqual(parseProductFile("x.csv", "").errors, ["The file is empty."]);
  assert.deepEqual(parseProductFile("x.csv", "productID,name,description,price,stock\n").errors, ["The file contains no products."]);
  assert.match(parseProductFile("x.json", '{"products":[{"id":"A","name":"B","price":1,"category":"Bikes"}]}').errors[0], /category "Bikes" is unknown/);
  assert.match(parseProductFile("x.xlsx", "PK...").errors[0], /not supported/);
  assert.match(parseProductFile("x.json", "{oops").errors[0], /not valid JSON/);
});
