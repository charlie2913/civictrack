import type { Request, Response } from "express";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import Report, { reportCategories } from "./report.model";
import SystemConfig, { defaultNotificationEvents } from "../../models/SystemConfig";
import User from "../../models/User";
import mongoose from "mongoose";
import ReportEvent from "./report.event.model";
import ReportEvidence, { evidenceTypes, type EvidenceType } from "./report.evidence.model";
import ReportSurvey from "./report.survey.model";
import { sendMail } from "../../services/mailer";

type JwtPayload = {
  sub: string;
  role: string;
  email: string;
};

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET no esta configurado");
  }
  return secret;
};

const parseUserFromRequest = (req: Request) => {
  const token = req.cookies?.access_token as string | undefined;
  if (!token) return null;
  try {
    const payload = jwt.verify(token, getJwtSecret()) as JwtPayload;
    return { id: payload.sub, role: payload.role, email: payload.email };
  } catch {
    return null;
  }
};

const isPrivilegedRole = (role?: string | null) =>
  role ? ["ADMIN", "SUPERVISOR", "OPERATOR"].includes(role) : false;

const parseCoordinates = (location: { lat?: number; lng?: number; coordinates?: number[] }) => {
  if (Array.isArray(location.coordinates) && location.coordinates.length === 2) {
    return { lng: location.coordinates[0], lat: location.coordinates[1] };
  }
  if (typeof location.lat === "number" && typeof location.lng === "number") {
    return { lng: location.lng, lat: location.lat };
  }
  return null;
};

const isValidLatLng = (lat: number, lng: number) => {
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
};

const isValidEmail = (email: string) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const isValidObjectId = (id: string) => mongoose.Types.ObjectId.isValid(id);

const normalizeDistrict = (value: string) => value.trim().toUpperCase();

const WEB_URL = process.env.WEB_URL?.trim() || "http://localhost:5173";
const SURVEY_COMMENT_MAX = 500;

const statusNotificationMap: Record<string, string> = {
  SCHEDULED: "STATUS_SCHEDULED",
  RESOLVED: "STATUS_RESOLVED",
  CLOSED: "STATUS_CLOSED",
  REOPENED: "STATUS_REOPENED",
};

const buildReportLink = (reportId: string, email: string) =>
  `${WEB_URL}/reports/${reportId}?email=${encodeURIComponent(email)}`;

const buildSurveyLink = (token: string) => `${WEB_URL}/survey/${token}`;

const getReporterEmail = async (report: { createdBy?: any }) => {
  if (!report.createdBy) return null;
  const user = await User.findById(report.createdBy).select("email").lean();
  if (!user?.email) return null;
  return user.email;
};

const canSendNotification = async (eventType: string) => {
  const config = await SystemConfig.findOne().select("notificationEvents").lean();
  const allowed = config?.notificationEvents ?? defaultNotificationEvents;
  return allowed.includes(eventType);
};

const sendStatusNotification = async (
  report: { _id: any; category?: string; status?: string; scheduledAt?: Date },
  status: string,
  note?: string,
) => {
  try {
    const eventType = statusNotificationMap[status];
    if (!eventType) return;
    if (!(await canSendNotification(eventType))) return;
    const email = await getReporterEmail(report);
    if (!email) return;

    const reportId = report._id.toString();
    const link = buildReportLink(reportId, email);
    const subject = `Actualizacion de reporte ${reportId.slice(-6).toUpperCase()}`;
    const scheduleLine =
      status === "SCHEDULED" && report.scheduledAt
        ? `Programado para: ${new Date(report.scheduledAt).toLocaleString()}`
        : null;

    const textLines = [
      `Tu reporte ${reportId} cambio de estado a ${status}.`,
      scheduleLine,
      note ? `Nota: ${note}` : null,
      `Ver detalle: ${link}`,
    ].filter(Boolean);

    const htmlLines = [
      `<p>Tu reporte <strong>${reportId}</strong> cambio de estado a <strong>${status}</strong>.</p>`,
      scheduleLine ? `<p>${scheduleLine}</p>` : "",
      note ? `<p>Nota: ${note}</p>` : "",
      `<p><a href="${link}">Ver detalle del reporte</a></p>`,
    ].filter(Boolean);

    await sendMail({
      to: email,
      subject,
      text: textLines.join("\n"),
      html: htmlLines.join(""),
    });
  } catch (err) {
    console.error("[Notifications] Error enviando actualizacion", err);
  }
};

const ensureSurveyForReport = async (report: { _id: any; createdBy?: any }) => {
  const email = await getReporterEmail(report);
  if (!email) return null;

  const existing = await ReportSurvey.findOne({ reportId: report._id });
  if (existing?.submittedAt) return null;
  if (existing) return existing;

  const token = crypto.randomBytes(24).toString("hex");
  return ReportSurvey.create({
    reportId: report._id,
    token,
    email,
  });
};

const sendSurveyInvitation = async (report: { _id: any; category?: string }) => {
  try {
    const survey = await ensureSurveyForReport(report);
    if (!survey) return;
    const reportId = report._id.toString();
    const link = buildSurveyLink(survey.token);
    const subject = `Encuesta de satisfaccion - Reporte ${reportId
      .slice(-6)
      .toUpperCase()}`;
    const text = [
      `Tu reporte ${reportId} fue cerrado.`,
      "Queremos conocer tu experiencia. Toma un minuto para responder la encuesta.",
      `Encuesta: ${link}`,
    ].join("\n");
    const html = `
      <p>Tu reporte <strong>${reportId}</strong> fue cerrado.</p>
      <p>Queremos conocer tu experiencia. Toma un minuto para responder la encuesta.</p>
      <p><a href="${link}">Responder encuesta</a></p>
    `;
    await sendMail({ to: survey.email, subject, text, html });
  } catch (err) {
    console.error("[Survey] Error enviando encuesta", err);
  }
};

const parseDateInput = (value: unknown) => {
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const safeLogReportEvent = async (params: {
  reportId: string;
  type: string;
  createdBy?: string | null;
  note?: string;
  data?: Record<string, any>;
}) => {
  try {
    await ReportEvent.create({
      reportId: params.reportId,
      type: params.type,
      createdBy: params.createdBy || undefined,
      note: params.note,
      data: params.data,
    });
  } catch (err) {
    console.error("[ReportEvent] Error logging event", err);
  }
};

const formatReportDetail = (report: any) => ({
  id: report._id,
  category: report.category,
  description: report.description,
  location: report.location,
  addressText: report.addressText,
  district: report.district,
  photoUrls: report.photoUrls,
  status: report.status,
  statusHistory: report.statusHistory,
  createdAt: report.createdAt,
  assignedTo: report.assignedTo,
  assignedAt: report.assignedAt,
  assignedBy: report.assignedBy,
  scheduledAt: report.scheduledAt,
  slaTargetAt: report.slaTargetAt,
  slaBreachedAt: report.slaBreachedAt,
  impact: report.impact,
  urgency: report.urgency,
  priority: report.priority,
  priorityOverride: report.priorityOverride,
  effectivePriority: report.priorityOverride ?? report.priority,
});

export const reportStatuses = [
  "RECEIVED",
  "VERIFIED",
  "SCHEDULED",
  "IN_PROGRESS",
  "RESOLVED",
  "CLOSED",
  "REOPENED",
] as const;

type ReportStatus = (typeof reportStatuses)[number];

const transitionMap: Record<ReportStatus, ReportStatus[]> = {
  RECEIVED: ["VERIFIED"],
  VERIFIED: ["SCHEDULED"],
  SCHEDULED: ["IN_PROGRESS"],
  IN_PROGRESS: ["RESOLVED"],
  RESOLVED: ["CLOSED"],
  CLOSED: ["REOPENED"],
  REOPENED: ["IN_PROGRESS", "VERIFIED"],
};

export const priorityLevels = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
type PriorityLevel = (typeof priorityLevels)[number];

export const computePriority = (impact: number, urgency: number): PriorityLevel => {
  const score = impact + urgency;
  if (score <= 4) return "LOW";
  if (score <= 6) return "MEDIUM";
  if (score <= 8) return "HIGH";
  return "CRITICAL";
};

export const createReport = async (req: Request, res: Response) => {
  const { category, description, location, addressText, reporterEmail, district } = req.body as {
    category?: string;
    description?: string;
    location?: { lat?: number; lng?: number; coordinates?: number[] };
    addressText?: string;
    reporterEmail?: string;
    district?: string;
  };

  if (!category || !reportCategories.includes(category as any)) {
    return res.status(400).json({ error: "Categoria requerida" });
  }

  if (!description || description.trim().length < 10) {
    return res.status(400).json({ error: "Descripcion minima de 10 caracteres" });
  }

  if (!location) {
    return res.status(400).json({ error: "Location requerida" });
  }

  const coords = parseCoordinates(location);
  if (!coords || !isValidLatLng(coords.lat, coords.lng)) {
    return res.status(400).json({ error: "Coordenadas invalidas" });
  }

  const sessionUser = req.user ?? parseUserFromRequest(req);
  let reporterUserId: string | null = sessionUser?.id ?? null;
  let normalizedDistrict: string | undefined;

  if (district && typeof district === "string") {
    const value = normalizeDistrict(district);
    const config = await SystemConfig.findOne().lean();
    const allowed = config?.districts ?? [];
    if (allowed.length > 0 && !allowed.includes(value)) {
      return res.status(400).json({ error: "Distrito invalido" });
    }
    normalizedDistrict = value;
  }

  if (!reporterUserId) {
    if (!reporterEmail) {
      return res
        .status(400)
        .json({ error: "reporterEmail es requerido para reportes anonimos" });
    }
    const normalizedEmail = reporterEmail.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      return res.status(400).json({ error: "Formato de email invalido" });
    }

    const existingUser = await User.findOne({ email: normalizedEmail });

    if (existingUser) {
      reporterUserId = existingUser._id.toString();
    } else {
      const created = await User.create({
        email: normalizedEmail,
        role: "CITIZEN",
        authMode: "GUEST",
      });
      reporterUserId = created._id.toString();
    }
  }
  const report = await Report.create({
    category,
    description: description.trim(),
    location: {
      type: "Point",
      coordinates: [coords.lng, coords.lat],
    },
    addressText,
    district: normalizedDistrict,
    photoUrls: [],
    status: "RECEIVED",
    statusHistory: [
      {
        status: "RECEIVED",
        at: new Date(),
        by: reporterUserId,
      },
    ],
    createdBy: reporterUserId,
  });

  void safeLogReportEvent({
    reportId: report._id.toString(),
    type: "REPORT_CREATED",
    createdBy: reporterUserId,
    data: { category, district: normalizedDistrict ?? null },
  });

  return res.status(201).json({
    id: report._id,
    status: report.status,
    createdAt: report.createdAt,
  });
};

export const getReportById = async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!isValidObjectId(id)) {
    return res.status(400).json({ error: "reportId invalido" });
  }

  const baseReport = await Report.findById(id)
    .populate("createdBy", "email role")
    .lean();
  if (!baseReport) {
    return res.status(404).json({ error: "Reporte no encontrado" });
  }

  const sessionUser = req.user ?? parseUserFromRequest(req);

  if (sessionUser) {
    const isOwner = baseReport.createdBy?._id?.toString() === sessionUser.id;
    const isPrivileged = ["ADMIN", "SUPERVISOR", "OPERATOR"].includes(sessionUser.role);
    if (!isOwner && !isPrivileged) {
      return res.status(403).json({ error: "Acceso denegado" });
    }

    const report = await Report.findById(id)
      .populate("createdBy", "email role")
      .populate("statusHistory.by", "email role")
      .lean();
    if (!report) {
      return res.status(404).json({ error: "Reporte no encontrado" });
    }
    return res.json(formatReportDetail(report));
  }

  const email = typeof req.query.email === "string" ? req.query.email : "";
  if (!email || !isValidEmail(email)) {
    return res.status(400).json({ error: "Email requerido o invalido" });
  }

  const createdByEmail = baseReport.createdBy?.email;
  if (!createdByEmail || createdByEmail !== email.toLowerCase()) {
    return res.status(403).json({ error: "Acceso denegado" });
  }

  return res.json(formatReportDetail(baseReport));
};

export const getMyReports = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: "No autenticado" });
  }

  const reports = await Report.find({ createdBy: userId })
    .sort({ createdAt: -1 })
    .select("category description status createdAt addressText")
    .lean();

  return res.json({
    items: reports.map((report) => ({
      id: report._id,
      category: report.category,
      description: report.description,
      status: report.status,
      createdAt: report.createdAt,
      addressText: report.addressText,
    })),
  });
};

export const lookupReport = async (req: Request, res: Response) => {
  const reportId = typeof req.query.reportId === "string" ? req.query.reportId : "";
  const email = typeof req.query.email === "string" ? req.query.email : "";

  if (!reportId || !isValidObjectId(reportId)) {
    return res.status(400).json({ error: "reportId invalido" });
  }
  if (!email || !isValidEmail(email)) {
    return res.status(400).json({ error: "Email requerido o invalido" });
  }

  const report = await Report.findById(reportId)
    .populate("createdBy", "email")
    .lean();
  if (!report) {
    return res.status(404).json({ error: "Reporte no encontrado" });
  }

  const createdByEmail = report.createdBy?.email;
  if (!createdByEmail || createdByEmail !== email.toLowerCase()) {
    return res.status(403).json({ error: "Acceso denegado" });
  }

  return res.json(formatReportDetail(report));
};

const handleEvidenceUpload = async (
  req: Request,
  res: Response,
  fallbackType: EvidenceType,
) => {
  const { id } = req.params;
  const report = await Report.findById(id);
  if (!report) {
    return res.status(404).json({ error: "Reporte no encontrado" });
  }

  const sessionUser = req.user ?? parseUserFromRequest(req);
  const rawType =
    typeof req.body.type === "string"
      ? req.body.type
      : typeof req.query.type === "string"
        ? req.query.type
        : fallbackType;
  const evidenceType = evidenceTypes.includes(rawType as EvidenceType)
    ? (rawType as EvidenceType)
    : null;
  if (!evidenceType) {
    return res.status(400).json({ error: "Tipo de evidencia invalido" });
  }
  if (evidenceType !== "BEFORE" && !isPrivilegedRole(sessionUser?.role)) {
    return res.status(403).json({ error: "No tienes permisos para este tipo de evidencia" });
  }

  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  if (files.length === 0) {
    return res.status(400).json({ error: "No se recibieron fotos" });
  }

  const urls = files.map((file) => `/uploads/${file.filename}`);
  const note = typeof req.body.note === "string" ? req.body.note.trim() : undefined;

  await ReportEvidence.insertMany(
    urls.map((url) => ({
      reportId: report._id,
      type: evidenceType,
      url,
      note: note || undefined,
      uploadedBy: sessionUser?.id,
    })),
  );

  report.photoUrls.push(...urls);
  await report.save();

  void safeLogReportEvent({
    reportId: report._id.toString(),
    type: "EVIDENCE_ADDED",
    createdBy: sessionUser?.id,
    data: { count: urls.length, evidenceType },
  });

  return res.json({ id: report._id, photoUrls: report.photoUrls, evidenceType });
};

export const uploadPhotos = async (req: Request, res: Response) =>
  handleEvidenceUpload(req, res, "BEFORE");

export const uploadEvidence = async (req: Request, res: Response) =>
  handleEvidenceUpload(req, res, "BEFORE");

export const addReportComment = async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!isValidObjectId(id)) {
    return res.status(400).json({ error: "reportId invalido" });
  }
  const { comment } = req.body as { comment?: string };
  if (!comment || !comment.trim()) {
    return res.status(400).json({ error: "Comentario requerido" });
  }
  const report = await Report.findById(id).select("createdBy");
  if (!report) {
    return res.status(404).json({ error: "Reporte no encontrado" });
  }
  const sessionUser = req.user ?? parseUserFromRequest(req);
  if (!sessionUser) {
    return res.status(401).json({ error: "No autenticado" });
  }
  const isOwner = report.createdBy?.toString() === sessionUser.id;
  if (!isOwner && !isPrivilegedRole(sessionUser.role)) {
    return res.status(403).json({ error: "Acceso denegado" });
  }

  const text = comment.trim();
  const event = await ReportEvent.create({
    reportId: report._id,
    type: "COMMENT",
    note: text,
    createdBy: sessionUser.id,
  });

  return res.status(201).json({ id: event._id, comment: text });
};

export const assignReport = async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!isValidObjectId(id)) {
    return res.status(400).json({ error: "reportId invalido" });
  }

  const { assigneeId, note } = req.body as { assigneeId?: string | null; note?: string };
  if (assigneeId === undefined) {
    return res.status(400).json({ error: "assigneeId es requerido" });
  }

  if (assigneeId !== null && assigneeId !== "" && !isValidObjectId(assigneeId)) {
    return res.status(400).json({ error: "assigneeId invalido" });
  }

  const report = await Report.findById(id);
  if (!report) {
    return res.status(404).json({ error: "Reporte no encontrado" });
  }

  let assignee = null as { id: string; email: string; role: string } | null;
  if (assigneeId) {
    const user = await User.findById(assigneeId).select("email role isActive").lean();
    if (!user || !user.isActive) {
      return res.status(400).json({ error: "Usuario no valido" });
    }
    assignee = { id: user._id.toString(), email: user.email, role: user.role };
    report.assignedTo = user._id;
    report.assignedAt = new Date();
    report.assignedBy = req.user?.id;
  } else {
    report.assignedTo = undefined;
    report.assignedAt = undefined;
    report.assignedBy = undefined;
  }

  await report.save();

  void safeLogReportEvent({
    reportId: report._id.toString(),
    type: "ASSIGNED",
    createdBy: req.user?.id,
    note: note?.trim() || undefined,
    data: { assigneeId: assignee?.id ?? null },
  });

  return res.json({
    id: report._id,
    assignedTo: report.assignedTo,
    assignedAt: report.assignedAt,
    assignedBy: report.assignedBy,
    assignee,
  });
};

export const scheduleReport = async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!isValidObjectId(id)) {
    return res.status(400).json({ error: "reportId invalido" });
  }

  const { scheduledAt, slaHours, slaTargetAt, note } = req.body as {
    scheduledAt?: string;
    slaHours?: number;
    slaTargetAt?: string;
    note?: string;
  };

  const scheduleDate = parseDateInput(scheduledAt);
  if (scheduledAt && !scheduleDate) {
    return res.status(400).json({ error: "scheduledAt invalido" });
  }
  if (!scheduleDate) {
    return res.status(400).json({ error: "scheduledAt es requerido" });
  }

  const slaTargetDate = parseDateInput(slaTargetAt);
  if (slaTargetAt && !slaTargetDate) {
    return res.status(400).json({ error: "slaTargetAt invalido" });
  }

  const slaHoursValue =
    typeof slaHours === "number"
      ? slaHours
      : typeof slaHours === "string"
        ? Number(slaHours)
        : Number.NaN;
  if (!Number.isNaN(slaHoursValue) && slaHoursValue < 1) {
    return res.status(400).json({ error: "slaHours invalido" });
  }

  const computedTarget =
    slaTargetDate ??
    (Number.isFinite(slaHoursValue)
      ? new Date(scheduleDate.getTime() + slaHoursValue * 60 * 60 * 1000)
      : undefined);

  const report = await Report.findById(id);
  if (!report) {
    return res.status(404).json({ error: "Reporte no encontrado" });
  }

  report.scheduledAt = scheduleDate;
  report.slaTargetAt = computedTarget;
  if (computedTarget) {
    report.slaBreachedAt = new Date() > computedTarget ? new Date() : undefined;
  } else {
    report.slaBreachedAt = undefined;
  }

  await report.save();

  void safeLogReportEvent({
    reportId: report._id.toString(),
    type: "SCHEDULED",
    createdBy: req.user?.id,
    note: note?.trim() || undefined,
    data: { scheduledAt: scheduleDate, slaTargetAt: computedTarget ?? null },
  });

  return res.json({
    id: report._id,
    scheduledAt: report.scheduledAt,
    slaTargetAt: report.slaTargetAt,
    slaBreachedAt: report.slaBreachedAt,
  });
};

export const updateReportDistrict = async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!isValidObjectId(id)) {
    return res.status(400).json({ error: "reportId invalido" });
  }

  const { district, note } = req.body as { district?: string | null; note?: string };
  if (district === undefined) {
    return res.status(400).json({ error: "district es requerido" });
  }

  let normalized: string | undefined;
  if (district && typeof district === "string" && district.trim()) {
    normalized = normalizeDistrict(district);
    const config = await SystemConfig.findOne().lean();
    const allowed = config?.districts ?? [];
    if (allowed.length > 0 && !allowed.includes(normalized)) {
      return res.status(400).json({ error: "Distrito invalido" });
    }
  }

  const report = await Report.findById(id);
  if (!report) {
    return res.status(404).json({ error: "Reporte no encontrado" });
  }

  report.district = normalized;
  await report.save();

  void safeLogReportEvent({
    reportId: report._id.toString(),
    type: "DISTRICT_UPDATED",
    createdBy: req.user?.id,
    note: note?.trim() || undefined,
    data: { district: normalized ?? null },
  });

  return res.json({ id: report._id, district: report.district });
};

export const getReportEvents = async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!isValidObjectId(id)) {
    return res.status(400).json({ error: "reportId invalido" });
  }

  const report = await Report.findById(id).select("createdBy");
  if (!report) {
    return res.status(404).json({ error: "Reporte no encontrado" });
  }

  const sessionUser = req.user ?? parseUserFromRequest(req);
  if (!sessionUser) {
    return res.status(401).json({ error: "No autenticado" });
  }
  const isOwner = report.createdBy?.toString() === sessionUser.id;
  if (!isOwner && !isPrivilegedRole(sessionUser.role)) {
    return res.status(403).json({ error: "Acceso denegado" });
  }

  const events = await ReportEvent.find({ reportId: report._id })
    .sort({ createdAt: -1 })
    .populate("createdBy", "email role")
    .lean();

  return res.json({
    items: events.map((event) => ({
      id: event._id,
      type: event.type,
      note: event.note,
      data: event.data,
      createdAt: event.createdAt,
      createdBy: event.createdBy,
    })),
  });
};

export const getReportEvidence = async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!isValidObjectId(id)) {
    return res.status(400).json({ error: "reportId invalido" });
  }

  const report = await Report.findById(id).select("createdBy");
  if (!report) {
    return res.status(404).json({ error: "Reporte no encontrado" });
  }

  const sessionUser = req.user ?? parseUserFromRequest(req);
  if (!sessionUser) {
    return res.status(401).json({ error: "No autenticado" });
  }
  const isOwner = report.createdBy?.toString() === sessionUser.id;
  if (!isOwner && !isPrivilegedRole(sessionUser.role)) {
    return res.status(403).json({ error: "Acceso denegado" });
  }

  const typeFilter = typeof req.query.type === "string" ? req.query.type : "";
  if (typeFilter && !evidenceTypes.includes(typeFilter as EvidenceType)) {
    return res.status(400).json({ error: "Tipo de evidencia invalido" });
  }

  const filter: Record<string, any> = { reportId: report._id };
  if (typeFilter) {
    filter.type = typeFilter;
  }

  const items = await ReportEvidence.find(filter)
    .sort({ createdAt: -1 })
    .populate("uploadedBy", "email role")
    .lean();

  return res.json({
    items: items.map((item) => ({
      id: item._id,
      type: item.type,
      url: item.url,
      note: item.note,
      createdAt: item.createdAt,
      uploadedBy: item.uploadedBy,
    })),
  });
};

export const getSurveyByToken = async (req: Request, res: Response) => {
  const { token } = req.params;
  if (!token || token.trim().length < 10) {
    return res.status(400).json({ error: "token invalido" });
  }

  const survey = await ReportSurvey.findOne({ token }).lean();
  if (!survey) {
    return res.status(404).json({ error: "Encuesta no encontrada" });
  }

  const report = await Report.findById(survey.reportId)
    .select("category addressText status")
    .lean();
  if (!report) {
    return res.status(404).json({ error: "Reporte no encontrado" });
  }

  return res.json({
    report: {
      id: report._id,
      category: report.category,
      addressText: report.addressText,
      status: report.status,
    },
    submittedAt: survey.submittedAt,
    rating: survey.rating,
    comment: survey.comment,
  });
};

export const submitSurvey = async (req: Request, res: Response) => {
  const { token } = req.params;
  if (!token || token.trim().length < 10) {
    return res.status(400).json({ error: "token invalido" });
  }

  const { rating, comment } = req.body as { rating?: number; comment?: string };
  const numericRating = Number(rating);
  if (!Number.isFinite(numericRating) || numericRating < 1 || numericRating > 5) {
    return res.status(400).json({ error: "rating invalido" });
  }
  if (comment && comment.length > SURVEY_COMMENT_MAX) {
    return res.status(400).json({ error: "Comentario demasiado largo" });
  }

  const survey = await ReportSurvey.findOne({ token });
  if (!survey) {
    return res.status(404).json({ error: "Encuesta no encontrada" });
  }
  if (survey.submittedAt) {
    return res.status(409).json({ error: "Encuesta ya respondida" });
  }

  survey.rating = numericRating;
  survey.comment = comment?.trim() || undefined;
  survey.submittedAt = new Date();
  await survey.save();

  return res.json({ ok: true, submittedAt: survey.submittedAt });
};

export const updateReportStatus = async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!isValidObjectId(id)) {
    return res.status(400).json({ error: "reportId invalido" });
  }

  const { status, note } = req.body as { status?: string; note?: string };
  if (!status || !reportStatuses.includes(status as ReportStatus)) {
    return res.status(400).json({ error: "Status invalido" });
  }
  if (["RESOLVED", "CLOSED"].includes(status) && !note?.trim()) {
    return res.status(400).json({ error: "La justificacion es requerida" });
  }

  const report = await Report.findById(id);
  if (!report) {
    return res.status(404).json({ error: "Reporte no encontrado" });
  }

  const currentStatus = report.status as ReportStatus;
  const allowedNext = transitionMap[currentStatus] ?? [];
  if (!allowedNext.includes(status as ReportStatus)) {
    return res.status(400).json({ error: "Transicion no permitida" });
  }

  report.status = status as ReportStatus;
  report.statusHistory.push({
    status: status as ReportStatus,
    at: new Date(),
    by: req.user?.id,
    note: note?.trim() || undefined,
  });
  await report.save();

  void safeLogReportEvent({
    reportId: report._id.toString(),
    type: "STATUS_CHANGED",
    createdBy: req.user?.id,
    note: note?.trim(),
    data: { from: currentStatus, to: status },
  });

  void sendStatusNotification(report, status, note?.trim());
  if (status === "CLOSED") {
    void sendSurveyInvitation(report);
  }

  return res.json({ id: report._id, status: report.status, statusHistory: report.statusHistory });
};

export const listAdminReports = async (req: Request, res: Response) => {
  const { status, category, q, priority, district, from, to, sort, minAgeDays, backlog } =
    req.query as {
    status?: string;
    category?: string;
    q?: string;
    priority?: string;
    district?: string;
    from?: string;
    to?: string;
    sort?: string;
    minAgeDays?: string;
    backlog?: string;
  };

  const filter: Record<string, any> = {};
  const andFilters: Record<string, any>[] = [];
  if (status && reportStatuses.includes(status as ReportStatus)) {
    filter.status = status;
  }
  if (category && reportCategories.includes(category as any)) {
    filter.category = category;
  }
  if (q && q.trim()) {
    andFilters.push({
      $or: [
        { description: { $regex: q.trim(), $options: "i" } },
        { addressText: { $regex: q.trim(), $options: "i" } },
      ],
    });
  }
  if (priority && priorityLevels.includes(priority as PriorityLevel)) {
    andFilters.push({
      $or: [
        { priorityOverride: priority },
        { priorityOverride: { $exists: false }, priority },
        { priorityOverride: null, priority },
      ],
    });
  }
  if (district && district.trim()) {
    filter.district = normalizeDistrict(district);
  }
  const fromDate = parseDateInput(from);
  if (from && !fromDate) {
    return res.status(400).json({ error: "from invalido" });
  }
  const toDate = parseDateInput(to);
  if (to && !toDate) {
    return res.status(400).json({ error: "to invalido" });
  }
  if (fromDate && toDate && fromDate > toDate) {
    return res.status(400).json({ error: "Rango de fechas invalido" });
  }
  if (fromDate || toDate) {
    filter.createdAt = {};
    if (fromDate) filter.createdAt.$gte = fromDate;
    if (toDate) filter.createdAt.$lte = toDate;
  }
  const minAgeValue = typeof minAgeDays === "string" ? Number(minAgeDays) : NaN;
  if (Number.isFinite(minAgeValue) && minAgeValue >= 0) {
    const cutoff = new Date(Date.now() - minAgeValue * 24 * 60 * 60 * 1000);
    filter.createdAt = { ...(filter.createdAt ?? {}), $lte: cutoff };
  }
  if (backlog === "true" && !filter.status) {
    filter.status = { $ne: "CLOSED" };
  }
  if (andFilters.length > 0) {
    filter.$and = andFilters;
  }

  const sortBy = sort === "age" ? { createdAt: 1 } : { createdAt: -1 };
  const reports = await Report.find(filter)
    .sort(sortBy)
    .select(
      "category status createdAt addressText location impact urgency priority priorityOverride district",
    )
    .lean();

  return res.json({
    items: reports.map((report) => ({
      id: report._id,
      category: report.category,
      status: report.status,
      createdAt: report.createdAt,
      addressText: report.addressText,
      location: report.location,
      impact: report.impact,
      urgency: report.urgency,
      priority: report.priority,
      priorityOverride: report.priorityOverride,
      effectivePriority: report.priorityOverride ?? report.priority,
      district: report.district,
      ageDays: Math.floor(
        (Date.now() - new Date(report.createdAt).getTime()) / (1000 * 60 * 60 * 24),
      ),
    })),
  });
};

export const triageReport = async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!isValidObjectId(id)) {
    return res.status(400).json({ error: "reportId invalido" });
  }

  const { impact, urgency, priorityOverride } = req.body as {
    impact?: number;
    urgency?: number;
    priorityOverride?: PriorityLevel | null;
  };

  if (typeof impact !== "number" || impact < 1 || impact > 5) {
    return res.status(400).json({ error: "Impacto invalido" });
  }
  if (typeof urgency !== "number" || urgency < 1 || urgency > 5) {
    return res.status(400).json({ error: "Urgencia invalida" });
  }
  if (
    priorityOverride !== undefined &&
    priorityOverride !== null &&
    !priorityLevels.includes(priorityOverride)
  ) {
    return res.status(400).json({ error: "priorityOverride invalido" });
  }

  const report = await Report.findById(id);
  if (!report) {
    return res.status(404).json({ error: "Reporte no encontrado" });
  }

  const computed = computePriority(impact, urgency);
  report.impact = impact;
  report.urgency = urgency;
  report.priority = computed;
  report.priorityOverride =
    priorityOverride === null ? undefined : priorityOverride;
  report.priorityUpdatedAt = new Date();
  report.priorityUpdatedBy = req.user?.id;
  await report.save();

  void safeLogReportEvent({
    reportId: report._id.toString(),
    type: "TRIAGE_UPDATED",
    createdBy: req.user?.id,
    data: {
      impact,
      urgency,
      priority: report.priority,
      priorityOverride: report.priorityOverride ?? null,
    },
  });

  return res.json({
    id: report._id,
    impact: report.impact,
    urgency: report.urgency,
    priority: report.priority,
    priorityOverride: report.priorityOverride,
    effectivePriority: report.priorityOverride ?? report.priority,
  });
};

const parseNumber = (value: unknown) => {
  const num = typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(num) ? num : null;
};

const validateBBox = (
  minLng: number,
  minLat: number,
  maxLng: number,
  maxLat: number,
) => {
  if (minLng < -180 || minLng > 180) return false;
  if (maxLng < -180 || maxLng > 180) return false;
  if (minLat < -90 || minLat > 90) return false;
  if (maxLat < -90 || maxLat > 90) return false;
  if (minLng >= maxLng || minLat >= maxLat) return false;
  return true;
};

const buildPriorityFilter = (priority?: string) => {
  if (!priority || !priorityLevels.includes(priority as PriorityLevel)) {
    return null;
  }
  return {
    $or: [
      { priorityOverride: priority },
      { priorityOverride: { $exists: false }, priority },
      { priorityOverride: null, priority },
    ],
  };
};

export const listMapReports = async (req: Request, res: Response) => {
  const minLng = parseNumber(req.query.minLng);
  const minLat = parseNumber(req.query.minLat);
  const maxLng = parseNumber(req.query.maxLng);
  const maxLat = parseNumber(req.query.maxLat);
  const fromDate = parseDateInput(req.query.from);
  if (req.query.from && !fromDate) {
    return res.status(400).json({ error: "from invalido" });
  }
  const toDate = parseDateInput(req.query.to);
  if (req.query.to && !toDate) {
    return res.status(400).json({ error: "to invalido" });
  }
  if (fromDate && toDate && fromDate > toDate) {
    return res.status(400).json({ error: "Rango de fechas invalido" });
  }

  if (
    minLng === null ||
    minLat === null ||
    maxLng === null ||
    maxLat === null ||
    !validateBBox(minLng, minLat, maxLng, maxLat)
  ) {
    return res.status(400).json({ error: "BBox invalido" });
  }

  const limitRaw = parseNumber(req.query.limit);
  const limit = Math.min(Math.max(limitRaw ?? 1000, 1), 2000);

  const filter: Record<string, any> = {
    location: {
      $geoWithin: {
        $geometry: {
          type: "Polygon",
          coordinates: [
            [
              [minLng, minLat],
              [maxLng, minLat],
              [maxLng, maxLat],
              [minLng, maxLat],
              [minLng, minLat],
            ],
          ],
        },
      },
    },
  };

  const andFilters: Record<string, any>[] = [];

  const category = typeof req.query.category === "string" ? req.query.category : "";
  if (category && reportCategories.includes(category as any)) {
    filter.category = category;
  }

  const status = typeof req.query.status === "string" ? req.query.status : "";
  if (status && reportStatuses.includes(status as ReportStatus)) {
    filter.status = status;
  }

  const district =
    typeof req.query.district === "string" ? normalizeDistrict(req.query.district) : "";
  if (district) {
    filter.district = district;
  }

  if (fromDate || toDate) {
    filter.createdAt = {};
    if (fromDate) filter.createdAt.$gte = fromDate;
    if (toDate) filter.createdAt.$lte = toDate;
  }

  const priorityFilter = buildPriorityFilter(
    typeof req.query.priority === "string" ? req.query.priority : "",
  );
  if (priorityFilter) {
    andFilters.push(priorityFilter);
  }

  if (andFilters.length > 0) {
    filter.$and = andFilters;
  }

  const reports = await Report.find(filter)
    .limit(limit)
    .select("category status location createdAt priority priorityOverride")
    .lean();

  const items = reports
    .map((report) => {
      const coords = report.location?.coordinates ?? [];
      return {
        id: report._id,
        category: report.category,
        status: report.status,
        lng: coords[0],
        lat: coords[1],
        createdAt: report.createdAt,
        effectivePriority: report.priorityOverride ?? report.priority,
      };
    })
    .filter((item) => typeof item.lng === "number" && typeof item.lat === "number");

  return res.json({ items, count: items.length });
};

export const listAdminMapReports = async (req: Request, res: Response) => {
  const minLng = parseNumber(req.query.minLng);
  const minLat = parseNumber(req.query.minLat);
  const maxLng = parseNumber(req.query.maxLng);
  const maxLat = parseNumber(req.query.maxLat);
  const fromDate = parseDateInput(req.query.from);
  if (req.query.from && !fromDate) {
    return res.status(400).json({ error: "from invalido" });
  }
  const toDate = parseDateInput(req.query.to);
  if (req.query.to && !toDate) {
    return res.status(400).json({ error: "to invalido" });
  }
  if (fromDate && toDate && fromDate > toDate) {
    return res.status(400).json({ error: "Rango de fechas invalido" });
  }

  if (
    minLng === null ||
    minLat === null ||
    maxLng === null ||
    maxLat === null ||
    !validateBBox(minLng, minLat, maxLng, maxLat)
  ) {
    return res.status(400).json({ error: "BBox invalido" });
  }

  const limitRaw = parseNumber(req.query.limit);
  const limit = Math.min(Math.max(limitRaw ?? 1000, 1), 2000);

  const filter: Record<string, any> = {
    location: {
      $geoWithin: {
        $geometry: {
          type: "Polygon",
          coordinates: [
            [
              [minLng, minLat],
              [maxLng, minLat],
              [maxLng, maxLat],
              [minLng, maxLat],
              [minLng, minLat],
            ],
          ],
        },
      },
    },
  };

  const andFilters: Record<string, any>[] = [];

  const category = typeof req.query.category === "string" ? req.query.category : "";
  if (category && reportCategories.includes(category as any)) {
    filter.category = category;
  }

  const status = typeof req.query.status === "string" ? req.query.status : "";
  if (status && reportStatuses.includes(status as ReportStatus)) {
    filter.status = status;
  }

  const district =
    typeof req.query.district === "string" ? normalizeDistrict(req.query.district) : "";
  if (district) {
    filter.district = district;
  }

  if (fromDate || toDate) {
    filter.createdAt = {};
    if (fromDate) filter.createdAt.$gte = fromDate;
    if (toDate) filter.createdAt.$lte = toDate;
  }

  const priorityFilter = buildPriorityFilter(
    typeof req.query.priority === "string" ? req.query.priority : "",
  );
  if (priorityFilter) {
    andFilters.push(priorityFilter);
  }

  if (andFilters.length > 0) {
    filter.$and = andFilters;
  }

  const reports = await Report.find(filter)
    .limit(limit)
    .select("category status location createdAt priority priorityOverride addressText")
    .lean();

  const items = reports
    .map((report) => {
      const coords = report.location?.coordinates ?? [];
      return {
        id: report._id,
        category: report.category,
        status: report.status,
        lng: coords[0],
        lat: coords[1],
        createdAt: report.createdAt,
        effectivePriority: report.priorityOverride ?? report.priority,
        addressText: report.addressText,
      };
    })
    .filter((item) => typeof item.lng === "number" && typeof item.lat === "number");

  return res.json({ items, count: items.length });
};

const hoursDiff = (start: Date, end: Date) => {
  const diffMs = end.getTime() - start.getTime();
  return diffMs / (1000 * 60 * 60);
};

export const getAdminMetricsSummary = async (_req: Request, res: Response) => {
  const [all, closed, byStatusAgg, byCategoryAgg] = await Promise.all([
    Report.countDocuments({}),
    Report.countDocuments({ status: "CLOSED" }),
    Report.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    Report.aggregate([
      { $group: { _id: "$category", count: { $sum: 1 } } },
    ]),
  ]);

  const byStatus: Record<string, number> = {};
  reportStatuses.forEach((status) => {
    byStatus[status] = 0;
  });
  byStatusAgg.forEach((row: { _id: string; count: number }) => {
    if (row._id) byStatus[row._id] = row.count;
  });

  const byCategory: Record<string, number> = {};
  reportCategories.forEach((category) => {
    byCategory[category] = 0;
  });
  byCategoryAgg.forEach((row: { _id: string; count: number }) => {
    if (row._id) byCategory[row._id] = row.count;
  });

  const reportsForTimes = await Report.find({
    "statusHistory.status": { $in: ["RECEIVED", "VERIFIED", "CLOSED"] },
  })
    .select("statusHistory")
    .lean();

  const mttaSamples: number[] = [];
  const mttrSamples: number[] = [];

  reportsForTimes.forEach((report) => {
    const receivedAt = report.statusHistory
      ?.filter((entry) => entry.status === "RECEIVED")
      .map((entry) => new Date(entry.at))
      .sort((a, b) => a.getTime() - b.getTime())[0];

    if (!receivedAt) return;

    const verifiedAt = report.statusHistory
      ?.filter((entry) => entry.status === "VERIFIED")
      .map((entry) => new Date(entry.at))
      .sort((a, b) => a.getTime() - b.getTime())[0];

    const closedAt = report.statusHistory
      ?.filter((entry) => entry.status === "CLOSED")
      .map((entry) => new Date(entry.at))
      .sort((a, b) => a.getTime() - b.getTime())[0];

    if (verifiedAt) {
      mttaSamples.push(hoursDiff(receivedAt, verifiedAt));
    }
    if (closedAt) {
      mttrSamples.push(hoursDiff(receivedAt, closedAt));
    }
  });

  const mttaHoursAvg =
    mttaSamples.length > 0
      ? mttaSamples.reduce((sum, value) => sum + value, 0) / mttaSamples.length
      : null;
  const mttrHoursAvg =
    mttrSamples.length > 0
      ? mttrSamples.reduce((sum, value) => sum + value, 0) / mttrSamples.length
      : null;

  return res.json({
    totals: {
      all,
      open: all - closed,
      closed,
    },
    byStatus,
    byCategory,
    mttaHoursAvg,
    mttrHoursAvg,
  });
};

export const getAdminHotspots = async (req: Request, res: Response) => {
  const sinceDays = parseNumber(req.query.sinceDays);
  if (sinceDays !== null && sinceDays < 1) {
    return res.status(400).json({ error: "sinceDays invalido" });
  }

  const match: Record<string, any> = {};
  if (sinceDays !== null) {
    match.createdAt = { $gte: new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000) };
  }

  const byDistrictAgg = await Report.aggregate([
    ...(Object.keys(match).length > 0 ? [{ $match: match }] : []),
    { $match: { district: { $exists: true, $ne: null, $ne: "" } } },
    { $group: { _id: "$district", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 20 },
  ]);

  const recurrentAgg = await Report.aggregate([
    ...(Object.keys(match).length > 0 ? [{ $match: match }] : []),
    {
      $project: {
        lng: { $arrayElemAt: ["$location.coordinates", 0] },
        lat: { $arrayElemAt: ["$location.coordinates", 1] },
      },
    },
    { $match: { lng: { $type: "number" }, lat: { $type: "number" } } },
    {
      $project: {
        lng: { $divide: [{ $trunc: { $multiply: ["$lng", 10000] } }, 10000] },
        lat: { $divide: [{ $trunc: { $multiply: ["$lat", 10000] } }, 10000] },
      },
    },
    { $group: { _id: { lng: "$lng", lat: "$lat" }, count: { $sum: 1 } } },
    { $match: { count: { $gte: 2 } } },
    { $sort: { count: -1 } },
    { $limit: 50 },
  ]);

  return res.json({
    byDistrict: byDistrictAgg.map((row: { _id: string; count: number }) => ({
      district: row._id,
      count: row.count,
    })),
    recurrentLocations: recurrentAgg.map((row: { _id: { lng: number; lat: number }; count: number }) => ({
      lng: row._id.lng,
      lat: row._id.lat,
      count: row.count,
    })),
  });
};

export const getAdminBacklogMetrics = async (_req: Request, res: Response) => {
  const now = new Date();
  const bucketBoundaries = [0, 1, 3, 7, 14, 30, 60, 90, 180, 365, 10000];
  const bucketLabels = [
    "0-1 dias",
    "1-3 dias",
    "3-7 dias",
    "7-14 dias",
    "14-30 dias",
    "30-60 dias",
    "60-90 dias",
    "90-180 dias",
    "180-365 dias",
    "365+ dias",
  ];

  const [bucketAgg, oldestAgg] = await Promise.all([
    Report.aggregate([
      { $match: { status: { $ne: "CLOSED" } } },
      {
        $project: {
          ageDays: {
            $floor: {
              $divide: [{ $subtract: [now, "$createdAt"] }, 1000 * 60 * 60 * 24],
            },
          },
        },
      },
      {
        $bucket: {
          groupBy: "$ageDays",
          boundaries: bucketBoundaries,
          default: "overflow",
          output: { count: { $sum: 1 } },
        },
      },
    ]),
    Report.aggregate([
      { $match: { status: { $ne: "CLOSED" } } },
      { $sort: { createdAt: 1 } },
      { $limit: 20 },
      {
        $project: {
          category: 1,
          status: 1,
          district: 1,
          createdAt: 1,
          priority: 1,
          priorityOverride: 1,
        },
      },
    ]),
  ]);

  const bucketById = new Map<string | number, number>();
  bucketAgg.forEach((row: { _id: string | number; count: number }) => {
    bucketById.set(row._id, row.count);
  });

  const buckets = bucketBoundaries.slice(0, -1).map((bound, index) => ({
    label: bucketLabels[index] ?? `${bound}+ dias`,
    count: bucketById.get(bound) ?? 0,
  }));

  const oldest = oldestAgg.map(
    (item: {
      _id: mongoose.Types.ObjectId;
      category?: string;
      status?: string;
      district?: string;
      createdAt: Date;
      priority?: string;
      priorityOverride?: string;
    }) => {
      const ageDays = Math.floor((now.getTime() - new Date(item.createdAt).getTime()) / 86400000);
      return {
        id: item._id.toString(),
        category: item.category,
        status: item.status,
        district: item.district,
        createdAt: item.createdAt,
        ageDays,
        effectivePriority: item.priorityOverride ?? item.priority ?? null,
      };
    },
  );

  return res.json({
    buckets,
    oldest,
  });
};

const tile2bbox = (x: number, y: number, z: number) => {
  const n = Math.pow(2, z);
  const lng1 = (x / n) * 360 - 180;
  const lng2 = ((x + 1) / n) * 360 - 180;
  const lat1 = (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n))) * 180) / Math.PI;
  const lat2 =
    (Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + 1)) / n))) * 180) / Math.PI;
  return [lng1, lat2, lng2, lat1] as const;
};

export const listMapTiles = async (req: Request, res: Response) => {
  const z = Number(req.params.z);
  const x = Number(req.params.x);
  const y = Number(req.params.y);
  const fromDate = parseDateInput(req.query.from);
  if (req.query.from && !fromDate) {
    return res.status(400).json({ error: "from invalido" });
  }
  const toDate = parseDateInput(req.query.to);
  if (req.query.to && !toDate) {
    return res.status(400).json({ error: "to invalido" });
  }
  if (fromDate && toDate && fromDate > toDate) {
    return res.status(400).json({ error: "Rango de fechas invalido" });
  }

  if (!Number.isFinite(z) || !Number.isFinite(x) || !Number.isFinite(y)) {
    return res.status(400).json({ error: "Tile invalido" });
  }

  const [minLng, minLat, maxLng, maxLat] = tile2bbox(x, y, z);

  const filter: Record<string, any> = {
    location: {
      $geoWithin: {
        $geometry: {
          type: "Polygon",
          coordinates: [
            [
              [minLng, minLat],
              [maxLng, minLat],
              [maxLng, maxLat],
              [minLng, maxLat],
              [minLng, minLat],
            ],
          ],
        },
      },
    },
  };

  const andFilters: Record<string, any>[] = [];

  const category = typeof req.query.category === "string" ? req.query.category : "";
  if (category && reportCategories.includes(category as any)) {
    filter.category = category;
  }

  const status = typeof req.query.status === "string" ? req.query.status : "";
  if (status && reportStatuses.includes(status as ReportStatus)) {
    filter.status = status;
  }

  const district =
    typeof req.query.district === "string" ? normalizeDistrict(req.query.district) : "";
  if (district) {
    filter.district = district;
  }

  if (fromDate || toDate) {
    filter.createdAt = {};
    if (fromDate) filter.createdAt.$gte = fromDate;
    if (toDate) filter.createdAt.$lte = toDate;
  }

  const priorityFilter = buildPriorityFilter(
    typeof req.query.priority === "string" ? req.query.priority : "",
  );
  if (priorityFilter) {
    andFilters.push(priorityFilter);
  }
  if (andFilters.length > 0) {
    filter.$and = andFilters;
  }

  const points = await Report.find(filter)
    .select("category status location createdAt priority priorityOverride")
    .lean();

  const features = points
    .map((report) => {
      const coords = report.location?.coordinates ?? [];
      if (typeof coords[0] !== "number" || typeof coords[1] !== "number") return null;
      return {
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: [coords[0], coords[1]] },
        properties: {
          id: report._id.toString(),
          category: report.category,
          status: report.status,
          createdAt: report.createdAt,
          effectivePriority: report.priorityOverride ?? report.priority ?? null,
        },
      };
    })
    .filter(Boolean) as Array<{
    type: "Feature";
    geometry: { type: "Point"; coordinates: [number, number] };
    properties: Record<string, any>;
  }>;

  const { default: Supercluster } = await import("supercluster");
  const cluster = new Supercluster({
    radius: 60,
    maxZoom: 18,
  });
  cluster.load(features);
  const clusters = cluster.getClusters([minLng, minLat, maxLng, maxLat], z);

  return res.json({
    items: clusters.map((item: any) => {
      const [lng, lat] = item.geometry.coordinates;
      if (item.properties.cluster) {
        return {
          id: item.id,
          type: "cluster",
          lng,
          lat,
          count: item.properties.point_count,
        };
      }
      return {
        id: item.properties.id,
        type: "point",
        lng,
        lat,
        category: item.properties.category,
        status: item.properties.status,
        createdAt: item.properties.createdAt,
        effectivePriority: item.properties.effectivePriority,
      };
    }),
  });
};
