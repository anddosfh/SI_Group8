-- NOVA Gadgets schema. initDatabase() in db.js runs this on every server start, so every statement must be idempotent.

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  address       TEXT NOT NULL DEFAULT '',
  role          TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'admin')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS products (
  id             INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  erp_product_id TEXT UNIQUE,
  name           TEXT NOT NULL,
  description    TEXT NOT NULL,
  price          NUMERIC NOT NULL CHECK (price > 0),
  category       TEXT NOT NULL,
  image          TEXT NOT NULL DEFAULT '',
  stock          INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  active         BOOLEAN NOT NULL DEFAULT TRUE
);

-- Lab 2: ERP identity and inventory
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS erp_product_id TEXT;

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS stock INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS products_erp_product_id_unique
  ON products (erp_product_id)
  WHERE erp_product_id IS NOT NULL;

-- Safe for databases that already have the Lab 1 products table.
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS erp_product_id TEXT;

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS stock INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS products_erp_product_id_unique
  ON products (erp_product_id)
  WHERE erp_product_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS orders (
  id             INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id        INTEGER NOT NULL REFERENCES users (id),
  customer_name  TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  address        TEXT NOT NULL DEFAULT '',
  total          NUMERIC NOT NULL,
  status         TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'shipped', 'completed', 'cancelled')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS orders_user_id_idx ON orders (user_id);

-- Name and unit price are copied at checkout so later catalogue changes do not rewrite past orders.
CREATE TABLE IF NOT EXISTS order_items (
  id         INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id   INTEGER NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products (id),
  name       TEXT NOT NULL,
  unit_price NUMERIC NOT NULL,
  quantity   INTEGER NOT NULL CHECK (quantity > 0),
  UNIQUE (order_id, product_id)
);
