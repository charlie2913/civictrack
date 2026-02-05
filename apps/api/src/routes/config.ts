import { Router } from "express";
import SystemConfig, {
  defaultNotificationEvents,
} from "../models/SystemConfig";
import { requireAuth, requireRole } from "../middleware/auth";

const router = Router();

const allowedNotificationEvents = new Set(defaultNotificationEvents);

const ensureConfig = async () => {
  let config = await SystemConfig.findOne();
  if (!config) {
    config = await SystemConfig.create({});
  }
  return config;
};

router.get("/config/public", async (_req, res) => {
  const config = await ensureConfig();
  return res.json({
    reportCategories: config.reportCategories,
    photoMaxFiles: config.photoMaxFiles,
    photoMaxMb: config.photoMaxMb,
    mapMaxPoints: config.mapMaxPoints,
  });
});

router.get(
  "/admin/config",
  requireAuth,
  requireRole("ADMIN"),
  async (_req, res) => {
    const config = await ensureConfig();
    return res.json(config);
  },
);

router.patch(
  "/admin/config",
  requireAuth,
  requireRole("ADMIN"),
  async (req, res) => {
    const body = req.body as {
      reportCategories?: string[];
      photoMaxFiles?: number;
      photoMaxMb?: number;
      mapMaxPoints?: number;
      notificationEvents?: string[];
    };

    const updates: Record<string, any> = {};

    if (body.reportCategories !== undefined) {
      if (
        !Array.isArray(body.reportCategories) ||
        body.reportCategories.length === 0
      ) {
        return res.status(400).json({ error: "reportCategories invalido" });
      }
      updates.reportCategories = body.reportCategories;
    }

    if (body.photoMaxFiles !== undefined) {
      const value = Number(body.photoMaxFiles);
      if (!Number.isFinite(value) || value < 1 || value > 10) {
        return res.status(400).json({ error: "photoMaxFiles invalido" });
      }
      updates.photoMaxFiles = value;
    }

    if (body.photoMaxMb !== undefined) {
      const value = Number(body.photoMaxMb);
      if (!Number.isFinite(value) || value < 1 || value > 10) {
        return res.status(400).json({ error: "photoMaxMb invalido" });
      }
      updates.photoMaxMb = value;
    }

    if (body.mapMaxPoints !== undefined) {
      const value = Number(body.mapMaxPoints);
      if (!Number.isFinite(value) || value < 100 || value > 5000) {
        return res.status(400).json({ error: "mapMaxPoints invalido" });
      }
      updates.mapMaxPoints = value;
    }

    if (body.notificationEvents !== undefined) {
      if (!Array.isArray(body.notificationEvents)) {
        return res.status(400).json({ error: "notificationEvents invalido" });
      }
      const invalid = body.notificationEvents.find(
        (event) => !allowedNotificationEvents.has(event),
      );
      if (invalid) {
        return res.status(400).json({ error: "notificationEvents invalido" });
      }
      updates.notificationEvents = body.notificationEvents;
    }

    const config = await ensureConfig();
    Object.assign(config, updates);
    await config.save();
    return res.json(config);
  },
);

export default router;
