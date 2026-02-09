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

type HotspotsPayload = {
  byDistrict: Array<{ district: string; count: number }>;
  recurrentLocations: Array<{ lng: number; lat: number; count: number }>;
};

type BacklogMetrics = {
  buckets: Array<{ label: string; count: number }>;
  oldest: Array<{
    id: string;
    category?: string;
    status?: string;
    district?: string;
    createdAt: string;
    ageDays: number;
    effectivePriority?: string | null;
  }>;
};

const formatHours = (value: number | null) => {
  if (value === null || Number.isNaN(value)) return "N/D";
  return `${value.toFixed(1)} h`;
};

const AdminMetrics = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<MetricsSummary | null>(null);
  const [hotspots, setHotspots] = useState<HotspotsPayload | null>(null);
  const [hotspotsError, setHotspotsError] = useState<string | null>(null);
  const [backlog, setBacklog] = useState<BacklogMetrics | null>(null);
  const [backlogError, setBacklogError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    const load = async () => {
      setLoading(true);
      setError(null);
      setHotspotsError(null);
      setBacklogError(null);
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
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`${API_BASE}/api/admin/metrics/hotspots`, {
          credentials: "include",
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error("No se pudieron cargar las zonas criticas.");
        }
        const payload = (await response.json()) as HotspotsPayload;
        setHotspots(payload);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setHotspots(null);
        setHotspotsError("No se pudieron cargar las zonas criticas.");
      }

      try {
        const response = await fetch(`${API_BASE}/api/admin/metrics/backlog`, {
          credentials: "include",
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error("No se pudo cargar el backlog.");
        }
        const payload = (await response.json()) as BacklogMetrics;
        setBacklog(payload);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setBacklog(null);
        setBacklogError("No se pudo cargar el backlog.");
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
  const districtRows = useMemo(
    () =>
      hotspots
        ? [...hotspots.byDistrict].sort((a, b) => b.count - a.count)
        : [],
    [hotspots],
  );
  const recurrentRows = useMemo(
    () =>
      hotspots
        ? [...hotspots.recurrentLocations].sort((a, b) => b.count - a.count)
        : [],
    [hotspots],
  );
  const backlogBuckets = useMemo(() => backlog?.buckets ?? [], [backlog]);
  const backlogOldest = useMemo(() => backlog?.oldest ?? [], [backlog]);

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

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-[var(--ct-border)] bg-white/90 px-4 py-5 text-sm text-[var(--ct-ink-muted)] shadow-[0_18px_50px_-40px_rgba(0,0,0,0.45)]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--ct-ink-muted)]">
            Backlog por antiguedad
          </p>
          <div className="mt-4 space-y-2">
            {backlogError && (
              <p className="text-sm text-red-600">{backlogError}</p>
            )}
            {!backlogError && backlogBuckets.length === 0 && (
              <p className="text-sm text-[var(--ct-ink-muted)]">
                Sin datos disponibles.
              </p>
            )}
            {backlogBuckets.map((bucket) => (
              <div key={bucket.label} className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ct-ink)]">
                  {bucket.label}
                </span>
                <span className="text-sm font-semibold text-[var(--ct-ink-muted)]">
                  {bucket.count}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--ct-border)] bg-white/90 px-4 py-5 text-sm text-[var(--ct-ink-muted)] shadow-[0_18px_50px_-40px_rgba(0,0,0,0.45)]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--ct-ink-muted)]">
            Reportes mas antiguos
          </p>
          <div className="mt-4 space-y-2">
            {backlogError && (
              <p className="text-sm text-red-600">{backlogError}</p>
            )}
            {!backlogError && backlogOldest.length === 0 && (
              <p className="text-sm text-[var(--ct-ink-muted)]">
                Sin datos disponibles.
              </p>
            )}
            {backlogOldest.map((row) => (
              <div
                key={row.id}
                className="rounded-2xl border border-[var(--ct-border)] bg-white px-3 py-3"
              >
                <div className="flex items-center justify-between text-xs text-[var(--ct-ink-muted)]">
                  <span className="font-semibold uppercase tracking-[0.2em]">
                    #{row.id.slice(-6).toUpperCase()}
                  </span>
                  <span>{row.ageDays} dias</span>
                </div>
                <p className="mt-1 text-sm text-[var(--ct-ink)]">
                  {row.category ?? "Incidencia"} · {row.status ?? "N/D"}
                </p>
                <p className="mt-1 text-xs text-[var(--ct-ink-muted)]">
                  {row.district ?? "Sin distrito"} ·{" "}
                  {new Date(row.createdAt).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-[var(--ct-border)] bg-white/90 px-4 py-5 text-sm text-[var(--ct-ink-muted)] shadow-[0_18px_50px_-40px_rgba(0,0,0,0.45)]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--ct-ink-muted)]">
            Zonas criticas por distrito
          </p>
          <div className="mt-4 space-y-2">
            {hotspotsError && (
              <p className="text-sm text-red-600">{hotspotsError}</p>
            )}
            {!hotspotsError && districtRows.length === 0 && (
              <p className="text-sm text-[var(--ct-ink-muted)]">
                Sin datos disponibles.
              </p>
            )}
            {districtRows.map((row) => (
              <div key={row.district} className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ct-ink)]">
                  {row.district}
                </span>
                <span className="text-sm font-semibold text-[var(--ct-ink-muted)]">
                  {row.count}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--ct-border)] bg-white/90 px-4 py-5 text-sm text-[var(--ct-ink-muted)] shadow-[0_18px_50px_-40px_rgba(0,0,0,0.45)]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--ct-ink-muted)]">
            Reincidencias por ubicacion
          </p>
          <div className="mt-4 space-y-2">
            {hotspotsError && (
              <p className="text-sm text-red-600">{hotspotsError}</p>
            )}
            {!hotspotsError && recurrentRows.length === 0 && (
              <p className="text-sm text-[var(--ct-ink-muted)]">
                Sin datos disponibles.
              </p>
            )}
            {recurrentRows.map((row, index) => (
              <div
                key={`${row.lng}-${row.lat}-${index}`}
                className="flex items-center justify-between gap-3"
              >
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ct-ink)]">
                  {row.lat.toFixed(4)}, {row.lng.toFixed(4)}
                </span>
                <span className="text-sm font-semibold text-[var(--ct-ink-muted)]">
                  {row.count}
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
