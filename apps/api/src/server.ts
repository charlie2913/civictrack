import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import bcrypt from "bcryptjs";
import authRoutes from "./routes/auth";
import configRoutes from "./routes/config";
import User from "./models/User";
import SystemConfig from "./models/SystemConfig";
import reportRoutes from "./modules/reports/report.routes";
import { uploadsPath } from "./modules/reports/uploads";
import { requireAuth, requireRole } from "./middleware/auth";
import {
  getAdminMetricsSummary,
  listAdminMapReports,
  listAdminReports,
} from "./modules/reports/report.controller";
import adminUsersRoutes from "./modules/admin/users/adminUsers.routes";

dotenv.config();

const app = express();
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((origin) => origin.trim())
  : ["http://localhost:5173"];

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  }),
);
app.use(helmet());
app.use(morgan("dev"));
app.use(express.json());
app.use(cookieParser());

app.get("/health", (_req, res) => res.json({ ok: true }));
app.use("/uploads", express.static(uploadsPath));
app.use("/api/auth", authRoutes);
app.use("/api", configRoutes);
app.use("/api/reports", reportRoutes);
app.get(
  "/api/admin/reports",
  requireAuth,
  requireRole("ADMIN", "OPERATOR", "SUPERVISOR"),
  listAdminReports,
);
app.get(
  "/api/admin/reports/map",
  requireAuth,
  requireRole("ADMIN", "OPERATOR", "SUPERVISOR"),
  listAdminMapReports,
);
app.get(
  "/api/admin/metrics/summary",
  requireAuth,
  requireRole("ADMIN", "OPERATOR", "SUPERVISOR"),
  getAdminMetricsSummary,
);
app.use("/api/admin/users", adminUsersRoutes);

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/civictrack";
const ADMIN_EMAIL = "admin@civictrack.com";
const ADMIN_PASSWORD = "Admin123*";

async function start() {
  await mongoose.connect(MONGODB_URI);
  console.log("OK Mongo conectado");

  const existingConfig = await SystemConfig.findOne();
  if (!existingConfig) {
    await SystemConfig.create({});
    console.log("OK Config inicial creada");
  }

  const existingAdmin = await User.findOne({ email: ADMIN_EMAIL });
  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
    await User.create({
      email: ADMIN_EMAIL,
      passwordHash,
      role: "ADMIN",
      authMode: "PASSWORD",
    });
    console.log("OK Admin semilla creado");
  }

  app.listen(PORT, () => console.log(`OK API en http://localhost:${PORT}`));
}

start().catch((err) => {
  console.error("ERROR al iniciar:", err);
  process.exit(1);
});
