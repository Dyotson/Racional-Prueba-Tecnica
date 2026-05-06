import clsx from "clsx";
import type { RangeKey } from "../lib/types";

interface RangeSelectorProps {
  value: RangeKey;
  onChange: (range: RangeKey) => void;
  available: RangeKey[];
}

const ALL_RANGES: { key: RangeKey; label: string }[] = [
  { key: "1D", label: "1D" },
  { key: "1W", label: "1S" },
  { key: "1M", label: "1M" },
  { key: "3M", label: "3M" },
  { key: "1Y", label: "1A" },
  { key: "ALL", label: "Todo" },
];

export function RangeSelector({ value, onChange, available }: RangeSelectorProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Rango de tiempo"
      className="inline-flex items-center gap-1 rounded-full border border-edge-subtle bg-bg-elevated/70 backdrop-blur p-1"
    >
      {ALL_RANGES.map(({ key, label }) => {
        const enabled = available.includes(key);
        const selected = value === key;
        return (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={!enabled}
            onClick={() => onChange(key)}
            className={clsx(
              "px-3 h-8 text-xs font-semibold rounded-full transition-colors num-tabular",
              selected && "bg-accent text-white shadow-glow",
              !selected && enabled && "text-ink-secondary hover:bg-bg-hover",
              !enabled && "text-ink-muted cursor-not-allowed",
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
