import { Schema, model, type InferSchemaType } from "mongoose";

export const roles = ["CITIZEN", "ADMIN", "OPERATOR", "SUPERVISOR"] as const;
export type UserRole = (typeof roles)[number];
export const authModes = ["PASSWORD", "GUEST"] as const;
export type AuthMode = (typeof authModes)[number];

const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String },
    passwordHash: { type: String },
    role: { type: String, enum: roles, required: true, default: "CITIZEN" },
    authMode: { type: String, enum: authModes, required: true, default: "PASSWORD" },
    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date },
  },
  { timestamps: true },
);

export type UserDocument = InferSchemaType<typeof userSchema> & { _id: string };

const User = model("User", userSchema);

export default User;
