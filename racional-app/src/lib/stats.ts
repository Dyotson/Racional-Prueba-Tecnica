import type { PortfolioPoint, RangeKey } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;

const RANGE_TO_MS: Record<Exclude<RangeKey, "ALL">, number> = {
  "1D": DAY_MS,
  "1W": 7 * DAY_MS,
  "1M": 30 * DAY_MS,
  "3M": 90 * DAY_MS,
  "1Y": 365 * DAY_MS,
};

export function filterByRange(
  series: PortfolioPoint[],
  range: RangeKey,
): PortfolioPoint[] {
  if (range === "ALL" || series.length === 0) return series;
  const last = series[series.length - 1].t;
  const cutoff = last - RANGE_TO_MS[range];
  const filtered = series.filter((p) => p.t >= cutoff);
  return filtered.length >= 2 ? filtered : series.slice(-2);
}

/**
 * "Ganancia del período" = how much the market added DURING the selected
 * window, net of any deposits the user made in that window.
 *
 * absGain  = (Δ portfolioValue) − (Δ contributions)
 *            i.e. value moved by $X and you put in $Y of fresh capital,
 *            so the market actually gave you $(X − Y).
 * gainPct  = TWR for the window (`portfolioIndex` ratio when present), so the
 *            percentage is consistent with the "no contamina depósitos" rule
 *            even when the user injected capital mid-period.
 *
 * Both numbers move with the selected range — that's the whole point.
 * Falls back to a naive value-delta when contributions / index aren't present.
 */
export interface GainStats {
  startValue: number;
  endValue: number;
  endContributions?: number;
  absGain: number;
  gainPct: number;
  /** True when contributions were available and used; false otherwise. */
  isMoneyWeighted: boolean;
}

export function computeGain(series: PortfolioPoint[]): GainStats | null {
  if (series.length === 0) return null;
  const last = series[series.length - 1];
  const first = series[0];

  if (series.length < 2) {
    return {
      startValue: first.value,
      endValue: last.value,
      endContributions: last.contributions,
      absGain: 0,
      gainPct: 0,
      isMoneyWeighted: last.contributions != null,
    };
  }

  const valueDelta = last.value - first.value;
  let contribDelta = 0;
  let isMoneyWeighted = false;
  if (first.contributions != null && last.contributions != null) {
    contribDelta = last.contributions - first.contributions;
    isMoneyWeighted = true;
  }
  const absGain = valueDelta - contribDelta;

  const twr = computeTwr(series);
  const gainPct = twr
    ? twr.pct
    : first.value !== 0
      ? valueDelta / Math.abs(first.value)
      : 0;

  return {
    startValue: first.value,
    endValue: last.value,
    endContributions: last.contributions,
    absGain,
    gainPct,
    isMoneyWeighted,
  };
}

/**
 * Time-weighted return for the range, using the base-100 portfolioIndex when
 * present (the canonical way to measure performance with cash flows). Falls
 * back to chaining dailyReturn, then to a naive value-based delta.
 */
export interface TwrStats {
  pct: number;
  /** "index" | "chained" | "naive" – communicated to the UI as a tooltip. */
  source: "index" | "chained" | "naive";
}

export function computeTwr(series: PortfolioPoint[]): TwrStats | null {
  if (series.length < 2) return null;
  const first = series[0];
  const last = series[series.length - 1];

  if (
    first.portfolioIndex != null &&
    last.portfolioIndex != null &&
    first.portfolioIndex !== 0
  ) {
    return {
      pct: last.portfolioIndex / first.portfolioIndex - 1,
      source: "index",
    };
  }

  const haveDaily = series.every((p) => p.dailyReturn != null);
  if (haveDaily) {
    let factor = 1;
    for (let i = 1; i < series.length; i++) {
      factor *= 1 + (series[i].dailyReturn ?? 0);
    }
    return { pct: factor - 1, source: "chained" };
  }

  if (first.value !== 0) {
    return {
      pct: (last.value - first.value) / Math.abs(first.value),
      source: "naive",
    };
  }
  return null;
}

export interface DayPick {
  t: number;
  pct: number;
}

export interface PerformanceStats {
  bestDay: DayPick | null;
  worstDay: DayPick | null;
  maxDrawdownPct: number | null;
  high: { t: number; value: number } | null;
  low: { t: number; value: number } | null;
}

/**
 * Best/worst day prefers the pre-computed `dailyReturn` field when present
 * (avoids confusing capital-injection days with monster returns), and
 * computes max drawdown over the time-weighted index when available so a
 * deposit doesn't reset the running peak.
 */
export function computePerformance(series: PortfolioPoint[]): PerformanceStats {
  if (series.length < 2) {
    return {
      bestDay: null,
      worstDay: null,
      maxDrawdownPct: null,
      high: null,
      low: null,
    };
  }

  let bestDay: DayPick | null = null;
  let worstDay: DayPick | null = null;
  let high: { t: number; value: number } = {
    t: series[0].t,
    value: series[0].value,
  };
  let low: { t: number; value: number } = {
    t: series[0].t,
    value: series[0].value,
  };

  const useIndex = series.every((p) => p.portfolioIndex != null);
  let runningPeak = useIndex
    ? (series[0].portfolioIndex as number)
    : series[0].value;
  let maxDrawdown = 0;

  for (let i = 0; i < series.length; i++) {
    const point = series[i];
    if (point.value > high.value) high = { t: point.t, value: point.value };
    if (point.value < low.value) low = { t: point.t, value: point.value };

    const ddBase = useIndex ? (point.portfolioIndex as number) : point.value;
    if (ddBase > runningPeak) runningPeak = ddBase;
    if (runningPeak > 0) {
      const dd = (ddBase - runningPeak) / runningPeak;
      if (dd < maxDrawdown) maxDrawdown = dd;
    }

    if (i > 0) {
      const dailyPct =
        point.dailyReturn ??
        (series[i - 1].value !== 0
          ? (point.value - series[i - 1].value) / Math.abs(series[i - 1].value)
          : 0);
      if (Number.isFinite(dailyPct)) {
        if (!bestDay || dailyPct > bestDay.pct)
          bestDay = { t: point.t, pct: dailyPct };
        if (!worstDay || dailyPct < worstDay.pct)
          worstDay = { t: point.t, pct: dailyPct };
      }
    }
  }

  return {
    bestDay,
    worstDay,
    maxDrawdownPct: maxDrawdown,
    high,
    low,
  };
}

/**
 * Builds the list of ranges that actually have data behind them, so we never
 * render a button for a range whose start cutoff predates the first sample.
 */
export function availableRanges(series: PortfolioPoint[]): RangeKey[] {
  const all: RangeKey[] = ["1D", "1W", "1M", "3M", "1Y", "ALL"];
  if (series.length < 2) return ["ALL"];
  const span = series[series.length - 1].t - series[0].t;
  return all.filter((r) => {
    if (r === "ALL") return true;
    return RANGE_TO_MS[r] <= span * 1.05;
  });
}
