import type { MyShiftStat } from "../sparks/types";

// Single-series change-over-time: cumulative sparks across shifts. One hue
// (brand), one axis, no legend (the title names the series). Points carry a
// native <title> for hover; the per-shift table below is the table view.
export function SparksChart({ shifts }: { shifts: MyShiftStat[] }) {
  if (shifts.length < 2) return null;

  const W = 320;
  const H = 150;
  const padL = 40;
  const padR = 10;
  const padT = 10;
  const padB = 22;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const max = Math.max(...shifts.map((s) => s.cumulative), 1);
  const x = (i: number) =>
    padL + (shifts.length === 1 ? 0 : (i / (shifts.length - 1)) * plotW);
  const y = (v: number) => padT + plotH - (v / max) * plotH;

  const linePts = shifts.map((s, i) => `${x(i)},${y(s.cumulative)}`);
  const areaPath =
    `M ${x(0)},${y(0)} ` +
    shifts.map((s, i) => `L ${x(i)},${y(s.cumulative)}`).join(" ") +
    ` L ${x(shifts.length - 1)},${y(0)} Z`;

  // 3 horizontal gridlines / y ticks.
  const ticks = [0, 0.5, 1].map((f) => Math.round(max * f));

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      style={{ height: "auto" }}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="График накопленных искр по сменам"
    >
      <defs>
        <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-brand)" stopOpacity="0.28" />
          <stop offset="100%" stopColor="var(--color-brand)" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* gridlines + y labels */}
      {ticks.map((t) => (
        <g key={t}>
          <line
            x1={padL}
            y1={y(t)}
            x2={W - padR}
            y2={y(t)}
            stroke="var(--color-border)"
            strokeWidth="0.5"
          />
          <text
            x={padL - 5}
            y={y(t) + 3}
            textAnchor="end"
            fontSize="7"
            fill="var(--color-text-muted)"
          >
            {t.toLocaleString("ru-RU")}
          </text>
        </g>
      ))}

      <path d={areaPath} fill="url(#sparkFill)" />
      <polyline
        points={linePts.join(" ")}
        fill="none"
        stroke="var(--color-brand)"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {shifts.map((s, i) => (
        <g key={s.shift_id}>
          <circle
            cx={x(i)}
            cy={y(s.cumulative)}
            r="2.5"
            fill="var(--color-brand)"
            stroke="var(--color-surface)"
            strokeWidth="1"
          />
          {/* bigger transparent hit target with native tooltip */}
          <circle cx={x(i)} cy={y(s.cumulative)} r="8" fill="transparent">
            <title>
              Смена {s.shift_id}: {s.cumulative.toLocaleString("ru-RU")} искр
              (+{s.sparks.toLocaleString("ru-RU")})
            </title>
          </circle>
          <text
            x={x(i)}
            y={H - 8}
            textAnchor="middle"
            fontSize="7"
            fill="var(--color-text-muted)"
          >
            {s.shift_id}
          </text>
        </g>
      ))}
    </svg>
  );
}
