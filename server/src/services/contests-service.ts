import { pool } from "../config/db";
import {
  ContestPerson,
  ContestsBoard,
  KtbStatus,
  KtpStatus,
} from "../types/contests";

// КТП (КГГ) shifts and КТБ shifts, fixed by the programme leads. КТБ is a
// superset: it ran on 84, 101 and 119 where КТП did not.
export const KTP_SHIFT_IDS = [90, 94, 96, 99, 107, 111, 113, 117, 124, 128];
export const KTB_SHIFT_IDS = [
  84, 90, 94, 96, 99, 101, 107, 111, 113, 117, 119, 124, 128,
];

// The achievement settings that decide a contest status.
const KTP_KEYS = ["kgg_winner", "kgg_mvp", "kgg_cup"] as const;
const KTB_KEYS = ["ktb_winner", "ktb_stage", "ktb_team_best"] as const;
export const CONTEST_KEYS = [...KTP_KEYS, ...KTB_KEYS];

// Best КТП status from what a child has done: MVP > winner > participant > new.
// `attended` is whether they were on any КТП shift's roster in the window.
export function ktpStatus(
  counts: Record<string, number>,
  attended: boolean,
): KtpStatus {
  if ((counts.kgg_mvp ?? 0) > 0) return "mvp";
  if ((counts.kgg_winner ?? 0) > 0) return "winner";
  if (attended || (counts.kgg_cup ?? 0) > 0) return "participant";
  return "new";
}

// Best КТБ status: лучший в команде > победа > участник > новенький.
export function ktbStatus(
  counts: Record<string, number>,
  attended: boolean,
): KtbStatus {
  if ((counts.ktb_team_best ?? 0) > 0) return "team_best";
  if ((counts.ktb_winner ?? 0) > 0) return "winner";
  if (attended || (counts.ktb_stage ?? 0) > 0) return "participant";
  return "new";
}

// All-time КТП/КТБ board: every child who ever sat on a contest shift or holds a
// contest achievement, with their best status and the shift lists behind it.
export async function getBoard(): Promise<ContestsBoard> {
  const { rows } = await pool.query<{
    user_id: string;
    f_name: string;
    m_name: string | null;
    l_name: string;
    ktp_shifts: number[];
    ktb_shifts: number[];
    counts: Record<string, number>;
  }>(
    `WITH member_shifts AS (
       SELECT m.user_id,
              array_agg(DISTINCT m.shift_id) FILTER (
                WHERE m.shift_id = ANY($1::int[])) AS ktp_shifts,
              array_agg(DISTINCT m.shift_id) FILTER (
                WHERE m.shift_id = ANY($2::int[])) AS ktb_shifts
       FROM shift_members m
       WHERE m.shift_id = ANY($1::int[]) OR m.shift_id = ANY($2::int[])
       GROUP BY m.user_id
     ),
     achieved AS (
       SELECT a.user_id,
              jsonb_object_agg(st.name, tot) AS counts
       FROM (
         SELECT a.user_id, a.setting_id, SUM(a.amount) AS tot
         FROM achievements a
         GROUP BY a.user_id, a.setting_id
       ) a
       JOIN settings st ON st.id = a.setting_id
       WHERE st.name = ANY($3::text[]) AND a.tot > 0
       GROUP BY a.user_id
     ),
     ids AS (
       SELECT user_id FROM member_shifts
       UNION
       SELECT user_id FROM achieved
     )
     SELECT u.id AS user_id, u.f_name, u.m_name, u.l_name,
            COALESCE(ms.ktp_shifts, '{}') AS ktp_shifts,
            COALESCE(ms.ktb_shifts, '{}') AS ktb_shifts,
            COALESCE(ac.counts, '{}'::jsonb) AS counts
     FROM ids
     JOIN user_main u ON u.id = ids.user_id
     LEFT JOIN member_shifts ms ON ms.user_id = ids.user_id
     LEFT JOIN achieved ac ON ac.user_id = ids.user_id
     ORDER BY u.l_name, u.f_name`,
    [KTP_SHIFT_IDS, KTB_SHIFT_IDS, CONTEST_KEYS],
  );

  const people: ContestPerson[] = rows.map((r) => {
    const ktp_shifts = [...r.ktp_shifts].sort((a, b) => a - b);
    const ktb_shifts = [...r.ktb_shifts].sort((a, b) => a - b);
    return {
      user_id: r.user_id,
      f_name: r.f_name,
      m_name: r.m_name,
      l_name: r.l_name,
      ktp_shifts,
      ktb_shifts,
      counts: r.counts,
      ktp_status: ktpStatus(r.counts, ktp_shifts.length > 0),
      ktb_status: ktbStatus(r.counts, ktb_shifts.length > 0),
    };
  });

  return {
    ktp_shift_ids: KTP_SHIFT_IDS,
    ktb_shift_ids: KTB_SHIFT_IDS,
    people,
  };
}

// Contest status of each roster member *as they arrived* at a shift: computed
// only from contest shifts and achievements strictly before this one, so a child
// on their first КТП shift reads "new". Keyed by user_id, for members of the
// given shift. Used to tag the shift's roster.
export async function getShiftStatuses(
  shiftId: number,
): Promise<Map<string, { ktp: KtpStatus; ktb: KtbStatus }>> {
  const { rows } = await pool.query<{
    user_id: string;
    prior_ktp: boolean;
    prior_ktb: boolean;
    counts: Record<string, number>;
  }>(
    `WITH members AS (
       SELECT user_id FROM shift_members WHERE shift_id = $1
     ),
     prior AS (
       SELECT m.user_id,
              bool_or(sm.shift_id = ANY($2::int[])) AS prior_ktp,
              bool_or(sm.shift_id = ANY($3::int[])) AS prior_ktb
       FROM members m
       JOIN shift_members sm
         ON sm.user_id = m.user_id AND sm.shift_id < $1
       GROUP BY m.user_id
     ),
     achieved AS (
       SELECT m.user_id,
              jsonb_object_agg(st.name, tot) AS counts
       FROM members m
       JOIN (
         SELECT a.user_id, a.setting_id, SUM(a.amount) AS tot
         FROM achievements a
         WHERE a.shift_id < $1
         GROUP BY a.user_id, a.setting_id
       ) a ON a.user_id = m.user_id
       JOIN settings st ON st.id = a.setting_id
       WHERE st.name = ANY($4::text[]) AND a.tot > 0
       GROUP BY m.user_id
     )
     SELECT m.user_id,
            COALESCE(p.prior_ktp, false) AS prior_ktp,
            COALESCE(p.prior_ktb, false) AS prior_ktb,
            COALESCE(ac.counts, '{}'::jsonb) AS counts
     FROM members m
     LEFT JOIN prior p ON p.user_id = m.user_id
     LEFT JOIN achieved ac ON ac.user_id = m.user_id`,
    [shiftId, KTP_SHIFT_IDS, KTB_SHIFT_IDS, CONTEST_KEYS],
  );

  const map = new Map<string, { ktp: KtpStatus; ktb: KtbStatus }>();
  for (const r of rows) {
    map.set(r.user_id, {
      ktp: ktpStatus(r.counts, r.prior_ktp),
      ktb: ktbStatus(r.counts, r.prior_ktb),
    });
  }
  return map;
}
