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

-- erp_product_id is the Mini-ERP's productID; products created in the shop's admin dashboard have none.
CREATE TABLE IF NOT EXISTS products (
  id             INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  erp_product_id TEXT,
  name           TEXT NOT NULL,
  description    TEXT NOT NULL,
  price          NUMERIC NOT NULL CHECK (price > 0),
  category       TEXT NOT NULL,
  image          TEXT NOT NULL DEFAULT '',
  stock          INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  active         BOOLEAN NOT NULL DEFAULT TRUE
);

-- Lab 2: ERP identity and inventory, added to databases that still have the Lab 1 products table.
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS erp_product_id TEXT;

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS stock INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS products_erp_product_id_unique
  ON products (erp_product_id)
  WHERE erp_product_id IS NOT NULL;

-- Lab 2: one row per processed ERP product file (or failed ERP export), shown in the admin dashboard.
CREATE TABLE IF NOT EXISTS product_imports (
  id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  file_name   TEXT NOT NULL,
  source      TEXT NOT NULL CHECK (source IN ('upload', 'inbox', 'erp-export')),
  status      TEXT NOT NULL CHECK (status IN ('success', 'failed', 'skipped')),
  full_sync   BOOLEAN NOT NULL DEFAULT FALSE,
  exported_at TIMESTAMPTZ,
  received    INTEGER NOT NULL DEFAULT 0,
  inserted    INTEGER NOT NULL DEFAULT 0,
  updated     INTEGER NOT NULL DEFAULT 0,
  unchanged   INTEGER NOT NULL DEFAULT 0,
  deactivated INTEGER NOT NULL DEFAULT 0,
  errors      JSONB NOT NULL DEFAULT '[]',
  changes     JSONB NOT NULL DEFAULT '[]',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

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
