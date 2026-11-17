import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { configureErp } from "../src/services/erpClient.js";
import { checkout, erpOrdersForEmail, orderIdsForEmail, updateOrderStatus } from "../src/services/orderService.js";
import { ErpUnavailableError, UserError } from "../src/utils/errors.js";

// A small in-memory Mini-ERP that answers the calls the shop makes (REST API + the OData calls it needs).
let server, erp, hits, down, port, stockDropsBeforeCreate;
const fresh = () => ({
  products: [{ID: "u-phone", productID: "NOVA-PHONE-ONE", name: "NOVA Phone One", description: null, price: "549.00", currency: "EUR", stock: 40},
    {ID: "u-sport", productID: "NOVA-BUDS-SPORT", name: "NOVA Buds Sport", description: null, price: "79.00", currency: "EUR", stock: 3}],
  customers: [], orders: [], nextOrderId: 1
});
const json = (res, status, data) => { res.writeHead(status, {"Content-Type": "application/json"}); res.end(JSON.stringify(data)); };
before(async () => {
  server = http.createServer(async (req, res) => {
    let raw = ""; for await (const chunk of req) raw += chunk;
    const body = raw ? JSON.parse(raw) : null, url = decodeURIComponent(req.url);
    hits.push({method: req.method, url, body});
    if (down) return json(res, 503, {});
    if (req.method === "GET" && url === "/rest/api/products") return json(res, 200, erp.products);
    if (req.method === "GET" && url === "/rest/api/customers") return json(res, 200, erp.customers);
    if (req.method === "GET" && url === "/rest/api/orders") return json(res, 200, erp.orders);
    if (req.method === "POST" && url === "/odata/v4/simple-erp/Customers") {
      const customer = {customerID: `c${erp.customers.length + 1}`, ...body}; erp.customers.push(customer);
      return json(res, 201, {ID: customer.customerID, ...body});
    }
    let m = /^\/odata\/v4\/simple-erp\/Customers\((.+)\)$/.exec(url);
    if (req.method === "PATCH" && m) { Object.assign(erp.customers.find(c => c.customerID === m[1]), body); return json(res, 200, {}); }
    if (req.method === "POST" && url === "/rest/api/createOrder") {
      if (stockDropsBeforeCreate) erp.products.forEach(p => { p.stock = 1; });
      for (const i of body.order.items) {
        const p = erp.products.find(x => x.ID === i.product);
        if (p.stock < i.quantity) return json(res, 409, {error: {message: `${i.quantity} exceeds stock for product #${p.productID}`, code: "409"}});
      }
      for (const i of body.order.items) erp.products.find(x => x.ID === i.product).stock -= i.quantity;
      erp.orders.push({orderID: erp.nextOrderId++, customer: body.order.customer, orderDate: body.order.orderDate, orderAmount: body.order.orderAmount.toFixed(2),
        currency: "EUR", orderStatus: "NEW", items: body.order.items.map((i, n) => ({itemID: 10 * (n + 1), product: i.product, quantity: i.quantity, itemAmount: i.itemAmount.toFixed(2), currency: "EUR"}))});
      res.writeHead(204); return res.end();
    }
    m = /^\/odata\/v4\/simple-erp\/Orders\?\$filter=orderID eq (\d+)&\$select=ID$/.exec(url);
    if (req.method === "GET" && m) { const o = erp.orders.find(x => x.orderID === Number(m[1])); return json(res, 200, {value: o ? [{ID: `uuid-${o.orderID}`}] : []}); }
    m = /^\/odata\/v4\/simple-erp\/Orders\(uuid-(\d+)\)\/SimpleERPService\.(\w+)$/.exec(url);
    if (req.method === "POST" && m) {
      erp.orders.find(x => x.orderID === Number(m[1])).orderStatus = {pickOrder: "PICKED", shipOrder: "SHIPPED", completeOrder: "COMPLETED", cancelOrder: "CANCELED"}[m[2]];
      return json(res, 200, {});
    }
    json(res, 404, {error: {message: `stub has no ${req.method} ${url}`}});
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  port = server.address().port;
  configureErp({url: `http://127.0.0.1:${port}`, backoffMs: 1, confirmDelayMs: 1, timeoutMs: 500, orderTimeoutMs: 500});
});
after(() => { server.closeAllConnections(); server.close(); });
beforeEach(() => { erp = fresh(); hits = []; down = false; stockDropsBeforeCreate = false; });

const user = {id: 1, name: "Ada Lovelace", email: "Ada@Example.org"};
const shopProducts = [
  {id: 1, erp_product_id: "NOVA-PHONE-ONE", name: "NOVA Phone One", price: 499, active: true},
  {id: 2, erp_product_id: "NOVA-BUDS-SPORT", name: "NOVA Buds Sport", price: 79, active: true},
  {id: 3, erp_product_id: null, name: "Shop only", price: 10, active: true}
];
const posts = url => hits.filter(h => h.method === "POST" && h.url === url);

test("places the order in the ERP with ERP ids and prices and creates the customer", async () => {
  const order = await checkout({user, address: "Main St 1, Aachen", shopProducts,
    items: [{productId: 1, quantity: 1, unitPrice: 549}, {productId: 1, quantity: 1}]});
  assert.equal(order.id, 1);
  assert.equal(order.total, 1098);
  assert.deepEqual(order.items, [{productId: "NOVA-PHONE-ONE", name: "NOVA Phone One", unitPrice: 549, quantity: 2}]);
  assert.equal(erp.products[0].stock, 38);
  assert.deepEqual(erp.customers.map(c => [c.name, c.email, c.street]), [["Ada Lovelace", "Ada@Example.org", "Main St 1, Aachen"]]);
  const sent = posts("/rest/api/createOrder")[0].body.order;
  assert.deepEqual(sent.items, [{product: "u-phone", quantity: 2, itemAmount: 1098, currency: "EUR"}]);
  assert.equal(sent.customer, "c1");
  assert.match(sent.orderDate, /^\d{4}-\d{2}-\d{2}$/);
});

test("refuses when the ERP price differs from the price in the bag", async () => {
  await assert.rejects(checkout({user, address: "x", shopProducts, items: [{productId: 1, quantity: 1, unitPrice: 499}]}),
    e => e instanceof UserError && e.status === 409 && e.message === "The price of NOVA Phone One changed to €549.00. Please review your bag.");
  assert.equal(posts("/rest/api/createOrder").length, 0);
});

test("refuses too little stock with the product name, without sending the order", async () => {
  await assert.rejects(checkout({user, address: "x", shopProducts, items: [{productId: 2, quantity: 4}]}),
    e => e instanceof UserError && e.status === 409 && /NOVA Buds Sport/.test(e.message) && /3/.test(e.message));
  assert.equal(posts("/rest/api/createOrder").length, 0);
});

test("passes the ERP's own 409 on in readable form", async () => {
  stockDropsBeforeCreate = true; // someone else buys the last items between the shop's check and createOrder
  await assert.rejects(checkout({user, address: "x", shopProducts, items: [{productId: 2, quantity: 2}]}),
    e => e instanceof UserError && e.status === 409 && e.message === "2 exceeds stock for product NOVA Buds Sport");
});

test("products without an ERP counterpart cannot be ordered", async () => {
  await assert.rejects(checkout({user, address: "x", shopProducts, items: [{productId: 3, quantity: 1}]}), UserError);
});

test("updates the address of an existing ERP customer", async () => {
  erp.customers.push({customerID: "c9", name: "Ada Lovelace", email: "ada@example.org", street: "Old Road 2"});
  await checkout({user, address: "New Road 5", shopProducts, items: [{productId: 1, quantity: 1}]});
  assert.equal(erp.customers.length, 1);
  assert.equal(erp.customers[0].street, "New Road 5");
  assert.equal(posts("/rest/api/createOrder")[0].body.order.customer, "c9");
});

test("a second checkout of the same user while one runs is refused", async () => {
  const first = checkout({user, address: "x", shopProducts, items: [{productId: 1, quantity: 1}]});
  await assert.rejects(checkout({user, address: "x", shopProducts, items: [{productId: 1, quantity: 1}]}),
    e => e instanceof UserError && e.status === 409 && /still being processed/.test(e.message));
  await first;
  assert.equal(posts("/rest/api/createOrder").length, 1);
});

test("ERP down: checkout reports the ERP as unavailable", async () => {
  down = true;
  await assert.rejects(checkout({user, address: "x", shopProducts, items: [{productId: 1, quantity: 1}]}), ErpUnavailableError);
});

test("history and purchase history come from the ERP orders of the customer's email", async () => {
  await checkout({user, address: "x", shopProducts, items: [{productId: 1, quantity: 1}]});
  await checkout({user, address: "x", shopProducts, items: [{productId: 2, quantity: 1}]});
  erp.orders.push({orderID: 99, customer: "someone-else", orderDate: "2026-11-01", orderAmount: "1.00", currency: "EUR", orderStatus: "NEW", items: []});
  assert.deepEqual((await erpOrdersForEmail("ada@example.org")).map(o => o.id), [2, 1]);
  assert.deepEqual(await orderIdsForEmail("ADA@example.org"), [1, 2]);
  assert.deepEqual(await erpOrdersForEmail("nobody@example.org"), []);
  down = true;
  assert.deepEqual(await orderIdsForEmail("ada@example.org"), []);
});

test("status changes run the ERP action only for allowed transitions", async () => {
  await checkout({user, address: "x", shopProducts, items: [{productId: 1, quantity: 1}]});
  await assert.rejects(updateOrderStatus(1, "shipped"), e => e instanceof UserError && e.status === 409);
  assert.equal(hits.filter(h => /SimpleERPService/.test(h.url)).length, 0);
  const order = await updateOrderStatus(1, "picked");
  assert.equal(order.status, "picked");
  assert.deepEqual(order.nextStatuses, ["shipped"]);
  assert.equal(posts("/odata/v4/simple-erp/Orders(uuid-1)/SimpleERPService.pickOrder").length, 1);
  await assert.rejects(updateOrderStatus(42, "picked"), e => e instanceof UserError && e.status === 404);
});
