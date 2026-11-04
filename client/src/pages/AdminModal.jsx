
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

const categories = ["Phones", "Headphones", "Buds", "Watches", "Other"];

const importSources = {
  upload: "Upload",
  inbox: "Inbox folder",
  "erp-export": "ERP export"
};

const importStatusClass = {
  success: "status-completed",
  failed: "status-cancelled",
  skipped: "status-pending"
};

function ImportReport({ report }) {
  const succeeded = report.status === "success";

  return (
    <div className={succeeded ? "import-report" : "import-report import-report-failed"}>
      <p>
        <strong>{report.fileName}</strong> · {report.status}
        {report.fullSync ? " · complete export" : ""}
      </p>

      {succeeded && (
        <p>
          {report.received} received · {report.inserted} new · {report.updated} updated ·{" "}
          {report.unchanged} unchanged · {report.deactivated} deactivated
        </p>
      )}

      {report.errors.length > 0 && (
        <ul>
          {report.errors.map((error, index) => <li key={index}>{error}</li>)}
        </ul>
      )}

      {succeeded && report.changes.length > 0 && (
        <ul>
          {report.changes.slice(0, 12).map((change, index) => <li key={index}>{change}</li>)}
          {report.changes.length > 12 && <li>… and {report.changes.length - 12} more changes</li>}
        </ul>
      )}
    </div>
  );
}

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
  const [imports, setImports] = useState([]);
  const [fullSync, setFullSync] = useState(true);

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

  async function loadImports() {
    const data = await api("/products/imports");
    setImports(data.imports || []);
  }

  async function refreshAll() {
    setMessage("");

    try {
      await Promise.all([load(), loadAnalytics(), loadImports()]);
    } catch (error) {
      setMessage(error.message);
    }
  }

  useEffect(() => {
    load().catch((error) => setMessage(error.message));
    loadAnalytics();
    loadImports().catch((error) => setMessage(error.message));
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

  async function showImport(report) {
    setImportReport(report);
    await Promise.all([load(), loadAnalytics(), loadImports()]);
    onChanged();
  }

  // Manual transfer: the server parses the file, so the dashboard only sends its name and text.
  async function importFile(event) {
    const input = event.currentTarget;
    const file = input.files?.[0];

    if (!file) return;

    setMessage("");
    setImportReport(null);
    setImporting(true);

    try {
      if (!/\.(csv|json)$/i.test(file.name)) {
        throw new Error("Choose the ERP's CSV export (.csv) or a JSON file (.json).");
      }

      if (file.size > 2 * 1024 * 1024) {
        throw new Error("The file must be smaller than 2 MB.");
      }

      const result = await api("/products/import", {
        method: "POST",
        body: JSON.stringify({ fileName: file.name, content: await file.text(), fullSync })
      });

      await showImport(result.report);
      setMessage(`${file.name} imported successfully.`);
    } catch (error) {
      // A rejected file still comes with its report, which lists every problem.
      if (error.body?.report) await showImport(error.body.report).catch(() => {});
      setMessage(error.message || "Product import failed.");
    } finally {
      setImporting(false);
      input.value = "";
    }
  }

  async function pullFromErp() {
    setMessage("");
    setImportReport(null);
    setImporting(true);

    try {
      const result = await api("/products/import/erp", { method: "POST" });
      const report = result.imports.at(-1) || null;

      if (report) await showImport(report);

      if (result.exportError) setMessage(`ERP export failed: ${result.exportError}`);
      else if (report?.status === "success") setMessage("ERP products imported successfully.");
      else if (report) setMessage(`The ERP export was ${report.status}.`);
    } catch (error) {
      setMessage(error.message || "ERP export failed.");
    } finally {
      setImporting(false);
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

      <div className="erp-import">
        <div className="erp-import-actions">
          <button
            type="button"
            className="button button-dark button-small"
            onClick={pullFromErp}
            disabled={importing}
          >
            Pull from ERP now
          </button>

          <label className="button button-outline button-small erp-file-button">
            Upload export file (.csv, .json)
            <input
              type="file"
              accept=".csv,.json,text/csv,application/json"
              onChange={importFile}
              disabled={importing}
            />
          </label>
        </div>

        <label className="erp-full-sync">
          <input
            type="checkbox"
            checked={fullSync}
            onChange={(e) => setFullSync(e.target.checked)}
          />
          Uploaded file is a complete export: deactivate ERP products missing from it
        </label>

        {importing && <p className="fine-print">Importing products...</p>}

        {importReport && <ImportReport report={importReport} />}

        <h4 className="erp-history-title">Import history</h4>

        <div className="admin-table">
          {imports.length === 0 ? (
            <p className="fine-print">No imports yet.</p>
          ) : (
            imports.map((entry) => (
              <div className="admin-row" key={entry.id}>
                <span>
                  {entry.fileName}
                  <small>
                    {new Date(entry.createdAt).toLocaleString("de-DE")} ·{" "}
                    {importSources[entry.source] || entry.source} ·{" "}
                    {entry.status === "success"
                      ? `${entry.inserted} new, ${entry.updated} updated, ${entry.deactivated} deactivated`
                      : entry.errors[0]}
                  </small>
                </span>

                <span className={`status ${importStatusClass[entry.status] || ""}`}>
                  {entry.status}
                </span>
              </div>
            ))
          )}
        </div>
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
          {categories.map((category) => (
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
                  ? ` · ERP ${product.erp_product_id} · Stock: ${product.stock}`
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
