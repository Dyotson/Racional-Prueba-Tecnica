import {
  ArrowDownToLine,
  ArrowUpToLine,
  Sparkles,
  TrendingDown,
} from "lucide-react";
import { RANGE_PHRASE, type PortfolioPoint, type RangeKey } from "../lib/types";
import { computePerformance, computeTwr } from "../lib/stats";
import { formatDate, formatMoney, formatPercent } from "../lib/formatters";

interface StatsGridProps {
  series: PortfolioPoint[];
  currency: string;
  range: RangeKey;
}

interface StatCardProps {
  label: string;
  value: string;
  hint?: string;
  tone?: "gain" | "loss" | "neutral";
  icon: React.ReactNode;
  title?: string;
}

function StatCard({
  label,
  value,
  hint,
  tone = "neutral",
  icon,
  title,
}: StatCardProps) {
  const valueColor =
    tone === "gain"
      ? "text-gain"
      : tone === "loss"
        ? "text-loss"
        : "text-ink-primary";
  return (
    <div className="card p-4 flex items-start gap-3" title={title}>
      <div className="size-9 rounded-lg bg-bg-elevated grid place-items-center text-ink-secondary border border-edge-subtle shrink-0">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wider text-ink-tertiary font-medium">
          {label}
        </p>
        <p className={`mt-0.5 text-lg font-semibold num-tabular ${valueColor}`}>
          {value}
        </p>
        {hint && <p className="text-[11px] text-ink-tertiary mt-0.5">{hint}</p>}
      </div>
    </div>
  );
}

export function StatsGrid({ series, currency, range }: StatsGridProps) {
  const perf = computePerformance(series);
  const twr = computeTwr(series);

  return (
    <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 animate-fadeIn">
      <StatCard
        label="% de retorno"
        value={twr ? formatPercent(twr.pct, { signed: true }) : "—"}
        tone={!twr ? "neutral" : twr.pct >= 0 ? "gain" : "loss"}
        icon={<Sparkles className="size-4" />}
        hint={`solo crecimiento · ${RANGE_PHRASE[range]}`}
        title="Cuánto rindió tu portafolio en este rango sin contar tus depósitos. Si pones plata nueva tu valor sube, pero esto no, porque solo mide cómo se movieron los precios."
      />

      <StatCard
        label="Mejor día"
        value={
          perf.bestDay ? formatPercent(perf.bestDay.pct, { signed: true }) : "—"
        }
        tone="gain"
        icon={<ArrowUpToLine className="size-4" />}
        hint={perf.bestDay ? formatDate(perf.bestDay.t) : undefined}
      />

      <StatCard
        label="Peor día"
        value={
          perf.worstDay
            ? formatPercent(perf.worstDay.pct, { signed: true })
            : "—"
        }
        tone="loss"
        icon={<ArrowDownToLine className="size-4" />}
        hint={perf.worstDay ? formatDate(perf.worstDay.t) : undefined}
      />

      <StatCard
        label="Mayor caída"
        value={
          perf.maxDrawdownPct != null
            ? formatPercent(perf.maxDrawdownPct, { signed: true })
            : "—"
        }
        tone={
          perf.maxDrawdownPct && perf.maxDrawdownPct < 0 ? "loss" : "neutral"
        }
        icon={<TrendingDown className="size-4" />}
        hint={
          perf.high && perf.low
            ? `desde ${formatMoney(perf.high.value, currency, { compact: true })}`
            : undefined
        }
        title="La caída más grande que tuvo tu portafolio entre un peak y un valle dentro del rango."
      />
    </section>
  );
}
