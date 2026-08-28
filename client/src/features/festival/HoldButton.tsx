import { useEffect, useRef, useState } from "react";

// Отметка рубежа делается одним нажатием и назад не отматывается сама — на
// бегу телефон легко задеть. Поэтому кнопку надо подержать, а сразу после
// срабатывания она на пару секунд глохнет: две отметки подряд физически
// невозможны.
const HOLD_MS = 400;
const COOLDOWN_MS = 2000;

export function HoldButton({
  label,
  hint,
  disabled,
  onFire,
}: {
  label: string;
  hint: string;
  disabled: boolean;
  onFire: () => void;
}) {
  const [holding, setHolding] = useState(false);
  const [cooling, setCooling] = useState(false);
  const holdTimer = useRef<number | null>(null);
  const coolTimer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (holdTimer.current) clearTimeout(holdTimer.current);
      if (coolTimer.current) clearTimeout(coolTimer.current);
    },
    [],
  );

  function start(): void {
    if (disabled || cooling || holding) return;
    setHolding(true);
    holdTimer.current = window.setTimeout(() => {
      setHolding(false);
      setCooling(true);
      // Вибрация — единственный отклик, который судья заметит, не глядя в экран.
      navigator.vibrate?.(40);
      onFire();
      coolTimer.current = window.setTimeout(() => setCooling(false), COOLDOWN_MS);
    }, HOLD_MS);
  }

  function cancel(): void {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
    setHolding(false);
  }

  const off = disabled || cooling;

  return (
    <button
      disabled={off}
      onPointerDown={start}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      onContextMenu={(e) => e.preventDefault()}
      className={
        "relative w-full touch-none overflow-hidden px-4 py-10 text-2xl font-semibold text-white " +
        "select-none disabled:opacity-50 " +
        (off ? "bg-[var(--color-elevated)]" : "bg-[var(--color-brand)]")
      }
    >
      {/* Заливка показывает, сколько ещё держать. */}
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 bg-[var(--color-brand-hover)] transition-[width] ease-linear"
        style={{ width: holding ? "100%" : "0%", transitionDuration: `${HOLD_MS}ms` }}
      />
      <span className="relative block">{cooling ? "Записано" : label}</span>
      <span className="relative mt-1 block text-sm font-normal opacity-80">
        {cooling ? "подождите пару секунд" : hint}
      </span>
    </button>
  );
}
