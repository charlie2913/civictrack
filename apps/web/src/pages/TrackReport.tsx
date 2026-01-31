import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const STORAGE_KEY = "civictrack_last_email";

const TrackReport = () => {
  const navigate = useNavigate();
  const [reportId, setReportId] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const savedEmail = localStorage.getItem(STORAGE_KEY);
    if (savedEmail) {
      setEmail(savedEmail);
    }
  }, []);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!reportId.trim()) {
      setError("Ingresa el ID del reporte.");
      return;
    }
    if (!email.trim()) {
      setError("Ingresa tu correo.");
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim().toLowerCase())) {
      setError("El correo no es valido.");
      return;
    }

    localStorage.setItem(STORAGE_KEY, email.trim().toLowerCase());
    navigate(`/reports/${reportId.trim()}?email=${encodeURIComponent(email.trim())}`);
  };

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-8">
      <header className="space-y-3 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ct-ink-muted)]">
          Seguimiento ciudadano
        </p>
        <h1 className="text-3xl font-[var(--ct-font-display)] sm:text-4xl">
          Consulta el estado de tu reporte.
        </h1>
        <p className="text-sm text-[var(--ct-ink-muted)] sm:text-base">
          Ingresa el ID del reporte y el correo usado al registrarlo.
        </p>
      </header>

      <form
        onSubmit={handleSubmit}
        className="rounded-[2rem] border border-[var(--ct-border)] bg-white/85 p-8 shadow-[0_25px_70px_-45px_rgba(0,0,0,0.45)]"
      >
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-semibold">ID del reporte</label>
            <input
              type="text"
              value={reportId}
              onChange={(event) => setReportId(event.target.value)}
              placeholder="65f1c8b... "
              className="w-full rounded-2xl border border-[var(--ct-border)] bg-white px-4 py-3 text-sm outline-none transition focus:border-[var(--ct-accent)]"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold">Correo</label>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="tu@email.com"
              className="w-full rounded-2xl border border-[var(--ct-border)] bg-white px-4 py-3 text-sm outline-none transition focus:border-[var(--ct-accent)]"
            />
          </div>
          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
          <button
            type="submit"
            className="w-full rounded-full bg-[var(--ct-accent)] px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--ct-accent-strong)]"
          >
            Buscar reporte
          </button>
        </div>
      </form>
    </div>
  );
};

export default TrackReport;
