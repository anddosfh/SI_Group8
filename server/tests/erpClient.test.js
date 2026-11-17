import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { configureErp, getErpProducts, isConnectionRefused, placeErpOrder } from "../src/services/erpClient.js";
import { ErpUnavailableError, UserError } from "../src/utils/errors.js";

// A stub Mini-ERP: each test swaps `handler`; `hits` records every request as "METHOD path".
let server, handler, hits;
before(async () => {
  server = http.createServer(async (req, res) => {
    let body = "";
    for await (const chunk of req) body += chunk;
    hits.push(`${req.method} ${req.url.split("?")[0]}`);
    await handler(req, res, body);
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  configureErp({url: `http://127.0.0.1:${server.address().port}`, backoffMs: 1, confirmDelayMs: 1, timeoutMs: 200, orderTimeoutMs: 200});
});
after(() => { server.closeAllConnections(); server.close(); });
beforeEach(() => { hits = []; });

const json = (res, status, data) => { res.writeHead(status, {"Content-Type": "application/json"}); res.end(JSON.stringify(data)); };
const order = {customerId: "c1", orderDate: "2026-11-17", orderAmount: 20, currency: "EUR", items: [{productUuid: "u1", quantity: 2, itemAmount: 20}]};
const erpOrder = (orderID, orderAmount = "20.00") => ({orderID, customer: "c1", orderDate: "2026-11-17", orderAmount, currency: "EUR", orderStatus: "NEW", items: []});

test("retries reads on 503 and succeeds on the third attempt", async () => {
  let calls = 0;
  handler = (req, res) => ++calls < 3 ? json(res, 503, {}) :
    json(res, 200, [{ID: "u1", productID: "P1", name: "A", description: null, price: "10.00", currency: "EUR", stock: 3}]);
  assert.deepEqual(await getErpProducts(), [{uuid: "u1", productId: "P1", name: "A", description: null, price: 10, currency: "EUR", stock: 3}]);
  assert.equal(hits.length, 3);
});

test("gives up with ErpUnavailableError after 3 failed reads", async () => {
  handler = (req, res) => json(res, 500, {});
  await assert.rejects(getErpProducts(), ErpUnavailableError);
  assert.equal(hits.length, 3);
});

test("does not retry a 4xx and passes the ERP message on", async () => {
  handler = (req, res) => req.url.startsWith("/rest/api/orders") ? json(res, 200, []) :
    json(res, 409, {error: {message: "1 exceeds stock for product #P1", code: "409"}});
  await assert.rejects(placeErpOrder(order), e => e instanceof UserError && e.status === 409 && e.message === "1 exceeds stock for product #P1");
  assert.equal(hits.filter(h => h === "POST /rest/api/createOrder").length, 1);
});

test("returns the new order id after 204", async () => {
  let stored = false;
  handler = (req, res) => {
    if (req.method === "POST") { stored = true; res.writeHead(204); return res.end(); }
    json(res, 200, stored ? [erpOrder(3), erpOrder(4)] : [erpOrder(3)]);
  };
  assert.equal(await placeErpOrder(order), 4);
});

test("confirms instead of re-sending when createOrder times out", async () => {
  let stored = false;
  handler = (req, res) => {
    if (req.method === "POST") { stored = true; return; } // stores the order but never answers
    json(res, 200, stored ? [erpOrder(7)] : []);
  };
  assert.equal(await placeErpOrder(order), 7);
  assert.equal(hits.filter(h => h === "POST /rest/api/createOrder").length, 1);
});

test("reports unconfirmed when createOrder times out and no order appears", async () => {
  handler = (req, res) => { if (req.method !== "POST") json(res, 200, []); };
  await assert.rejects(placeErpOrder(order), e => e instanceof ErpUnavailableError && /could not be confirmed/.test(e.message));
  assert.equal(hits.filter(h => h === "POST /rest/api/createOrder").length, 1);
});

test("only a refused connection counts as never sent", () => {
  assert.equal(isConnectionRefused({cause: {code: "ECONNREFUSED"}}), true);
  assert.equal(isConnectionRefused(Object.assign(new Error("t"), {name: "TimeoutError"})), false);
  assert.equal(isConnectionRefused(Object.assign(new Error("a"), {name: "AbortError"})), false);
});
