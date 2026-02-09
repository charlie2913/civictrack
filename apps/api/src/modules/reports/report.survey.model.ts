import { Schema, model, type InferSchemaType } from "mongoose";

const reportSurveySchema = new Schema(
  {
    reportId: { type: Schema.Types.ObjectId, ref: "Report", required: true, unique: true },
    token: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true },
    rating: { type: Number, min: 1, max: 5 },
    comment: { type: String, maxlength: 500 },
    submittedAt: { type: Date },
  },
  { timestamps: true },
);

export type ReportSurveyDocument = InferSchemaType<typeof reportSurveySchema> & {
  _id: string;
};

const ReportSurvey = model("ReportSurvey", reportSurveySchema);

export default ReportSurvey;
