import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import bcrypt from "bcryptjs";
import { pool } from "../config/db";

// One-off importer for the pre-107 history distilled from the old "Общий
// Рейтинг" spreadsheet (old_data/rating_residual.json, built by the analysis).
//
// The 107+ shifts are already in the DB (import-shift). The spreadsheet's
// aggregates include them, so the residual JSON already has the 107+ part
// subtracted out — what remains is the ≤102 history. Bringing in COUNTS only;
// sparks are recomputed by the calculator.
//
//   days   -> per-shift `day` achievement + shift_members (exact, from columns)
//   counts -> reality_winner / reality_super_finalist / person_of_day /
//             person_of_shift, lumped on the child's earliest pre-107 shift
//             (the spreadsheet aggregates them, so per-shift split is lost; the
//             per-child totals stay exact and reconcile with the rating)
//   person_of_shift_by_shift -> shift_info.person_of_the_shift (every shift)
//
// Usage: npm run import-rating -- <jsonPath>
// Idempotent: children matched by surname+first name; achievements upsert on
// (user_id, shift_id, setting_id); members upsert; generated credentials for
// newly created children are written to a CSV next to the JSON.

const TRANSLIT: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z",
  и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r",
  с: "s", т: "t", у: "u", ф: "f", х: "kh", ц: "ts", ч: "ch", ш: "sh",
  щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

function translit(s: string): string {
  return [...s.toLowerCase()].map((c) => TRANSLIT[c] ?? c).join("");
}

interface Player {
  fio: string;
  days: Record<string, number>;
  rep_shift: number;
  counts: Record<string, number>;
}

interface ResidualFile {
  person_of_shift_by_shift: Record<string, string>;
  players: Player[];
}

async function run(): Promise<void> {
  const [jsonPath] = process.argv.slice(2);
  if (!jsonPath) {
    throw new Error("Usage: npm run import-rating -- <jsonPath>");
  }

  const data = JSON.parse(readFileSync(jsonPath, "utf8")) as ResidualFile;

  const client = await pool.connect();
  const credentials: string[] = ["login,password,fio"];
  try {
    await client.query("BEGIN");

    const settings = await client.query<{ id: number; name: string }>(
      "SELECT id, name FROM settings",
    );
    const settingId = new Map(settings.rows.map((r) => [r.name, r.id]));
    const dayId = settingId.get("day");
    if (dayId === undefined) throw new Error("Missing setting 'day' — seed it");

    const existingLogins = new Set<string>(
      (
        await client.query<{ login: string }>("SELECT login FROM user_main")
      ).rows.map((r) => r.login),
    );

    // Resolve a child by surname + first name, creating one if absent.
    // Returns the user id. Mirrors import-shift's matching rules.
    async function resolveChild(fio: string): Promise<string> {
      const [lName, fName, ...mid] = fio.trim().split(/\s+/);
      const mName = mid.length ? mid.join(" ") : null;

      const matches = await client.query<{ id: string; m_name: string | null }>(
        `SELECT id, m_name FROM user_main
         WHERE l_name = $1 AND f_name = $2 AND role = 'child'`,
        [lName, fName],
      );
      if (matches.rows.length > 0) {
        const exact = matches.rows.find(
          (r) => (r.m_name ?? "") === (mName ?? ""),
        );
        const chosen = exact ?? matches.rows[0];
        if (!chosen.m_name && mName) {
          await client.query("UPDATE user_main SET m_name = $2 WHERE id = $1", [
            chosen.id,
            mName,
          ]);
        }
        return chosen.id;
      }

      let login = `${translit(lName)}.${translit(fName)}`.replace(
        /[^a-z0-9.]/g,
        "",
      );
      let candidate = login;
      let n = 1;
      while (existingLogins.has(candidate)) candidate = `${login}${++n}`;
      login = candidate;
      existingLogins.add(login);

      const password = randomBytes(6).toString("base64url");
      const passwd = await bcrypt.hash(password, 10);
      const ins = await client.query<{ id: string }>(
        `INSERT INTO user_main (f_name, m_name, l_name, login, passwd, role)
         VALUES ($1, $2, $3, $4, $5, 'child') RETURNING id`,
        [fName, mName, lName, login, passwd],
      );
      credentials.push(`${login},${password},"${fio}"`);
      return ins.rows[0].id;
    }

    async function addMember(shiftId: number, userId: string): Promise<void> {
      await client.query(
        `INSERT INTO shift_members (shift_id, user_id) VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [shiftId, userId],
      );
    }

    async function upsertAchievement(
      userId: string,
      shiftId: number,
      settingName: string,
      amount: number,
    ): Promise<void> {
      const sid = settingId.get(settingName);
      if (sid === undefined) {
        throw new Error(`Missing setting '${settingName}' — seed it first`);
      }
      await client.query(
        `INSERT INTO achievements (user_id, shift_id, setting_id, amount)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id, shift_id, setting_id)
           DO UPDATE SET amount = EXCLUDED.amount`,
        [userId, shiftId, sid, amount],
      );
    }

    let created = credentials.length;
    for (const p of data.players) {
      const before = credentials.length;
      const userId = await resolveChild(p.fio);
      if (credentials.length > before) created++;

      // Per-shift days: roster + the `day` achievement.
      for (const [shiftStr, days] of Object.entries(p.days)) {
        const shiftId = Number(shiftStr);
        await addMember(shiftId, userId);
        await upsertAchievement(userId, shiftId, "day", days);
      }

      // Aggregate counts on the representative pre-107 shift.
      if (Object.keys(p.counts).length > 0) {
        await addMember(p.rep_shift, userId);
        for (const [settingName, amount] of Object.entries(p.counts)) {
          if (amount > 0) {
            await upsertAchievement(userId, p.rep_shift, settingName, amount);
          }
        }
      }
    }

    // Person of the shift (display metadata) for every shift that has one.
    let posSet = 0;
    for (const [shiftStr, fio] of Object.entries(
      data.person_of_shift_by_shift,
    )) {
      const [lName, fName] = fio.trim().split(/\s+/);
      const m = await client.query<{ id: string }>(
        `SELECT id FROM user_main
         WHERE l_name = $1 AND f_name = $2 AND role = 'child' LIMIT 1`,
        [lName, fName],
      );
      if (m.rows.length > 0) {
        await client.query(
          "UPDATE shift_info SET person_of_the_shift = $2 WHERE shift_id = $1",
          [Number(shiftStr), m.rows[0].id],
        );
        posSet++;
      } else {
        console.warn(`person_of_shift ${shiftStr}: no child '${fio}'`);
      }
    }

    await client.query("COMMIT");

    const credPath = jsonPath.replace(/[^/]+$/, "credentials_rating.csv");
    if (credentials.length > 1) writeFileSync(credPath, credentials.join("\n"));
    console.log(
      `rating import: ${data.players.length} players, ${created - 1} created, ` +
        `${posSet} person-of-shift set` +
        (credentials.length > 1 ? `, credentials -> ${credPath}` : ""),
    );
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

run()
  .then(() => pool.end())
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    pool.end().finally(() => process.exit(1));
  });
