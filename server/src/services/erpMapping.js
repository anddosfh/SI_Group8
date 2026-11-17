// Lab 3: pure helpers that translate between the Mini-ERP's data and the shapes the shop's API has always returned.

// "not_sold": the shop product has no ERP counterpart; "unknown": the ERP could not be asked.
export function availabilityOf(stock, sold) {
  if (!sold) return "not_sold";
  if (stock === null || stock === undefined) return "unknown";
  return stock > 0 ? "in_stock" : "out_of_stock";
}

// Order statuses as the ERP stores them (lower-case) and the ERP action that moves an order into each of them.
export const STATUS_ACTIONS = {picked: "pickOrder", shipped: "shipOrder", completed: "completeOrder", canceled: "cancelOrder"};
const transitions = {new: ["picked", "canceled"], picked: ["shipped"], shipped: ["completed"]};
export function nextStatuses(status) { return transitions[status] || []; }

export function toShopOrder(order, {productsByUuid, customersById}) {
  const customer = customersById.get(order.customerId);
  return {
    id: order.orderId, createdAt: order.orderDate, total: order.orderAmount, status: order.status,
    customerName: customer?.name || "", customerEmail: customer?.email || "", address: customer?.street || "",
    nextStatuses: nextStatuses(order.status),
    items: order.items.map(i => {
      const product = productsByUuid.get(i.productUuid);
      return {productId: product?.productId ?? null, name: product?.name || "Unknown product",
        unitPrice: i.quantity ? Math.round(i.itemAmount / i.quantity * 100) / 100 : 0, quantity: i.quantity};
    })
  };
}

// productID for a product created in the shop's admin dashboard (ERP limit: 50 characters).
export function erpProductIdFor(name, taken) {
  const base = `NOVA-${String(name).toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-+|-+$/g, "")}`.slice(0, 50).replace(/-+$/, "");
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base.slice(0, 50 - String(n).length - 1)}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}

// The ERP names products by productID ("... for product #NOVA-BUDS-SPORT"); customers know them by name.
export function readableErpMessage(message, namesByProductId) {
  return String(message).replace(/#([A-Za-z0-9_-]+)/g, (match, id) => namesByProductId.get(id) ?? match);
}
