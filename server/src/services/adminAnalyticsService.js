import { query } from "../database/db.js";

export async function getAdminAnalytics() {
  const [
    overviewResult,
    monthlyResult,
    statusResult,
    categoryResult,
    topProductsResult,
    recentOrdersResult,
    inventoryResult,
    customerResult
  ] = await Promise.all([
    // Revenue counts completed orders only.
    query(`
      SELECT
        COUNT(*)::int AS total_orders,
        COUNT(*) FILTER (WHERE status = 'pending')::int AS pending_orders,
        COUNT(*) FILTER (WHERE status = 'shipped')::int AS shipped_orders,
        COUNT(*) FILTER (WHERE status = 'completed')::int AS completed_orders,
        COUNT(*) FILTER (WHERE status = 'cancelled')::int AS cancelled_orders,
        COALESCE(SUM(total) FILTER (WHERE status = 'completed'), 0) AS revenue,
        COALESCE(AVG(total) FILTER (WHERE status = 'completed'), 0) AS average_order_value
      FROM orders
    `),

    // Six-month revenue trend.
    query(`
      SELECT
        TO_CHAR(month_start, 'Mon YY') AS month,
        COALESCE(SUM(o.total) FILTER (WHERE o.status = 'completed'), 0) AS revenue,
        COUNT(o.id)::int AS orders
      FROM generate_series(
        date_trunc('month', CURRENT_DATE) - INTERVAL '5 months',
        date_trunc('month', CURRENT_DATE),
        INTERVAL '1 month'
      ) AS month_start
      LEFT JOIN orders o
        ON o.created_at >= month_start
       AND o.created_at < month_start + INTERVAL '1 month'
      GROUP BY month_start
      ORDER BY month_start
    `),

    query(`
      SELECT status, COUNT(*)::int AS count
      FROM orders
      GROUP BY status
      ORDER BY status
    `),

    
    // Category performance based on completed order items.
    query(`
      SELECT
        p.category,
        COALESCE(SUM(i.quantity) FILTER (
          WHERE o.status = 'completed'
        ), 0)::int AS units_sold,
        COALESCE(SUM(i.quantity * i.unit_price) FILTER (
          WHERE o.status = 'completed'
        ), 0) AS revenue
      FROM products p
      LEFT JOIN order_items i ON i.product_id = p.id
      LEFT JOIN orders o ON o.id = i.order_id
      GROUP BY p.category
      ORDER BY revenue DESC
    `)
  ]);

  const overview = overviewResult.rows[0];

  return {
    overview: {
      totalOrders: Number(overview.total_orders),
      pendingOrders: Number(overview.pending_orders),
      shippedOrders: Number(overview.shipped_orders),
      completedOrders: Number(overview.completed_orders),
      cancelledOrders: Number(overview.cancelled_orders),
      revenue: Number(overview.revenue),
      averageOrderValue: Number(overview.average_order_value)
    },
    monthly: monthlyResult.rows.map(row => ({
      month: row.month,
      revenue: Number(row.revenue),
      orders: Number(row.orders)
    })),
    statuses: statusResult.rows.map(row => ({
      status: row.status,
      count: Number(row.count)
    })),
    categories: categoryResult.rows.map(row => ({
      category: row.category,
      unitsSold: Number(row.units_sold),
      revenue: Number(row.revenue)
    })),
    topProducts: topProductsResult.rows.map(row => ({
      ...row,
      units_sold: Number(row.units_sold),
      revenue: Number(row.revenue)
    })),
    recentOrders: recentOrdersResult.rows.map(row => ({
      ...row,
      total: Number(row.total)
    })),
    inventory: Object.fromEntries(
      Object.entries(inventoryResult.rows[0]).map(([key, value]) => [
        key,
        Number(value)
      ])
    ),
    customers: Object.fromEntries(
      Object.entries(customerResult.rows[0]).map(([key, value]) => [
        key,
        Number(value)
      ])
    )
  };
}