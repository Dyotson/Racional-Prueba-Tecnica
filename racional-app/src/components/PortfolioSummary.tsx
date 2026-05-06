import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, YAxis } from "recharts";
import clsx from "clsx";
import {
  RANGE_SHORT_LABEL,
  type PortfolioPoint,
  type RangeKey,
} from "../lib/types";
import { computeGain } from "../lib/stats";
import { formatMoney, formatPercent } from "../lib/formatters";
import { useAnimatedNumber } from "../hooks/useAnimatedNumber";

interface PortfolioSummaryProps {
  series: PortfolioPoint[];
  currency: string;
  range: RangeKey;
}

export function PortfolioSummary({ series, currency, range }: PortfolioSummaryProps) {
  const last = series[series.length - 1];
  const animated = useAnimatedNumber(last?.value ?? 0, 700);
  const gain = computeGain(series);

  const direction = !gain
    ? "flat"
    : gain.absGain > 0
      ? "up"
      : gain.absGain < 0
        ? "down"
        : "flat";
  const tone =
    direction === "up"
      ? "text-gain"
      : direction === "down"
        ? "text-loss"
        : "text-ink-tertiary";
  const bg =
    direction === "up"
      ? "bg-gain-soft"
      : direction === "down"
        ? "bg-loss-soft"
        : "bg-bg-elevated";
  const Icon =
    direction === "up" ? ArrowUpRight : direction === "down" ? ArrowDownRight : Minus;
  const stroke =
    direction === "up" ? "#16c784" : direction === "down" ? "#ea3943" : "#7c5cff";

  return (
    <section className="card p-5 sm:p-6 md:p-8 animate-fadeIn overflow-hidden">
      <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between md:gap-6">
        <div className="w-full md:flex-1 md:min-w-0">
          <p className="text-[11px] sm:text-xs uppercase tracking-[0.18em] text-ink-tertiary font-medium">
            Tus inversiones valen
          </p>
          <p className="mt-2 text-[28px] xs:text-3xl sm:text-4xl md:text-5xl font-semibold num-tabular text-ink-primary tracking-tight leading-none">
            {formatMoney(animated, currency)}
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span
              className={clsx(
                "pill num-tabular border border-transparent",
                bg,
                tone,
              )}
              aria-label={
                gain && gain.absGain >= 0
                  ? `Has ganado ${formatMoney(gain.absGain, currency)} (${formatPercent(gain.gainPct)}), viendo ${RANGE_SHORT_LABEL[range]}`
                  : `Has perdido ${formatMoney(Math.abs(gain?.absGain ?? 0), currency)} (${formatPercent(gain?.gainPct ?? 0)}), viendo ${RANGE_SHORT_LABEL[range]}`
              }
            >
              <Icon className="size-3.5" strokeWidth={2.4} aria-hidden />
              <span>
                {gain
                  ? formatMoney(gain.absGain, currency, { signed: true })
                  : "—"}
              </span>
              <span className="opacity-70">·</span>
              <span>
                {gain ? formatPercent(gain.gainPct, { signed: true }) : "—"}
              </span>
              <span className="opacity-70">·</span>
              <span className="text-[10px] uppercase tracking-wider opacity-90">
                {RANGE_SHORT_LABEL[range]}
              </span>
            </span>
          </div>

          {gain?.isMoneyWeighted && gain.endContributions != null && (
            <p className="mt-3 text-[11px] text-ink-tertiary num-tabular">
              Has puesto:{" "}
              <span className="text-ink-secondary font-medium">
                {formatMoney(gain.endContributions, currency)}
              </span>
            </p>
          )}
        </div>

        <div className="w-full h-16 sm:h-20 md:w-60 md:h-24 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={series}
              margin={{ top: 4, right: 4, left: 4, bottom: 4 }}
            >
              <defs>
                <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={stroke} stopOpacity={0.45} />
                  <stop offset="100%" stopColor={stroke} stopOpacity={0} />
                </linearGradient>
              </defs>
              <YAxis hide domain={["dataMin", "dataMax"]} />
              <Area
                type="monotone"
                dataKey="value"
                stroke={stroke}
                strokeWidth={2}
                fill="url(#sparkGrad)"
                isAnimationActive={false}
                dot={false}
                activeDot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
}
