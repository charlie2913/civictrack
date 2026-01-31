import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import LoadingSpinner from "../components/ui/LoadingSpinner";

type StatusHistoryItem = {
  status: string;
  at: string;
  by?: string | null;
  note?: string | null;
};

type ReportDetailData = {
  id: string;
  category: string;
  description: string;
  location?: { coordinates?: [number, number] };
  status: string;
  createdAt: string;
  addressText?: string;
  photoUrls?: string[];
  statusHistory?: StatusHistoryItem[];
};

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

const statusFlow: Record<string, string[]> = {
  RECEIVED: ["VERIFIED"],
  VERIFIED: ["SCHEDULED"],
  SCHEDULED: ["IN_PROGRESS"],
  IN_PROGRESS: ["RESOLVED"],
  RESOLVED: ["CLOSED"],
  CLOSED: ["REOPENED"],
  REOPENED: ["IN_PROGRESS", "VERIFIED"],
};

const allStatuses = Object.keys(statusFlow);

const AdminReportDetail = () => {
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<ReportDetailData | null>(null);
  const [nextStatus, setNextStatus] = useState("");
  const [note, setNote] = useState("");
  const [updating, setUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);

  const timeline = useMemo(() => {
    return [...(report?.statusHistory ?? [])].sort(
      (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime(),
    );
  }, [report?.statusHistory]);

  const allowedNext = useMemo(() => {
    if (!report) return [];
    return statusFlow[report.status] ?? [];
  }, [report]);

  const coordinates = report?.location?.coordinates;
  const lat = coordinates ? coordinates[1] : null;
  const lng = coordinates ? coordinates[0] : null;
  const gallery = report?.photoUrls ?? [];

  const fetchReport = async (signal?: AbortSignal) => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/reports/${id}`, {
        credentials: "include",
        signal,
      });
      if (!response.ok) {
        if (response.status === 403) {
          throw new Error("No tienes permisos para ver este reporte.");
        }
        if (response.status === 404) {
          throw new Error("Reporte no encontrado.");
        }
        throw new Error("No se pudo cargar el reporte.");
      }
      const data = (await response.json()) as ReportDetailData;
      setReport(data);
      setNextStatus("");
      setNote("");
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      const message = err instanceof Error ? err.message : "Error inesperado";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    fetchReport(controller.signal);
    return () => controller.abort();
  }, [id]);

  const handleUpdateStatus = async () => {
    if (!id || !nextStatus) return;
    setUpdating(true);
    setUpdateError(null);
    try {
      const response = await fetch(`${API_BASE}/api/reports/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: nextStatus, note: note.trim() || undefined }),
      });
      if (!response.ok) {
        if (response.status === 403) {
          throw new Error("No tienes permisos para actualizar el estado.");
        }
        if (response.status === 400) {
          const body = (await response.json().catch(() => null)) as
            | { error?: string }
            | null;
          throw new Error(body?.error ?? "Transicion invalida.");
        }
        throw new Error("No se pudo actualizar el estado.");
      }
      await fetchReport();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error inesperado";
      setUpdateError(message);
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <LoadingSpinner label="Cargando detalle administrativo..." />
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

  if (!report) {
    return null;
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ct-ink-muted)]">
          Detalle administrativo
        </p>
        <h1 className="text-3xl font-[var(--ct-font-display)] sm:text-4xl">
          Reporte {report.id}
        </h1>
        <p className="text-sm text-[var(--ct-ink-muted)]">
          Estado actual: <span className="font-semibold">{report.status}</span>
        </p>
      </header>

      <div className="grid gap-6">
        <div className="rounded-[2rem] border border-[var(--ct-border)] bg-white/85 p-6 text-sm text-[var(--ct-ink-muted)] shadow-[0_20px_60px_-45px_rgba(0,0,0,0.45)]">
          <p>
            <span className="font-semibold text-[var(--ct-ink)]">Categoria:</span>{" "}
            {report.category}
          </p>
          <p className="mt-2">{report.description}</p>
          {report.addressText && (
            <p className="mt-2">
              <span className="font-semibold text-[var(--ct-ink)]">
                Referencia:
              </span>{" "}
              {report.addressText}
            </p>
          )}
          {lat !== null && lng !== null && (
            <p className="mt-2">
              <span className="font-semibold text-[var(--ct-ink)]">
                Coordenadas:
              </span>{" "}
              {lat.toFixed(6)}, {lng.toFixed(6)}
            </p>
          )}
          <p className="mt-2">
            <span className="font-semibold text-[var(--ct-ink)]">Creado:</span>{" "}
            {new Date(report.createdAt).toLocaleString()}
          </p>
        </div>

        <div className="rounded-[2rem] border border-[var(--ct-border)] bg-white/85 p-6 text-sm text-[var(--ct-ink-muted)] shadow-[0_20px_60px_-45px_rgba(0,0,0,0.45)]">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ct-ink-muted)]">
            Evidencias
          </p>
          {gallery.length === 0 ? (
            <p className="mt-3 text-sm">No hay fotos adjuntas.</p>
          ) : (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {gallery.map((url) => {
                const fullUrl = url.startsWith("http") ? url : `${API_BASE}${url}`;
                return (
                  <img
                    key={url}
                    src={fullUrl}
                    alt="Evidencia"
                    className="h-44 w-full rounded-2xl object-cover"
                  />
                );
              })}
            </div>
          )}
        </div>

        <div className="rounded-[2rem] border border-[var(--ct-border)] bg-white/85 p-6 text-sm text-[var(--ct-ink-muted)] shadow-[0_20px_60px_-45px_rgba(0,0,0,0.45)]">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ct-ink-muted)]">
            Cambiar estado
          </p>
          <div className="mt-4 space-y-4">
            <select
              value={nextStatus}
              onChange={(event) => setNextStatus(event.target.value)}
              className="w-full rounded-2xl border border-[var(--ct-border)] bg-white px-4 py-3 text-sm outline-none transition focus:border-[var(--ct-accent)]"
            >
              <option value="">Selecciona un nuevo estado</option>
              {allStatuses.map((status) => (
                <option
                  key={status}
                  value={status}
                  disabled={!allowedNext.includes(status)}
                >
                  {status}
                </option>
              ))}
            </select>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={3}
              placeholder="Nota interna (opcional)"
              className="w-full resize-none rounded-2xl border border-[var(--ct-border)] bg-white px-4 py-3 text-sm outline-none transition focus:border-[var(--ct-accent)]"
            />
            {updateError && (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {updateError}
              </div>
            )}
            <button
              type="button"
              onClick={handleUpdateStatus}
              disabled={!nextStatus || updating}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--ct-accent)] px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--ct-accent-strong)] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {updating ? <LoadingSpinner label="Actualizando..." /> : "Actualizar estado"}
            </button>
          </div>
        </div>

        <div className="rounded-[2rem] border border-[var(--ct-border)] bg-white/85 p-6 text-sm text-[var(--ct-ink-muted)] shadow-[0_20px_60px_-45px_rgba(0,0,0,0.45)]">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ct-ink-muted)]">
            Bitacora
          </p>
          {timeline.length === 0 ? (
            <p className="mt-3 text-sm">Sin cambios registrados.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {timeline.map((item, index) => (
                <div
                  key={`${item.status}-${item.at}-${index}`}
                  className="rounded-2xl border border-[var(--ct-border)] bg-[var(--ct-accent-soft)]/40 px-4 py-3"
                >
                  <p className="text-sm font-semibold text-[var(--ct-ink)]">
                    {item.status}
                  </p>
                  <p className="text-xs text-[var(--ct-ink-muted)]">
                    {new Date(item.at).toLocaleString()}
                  </p>
                  {item.by && (
                    <p className="text-xs text-[var(--ct-ink-muted)]">by: {item.by}</p>
                  )}
                  {item.note && (
                    <p className="text-xs text-[var(--ct-ink-muted)]">Nota: {item.note}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminReportDetail;
