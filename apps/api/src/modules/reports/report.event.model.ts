import { Schema, model, type InferSchemaType } from "mongoose";

const reportEventSchema = new Schema(
  {
    reportId: { type: Schema.Types.ObjectId, ref: "Report", required: true, index: true },
    type: { type: String, required: true },
    note: { type: String },
    data: { type: Schema.Types.Mixed },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

export type ReportEventDocument = InferSchemaType<typeof reportEventSchema> & { _id: string };

const ReportEvent = model("ReportEvent", reportEventSchema);

export default ReportEvent;
