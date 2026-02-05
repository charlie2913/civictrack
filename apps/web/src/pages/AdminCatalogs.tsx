import { useEffect, useState } from "react";
import LoadingSpinner from "../components/ui/LoadingSpinner";
import Modal from "../components/ui/Modal";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

type ConfigResponse = {
  reportCategories: string[];
};

const AdminCatalogs = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [newCategory, setNewCategory] = useState("");
  const [removeTarget, setRemoveTarget] = useState<string | null>(null);

  const loadConfig = async () => {
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
      setCategories(data.reportCategories ?? []);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error inesperado";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  const handleSave = async () => {
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(`${API_BASE}/api/admin/config`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ reportCategories: categories }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error ?? "No se pudo guardar.");
      }
      setCategories(payload.reportCategories ?? categories);
      setSuccess("Categorias guardadas.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error inesperado";
      setError(message);
    }
  };

  const handleAdd = () => {
    const value = newCategory.trim().toUpperCase();
    if (!value) return;
    if (categories.includes(value)) return;
    setCategories((prev) => [...prev, value]);
    setNewCategory("");
  };

  const handleRemove = (category: string) => {
    setCategories((prev) => prev.filter((item) => item !== category));
    setRemoveTarget(null);
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <LoadingSpinner label="Cargando catalogos..." />
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
          Catalogos
        </p>
        <h1 className="text-3xl font-[var(--ct-font-display)] sm:text-4xl">
          Categorias de reportes.
        </h1>
      </header>

      <div className="rounded-2xl border border-[var(--ct-border)] bg-white/90 p-6 text-sm text-[var(--ct-ink-muted)] shadow-[0_18px_50px_-40px_rgba(0,0,0,0.45)]">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex-1 text-xs font-semibold uppercase tracking-[0.2em]">
            Nueva categoria
            <input
              type="text"
              value={newCategory}
              onChange={(event) => setNewCategory(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-[var(--ct-border)] px-4 py-3 text-sm"
            />
          </label>
          <button
            type="button"
            onClick={handleAdd}
            className="rounded-full border border-[var(--ct-border)] px-5 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ct-ink-muted)]"
          >
            Agregar
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="rounded-full bg-[var(--ct-accent)] px-5 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white transition hover:bg-[var(--ct-accent-strong)]"
          >
            Guardar
          </button>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => (
            <div
              key={category}
              className="flex items-center justify-between rounded-2xl border border-[var(--ct-border)] bg-white px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em]"
            >
              <span>{category}</span>
              <button
                type="button"
                onClick={() => setRemoveTarget(category)}
                className="rounded-full border border-[var(--ct-border)] px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.2em] text-[var(--ct-ink-muted)]"
              >
                Quitar
              </button>
            </div>
          ))}
        </div>

        {success && (
          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ct-accent-strong)]">
            {success}
          </p>
        )}
      </div>

      <Modal
        open={!!removeTarget}
        title="Eliminar categoria"
        description="Confirma que deseas eliminar esta categoria."
        onClose={() => setRemoveTarget(null)}
        primaryLabel="Eliminar"
        secondaryLabel="Cancelar"
        onPrimary={() => {
          if (removeTarget) handleRemove(removeTarget);
        }}
        intent="warning"
      />
    </div>
  );
};

export default AdminCatalogs;
