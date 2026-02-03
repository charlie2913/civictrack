import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import LoadingSpinner from "../components/ui/LoadingSpinner";
import { useAuth } from "../context/AuthContext";
import PhotoUploader from "../components/reports/PhotoUploader";
import Modal from "../components/ui/Modal";
import MapPicker from "../components/reports/MapPicker";

type Category = "BACHE" | "LUMINARIA" | "VEREDA" | "DRENAJE";
type PreviewItem = { file: File; previewUrl: string };

const categories: { value: Category; label: string }[] = [
  { value: "BACHE", label: "Baches" },
  { value: "LUMINARIA", label: "Luminarias" },
  { value: "VEREDA", label: "Veredas" },
  { value: "DRENAJE", label: "Drenaje" },
];

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

const NewReport = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [category, setCategory] = useState<Category | "">("");
  const [description, setDescription] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [addressText, setAddressText] = useState("");
  const [reporterEmail, setReporterEmail] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<PreviewItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const descriptionCount = useMemo(() => description.trim().length, [description]);

  const goNext = () => {
    const nextError = validateStep(step);
    if (nextError) {
      setError(nextError);
      return;
    }
    setError(null);
    setStep((prev) => Math.min(prev + 1, 4));
  };

  const goBack = () => {
    setError(null);
    setStep((prev) => Math.max(prev - 1, 1));
  };

  const hasUnsavedData =
    Boolean(category) ||
    Boolean(description.trim()) ||
    Boolean(lat) ||
    Boolean(lng) ||
    Boolean(addressText.trim()) ||
    Boolean(reporterEmail.trim()) ||
    selectedFiles.length > 0;

  const validateStep = (currentStep: number) => {
    if (currentStep === 1) {
      if (!category) return "Selecciona una categoria.";
      if (description.trim().length < 10)
        return "La descripcion debe tener al menos 10 caracteres.";
    }
    if (currentStep === 2) {
      if (!user) {
        if (!reporterEmail.trim()) {
          return "El correo es obligatorio para reportes anonimos.";
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(reporterEmail.trim().toLowerCase())) {
          return "El correo no es valido.";
        }
      }
      const latNum = Number(lat);
      const lngNum = Number(lng);
      if (!lat || !lng) return "Ingresa latitud y longitud.";
      if (Number.isNaN(latNum) || Number.isNaN(lngNum)) {
        return "Latitud y longitud deben ser numericas.";
      }
      if (latNum < -90 || latNum > 90 || lngNum < -180 || lngNum > 180) {
        return "Coordenadas fuera de rango.";
      }
    }
    return null;
  };

  const handleLocate = () => {
    if (!navigator.geolocation) {
      setError("La geolocalizacion no esta disponible en este navegador.");
      return;
    }
    setIsLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLat(position.coords.latitude.toFixed(6));
        setLng(position.coords.longitude.toFixed(6));
        setIsLocating(false);
      },
      () => {
        setError("No se pudo obtener la ubicacion. Ingresa los datos manualmente.");
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const finalError = validateStep(4);
    if (finalError) {
      setError(finalError);
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const payload = {
        category,
        description: description.trim(),
        location: { lat: Number(lat), lng: Number(lng) },
        addressText: addressText.trim() || undefined,
        ...(user
          ? {}
          : { reporterEmail: reporterEmail.trim().toLowerCase() }),
      };

      const response = await fetch(`${API_BASE}/api/reports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(body?.error ?? "No se pudo registrar el reporte.");
      }

      const data = (await response.json()) as { id: string };

      if (selectedFiles.length > 0) {
        const formData = new FormData();
        selectedFiles.forEach((file) => {
          formData.append("photos", file);
        });
        const uploadResponse = await fetch(
          `${API_BASE}/api/reports/${data.id}/photos`,
          {
            method: "POST",
            body: formData,
            credentials: "include",
          },
        );

        if (!uploadResponse.ok) {
          navigate(`/report/created/${data.id}`, {
            replace: true,
            state: { uploadError: true },
          });
          return;
        }
      }

      navigate(`/report/created/${data.id}`, {
        replace: true,
        state: { reporterEmail: user ? undefined : reporterEmail.trim().toLowerCase() },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error inesperado";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    return () => {
      previews.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    };
  }, [previews]);

  const handleFilesSelected = (files: FileList | null) => {
    if (!files) return;

    const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
    const maxSize = 5 * 1024 * 1024;

    const incoming = Array.from(files);
    const nextFiles: File[] = [];
    const nextPreviews: PreviewItem[] = [];

    for (const file of incoming) {
      if (!allowedTypes.has(file.type)) {
        setError("Solo se permiten imagenes JPG, PNG o WEBP.");
        continue;
      }
      if (file.size > maxSize) {
        setError("Cada foto debe pesar maximo 5MB.");
        continue;
      }
      nextFiles.push(file);
      nextPreviews.push({ file, previewUrl: URL.createObjectURL(file) });
    }

    const combined = [...selectedFiles, ...nextFiles];
    if (combined.length > 5) {
      nextPreviews.forEach((item) => URL.revokeObjectURL(item.previewUrl));
      setError("Solo puedes subir hasta 5 fotos.");
      return;
    }

    setError(null);
    setSelectedFiles(combined);
    setPreviews((prev) => [...prev, ...nextPreviews]);
  };

  const handleRemoveFile = (file: File) => {
    setSelectedFiles((prev) => prev.filter((item) => item !== file));
    setPreviews((prev) => {
      const target = prev.find((item) => item.file === file);
      if (target) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((item) => item.file !== file);
    });
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-10">
      <Modal
        open={showCancelConfirm}
        title="Cancelar reporte"
        description="¿Seguro que deseas salir? Perderas la informacion ingresada."
        onClose={() => setShowCancelConfirm(false)}
        primaryLabel="Salir"
        secondaryLabel="Continuar"
        intent="warning"
        onPrimary={() => {
          setShowCancelConfirm(false);
          navigate("/", { replace: true });
        }}
      />
      <header className="space-y-3 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ct-ink-muted)]">
          Nuevo reporte
        </p>
        <h1 className="text-3xl font-[var(--ct-font-display)] sm:text-4xl">
          Registra una incidencia urbana.
        </h1>
        <p className="text-sm text-[var(--ct-ink-muted)] sm:text-base">
          Completa los pasos para enviar el reporte al sistema.
        </p>
      </header>

      <div className="flex flex-wrap items-center justify-center gap-3 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ct-ink-muted)]">
        <span className={step >= 1 ? "text-[var(--ct-accent-strong)]" : ""}>
          Paso 1
        </span>
        <span>•</span>
        <span className={step >= 2 ? "text-[var(--ct-accent-strong)]" : ""}>
          Paso 2
        </span>
        <span>•</span>
        <span className={step >= 3 ? "text-[var(--ct-accent-strong)]" : ""}>
          Paso 3
        </span>
        <span>•</span>
        <span className={step >= 4 ? "text-[var(--ct-accent-strong)]" : ""}>
          Paso 4
        </span>
      </div>

      <form
        onSubmit={handleSubmit}
        className="rounded-[2rem] border border-[var(--ct-border)] bg-white/85 p-8 shadow-[0_25px_70px_-45px_rgba(0,0,0,0.45)]"
      >
        <div className="space-y-6">
          {step === 1 && (
            <>
              <div className="space-y-2">
                <label className="text-sm font-semibold">Categoria</label>
                <select
                  value={category}
                  onChange={(event) =>
                    setCategory(event.target.value as Category)
                  }
                  className="w-full rounded-2xl border border-[var(--ct-border)] bg-white px-4 py-3 text-sm outline-none transition focus:border-[var(--ct-accent)]"
                >
                  <option value="">Selecciona una categoria</option>
                  {categories.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold">Descripcion</label>
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={5}
                  className="w-full resize-none rounded-2xl border border-[var(--ct-border)] bg-white px-4 py-3 text-sm outline-none transition focus:border-[var(--ct-accent)]"
                  placeholder="Describe el problema con detalle"
                />
                <p className="text-xs text-[var(--ct-ink-muted)]">
                  {descriptionCount} / 10 caracteres minimos
                </p>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="space-y-3">
                <label className="text-sm font-semibold">Ubicacion</label>
                <button
                  type="button"
                  onClick={handleLocate}
                  disabled={isLocating}
                  className="inline-flex items-center gap-2 rounded-full border border-[var(--ct-border)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ct-ink-muted)] transition hover:border-[var(--ct-accent)]"
                >
                  {isLocating ? "Buscando..." : "Usar mi ubicacion"}
                </button>
              </div>
              <MapPicker
                lat={lat ? Number(lat) : null}
                lng={lng ? Number(lng) : null}
                onChange={(nextLat, nextLng) => {
                  setLat(nextLat.toFixed(6));
                  setLng(nextLng.toFixed(6));
                }}
              />
              {!user && (
                <div className="space-y-2">
                  <label className="text-sm font-semibold">Correo</label>
                  <input
                    type="email"
                    value={reporterEmail}
                    onChange={(event) => setReporterEmail(event.target.value)}
                    placeholder="tu@email.com"
                    className="w-full rounded-2xl border border-[var(--ct-border)] bg-white px-4 py-3 text-sm outline-none transition focus:border-[var(--ct-accent)]"
                    required={!user}
                  />
                </div>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-semibold">Latitud</label>
                  <input
                    type="text"
                    value={lat}
                    onChange={(event) => setLat(event.target.value)}
                    placeholder="-12.0464"
                    className="w-full rounded-2xl border border-[var(--ct-border)] bg-white px-4 py-3 text-sm outline-none transition focus:border-[var(--ct-accent)]"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold">Longitud</label>
                  <input
                    type="text"
                    value={lng}
                    onChange={(event) => setLng(event.target.value)}
                    placeholder="-77.0428"
                    className="w-full rounded-2xl border border-[var(--ct-border)] bg-white px-4 py-3 text-sm outline-none transition focus:border-[var(--ct-accent)]"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold">Referencia</label>
                <input
                  type="text"
                  value={addressText}
                  onChange={(event) => setAddressText(event.target.value)}
                  placeholder="Av. Principal 123 (opcional)"
                  className="w-full rounded-2xl border border-[var(--ct-border)] bg-white px-4 py-3 text-sm outline-none transition focus:border-[var(--ct-accent)]"
                />
              </div>
            </>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <p className="text-sm font-semibold">Evidencias</p>
              <PhotoUploader
                previews={previews}
                onFilesSelected={handleFilesSelected}
                onRemove={handleRemoveFile}
                confirmRemove
              />
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6 text-sm">
              <div className="rounded-2xl border border-[var(--ct-border)] bg-[var(--ct-accent-soft)]/50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ct-ink-muted)]">
                  Resumen
                </p>
                <p className="mt-3 text-base font-semibold text-[var(--ct-ink)]">
                  {categories.find((item) => item.value === category)?.label}
                </p>
                <p className="mt-2 text-[var(--ct-ink-muted)]">{description}</p>
                <p className="mt-4 text-xs text-[var(--ct-ink-muted)]">
                  Coordenadas: {lat}, {lng}
                </p>
                {!user && reporterEmail && (
                  <p className="mt-1 text-xs text-[var(--ct-ink-muted)]">
                    Correo: {reporterEmail}
                  </p>
                )}
                {addressText && (
                  <p className="mt-1 text-xs text-[var(--ct-ink-muted)]">
                    Referencia: {addressText}
                  </p>
                )}
                {selectedFiles.length > 0 && (
                  <p className="mt-1 text-xs text-[var(--ct-ink-muted)]">
                    Fotos adjuntas: {selectedFiles.length}
                  </p>
                )}
              </div>
              <p className="text-xs text-[var(--ct-ink-muted)]">
                Al enviar aceptas que la informacion sera visible en el mapa
                publico de incidencias.
              </p>
            </div>
          )}

          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={goBack}
              disabled={step === 1 || isSubmitting}
              className="rounded-full border border-[var(--ct-border)] px-6 py-3 text-sm font-semibold text-[var(--ct-ink-muted)] transition hover:border-[var(--ct-accent)] hover:text-[var(--ct-accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              Volver
            </button>
            <button
              type="button"
              onClick={() => {
                if (hasUnsavedData) {
                  setShowCancelConfirm(true);
                } else {
                  navigate("/", { replace: true });
                }
              }}
              className="rounded-full border border-[var(--ct-border)] px-6 py-3 text-sm font-semibold text-[var(--ct-ink-muted)] transition hover:border-[var(--ct-accent)] hover:text-[var(--ct-accent-strong)]"
            >
              Cancelar
            </button>
            {step < 4 ? (
              <button
                type="button"
                onClick={goNext}
                className="rounded-full bg-[var(--ct-accent)] px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--ct-accent-strong)]"
              >
                Continuar
              </button>
            ) : (
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--ct-accent)] px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--ct-accent-strong)] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSubmitting ? (
                  <>
                    <LoadingSpinner label="Enviando..." />
                  </>
                ) : (
                  "Enviar reporte"
                )}
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
};

export default NewReport;
