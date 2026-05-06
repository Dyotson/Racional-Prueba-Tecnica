import { useEffect, useMemo, useState } from "react";
import { Header } from "./components/Header";
import { PortfolioSummary } from "./components/PortfolioSummary";
import { PortfolioChart } from "./components/PortfolioChart";
import { RangeSelector } from "./components/RangeSelector";
import { StatsGrid } from "./components/StatsGrid";
import { HoldingsTable } from "./components/HoldingsTable";
import { SkeletonChart } from "./components/SkeletonChart";
import { EmptyState } from "./components/EmptyState";
import { ErrorState } from "./components/ErrorState";
import { useInvestmentEvolution } from "./hooks/useInvestmentEvolution";
import { availableRanges, filterByRange } from "./lib/stats";
import type { RangeKey } from "./lib/types";

export default function App() {
  const { portfolio, status, lastUpdated, error } = useInvestmentEvolution();
  const [range, setRange] = useState<RangeKey>("ALL");

  const ranges = useMemo(
    () =>
      portfolio ? availableRanges(portfolio.series) : (["ALL"] as RangeKey[]),
    [portfolio],
  );

  // Auto-promote selection if the previously chosen range no longer fits the data.
  useEffect(() => {
    if (!ranges.includes(range)) setRange(ranges[ranges.length - 1] ?? "ALL");
  }, [ranges, range]);

  const filteredSeries = useMemo(
    () => (portfolio ? filterByRange(portfolio.series, range) : []),
    [portfolio, range],
  );

  const showSkeleton = status === "connecting" && !portfolio;
  const showError = status === "error";
  const showEmpty =
    status === "empty" || (portfolio && portfolio.series.length === 0);
  const showContent = !!portfolio && portfolio.series.length > 0 && !showError;

  return (
    <div className="min-h-full">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-10 space-y-6">
        <Header status={status} lastUpdated={lastUpdated} />

        {showSkeleton && <SkeletonChart />}

        {showError && <ErrorState message={error?.message} />}

        {!showSkeleton && !showError && showEmpty && <EmptyState />}

        {showContent && portfolio && (
          <>
            <PortfolioSummary
              series={filteredSeries}
              currency={portfolio.currency}
              range={range}
            />

            <div className="flex items-center justify-between flex-wrap gap-3">
              <h2 className="text-sm font-semibold text-ink-secondary tracking-wide">
                Evolución del portafolio
              </h2>
              <RangeSelector
                value={range}
                onChange={setRange}
                available={ranges}
              />
            </div>

            <PortfolioChart
              series={filteredSeries}
              currency={portfolio.currency}
              range={range}
            />

            <StatsGrid
              series={filteredSeries}
              currency={portfolio.currency}
              range={range}
            />

            <HoldingsTable
              holdings={portfolio.holdings}
              currency={portfolio.currency}
            />
          </>
        )}

        <footer className="pt-4 pb-2 text-center text-[11px] text-ink-tertiary">
          Programado por{" "}
          <a href="https://github.com/Dyotson" className="text-accent">
            Dyotson
          </a>
        </footer>
      </div>
    </div>
  );
}
