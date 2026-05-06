import { useMemo } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from "recharts";
import {
  RANGE_SHORT_LABEL,
  type PortfolioPoint,
  type RangeKey,
} from "../lib/types";
import { computeGain, computePerformance } from "../lib/stats";
import {
  formatDate,
  formatDateTime,
  formatMoney,
  formatPercent,
} from "../lib/formatters";

interface PortfolioChartProps {
  series: PortfolioPoint[];
  currency: string;
  range: RangeKey;
}

interface TickFormatterArgs {
  span: number;
}

function buildTickFormatter({ span }: TickFormatterArgs) {
  const day = 24 * 60 * 60 * 1000;
  return (t: number) => {
    if (span <= 2 * day) return formatDate(t, "HH:mm");
    if (span <= 60 * day) return formatDate(t, "d MMM");
    if (span <= 365 * day) return formatDate(t, "d MMM");
    return formatDate(t, "MMM yy");
  };
}

function buildYTickFormatter() {
  return (v: number) => {
    if (Math.abs(v) >= 1000) {
      return new Intl.NumberFormat("es-CL", {
        notation: "compact",
        maximumFractionDigits: 1,
      }).format(v);
    }
    return new Intl.NumberFormat("es-CL", {
      maximumFractionDigits: 0,
    }).format(v);
  };
}

interface PointPayload extends PortfolioPoint {}

function ChartTooltip({
  active,
  payload,
  currency,
}: TooltipProps<number, string> & { currency: string }) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0].payload as PointPayload;
  const gain =
    point.contributions != null && point.contributions > 0
      ? {
          abs: point.value - point.contributions,
          pct: (point.value - point.contributions) / point.contributions,
        }
      : null;
  const positive = gain ? gain.abs >= 0 : true;
  return (
    <div className="rounded-xl border border-edge-strong bg-bg-elevated/95 backdrop-blur px-3.5 py-2.5 shadow-card text-sm min-w-[210px]">
      <p className="text-[11px] uppercase tracking-wider text-ink-tertiary">
        {formatDateTime(point.t)}
      </p>
      <p className="mt-1 num-tabular text-ink-primary font-semibold text-base">
        {formatMoney(point.value, currency)}
      </p>
      {point.contributions != null && (
        <p className="mt-0.5 text-xs num-tabular text-ink-secondary">
          Habías puesto:{" "}
          <span className="text-ink-secondary">
            {formatMoney(point.contributions, currency)}
          </span>
        </p>
      )}
      {gain && (
        <p
          className={`mt-1 text-xs num-tabular ${
            positive ? "text-gain" : "text-loss"
          }`}
        >
          {positive ? "▲" : "▼"} {formatMoney(gain.abs, currency, { signed: true })} ·{" "}
          {formatPercent(gain.pct, { signed: true })}
          <span className="text-ink-tertiary"> {positive ? "ganado" : "perdido"}</span>
        </p>
      )}
    </div>
  );
}

export function PortfolioChart({ series, currency, range }: PortfolioChartProps) {
  const gain = computeGain(series);
  const perf = computePerformance(series);
  const positive = !gain || gain.absGain >= 0;
  const stroke = positive ? "#16c784" : "#ea3943";
  const gradientId = positive ? "areaGradPositive" : "areaGradNegative";

  const hasContributions = series.some((p) => p.contributions != null);

  const span = useMemo(() => {
    if (series.length < 2) return 0;
    return series[series.length - 1].t - series[0].t;
  }, [series]);

  const tickFormatter = useMemo(() => buildTickFormatter({ span }), [span]);
  const yTickFormatter = useMemo(() => buildYTickFormatter(), []);

  const yDomain = useMemo<[number, number]>(() => {
    if (series.length === 0) return [0, 1];
    const allValues: number[] = [];
    for (const p of series) {
      allValues.push(p.value);
      if (p.contributions != null) allValues.push(p.contributions);
    }
    const min = Math.min(...allValues);
    const max = Math.max(...allValues);
    const pad = Math.max((max - min) * 0.08, max * 0.005, 1);
    return [min - pad, max + pad];
  }, [series]);

  const xTicks = useMemo(() => {
    if (series.length < 2) return undefined;
    const target = 6;
    const step = Math.max(1, Math.floor(series.length / target));
    const ticks: number[] = [];
    for (let i = 0; i < series.length; i += step) ticks.push(series[i].t);
    const last = series[series.length - 1].t;
    if (ticks[ticks.length - 1] !== last) ticks.push(last);
    return ticks;
  }, [series]);

  return (
    <div className="card p-4 md:p-6 animate-fadeIn">
      <div className="flex items-baseline justify-between gap-4 mb-3 px-1 flex-wrap">
        <h2 className="text-sm font-semibold text-ink-secondary tracking-wide">
          Evolución
        </h2>
        <div className="flex items-center gap-3 text-[11px]">
          <span className="inline-flex items-center gap-1.5 text-ink-secondary">
            <span
              className="size-2 rounded-full"
              style={{ background: stroke }}
              aria-hidden
            />
            Lo que vale
          </span>
          {hasContributions && (
            <span className="inline-flex items-center gap-1.5 text-ink-tertiary">
              <span
                className="inline-block w-3 border-t border-dashed"
                style={{ borderColor: "#a8b0c0" }}
                aria-hidden
              />
              Lo que has puesto
            </span>
          )}
          <span className="text-ink-tertiary uppercase tracking-wider">
            {RANGE_SHORT_LABEL[range]}
          </span>
        </div>
      </div>

      <div className="h-[320px] md:h-[420px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={series}
            margin={{ top: 16, right: 16, left: 8, bottom: 8 }}
          >
            <defs>
              <linearGradient id="areaGradPositive" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#16c784" stopOpacity={0.32} />
                <stop offset="100%" stopColor="#16c784" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="areaGradNegative" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ea3943" stopOpacity={0.30} />
                <stop offset="100%" stopColor="#ea3943" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="2 6"
              vertical={false}
              stroke="rgba(255,255,255,0.05)"
            />
            <XAxis
              dataKey="t"
              type="number"
              domain={["dataMin", "dataMax"]}
              ticks={xTicks}
              tickFormatter={tickFormatter}
              tick={{ fill: "#6b7388", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickMargin={8}
              minTickGap={32}
            />
            <YAxis
              domain={yDomain}
              tickFormatter={yTickFormatter}
              tick={{ fill: "#6b7388", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              orientation="right"
              width={64}
            />
            <Tooltip
              cursor={{
                stroke: "rgba(255,255,255,0.18)",
                strokeWidth: 1,
                strokeDasharray: "3 3",
              }}
              content={<ChartTooltip currency={currency} />}
            />
            {hasContributions && (
              <Line
                type="stepAfter"
                dataKey="contributions"
                stroke="#a8b0c0"
                strokeWidth={1.4}
                strokeDasharray="4 4"
                dot={false}
                isAnimationActive={false}
                activeDot={false}
              />
            )}
            <Area
              type="monotone"
              dataKey="value"
              stroke={stroke}
              strokeWidth={2.2}
              fill={`url(#${gradientId})`}
              isAnimationActive
              animationDuration={650}
              activeDot={{
                r: 5,
                stroke: "#11141b",
                strokeWidth: 2,
                fill: stroke,
              }}
              dot={false}
            />
            {perf.high && (
              <ReferenceDot
                x={perf.high.t}
                y={perf.high.value}
                r={3}
                fill="#16c784"
                stroke="#11141b"
                strokeWidth={1.5}
                ifOverflow="extendDomain"
              />
            )}
            {perf.low && (
              <ReferenceDot
                x={perf.low.t}
                y={perf.low.value}
                r={3}
                fill="#ea3943"
                stroke="#11141b"
                strokeWidth={1.5}
                ifOverflow="extendDomain"
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
