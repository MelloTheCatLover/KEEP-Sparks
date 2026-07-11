import { readFileSync, writeFileSync } from "node:fs";
import { pool } from "../config/db";

// One-off importer for the consolidated child-info dataset produced by
// old_data/consolidate_child_info.py from the freeform "Вся инфа по детям"
// sheet. Admin/internal data only — never surfaced in Sparks.
//
// Usage: npm run import-child-info -- <jsonPath>
//
// Matches an existing child by surname + first name (the same key
// import-shift.ts uses). For each matched kid it upserts user_pers_info and
// fully replaces user_parents_info + user_allergy. Records flagged
// `real_duplicate` (two different kids share a name in the source) are skipped
// and reported — a human must split them first. Idempotent: re-running yields
// the same DB state. A report of unmatched rows is written next to the JSON.

interface ParentRec {
  l_name: string;
  f_name: string;
  m_name: string;
  phone_number_1: string | null;
  phone_number_2: string | null;
}

interface ChildRec {
  l_name: string;
  f_name: string;
  m_name: string;
  gender: string;
  dob: string;
  height: number | null;
  allergy_items: string[];
  parents: ParentRec[];
  flags: string[];
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

async function run(): Promise<void> {
  const [jsonPath] = process.argv.slice(2);
  if (!jsonPath) {
    throw new Error("Usage: npm run import-child-info -- <jsonPath>");
  }

  const { children } = JSON.parse(readFileSync(jsonPath, "utf8")) as {
    children: ChildRec[];
  };

  const client = await pool.connect();
  const report: string[] = [];
  const skippedDup: string[] = [];
  const unmatched: string[] = [];
  const noPers: string[] = [];
  let matched = 0;
  let persWritten = 0;
  let parentsWritten = 0;
  let allergiesWritten = 0;

  try {
    await client.query("BEGIN");

    // Every DB child, keyed by "last\tfirst". A key with >1 row is ambiguous
    // and disambiguated by patronymic where possible.
    const dbRows = (
      await client.query<{ id: string; l_name: string; f_name: string; m_name: string | null }>(
        "SELECT id, l_name, f_name, m_name FROM user_main WHERE role = 'child'",
      )
    ).rows;
    const byName = new Map<string, typeof dbRows>();
    for (const r of dbRows) {
      const key = `${r.l_name}\t${r.f_name}`;
      (byName.get(key) ?? byName.set(key, []).get(key)!).push(r);
    }
    const touched = new Set<string>();

    for (const c of children) {
      const full = `${c.l_name} ${c.f_name} ${c.m_name}`.trim();

      if (c.flags.includes("real_duplicate")) {
        skippedDup.push(full);
        continue;
      }

      const candidates = byName.get(`${c.l_name}\t${c.f_name}`);
      if (!candidates || candidates.length === 0) {
        unmatched.push(full);
        continue;
      }
      // Prefer an exact patronymic match when the name is shared.
      const chosen =
        candidates.length === 1
          ? candidates[0]
          : candidates.find((r) => (r.m_name ?? "") === c.m_name) ?? candidates[0];
      const userId = chosen.id;
      touched.add(userId);
      matched++;

      // Backfill patronymic if the account is missing one.
      if (!chosen.m_name && c.m_name) {
        await client.query("UPDATE user_main SET m_name = $2 WHERE id = $1", [
          userId,
          c.m_name,
        ]);
      }

      // Personal info — only when the three required fields are present.
      if (c.gender && ISO_DATE.test(c.dob) && c.height && c.height > 0) {
        await client.query(
          `INSERT INTO user_pers_info (user_id, gender, date_of_birth, height)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (user_id) DO UPDATE
             SET gender = EXCLUDED.gender,
                 date_of_birth = EXCLUDED.date_of_birth,
                 height = EXCLUDED.height`,
          [userId, c.gender, c.dob, c.height],
        );
        persWritten++;
      } else {
        noPers.push(`${full} (gender=${c.gender} dob=${c.dob} h=${c.height})`);
      }

      // Parents — replace wholesale (idempotent).
      await client.query("DELETE FROM user_parents_info WHERE user_id = $1", [userId]);
      for (const p of c.parents) {
        if (!p.l_name || !p.f_name || !p.phone_number_1) continue;
        await client.query(
          `INSERT INTO user_parents_info
             (user_id, f_name, m_name, l_name, phone_number_1, phone_number_2)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [userId, p.f_name, p.m_name || null, p.l_name, p.phone_number_1, p.phone_number_2],
        );
        parentsWritten++;
      }

      // Allergy items — replace wholesale.
      await client.query("DELETE FROM user_allergy WHERE user_id = $1", [userId]);
      for (const item of c.allergy_items) {
        await client.query(
          "INSERT INTO user_allergy (user_id, item) VALUES ($1, $2)",
          [userId, item],
        );
        allergiesWritten++;
      }
    }

    // DB children with no info row in the sheet.
    const dbOnly = dbRows
      .filter((r) => !touched.has(r.id))
      .map((r) => `${r.l_name} ${r.f_name} ${r.m_name ?? ""}`.trim())
      .sort();

    await client.query("COMMIT");

    report.push(`# Импорт инфо по детям\n`);
    report.push(
      `Совпало с БД: ${matched} | pers_info: ${persWritten} | родителей: ${parentsWritten} | аллергий: ${allergiesWritten}\n`,
    );
    report.push(`\n## Пропущено (разные дети под одним именем) — ${skippedDup.length}\n`);
    report.push(...skippedDup.map((x) => `- ${x}`));
    report.push(`\n## В таблице, но нет в БД (до 83 смены / опечатки) — ${unmatched.length}\n`);
    report.push(...unmatched.sort().map((x) => `- ${x}`));
    report.push(`\n## В БД, но нет инфо в таблице — ${dbOnly.length}\n`);
    report.push(...dbOnly.map((x) => `- ${x}`));
    report.push(`\n## Совпали, но без pers_info (нет пола/даты/роста) — ${noPers.length}\n`);
    report.push(...noPers.map((x) => `- ${x}`));

    const reportPath = jsonPath.replace(/[^/]+$/, "child_info_import_report.md");
    writeFileSync(reportPath, report.join("\n") + "\n");
    console.log(
      `matched ${matched}, pers ${persWritten}, parents ${parentsWritten}, ` +
        `allergies ${allergiesWritten}; skipped dup ${skippedDup.length}, ` +
        `unmatched ${unmatched.length}, db-only ${dbOnly.length} -> ${reportPath}`,
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
