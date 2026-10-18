import "dotenv/config";
export const PORT = Number(process.env.PORT || 4000);
export const JWT_SECRET = process.env.JWT_SECRET || "nova-lab-secret-change-before-deployment";
export const DATABASE_URL = process.env.DATABASE_URL || "postgres://nova:nova_local_dev@localhost:5432/nova_gadgets";
