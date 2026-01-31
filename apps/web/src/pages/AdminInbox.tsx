import { useEffect, useMemo, useState } from "react";
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

const AdminInbox = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<ReportItem[]>([]);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [query, setQuery] = useState("");

  const categories = useMemo(
    () => Array.from(new Set(items.map((item) => item.category))),
    [items],
  );
  const statuses = useMemo(
    () => Array.from(new Set(items.map((item) => item.status))),
    [items],
  );

  useEffect(() => {
    const controller = new AbortController();

    const fetchFrom = async (basePath: string) => {
      const url = new URL(`${API_BASE}${basePath}`);
      if (statusFilter !== "ALL") url.searchParams.set("status", statusFilter);
      if (categoryFilter !== "ALL") url.searchParams.set("category", categoryFilter);
      if (query.trim()) url.searchParams.set("q", query.trim());

      const response = await fetch(url.toString(), {
        credentials: "include",
        signal: controller.signal,
      });
      return response;
    };

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        let response = await fetchFrom("/api/admin/reports");
        if (response.status === 404) {
          response = await fetchFrom("/api/reports/admin/list");
        }
        if (!response.ok) {
          throw new Error("No se pudo cargar la bandeja administrativa.");
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
  }, [statusFilter, categoryFilter, query]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <LoadingSpinner label="Cargando bandeja..." />
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
          Bandeja operativa
        </p>
        <h1 className="text-3xl font-[var(--ct-font-display)] sm:text-4xl">
          Reportes para gestion administrativa.
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
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar por descripcion o direccion"
          className="min-w-[220px] flex-1 rounded-full border border-[var(--ct-border)] bg-white px-4 py-2 text-xs font-semibold text-[var(--ct-ink-muted)]"
        />
      </div>

      <div className="space-y-4">
        {items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--ct-border)] bg-[var(--ct-accent-soft)]/40 px-6 py-8 text-center text-sm text-[var(--ct-ink-muted)]">
            No hay reportes con los filtros actuales.
          </div>
        ) : (
          items.map((item) => (
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
                  to={`/admin/reports/${item.id}`}
                  className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ct-accent-strong)]"
                >
                  Ver →
                </Link>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default AdminInbox;
