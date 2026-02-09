import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import LoadingSpinner from "../components/ui/LoadingSpinner";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

type SurveyResponse = {
  report: {
    id: string;
    category?: string;
    addressText?: string;
    status?: string;
  };
  submittedAt?: string;
  rating?: number;
  comment?: string;
};

const Survey = () => {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [survey, setSurvey] = useState<SurveyResponse | null>(null);
  const [rating, setRating] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setError("Token invalido.");
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${API_BASE}/api/reports/survey/${token}`, {
          credentials: "include",
          signal: controller.signal,
        });
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error("Encuesta no encontrada.");
          }
          throw new Error("No se pudo cargar la encuesta.");
        }
        const payload = (await response.json()) as SurveyResponse;
        setSurvey(payload);
        if (payload.rating) {
          setRating(payload.rating);
        }
        if (payload.comment) {
          setComment(payload.comment);
        }
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
  }, [token]);

  const submitted = useMemo(
    () => Boolean(survey?.submittedAt) || success,
    [survey?.submittedAt, success],
  );

  const handleSubmit = async () => {
    if (!token) return;
    if (!rating) {
      setError("Selecciona una calificacion.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/reports/survey/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ rating, comment }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error ?? "No se pudo enviar la encuesta.");
      }
      setSuccess(true);
      setSurvey((prev) => (prev ? { ...prev, submittedAt: payload.submittedAt } : prev));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error inesperado";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <LoadingSpinner label="Cargando encuesta..." />
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

  if (!survey) {
    return null;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ct-ink-muted)]">
          Encuesta ciudadana
        </p>
        <h1 className="text-3xl font-[var(--ct-font-display)] sm:text-4xl">
          Tu opinion nos ayuda.
        </h1>
        <p className="text-sm text-[var(--ct-ink-muted)]">
          Reporte #{survey.report.id.slice(-6).toUpperCase()} ·{" "}
          {survey.report.category ?? "Incidencia"}
        </p>
      </header>

      <section className="rounded-2xl border border-[var(--ct-border)] bg-white/90 p-6 text-sm text-[var(--ct-ink-muted)] shadow-[0_18px_50px_-40px_rgba(0,0,0,0.45)]">
        {submitted ? (
          <div className="space-y-3">
            <p className="text-lg font-semibold text-[var(--ct-ink)]">
              Gracias por tu respuesta.
            </p>
            {survey.submittedAt && (
              <p className="text-sm">
                Respondido el {new Date(survey.submittedAt).toLocaleString()}
              </p>
            )}
            {rating && (
              <p className="text-sm">Calificacion registrada: {rating} / 5</p>
            )}
            {comment && <p className="text-sm">Comentario: {comment}</p>}
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ct-ink-muted)]">
                Calificacion
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setRating(value)}
                    className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] transition ${
                      rating === value
                        ? "border-[var(--ct-accent)] bg-[var(--ct-accent)] text-white"
                        : "border-[var(--ct-border)] text-[var(--ct-ink-muted)]"
                    }`}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ct-ink-muted)]">
                Comentario opcional
              </p>
              <textarea
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                rows={4}
                placeholder="Cuentanos como fue la atencion"
                className="mt-2 w-full rounded-2xl border border-[var(--ct-border)] bg-white px-4 py-3 text-sm"
              />
            </div>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving}
              className="inline-flex items-center justify-center rounded-full bg-[var(--ct-accent)] px-5 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white transition hover:bg-[var(--ct-accent-strong)] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {saving ? "Enviando..." : "Enviar encuesta"}
            </button>
          </div>
        )}
      </section>
    </div>
  );
};

export default Survey;
