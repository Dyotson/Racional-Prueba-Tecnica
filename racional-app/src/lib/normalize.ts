import type {
  Holding,
  NormalizedPortfolio,
  PortfolioPoint,
} from "./types";

/**
 * The shape of the Firestore document `investmentEvolutions/user1` is not
 * documented up-front, so we accept the most common patterns we have seen for
 * portfolio time-series payloads and degrade gracefully if none match.
 */

const VALUE_KEYS = [
  "portfolioValue",
  "value",
  "amount",
  "total",
  "balance",
  "v",
  "y",
  "price",
  "close",
];

const TIME_KEYS = [
  "date",
  "timestamp",
  "time",
  "t",
  "x",
  "ts",
  "createdAt",
  "updatedAt",
  "day",
];

const CONTRIBUTIONS_KEYS = [
  "contributions",
  "invested",
  "deposited",
  "deposits",
  "cost",
  "principal",
];

const INDEX_KEYS = ["portfolioIndex", "index", "twr", "twrIndex", "navIndex"];

const DAILY_RETURN_KEYS = [
  "dailyReturn",
  "dailyChange",
  "return",
  "ret",
  "change",
];

const SERIES_KEYS = [
  "array",
  "history",
  "values",
  "snapshots",
  "data",
  "points",
  "series",
  "evolution",
  "portfolio",
  "timeline",
  "track",
];

const HOLDING_KEYS = [
  "holdings",
  "positions",
  "assets",
  "instruments",
  "tickers",
  "stocks",
];

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function toMillis(v: unknown): number | null {
  if (v == null) return null;
  if (v instanceof Date) return v.getTime();
  if (isFiniteNumber(v)) {
    // Heuristic: treat values <= 10^12 as seconds, otherwise milliseconds.
    return v < 1e12 ? Math.round(v * 1000) : Math.round(v);
  }
  if (typeof v === "string") {
    const parsed = Date.parse(v);
    if (!Number.isNaN(parsed)) return parsed;
    const asNum = Number(v);
    if (Number.isFinite(asNum)) return toMillis(asNum);
    return null;
  }
  if (typeof v === "object" && v !== null) {
    // Firestore Timestamp serializes as { seconds, nanoseconds }
    const obj = v as Record<string, unknown>;
    if (isFiniteNumber(obj.seconds)) {
      const ns = isFiniteNumber(obj.nanoseconds) ? obj.nanoseconds : 0;
      return Math.round(obj.seconds * 1000 + ns / 1e6);
    }
    if (typeof (obj.toDate as unknown) === "function") {
      try {
        const d = (obj as { toDate: () => Date }).toDate();
        return d instanceof Date ? d.getTime() : null;
      } catch {
        return null;
      }
    }
  }
  return null;
}

function pickFirst(
  obj: Record<string, unknown>,
  candidates: readonly string[],
): unknown {
  for (const key of candidates) {
    if (key in obj && obj[key] != null) return obj[key];
  }
  for (const key of Object.keys(obj)) {
    const lower = key.toLowerCase();
    if (candidates.includes(lower) && obj[key] != null) return obj[key];
  }
  return undefined;
}

function pickNumber(
  obj: Record<string, unknown>,
  candidates: readonly string[],
): number | undefined {
  const raw = pickFirst(obj, candidates);
  if (raw == null) return undefined;
  const num = isFiniteNumber(raw) ? raw : Number(raw as string | number);
  return Number.isFinite(num) ? num : undefined;
}

function objectToPoint(obj: Record<string, unknown>): PortfolioPoint | null {
  const t = toMillis(pickFirst(obj, TIME_KEYS));
  const value = pickNumber(obj, VALUE_KEYS);
  if (t == null || value == null) return null;
  const point: PortfolioPoint = { t, value };
  const contributions = pickNumber(obj, CONTRIBUTIONS_KEYS);
  if (contributions != null) point.contributions = contributions;
  const portfolioIndex = pickNumber(obj, INDEX_KEYS);
  if (portfolioIndex != null) point.portfolioIndex = portfolioIndex;
  const dailyReturn = pickNumber(obj, DAILY_RETURN_KEYS);
  if (dailyReturn != null) point.dailyReturn = dailyReturn;
  return point;
}

function arrayToSeries(arr: unknown[]): PortfolioPoint[] {
  const points: PortfolioPoint[] = [];
  for (const entry of arr) {
    if (entry == null) continue;
    if (typeof entry === "object") {
      // Tuple-like [date, value]
      if (Array.isArray(entry) && entry.length >= 2) {
        const t = toMillis(entry[0]);
        const value = Number(entry[1]);
        if (t != null && Number.isFinite(value)) {
          points.push({ t, value });
          continue;
        }
      }
      const point = objectToPoint(entry as Record<string, unknown>);
      if (point) points.push(point);
    }
  }
  return points;
}

function mapToSeries(obj: Record<string, unknown>): PortfolioPoint[] {
  const points: PortfolioPoint[] = [];
  for (const [key, raw] of Object.entries(obj)) {
    const t = toMillis(key);
    if (t == null) continue;
    if (isFiniteNumber(raw)) {
      points.push({ t, value: raw });
    } else if (raw && typeof raw === "object") {
      const point = objectToPoint(raw as Record<string, unknown>);
      if (point) points.push({ ...point, t });
    }
  }
  return points;
}

function dedupeAndSort(points: PortfolioPoint[]): PortfolioPoint[] {
  const byT = new Map<number, PortfolioPoint>();
  for (const p of points) byT.set(p.t, p);
  return [...byT.values()].sort((a, b) => a.t - b.t);
}

function findSeries(
  raw: Record<string, unknown>,
): { points: PortfolioPoint[]; sourceField: string | null } {
  // 1. Known field names first.
  for (const key of SERIES_KEYS) {
    const candidate = raw[key];
    if (Array.isArray(candidate)) {
      const points = arrayToSeries(candidate);
      if (points.length) return { points: dedupeAndSort(points), sourceField: key };
    }
    if (candidate && typeof candidate === "object" && !Array.isArray(candidate)) {
      const points = mapToSeries(candidate as Record<string, unknown>);
      if (points.length) return { points: dedupeAndSort(points), sourceField: key };
    }
  }

  // 2. Any array on the document that yields valid points.
  for (const [key, val] of Object.entries(raw)) {
    if (Array.isArray(val)) {
      const points = arrayToSeries(val);
      if (points.length) return { points: dedupeAndSort(points), sourceField: key };
    }
  }

  // 3. Document itself is a date-keyed map.
  const mapPoints = mapToSeries(raw);
  if (mapPoints.length) return { points: dedupeAndSort(mapPoints), sourceField: "<root>" };

  return { points: [], sourceField: null };
}

function findHoldings(raw: Record<string, unknown>): Holding[] {
  for (const key of HOLDING_KEYS) {
    const candidate = raw[key];
    if (!candidate) continue;
    if (Array.isArray(candidate)) {
      const holdings: Holding[] = [];
      for (const entry of candidate) {
        if (!entry || typeof entry !== "object") continue;
        const o = entry as Record<string, unknown>;
        const symbol =
          (o.symbol as string) ??
          (o.ticker as string) ??
          (o.code as string) ??
          (o.id as string) ??
          (o.name as string);
        if (!symbol) continue;
        const value = Number(
          (o.value as number) ?? (o.marketValue as number) ?? (o.amount as number) ?? 0,
        );
        if (!Number.isFinite(value)) continue;
        const weight = Number((o.weight as number) ?? (o.allocation as number));
        const changePct = Number(
          (o.changePct as number) ??
            (o.change as number) ??
            (o.dailyChange as number) ??
            (o.return as number),
        );
        const quantity = Number(
          (o.quantity as number) ?? (o.qty as number) ?? (o.shares as number),
        );
        const price = Number((o.price as number) ?? (o.lastPrice as number));
        const holding: Holding = {
          symbol,
          value,
        };
        if (typeof o.name === "string") holding.name = o.name;
        if (Number.isFinite(weight)) holding.weight = weight;
        if (Number.isFinite(changePct)) holding.changePct = changePct;
        if (Number.isFinite(quantity)) holding.quantity = quantity;
        if (Number.isFinite(price)) holding.price = price;
        holdings.push(holding);
      }
      if (holdings.length) {
        // Compute weights when missing using current values.
        const totalValue = holdings.reduce((sum, h) => sum + h.value, 0);
        if (totalValue > 0) {
          for (const h of holdings) {
            if (h.weight == null || h.weight === 0) h.weight = h.value / totalValue;
          }
        }
        return holdings.sort((a, b) => b.value - a.value);
      }
    }
  }
  return [];
}

function findCurrency(raw: Record<string, unknown>): string {
  const direct = raw.currency ?? raw.ccy ?? raw.unit;
  if (typeof direct === "string" && direct.length <= 5) return direct.toUpperCase();
  return "USD";
}

export function normalizePortfolio(
  raw: Record<string, unknown> | null | undefined,
): NormalizedPortfolio {
  if (!raw) {
    return { series: [], holdings: [], currency: "USD", sourceField: null };
  }
  const { points, sourceField } = findSeries(raw);
  const holdings = findHoldings(raw);
  const currency = findCurrency(raw);
  return { series: points, holdings, currency, sourceField };
}
