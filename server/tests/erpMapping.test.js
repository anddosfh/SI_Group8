import { test } from "node:test";
import assert from "node:assert/strict";
import { STATUS_ACTIONS, availabilityOf, erpProductIdFor, nextStatuses, readableErpMessage, toShopOrder } from "../src/services/erpMapping.js";

test("availability from ERP stock", () => {
  assert.equal(availabilityOf(5, true), "in_stock");
  assert.equal(availabilityOf(0, true), "out_of_stock");
  assert.equal(availabilityOf(null, true), "unknown");
  assert.equal(availabilityOf(undefined, true), "unknown");
  assert.equal(availabilityOf(5, false), "not_sold");
});

test("status transitions follow the ERP", () => {
  assert.deepEqual(nextStatuses("new"), ["picked", "canceled"]);
  assert.deepEqual(nextStatuses("picked"), ["shipped"]);
  assert.deepEqual(nextStatuses("shipped"), ["completed"]);
  assert.deepEqual(nextStatuses("completed"), []);
  assert.deepEqual(nextStatuses("canceled"), []);
  assert.equal(STATUS_ACTIONS.shipped, "shipOrder");
});

test("ERP order in the shop's order shape", () => {
  const productsByUuid = new Map([["u1", {productId: "NOVA-PHONE-ONE", name: "NOVA Phone One"}]]);
  const customersById = new Map([["c1", {name: "Ada", email: "ada@x.de", street: "Main St 1"}]]);
  const erpOrder = {orderId: 4, customerId: "c1", orderDate: "2026-11-17", orderAmount: 998, currency: "EUR", status: "new",
    items: [{productUuid: "u1", quantity: 2, itemAmount: 998}, {productUuid: "gone", quantity: 1, itemAmount: 0}]};
  assert.deepEqual(toShopOrder(erpOrder, {productsByUuid, customersById}), {
    id: 4, createdAt: "2026-11-17", total: 998, status: "new", customerName: "Ada", customerEmail: "ada@x.de", address: "Main St 1",
    nextStatuses: ["picked", "canceled"],
    items: [{productId: "NOVA-PHONE-ONE", name: "NOVA Phone One", unitPrice: 499, quantity: 2},
      {productId: null, name: "Unknown product", unitPrice: 0, quantity: 1}]
  });
  assert.equal(toShopOrder({...erpOrder, customerId: "x"}, {productsByUuid, customersById}).customerName, "");
});

test("ERP product id from a product name", () => {
  assert.equal(erpProductIdFor("Nova Pad 11\"", new Set()), "NOVA-NOVA-PAD-11");
  assert.equal(erpProductIdFor("Nova Pad 11\"", new Set(["NOVA-NOVA-PAD-11"])), "NOVA-NOVA-PAD-11-2");
  assert.equal(erpProductIdFor("x".repeat(80), new Set()).length, 50);
});

test("ERP messages name the product instead of its id", () => {
  assert.equal(readableErpMessage("2 exceeds stock for product #NOVA-BUDS-SPORT", new Map([["NOVA-BUDS-SPORT", "NOVA Buds Sport"]])),
    "2 exceeds stock for product NOVA Buds Sport");
  assert.equal(readableErpMessage("Order amount is missing.", new Map()), "Order amount is missing.");
});
