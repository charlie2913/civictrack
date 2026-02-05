import { Router } from "express";
import { requireAuth, requireRole } from "../../../middleware/auth";
import {
  convertGuestUser,
  createAdminUser,
  getAdminUser,
  listAdminUsers,
  patchAdminUser,
  resetAdminUserPassword,
} from "./adminUsers.controller";

const router = Router();

router.use(requireAuth, requireRole("ADMIN"));

router.get("/", listAdminUsers);
router.post("/", createAdminUser);
router.get("/:id", getAdminUser);
router.patch("/:id", patchAdminUser);
router.post("/:id/reset-password", resetAdminUserPassword);
router.post("/:id/convert-guest", convertGuestUser);

export default router;
