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
    return { id: payload.sub, role: payload.role, email: payload.email };
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

  const baseReport = await Report.findById(id)
    .populate("createdBy", "email role")
    .lean();
  if (!baseReport) {
    return res.status(404).json({ error: "Reporte no encontrado" });
  }

  const sessionUser = req.user ?? parseUserFromRequest(req);

  if (sessionUser) {
    const isOwner = baseReport.createdBy?._id?.toString() === sessionUser.id;
    const isPrivileged = ["ADMIN", "SUPERVISOR"].includes(sessionUser.role);
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
  const { status, category, q, priority } = req.query as {
    status?: string;
    category?: string;
    q?: string;
    priority?: string;
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
  if (andFilters.length > 0) {
    filter.$and = andFilters;
  }

  const reports = await Report.find(filter)
    .sort({ createdAt: -1 })
    .select(
      "category status createdAt addressText location impact urgency priority priorityOverride",
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
