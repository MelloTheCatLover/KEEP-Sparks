import dotenv from "dotenv";

dotenv.config();

function required(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === "") {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function optional(name: string, fallback: string): string {
  const value = process.env[name];
  return value === undefined || value === "" ? fallback : value;
}

export const env = {
  port: Number(optional("PORT", "8080")),
  db: {
    host: optional("DB_HOST", "localhost"),
    port: Number(optional("DB_PORT", "5432")),
    name: required("DB_NAME"),
    user: required("DB_USER"),
    password: optional("DB_PASSWORD", ""),
  },
  jwt: {
    secret: required("JWT_SECRET"),
    expiresIn: optional("JWT_EXPIRES_IN", "7d"),
  },
  // Comma-separated allowlist; '*' only for dev.
  corsOrigin: optional("CORS_ORIGIN", "*"),
  // Таймзона лагеря. Сервер живёт в UTC, поэтому «настенное» время раскрытия
  // составов КТБ разбирается в явной зоне, а не в локальной.
  sparks: {
    timezone: optional("SPARKS_TIMEZONE", "Asia/Novosibirsk"),
  },
} as const;
