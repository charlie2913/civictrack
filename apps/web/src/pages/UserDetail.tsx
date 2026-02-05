import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import LoadingSpinner from "../components/ui/LoadingSpinner";
import Modal from "../components/ui/Modal";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

type UserDetail = {
  id: string;
  email: string;
  name?: string;
  role: string;
  authMode: string;
  isActive: boolean;
  createdAt?: string;
  lastLoginAt?: string;
};

const roles = ["ADMIN", "OPERATOR", "SUPERVISOR", "CITIZEN"] as const;

const UserDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<UserDetail | null>(null);
  const [form, setForm] = useState({ name: "", role: "OPERATOR", isActive: true });
  const [saving, setSaving] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);
  const [convertForm, setConvertForm] = useState({ password: "", confirm: "" });

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${API_BASE}/api/admin/users/${id}`, {
          credentials: "include",
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error("No se pudo cargar el usuario.");
        }
        const data = (await response.json()) as UserDetail;
        setUser(data);
        setForm({
          name: data.name ?? "",
          role: data.role,
          isActive: data.isActive,
        });
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        const message = err instanceof Error ? err.message : "Error inesperado";
        setError(message);
      } finally {
        setLoading(false);
      }
    };
    if (id) load();
    return () => controller.abort();
  }, [id]);

  const handleSave = async () => {
    if (!id) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(form),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error ?? "No se pudo guardar.");
      }
      setUser(payload);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error inesperado";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const resetPassword = async () => {
    if (!id) return;
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/admin/users/${id}/reset-password`, {
        method: "POST",
        credentials: "include",
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error ?? "No se pudo resetear la clave.");
      }
      setTempPassword(payload.tempPassword);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error inesperado";
      setError(message);
    }
  };

  const convertGuest = async () => {
    if (!id) return;
    if (!convertForm.password || convertForm.password !== convertForm.confirm) {
      setError("Passwords no coinciden.");
      return;
    }
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/admin/users/${id}/convert-guest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ password: convertForm.password }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error ?? "No se pudo convertir.");
      }
      setUser((prev) => (prev ? { ...prev, authMode: "PASSWORD" } : prev));
      setConvertForm({ password: "", confirm: "" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error inesperado";
      setError(message);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <LoadingSpinner label="Cargando usuario..." />
      </div>
    );
  }

  if (error || !user) {
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
          Usuarios
        </p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-[var(--ct-font-display)] sm:text-4xl">
            {user.email}
          </h1>
          <button
            type="button"
            onClick={() => navigate("/admin/users")}
            className="rounded-full border border-[var(--ct-border)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ct-ink-muted)]"
          >
            Volver
          </button>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-2xl border border-[var(--ct-border)] bg-white/90 px-6 py-5 text-sm text-[var(--ct-ink-muted)] shadow-[0_18px_50px_-40px_rgba(0,0,0,0.45)]">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ct-ink-muted)]">
            Datos generales
          </p>
          <div className="mt-4 grid gap-3">
            <label className="grid gap-2 text-xs font-semibold uppercase tracking-[0.2em]">
              Nombre
              <input
                type="text"
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                className="rounded-2xl border border-[var(--ct-border)] px-4 py-3 text-sm"
              />
            </label>
            <label className="grid gap-2 text-xs font-semibold uppercase tracking-[0.2em]">
              Rol
              <select
                value={form.role}
                onChange={(event) => setForm((prev) => ({ ...prev, role: event.target.value }))}
                className="rounded-2xl border border-[var(--ct-border)] px-4 py-3 text-sm"
              >
                {roles.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-xs font-semibold uppercase tracking-[0.2em]">
              Estado
              <select
                value={form.isActive ? "true" : "false"}
                onChange={(event) => {
                  const next = event.target.value === "true";
                  if (!next) {
                    setConfirmDeactivate(true);
                  } else {
                    setForm((prev) => ({ ...prev, isActive: true }));
                  }
                }}
                className="rounded-2xl border border-[var(--ct-border)] px-4 py-3 text-sm"
              >
                <option value="true">Activo</option>
                <option value="false">Inactivo</option>
              </select>
            </label>
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded-full bg-[var(--ct-accent)] px-5 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white transition hover:bg-[var(--ct-accent-strong)] disabled:opacity-70"
            >
              {saving ? "Guardando..." : "Guardar"}
            </button>
            <button
              type="button"
              onClick={resetPassword}
              className="rounded-full border border-[var(--ct-border)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ct-ink-muted)]"
            >
              Reset password
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-[var(--ct-border)] bg-white/90 px-6 py-5 text-sm text-[var(--ct-ink-muted)] shadow-[0_18px_50px_-40px_rgba(0,0,0,0.45)]">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ct-ink-muted)]">
              Estado de cuenta
            </p>
            <div className="mt-3 grid gap-2 text-xs">
              <p>
                Auth mode: <span className="font-semibold">{user.authMode}</span>
              </p>
              <p>
                Creado:{" "}
                {user.createdAt ? new Date(user.createdAt).toLocaleString() : "N/D"}
              </p>
              <p>
                Ultimo login:{" "}
                {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : "N/D"}
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--ct-border)] bg-white/90 px-6 py-5 text-sm text-[var(--ct-ink-muted)] shadow-[0_18px_50px_-40px_rgba(0,0,0,0.45)]">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ct-ink-muted)]">
              Seguridad
            </p>
            {user.authMode === "GUEST" ? (
              <div className="mt-4 grid gap-3">
                <label className="grid gap-2 text-xs font-semibold uppercase tracking-[0.2em]">
                  Password
                  <input
                    type="password"
                    value={convertForm.password}
                    onChange={(event) =>
                      setConvertForm((prev) => ({ ...prev, password: event.target.value }))
                    }
                    className="rounded-2xl border border-[var(--ct-border)] px-4 py-3 text-sm"
                  />
                </label>
                <label className="grid gap-2 text-xs font-semibold uppercase tracking-[0.2em]">
                  Confirmar
                  <input
                    type="password"
                    value={convertForm.confirm}
                    onChange={(event) =>
                      setConvertForm((prev) => ({ ...prev, confirm: event.target.value }))
                    }
                    className="rounded-2xl border border-[var(--ct-border)] px-4 py-3 text-sm"
                  />
                </label>
                <button
                  type="button"
                  onClick={convertGuest}
                  className="rounded-full bg-[var(--ct-accent)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white"
                >
                  Convertir a cuenta
                </button>
              </div>
            ) : (
              <p className="mt-3 text-xs text-[var(--ct-ink-muted)]">
                Este usuario ya tiene credenciales.
              </p>
            )}
          </div>
        </div>
      </div>

      <Modal
        open={!!tempPassword}
        title="Password temporal"
        description="Copia la clave temporal y compártela solo una vez."
        onClose={() => setTempPassword(null)}
        primaryLabel="Copiar"
        secondaryLabel="Cerrar"
        onPrimary={async () => {
          if (!tempPassword) return;
          await navigator.clipboard.writeText(tempPassword);
        }}
        intent="info"
      >
        <div className="rounded-2xl border border-dashed border-[var(--ct-border)] bg-[var(--ct-accent-soft)]/40 px-4 py-3 text-center text-lg font-semibold text-[var(--ct-ink)]">
          {tempPassword}
        </div>
      </Modal>

      <Modal
        open={confirmDeactivate}
        title="Desactivar usuario"
        description="Confirma que deseas desactivar este usuario."
        onClose={() => setConfirmDeactivate(false)}
        primaryLabel="Desactivar"
        secondaryLabel="Cancelar"
        onPrimary={() => {
          setForm((prev) => ({ ...prev, isActive: false }));
          setConfirmDeactivate(false);
        }}
        intent="warning"
      />
    </div>
  );
};

export default UserDetailPage;
