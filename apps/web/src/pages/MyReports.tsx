import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import LoadingSpinner from "../components/ui/LoadingSpinner";

type ReportItem = {
  id: string;
  category: string;
  status: string;
  createdAt: string;
  addressText?: string;
};

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

const MyReports = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<ReportItem[]>([]);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");

  const categories = Array.from(new Set(items.map((item) => item.category)));
  const statuses = Array.from(new Set(items.map((item) => item.status)));

  const filteredItems = items.filter((item) => {
    if (statusFilter !== "ALL" && item.status !== statusFilter) return false;
    if (categoryFilter !== "ALL" && item.category !== categoryFilter) return false;
    return true;
  });

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${API_BASE}/api/reports/mine`, {
          credentials: "include",
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error("No se pudieron cargar tus reportes.");
        }
        const data = (await response.json()) as { items: ReportItem[] };
        setItems(data.items);
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

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <LoadingSpinner label="Cargando tus reportes..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-xl items-center justify-center text-center text-sm text-red-600">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ct-ink-muted)]">
          Mis reportes
        </p>
        <h1 className="text-3xl font-[var(--ct-font-display)] sm:text-4xl">
          Seguimiento rapido de tus incidencias.
        </h1>
      </header>

      <div className="flex flex-wrap gap-3">
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          className="rounded-full border border-[var(--ct-border)] bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ct-ink-muted)]"
        >
          <option value="ALL">Todos los estados</option>
          {statuses.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
        <select
          value={categoryFilter}
          onChange={(event) => setCategoryFilter(event.target.value)}
          className="rounded-full border border-[var(--ct-border)] bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ct-ink-muted)]"
        >
          <option value="ALL">Todas las categorias</option>
          {categories.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-4">
        {filteredItems.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--ct-border)] bg-[var(--ct-accent-soft)]/40 px-6 py-8 text-center text-sm text-[var(--ct-ink-muted)]">
            Aun no tienes reportes creados.
          </div>
        ) : (
          filteredItems.map((item) => (
            <div
              key={item.id}
              className="rounded-2xl border border-[var(--ct-border)] bg-white/85 px-6 py-4 text-sm text-[var(--ct-ink-muted)] shadow-[0_18px_50px_-40px_rgba(0,0,0,0.45)]"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ct-ink-muted)]">
                {item.category}
              </p>
              <p className="mt-2 text-base font-semibold text-[var(--ct-ink)]">
                Estado: {item.status}
              </p>
              {item.addressText && <p className="mt-2">{item.addressText}</p>}
              <p className="mt-2 text-xs">
                {new Date(item.createdAt).toLocaleString()}
              </p>
              <div className="mt-3">
                <Link
                  to={`/reports/${item.id}`}
                  className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ct-accent-strong)]"
                >
                  Ver reporte →
                </Link>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default MyReports;
