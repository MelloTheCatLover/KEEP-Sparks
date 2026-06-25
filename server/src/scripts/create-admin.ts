import bcrypt from "bcryptjs";
import { pool } from "../config/db";

// Bootstrap an admin account. Accounts are issued, not self-registered.
// Usage: npm run create-admin -- <login> <password> [f_name] [l_name]
// Password may also come from ADMIN_PASSWORD env instead of argv.
// Idempotent: an existing login is promoted to admin and its password reset.
async function run(): Promise<void> {
  const [login, passwordArg, fName = "Admin", lName = "Admin"] =
    process.argv.slice(2);
  const password = passwordArg ?? process.env.ADMIN_PASSWORD;

  if (!login || !password) {
    throw new Error(
      "Usage: npm run create-admin -- <login> <password> [f_name] [l_name]",
    );
  }
  if (password.length < 6) {
    throw new Error("Password must be at least 6 characters");
  }

  const passwd = await bcrypt.hash(password, 10);
  const { rows } = await pool.query<{ id: string; login: string; role: string }>(
    `INSERT INTO user_main (f_name, l_name, login, passwd, role)
     VALUES ($1, $2, $3, $4, 'admin')
     ON CONFLICT (login) DO UPDATE
       SET role = 'admin', passwd = EXCLUDED.passwd
     RETURNING id, login, role`,
    [fName, lName, login, passwd],
  );

  console.log(`admin ready: ${rows[0].login} (${rows[0].role})`);
}

run()
  .then(() => pool.end())
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    pool.end().finally(() => process.exit(1));
  });
