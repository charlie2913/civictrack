import { Router } from "express";
import {
  createReport,
  getMyReports,
  getReportById,
  uploadPhotos,
} from "./report.controller";
import { requireAuth } from "../../middleware/auth";
import { upload } from "./uploads";

const router = Router();

router.post("/", createReport);
router.post("/:id/photos", upload.array("photos", 5), uploadPhotos);
router.get("/mine", requireAuth, getMyReports);
router.get("/:id", getReportById);

export default router;
