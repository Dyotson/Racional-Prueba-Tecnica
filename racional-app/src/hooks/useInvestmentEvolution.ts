import { useEffect, useMemo, useRef, useState } from "react";
import { doc, onSnapshot, type FirestoreError } from "firebase/firestore";
import { db, INVESTMENT_DOC_PATH } from "../lib/firebase";
import { normalizePortfolio } from "../lib/normalize";
import type { ConnectionStatus, NormalizedPortfolio } from "../lib/types";

const STALE_AFTER_MS = 30_000;

interface UseInvestmentEvolutionResult {
  portfolio: NormalizedPortfolio | null;
  raw: Record<string, unknown> | null;
  status: ConnectionStatus;
  lastUpdated: Date | null;
  error: FirestoreError | null;
}

/**
 * Subscribes to `investmentEvolutions/user1` and exposes the normalized
 * portfolio along with a connection status that flips to "stale" if no update
 * is received within STALE_AFTER_MS.
 */
export function useInvestmentEvolution(): UseInvestmentEvolutionResult {
  const [raw, setRaw] = useState<Record<string, unknown> | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState<FirestoreError | null>(null);
  const staleTimer = useRef<number | null>(null);

  useEffect(() => {
    const ref = doc(db, INVESTMENT_DOC_PATH.collection, INVESTMENT_DOC_PATH.document);
    setStatus("connecting");

    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          setRaw(null);
          setStatus("empty");
          setLastUpdated(new Date());
          return;
        }
        const data = snap.data() as Record<string, unknown>;
        setRaw(data);
        setLastUpdated(new Date());
        setStatus("live");
        setError(null);

        if (staleTimer.current) window.clearTimeout(staleTimer.current);
        staleTimer.current = window.setTimeout(() => {
          setStatus((prev) => (prev === "live" ? "stale" : prev));
        }, STALE_AFTER_MS);
      },
      (err) => {
        setError(err);
        setStatus("error");
        // eslint-disable-next-line no-console
        console.error("[useInvestmentEvolution] Firestore error", err);
      },
    );

    return () => {
      if (staleTimer.current) window.clearTimeout(staleTimer.current);
      unsub();
    };
  }, []);

  const portfolio = useMemo(() => (raw ? normalizePortfolio(raw) : null), [raw]);

  // Surface schema info exactly once so reviewers can see what we received.
  const loggedRef = useRef(false);
  useEffect(() => {
    if (!portfolio || loggedRef.current) return;
    loggedRef.current = true;
    // eslint-disable-next-line no-console
    console.info(
      "[useInvestmentEvolution] First snapshot received",
      {
        sourceField: portfolio.sourceField,
        points: portfolio.series.length,
        holdings: portfolio.holdings.length,
        currency: portfolio.currency,
      },
      raw,
    );
  }, [portfolio, raw]);

  // Derive an "empty" status when the document had no usable series.
  const finalStatus: ConnectionStatus = useMemo(() => {
    if (status !== "live" && status !== "stale") return status;
    if (portfolio && portfolio.series.length === 0) return "empty";
    return status;
  }, [status, portfolio]);

  return { portfolio, raw, status: finalStatus, lastUpdated, error };
}
