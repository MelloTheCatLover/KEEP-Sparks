import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { api } from "../api/client";
import "../../design-system/festive.css";

const CONFETTI_COLORS = ["#f0a92e", "#e0567a", "#5bd0c8", "#8b7cf6", "#f6eef8"];

// Ленты конфетти: полоса, задержка и скорость разные у каждой, иначе они падают
// строем.
function Confetti() {
  const pieces = Array.from({ length: 14 }, (_, i) => ({
    left: `${(i * 7.3 + (i % 3) * 4) % 100}%`,
    delay: `${(i % 7) * 1.1}s`,
    duration: `${6 + ((i * 3) % 5)}s`,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
  }));

  return (
    <div className="festive-confetti" aria-hidden>
      {pieces.map((p, i) => (
        <span
          key={i}
          style={
            {
              left: p.left,
              background: p.color,
              animationDelay: p.delay,
              animationDuration: p.duration,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}

// Праздничное оформление всего сайта. Включает его сервер: дата праздника
// живёт в смене-событии и считается по лагерной таймзоне, а не по часам
// устройства — иначе ребёнок с перекрученным телефоном увидел бы праздник не в
// тот день.
export function Festive() {
  const [on, setOn] = useState(false);

  useEffect(() => {
    let active = true;
    api
      .get<{ festive: boolean }>("/settings/festive")
      .then((r) => active && setOn(r.festive))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (on) root.dataset.festive = "1";
    else delete root.dataset.festive;
    return () => {
      delete root.dataset.festive;
    };
  }, [on]);

  return on ? <Confetti /> : null;
}
