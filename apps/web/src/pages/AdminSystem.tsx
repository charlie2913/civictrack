import { useEffect, useState } from "react";
import LoadingSpinner from "../components/ui/LoadingSpinner";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

type ConfigResponse = {
  photoMaxFiles: number;
  photoMaxMb: number;
  mapMaxPoints: number;
};

const AdminSystem = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [form, setForm] = useState({
    photoMaxFiles: 5,
    photoMaxMb: 5,
    mapMaxPoints: 2000,
  });

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
        setForm({
          photoMaxFiles: data.photoMaxFiles ?? 5,
          photoMaxMb: data.photoMaxMb ?? 5,
          mapMaxPoints: data.mapMaxPoints ?? 2000,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Error inesperado";
        setError(message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleSave = async () => {
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(`${API_BASE}/api/admin/config`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(form),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error ?? "No se pudo guardar.");
      }
      setForm({
        photoMaxFiles: payload.photoMaxFiles,
        photoMaxMb: payload.photoMaxMb,
        mapMaxPoints: payload.mapMaxPoints,
      });
      setSuccess("Parametros actualizados.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error inesperado";
      setError(message);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <LoadingSpinner label="Cargando parametros..." />
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
          Parametros
        </p>
        <h1 className="text-3xl font-[var(--ct-font-display)] sm:text-4xl">
          Limites del sistema.
        </h1>
      </header>

      <div className="rounded-2xl border border-[var(--ct-border)] bg-white/90 p-6 text-sm text-[var(--ct-ink-muted)] shadow-[0_18px_50px_-40px_rgba(0,0,0,0.45)]">
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="grid gap-2 text-xs font-semibold uppercase tracking-[0.2em]">
            Max fotos
            <input
              type="number"
              min={1}
              max={10}
              value={form.photoMaxFiles}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, photoMaxFiles: Number(event.target.value) }))
              }
              className="rounded-2xl border border-[var(--ct-border)] px-4 py-3 text-sm"
            />
          </label>
          <label className="grid gap-2 text-xs font-semibold uppercase tracking-[0.2em]">
            Max MB por foto
            <input
              type="number"
              min={1}
              max={10}
              value={form.photoMaxMb}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, photoMaxMb: Number(event.target.value) }))
              }
              className="rounded-2xl border border-[var(--ct-border)] px-4 py-3 text-sm"
            />
          </label>
          <label className="grid gap-2 text-xs font-semibold uppercase tracking-[0.2em]">
            Max puntos mapa
            <input
              type="number"
              min={100}
              max={5000}
              value={form.mapMaxPoints}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, mapMaxPoints: Number(event.target.value) }))
              }
              className="rounded-2xl border border-[var(--ct-border)] px-4 py-3 text-sm"
            />
          </label>
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

export default AdminSystem;
