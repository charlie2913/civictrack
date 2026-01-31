import { Link } from "react-router-dom";

const Unauthorized = () => {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ct-ink-muted)]">
        Error 403
      </p>
      <h1 className="text-4xl font-[var(--ct-font-display)] sm:text-5xl">
        No tienes permisos para entrar aqui.
      </h1>
      <p className="max-w-md text-sm text-[var(--ct-ink-muted)] sm:text-base">
        Si crees que es un error, contacta al administrador del sistema.
      </p>
      <Link
        to="/"
        className="inline-flex items-center justify-center rounded-full bg-[var(--ct-accent)] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[var(--ct-accent-strong)]"
      >
        Volver al inicio
      </Link>
    </div>
  );
};

export default Unauthorized;
