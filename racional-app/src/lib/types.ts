export type ConnectionStatus =
  | "idle"
  | "connecting"
  | "live"
  | "stale"
  | "error"
  | "empty";

export interface PortfolioPoint {
  /** Epoch milliseconds, sortable. */
  t: number;
  /** Total portfolio value at this point in time. */
  value: number;
  /** Optional: cumulative invested capital (deposits) up to this point. */
  contributions?: number;
  /**
   * Optional: base-100 time-weighted index. The proper way to measure portfolio
   * performance when the user keeps depositing capital, since it neutralizes
   * the effect of cash flows.
   */
  portfolioIndex?: number;
  /** Optional: pre-computed daily return as a decimal (e.g. 0.0123 = +1.23 %). */
  dailyReturn?: number;
}

export interface Holding {
  symbol: string;
  name?: string;
  quantity?: number;
  price?: number;
  value: number;
  /** 0..1 share of the portfolio. */
  weight?: number;
  /** Daily / period return as a decimal. */
  changePct?: number;
}

export interface NormalizedPortfolio {
  series: PortfolioPoint[];
  holdings: Holding[];
  currency: string;
  /** Where in the raw document the series was found, useful for debugging. */
  sourceField: string | null;
}

export type RangeKey = "1D" | "1W" | "1M" | "3M" | "1Y" | "ALL";

/** Short label for the range to be displayed in the graph and badges. */
export const RANGE_SHORT_LABEL: Record<RangeKey, string> = {
  "1D": "1D",
  "1W": "1S",
  "1M": "1M",
  "3M": "3M",
  "1Y": "1A",
  ALL: "Todo",
};

/** More friendly phrase for the context ("today", "this month", etc.). */
export const RANGE_PHRASE: Record<RangeKey, string> = {
  "1D": "hoy",
  "1W": "esta semana",
  "1M": "este mes",
  "3M": "estos 3 meses",
  "1Y": "este año",
  ALL: "desde el inicio",
};
