import { Link } from "react-router-dom";

const NotFound = () => {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 text-center">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--ct-ink-muted)]">
        Error 404
      </p>
      <h1 className="text-4xl font-[var(--ct-font-display)] sm:text-5xl">
        Esta pagina no existe.
      </h1>
      <p className="max-w-md text-sm text-[var(--ct-ink-muted)] sm:text-base">
        Volvamos al inicio para seguir explorando incidencias en tu ciudad.
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

export default NotFound;
