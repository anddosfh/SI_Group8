import { withTransaction } from "../database/db.js";

const allowedCategories = ["Phones", "Headphones", "Buds", "Watches"];

function validateProducts(payload) {
  if (
    !payload ||
    typeof payload !== "object" ||
    !Array.isArray(payload.products) ||
    payload.products.length === 0
  ) {
    throw new Error(
      "Invalid file: expected a non-empty products array."
    );
  }

  if (payload.products.length > 5000) {
    throw new Error("The file cannot contain more than 5000 products.");
  }

  const seenIds = new Set();

  return payload.products.map((product, index) => {
    const row = index + 1;

    if (!product || typeof product !== "object") {
      throw new Error(`Product ${row} is invalid.`);
    }

    const erpProductId = String(product.id ?? "").trim();
    const name = String(product.name ?? "").trim();
    const description = String(product.description ?? "").trim();
    const category = String(product.category ?? "").trim();
    const price = Number(product.price);
    const stock = Number(product.stock);

    if (!erpProductId || erpProductId.length > 100) {
      throw new Error(`Product ${row}: a valid ERP product ID is required.`);
    }

    if (seenIds.has(erpProductId)) {
      throw new Error(`Duplicate ERP product ID: ${erpProductId}.`);
    }
    seenIds.add(erpProductId);

    if (!name || name.length > 120) {
      throw new Error(`Product ${erpProductId}: name is required (max 120 characters).`);
    }

    if (!description || description.length > 500) {
      throw new Error(`Product ${erpProductId}: description is required (max 500 characters).`);
    }

    if (!Number.isFinite(price) || price <= 0 || price > 10000000) {
      throw new Error(`Product ${erpProductId}: price must be a positive number.`);
    }

    if (!Number.isInteger(stock) || stock < 0 || stock > 10000000) {
      throw new Error(`Product ${erpProductId}: stock must be a non-negative whole number.`);
    }

    if (!allowedCategories.includes(category)) {
      throw new Error(
        `Product ${erpProductId}: category must be one of ${allowedCategories.join(", ")}.`
      );
    }

    const image = typeof product.image === "string"
      ? product.image.trim().slice(0, 1000)
      : "";

    return {
      erpProductId,
      name,
      description,
      price,
      stock,
      category,
      image
    };
  });
}

export async function importProducts(payload) {
  // Validate the complete file before opening the database transaction.
  const products = validateProducts(payload);

  return withTransaction(async (client) => {
    let inserted = 0;
    let updated = 0;

    for (const product of products) {
      const result = await client.query(
        `INSERT INTO products
          (erp_product_id, name, description, price, category, image, stock, active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)
         ON CONFLICT (erp_product_id)
         WHERE erp_product_id IS NOT NULL
         DO UPDATE SET
           name = EXCLUDED.name,
           description = EXCLUDED.description,
           price = EXCLUDED.price,
           category = EXCLUDED.category,
           image = CASE
             WHEN EXCLUDED.image <> '' THEN EXCLUDED.image
             ELSE products.image
           END,
           stock = EXCLUDED.stock,
           active = TRUE
         RETURNING (xmax = 0) AS was_inserted`,
        [
          product.erpProductId,
          product.name,
          product.description,
          product.price,
          product.category,
          product.image,
          product.stock
        ]
      );

      if (result.rows[0].was_inserted) {
        inserted++;
      } else {
        updated++;
      }
    }

    return {
      received: products.length,
      inserted,
      updated
    };
  });
}