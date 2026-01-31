import { useEffect, useMemo, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import LoadingSpinner from "../components/ui/LoadingSpinner";
import { useAuth } from "../context/AuthContext";
import PhotoUploader from "../components/reports/PhotoUploader";

type ReportDetailData = {
  id: string;
  category: string;
  description: string;
  location?: { coordinates?: [number, number] };
  status: string;
  createdAt: string;
  addressText?: string;
  photoUrls?: string[];
  statusHistory?: { status: string; at: string; by?: string | null }[];
};

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:4000";
const FINAL_STATUS = "CLOSED";

const ReportDetail = () => {
  const { id } = useParams();
  const location = useLocation();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<ReportDetailData | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<{ file: File; previewUrl: string }[]>(
    [],
  );
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const emailQuery = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get("email");
  }, [location.search]);

  const fallbackEmail = useMemo(() => {
    return localStorage.getItem("civictrack_last_email");
  }, []);

  const fetchReport = async (signal?: AbortSignal) => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const url = new URL(`${API_BASE}/api/reports/${id}`);
      if (!user) {
        const email = emailQuery || fallbackEmail || "";
        if (email) {
          url.searchParams.set("email", email);
        }
      }
      const response = await fetch(url.toString(), {
        credentials: "include",
        signal,
      });
      if (!response.ok) {
        if (response.status === 403) {
          throw new Error("No tienes permiso para ver este reporte.");
        }
        if (response.status === 404) {
          throw new Error("Reporte no encontrado.");
        }
        throw new Error("No se pudo cargar el reporte.");
      }
      const data = (await response.json()) as ReportDetailData;
      setReport(data);
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      const message = err instanceof Error ? err.message : "Error inesperado";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    fetchReport(controller.signal);
    return () => controller.abort();
  }, [id, emailQuery, user]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <LoadingSpinner label="Cargando reporte..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-xl flex-col items-center justify-center gap-4 text-center">
        <p className="text-sm font-semibold text-red-600">{error}</p>
      </div>
    );
  }

  if (!report) {
    return null;
  }

  const coordinates = report.location?.coordinates;
  const lat = coordinates ? coordinates[1] : null;
  const lng = coordinates ? coordinates[0] : null;
  const gallery = report.photoUrls ?? [];
  const timeline = [...(report.statusHistory ?? [])].sort(
    (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime(),
  );
  const canUpload = report.status !== FINAL_STATUS;

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
    const nextPreviews: { file: File; previewUrl: string }[] = [];

    for (const file of incoming) {
      if (!allowedTypes.has(file.type)) {
        setUploadError("Solo se permiten imagenes JPG, PNG o WEBP.");
        continue;
      }
      if (file.size > maxSize) {
        setUploadError("Cada foto debe pesar maximo 5MB.");
        continue;
      }
      nextFiles.push(file);
      nextPreviews.push({ file, previewUrl: URL.createObjectURL(file) });
    }

    const combined = [...selectedFiles, ...nextFiles];
    if (combined.length > 5) {
      nextPreviews.forEach((item) => URL.revokeObjectURL(item.previewUrl));
      setUploadError("Solo puedes subir hasta 5 fotos.");
      return;
    }

    setUploadError(null);
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

  const handleUpload = async () => {
    if (!id) return;
    if (selectedFiles.length === 0) {
      setUploadError("Selecciona al menos una foto.");
      return;
    }
    setUploading(true);
    setUploadError(null);
    try {
      const formData = new FormData();
      selectedFiles.forEach((file) => {
        formData.append("photos", file);
      });
      const response = await fetch(`${API_BASE}/api/reports/${id}/photos`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("No se pudo subir las evidencias.");
      }
      setSelectedFiles([]);
      setPreviews((prev) => {
        prev.forEach((item) => URL.revokeObjectURL(item.previewUrl));
        return [];
      });
      await fetchReport();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error inesperado";
      setUploadError(message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      <header className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ct-ink-muted)]">
          Reporte {report.id}
        </p>
        <h1 className="text-3xl font-[var(--ct-font-display)] sm:text-4xl">
          Estado: {report.status}
        </h1>
        <p className="text-sm text-[var(--ct-ink-muted)] sm:text-base">
          {report.description}
        </p>
      </header>

      <div className="grid gap-6">
        <div className="rounded-[2rem] border border-[var(--ct-border)] bg-white/85 p-6 text-sm text-[var(--ct-ink-muted)] shadow-[0_20px_60px_-45px_rgba(0,0,0,0.45)]">
          <p>
            <span className="font-semibold text-[var(--ct-ink)]">Categoria:</span>{" "}
            {report.category}
          </p>
          {report.addressText && (
            <p className="mt-2">
              <span className="font-semibold text-[var(--ct-ink)]">
                Referencia:
              </span>{" "}
              {report.addressText}
            </p>
          )}
          {lat !== null && lng !== null && (
            <p className="mt-2">
              <span className="font-semibold text-[var(--ct-ink)]">
                Coordenadas:
              </span>{" "}
              {lat.toFixed(6)}, {lng.toFixed(6)}
            </p>
          )}
          <p className="mt-2">
            <span className="font-semibold text-[var(--ct-ink)]">Creado:</span>{" "}
            {new Date(report.createdAt).toLocaleString()}
          </p>
        </div>

        <div className="rounded-[2rem] border border-[var(--ct-border)] bg-white/85 p-6 text-sm text-[var(--ct-ink-muted)] shadow-[0_20px_60px_-45px_rgba(0,0,0,0.45)]">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ct-ink-muted)]">
            Evidencias
          </p>
          {gallery.length === 0 ? (
            <p className="mt-3 text-sm">No hay fotos adjuntas.</p>
          ) : (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {gallery.map((url) => {
                const fullUrl = url.startsWith("http") ? url : `${API_BASE}${url}`;
                return (
                  <img
                    key={url}
                    src={fullUrl}
                    alt="Evidencia"
                    className="h-44 w-full rounded-2xl object-cover"
                  />
                );
              })}
            </div>
          )}
        </div>

        {canUpload && (
          <div className="rounded-[2rem] border border-[var(--ct-border)] bg-white/85 p-6 text-sm text-[var(--ct-ink-muted)] shadow-[0_20px_60px_-45px_rgba(0,0,0,0.45)]">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ct-ink-muted)]">
              Añadir evidencia
            </p>
            <div className="mt-4 space-y-4">
              <PhotoUploader
                previews={previews}
                onFilesSelected={handleFilesSelected}
                onRemove={handleRemoveFile}
              />
              {uploadError && (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {uploadError}
                </div>
              )}
              <button
                type="button"
                onClick={handleUpload}
                disabled={uploading}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--ct-accent)] px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--ct-accent-strong)] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {uploading ? <LoadingSpinner label="Subiendo..." /> : "Subir evidencias"}
              </button>
            </div>
          </div>
        )}

        <div className="rounded-[2rem] border border-[var(--ct-border)] bg-white/85 p-6 text-sm text-[var(--ct-ink-muted)] shadow-[0_20px_60px_-45px_rgba(0,0,0,0.45)]">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ct-ink-muted)]">
            Historial de estados
          </p>
          {timeline.length === 0 ? (
            <p className="mt-3 text-sm">Sin cambios registrados.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {timeline.map((item, index) => (
                <div
                  key={`${item.status}-${item.at}-${index}`}
                  className="rounded-2xl border border-[var(--ct-border)] bg-[var(--ct-accent-soft)]/40 px-4 py-3"
                >
                  <p className="text-sm font-semibold text-[var(--ct-ink)]">
                    {item.status}
                  </p>
                  <p className="text-xs text-[var(--ct-ink-muted)]">
                    {new Date(item.at).toLocaleString()}
                  </p>
                  {item.by && (
                    <p className="text-xs text-[var(--ct-ink-muted)]">by: {item.by}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReportDetail;
