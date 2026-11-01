import { useEffect, useMemo, useRef, useState } from "react";
import { niceStep, sparksScale } from "./scale";
import type { Trajectory, TrajectoryShift } from "./types";

const ru = (v: number) => v.toLocaleString("ru-RU");

const DEFAULT_VIEW = { yaw: -0.75, pitch: 0.5 };
const HEIGHT = 400;
// Столбцов поверхности не больше этого: кривая мест монотонна, поэтому
// выборка каждого k-го места её не искажает, а рисовать 435 × 18 граней на
// каждое движение мыши незачем.
const MAX_COLUMNS = 120;

interface P {
  sx: number;
  sy: number;
  depth: number;
}

// 3D-карта рейтинга: место (слева направо) × смены по времени (вглубь) ×
// искры (вверх). Срез по смене — кривая «место → искры» на тот момент: дети
// упорядочены по итогу после этой смены, а не по сегодняшнему месту. Поэтому
// поверхность показывает, как рейтинг рос и расслаивался. Ребёнок под курсором
// подсвечивается своей траекторией: как он шёл по местам от смены к смене.
// Без библиотек: ортогональная проекция на canvas, грани — алгоритмом
// художника, вращение перетаскиванием.
export function RankTerrain({
  kids,
  shifts,
  places,
  log,
}: {
  kids: Trajectory[]; // все дети, по итоговому месту
  shifts: TrajectoryShift[];
  places: number; // сколько мест показывать (сверху)
  log: boolean;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [width, setWidth] = useState(640);
  const [view, setView] = useState(DEFAULT_VIEW);
  const [hover, setHover] = useState<{ col: number; t: number } | null>(null);
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const T = shifts.length;
  const P = Math.min(places, kids.length);

  // standing[t][p] — индекс ребёнка на месте p (с нуля) после смены t.
  // Равные итоги — по итоговому месту, чтобы порядок не прыгал.
  const standing = useMemo(
    () =>
      shifts.map((_, t) =>
        kids
          .map((_, i) => i)
          .sort((a, b) => kids[b].cumulative[t] - kids[a].cumulative[t] || a - b),
      ),
    [kids, shifts],
  );
  const placeOf = useMemo(
    () =>
      standing.map((order) => {
        const at = new Array<number>(order.length);
        order.forEach((kid, p) => (at[kid] = p));
        return at;
      }),
    [standing],
  );

  const columns = useMemo(() => {
    const c = Math.min(P, MAX_COLUMNS);
    if (c <= 1) return [0];
    return Array.from({ length: c }, (_, j) => Math.round((j * (P - 1)) / (c - 1)));
  }, [P]);

  const max = useMemo(
    () => (P > 0 && T > 0 ? kids[standing[T - 1][0]].cumulative[T - 1] : 0),
    [kids, standing, P, T],
  );
  const s = useMemo(() => sparksScale(max, log), [max, log]);

  const geo = useMemo(() => {
    const scale = Math.min(width / 3.5, HEIGHT / 2.9);
    const cx = width / 2;
    const cy = HEIGHT / 2 + 4;
    const cosY = Math.cos(view.yaw);
    const sinY = Math.sin(view.yaw);
    const cosP = Math.cos(view.pitch);
    const sinP = Math.sin(view.pitch);
    const project = (x: number, y: number, z: number): P => {
      const rx = x * cosY - y * sinY;
      const ry = x * sinY + y * cosY;
      return {
        sx: cx + rx * scale,
        sy: cy - (z * cosP + ry * sinP) * scale,
        depth: ry * cosP - z * sinP,
      };
    };
    const px = (p: number) => (P <= 1 ? 0 : (p / (P - 1)) * 2 - 1);
    const py = (t: number) => (T <= 1 ? 0 : (t / (T - 1)) * 2 - 1);
    const pz = (v: number) => s(v) * 1.2 - 0.6;
    const valueAt = (p: number, t: number) =>
      kids[standing[t][p]].cumulative[t];
    const grid = columns.map((p) =>
      shifts.map((_, t) => project(px(p), py(t), pz(valueAt(p, t)))),
    );
    return { project, px, py, pz, grid, valueAt };
  }, [width, view, P, T, s, kids, standing, columns, shifts]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || P === 0 || T === 0) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(HEIGHT * dpr);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, HEIGHT);

    const css = getComputedStyle(canvas);
    const brand = css.getPropertyValue("--color-brand").trim() || "#8b7cf6";
    const surface = css.getPropertyValue("--color-surface").trim() || "#1b1b1e";
    const border = css.getPropertyValue("--color-border").trim() || "#2a2a2f";
    const muted = css.getPropertyValue("--color-text-muted").trim() || "#999";
    const text = css.getPropertyValue("--color-text").trim() || "#eee";
    const { project, px, py, pz, grid, valueAt } = geo;
    const C = columns.length;

    const seg = (a: P, b: P) => {
      ctx.beginPath();
      ctx.moveTo(a.sx, a.sy);
      ctx.lineTo(b.sx, b.sy);
      ctx.stroke();
    };

    // Каркас: пол и вертикальное ребро в дальнем углу с засечками искр.
    const floor = pz(0);
    const cornersXY: [number, number][] = [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ];
    const corners = cornersXY.map(([x, y]) => project(x, y, floor));
    ctx.strokeStyle = border;
    ctx.lineWidth = 1;
    corners.forEach((c, i) => seg(c, corners[(i + 1) % 4]));
    const backIdx = corners.reduce((b, c, i) => (c.depth > corners[b].depth ? i : b), 0);
    const [bx, by] = cornersXY[backIdx];
    seg(corners[backIdx], project(bx, by, pz(max)));

    ctx.font = "11px system-ui, sans-serif";
    const zTicks: number[] = [];
    if (log) {
      for (let v = 10; v <= max; v *= 10) zTicks.push(v);
    } else {
      const step = niceStep(max / 4);
      for (let v = step; v <= max; v += step) zTicks.push(v);
    }
    ctx.strokeStyle = border;
    for (const v of zTicks) {
      seg(project(bx, by, pz(v)), project(bx, by === -1 ? -0.9 : 0.9, pz(v)));
    }

    // Поверхность: грани от дальних к ближним, яркость — по высоте.
    const quads: { d: number; c: number; t: number }[] = [];
    for (let c = 0; c < C - 1; c += 1) {
      for (let t = 0; t < T - 1; t += 1) {
        const d =
          grid[c][t].depth + grid[c + 1][t].depth + grid[c][t + 1].depth + grid[c + 1][t + 1].depth;
        quads.push({ d, c, t });
      }
    }
    quads.sort((a, b) => b.d - a.d);
    const height = (c: number, t: number) => s(valueAt(columns[c], t));
    for (const q of quads) {
      const a = grid[q.c][q.t];
      const b = grid[q.c + 1][q.t];
      const c2 = grid[q.c + 1][q.t + 1];
      const d = grid[q.c][q.t + 1];
      const h =
        (height(q.c, q.t) +
          height(q.c + 1, q.t) +
          height(q.c + 1, q.t + 1) +
          height(q.c, q.t + 1)) /
        4;
      ctx.beginPath();
      ctx.moveTo(a.sx, a.sy);
      ctx.lineTo(b.sx, b.sy);
      ctx.lineTo(c2.sx, c2.sy);
      ctx.lineTo(d.sx, d.sy);
      ctx.closePath();
      ctx.fillStyle = surface;
      ctx.globalAlpha = 1;
      ctx.fill();
      ctx.fillStyle = brand;
      ctx.globalAlpha = 0.18 + 0.72 * h;
      ctx.fill();
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = surface;
      ctx.lineWidth = 0.6;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Срезы смен — тонкие линии поверх, чтобы считывались шаги времени.
    ctx.strokeStyle = text;
    ctx.globalAlpha = 0.28;
    ctx.lineWidth = 1;
    for (let t = 0; t < T; t += 1) {
      ctx.beginPath();
      for (let c = 0; c < C; c += 1) {
        const p = grid[c][t];
        if (c === 0) ctx.moveTo(p.sx, p.sy);
        else ctx.lineTo(p.sx, p.sy);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Подписи: засечки искр на дальнем ребре (поверх поверхности, чтобы она
    // их не закрывала) и оси.
    ctx.fillStyle = muted;
    for (const v of zTicks) {
      const a = project(bx, by, pz(v));
      ctx.fillText(ru(v), a.sx + 6, a.sy + 4);
    }
    const at = (x: number, y: number, label: string, dy = 14) => {
      const p = project(x, y, floor);
      ctx.fillText(label, p.sx - ctx.measureText(label).width / 2, p.sy + dy);
    };
    at(-1, -1.15, "1");
    at(0.92, -1.15, String(P));
    at(1.15, -0.8, String(shifts[0].shift_id));
    at(1.15, 1, String(shifts[T - 1].shift_id));
    ctx.fillStyle = text;
    at(0, -1.3, "место");
    at(1.3, 0.1, "смены");

    // Траектория ребёнка под курсором: его место и итог после каждой смены.
    if (hover) {
      const kid = standing[hover.t][columns[hover.col]];
      const path: P[] = shifts.map((_, t) => {
        const p = placeOf[t][kid];
        return project(px(Math.min(p, P - 1)), py(t), pz(kids[kid].cumulative[t]));
      });
      ctx.strokeStyle = text;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      // Ребёнок за пределами показанных мест прижимается к правому краю.
      path.forEach((p, t) => {
        if (t === 0) ctx.moveTo(p.sx, p.sy);
        else ctx.lineTo(p.sx, p.sy);
      });
      ctx.stroke();
      const p = path[hover.t];
      ctx.fillStyle = brand;
      ctx.beginPath();
      ctx.arc(p.sx, p.sy, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = surface;
      ctx.stroke();
    }
  }, [geo, hover, columns, kids, shifts, standing, placeOf, P, T, max, log, s, width]);

  function nearest(mx: number, my: number) {
    let best: { col: number; t: number } | null = null;
    let bestD = 18 * 18;
    geo.grid.forEach((row, col) =>
      row.forEach((p, t) => {
        const d = (p.sx - mx) ** 2 + (p.sy - my) ** 2;
        if (d < bestD) {
          bestD = d;
          best = { col, t };
        }
      }),
    );
    return best;
  }

  function onDown(e: React.PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, moved: false };
  }
  function onMove(e: React.PointerEvent<HTMLCanvasElement>) {
    const d = drag.current;
    if (d) {
      const dx = e.clientX - d.x;
      const dy = e.clientY - d.y;
      if (Math.abs(dx) + Math.abs(dy) > 2) d.moved = true;
      d.x = e.clientX;
      d.y = e.clientY;
      if (d.moved) {
        setView((v) => ({
          yaw: v.yaw - dx * 0.008,
          pitch: Math.max(0.05, Math.min(1.45, v.pitch + dy * 0.006)),
        }));
        setHover(null);
      }
      return;
    }
    const box = e.currentTarget.getBoundingClientRect();
    setHover(nearest(e.clientX - box.left, e.clientY - box.top));
  }
  function onUp(e: React.PointerEvent<HTMLCanvasElement>) {
    const d = drag.current;
    drag.current = null;
    // Касание без перетаскивания — то же, что наведение мышью.
    if (d && !d.moved) {
      const box = e.currentTarget.getBoundingClientRect();
      setHover(nearest(e.clientX - box.left, e.clientY - box.top));
    }
  }

  if (P === 0 || T === 0) return null;

  let tip: React.ReactNode = null;
  if (hover) {
    const place = columns[hover.col];
    const kid = kids[standing[hover.t][place]];
    const sh = shifts[hover.t];
    const p = geo.grid[hover.col][hover.t];
    const gained = kid.cumulative[hover.t] - (hover.t > 0 ? kid.cumulative[hover.t - 1] : 0);
    tip = (
      <div
        className="pointer-events-none absolute bg-[var(--color-bg)] px-2 py-1 text-[12px] shadow-[var(--shadow-card)]"
        style={{
          ...(p.sx > width / 2
            ? { right: Math.max(0, width - p.sx + 8) }
            : { left: p.sx + 8 }),
          maxWidth: Math.max(180, width - 16),
          top: Math.max(0, p.sy - 76),
        }}
      >
        <div className="font-semibold">{kid.name}</div>
        <div className="text-[var(--color-text-muted)]">
          после смены {sh.shift_id}
          {sh.name ? ` «${sh.name}»` : ""}: место {place + 1},{" "}
          {ru(kid.cumulative[hover.t])} искр
          {gained > 0 ? ` (+${ru(gained)})` : ""}
        </div>
        <div className="text-[var(--color-text-muted)]">
          сейчас — место {kid.rank}, {ru(kid.sparks)} искр
        </div>
      </div>
    );
  }

  return (
    <div ref={wrapRef} className="relative">
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height: HEIGHT, touchAction: "none" }}
        className="block cursor-grab active:cursor-grabbing"
        role="img"
        aria-label="3D-карта: место в рейтинге, смены по времени и искры"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerLeave={() => !drag.current && setHover(null)}
      />
      <button
        type="button"
        onClick={() => setView(DEFAULT_VIEW)}
        className="absolute right-2 top-2 rounded-[var(--radius-sm)] bg-[var(--color-bg)] px-2 py-1 text-[11px] text-[var(--color-text-muted)]"
      >
        Сбросить вид
      </button>
      {tip}
    </div>
  );
}
