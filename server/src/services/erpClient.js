import { ERP_PASSWORD, ERP_RETRIES, ERP_TIMEOUT_MS, ERP_URL, ERP_USER } from "../config/env.js";
import { ErpUnavailableError, UserError } from "../utils/errors.js";

// Lab 3: every live call from the shop to the Mini-ERP goes through this module (Remote Procedure Invocation).
// Main path is the REST API the ERP offers for integration (/rest/api); OData (/odata/v4/simple-erp) is used only
// where that API has nothing: creating and updating customers, creating products, order status actions.
//
// Failure rules:
//   - ERP 4xx (except 401/403)    -> UserError with the ERP's own message and status (e.g. 409 too little stock); never retried.
//   - network error, timeout, 5xx  -> ErpUnavailableError (HTTP 503 to the browser); reads are retried with backoff.
//   - 401/403                      -> ErpUnavailableError (wrong ERP_USER/ERP_PASSWORD); not retried.
//   - createOrder is not idempotent (the ERP takes no order id from us), so it is re-sent only when the connection was
//     refused, i.e. the request certainly never reached the ERP. After a timeout or 5xx the shop looks for the order
//     instead of sending it again.

const settings = {url: ERP_URL, user: ERP_USER, password: ERP_PASSWORD, timeoutMs: ERP_TIMEOUT_MS, retries: ERP_RETRIES,
  backoffMs: 200, orderTimeoutMs: 10000, confirmDelayMs: 1000};
export function configureErp(overrides) { Object.assign(settings, overrides); }

const REST = "/rest/api", ODATA = "/odata/v4/simple-erp";
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const cents = value => Math.round(Number(value) * 100);
export const sameEmail = (a, b) => String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();

// True only when the ERP refused the TCP connection, so the request was never sent.
export function isConnectionRefused(error) { return error?.cause?.code === "ECONNREFUSED"; }

function unavailable(detail, extra = {}) {
  return Object.assign(new ErpUnavailableError(`The ERP is not reachable right now (${detail}). Please try again in a moment.`), extra);
}

// One HTTP request without retries. Returns the parsed JSON body, or null for an empty body (204).
async function call(method, path, {body, timeoutMs = settings.timeoutMs} = {}) {
  const url = new URL(path, settings.url);
  let response, text;
  try {
    response = await fetch(url, {
      method,
      headers: {
        Authorization: `Basic ${Buffer.from(`${settings.user}:${settings.password}`).toString("base64")}`,
        Accept: "application/json",
        ...(body === undefined ? {} : {"Content-Type": "application/json"})
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs)
    });
    text = await response.text();
  } catch (error) {
    const timedOut = error.name === "TimeoutError" || error.name === "AbortError";
    throw unavailable(timedOut ? `no answer within ${timeoutMs / 1000} s` : error.cause?.code || error.message,
      {cause: error, refused: isConnectionRefused(error)});
  }
  if (response.status === 401 || response.status === 403) {
    throw Object.assign(new ErpUnavailableError(`The ERP rejected the shop's login (HTTP ${response.status}). Check ERP_USER and ERP_PASSWORD.`), {noRetry: true});
  }
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  if (response.status >= 500) throw unavailable(`HTTP ${response.status}`);
  if (!response.ok) throw new UserError(data?.error?.message || `The ERP rejected the request (HTTP ${response.status}).`, response.status);
  return data;
}

// Repeats fn while retryIf(error) holds, at most settings.retries attempts, waiting backoffMs, 2 × backoffMs, ...
async function withRetry(fn, retryIf = error => error instanceof ErpUnavailableError && !error.noRetry) {
  for (let attempt = 1; ; attempt++) {
    try { return await fn(); }
    catch (error) {
      if (attempt >= settings.retries || !retryIf(error)) throw error;
      await wait(settings.backoffMs * 2 ** (attempt - 1));
    }
  }
}
const read = path => withRetry(() => call("GET", path));
const list = data => Array.isArray(data) ? data : Array.isArray(data?.value) ? data.value : [];

export async function getErpProducts() {
  return list(await read(`${REST}/products`)).map(p => ({uuid: p.ID, productId: p.productID, name: p.name,
    description: p.description ?? null, price: Number(p.price), currency: p.currency, stock: Number(p.stock ?? 0)}));
}

export async function getErpCustomers() {
  return list(await read(`${REST}/customers`)).map(c => ({id: c.customerID, name: c.name, email: c.email, street: c.street ?? null,
    houseNumber: c.houseNumber ?? null, city: c.city ?? null, postalCode: c.postalCode ?? null, country: c.country ?? null}));
}

export async function getErpOrders() {
  return list(await read(`${REST}/orders`)).map(o => ({orderId: Number(o.orderID), customerId: o.customer, orderDate: o.orderDate,
    orderAmount: Number(o.orderAmount), currency: o.currency, status: String(o.orderStatus || "").toLowerCase(),
    items: (o.items || []).map(i => ({productUuid: i.product, quantity: Number(i.quantity), itemAmount: Number(i.itemAmount)}))}));
}

// OData: the REST API cannot create customers. Before a retry the shop checks whether the first attempt got through.
export async function createErpCustomer({name, email, street}) {
  let firstAttempt = true;
  return withRetry(async () => {
    if (!firstAttempt) {
      const found = (await getErpCustomers()).find(c => sameEmail(c.email, email));
      if (found) return found.id;
    }
    firstAttempt = false;
    return (await call("POST", `${ODATA}/Customers`, {body: {name, email, street: street || null}})).ID;
  });
}

// OData PATCH sets a value, so repeating it is harmless.
export async function updateErpCustomerStreet(id, street) {
  await withRetry(() => call("PATCH", `${ODATA}/Customers(${id})`, {body: {street}}));
}

// OData: a product added in the shop's admin dashboard must exist in the ERP, which owns its stock.
export async function createErpProduct({productId, name, description, price, stock}) {
  await withRetry(() => call("POST", `${ODATA}/Products`, {body: {productID: productId, name, description, price, currency_code: "EUR", stock}}),
    error => error.refused === true);
}

// Sends createOrder and returns the ERP's orderID. The REST action answers 204 without a body, so the id is read
// from orders() afterwards: the newest order of this customer that was not there before.
export async function placeErpOrder({customerId, orderDate, orderAmount, currency, items}) {
  const newestBefore = Math.max(0, ...(await getErpOrders()).filter(o => o.customerId === customerId).map(o => o.orderId));
  const findPlaced = async matches => (await getErpOrders())
    .filter(o => o.customerId === customerId && o.orderId > newestBefore && matches(o))
    .sort((a, b) => b.orderId - a.orderId)[0];
  const body = {order: {customer: customerId, orderDate, orderAmount, currency,
    items: items.map(i => ({product: i.productUuid, quantity: i.quantity, itemAmount: i.itemAmount, currency}))}};
  try {
    await withRetry(() => call("POST", `${REST}/createOrder`, {body, timeoutMs: settings.orderTimeoutMs}), error => error.refused === true);
  } catch (error) {
    // Not sent at all (refused, login rejected) or rejected by the ERP (409, 422): nothing was ordered.
    if (!(error instanceof ErpUnavailableError) || error.refused || error.noRetry) throw error;
    // Timeout or 5xx: the ERP may still have stored the order. Look, but never send it again.
    await wait(settings.confirmDelayMs);
    const placed = await findPlaced(o => cents(o.orderAmount) === cents(orderAmount)).catch(() => null);
    if (placed) return placed.orderId;
    throw new ErpUnavailableError("Your order could not be confirmed. Please check your order history before ordering again.");
  }
  const placed = await findPlaced(() => true);
  if (!placed) throw new ErpUnavailableError("The ERP accepted the order but does not list it yet. Please check your order history.");
  return placed.orderId;
}

// OData bound actions of the ERP: pickOrder, shipOrder, completeOrder, cancelOrder. orders() only returns the
// readable orderID, so the order's key (UUID) is looked up first. Repeating a status action changes nothing more.
export async function runErpOrderAction(orderId, action) {
  const found = await read(`${ODATA}/Orders?$filter=orderID eq ${Number(orderId)}&$select=ID`);
  const id = list(found)[0]?.ID;
  if (!id) throw new UserError("Order not found.", 404);
  await withRetry(() => call("POST", `${ODATA}/Orders(${id})/SimpleERPService.${action}`, {body: {}}));
}
