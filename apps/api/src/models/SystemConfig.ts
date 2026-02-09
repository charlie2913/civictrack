import { Schema, model, type InferSchemaType } from "mongoose";

export const defaultReportCategories = ["BACHE", "LUMINARIA", "VEREDA", "DRENAJE"] as const;
export const defaultDistricts = [
  "CENTRO",
  "COTAHUMA",
  "MAX PAREDES",
  "PERIFERICA",
  "SAN ANTONIO",
  "SUR",
  "MALLASA",
  "ZONGO",
  "HAMPATURI",
] as const;
export const defaultNotificationEvents = [
  "STATUS_SCHEDULED",
  "STATUS_RESOLVED",
  "STATUS_CLOSED",
  "STATUS_REOPENED",
] as const;

const systemConfigSchema = new Schema(
  {
    reportCategories: {
      type: [String],
      default: [...defaultReportCategories],
    },
    districts: {
      type: [String],
      default: [...defaultDistricts],
    },
    photoMaxFiles: { type: Number, default: 5 },
    photoMaxMb: { type: Number, default: 5 },
    mapMaxPoints: { type: Number, default: 2000 },
    notificationEvents: {
      type: [String],
      default: [...defaultNotificationEvents],
    },
  },
  { timestamps: true },
);

export type SystemConfigDocument = InferSchemaType<typeof systemConfigSchema> & { _id: string };

const SystemConfig = model("SystemConfig", systemConfigSchema);

export default SystemConfig;
