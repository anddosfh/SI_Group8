-- One-time setup. Run it as the PostgreSQL superuser; psql asks for that user's password:
--   npm run db:setup        (same as: psql -U postgres -f src/database/setup.sql)
-- Creates the login role and the empty database that DATABASE_URL in .env.example points to.
-- The API creates the tables and demo data itself on first start (see schema.sql and db.js).

SELECT 'CREATE ROLE nova LOGIN PASSWORD ''nova_local_dev'''
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'nova')\gexec

SELECT 'CREATE DATABASE nova_gadgets OWNER nova'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'nova_gadgets')\gexec
