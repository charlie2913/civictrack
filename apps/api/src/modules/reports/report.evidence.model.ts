import { Schema, model, type InferSchemaType } from "mongoose";

export const evidenceTypes = ["BEFORE", "AFTER", "INTERVENTION"] as const;
export type EvidenceType = (typeof evidenceTypes)[number];

const reportEvidenceSchema = new Schema(
  {
    reportId: { type: Schema.Types.ObjectId, ref: "Report", required: true, index: true },
    type: { type: String, enum: evidenceTypes, required: true },
    url: { type: String, required: true },
    note: { type: String },
    uploadedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

export type ReportEvidenceDocument = InferSchemaType<typeof reportEvidenceSchema> & {
  _id: string;
};

const ReportEvidence = model("ReportEvidence", reportEvidenceSchema);

export default ReportEvidence;
