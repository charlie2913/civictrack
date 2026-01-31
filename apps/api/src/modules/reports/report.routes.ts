import { Router } from "express";
import {
  createReport,
  getMyReports,
  getReportById,
  lookupReport,
  listAdminReports,
  updateReportStatus,
  uploadPhotos,
} from "./report.controller";
import { requireAuth, requireRole } from "../../middleware/auth";
import { upload } from "./uploads";

const router = Router();

router.post("/", createReport);
router.get("/lookup", lookupReport);
router.post("/:id/photos", upload.array("photos", 5), uploadPhotos);
router.get("/mine", requireAuth, getMyReports);
router.get("/:id", getReportById);
router.patch(
  "/:id/status",
  requireAuth,
  requireRole("ADMIN", "OPERATOR", "SUPERVISOR"),
  updateReportStatus,
);
router.get(
  "/admin/list",
  requireAuth,
  requireRole("ADMIN", "OPERATOR", "SUPERVISOR"),
  listAdminReports,
);

export default router;
