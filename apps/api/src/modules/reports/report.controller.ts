import type { Request, Response } from "express";
import jwt from "jsonwebtoken";
import Report, { reportCategories } from "./report.model";
import User from "../../models/User";
import mongoose from "mongoose";

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
    return { id: payload.sub };
  } catch {
    return null;
  }
};

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

const formatReportDetail = (report: any) => ({
  id: report._id,
  category: report.category,
  description: report.description,
  location: report.location,
  addressText: report.addressText,
  photoUrls: report.photoUrls,
  status: report.status,
  statusHistory: report.statusHistory,
  createdAt: report.createdAt,
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

export const createReport = async (req: Request, res: Response) => {
  const { category, description, location, addressText, reporterEmail } = req.body as {
    category?: string;
    description?: string;
    location?: { lat?: number; lng?: number; coordinates?: number[] };
    addressText?: string;
    reporterEmail?: string;
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

  const report = await Report.findById(id)
    .populate("createdBy", "email role")
    .lean();
  if (!report) {
    return res.status(404).json({ error: "Reporte no encontrado" });
  }

  if (req.user) {
    const isOwner = report.createdBy?._id?.toString() === req.user.id;
    const isPrivileged = ["ADMIN", "SUPERVISOR"].includes(req.user.role);
    if (!isOwner && !isPrivileged) {
      return res.status(403).json({ error: "Acceso denegado" });
    }
    return res.json(formatReportDetail(report));
  }

  const email = typeof req.query.email === "string" ? req.query.email : "";
  if (!email || !isValidEmail(email)) {
    return res.status(400).json({ error: "Email requerido o invalido" });
  }

  const createdByEmail = report.createdBy?.email;
  if (!createdByEmail || createdByEmail !== email.toLowerCase()) {
    return res.status(403).json({ error: "Acceso denegado" });
  }

  return res.json(formatReportDetail(report));
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

export const uploadPhotos = async (req: Request, res: Response) => {
  const { id } = req.params;
  const report = await Report.findById(id);
  if (!report) {
    return res.status(404).json({ error: "Reporte no encontrado" });
  }

  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  if (files.length === 0) {
    return res.status(400).json({ error: "No se recibieron fotos" });
  }

  const urls = files.map((file) => `/uploads/${file.filename}`);
  report.photoUrls.push(...urls);
  await report.save();

  return res.json({ id: report._id, photoUrls: report.photoUrls });
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

  return res.json({ id: report._id, status: report.status, statusHistory: report.statusHistory });
};

export const listAdminReports = async (req: Request, res: Response) => {
  const { status, category, q } = req.query as {
    status?: string;
    category?: string;
    q?: string;
  };

  const filter: Record<string, any> = {};
  if (status && reportStatuses.includes(status as ReportStatus)) {
    filter.status = status;
  }
  if (category && reportCategories.includes(category as any)) {
    filter.category = category;
  }
  if (q && q.trim()) {
    filter.$or = [
      { description: { $regex: q.trim(), $options: "i" } },
      { addressText: { $regex: q.trim(), $options: "i" } },
    ];
  }

  const reports = await Report.find(filter)
    .sort({ createdAt: -1 })
    .select("category status createdAt addressText location")
    .lean();

  return res.json({
    items: reports.map((report) => ({
      id: report._id,
      category: report.category,
      status: report.status,
      createdAt: report.createdAt,
      addressText: report.addressText,
      location: report.location,
    })),
  });
};
