import clsx from "clsx";
import type { ConnectionStatus } from "../lib/types";
import { formatRelative } from "../lib/formatters";

interface LiveIndicatorProps {
  status: ConnectionStatus;
  lastUpdated: Date | null;
}

const STATUS_TEXT: Record<ConnectionStatus, string> = {
  idle: "Inicializando",
  connecting: "Conectando",
  live: "En vivo",
  stale: "Sin datos recientes",
  error: "Sin conexión",
  empty: "Sin datos",
};

const STATUS_COLOR: Record<ConnectionStatus, { dot: string; ring: string; text: string }> = {
  idle: { dot: "bg-ink-tertiary", ring: "bg-ink-tertiary/40", text: "text-ink-tertiary" },
  connecting: {
    dot: "bg-accent",
    ring: "bg-accent/40",
    text: "text-accent-soft",
  },
  live: { dot: "bg-gain", ring: "bg-gain/40", text: "text-gain" },
  stale: {
    dot: "bg-amber-400",
    ring: "bg-amber-400/40",
    text: "text-amber-300",
  },
  error: { dot: "bg-loss", ring: "bg-loss/40", text: "text-loss" },
  empty: {
    dot: "bg-ink-tertiary",
    ring: "bg-ink-tertiary/30",
    text: "text-ink-tertiary",
  },
};

export function LiveIndicator({ status, lastUpdated }: LiveIndicatorProps) {
  const palette = STATUS_COLOR[status];
  const animate = status === "live" || status === "connecting";

  return (
    <div
      className="inline-flex items-center gap-2.5 rounded-full border border-edge-subtle bg-bg-elevated/70 backdrop-blur pl-2.5 pr-3 py-1.5"
      role="status"
      aria-live="polite"
    >
      <span className="relative grid place-items-center size-2.5">
        <span
          className={clsx(
            "absolute inset-0 rounded-full",
            palette.ring,
            animate && "animate-ringPulse",
          )}
        />
        <span
          className={clsx(
            "size-2 rounded-full",
            palette.dot,
            animate && "animate-pulseDot",
          )}
        />
      </span>
      <span className={clsx("text-xs font-semibold", palette.text)}>
        {STATUS_TEXT[status]}
      </span>
      {lastUpdated && (status === "live" || status === "stale") && (
        <span className="text-[11px] text-ink-tertiary">
          · actualizado {formatRelative(lastUpdated.getTime())}
        </span>
      )}
    </div>
  );
}
