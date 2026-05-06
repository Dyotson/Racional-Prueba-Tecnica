import { LiveIndicator } from "./LiveIndicator";
import type { ConnectionStatus } from "../lib/types";

interface HeaderProps {
  status: ConnectionStatus;
  lastUpdated: Date | null;
}

export function Header({ status, lastUpdated }: HeaderProps) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <div
          className="size-9 rounded-xl grid place-items-center text-white font-bold shadow-glow"
          style={{
            background: "linear-gradient(135deg,#7c5cff 0%,#16c784 100%)",
          }}
          aria-hidden
        >
          R
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-ink-tertiary font-semibold">
            Trading Portfolio
          </p>
          <h1 className="text-sm md:text-base font-semibold text-ink-primary leading-tight">
            Mi portafolio
          </h1>
        </div>
      </div>
      <LiveIndicator status={status} lastUpdated={lastUpdated} />
    </header>
  );
}
