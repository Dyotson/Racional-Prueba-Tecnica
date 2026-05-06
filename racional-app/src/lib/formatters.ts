import { format, formatDistanceToNowStrict } from "date-fns";
import { es } from "date-fns/locale";

const localeForCurrency = (currency: string): string => {
  const upper = currency.toUpperCase();
  if (upper === "CLP" || upper === "ARS" || upper === "MXN") return "es-CL";
  if (upper === "EUR") return "es-ES";
  return "en-US";
};

const fractionDigitsForCurrency = (currency: string): number => {
  const upper = currency.toUpperCase();
  if (upper === "CLP" || upper === "JPY" || upper === "KRW") return 0;
  return 2;
};

export function formatMoney(
  value: number,
  currency: string,
  options?: { signed?: boolean; compact?: boolean },
): string {
  if (!Number.isFinite(value)) return "—";
  const fractionDigits = fractionDigitsForCurrency(currency);
  const formatter = new Intl.NumberFormat(localeForCurrency(currency), {
    style: "currency",
    currency,
    minimumFractionDigits: options?.compact ? 0 : fractionDigits,
    maximumFractionDigits: options?.compact ? 1 : fractionDigits,
    notation: options?.compact ? "compact" : "standard",
    signDisplay: options?.signed ? "exceptZero" : "auto",
  });
  return formatter.format(value);
}

export function formatPercent(
  value: number,
  options?: { signed?: boolean; digits?: number },
): string {
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("es-CL", {
    style: "percent",
    minimumFractionDigits: options?.digits ?? 2,
    maximumFractionDigits: options?.digits ?? 2,
    signDisplay: options?.signed ? "exceptZero" : "auto",
  }).format(value);
}

export function formatNumber(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("es-CL", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

export function formatDate(t: number, pattern = "d MMM yyyy"): string {
  return format(t, pattern, { locale: es });
}

export function formatDateTime(t: number): string {
  return format(t, "d MMM yyyy · HH:mm", { locale: es });
}

export function formatTime(t: number): string {
  return format(t, "HH:mm:ss", { locale: es });
}

export function formatRelative(t: number): string {
  return formatDistanceToNowStrict(t, { locale: es, addSuffix: true });
}
