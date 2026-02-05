import { useEffect, useState } from "react";
import LoadingSpinner from "../components/ui/LoadingSpinner";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

const events = [
  "STATUS_SCHEDULED",
  "STATUS_RESOLVED",
  "STATUS_CLOSED",
  "STATUS_REOPENED",
] as const;

type ConfigResponse = {
  notificationEvents: string[];
};

const AdminNotifications = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${API_BASE}/api/admin/config`, {
          credentials: "include",
        });
        if (!response.ok) {
          throw new Error("No se pudo cargar la configuracion.");
        }
        const data = (await response.json()) as ConfigResponse;
        setSelected(data.notificationEvents ?? []);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Error inesperado";
        setError(message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const toggle = (value: string) => {
    setSelected((prev) =>
      prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value],
    );
  };

  const handleSave = async () => {
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(`${API_BASE}/api/admin/config`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ notificationEvents: selected }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error ?? "No se pudo guardar.");
      }
      setSelected(payload.notificationEvents ?? selected);
      setSuccess("Notificaciones actualizadas.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error inesperado";
      setError(message);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <LoadingSpinner label="Cargando notificaciones..." />
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
          Notificaciones
        </p>
        <h1 className="text-3xl font-[var(--ct-font-display)] sm:text-4xl">
          Eventos activos.
        </h1>
      </header>

      <div className="rounded-2xl border border-[var(--ct-border)] bg-white/90 p-6 text-sm text-[var(--ct-ink-muted)] shadow-[0_18px_50px_-40px_rgba(0,0,0,0.45)]">
        <div className="grid gap-3 sm:grid-cols-2">
          {events.map((event) => (
            <label
              key={event}
              className="flex items-center justify-between rounded-2xl border border-[var(--ct-border)] bg-white px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em]"
            >
              <span>{event}</span>
              <input
                type="checkbox"
                checked={selected.includes(event)}
                onChange={() => toggle(event)}
                className="h-4 w-4 accent-[var(--ct-accent)]"
              />
            </label>
          ))}
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleSave}
            className="rounded-full bg-[var(--ct-accent)] px-5 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white transition hover:bg-[var(--ct-accent-strong)]"
          >
            Guardar
          </button>
          {success && (
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ct-accent-strong)]">
              {success}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminNotifications;
