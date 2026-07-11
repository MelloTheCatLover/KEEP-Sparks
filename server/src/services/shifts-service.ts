import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { pool } from "../config/db";
import { AppError } from "../middleware/error";
import { GeneratedCredential } from "../types/children";
import {
  AchievementEdit,
  AddMembersResult,
  CreateShiftInput,
  CreateShiftResult,
  GeneratedNumber,
  ShiftAchievementsGrid,
  ShiftDetail,
  ShiftMemberRow,
  ShiftMetaInput,
  PersonOfDayEntry,
  RosterRow,
  ShiftRankEntry,
  ShiftSummary,
  ShiftWinners,
  WinnerPerson,
} from "../types/shifts";
import { getRanking } from "./sparks-service";

// Common select for ShiftSummary, including the person of the shift.
const SHIFT_SUMMARY = `
  SELECT s.shift_id, s.name, s.start_date::text, s.end_date::text, s.in_rating,
         s.person_count_override,
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

function genderFrom(raw: string | null | undefined, patr: string | null, first: string): string {
  const g = (raw ?? "").trim().toLowerCase();
  if (g === "ж" || g === "жен" || g === "female") return "female";
  if (g === "м" || g === "муж" || g === "male") return "male";
  const m = (patr ?? "").toLowerCase();
  if (m.endsWith("вна") || m.endsWith("чна") || m.endsWith("шна")) return "female";
  if (m.endsWith("ич")) return "male";
  const f = first.toLowerCase();
  return f.endsWith("а") || f.endsWith("я") ? "female" : f ? "male" : "";
}

function parseDob(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = String(raw).trim();
  let mt = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(s);
  if (mt) return `${mt[3]}-${mt[2]}-${mt[1]}`;
  mt = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (mt) return `${mt[1]}-${mt[2]}-${mt[3]}`;
  return null;
}

function ageFromIso(dob: string | null): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let a = now.getFullYear() - d.getFullYear();
  const md = now.getMonth() - d.getMonth();
  if (md < 0 || (md === 0 && now.getDate() < d.getDate())) a--;
  return a;
}

const PHONE_RE = /\+?\d[\d()\s-]{8,16}\d/g;
function splitPhones(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return (String(raw).match(PHONE_RE) ?? []).map((s) => s.replace(/\s+/g, " ").trim());
}

const ALLERGY_SEP = /[;,/]|\.\s+|\n/;
function splitAllergy(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return String(raw)
    .split(ALLERGY_SEP)
    .map((s) => s.replace(/\s+/g, " ").replace(/^[.\s]+|[.\s]+$/g, ""))
    .filter(Boolean);
}

// Create a shift from the "Генерация номеров" flow and assign starting numbers.
// The shift is created out of the ranking (in_rating = false); its results are
// loaded later. Each roster row may carry profile info (gender/dob/height/
// allergy/parent/phone) that backfills the child. Number 1 goes to the previous
// shift's reality-show winner when on the roster; otherwise numbering starts
// at 2. Also reports newly created kids and the roster's average age.
export async function createShift(
  input: CreateShiftInput,
): Promise<CreateShiftResult> {
  const { shift_id, name, start_date, end_date, roster } = input;

  const exists = await pool.query("SELECT 1 FROM shift_info WHERE shift_id = $1", [
    shift_id,
  ]);
  if (exists.rowCount) {
    throw new AppError(409, `Смена ${shift_id} уже существует`);
  }

  // Parse each roster line; blanks/unparseable names are skipped and reported.
  const rows: (RosterRow & { lName: string; fName: string; mName: string | null })[] = [];
  const skipped: string[] = [];
  for (const r of roster) {
    const parts = (r.name ?? "").trim().split(/\s+/).filter(Boolean);
    if (parts.length < 2) {
      if ((r.name ?? "").trim() !== "") skipped.push(r.name.trim());
      continue;
    }
    const [lName, fName, ...mid] = parts;
    rows.push({ ...r, lName, fName, mName: mid.length ? mid.join(" ") : null });
  }

  const client = await pool.connect();
  const credentials: GeneratedCredential[] = [];
  const members: {
    user_id: string;
    f_name: string;
    m_name: string | null;
    l_name: string;
    is_new: boolean;
    age: number | null;
  }[] = [];
  let created = 0;
  let reused = 0;
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO shift_info (shift_id, name, start_date, end_date, in_rating)
       VALUES ($1, $2, $3, $4, FALSE)`,
      [shift_id, name, start_date, end_date],
    );

    const existingLogins = new Set<string>(
      (await client.query<{ login: string }>("SELECT login FROM user_main")).rows.map(
        (r) => r.login,
      ),
    );

    for (const r of rows) {
      const matches = await client.query<{ id: string; m_name: string | null }>(
        `SELECT id, m_name FROM user_main
         WHERE l_name = $1 AND f_name = $2 AND role = 'child'`,
        [r.lName, r.fName],
      );

      let userId: string;
      let isNew = false;
      if (matches.rows.length > 0) {
        const exact = matches.rows.find((m) => (m.m_name ?? "") === (r.mName ?? ""));
        const chosen = exact ?? matches.rows[0];
        userId = chosen.id;
        reused++;
        if (!chosen.m_name && r.mName) {
          await client.query("UPDATE user_main SET m_name = $2 WHERE id = $1", [
            userId,
            r.mName,
          ]);
        }
      } else {
        const base = `${translit(r.lName)}.${translit(r.fName)}`.replace(/[^a-z0-9.]/g, "");
        let login = base;
        let k = 1;
        while (existingLogins.has(login)) login = `${base}${++k}`;
        existingLogins.add(login);
        const password = makePassword();
        const passwd = await bcrypt.hash(password, 10);
        const ins = await client.query<{ id: string }>(
          `INSERT INTO user_main (f_name, m_name, l_name, login, passwd, role)
           VALUES ($1, $2, $3, $4, $5, 'child') RETURNING id`,
          [r.fName, r.mName, r.lName, login, passwd],
        );
        userId = ins.rows[0].id;
        credentials.push({ id: userId, f_name: r.fName, m_name: r.mName, l_name: r.lName, login, password });
        created++;
        isNew = true;
      }

      // Backfill profile from the imported columns, when present.
      const dob = parseDob(r.date_of_birth);
      const gender = genderFrom(r.gender, r.mName, r.fName);
      const height = r.height != null && Number(r.height) > 0 ? Math.round(Number(r.height)) : null;
      if (gender && dob && height) {
        await client.query(
          `INSERT INTO user_pers_info (user_id, gender, date_of_birth, height)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (user_id) DO UPDATE
             SET gender = EXCLUDED.gender, date_of_birth = EXCLUDED.date_of_birth,
                 height = EXCLUDED.height`,
          [userId, gender, dob, height],
        );
      }
      if (r.parent && r.parent.trim()) {
        const pp = r.parent.trim().split(/\s+/);
        const [pl, pf, ...pm] = pp;
        const phones = splitPhones(r.phone);
        if (pl && pf) {
          await client.query("DELETE FROM user_parents_info WHERE user_id = $1", [userId]);
          await client.query(
            `INSERT INTO user_parents_info
               (user_id, f_name, m_name, l_name, phone_number_1, phone_number_2)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [userId, pf, pm.length ? pm.join(" ") : null, pl, phones[0] ?? null, phones[1] ?? null],
          );
        }
      }
      const allergyItems = splitAllergy(r.allergy);
      if (allergyItems.length > 0) {
        await client.query("DELETE FROM user_allergy WHERE user_id = $1", [userId]);
        for (const item of allergyItems) {
          await client.query("INSERT INTO user_allergy (user_id, item) VALUES ($1, $2)", [
            userId,
            item,
          ]);
        }
      }

      await client.query(
        "INSERT INTO shift_members (shift_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        [shift_id, userId],
      );
      members.push({
        user_id: userId,
        f_name: r.fName,
        m_name: r.mName,
        l_name: r.lName,
        is_new: isNew,
        age: ageFromIso(dob),
      });
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  // Previous shift = greatest shift number below this one.
  const prev = await pool.query<{ shift_id: number }>(
    "SELECT shift_id FROM shift_info WHERE shift_id < $1 ORDER BY shift_id DESC LIMIT 1",
    [shift_id],
  );
  const previousShiftId = prev.rows[0]?.shift_id ?? null;

  let winner: WinnerPerson | null = null;
  if (previousShiftId !== null) {
    const w = await pool.query<WinnerPerson>(
      `SELECT u.id AS user_id, u.f_name, u.m_name, u.l_name
       FROM achievements a
       JOIN settings s ON s.id = a.setting_id
       JOIN user_main u ON u.id = a.user_id
       WHERE s.name = 'reality_winner' AND a.amount > 0 AND a.shift_id = $1
       LIMIT 1`,
      [previousShiftId],
    );
    winner = w.rows[0] ?? null;
  }

  const sparksById = new Map(
    (await getRanking(false)).map((r) => [r.user_id, r.sparks]),
  );
  const ranked = members
    .map((m) => ({ ...m, sparks: sparksById.get(m.user_id) ?? 0 }))
    .sort((a, b) => b.sparks - a.sparks || a.l_name.localeCompare(b.l_name));

  const winnerInList =
    winner !== null && ranked.some((m) => m.user_id === winner!.user_id);

  const numbers: GeneratedNumber[] = [];
  if (winnerInList) {
    const w = ranked.find((m) => m.user_id === winner!.user_id)!;
    numbers.push({ number: 1, ...w, is_prev_winner: true });
  }
  let n = 2;
  for (const m of ranked) {
    if (winnerInList && m.user_id === winner!.user_id) continue;
    numbers.push({ number: n++, ...m, is_prev_winner: false });
  }

  const ages = members.map((m) => m.age).filter((a): a is number => a != null);
  const averageAge =
    ages.length > 0
      ? Math.round((ages.reduce((s, a) => s + a, 0) / ages.length) * 10) / 10
      : null;

  return {
    shift_id,
    previous_shift_id: previousShiftId,
    winner,
    winner_in_list: winnerInList,
    numbers,
    created,
    reused,
    skipped,
    credentials,
    average_age: averageAge,
  };
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
       SELECT ROUND(1 + (1 - EXP(-0.03 * (
         COALESCE(
           (SELECT person_count_override FROM shift_info WHERE shift_id = $1),
           (SELECT COUNT(*) FROM shift_members WHERE shift_id = $1)
         ) - 10))), 2) AS d
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
    difficulty: difficulty(
      meta.rows[0].person_count_override ?? meta.rows[0].child_count,
    ),
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
     JOIN shift_info si ON si.shift_id = a.shift_id
     WHERE st.name IN ('reality_winner', 'reality_finalist') AND a.amount > 0
       -- Aggregate shifts (the pre-83 archive) are not real reality-show finals.
       AND si.person_count_override IS NULL
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

// Person-of-day log as a flat list ordered by day number (the value from the
// source table). Each day names its shift and the child(ren) of that day — some
// days have two.
export async function getPeopleOfDay(): Promise<PersonOfDayEntry[]> {
  const { rows } = await pool.query<{
    day_number: number;
    shift_id: number;
    date: string;
    user_id: string;
    f_name: string;
    m_name: string | null;
    l_name: string;
  }>(
    `SELECT p.day_number, p.shift_id, p.date::text,
            u.id AS user_id, u.f_name, u.m_name, u.l_name
     FROM people_of_the_day p
     JOIN user_main u ON u.id = p.user_id
     ORDER BY p.day_number, p.shift_id, u.l_name, u.f_name`,
  );

  // Keyed by day+shift: a day number can recur across shifts (source quirk on
  // shift 120), so those stay separate rows rather than merging.
  const days = new Map<string, PersonOfDayEntry>();
  for (const r of rows) {
    const key = `${r.day_number}-${r.shift_id}`;
    let d = days.get(key);
    if (!d) {
      d = {
        day_number: r.day_number,
        date: r.date,
        shift_id: r.shift_id,
        people: [],
      };
      days.set(key, d);
    }
    d.people.push({
      user_id: r.user_id,
      f_name: r.f_name,
      m_name: r.m_name,
      l_name: r.l_name,
    });
  }
  return [...days.values()];
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
