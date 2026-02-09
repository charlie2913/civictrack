import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import LoadingSpinner from "../components/ui/LoadingSpinner";
import Modal from "../components/ui/Modal";
import PriorityBadge from "../components/common/PriorityBadge";
import PhotoUploader from "../components/reports/PhotoUploader";

type StatusHistoryItem = {
  status: string;
  at: string;
  by?: { _id?: string; email?: string; role?: string } | string | null;
  note?: string | null;
};

type ReportDetailData = {
  id: string;
  category: string;
  description: string;
  location?: { coordinates?: [number, number] };
  status: string;
  createdAt: string;
  addressText?: string;
  district?: string;
  photoUrls?: string[];
  statusHistory?: StatusHistoryItem[];
  impact?: number;
  urgency?: number;
  priority?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  priorityOverride?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  effectivePriority?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  assignedTo?: string | { _id?: string } | null;
  assignedAt?: string;
  assignedBy?: string | { _id?: string };
  scheduledAt?: string;
  slaTargetAt?: string;
  slaBreachedAt?: string;
};

type EvidenceType = "BEFORE" | "AFTER" | "INTERVENTION";

type EvidenceItem = {
  id: string;
  type: EvidenceType;
  url: string;
  note?: string | null;
  createdAt: string;
  uploadedBy?: { _id?: string; email?: string; role?: string } | string | null;
};

type ReportEventItem = {
  id: string;
  type: string;
  note?: string | null;
  data?: Record<string, any>;
  createdAt: string;
  createdBy?: { _id?: string; email?: string; role?: string } | string | null;
};

type AdminUserItem = {
  id: string;
  email: string;
  role: string;
};

type EvidenceState = {
  files: File[];
  previews: { file: File; previewUrl: string }[];
  uploading: boolean;
  error: string | null;
  note: string;
};

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

const statusFlow: Record<string, string[]> = {
  RECEIVED: ["VERIFIED"],
  VERIFIED: ["SCHEDULED"],
  SCHEDULED: ["IN_PROGRESS"],
  IN_PROGRESS: ["RESOLVED"],
  RESOLVED: ["CLOSED"],
  CLOSED: ["REOPENED"],
  REOPENED: ["IN_PROGRESS", "VERIFIED"],
};

const allStatuses = Object.keys(statusFlow);
const priorityOptions = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
const evidenceTypes: EvidenceType[] = ["BEFORE", "AFTER", "INTERVENTION"];

const computePriority = (impact: number, urgency: number) => {
  const score = impact + urgency;
  if (score <= 4) return "LOW";
  if (score <= 6) return "MEDIUM";
  if (score <= 8) return "HIGH";
  return "CRITICAL";
};

const buildEvidenceState = (): EvidenceState => ({
  files: [],
  previews: [],
  uploading: false,
  error: null,
  note: "",
});

const formatDateTimeLocal = (value?: string) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (val: number) => String(val).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const normalizeUrl = (url: string) =>
  url.startsWith("http") ? url : `${API_BASE}${url}`;

const eventLabels: Record<string, string> = {
  REPORT_CREATED: "Reporte creado",
  STATUS_CHANGED: "Cambio de estado",
  TRIAGE_UPDATED: "Priorizacion",
  EVIDENCE_ADDED: "Evidencia agregada",
  ASSIGNED: "Asignacion",
  SCHEDULED: "Programacion",
  DISTRICT_UPDATED: "Distrito actualizado",
  COMMENT: "Comentario",
};

const getEventLabel = (type: string) => eventLabels[type] ?? type;

const formatActor = (
  actor?: { _id?: string; email?: string; role?: string } | string | null,
) => {
  if (!actor) return null;
  if (typeof actor === "string") return actor;
  if (actor.email) {
    return `${actor.email}${actor.role ? ` (${actor.role})` : ""}`;
  }
  return actor._id ?? null;
};

const AdminReportDetail = () => {
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<ReportDetailData | null>(null);
  const [events, setEvents] = useState<ReportEventItem[]>([]);
  const [evidenceByType, setEvidenceByType] = useState<
    Record<EvidenceType, EvidenceItem[]>
  >({
    BEFORE: [],
    AFTER: [],
    INTERVENTION: [],
  });
  const [evidenceState, setEvidenceState] = useState<
    Record<EvidenceType, EvidenceState>
  >({
    BEFORE: buildEvidenceState(),
    AFTER: buildEvidenceState(),
    INTERVENTION: buildEvidenceState(),
  });
  const evidenceStateRef = useRef(evidenceState);

  const [nextStatus, setNextStatus] = useState("");
  const [note, setNote] = useState("");
  const [updating, setUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [confirmStatus, setConfirmStatus] = useState<string | null>(null);
  const [impact, setImpact] = useState(3);
  const [urgency, setUrgency] = useState(3);
  const [overrideEnabled, setOverrideEnabled] = useState(false);
  const [overrideValue, setOverrideValue] = useState<
    "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
  >("LOW");
  const [triageSaving, setTriageSaving] = useState(false);
  const [triageError, setTriageError] = useState<string | null>(null);

  const [districts, setDistricts] = useState<string[]>([]);
  const [districtValue, setDistrictValue] = useState("");
  const [districtSaving, setDistrictSaving] = useState(false);
  const [districtError, setDistrictError] = useState<string | null>(null);

  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [assigneeId, setAssigneeId] = useState("");
  const [assignmentNote, setAssignmentNote] = useState("");
  const [assignmentSaving, setAssignmentSaving] = useState(false);
  const [assignmentError, setAssignmentError] = useState<string | null>(null);

  const [scheduleAt, setScheduleAt] = useState("");
  const [slaHours, setSlaHours] = useState("");
  const [scheduleNote, setScheduleNote] = useState("");
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  const [commentText, setCommentText] = useState("");
  const [commentSaving, setCommentSaving] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);

  useEffect(() => {
    evidenceStateRef.current = evidenceState;
  }, [evidenceState]);

  useEffect(() => {
    return () => {
      Object.values(evidenceStateRef.current).forEach((state) => {
        state.previews.forEach((item) =>
          URL.revokeObjectURL(item.previewUrl),
        );
      });
    };
  }, []);

  const timeline = useMemo(() => {
    return [...(report?.statusHistory ?? [])].sort(
      (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime(),
    );
  }, [report?.statusHistory]);

  const allowedNext = useMemo(() => {
    if (!report) return [];
    return statusFlow[report.status] ?? [];
  }, [report]);

  const usersById = useMemo(() => {
    return new Map(users.map((item) => [item.id, item]));
  }, [users]);

  const coordinates = report?.location?.coordinates;
  const lat = coordinates ? coordinates[1] : null;
  const lng = coordinates ? coordinates[0] : null;
  const legacyPhotos = report?.photoUrls ?? [];

  const loadExtras = async (reportId: string, signal?: AbortSignal) => {
    const safeFetch = async (path: string) => {
      const response = await fetch(`${API_BASE}${path}`, {
        credentials: "include",
        signal,
      });
      if (!response.ok) return null;
      return response.json();
    };

    const [eventsResult, beforeResult, afterResult, interventionResult] =
      await Promise.allSettled([
        safeFetch(`/api/reports/${reportId}/events`),
        safeFetch(`/api/reports/${reportId}/evidence?type=BEFORE`),
        safeFetch(`/api/reports/${reportId}/evidence?type=AFTER`),
        safeFetch(`/api/reports/${reportId}/evidence?type=INTERVENTION`),
      ]);

    if (eventsResult.status === "fulfilled" && eventsResult.value) {
      setEvents(
        (eventsResult.value as { items?: ReportEventItem[] }).items ?? [],
      );
    } else {
      setEvents([]);
    }

    const nextEvidence: Record<EvidenceType, EvidenceItem[]> = {
      BEFORE:
        beforeResult.status === "fulfilled" && beforeResult.value
          ? ((beforeResult.value as { items?: EvidenceItem[] }).items ?? [])
          : [],
      AFTER:
        afterResult.status === "fulfilled" && afterResult.value
          ? ((afterResult.value as { items?: EvidenceItem[] }).items ?? [])
          : [],
      INTERVENTION:
        interventionResult.status === "fulfilled" && interventionResult.value
          ? ((interventionResult.value as { items?: EvidenceItem[] }).items ??
              [])
          : [],
    };
    setEvidenceByType(nextEvidence);
  };

  const fetchReport = async (signal?: AbortSignal) => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/reports/${id}`, {
        credentials: "include",
        signal,
      });
      if (!response.ok) {
        if (response.status === 403) {
          throw new Error("No tienes permisos para ver este reporte.");
        }
        if (response.status === 404) {
          throw new Error("Reporte no encontrado.");
        }
        throw new Error("No se pudo cargar el reporte.");
      }
      const data = (await response.json()) as ReportDetailData;
      setReport(data);
      setNextStatus("");
      setNote("");
      if (data.impact) setImpact(data.impact);
      if (data.urgency) setUrgency(data.urgency);
      if (data.priorityOverride) {
        setOverrideEnabled(true);
        setOverrideValue(data.priorityOverride);
      } else {
        setOverrideEnabled(false);
      }
      const assigned =
        typeof data.assignedTo === "string"
          ? data.assignedTo
          : data.assignedTo?._id ?? "";
      setAssigneeId(assigned ?? "");
      setDistrictValue(data.district ?? "");
      setScheduleAt(formatDateTimeLocal(data.scheduledAt));
      setSlaHours("");
      await loadExtras(data.id, signal);
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
  }, [id]);

  useEffect(() => {
    const controller = new AbortController();
    const loadConfig = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/admin/config`, {
          credentials: "include",
          signal: controller.signal,
        });
        if (!response.ok) return;
        const data = (await response.json()) as { districts?: string[] };
        setDistricts(data.districts ?? []);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
      }
    };

    const loadUsers = async () => {
      try {
        const response = await fetch(
          `${API_BASE}/api/admin/users?isActive=true&limit=200`,
          {
            credentials: "include",
            signal: controller.signal,
          },
        );
        if (!response.ok) return;
        const data = (await response.json()) as { items?: AdminUserItem[] };
        setUsers(data.items ?? []);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
      }
    };

    loadConfig();
    loadUsers();

    return () => controller.abort();
  }, []);

  const executeUpdate = async () => {
    if (!id || !nextStatus) return;
    setUpdating(true);
    setUpdateError(null);
    try {
      const response = await fetch(`${API_BASE}/api/reports/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: nextStatus, note: note.trim() || undefined }),
      });
      if (!response.ok) {
        if (response.status === 403) {
          throw new Error("No tienes permisos para actualizar el estado.");
        }
        if (response.status === 400) {
          const body = (await response.json().catch(() => null)) as
            | { error?: string }
            | null;
          throw new Error(body?.error ?? "Transicion invalida.");
        }
        throw new Error("No se pudo actualizar el estado.");
      }
      await fetchReport();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error inesperado";
      setUpdateError(message);
    } finally {
      setUpdating(false);
    }
  };

  const handleUpdateStatus = async () => {
    if (!id || !nextStatus) return;
    if (["RESOLVED", "CLOSED"].includes(nextStatus) && !note.trim()) {
      setUpdateError("Debes registrar una nota para cerrar el reporte.");
      return;
    }
    if (["RESOLVED", "CLOSED"].includes(nextStatus)) {
      setConfirmStatus(nextStatus);
      return;
    }
    await executeUpdate();
  };

  const handleSaveTriage = async () => {
    if (!id) return;
    setTriageSaving(true);
    setTriageError(null);
    try {
      const response = await fetch(`${API_BASE}/api/reports/${id}/triage`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          impact,
          urgency,
          priorityOverride: overrideEnabled ? overrideValue : null,
        }),
      });
      if (!response.ok) {
        if (response.status === 403) {
          throw new Error("No tienes permisos para actualizar la priorizacion.");
        }
        if (response.status === 400) {
          const body = (await response.json().catch(() => null)) as
            | { error?: string }
            | null;
          throw new Error(body?.error ?? "Datos invalidos.");
        }
        throw new Error("No se pudo guardar la priorizacion.");
      }
      await fetchReport();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error inesperado";
      setTriageError(message);
    } finally {
      setTriageSaving(false);
    }
  };

  const handleAssign = async () => {
    if (!id) return;
    setAssignmentSaving(true);
    setAssignmentError(null);
    try {
      const response = await fetch(`${API_BASE}/api/reports/${id}/assignment`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          assigneeId: assigneeId || null,
          note: assignmentNote.trim() || undefined,
        }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(payload?.error ?? "No se pudo actualizar la asignacion.");
      }
      setAssignmentNote("");
      await fetchReport();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error inesperado";
      setAssignmentError(message);
    } finally {
      setAssignmentSaving(false);
    }
  };

  const handleSchedule = async () => {
    if (!id) return;
    if (!scheduleAt) {
      setScheduleError("Debes seleccionar una fecha de programacion.");
      return;
    }
    setScheduleSaving(true);
    setScheduleError(null);
    try {
      const payload: { scheduledAt: string; slaHours?: number; note?: string } = {
        scheduledAt: new Date(scheduleAt).toISOString(),
      };
      const hours = slaHours.trim() ? Number(slaHours) : NaN;
      if (Number.isFinite(hours)) {
        payload.slaHours = hours;
      }
      if (scheduleNote.trim()) {
        payload.note = scheduleNote.trim();
      }
      const response = await fetch(`${API_BASE}/api/reports/${id}/schedule`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(body?.error ?? "No se pudo guardar la programacion.");
      }
      setScheduleNote("");
      await fetchReport();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error inesperado";
      setScheduleError(message);
    } finally {
      setScheduleSaving(false);
    }
  };

  const handleDistrictUpdate = async () => {
    if (!id) return;
    setDistrictSaving(true);
    setDistrictError(null);
    try {
      const response = await fetch(`${API_BASE}/api/reports/${id}/district`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ district: districtValue || null }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(body?.error ?? "No se pudo actualizar el distrito.");
      }
      await fetchReport();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error inesperado";
      setDistrictError(message);
    } finally {
      setDistrictSaving(false);
    }
  };

  const handleComment = async () => {
    if (!id) return;
    if (!commentText.trim()) {
      setCommentError("Escribe un comentario.");
      return;
    }
    setCommentSaving(true);
    setCommentError(null);
    try {
      const response = await fetch(`${API_BASE}/api/reports/${id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ comment: commentText.trim() }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(payload?.error ?? "No se pudo agregar el comentario.");
      }
      setCommentText("");
      await loadExtras(id);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error inesperado";
      setCommentError(message);
    } finally {
      setCommentSaving(false);
    }
  };

  const updateEvidenceState = (type: EvidenceType, next: Partial<EvidenceState>) => {
    setEvidenceState((prev) => ({
      ...prev,
      [type]: { ...prev[type], ...next },
    }));
  };

  const handleEvidenceFilesSelected = (type: EvidenceType, files: FileList | null) => {
    if (!files) return;

    const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
    const maxSize = 5 * 1024 * 1024;

    const incoming = Array.from(files);
    const nextFiles: File[] = [];
    const nextPreviews: { file: File; previewUrl: string }[] = [];

    let errorMessage: string | null = null;

    for (const file of incoming) {
      if (!allowedTypes.has(file.type)) {
        errorMessage = "Solo se permiten imagenes JPG, PNG o WEBP.";
        continue;
      }
      if (file.size > maxSize) {
        errorMessage = "Cada foto debe pesar maximo 5MB.";
        continue;
      }
      nextFiles.push(file);
      nextPreviews.push({ file, previewUrl: URL.createObjectURL(file) });
    }

    setEvidenceState((prev) => {
      const current = prev[type];
      const combined = [...current.files, ...nextFiles];
      if (combined.length > 5) {
        nextPreviews.forEach((item) => URL.revokeObjectURL(item.previewUrl));
        return {
          ...prev,
          [type]: { ...current, error: "Solo puedes subir hasta 5 fotos." },
        };
      }
      return {
        ...prev,
        [type]: {
          ...current,
          files: combined,
          previews: [...current.previews, ...nextPreviews],
          error: errorMessage,
        },
      };
    });
  };

  const handleEvidenceRemoveFile = (type: EvidenceType, file: File) => {
    setEvidenceState((prev) => {
      const current = prev[type];
      const target = current.previews.find((item) => item.file === file);
      if (target) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return {
        ...prev,
        [type]: {
          ...current,
          files: current.files.filter((item) => item !== file),
          previews: current.previews.filter((item) => item.file !== file),
        },
      };
    });
  };

  const handleEvidenceUpload = async (type: EvidenceType) => {
    if (!id) return;
    const current = evidenceState[type];
    if (current.files.length === 0) {
      updateEvidenceState(type, { error: "Selecciona al menos una foto." });
      return;
    }
    updateEvidenceState(type, { uploading: true, error: null });
    try {
      const formData = new FormData();
      current.files.forEach((file) => formData.append("photos", file));
      formData.append("type", type);
      if (current.note.trim()) {
        formData.append("note", current.note.trim());
      }
      const response = await fetch(`${API_BASE}/api/reports/${id}/evidence`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("No se pudo subir la evidencia.");
      }
      current.previews.forEach((item) => URL.revokeObjectURL(item.previewUrl));
      updateEvidenceState(type, buildEvidenceState());
      await loadExtras(id);
      await fetchReport();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error inesperado";
      updateEvidenceState(type, { error: message });
    } finally {
      updateEvidenceState(type, { uploading: false });
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <LoadingSpinner label="Cargando detalle administrativo..." />
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

  if (!report) {
    return null;
  }

  const previewPriority = computePriority(impact, urgency);
  const requiresNote = ["RESOLVED", "CLOSED"].includes(nextStatus);
  const missingNote = requiresNote && !note.trim();
  const assignedUser = assigneeId ? usersById.get(assigneeId) : null;
  const scheduledInfo = report.scheduledAt
    ? new Date(report.scheduledAt).toLocaleString()
    : "N/D";
  const slaInfo = report.slaTargetAt
    ? new Date(report.slaTargetAt).toLocaleString()
    : "N/D";

  const renderEvidencePanel = (type: EvidenceType, label: string) => {
    const items = evidenceByType[type] ?? [];
    const current = evidenceState[type];
    return (
      <div className="rounded-2xl border border-[var(--ct-border)] bg-white/90 p-4 text-sm text-[var(--ct-ink-muted)]">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--ct-ink-muted)]">
            {label}
          </p>
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--ct-ink-muted)]">
            {items.length} archivos
          </span>
        </div>
        {items.length === 0 ? (
          <p className="mt-3 text-sm">Sin evidencias registradas.</p>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {items.map((item) => {
              const uploaderLabel = formatActor(item.uploadedBy);
              return (
                <div
                  key={item.id}
                  className="overflow-hidden rounded-2xl border border-[var(--ct-border)] bg-white"
                >
                  <img
                    src={normalizeUrl(item.url)}
                    alt="Evidencia"
                    className="h-40 w-full object-cover"
                  />
                  <div className="space-y-1 px-4 py-3 text-xs text-[var(--ct-ink-muted)]">
                    <p>{new Date(item.createdAt).toLocaleString()}</p>
                    {uploaderLabel && <p>Por: {uploaderLabel}</p>}
                    {item.note && <p>Nota: {item.note}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-4 space-y-3">
          <PhotoUploader
            previews={current.previews}
            onFilesSelected={(files) => handleEvidenceFilesSelected(type, files)}
            onRemove={(file) => handleEvidenceRemoveFile(type, file)}
            confirmRemove
          />
          <input
            type="text"
            value={current.note}
            onChange={(event) =>
              updateEvidenceState(type, { note: event.target.value })
            }
            placeholder="Nota opcional"
            className="w-full rounded-2xl border border-[var(--ct-border)] bg-white px-4 py-3 text-sm"
          />
          {current.error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {current.error}
            </div>
          )}
          <button
            type="button"
            onClick={() => handleEvidenceUpload(type)}
            disabled={current.uploading}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--ct-accent)] px-5 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white shadow-sm transition hover:bg-[var(--ct-accent-strong)] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {current.uploading ? (
              <LoadingSpinner label="Subiendo..." />
            ) : (
              "Subir evidencia"
            )}
          </button>
        </div>
      </div>
    );
  };

  const auditEvents = useMemo(
    () =>
      [...events]
        .filter((item) => item.type !== "COMMENT")
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [events],
  );

  const commentEvents = useMemo(
    () =>
      [...events]
        .filter((item) => item.type === "COMMENT")
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [events],
  );

  return (
    <div className="space-y-6">
      <Modal
        open={Boolean(confirmStatus)}
        title={`Confirmar cambio a ${confirmStatus ?? ""}`}
        description="Este cambio requiere una nota y cerrara la etapa actual del reporte."
        onClose={() => setConfirmStatus(null)}
        primaryLabel="Confirmar"
        secondaryLabel="Cancelar"
        intent="warning"
        onPrimary={async () => {
          setConfirmStatus(null);
          await executeUpdate();
        }}
      >
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          Nota registrada: {note.trim() || "Sin nota"}
        </div>
      </Modal>

      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ct-ink-muted)]">
          Detalle administrativo
        </p>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-[var(--ct-font-display)] sm:text-4xl">
              Reporte #{report.id.slice(-6).toUpperCase()}
            </h1>
            <p className="mt-1 text-sm text-[var(--ct-ink-muted)]">
              {report.category} · {new Date(report.createdAt).toLocaleString()}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <PriorityBadge priority={report.effectivePriority ?? report.priority} />
            <span className="rounded-full border border-[var(--ct-border)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ct-ink-muted)]">
              {report.status}
            </span>
          </div>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-2xl border border-[var(--ct-border)] bg-white/90 p-5 text-sm text-[var(--ct-ink-muted)] shadow-[0_18px_50px_-40px_rgba(0,0,0,0.45)]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--ct-ink-muted)]">
            Datos generales
          </p>
          <div className="mt-4 space-y-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ct-ink-muted)]">
                Descripcion
              </p>
              <p className="mt-1 text-sm text-[var(--ct-ink)]">
                {report.description || "Sin descripcion"}
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--ct-ink-muted)]">
                  Direccion
                </p>
                <p className="mt-1 text-sm text-[var(--ct-ink)]">
                  {report.addressText ?? "N/D"}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--ct-ink-muted)]">
                  Distrito
                </p>
                <p className="mt-1 text-sm text-[var(--ct-ink)]">
                  {report.district ?? "Sin asignar"}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--ct-ink-muted)]">
                  Coordenadas
                </p>
                <p className="mt-1 text-sm text-[var(--ct-ink)]">
                  {lat !== null && lng !== null
                    ? `${lat.toFixed(5)}, ${lng.toFixed(5)}`
                    : "N/D"}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--ct-ink-muted)]">
                  SLA objetivo
                </p>
                <p className="mt-1 text-sm text-[var(--ct-ink)]">{slaInfo}</p>
              </div>
            </div>
            {legacyPhotos.length > 0 ? (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--ct-ink-muted)]">
                  Evidencia inicial
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {legacyPhotos.map((url) => (
                    <img
                      key={url}
                      src={normalizeUrl(url)}
                      alt="Evidencia inicial"
                      className="h-40 w-full rounded-2xl object-cover"
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-[var(--ct-border)] bg-[var(--ct-accent-soft)]/40 px-4 py-5 text-center text-xs">
                Sin evidencia inicial.
              </div>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-[var(--ct-border)] bg-white/90 p-5 text-sm text-[var(--ct-ink-muted)] shadow-[0_18px_50px_-40px_rgba(0,0,0,0.45)]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--ct-ink-muted)]">
            Operacion
          </p>
          <div className="mt-4 space-y-5">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ct-ink-muted)]">
                Asignacion
              </p>
              <p className="text-sm text-[var(--ct-ink)]">
                Responsable actual: {assignedUser?.email ?? "Sin asignar"}
              </p>
              {report.assignedAt && (
                <p className="text-xs text-[var(--ct-ink-muted)]">
                  Asignado el {new Date(report.assignedAt).toLocaleString()}
                </p>
              )}
              <select
                value={assigneeId}
                onChange={(event) => setAssigneeId(event.target.value)}
                className="w-full rounded-2xl border border-[var(--ct-border)] bg-white px-4 py-3 text-sm"
              >
                <option value="">Sin asignar</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.email} ({user.role})
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={assignmentNote}
                onChange={(event) => setAssignmentNote(event.target.value)}
                placeholder="Nota opcional"
                className="w-full rounded-2xl border border-[var(--ct-border)] bg-white px-4 py-3 text-sm"
              />
              {assignmentError && (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-600">
                  {assignmentError}
                </div>
              )}
              <button
                type="button"
                onClick={handleAssign}
                disabled={assignmentSaving}
                className="inline-flex items-center justify-center rounded-full bg-[var(--ct-accent)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white transition hover:bg-[var(--ct-accent-strong)] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {assignmentSaving ? "Guardando..." : "Guardar asignacion"}
              </button>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ct-ink-muted)]">
                Programacion y SLA
              </p>
              <p className="text-sm text-[var(--ct-ink)]">
                Programado: {scheduledInfo}
              </p>
              {report.slaBreachedAt && (
                <p className="text-xs text-red-600">
                  SLA incumplido: {new Date(report.slaBreachedAt).toLocaleString()}
                </p>
              )}
              <input
                type="datetime-local"
                value={scheduleAt}
                onChange={(event) => setScheduleAt(event.target.value)}
                className="w-full rounded-2xl border border-[var(--ct-border)] bg-white px-4 py-3 text-sm"
              />
              <input
                type="number"
                min="1"
                value={slaHours}
                onChange={(event) => setSlaHours(event.target.value)}
                placeholder="Horas SLA objetivo (opcional)"
                className="w-full rounded-2xl border border-[var(--ct-border)] bg-white px-4 py-3 text-sm"
              />
              <input
                type="text"
                value={scheduleNote}
                onChange={(event) => setScheduleNote(event.target.value)}
                placeholder="Nota opcional"
                className="w-full rounded-2xl border border-[var(--ct-border)] bg-white px-4 py-3 text-sm"
              />
              {scheduleError && (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-600">
                  {scheduleError}
                </div>
              )}
              <button
                type="button"
                onClick={handleSchedule}
                disabled={scheduleSaving}
                className="inline-flex items-center justify-center rounded-full bg-[var(--ct-accent)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white transition hover:bg-[var(--ct-accent-strong)] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {scheduleSaving ? "Guardando..." : "Guardar programacion"}
              </button>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ct-ink-muted)]">
                Distrito
              </p>
              <select
                value={districtValue}
                onChange={(event) => setDistrictValue(event.target.value)}
                className="w-full rounded-2xl border border-[var(--ct-border)] bg-white px-4 py-3 text-sm"
              >
                <option value="">Sin distrito</option>
                {districts.map((district) => (
                  <option key={district} value={district}>
                    {district}
                  </option>
                ))}
              </select>
              {districtError && (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-600">
                  {districtError}
                </div>
              )}
              <button
                type="button"
                onClick={handleDistrictUpdate}
                disabled={districtSaving}
                className="inline-flex items-center justify-center rounded-full bg-[var(--ct-accent)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white transition hover:bg-[var(--ct-accent-strong)] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {districtSaving ? "Guardando..." : "Actualizar distrito"}
              </button>
            </div>
          </div>
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-[var(--ct-border)] bg-white/90 p-5 text-sm text-[var(--ct-ink-muted)] shadow-[0_18px_50px_-40px_rgba(0,0,0,0.45)]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--ct-ink-muted)]">
            Cambio de estado
          </p>
          <div className="mt-4 grid gap-3">
            <select
              value={nextStatus}
              onChange={(event) => setNextStatus(event.target.value)}
              className="w-full rounded-2xl border border-[var(--ct-border)] bg-white px-4 py-3 text-sm"
            >
              <option value="">Seleccionar</option>
              {allowedNext.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={3}
              placeholder="Nota del cambio de estado"
              className="w-full rounded-2xl border border-[var(--ct-border)] bg-white px-4 py-3 text-sm"
            />
            {missingNote && (
              <p className="text-xs text-red-600">
                Para cambiar a {nextStatus} necesitas agregar una nota.
              </p>
            )}
            {updateError && (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-600">
                {updateError}
              </div>
            )}
            <button
              type="button"
              onClick={handleUpdateStatus}
              disabled={updating || !nextStatus || missingNote}
              className="inline-flex items-center justify-center rounded-full bg-[var(--ct-accent)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white transition hover:bg-[var(--ct-accent-strong)] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {updating ? "Actualizando..." : "Actualizar estado"}
            </button>
          </div>
        </section>

        <section className="rounded-2xl border border-[var(--ct-border)] bg-white/90 p-5 text-sm text-[var(--ct-ink-muted)] shadow-[0_18px_50px_-40px_rgba(0,0,0,0.45)]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--ct-ink-muted)]">
            Triage y prioridad
          </p>
          <div className="mt-4 grid gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ct-ink-muted)]">
                Impacto
                <input
                  type="range"
                  min={1}
                  max={5}
                  value={impact}
                  onChange={(event) => setImpact(Number(event.target.value))}
                />
              </label>
              <label className="grid gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ct-ink-muted)]">
                Urgencia
                <input
                  type="range"
                  min={1}
                  max={5}
                  value={urgency}
                  onChange={(event) => setUrgency(Number(event.target.value))}
                />
              </label>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span>Prioridad calculada:</span>
              <PriorityBadge priority={previewPriority} />
            </div>
            <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ct-ink-muted)]">
              <input
                type="checkbox"
                checked={overrideEnabled}
                onChange={(event) => setOverrideEnabled(event.target.checked)}
              />
              Sobrescribir prioridad
            </label>
            {overrideEnabled && (
              <select
                value={overrideValue}
                onChange={(event) =>
                  setOverrideValue(event.target.value as typeof overrideValue)
                }
                className="w-full rounded-2xl border border-[var(--ct-border)] bg-white px-4 py-3 text-sm"
              >
                {priorityOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            )}
            {triageError && (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-600">
                {triageError}
              </div>
            )}
            <button
              type="button"
              onClick={handleSaveTriage}
              disabled={triageSaving}
              className="inline-flex items-center justify-center rounded-full bg-[var(--ct-accent)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white transition hover:bg-[var(--ct-accent-strong)] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {triageSaving ? "Guardando..." : "Guardar triage"}
            </button>
          </div>
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {renderEvidencePanel("BEFORE", "Antes")}
        {renderEvidencePanel("INTERVENTION", "Intervencion")}
        {renderEvidencePanel("AFTER", "Despues")}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-[var(--ct-border)] bg-white/90 p-5 text-sm text-[var(--ct-ink-muted)] shadow-[0_18px_50px_-40px_rgba(0,0,0,0.45)]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--ct-ink-muted)]">
            Historial de estado
          </p>
          <div className="mt-4 space-y-3">
            {timeline.length === 0 && (
              <p className="text-sm">Sin historial disponible.</p>
            )}
            {timeline.map((item) => (
              <div
                key={`${item.status}-${item.at}`}
                className="rounded-2xl border border-[var(--ct-border)] bg-white px-4 py-3"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold uppercase tracking-[0.2em] text-[var(--ct-ink-muted)]">
                    {item.status}
                  </span>
                  <span>{new Date(item.at).toLocaleString()}</span>
                </div>
                {item.note && <p className="mt-2 text-sm text-[var(--ct-ink)]">{item.note}</p>}
                {formatActor(item.by) && (
                  <p className="mt-1 text-xs text-[var(--ct-ink-muted)]">
                    Por: {formatActor(item.by)}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-[var(--ct-border)] bg-white/90 p-5 text-sm text-[var(--ct-ink-muted)] shadow-[0_18px_50px_-40px_rgba(0,0,0,0.45)]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--ct-ink-muted)]">
            Auditoria y eventos
          </p>
          <div className="mt-4 space-y-3">
            {auditEvents.length === 0 && <p className="text-sm">Sin eventos.</p>}
            {auditEvents.map((item) => (
              <div
                key={item.id}
                className="rounded-2xl border border-[var(--ct-border)] bg-white px-4 py-3"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold uppercase tracking-[0.2em] text-[var(--ct-ink-muted)]">
                    {getEventLabel(item.type)}
                  </span>
                  <span>{new Date(item.createdAt).toLocaleString()}</span>
                </div>
                {item.note && <p className="mt-2 text-sm text-[var(--ct-ink)]">{item.note}</p>}
                {item.data && Object.keys(item.data).length > 0 && (
                  <div className="mt-2 space-y-1 text-xs text-[var(--ct-ink-muted)]">
                    {Object.entries(item.data).map(([key, value]) => (
                      <div key={key} className="flex items-center justify-between gap-3">
                        <span className="font-semibold uppercase tracking-[0.2em] text-[var(--ct-ink-muted)]">
                          {key}
                        </span>
                        <span className="text-[var(--ct-ink)]">
                          {typeof value === "string" ? value : JSON.stringify(value)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {formatActor(item.createdBy) && (
                  <p className="mt-2 text-xs text-[var(--ct-ink-muted)]">
                    Por: {formatActor(item.createdBy)}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-[var(--ct-border)] bg-white/90 p-5 text-sm text-[var(--ct-ink-muted)] shadow-[0_18px_50px_-40px_rgba(0,0,0,0.45)]">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--ct-ink-muted)]">
          Comentarios adicionales
        </p>
        <div className="mt-4 grid gap-3">
          <textarea
            value={commentText}
            onChange={(event) => setCommentText(event.target.value)}
            rows={3}
            placeholder="Agregar comentario interno"
            className="w-full rounded-2xl border border-[var(--ct-border)] bg-white px-4 py-3 text-sm"
          />
          {commentError && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-600">
              {commentError}
            </div>
          )}
          <button
            type="button"
            onClick={handleComment}
            disabled={commentSaving}
            className="inline-flex items-center justify-center rounded-full bg-[var(--ct-accent)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white transition hover:bg-[var(--ct-accent-strong)] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {commentSaving ? "Enviando..." : "Registrar comentario"}
          </button>
          {commentEvents.length > 0 ? (
            <div className="mt-2 space-y-3">
              {commentEvents.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-[var(--ct-border)] bg-white px-4 py-3"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold uppercase tracking-[0.2em] text-[var(--ct-ink-muted)]">
                      Comentario
                    </span>
                    <span>{new Date(item.createdAt).toLocaleString()}</span>
                  </div>
                  {item.note && (
                    <p className="mt-2 text-sm text-[var(--ct-ink)]">{item.note}</p>
                  )}
                  {formatActor(item.createdBy) && (
                    <p className="mt-2 text-xs text-[var(--ct-ink-muted)]">
                      Por: {formatActor(item.createdBy)}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[var(--ct-ink-muted)]">Sin comentarios.</p>
          )}
        </div>
      </section>
    </div>
  );
};

export default AdminReportDetail;
