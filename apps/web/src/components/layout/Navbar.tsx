import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import LoadingSpinner from "../ui/LoadingSpinner";

const navLinkBase =
  "rounded-full px-4 py-2 text-sm font-semibold transition hover:text-[var(--ct-accent-strong)]";

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `${navLinkBase} ${
    isActive
      ? "bg-[var(--ct-accent-soft)] text-[var(--ct-accent-strong)]"
      : "text-[var(--ct-ink-muted)]"
  }`;

const Navbar = () => {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/", { replace: true });
  };

  return (
    <header className="sticky top-0 z-20 border-b border-[var(--ct-border)] bg-[var(--ct-bg)]/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4 lg:px-10">
        <NavLink to="/" className="flex items-center gap-2">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--ct-accent)] text-white">
            CT
          </span>
          <div>
            <p className="text-lg font-semibold tracking-tight">CivicTrack</p>
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--ct-ink-muted)]">
              Incidencias urbanas
            </p>
          </div>
        </NavLink>
        <nav className="flex items-center gap-2 text-sm">
          <NavLink to="/" className={navLinkClass} end>
            Inicio
          </NavLink>
          <NavLink to="/map" className={navLinkClass}>
            Mapa
          </NavLink>
          <NavLink to="/track" className={navLinkClass}>
            Rastrear
          </NavLink>
          <NavLink
            to="/report/new"
            className="rounded-full bg-[var(--ct-accent)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--ct-accent-strong)]"
          >
            Reportar
          </NavLink>
          {loading ? (
            <div className="rounded-full border border-[var(--ct-border)] px-3 py-2">
              <LoadingSpinner label="Cargando..." />
            </div>
          ) : user ? (
            <div className="flex items-center gap-2">
              <span className="rounded-full border border-[var(--ct-border)] px-3 py-2 text-xs font-semibold text-[var(--ct-ink-muted)]">
                {user.email}
              </span>
              {["ADMIN", "OPERATOR", "SUPERVISOR"].includes(user.role) && (
                <>
                  <NavLink
                    to="/admin"
                    className="rounded-full border border-[var(--ct-border)] px-3 py-2 text-xs font-semibold text-[var(--ct-ink-muted)] transition hover:border-[var(--ct-accent)] hover:text-[var(--ct-accent-strong)]"
                  >
                    Admin
                  </NavLink>
                  <NavLink
                    to="/admin/metrics"
                    className="rounded-full border border-[var(--ct-border)] px-3 py-2 text-xs font-semibold text-[var(--ct-ink-muted)] transition hover:border-[var(--ct-accent)] hover:text-[var(--ct-accent-strong)]"
                  >
                    Metricas
                  </NavLink>
                  <NavLink
                    to="/admin/settings"
                    className="rounded-full border border-[var(--ct-border)] px-3 py-2 text-xs font-semibold text-[var(--ct-ink-muted)] transition hover:border-[var(--ct-accent)] hover:text-[var(--ct-accent-strong)]"
                  >
                    Configuracion
                  </NavLink>
                </>
              )}
              <NavLink
                to="/my-reports"
                className="rounded-full border border-[var(--ct-border)] px-3 py-2 text-xs font-semibold text-[var(--ct-ink-muted)] transition hover:border-[var(--ct-accent)] hover:text-[var(--ct-accent-strong)]"
              >
                Mis reportes
              </NavLink>
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-full border border-[var(--ct-border)] px-3 py-2 text-xs font-semibold text-[var(--ct-ink-muted)] transition hover:border-[var(--ct-accent)] hover:text-[var(--ct-accent-strong)]"
              >
                Salir
              </button>
            </div>
          ) : (
            <NavLink
              to="/login"
              className="rounded-full border border-[var(--ct-border)] px-4 py-2 text-sm font-semibold text-[var(--ct-ink-muted)] transition hover:border-[var(--ct-accent)] hover:text-[var(--ct-accent-strong)]"
            >
              Ingresar
            </NavLink>
          )}
        </nav>
      </div>
    </header>
  );
};

export default Navbar;
