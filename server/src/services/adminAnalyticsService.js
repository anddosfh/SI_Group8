import { query } from "../database/db.js";
import { getErpCustomers, getErpOrders, getErpProducts } from "./erpClient.js";

// Lab 3: orders and stock live in the ERP, so the dashboard figures are computed from ERP data.
// The response shape is the one the dashboard has used since Lab 1. Revenue counts completed orders only.
const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const round2 = value => Math.round(value * 100) / 100;

export function buildAnalytics({erpOrders, erpProducts, erpCustomers, shopProducts, shopCustomerCount, today = new Date()}) {
  const count = status => erpOrders.filter(o => o.status === status).length;
  const completed = erpOrders.filter(o => o.status === "completed");
  const revenue = round2(completed.reduce((sum, o) => sum + o.orderAmount, 0));

  // Six-month trend by order date (YYYY-MM-DD), oldest month first.
  const monthly = [];
  for (let back = 5; back >= 0; back--) {
    const start = new Date(today.getFullYear(), today.getMonth() - back, 1);
    const key = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`;
    const inMonth = erpOrders.filter(o => String(o.orderDate).startsWith(key));
    monthly.push({month: `${months[start.getMonth()]} ${String(start.getFullYear()).slice(2)}`,
      revenue: round2(inMonth.filter(o => o.status === "completed").reduce((sum, o) => sum + o.orderAmount, 0)), orders: inMonth.length});
  }

  // ERP product (UUID) -> shop product, to get the shop's id, name and category.
  const shopByErpId = new Map(shopProducts.filter(p => p.erp_product_id).map(p => [p.erp_product_id, p]));
  const productByUuid = new Map(erpProducts.map(p => [p.uuid, {erp: p, shop: shopByErpId.get(p.productId)}]));
  const categories = new Map([...new Set(shopProducts.map(p => p.category))].map(c => [c, {category: c, unitsSold: 0, revenue: 0}]));
  const sold = new Map();
  for (const order of completed) {
    for (const item of order.items) {
      const product = productByUuid.get(item.productUuid);
      const category = product?.shop?.category || "Other";
      if (!categories.has(category)) categories.set(category, {category, unitsSold: 0, revenue: 0});
      const c = categories.get(category);
      c.unitsSold += item.quantity; c.revenue = round2(c.revenue + item.itemAmount);
      const key = product?.shop?.id ?? product?.erp.productId ?? item.productUuid;
      const s = sold.get(key) || {id: key, name: product?.shop?.name || product?.erp.name || "Unknown product", units_sold: 0, revenue: 0};
      s.units_sold += item.quantity; s.revenue = round2(s.revenue + item.itemAmount);
      sold.set(key, s);
    }
  }

  const customerById = new Map(erpCustomers.map(c => [c.id, c]));
  const ordersPerCustomer = new Map();
  for (const o of erpOrders) ordersPerCustomer.set(o.customerId, (ordersPerCustomer.get(o.customerId) || 0) + 1);
  const stockOf = new Map(erpProducts.map(p => [p.productId, p.stock]));
  const activeErpStock = shopProducts.filter(p => p.active && p.erp_product_id && stockOf.has(p.erp_product_id)).map(p => stockOf.get(p.erp_product_id));

  return {
    overview: {
      totalOrders: erpOrders.length,
      pendingOrders: count("new") + count("picked"),
      shippedOrders: count("shipped"),
      completedOrders: completed.length,
      cancelledOrders: count("canceled"),
      revenue,
      averageOrderValue: completed.length ? round2(revenue / completed.length) : 0
    },
    monthly,
    statuses: [...new Set(erpOrders.map(o => o.status))].sort().map(status => ({status, count: count(status)})),
    categories: [...categories.values()].sort((a, b) => b.revenue - a.revenue),
    topProducts: [...sold.values()].sort((a, b) => b.revenue - a.revenue || b.units_sold - a.units_sold).slice(0, 5),
    recentOrders: [...erpOrders].sort((a, b) => b.orderId - a.orderId).slice(0, 8).map(o => ({
      id: o.orderId, customerName: customerById.get(o.customerId)?.name || "", createdAt: o.orderDate, status: o.status, total: o.orderAmount})),
    inventory: {
      active_products: shopProducts.filter(p => p.active).length,
      inactive_products: shopProducts.filter(p => !p.active).length,
      out_of_stock: activeErpStock.filter(stock => stock <= 0).length,
      low_stock: activeErpStock.filter(stock => stock >= 1 && stock <= 5).length
    },
    customers: {
      total_customers: shopCustomerCount,
      repeat_customers: [...ordersPerCustomer.values()].filter(n => n > 1).length
    }
  };
}

// The ERP being down surfaces as ErpUnavailableError, which the API answers with 503.
export async function getAdminAnalytics() {
  const [erpOrders, erpProducts, erpCustomers, {rows: shopProducts}, {rows: [{count}]}] = await Promise.all([
    getErpOrders(), getErpProducts(), getErpCustomers(),
    query("SELECT id, erp_product_id, name, category, active FROM products"),
    query("SELECT count(*)::int AS count FROM users WHERE role = 'customer'")
  ]);
  return buildAnalytics({erpOrders, erpProducts, erpCustomers, shopProducts, shopCustomerCount: count});
}
