import { Router } from "express";
import {
  createReport,
  getMyReports,
  getReportById,
  lookupReport,
  listMapReports,
  listMapTiles,
  listAdminReports,
  triageReport,
  updateReportStatus,
  uploadPhotos,
} from "./report.controller";
import { requireAuth, requireRole } from "../../middleware/auth";
import { upload } from "./uploads";

const router = Router();

router.post("/", createReport);
router.get("/lookup", lookupReport);
router.get("/map", listMapReports);
router.get("/map/tiles/:z/:x/:y", listMapTiles);
router.post("/:id/photos", upload.array("photos", 5), uploadPhotos);
router.get("/mine", requireAuth, getMyReports);
router.get("/:id", getReportById);
router.patch(
  "/:id/status",
  requireAuth,
  requireRole("ADMIN", "OPERATOR", "SUPERVISOR"),
  updateReportStatus,
);
router.patch(
  "/:id/triage",
  requireAuth,
  requireRole("ADMIN", "OPERATOR", "SUPERVISOR"),
  triageReport,
);
router.get(
  "/admin/list",
  requireAuth,
  requireRole("ADMIN", "OPERATOR", "SUPERVISOR"),
  listAdminReports,
);

export default router;
