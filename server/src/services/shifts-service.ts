import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { pool } from "../config/db";
import { AppError } from "../middleware/error";
import { GeneratedCredential } from "../types/children";
import {
  AchievementEdit,
  AddMembersResult,
  ShiftAchievementsGrid,
  ShiftDetail,
  ShiftMemberRow,
  ShiftMetaInput,
  ShiftRankEntry,
  ShiftSummary,
  ShiftWinners,
} from "../types/shifts";

// Common select for ShiftSummary, including the person of the shift.
const SHIFT_SUMMARY = `
  SELECT s.shift_id, s.name, s.start_date::text, s.end_date::text, s.in_rating,
         (SELECT COUNT(*) FROM shift_members m WHERE m.shift_id = s.shift_id)::int
           AS child_count,
         p.id AS person_user_id, p.f_name AS person_f_name,
         p.m_name AS person_m_name, p.l_name AS person_l_name
  FROM shift_info s
  LEFT JOIN user_main p ON p.id = s.person_of_the_shift
`;

export async function list(): Promise<ShiftSummary[]> {
  const { rows } = await pool.query<ShiftSummary>(
    `${SHIFT_SUMMARY} ORDER BY s.shift_id`,
  );
  return rows;
}

function difficulty(personCount: number): number {
  return Math.round((1 + (1 - Math.exp(-0.03 * (personCount - 10)))) * 100) / 100;
}

// Shift detail with the per-shift ranking: roster children scored by their
// achievements on this shift, times this shift's difficulty.
export async function getDetail(shiftId: number): Promise<ShiftDetail> {
  const meta = await pool.query<ShiftSummary>(
    `${SHIFT_SUMMARY} WHERE s.shift_id = $1`,
    [shiftId],
  );
  if (meta.rows.length === 0) {
    throw new AppError(404, "Shift not found");
  }

  const ranking = await pool.query<ShiftRankEntry>(
    `WITH diff AS (
       SELECT ROUND(1 + (1 - EXP(-0.03 * (COUNT(*) - 10))), 2) AS d
       FROM shift_members WHERE shift_id = $1
     ),
     scores AS (
       SELECT m.user_id,
              ROUND(COALESCE(SUM(a.amount * s.value), 0) * (SELECT d FROM diff))
                AS coef
       FROM shift_members m
       LEFT JOIN achievements a
         ON a.user_id = m.user_id AND a.shift_id = $1
       LEFT JOIN settings s ON s.id = a.setting_id
       WHERE m.shift_id = $1
       GROUP BY m.user_id
     )
     SELECT RANK() OVER (ORDER BY sc.coef DESC)::int AS rank,
            sc.coef::int AS sparks,
            u.id AS user_id, u.f_name, u.m_name, u.l_name, u.login
     FROM scores sc
     JOIN user_main u ON u.id = sc.user_id
     ORDER BY rank, u.l_name, u.f_name`,
    [shiftId],
  );

  return {
    ...meta.rows[0],
    difficulty: difficulty(meta.rows[0].child_count),
    ranking: ranking.rows,
  };
}

// Reality-show winners board: every shift that has a winner or finalists,
// newest first. Derived from the reality_winner / reality_finalist
// achievements — the same rows the per-shift editor writes.
export async function getWinners(): Promise<ShiftWinners[]> {
  const { rows } = await pool.query<{
    shift_id: number;
    kind: string;
    user_id: string;
    f_name: string;
    m_name: string | null;
    l_name: string;
  }>(
    `SELECT a.shift_id, st.name AS kind,
            u.id AS user_id, u.f_name, u.m_name, u.l_name
     FROM achievements a
     JOIN settings st ON st.id = a.setting_id
     JOIN user_main u ON u.id = a.user_id
     WHERE st.name IN ('reality_winner', 'reality_finalist') AND a.amount > 0
     ORDER BY a.shift_id DESC, u.l_name, u.f_name`,
  );

  const board = new Map<number, ShiftWinners>();
  for (const r of rows) {
    let e = board.get(r.shift_id);
    if (!e) {
      e = { shift_id: r.shift_id, winner: null, finalists: [] };
      board.set(r.shift_id, e);
    }
    const person: ShiftWinners["finalists"][number] = {
      user_id: r.user_id,
      f_name: r.f_name,
      m_name: r.m_name,
      l_name: r.l_name,
    };
    if (r.kind === "reality_winner") e.winner = person;
    else e.finalists.push(person);
  }
  return [...board.values()];
}

async function assertShiftExists(shiftId: number): Promise<void> {
  const { rowCount } = await pool.query(
    "SELECT 1 FROM shift_info WHERE shift_id = $1",
    [shiftId],
  );
  if (!rowCount) {
    throw new AppError(404, "Shift not found");
  }
}

// Editable achievements grid for one shift: the full catalogue plus every
// roster member (from shift_members) with their per-setting amounts on this
// shift. Members without any achievement row get an empty `counts`.
export async function getAchievements(
  shiftId: number,
): Promise<ShiftAchievementsGrid> {
  await assertShiftExists(shiftId);

  const settings = await pool.query<{ id: number; name: string; value: number }>(
    "SELECT id, name, value FROM settings ORDER BY id",
  );

  const members = await pool.query<ShiftMemberRow>(
    `SELECT u.id AS user_id, u.f_name, u.m_name, u.l_name, u.login,
            COALESCE(
              jsonb_object_agg(s.name, a.amount) FILTER (WHERE s.name IS NOT NULL),
              '{}'::jsonb
            ) AS counts
     FROM shift_members m
     JOIN user_main u ON u.id = m.user_id
     LEFT JOIN achievements a ON a.user_id = m.user_id AND a.shift_id = $1
     LEFT JOIN settings s ON s.id = a.setting_id
     WHERE m.shift_id = $1
     GROUP BY u.id, u.f_name, u.m_name, u.l_name, u.login
     ORDER BY u.l_name, u.f_name`,
    [shiftId],
  );

  return { settings: settings.rows, members: members.rows };
}

// Upsert a batch of amount edits for a shift, in one transaction. Each edit
// must target a roster member of this shift and an existing setting. Sparks are
// recomputed on read, so nothing else needs updating.
export async function saveAchievements(
  shiftId: number,
  edits: AchievementEdit[],
): Promise<ShiftAchievementsGrid> {
  await assertShiftExists(shiftId);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const roster = await client.query<{ user_id: string }>(
      "SELECT user_id FROM shift_members WHERE shift_id = $1",
      [shiftId],
    );
    const memberIds = new Set(roster.rows.map((r) => r.user_id));

    const settings = await client.query<{ id: number }>("SELECT id FROM settings");
    const settingIds = new Set(settings.rows.map((r) => r.id));

    for (const e of edits) {
      if (!memberIds.has(e.user_id)) {
        throw new AppError(400, `User ${e.user_id} is not on this shift`);
      }
      if (!settingIds.has(e.setting_id)) {
        throw new AppError(400, `Unknown setting ${e.setting_id}`);
      }
      await client.query(
        `INSERT INTO achievements (user_id, shift_id, setting_id, amount)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id, shift_id, setting_id)
         DO UPDATE SET amount = EXCLUDED.amount`,
        [e.user_id, shiftId, e.setting_id, e.amount],
      );
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  return getAchievements(shiftId);
}

// Update the present shift-meta fields only. person_of_the_shift, when given,
// must be an existing user (or null to clear it).
export async function updateMeta(
  shiftId: number,
  fields: ShiftMetaInput,
): Promise<ShiftSummary> {
  await assertShiftExists(shiftId);

  if (fields.person_of_the_shift) {
    const { rowCount } = await pool.query(
      "SELECT 1 FROM user_main WHERE id = $1",
      [fields.person_of_the_shift],
    );
    if (!rowCount) {
      throw new AppError(400, "person_of_the_shift is not a valid user");
    }
  }

  const cols: string[] = [];
  const values: unknown[] = [];
  for (const key of [
    "name",
    "start_date",
    "end_date",
    "in_rating",
    "person_of_the_shift",
  ] as const) {
    if (key in fields && fields[key] !== undefined) {
      values.push(fields[key]);
      cols.push(`${key} = $${values.length}`);
    }
  }

  if (cols.length > 0) {
    values.push(shiftId);
    await pool.query(
      `UPDATE shift_info SET ${cols.join(", ")}, updated_at = now()
       WHERE shift_id = $${values.length}`,
      values,
    );
  }

  const { rows } = await pool.query<ShiftSummary>(
    `${SHIFT_SUMMARY} WHERE s.shift_id = $1`,
    [shiftId],
  );
  return rows[0];
}

// Cyrillic -> latin, for generating a login from a name. Mirrors the one-off
// import-shift script so logins created by either path look the same.
const TRANSLIT: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z",
  и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r",
  с: "s", т: "t", у: "u", ф: "f", х: "kh", ц: "ts", ч: "ch", ш: "sh",
  щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

function translit(s: string): string {
  return [...s.toLowerCase()].map((c) => TRANSLIT[c] ?? c).join("");
}

// Readable random password (no ambiguous chars), handed out once on creation.
function makePassword(): string {
  const alphabet = "abcdefghijkmnpqrstuvwxyz23456789";
  return [...randomBytes(10)].map((b) => alphabet[b % alphabet.length]).join("");
}

// Roster a pasted "Фамилия Имя [Отчество]" list onto a shift. Each line is
// matched to an existing child by surname + first name (patronymic preferred
// when several share a name, and backfilled when missing); unmatched lines
// create a new child with generated credentials. Every listed child is added to
// shift_members. One transaction; returns the refreshed grid plus the plaintext
// credentials of any created accounts.
export async function addMembers(
  shiftId: number,
  names: string[],
): Promise<AddMembersResult> {
  await assertShiftExists(shiftId);

  const parsed: { lName: string; fName: string; mName: string | null }[] = [];
  const skipped: string[] = [];
  for (const raw of names) {
    const parts = raw.trim().split(/\s+/).filter(Boolean);
    if (parts.length < 2) {
      if (raw.trim() !== "") skipped.push(raw.trim());
      continue;
    }
    const [lName, fName, ...mid] = parts;
    parsed.push({ lName, fName, mName: mid.length ? mid.join(" ") : null });
  }

  const client = await pool.connect();
  const credentials: GeneratedCredential[] = [];
  let created = 0;
  let reused = 0;
  let rostered = 0;
  try {
    await client.query("BEGIN");

    const existingLogins = new Set<string>(
      (
        await client.query<{ login: string }>("SELECT login FROM user_main")
      ).rows.map((r) => r.login),
    );

    for (const { lName, fName, mName } of parsed) {
      const matches = await client.query<{ id: string; m_name: string | null }>(
        `SELECT id, m_name FROM user_main
         WHERE l_name = $1 AND f_name = $2 AND role = 'child'`,
        [lName, fName],
      );

      let userId: string;
      if (matches.rows.length > 0) {
        const exact = matches.rows.find((r) => (r.m_name ?? "") === (mName ?? ""));
        const chosen = exact ?? matches.rows[0];
        userId = chosen.id;
        reused++;
        if (!chosen.m_name && mName) {
          await client.query("UPDATE user_main SET m_name = $2 WHERE id = $1", [
            userId,
            mName,
          ]);
        }
      } else {
        const base = `${translit(lName)}.${translit(fName)}`.replace(
          /[^a-z0-9.]/g,
          "",
        );
        let login = base;
        let n = 1;
        while (existingLogins.has(login)) login = `${base}${++n}`;
        existingLogins.add(login);

        const password = makePassword();
        const passwd = await bcrypt.hash(password, 10);
        const ins = await client.query<{ id: string }>(
          `INSERT INTO user_main (f_name, m_name, l_name, login, passwd, role)
           VALUES ($1, $2, $3, $4, $5, 'child') RETURNING id`,
          [fName, mName, lName, login, passwd],
        );
        userId = ins.rows[0].id;
        credentials.push({ id: userId, f_name: fName, m_name: mName, l_name: lName, login, password });
        created++;
      }

      const add = await client.query(
        `INSERT INTO shift_members (shift_id, user_id) VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [shiftId, userId],
      );
      rostered += add.rowCount ?? 0;
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  return { grid: await getAchievements(shiftId), rostered, created, reused, skipped, credentials };
}
