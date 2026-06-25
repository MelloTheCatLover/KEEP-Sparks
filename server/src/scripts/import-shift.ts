import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import bcrypt from "bcryptjs";
import { pool } from "../config/db";

// One-off importer for the old per-shift XP JSON (old_data/xp/player_xp_*.json).
// Brings in COUNTS only — sparks are recomputed by the calculator, never copied
// from the JSON's precomputed totals.
//
// Usage: npm run import-shift -- <jsonPath> <shiftId> <startDate> <endDate>
//
// Idempotent: children are matched by full name (reused across shifts);
// achievements upsert on (user_id, shift_id, setting_id). Generated logins and
// passwords for newly created children are written to a CSV next to the JSON.

// COUNT_* key in the JSON -> settings.name in the catalogue.
const COUNT_TO_SETTING: Record<string, string> = {
  COUNT_Победитель_реалити: "reality_winner",
  COUNT_Суперфиналист: "reality_super_finalist",
  COUNT_Финалист: "reality_finalist",
  COUNT_Вклад_в_сюжет: "reality_plot",
  "COUNT_лучший_реалити-шоу": "reality_leader",
  "COUNT_Победитель КТП": "kgg_winner",
  COUNT_MVP_КТП: "kgg_mvp",
  COUNT_кубок: "kgg_cup",
  COUNT_Победитель_КТБ: "ktb_winner",
  COUNT_Лучший_в_команде_КТБ: "ktb_team_best",
  COUNT_Победитель_этапа: "ktb_stage",
  COUNT_Человек_дня: "person_of_day",
  COUNT_Человек_смены: "person_of_shift",
  COUNT_Признание_руководителя: "recognition",
  COUNT_Дней: "day",
  COUNT_Победитель_Звезды: "stars_winner",
  COUNT_Финалист_Звезды: "stars_finalist",
};

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
  [key: string]: string | number;
}

async function run(): Promise<void> {
  const [jsonPath, shiftIdArg, startDate, endDate] = process.argv.slice(2);
  if (!jsonPath || !shiftIdArg || !startDate || !endDate) {
    throw new Error(
      "Usage: npm run import-shift -- <jsonPath> <shiftId> <startDate> <endDate>",
    );
  }
  const shiftId = Number(shiftIdArg);

  const data = JSON.parse(readFileSync(jsonPath, "utf8")) as {
    players: Player[];
  };

  const client = await pool.connect();
  const credentials: string[] = ["login,password,fio"];
  try {
    await client.query("BEGIN");

    // Settings name -> id.
    const settings = await client.query<{ id: number; name: string }>(
      "SELECT id, name FROM settings",
    );
    const settingId = new Map(settings.rows.map((r) => [r.name, r.id]));

    // Existing logins, to avoid collisions.
    const existingLogins = new Set<string>(
      (
        await client.query<{ login: string }>("SELECT login FROM user_main")
      ).rows.map((r) => r.login),
    );

    // Create the shift if missing; never clobber existing dates (the schedule
    // seed owns them).
    await client.query(
      `INSERT INTO shift_info (shift_id, start_date, end_date)
       VALUES ($1, $2, $3)
       ON CONFLICT (shift_id) DO NOTHING`,
      [shiftId, startDate, endDate],
    );

    let created = 0;
    let reused = 0;
    for (const p of data.players) {
      const [lName, fName, ...mid] = p.fio.trim().split(/\s+/);
      const mName = mid.length ? mid.join(" ") : null;

      // Match an existing child by surname + first name (same kid across
      // shifts). Patronymic is unreliable — present in some shifts, missing in
      // others — so it is not part of the match; a missing one is backfilled.
      const matches = await client.query<{ id: string; m_name: string | null }>(
        `SELECT id, m_name FROM user_main
         WHERE l_name = $1 AND f_name = $2 AND role = 'child'`,
        [lName, fName],
      );

      let userId: string;
      if (matches.rows.length > 0) {
        const exact = matches.rows.find(
          (r) => (r.m_name ?? "") === (mName ?? ""),
        );
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
        userId = ins.rows[0].id;
        credentials.push(`${login},${password},"${p.fio}"`);
        created++;
      }

      // Roster membership for every listed player, even all-zero ones.
      await client.query(
        `INSERT INTO shift_members (shift_id, user_id) VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [shiftId, userId],
      );

      // Achievements from the counts (amount > 0 only).
      for (const [countKey, settingName] of Object.entries(COUNT_TO_SETTING)) {
        const amount = Number(p[countKey] ?? 0);
        if (!amount) continue;
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
    }

    await client.query("COMMIT");

    const credPath = jsonPath.replace(/[^/]+$/, `credentials_${shiftId}.csv`);
    if (credentials.length > 1) writeFileSync(credPath, credentials.join("\n"));
    console.log(
      `shift ${shiftId}: ${created} created, ${reused} reused` +
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
