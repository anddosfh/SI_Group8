
import { useEffect, useState } from "react";
import { api } from "../services/api";
import Modal from "../components/Modal";

const blank = {
  name: "",
  description: "",
  price: "",
  category: "Phones",
  image: ""
};

const money = (value) =>
  `€${Number(value || 0).toLocaleString("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;

export default function AdminModal({ onClose, onChanged }) {
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [form, setForm] = useState(blank);
  const [message, setMessage] = useState("");
  const [importing, setImporting] = useState(false);
  const [importReport, setImportReport] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [analyticsError, setAnalyticsError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    const [p, o] = await Promise.all([
      api("/products"),
      api("/orders/admin")
    ]);

    setProducts(p.products || []);
    setOrders(o.orders || []);
  }

  async function loadAnalytics() {
    setRefreshing(true);

    try {
      const data = await api("/analytics/admin");
      setAnalytics(data);
      setAnalyticsError("");
    } catch (error) {
      setAnalyticsError(error.message || "Unable to load analytics.");
    } finally {
      setRefreshing(false);
    }
  }

  async function refreshAll() {
    setMessage("");

    try {
      await Promise.all([load(), loadAnalytics()]);
    } catch (error) {
      setMessage(error.message);
    }
  }

  useEffect(() => {
    load().catch((error) => setMessage(error.message));
    loadAnalytics();
  }, []);

  async function add(event) {
    event.preventDefault();
    setMessage("");

    try {
      await api("/products", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          price: Number(form.price)
        })
      });

      setForm(blank);
      await load();
      await loadAnalytics();
      onChanged();
      setMessage("Product added.");
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function remove(id) {
    if (!confirm("Remove this product from the catalogue?")) return;

    setMessage("");

    try {
      await api(`/products/${id}`, {
        method: "DELETE"
      });

      await load();
      await loadAnalytics();
      onChanged();
      setMessage("Product removed.");
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function status(id, newStatus) {
    setMessage("");

    try {
      await api(`/orders/admin/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus })
      });

      await load();
      await loadAnalytics();
      setMessage("Order status updated.");
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function importFile(event) {
    const input = event.currentTarget;
    const file = input.files?.[0];

    if (!file) return;

    setMessage("");
    setImportReport(null);
    setImporting(true);

    try {
      if (!file.name.toLowerCase().endsWith(".json")) {
        throw new Error(
          "This importer currently accepts JSON files only."
        );
      }

      if (file.size > 1024 * 1024) {
        throw new Error("The file must be smaller than 1 MB.");
      }

      let payload;

      try {
        payload = JSON.parse(await file.text());
      } catch {
        throw new Error("The selected file is not valid JSON.");
      }

      const result = await api("/products/import", {
        method: "POST",
        body: JSON.stringify(payload)
      });

      setImportReport(result);
      setMessage(result.message || "Product import completed.");

      await load();
      await loadAnalytics();
      onChanged();
    } catch (error) {
      setMessage(error.message || "Product import failed.");
    } finally {
      setImporting(false);
      input.value = "";
    }
  }

  return (
    <Modal title="NOVA Store Admin Dashboard" onClose={onClose} wide>
      <p className="admin-note">
        Business analytics, catalogue management, orders and ERP integration.
      </p>

      {/* BUSINESS ANALYTICS */}
      <section className="analytics-dashboard">
        <div className="analytics-heading">
          <div>
            <p className="analytics-eyebrow">
              NOVA STORE / BUSINESS INTELLIGENCE
            </p>
            <h2>Business overview</h2>
            <p>Sales, customers, orders and inventory at a glance.</p>
          </div>

          <button
            type="button"
            className="button button-outline button-small"
            onClick={refreshAll}
            disabled={refreshing}
          >
            {refreshing ? "Refreshing..." : "Refresh data"}
          </button>
        </div>

        {analyticsError && (
          <p className="form-error" role="alert">
            Could not load analytics: {analyticsError}
          </p>
        )}

        {!analytics && !analyticsError && (
          <p className="fine-print">Loading analytics...</p>
        )}

        {analytics && (
          <>
            <div className="analytics-cards">
              <article className="analytics-card">
                <span>Completed revenue</span>
                <strong>{money(analytics.overview.revenue)}</strong>
                <small>Completed orders only</small>
              </article>

              <article className="analytics-card">
                <span>Total orders</span>
                <strong>{analytics.overview.totalOrders}</strong>
                <small>All order statuses</small>
              </article>

              <article className="analytics-card">
                <span>Average order value</span>
                <strong>
                  {money(analytics.overview.averageOrderValue)}
                </strong>
                <small>Completed orders only</small>
              </article>

              <article className="analytics-card">
                <span>Customers</span>
                <strong>
                  {analytics.customers.total_customers}
                </strong>
                <small>
                  {analytics.customers.repeat_customers} repeat customers
                </small>
              </article>

              <article className="analytics-card">
                <span>Pending orders</span>
                <strong>{analytics.overview.pendingOrders}</strong>
                <small>Awaiting processing</small>
              </article>

              <article className="analytics-card">
                <span>Active products</span>
                <strong>
                  {analytics.inventory.active_products}
                </strong>
                <small>
                  {analytics.inventory.inactive_products} inactive
                </small>
              </article>
            </div>

            {/* REVENUE CHART */}
            <div className="analytics-panels">
              <section className="analytics-panel">
                <h3>Monthly revenue</h3>
                <p className="fine-print">
                  Completed sales over the last six months
                </p>

                {analytics.monthly.map((item) => {
                  const maxRevenue = Math.max(
                    ...analytics.monthly.map((row) => row.revenue),
                    1
                  );

                  return (
                    <div className="chart-row" key={item.month}>
                      <span>{item.month}</span>

                      <div className="chart-track">
                        <div
                          className="chart-bar"
                          style={{
                            width: `${
                              (item.revenue / maxRevenue) * 100
                            }%`
                          }}
                        />
                      </div>

                      <strong>{money(item.revenue)}</strong>
                    </div>
                  );
                })}
              </section>

              {/* ORDER STATUS */}
              <section className="analytics-panel">
                <h3>Order status</h3>
                <p className="fine-print">
                  Current order distribution
                </p>

                {analytics.statuses.length === 0 && (
                  <p className="fine-print">No orders yet.</p>
                )}

                {analytics.statuses.map((item) => (
                  <div className="status-row" key={item.status}>
                    <span
                      className={`status-dot status-${item.status}`}
                    />

                    <span className="status-name">
                      {item.status}
                    </span>

                    <div className="status-track">
                      <div
                        className="status-fill"
                        style={{
                          width: `${
                            analytics.overview.totalOrders
                              ? (item.count /
                                  analytics.overview.totalOrders) *
                                100
                              : 0
                          }%`
                        }}
                      />
                    </div>

                    <strong>{item.count}</strong>
                  </div>
                ))}
              </section>

              {/* CATEGORY PERFORMANCE */}
              <section className="analytics-panel">
                <h3>Category performance</h3>
                <p className="fine-print">
                  Revenue and units sold by category
                </p>

                {analytics.categories.length === 0 && (
                  <p className="fine-print">
                    No category data available.
                  </p>
                )}

                {analytics.categories.map((item) => (
                  <div className="category-row" key={item.category}>
                    <div>
                      <strong>{item.category}</strong>
                      <small>{item.unitsSold} units sold</small>
                    </div>

                    <strong>{money(item.revenue)}</strong>
                  </div>
                ))}
              </section>

              {/* TOP PRODUCTS */}
              <section className="analytics-panel">
                <h3>Top-selling products</h3>
                <p className="fine-print">
                  Based on completed orders
                </p>

                {analytics.topProducts.length === 0 && (
                  <p className="fine-print">
                    No completed sales yet.
                  </p>
                )}

                {analytics.topProducts.map((item, index) => (
                  <div className="category-row" key={item.id}>
                    <div>
                      <strong>
                        {index + 1}. {item.name}
                      </strong>
                      <small>{item.units_sold} units sold</small>
                    </div>

                    <strong>{money(item.revenue)}</strong>
                  </div>
                ))}
              </section>

              {/* INVENTORY */}
              <section className="analytics-panel">
                <h3>Inventory alerts</h3>
                <p className="fine-print">
                  Current stock levels
                </p>

                <div className="inventory-alert">
                  <span>Out of stock</span>
                  <strong>
                    {analytics.inventory.out_of_stock}
                  </strong>
                </div>

                <div className="inventory-alert">
                  <span>Low stock (1–5)</span>
                  <strong>
                    {analytics.inventory.low_stock}
                  </strong>
                </div>
              </section>

              {/* RECENT ORDERS */}
              <section className="analytics-panel">
                <h3>Recent orders</h3>
                <p className="fine-print">
                  Latest eight orders
                </p>

                {analytics.recentOrders.length === 0 && (
                  <p className="fine-print">No orders yet.</p>
                )}

                {analytics.recentOrders.map((order) => (
                  <div className="recent-order" key={order.id}>
                    <div>
                      <strong>
                        #{order.id} · {order.customerName}
                      </strong>

                      <small>
                        {order.createdAt
                          ? new Date(
                              order.createdAt
                            ).toLocaleDateString("de-DE")
                          : "Date unavailable"}
                        {" · "}
                        {order.status}
                      </small>
                    </div>

                    <strong>{money(order.total)}</strong>
                  </div>
                ))}
              </section>
            </div>
          </>
        )}
      </section>

      {/* LAB 2: ERP PRODUCT IMPORT */}
      <h3 className="section-mini-title">ERP product import</h3>

      <div className="admin-form">
        <p className="fine-print">
          Select a JSON product export from the Mini ERP.
          Existing ERP products will be updated and new products added.
        </p>

        <label htmlFor="erp-product-file">
          Select ERP export file
        </label>

        <input
          id="erp-product-file"
          type="file"
          accept=".json,application/json"
          onChange={importFile}
          disabled={importing}
        />

        {importing && <p>Importing products...</p>}

        {importReport && (
          <div className="form-success">
            <p>Products received: {importReport.received}</p>
            <p>New products: {importReport.inserted}</p>
            <p>Updated products: {importReport.updated}</p>
          </div>
        )}
      </div>

      {/* LAB 1: ADD PRODUCT */}
      <h3 className="section-mini-title">Add a product</h3>

      <form className="admin-form" onSubmit={add}>
        <input
          aria-label="Product name"
          placeholder="Product name"
          value={form.name}
          onChange={(e) =>
            setForm({ ...form, name: e.target.value })
          }
          required
        />

        <input
          aria-label="Description"
          placeholder="Short description"
          value={form.description}
          onChange={(e) =>
            setForm({ ...form, description: e.target.value })
          }
          required
        />

        <input
          aria-label="Price"
          placeholder="Price (€)"
          type="number"
          min="0.01"
          step="0.01"
          value={form.price}
          onChange={(e) =>
            setForm({ ...form, price: e.target.value })
          }
          required
        />

        <select
          aria-label="Category"
          value={form.category}
          onChange={(e) =>
            setForm({ ...form, category: e.target.value })
          }
        >
          {["Phones", "Headphones", "Buds", "Watches"].map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>

        <input
          aria-label="Image URL"
          placeholder="Image URL (optional)"
          value={form.image}
          onChange={(e) =>
            setForm({ ...form, image: e.target.value })
          }
        />

        <button className="button button-dark" type="submit">
          Add product
        </button>
      </form>

      {message && (
        <p
          className={
            /added|removed|successfully|completed|updated/i.test(message)
              ? "form-success"
              : "form-error"
          }
          role="status"
        >
          {message}
        </p>
      )}

      {/* LAB 1: PRODUCT CATALOGUE */}
      <h3 className="section-mini-title">
        Catalogue ({products.length})
      </h3>

      <div className="admin-table">
        {products.map((product) => (
          <div className="admin-row" key={product.id}>
            <span>
              {product.name}
              <small>
                {product.category} · {money(product.price)}
                {product.erp_product_id
                  ? ` · Stock: ${product.stock}`
                  : ""}
              </small>
            </span>

            <button
              className="button button-outline button-small"
              onClick={() => remove(product.id)}
              type="button"
            >
              Remove
            </button>
          </div>
        ))}
      </div>

      {/* LAB 1: ORDER MANAGEMENT */}
      <h3 className="section-mini-title">
        Orders ({orders.length})
      </h3>

      <div className="admin-table">
        {orders.length === 0 ? (
          <p className="fine-print">No orders placed yet.</p>
        ) : (
          orders.map((order) => (
            <div className="admin-row" key={order.id}>
              <span>
                #{order.id} · {order.customerName}
                <small>
                  {money(order.total)} · {order.customerEmail}
                </small>
              </span>

              <select
                value={order.status}
                onChange={(e) =>
                  status(order.id, e.target.value)
                }
                aria-label={`Status for order ${order.id}`}
              >
                {["pending", "shipped", "completed", "cancelled"].map(
                  (orderStatus) => (
                    <option key={orderStatus} value={orderStatus}>
                      {orderStatus}
                    </option>
                  )
                )}
              </select>
            </div>
          ))
        )}
      </div>
    </Modal>
  );
}
