import { Schema, model, type InferSchemaType } from "mongoose";

export const reportCategories = ["BACHE", "LUMINARIA", "VEREDA", "DRENAJE"] as const;
export type ReportCategory = (typeof reportCategories)[number];

const statusHistorySchema = new Schema(
  {
    status: { type: String, required: true },
    at: { type: Date, required: true },
    by: { type: Schema.Types.ObjectId, ref: "User", required: false },
    note: { type: String, required: false },
  },
  { _id: false },
);

const reportSchema = new Schema(
  {
    category: { type: String, enum: reportCategories, required: true },
    description: { type: String, required: true, minlength: 10 },
    location: {
      type: {
        type: String,
        enum: ["Point"],
        required: true,
        default: "Point",
      },
      coordinates: {
        type: [Number],
        required: true,
        validate: {
          validator: (coords: number[]) => coords.length === 2,
          message: "Coordinates must have [lng, lat]",
        },
      },
    },
    addressText: { type: String },
    district: { type: String },
    photoUrls: { type: [String], default: [] },
    status: { type: String, default: "RECEIVED" },
    statusHistory: { type: [statusHistorySchema], default: [] },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    assignedTo: { type: Schema.Types.ObjectId, ref: "User" },
    assignedAt: { type: Date },
    assignedBy: { type: Schema.Types.ObjectId, ref: "User" },
    scheduledAt: { type: Date },
    slaTargetAt: { type: Date },
    slaBreachedAt: { type: Date },
    impact: { type: Number, min: 1, max: 5 },
    urgency: { type: Number, min: 1, max: 5 },
    priority: { type: String, enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"] },
    priorityOverride: { type: String, enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"] },
    priorityUpdatedAt: { type: Date },
    priorityUpdatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

reportSchema.index({ location: "2dsphere" });

export type ReportDocument = InferSchemaType<typeof reportSchema> & { _id: string };

const Report = model("Report", reportSchema);

export default Report;
