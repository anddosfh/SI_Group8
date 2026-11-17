import { test } from "node:test";
import assert from "node:assert/strict";
import { buildAnalytics } from "../src/services/adminAnalyticsService.js";

const erpProducts = [{uuid: "u1", productId: "NOVA-PHONE-ONE", name: "NOVA Phone One", stock: 0}, {uuid: "u2", productId: "NOVA-BUDS-SPORT", name: "NOVA Buds Sport", stock: 3},
  {uuid: "u3", productId: "DXTR1000", name: "MTB", stock: 25}];
const shopProducts = [{id: 1, erp_product_id: "NOVA-PHONE-ONE", name: "NOVA Phone One", category: "Phones", active: true},
  {id: 2, erp_product_id: "NOVA-BUDS-SPORT", name: "NOVA Buds Sport", category: "Buds", active: true},
  {id: 3, erp_product_id: null, name: "Old", category: "Other", active: false}];
const erpCustomers = [{id: "c1", name: "Ada", email: "ada@x.de"}, {id: "c2", name: "Bob", email: "bob@x.de"}];
const order = (orderId, customerId, status, items, orderDate = "2026-11-10") =>
  ({orderId, customerId, status, orderDate, orderAmount: items.reduce((s, i) => s + i.itemAmount, 0), currency: "EUR", items});
const erpOrders = [
  order(1, "c1", "completed", [{productUuid: "u1", quantity: 1, itemAmount: 20}]),
  order(2, "c1", "completed", [{productUuid: "u2", quantity: 2, itemAmount: 30}], "2026-09-03"),
  order(3, "c2", "new", [{productUuid: "u3", quantity: 1, itemAmount: 1200}]),
  order(4, "c2", "canceled", [{productUuid: "u1", quantity: 1, itemAmount: 549}])
];

test("analytics are computed from ERP orders", () => {
  const a = buildAnalytics({erpOrders, erpProducts, erpCustomers, shopProducts, shopCustomerCount: 5, today: new Date(2026, 10, 17)});
  assert.deepEqual(a.overview, {totalOrders: 4, pendingOrders: 1, shippedOrders: 0, completedOrders: 2, cancelledOrders: 1, revenue: 50, averageOrderValue: 25});
  assert.deepEqual(a.statuses, [{status: "canceled", count: 1}, {status: "completed", count: 2}, {status: "new", count: 1}]);
  assert.deepEqual(a.monthly.map(m => m.month), ["Jun 26", "Jul 26", "Aug 26", "Sep 26", "Oct 26", "Nov 26"]);
  assert.deepEqual(a.monthly.at(-1), {month: "Nov 26", revenue: 20, orders: 3});
  assert.deepEqual(a.monthly[3], {month: "Sep 26", revenue: 30, orders: 1});
  assert.deepEqual(a.categories, [{category: "Buds", unitsSold: 2, revenue: 30}, {category: "Phones", unitsSold: 1, revenue: 20}, {category: "Other", unitsSold: 0, revenue: 0}]);
  assert.deepEqual(a.topProducts.map(p => [p.id, p.name, p.units_sold, p.revenue]), [[2, "NOVA Buds Sport", 2, 30], [1, "NOVA Phone One", 1, 20]]);
  assert.deepEqual(a.recentOrders.map(o => [o.id, o.customerName, o.status, o.total]).slice(0, 2), [[4, "Bob", "canceled", 549], [3, "Bob", "new", 1200]]);
  assert.deepEqual(a.inventory, {active_products: 2, inactive_products: 1, out_of_stock: 1, low_stock: 1});
  assert.deepEqual(a.customers, {total_customers: 5, repeat_customers: 2});
});
