import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { ApiError } from "../../shared/api/client";
import { festivalApi } from "./festival-api";
import { numberColor } from "./format";
import type { FestivalBallot } from "./types";
import "./festival-screen.css";

// Финальное голосование зала. Зритель наводит камеру на QR с экрана, выбирает
// одного финалиста, подтверждает — и всё. Никакого входа: имени у голоса нет,
// в базу уходит только номер и ключ устройства.
//
// Страница живёт на телефоне и в том же оформлении, что экран показа: человек
// пришёл сюда прямо с него и должен узнать зал, а не попасть в другой сайт.

// Ключ устройства. Он же признак «отсюда уже голосовали»: сервер вернёт 409,
// но и локально второй бюллетень открывать незачем.
const DEVICE_KEY = "festival_vote_device";
const VOTED_KEY = "festival_voted_";

function deviceId(): string {
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

export function VotePage() {
  const { slug = "" } = useParams();
  const [ballot, setBallot] = useState<FestivalBallot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chosen, setChosen] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(() => !!localStorage.getItem(VOTED_KEY + slug));

  useEffect(() => {
    let active = true;
    festivalApi
      .ballot(slug)
      .then((b) => active && setBallot(b))
      .catch(() => active && setError("Голосование не найдено"));
    return () => {
      active = false;
    };
  }, [slug]);

  async function submit(): Promise<void> {
    if (chosen === null) return;
    setBusy(true);
    setError(null);
    try {
      await festivalApi.vote(slug, chosen, deviceId());
      localStorage.setItem(VOTED_KEY + slug, String(chosen));
      setDone(true);
    } catch (err) {
      // «Уже голосовали» — не ошибка для зрителя: голос учтён, экран тот же.
      if (err instanceof ApiError && err.status === 409) {
        if (err.message.includes("телефона")) {
          localStorage.setItem(VOTED_KEY + slug, String(chosen));
          setDone(true);
        } else {
          setError(err.message);
        }
      } else {
        setError(err instanceof ApiError ? err.message : "Голос не отправился");
      }
    } finally {
      setBusy(false);
    }
  }

  if (error && !ballot) return <div className="fest-empty">{error}</div>;
  if (!ballot) return <div className="fest-empty">Загрузка…</div>;

  return (
    <div className="fest fest--vote">
      <header className="fest-head">
        <h1 className="fest-title">{ballot.title}</h1>
        <div className="fest-rule" />
      </header>

      {done ? (
        <div className="fest-vote-done">
          <div className="fest-vote-check" aria-hidden>
            ✓
          </div>
          <div className="fest-vote-lead">Голос принят</div>
          <div className="fest-vote-sub">Спасибо! Результат объявят со сцены.</div>
        </div>
      ) : !ballot.voting_open ? (
        <div className="fest-vote-done">
          <div className="fest-vote-lead">Голосование ещё не открыто</div>
          <div className="fest-vote-sub">
            Дождитесь объявления — страницу можно не закрывать.
          </div>
        </div>
      ) : (
        <div className="fest-vote">
          <div className="fest-vote-lead">Выберите одного</div>
          <div className="fest-vote-list">
            {ballot.candidates.map((c) => {
              const color = numberColor(c.color, c.team);
              return (
                <button
                  key={c.participant_id}
                  onClick={() => setChosen(c.participant_id)}
                  style={{ borderColor: color }}
                  className={
                    "fest-cand" +
                    (chosen === c.participant_id ? " fest-cand--on" : "")
                  }
                >
                  <span className="fest-cand-num" style={{ background: color }}>
                    {c.number}
                  </span>
                  <span className="fest-cand-who">
                    <span className="fest-cand-name">{c.name}</span>
                    {c.team && <span className="fest-cand-team">{c.team}</span>}
                  </span>
                  <span className="fest-cand-tick" aria-hidden>
                    {chosen === c.participant_id ? "✓" : ""}
                  </span>
                </button>
              );
            })}
            {ballot.candidates.length === 0 && (
              <div className="fest-vote-sub">Финалистов пока не объявили.</div>
            )}
          </div>

          {error && <div className="fest-vote-error">{error}</div>}

          <button
            className="fest-vote-go"
            disabled={chosen === null || busy}
            onClick={() => void submit()}
          >
            {busy ? "Отправляю…" : "Подтвердить"}
          </button>
        </div>
      )}
    </div>
  );
}
