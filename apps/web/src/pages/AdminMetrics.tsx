import { useEffect, useMemo, useState } from "react";
import LoadingSpinner from "../components/ui/LoadingSpinner";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

type MetricsSummary = {
  totals: { all: number; open: number; closed: number };
  byStatus: Record<string, number>;
  byCategory: Record<string, number>;
  mttaHoursAvg: number | null;
  mttrHoursAvg: number | null;
};

const formatHours = (value: number | null) => {
  if (value === null || Number.isNaN(value)) return "N/D";
  return `${value.toFixed(1)} h`;
};

const AdminMetrics = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<MetricsSummary | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${API_BASE}/api/admin/metrics/summary`, {
          credentials: "include",
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error("No se pudieron cargar las metricas.");
        }
        const payload = (await response.json()) as MetricsSummary;
        setData(payload);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        const message = err instanceof Error ? err.message : "Error inesperado";
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    load();
    return () => controller.abort();
  }, []);

  const statusRows = useMemo(
    () =>
      data
        ? Object.entries(data.byStatus).sort((a, b) => b[1] - a[1])
        : [],
    [data],
  );
  const categoryRows = useMemo(
    () =>
      data
        ? Object.entries(data.byCategory).sort((a, b) => b[1] - a[1])
        : [],
    [data],
  );

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <LoadingSpinner label="Cargando metricas..." />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-xl items-center justify-center text-center text-sm text-red-600">
        {error ?? "No se pudo cargar la informacion."}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ct-ink-muted)]">
          Panel operativo
        </p>
        <h1 className="text-3xl font-[var(--ct-font-display)] sm:text-4xl">
          Metricas generales.
        </h1>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label: "Total reportes", value: data.totals.all },
          { label: "Abiertos", value: data.totals.open },
          { label: "Cerrados", value: data.totals.closed },
          { label: "MTTA promedio", value: formatHours(data.mttaHoursAvg) },
          { label: "MTTR promedio", value: formatHours(data.mttrHoursAvg) },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-2xl border border-[var(--ct-border)] bg-white/90 px-4 py-5 text-sm text-[var(--ct-ink-muted)] shadow-[0_18px_50px_-40px_rgba(0,0,0,0.45)]"
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--ct-ink-muted)]">
              {item.label}
            </p>
            <p className="mt-2 text-2xl font-semibold text-[var(--ct-ink)]">
              {item.value}
            </p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-[var(--ct-border)] bg-white/90 px-4 py-5 text-sm text-[var(--ct-ink-muted)] shadow-[0_18px_50px_-40px_rgba(0,0,0,0.45)]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--ct-ink-muted)]">
            Conteo por estado
          </p>
          <div className="mt-4 space-y-2">
            {statusRows.map(([status, count]) => (
              <div key={status} className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ct-ink)]">
                  {status}
                </span>
                <span className="text-sm font-semibold text-[var(--ct-ink-muted)]">
                  {count}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-[var(--ct-border)] bg-white/90 px-4 py-5 text-sm text-[var(--ct-ink-muted)] shadow-[0_18px_50px_-40px_rgba(0,0,0,0.45)]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--ct-ink-muted)]">
            Conteo por categoria
          </p>
          <div className="mt-4 space-y-2">
            {categoryRows.map(([category, count]) => (
              <div key={category} className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ct-ink)]">
                  {category}
                </span>
                <span className="text-sm font-semibold text-[var(--ct-ink-muted)]">
                  {count}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminMetrics;
