import { readFileSync, writeFileSync } from "node:fs";
import { pool } from "../config/db";
import * as festival from "../services/festival-service";
import { FestivalRosterRow } from "../types/festival";

// Готовая гонка фестиваля под 22 номера: участники, их судьи и коды входа.
// Ставится и на репетицию, и перед самим фестивалем — руками вбивать 22 строки
// в админке незачем.
//
// Usage: npm run seed-festival -- <slug> [--count 22] [--title "Фестиваль"]
//                                [--laps 3] [--stations 6] [--reset]
//                                [--names <file>] [--csv <file>]
//
// `--names` — файл со строками «ФИ; команда; судья» (по строке на номер, номер
// = порядок строки). Чего нет в файле, дописывается заглушкой.
// `--reset` — переиспользовать гонку с этим slug: стереть результаты и выдать
// новый ростер с новыми кодами. Без него существующий slug — ошибка.

const TEAMS = ["Красные", "Синие", "Зелёные", "Жёлтые"];

interface Options {
  slug: string;
  title: string;
  laps: number;
  stations: number;
  count: number;
  reset: boolean;
  namesFile: string | null;
  csvFile: string | null;
}

function parseArgs(argv: string[]): Options {
  const [slug, ...rest] = argv;
  if (!slug || slug.startsWith("--")) {
    throw new Error(
      "Usage: npm run seed-festival -- <slug> [--count 22] [--title ...] " +
        "[--laps 3] [--stations 6] [--reset] [--names <file>] [--csv <file>]",
    );
  }

  const opts: Options = {
    slug,
    title: "Фестиваль",
    laps: 3,
    stations: 6,
    count: 22,
    reset: false,
    namesFile: null,
    csvFile: null,
  };

  for (let i = 0; i < rest.length; i++) {
    const flag = rest[i];
    const value = rest[i + 1];
    switch (flag) {
      case "--reset":
        opts.reset = true;
        break;
      case "--title":
        opts.title = value;
        i++;
        break;
      case "--laps":
        opts.laps = Number(value);
        i++;
        break;
      case "--stations":
        opts.stations = Number(value);
        i++;
        break;
      case "--count":
        opts.count = Number(value);
        i++;
        break;
      case "--names":
        opts.namesFile = value;
        i++;
        break;
      case "--csv":
        opts.csvFile = value;
        i++;
        break;
      default:
        throw new Error(`Unknown flag: ${flag}`);
    }
  }
  return opts;
}

// Строка файла: «ФИ; команда; судья». Пустые поля допустимы — заполнятся сами.
function readNames(path: string): string[][] {
  return readFileSync(path, "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "")
    .map((line) => line.split(/[;\t]/).map((part) => part.trim()));
}

function buildRoster(opts: Options): FestivalRosterRow[] {
  const given = opts.namesFile ? readNames(opts.namesFile) : [];
  return Array.from({ length: opts.count }, (_, i) => {
    const row = given[i] ?? [];
    return {
      number: i + 1,
      name: row[0] || `Участник ${i + 1}`,
      team: row[1] || TEAMS[i % TEAMS.length],
      judge_name: row[2] || `Судья ${i + 1}`,
    };
  });
}

async function run(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  if (!Number.isInteger(opts.count) || opts.count < 1) {
    throw new Error("--count must be a positive integer");
  }

  const existing = (await festival.listRaces()).find((r) => r.slug === opts.slug);
  if (existing && !opts.reset) {
    throw new Error(
      `Гонка со slug '${opts.slug}' уже есть (id ${existing.id}). ` +
        "Добавьте --reset, чтобы стереть её результаты и выдать новый ростер.",
    );
  }

  const race = existing
    ? (await festival.resetRace(existing.id)).race
    : await festival.createRace({
        title: opts.title,
        slug: opts.slug,
        laps: opts.laps,
        stations: opts.stations,
      });

  const board = await festival.setRoster(race.id, buildRoster(opts));

  const lines = board.participants.map((p) => {
    const judge = board.judges.find((j) => j.participant_id === p.id);
    return {
      number: p.number,
      name: p.name,
      team: p.team ?? "",
      judge: judge?.name ?? "",
      pin: judge?.pin ?? "",
    };
  });

  console.log(
    `${race.title} (slug '${race.slug}', id ${race.id}): ${race.laps} круга по ` +
      `${race.stations} рубежей, участников ${lines.length}`,
  );
  console.log("");
  console.log("№   Участник              Команда     Судья                 Код");
  for (const l of lines) {
    console.log(
      String(l.number).padEnd(4) +
        l.name.padEnd(22) +
        l.team.padEnd(12) +
        l.judge.padEnd(22) +
        l.pin,
    );
  }
  console.log("");
  console.log(`Экран показа:  /festival/screen/${race.slug}`);
  console.log("Судьи входят:  /festival/judge (каждый вводит свой код)");
  console.log("Старт гонки — кнопкой в /admin/festival.");

  if (opts.csvFile) {
    const csv = [
      "Номер;Участник;Команда;Судья;Код",
      ...lines.map((l) => [l.number, l.name, l.team, l.judge, l.pin].join(";")),
    ].join("\n");
    // BOM — иначе Excel открывает кириллицу кракозябрами.
    writeFileSync(opts.csvFile, "﻿" + csv, "utf8");
    console.log(`CSV с кодами: ${opts.csvFile}`);
  }
}

run()
  .then(() => pool.end())
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    pool.end().finally(() => process.exit(1));
  });
