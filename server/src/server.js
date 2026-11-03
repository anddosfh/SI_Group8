
import express from "express";
import cors from "cors";
import { DATABASE_URL, PORT } from "./config/env.js";
import { initDatabase } from "./database/db.js";

import authRoutes from "./routes/authRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import analyticsRoutes from "./routes/analyticsRoutes.js";

const app = express();

// Middleware
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://127.0.0.1:5173",
    ],
  })
);

app.use(express.json({ limit: "1mb" }));

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    service: "NOVA Gadgets API",
    time: new Date().toISOString(),
  });
});

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/analytics", analyticsRoutes);

// 404 handler — must come after all API routes
app.use((req, res) => {
  res.status(404).json({
    error: "Endpoint not found.",
  });
});

// Error handler — must come last
app.use((err, req, res, next) => {
  console.error("Server error:", err);

  res.status(500).json({
    error: "Unexpected server error.",
  });
});

// Initialise database and start server
initDatabase()
  .then(() => {
    // Log database host and name only, never the password.
    const { hostname, pathname } = new URL(DATABASE_URL);

    app.listen(PORT, () => {
      console.log(
        `NOVA Gadgets API running at http://localhost:${PORT} ` +
        `(database: ${hostname}${pathname})`
      );
    });
  })
  .catch((error) => {
    console.error(
      "Could not initialise the PostgreSQL database. " +
      "Check DATABASE_URL in server/.env:",
      error
    );

    process.exit(1);
  });
