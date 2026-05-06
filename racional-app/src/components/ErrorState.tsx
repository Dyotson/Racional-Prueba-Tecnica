import { AlertTriangle, RefreshCw } from "lucide-react";

interface ErrorStateProps {
  message?: string;
}

export function ErrorState({ message }: ErrorStateProps) {
  return (
    <div className="card p-10 text-center animate-fadeIn border-loss/30">
      <div className="mx-auto size-12 rounded-2xl bg-loss-soft grid place-items-center">
        <AlertTriangle className="size-5 text-loss" />
      </div>
      <h2 className="mt-4 text-lg font-semibold text-ink-primary">
        No pudimos conectar con tu portafolio
      </h2>
      <p className="mt-1.5 text-sm text-ink-secondary max-w-md mx-auto">
        {message ??
          "Hubo un problema al escuchar el documento de Firestore. Verifica tu conexión a internet o las reglas del proyecto y vuelve a intentarlo."}
      </p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="mt-5 inline-flex items-center gap-2 rounded-full bg-bg-elevated border border-edge-strong px-4 py-2 text-sm font-semibold text-ink-primary hover:bg-bg-hover transition-colors"
      >
        <RefreshCw className="size-3.5" />
        Reintentar
      </button>
    </div>
  );
}
