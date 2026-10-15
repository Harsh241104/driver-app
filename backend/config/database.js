import pg from "pg";

const { Pool } = pg;

export const pool = process.env.DATABASE_URL
  ? new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000
  })
  : null;

export function requireDatabase(_request, response, next) {
  if (!pool) {
    response.status(503).json({ error: "DATABASE_URL is not configured. Add your Neon connection string to the local .env file." });
    return;
  }
  next();
}
