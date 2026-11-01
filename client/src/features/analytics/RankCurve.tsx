import { useEffect, useRef, useState } from "react";
import { niceStep, sparksScale } from "./scale";
import type { Trajectory } from "./types";

const ru = (v: number) => v.toLocaleString("ru-RU");

function ticksFor(max: number, log: boolean): number[] {
  if (log) {
    const out = [0];
    for (let p = 1; p <= max; p *= 10) out.push(p);
    return out;
  }
  const step = niceStep(max / 4);
  const out: number[] = [];
  for (let v = 0; v <= max; v += step) out.push(v);
  return out;
}

// Участники по местам: по горизонтали место в общем рейтинге, по вертикали
// искры. Одна серия — без легенды, название карточки её называет. Наведение —
// перекрестие на ближайшее место и подсказка с именем.
export function RankCurve({
  kids,
  log,
}: {
  kids: Trajectory[];
  log: boolean;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(640);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  if (kids.length < 2) return <div ref={wrapRef} />;

  const H = 240;
  const padL = 48;
  const padR = 12;
  const padT = 12;
  const padB = 28;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const max = kids[0].sparks;
  const s = sparksScale(max, log);
  const x = (i: number) => padL + (i / (kids.length - 1)) * plotW;
  const y = (v: number) => padT + plotH - s(v) * plotH;

  const line = kids.map((k, i) => `${x(i)},${y(k.sparks)}`).join(" ");
  const area = `M ${x(0)},${y(0)} L ${line.replaceAll(" ", " L ")} L ${x(kids.length - 1)},${y(0)} Z`;

  // Засечки мест: «круглые» с шагом, при котором подписи не слипаются.
  const step = niceStep((kids.length / plotW) * 70);
  const placeTicks = [1];
  for (let p = step; p < kids.length - step * 0.5; p += step) placeTicks.push(p);
  placeTicks.push(kids.length);

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const box = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - box.left) / box.width) * W;
    const i = Math.round(((px - padL) / plotW) * (kids.length - 1));
    setHover(i >= 0 && i < kids.length ? i : null);
  }

  const h = hover !== null ? kids[hover] : null;
  const share = h && max > 0 ? Math.round((h.sparks / max) * 100) : 0;

  return (
    <div ref={wrapRef} className="relative">
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        className="block touch-pan-y"
        role="img"
        aria-label="Искры участников по местам общего рейтинга"
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
      >
        {ticksFor(max, log).map((t) => (
          <g key={t}>
            <line
              x1={padL}
              x2={W - padR}
              y1={y(t)}
              y2={y(t)}
              stroke="var(--color-border)"
              strokeWidth="1"
            />
            <text
              x={padL - 6}
              y={y(t) + 4}
              textAnchor="end"
              fontSize="11"
              fill="var(--color-text-muted)"
            >
              {ru(t)}
            </text>
          </g>
        ))}
        {placeTicks.map((p) => (
          <text
            key={p}
            x={x(p - 1)}
            y={H - 10}
            textAnchor="middle"
            fontSize="11"
            fill="var(--color-text-muted)"
          >
            {p}
          </text>
        ))}
        <text
          x={padL + 6}
          y={padT + plotH - 6}
          fontSize="11"
          fill="var(--color-text-muted)"
        >
          место в рейтинге →
        </text>

        <path d={area} fill="var(--color-brand)" fillOpacity="0.14" />
        <polyline
          points={line}
          fill="none"
          stroke="var(--color-brand)"
          strokeWidth="2"
          strokeLinejoin="round"
        />

        {h && hover !== null && (
          <g pointerEvents="none">
            <line
              x1={x(hover)}
              x2={x(hover)}
              y1={padT}
              y2={padT + plotH}
              stroke="var(--color-text-muted)"
              strokeWidth="1"
              strokeDasharray="3 3"
            />
            <circle
              cx={x(hover)}
              cy={y(h.sparks)}
              r="4.5"
              fill="var(--color-brand)"
              stroke="var(--color-surface)"
              strokeWidth="2"
            />
          </g>
        )}
      </svg>

      {h && hover !== null && (
        <div
          className="pointer-events-none absolute top-1 bg-[var(--color-bg)] px-2 py-1 text-[12px] shadow-[var(--shadow-card)]"
          style={{
            left: `${(x(hover) / W) * 100}%`,
            transform: `translateX(${hover > kids.length / 2 ? "-105%" : "5%"})`,
          }}
        >
          <div className="font-semibold">{h.name}</div>
          <div className="text-[var(--color-text-muted)]">
            место {h.rank} · {ru(h.sparks)} искр · {share}% от лидера
          </div>
        </div>
      )}
    </div>
  );
}
