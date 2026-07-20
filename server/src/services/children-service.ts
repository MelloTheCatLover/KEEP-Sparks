import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { pool } from "../config/db";
import { AppError } from "../middleware/error";
import {
  ChildAccount,
  ChildDetails,
  ChildDetailsInput,
  ChildInput,
  ChildOverview,
  CreateChildInput,
  GeneratedCredential,
} from "../types/children";

const COLS = "id, f_name, m_name, l_name, login, created_at";
const UNIQUE_VIOLATION = "23505";

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { code?: string }).code === UNIQUE_VIOLATION
  );
}

// Readable random password (no ambiguous chars, ~10 chars).
function makePassword(): string {
  const alphabet = "abcdefghijkmnpqrstuvwxyz23456789";
  const bytes = randomBytes(10);
  return [...bytes].map((b) => alphabet[b % alphabet.length]).join("");
}

export async function list(): Promise<ChildAccount[]> {
  const { rows } = await pool.query<ChildAccount>(
    `SELECT ${COLS.split(", ")
      .map((c) => `u.${c}`)
      .join(", ")},
       COALESCE(
         array_agg(DISTINCT a.shift_id) FILTER (WHERE a.shift_id IS NOT NULL),
         '{}'
       ) AS shifts
     FROM user_main u
     LEFT JOIN achievements a ON a.user_id = u.id
     WHERE u.role = 'child'
     GROUP BY u.id
     ORDER BY u.l_name, u.f_name`,
  );
  return rows;
}

// One-shot admin overview: every child with their full profile inlined, so the
// panel can show info + allergies for everyone without N per-child calls.
export async function overview(): Promise<ChildOverview[]> {
  const { rows } = await pool.query<ChildOverview>(
    `SELECT u.id, u.f_name, u.m_name, u.l_name, u.login,
       u.in_current_rating,
       (pi.date_of_birth IS NOT NULL
         AND pi.date_of_birth <= (CURRENT_DATE - INTERVAL '18 years')) AS is_adult,
       pi.gender,
       to_char(pi.date_of_birth, 'YYYY-MM-DD') AS date_of_birth,
       pi.height,
       COALESCE(
         (SELECT array_agg(DISTINCT a.shift_id ORDER BY a.shift_id)
          FROM achievements a WHERE a.user_id = u.id),
         '{}'
       ) AS shifts,
       COALESCE(
         (SELECT json_agg(json_build_object(
            'id', p.id, 'f_name', p.f_name, 'm_name', p.m_name,
            'l_name', p.l_name, 'phone_number_1', p.phone_number_1,
            'phone_number_2', p.phone_number_2) ORDER BY p.l_name, p.f_name)
          FROM user_parents_info p WHERE p.user_id = u.id),
         '[]'
       ) AS parents,
       COALESCE(
         (SELECT array_agg(al.item ORDER BY al.item)
          FROM user_allergy al WHERE al.user_id = u.id),
         '{}'
       ) AS allergies
     FROM user_main u
     LEFT JOIN user_pers_info pi ON pi.user_id = u.id
     WHERE u.role = 'child'
     ORDER BY u.l_name, u.f_name`,
  );
  return rows;
}

// Manual opt-out from the current ranking (overall ranking is unaffected).
export async function setCurrentRating(
  id: string,
  value: boolean,
): Promise<void> {
  const { rowCount } = await pool.query(
    "UPDATE user_main SET in_current_rating = $2 WHERE id = $1 AND role = 'child'",
    [id, value],
  );
  if (!rowCount) throw new AppError(404, "Child not found");
}

// Full admin/internal profile: personal info, parents, allergy items.
export async function getDetails(id: string): Promise<ChildDetails> {
  const exists = await pool.query(
    "SELECT 1 FROM user_main WHERE id = $1 AND role = 'child'",
    [id],
  );
  if (exists.rowCount === 0) throw new AppError(404, "Child not found");

  const [pers, parents, allergies] = await Promise.all([
    pool.query<{ gender: string; date_of_birth: string; height: number }>(
      `SELECT gender, to_char(date_of_birth, 'YYYY-MM-DD') AS date_of_birth, height
       FROM user_pers_info WHERE user_id = $1`,
      [id],
    ),
    pool.query(
      `SELECT id, f_name, m_name, l_name, phone_number_1, phone_number_2
       FROM user_parents_info WHERE user_id = $1 ORDER BY l_name, f_name`,
      [id],
    ),
    pool.query<{ item: string }>(
      "SELECT item FROM user_allergy WHERE user_id = $1 ORDER BY item",
      [id],
    ),
  ]);

  return {
    pers: pers.rows[0] ?? null,
    parents: parents.rows,
    allergies: allergies.rows.map((r) => r.item),
  };
}

// Replace the whole profile transactionally.
export async function saveDetails(
  id: string,
  input: ChildDetailsInput,
): Promise<ChildDetails> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const owner = await client.query(
      "SELECT 1 FROM user_main WHERE id = $1 AND role = 'child'",
      [id],
    );
    if (owner.rowCount === 0) throw new AppError(404, "Child not found");

    if (input.pers) {
      await client.query(
        `INSERT INTO user_pers_info (user_id, gender, date_of_birth, height)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id) DO UPDATE
           SET gender = EXCLUDED.gender,
               date_of_birth = EXCLUDED.date_of_birth,
               height = EXCLUDED.height`,
        [id, input.pers.gender, input.pers.date_of_birth, input.pers.height],
      );
    } else {
      await client.query("DELETE FROM user_pers_info WHERE user_id = $1", [id]);
    }

    await client.query("DELETE FROM user_parents_info WHERE user_id = $1", [id]);
    for (const p of input.parents) {
      await client.query(
        `INSERT INTO user_parents_info
           (user_id, f_name, m_name, l_name, phone_number_1, phone_number_2)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [id, p.f_name, p.m_name, p.l_name, p.phone_number_1, p.phone_number_2],
      );
    }

    await client.query("DELETE FROM user_allergy WHERE user_id = $1", [id]);
    for (const item of input.allergies) {
      await client.query(
        "INSERT INTO user_allergy (user_id, item) VALUES ($1, $2)",
        [id, item],
      );
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
  return getDetails(id);
}

export async function create(input: CreateChildInput): Promise<ChildAccount> {
  const passwd = await bcrypt.hash(input.password, 10);
  try {
    const { rows } = await pool.query<ChildAccount>(
      `INSERT INTO user_main (f_name, m_name, l_name, login, passwd, password_plain, role)
       VALUES ($1, $2, $3, $4, $5, $6, 'child')
       RETURNING ${COLS}, '{}'::int[] AS shifts`,
      [input.f_name, input.m_name, input.l_name, input.login, passwd, input.password],
    );
    return rows[0];
  } catch (err) {
    if (isUniqueViolation(err)) throw new AppError(409, "Login already taken");
    throw err;
  }
}

export async function update(
  id: string,
  input: ChildInput,
): Promise<ChildAccount> {
  try {
    const { rows } = await pool.query<ChildAccount>(
      `UPDATE user_main
       SET f_name = $2, m_name = $3, l_name = $4, login = $5
       WHERE id = $1 AND role = 'child'
       RETURNING ${COLS},
         COALESCE(
           (SELECT array_agg(DISTINCT shift_id) FROM achievements WHERE user_id = $1),
           '{}'
         ) AS shifts`,
      [id, input.f_name, input.m_name, input.l_name, input.login],
    );
    if (rows.length === 0) throw new AppError(404, "Child not found");
    return rows[0];
  } catch (err) {
    if (isUniqueViolation(err)) throw new AppError(409, "Login already taken");
    throw err;
  }
}

export async function setPassword(id: string, password: string): Promise<void> {
  const passwd = await bcrypt.hash(password, 10);
  const { rowCount } = await pool.query(
    "UPDATE user_main SET passwd = $2, password_plain = $3 WHERE id = $1 AND role = 'child'",
    [id, passwd, password],
  );
  if (!rowCount) throw new AppError(404, "Child not found");
}

// Reset passwords for all children, or just those on a given shift. Returns the
// plaintext so the admin can hand them out — the only time it is available.
export async function generatePasswords(
  shiftId?: number,
): Promise<GeneratedCredential[]> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const credCols = "id, f_name, m_name, l_name, login";
    const targets = await client.query<GeneratedCredential>(
      shiftId === undefined
        ? `SELECT ${credCols} FROM user_main WHERE role = 'child'
           ORDER BY l_name, f_name`
        : `SELECT ${credCols} FROM user_main u
           WHERE u.role = 'child'
             AND EXISTS (
               SELECT 1 FROM achievements a
               WHERE a.user_id = u.id AND a.shift_id = $1
             )
           ORDER BY u.l_name, u.f_name`,
      shiftId === undefined ? [] : [shiftId],
    );

    const result: GeneratedCredential[] = [];
    for (const row of targets.rows) {
      const password = makePassword();
      const passwd = await bcrypt.hash(password, 10);
      await client.query(
        "UPDATE user_main SET passwd = $2, password_plain = $3 WHERE id = $1",
        [row.id, passwd, password],
      );
      result.push({ ...row, password });
    }

    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
