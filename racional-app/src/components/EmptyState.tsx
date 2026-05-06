import { Inbox } from "lucide-react";

interface EmptyStateProps {
  title?: string;
  description?: string;
}

export function EmptyState({
  title = "Aún no hay datos para mostrar",
  description = "Estamos escuchando tu portafolio en tiempo real. En cuanto Firestore reporte el primer registro, lo verás aquí.",
}: EmptyStateProps) {
  return (
    <div className="card p-10 text-center animate-fadeIn">
      <div className="mx-auto size-12 rounded-2xl bg-bg-elevated grid place-items-center border border-edge-subtle">
        <Inbox className="size-5 text-ink-secondary" />
      </div>
      <h2 className="mt-4 text-lg font-semibold text-ink-primary">{title}</h2>
      <p className="mt-1.5 text-sm text-ink-secondary max-w-md mx-auto">
        {description}
      </p>
    </div>
  );
}
