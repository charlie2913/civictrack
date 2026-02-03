import { Link, useLocation, useParams } from "react-router-dom";

const ReportCreated = () => {
  const { id } = useParams();
  const location = useLocation();
  const uploadError = Boolean(
    (location.state as { uploadError?: boolean } | null)?.uploadError,
  );
  const reporterEmail = (location.state as { reporterEmail?: string } | null)
    ?.reporterEmail;

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ct-ink-muted)]">
        Reporte registrado
      </p>
      <h1 className="text-4xl font-[var(--ct-font-display)] sm:text-5xl">
        Gracias por ayudar a tu ciudad.
      </h1>
      <p className="max-w-md text-sm text-[var(--ct-ink-muted)] sm:text-base">
        Tu reporte fue registrado con el ID:
      </p>
      {uploadError && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          Reporte creado, pero fallo la subida de evidencias. Puedes reintentar.
        </div>
      )}
      <div className="rounded-full border border-[var(--ct-border)] bg-white/80 px-6 py-2 text-sm font-semibold text-[var(--ct-ink)]">
        {id}
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Link
          to={
            reporterEmail
              ? `/map?reportId=${id}&email=${encodeURIComponent(reporterEmail)}`
              : `/map?reportId=${id ?? ""}`
          }
          className="inline-flex items-center justify-center rounded-full border border-[var(--ct-border)] bg-white/80 px-6 py-3 text-sm font-semibold text-[var(--ct-ink)] transition hover:border-[var(--ct-accent)] hover:text-[var(--ct-accent-strong)]"
        >
          Ver mapa
        </Link>
        <Link
          to="/report/new"
          className="inline-flex items-center justify-center rounded-full bg-[var(--ct-accent)] px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--ct-accent-strong)]"
        >
          Crear otro
        </Link>
      </div>
    </div>
  );
};

export default ReportCreated;
