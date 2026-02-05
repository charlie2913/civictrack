import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import LoadingSpinner from "../components/ui/LoadingSpinner";
import Modal from "../components/ui/Modal";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

type UserItem = {
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
const authModes = ["PASSWORD", "GUEST"] as const;

const UsersList = () => {
  const [items, setItems] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [authModeFilter, setAuthModeFilter] = useState("ALL");
  const [activeFilter, setActiveFilter] = useState("ALL");
  const [createOpen, setCreateOpen] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [tempForEmail, setTempForEmail] = useState<string | null>(null);
  const [confirmDeactivate, setConfirmDeactivate] = useState<UserItem | null>(null);

  const [form, setForm] = useState({
    email: "",
    name: "",
    role: "OPERATOR",
    password: "",
  });

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (roleFilter !== "ALL") params.set("role", roleFilter);
    if (authModeFilter !== "ALL") params.set("authMode", authModeFilter);
    if (activeFilter !== "ALL") params.set("isActive", activeFilter);
    return params.toString();
  }, [q, roleFilter, authModeFilter, activeFilter]);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const url = `${API_BASE}/api/admin/users${queryParams ? `?${queryParams}` : ""}`;
        const response = await fetch(url, {
          credentials: "include",
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error("No se pudieron cargar los usuarios.");
        }
        const data = (await response.json()) as { items: UserItem[] };
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
  }, [queryParams]);

  const resetForm = () => {
    setForm({ email: "", name: "", role: "OPERATOR", password: "" });
  };

  const handleCreate = async () => {
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/admin/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email: form.email,
          name: form.name || undefined,
          role: form.role,
          password: form.password || undefined,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error ?? "No se pudo crear el usuario.");
      }
      setCreateOpen(false);
      resetForm();
      setTempPassword(payload.tempPassword ?? null);
      setTempForEmail(payload.email ?? form.email);
      setItems((prev) => [
        {
          id: payload.id,
          email: payload.email,
          name: form.name || undefined,
          role: payload.role,
          authMode: "PASSWORD",
          isActive: true,
        },
        ...prev,
      ]);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error inesperado";
      setError(message);
    }
  };

  const handleResetPassword = async (user: UserItem) => {
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/admin/users/${user.id}/reset-password`, {
        method: "POST",
        credentials: "include",
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error ?? "No se pudo resetear la clave.");
      }
      setTempPassword(payload.tempPassword);
      setTempForEmail(user.email);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error inesperado";
      setError(message);
    }
  };

  const toggleActive = async (user: UserItem, next: boolean) => {
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ isActive: next }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error ?? "No se pudo actualizar el usuario.");
      }
      setItems((prev) =>
        prev.map((item) => (item.id === user.id ? { ...item, isActive: next } : item)),
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error inesperado";
      setError(message);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <LoadingSpinner label="Cargando usuarios..." />
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
          Administracion
        </p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-[var(--ct-font-display)] sm:text-4xl">
            Usuarios municipales.
          </h1>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="rounded-full bg-[var(--ct-accent)] px-5 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white transition hover:bg-[var(--ct-accent-strong)]"
          >
            Crear usuario
          </button>
        </div>
      </header>

      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          value={q}
          onChange={(event) => setQ(event.target.value)}
          placeholder="Buscar por email o nombre"
          className="min-w-[220px] flex-1 rounded-full border border-[var(--ct-border)] bg-white px-4 py-2 text-xs font-semibold text-[var(--ct-ink-muted)]"
        />
        <select
          value={roleFilter}
          onChange={(event) => setRoleFilter(event.target.value)}
          className="rounded-full border border-[var(--ct-border)] bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ct-ink-muted)]"
        >
          <option value="ALL">Todos los roles</option>
          {roles.map((role) => (
            <option key={role} value={role}>
              {role}
            </option>
          ))}
        </select>
        <select
          value={authModeFilter}
          onChange={(event) => setAuthModeFilter(event.target.value)}
          className="rounded-full border border-[var(--ct-border)] bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ct-ink-muted)]"
        >
          <option value="ALL">Todos los modos</option>
          {authModes.map((mode) => (
            <option key={mode} value={mode}>
              {mode}
            </option>
          ))}
        </select>
        <select
          value={activeFilter}
          onChange={(event) => setActiveFilter(event.target.value)}
          className="rounded-full border border-[var(--ct-border)] bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ct-ink-muted)]"
        >
          <option value="ALL">Todos</option>
          <option value="true">Activos</option>
          <option value="false">Inactivos</option>
        </select>
      </div>

      <div className="space-y-3">
        {items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--ct-border)] bg-[var(--ct-accent-soft)]/40 px-6 py-8 text-center text-sm text-[var(--ct-ink-muted)]">
            No hay usuarios con los filtros actuales.
          </div>
        ) : (
          items.map((user) => (
            <div
              key={user.id}
              className="rounded-2xl border border-[var(--ct-border)] bg-white/90 px-6 py-4 text-sm text-[var(--ct-ink-muted)] shadow-[0_18px_50px_-40px_rgba(0,0,0,0.45)]"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ct-ink-muted)]">
                    {user.role}
                  </p>
                  <p className="mt-2 text-base font-semibold text-[var(--ct-ink)]">
                    {user.email}
                  </p>
                  <p className="mt-1 text-xs">
                    {user.name ? user.name : "Sin nombre"}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2 text-[10px] font-semibold uppercase tracking-[0.2em]">
                    <span className="rounded-full border border-[var(--ct-border)] px-3 py-1">
                      {user.authMode}
                    </span>
                    <span className="rounded-full border border-[var(--ct-border)] px-3 py-1">
                      {user.isActive ? "Activo" : "Inactivo"}
                    </span>
                  </div>
                  <p className="mt-2 text-xs">
                    Creado: {user.createdAt ? new Date(user.createdAt).toLocaleString() : "N/D"}
                  </p>
                </div>
                <div className="flex flex-col items-start gap-2">
                  <Link
                    to={`/admin/users/${user.id}`}
                    className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ct-accent-strong)]"
                  >
                    Ver detalle
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleResetPassword(user)}
                    className="rounded-full border border-[var(--ct-border)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--ct-ink-muted)]"
                  >
                    Reset password
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      user.isActive
                        ? setConfirmDeactivate(user)
                        : toggleActive(user, true)
                    }
                    className="rounded-full border border-[var(--ct-border)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--ct-ink-muted)]"
                  >
                    {user.isActive ? "Desactivar" : "Activar"}
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <Modal
        open={createOpen}
        title="Crear usuario"
        description="Crea una cuenta municipal con rol definido."
        onClose={() => {
          setCreateOpen(false);
          resetForm();
        }}
        primaryLabel="Crear"
        secondaryLabel="Cancelar"
        onPrimary={handleCreate}
        intent="info"
      >
        <div className="grid gap-3 text-sm text-[var(--ct-ink-muted)]">
          <label className="grid gap-2 text-xs font-semibold uppercase tracking-[0.2em]">
            Email
            <input
              type="email"
              value={form.email}
              onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
              className="rounded-2xl border border-[var(--ct-border)] px-4 py-3 text-sm"
            />
          </label>
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
            Password (opcional)
            <input
              type="password"
              value={form.password}
              onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
              className="rounded-2xl border border-[var(--ct-border)] px-4 py-3 text-sm"
            />
          </label>
          <p className="text-xs text-[var(--ct-ink-muted)]">
            Si no ingresas password se generara una temporal.
          </p>
        </div>
      </Modal>

      <Modal
        open={!!tempPassword}
        title="Password temporal"
        description={
          tempForEmail
            ? `Copia la clave temporal para ${tempForEmail}.`
            : "Copia la clave temporal."
        }
        onClose={() => {
          setTempPassword(null);
          setTempForEmail(null);
        }}
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
        open={!!confirmDeactivate}
        title="Desactivar usuario"
        description="Confirma que deseas desactivar este usuario."
        onClose={() => setConfirmDeactivate(null)}
        primaryLabel="Desactivar"
        secondaryLabel="Cancelar"
        onPrimary={async () => {
          if (!confirmDeactivate) return;
          await toggleActive(confirmDeactivate, false);
          setConfirmDeactivate(null);
        }}
        intent="warning"
      />
    </div>
  );
};

export default UsersList;
