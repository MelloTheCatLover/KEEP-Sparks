import { Pool } from "pg";
import { env } from "./env";

// Single shared pool. Services are the only callers — never import this
// from controllers or routes.
export const pool = new Pool({
  host: env.db.host,
  port: env.db.port,
  database: env.db.name,
  user: env.db.user,
  password: env.db.password,
});
