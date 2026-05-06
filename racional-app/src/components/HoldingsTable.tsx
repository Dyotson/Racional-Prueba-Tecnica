import { ArrowDown, ArrowUp } from "lucide-react";
import type { Holding } from "../lib/types";
import { formatMoney, formatNumber, formatPercent } from "../lib/formatters";

interface HoldingsTableProps {
  holdings: Holding[];
  currency: string;
}

export function HoldingsTable({ holdings, currency }: HoldingsTableProps) {
  if (holdings.length === 0) return null;

  return (
    <section className="card p-4 md:p-6 animate-fadeIn">
      <header className="flex items-baseline justify-between mb-3 px-1">
        <h2 className="text-sm font-semibold text-ink-secondary tracking-wide">
          Posiciones
        </h2>
        <span className="text-[11px] uppercase tracking-wider text-ink-tertiary">
          {holdings.length} activos
        </span>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-wider text-ink-tertiary">
              <th className="text-left font-medium py-2 pl-2">Activo</th>
              <th className="text-right font-medium py-2 hidden sm:table-cell">
                Cantidad
              </th>
              <th className="text-right font-medium py-2 hidden md:table-cell">
                Precio
              </th>
              <th className="text-right font-medium py-2">Valor</th>
              <th className="text-right font-medium py-2 hidden sm:table-cell">
                Peso
              </th>
              <th className="text-right font-medium py-2 pr-2">Cambio</th>
            </tr>
          </thead>
          <tbody>
            {holdings.map((h) => {
              const tone =
                h.changePct == null
                  ? "text-ink-tertiary"
                  : h.changePct >= 0
                    ? "text-gain"
                    : "text-loss";
              const Icon =
                h.changePct == null
                  ? null
                  : h.changePct >= 0
                    ? ArrowUp
                    : ArrowDown;
              return (
                <tr
                  key={h.symbol}
                  className="border-t border-edge-subtle hover:bg-bg-hover/50 transition-colors"
                >
                  <td className="py-2.5 pl-2">
                    <div className="flex items-center gap-2.5">
                      <div className="size-7 rounded-full bg-bg-elevated border border-edge-subtle grid place-items-center text-[10px] font-bold text-ink-secondary">
                        {h.symbol.slice(0, 3).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-ink-primary truncate">
                          {h.symbol}
                        </p>
                        {h.name && (
                          <p className="text-[11px] text-ink-tertiary truncate">
                            {h.name}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="py-2.5 text-right num-tabular text-ink-secondary hidden sm:table-cell">
                    {h.quantity != null ? formatNumber(h.quantity, 4) : "—"}
                  </td>
                  <td className="py-2.5 text-right num-tabular text-ink-secondary hidden md:table-cell">
                    {h.price != null ? formatMoney(h.price, currency) : "—"}
                  </td>
                  <td className="py-2.5 text-right num-tabular font-semibold">
                    {formatMoney(h.value, currency)}
                  </td>
                  <td className="py-2.5 text-right num-tabular text-ink-secondary hidden sm:table-cell">
                    {h.weight != null ? formatPercent(h.weight, { digits: 1 }) : "—"}
                  </td>
                  <td className={`py-2.5 pr-2 text-right num-tabular ${tone}`}>
                    <span className="inline-flex items-center gap-1 justify-end">
                      {Icon && <Icon className="size-3" strokeWidth={2.5} />}
                      {h.changePct != null
                        ? formatPercent(h.changePct, { signed: true })
                        : "—"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
