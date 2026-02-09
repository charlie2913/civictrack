import { Router } from "express";
import {
  addReportComment,
  assignReport,
  createReport,
  getReportEvidence,
  getReportEvents,
  getSurveyByToken,
  getMyReports,
  getReportById,
  lookupReport,
  listMapReports,
  listMapTiles,
  listAdminReports,
  scheduleReport,
  triageReport,
  updateReportDistrict,
  updateReportStatus,
  submitSurvey,
  uploadEvidence,
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
router.post("/:id/evidence", upload.array("photos", 5), uploadEvidence);
router.post("/:id/comments", requireAuth, addReportComment);
router.get("/:id/events", requireAuth, getReportEvents);
router.get("/:id/evidence", requireAuth, getReportEvidence);
router.get("/survey/:token", getSurveyByToken);
router.post("/survey/:token", submitSurvey);
router.get("/mine", requireAuth, getMyReports);
router.get("/:id", getReportById);
router.patch(
  "/:id/status",
  requireAuth,
  requireRole("ADMIN", "OPERATOR", "SUPERVISOR"),
  updateReportStatus,
);
router.patch(
  "/:id/assignment",
  requireAuth,
  requireRole("ADMIN", "OPERATOR", "SUPERVISOR"),
  assignReport,
);
router.patch(
  "/:id/schedule",
  requireAuth,
  requireRole("ADMIN", "OPERATOR", "SUPERVISOR"),
  scheduleReport,
);
router.patch(
  "/:id/district",
  requireAuth,
  requireRole("ADMIN", "OPERATOR", "SUPERVISOR"),
  updateReportDistrict,
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
