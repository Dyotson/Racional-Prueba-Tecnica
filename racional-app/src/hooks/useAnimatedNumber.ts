import { useEffect, useRef, useState } from "react";

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * Tweens a number towards `target`, returning the current animated value.
 * Honors prefers-reduced-motion by snapping to the target immediately.
 */
export function useAnimatedNumber(target: number, durationMs = 600): number {
  const [value, setValue] = useState(target);
  const startValueRef = useRef(target);
  const startTimeRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    if (reduce || !Number.isFinite(target)) {
      setValue(target);
      return;
    }

    startValueRef.current = value;
    startTimeRef.current = null;

    const tick = (ts: number) => {
      if (startTimeRef.current == null) startTimeRef.current = ts;
      const elapsed = ts - startTimeRef.current;
      const progress = Math.min(1, elapsed / durationMs);
      const eased = easeOutCubic(progress);
      const next =
        startValueRef.current + (target - startValueRef.current) * eased;
      setValue(next);
      if (progress < 1) {
        rafRef.current = window.requestAnimationFrame(tick);
      }
    };

    rafRef.current = window.requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, durationMs]);

  return value;
}
