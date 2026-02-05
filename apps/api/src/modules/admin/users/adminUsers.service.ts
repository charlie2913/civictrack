import bcrypt from "bcryptjs";
import crypto from "crypto";
import User, { authModes, roles, type UserRole } from "../../../models/User";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const isValidEmail = (email: string) => emailRegex.test(email);

export const isValidRole = (role: string): role is UserRole =>
  (roles as readonly string[]).includes(role);

export const isValidAuthMode = (mode: string) =>
  (authModes as readonly string[]).includes(mode);

export const validatePasswordPolicy = (password: string) => {
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);
  return password.length >= 8 && hasUpper && hasLower && hasNumber;
};

const pick = (chars: string) => chars[crypto.randomInt(0, chars.length)];

export const generateTempPassword = () => {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const numbers = "23456789";
  const symbols = "!@#$%";
  const required = [pick(upper), pick(lower), pick(numbers), pick(symbols)];
  const all = `${upper}${lower}${numbers}${symbols}`;
  const remaining = Array.from({ length: 8 }, () => pick(all));
  const password = [...required, ...remaining]
    .sort(() => crypto.randomInt(0, 2) - 0.5)
    .join("");
  return password;
};

const countActiveAdmins = async (excludeId?: string) => {
  const filter: Record<string, any> = { role: "ADMIN", isActive: true };
  if (excludeId) filter._id = { $ne: excludeId };
  return User.countDocuments(filter);
};

export const listUsers = async (params: {
  q?: string;
  role?: string;
  isActive?: string;
  authMode?: string;
  page?: number;
  limit?: number;
}) => {
  const page = Math.max(params.page ?? 1, 1);
  const limit = Math.min(Math.max(params.limit ?? 20, 1), 100);

  const filter: Record<string, any> = {};
  if (params.q?.trim()) {
    const q = params.q.trim();
    filter.$or = [{ email: { $regex: q, $options: "i" } }, { name: { $regex: q, $options: "i" } }];
  }
  if (params.role && isValidRole(params.role)) {
    filter.role = params.role;
  }
  if (params.authMode && isValidAuthMode(params.authMode)) {
    filter.authMode = params.authMode;
  }
  if (params.isActive === "true" || params.isActive === "false") {
    filter.isActive = params.isActive === "true";
  }

  const [items, total] = await Promise.all([
    User.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select("email name role authMode isActive createdAt lastLoginAt")
      .lean(),
    User.countDocuments(filter),
  ]);

  return {
    items: items.map((user) => ({
      id: user._id,
      email: user.email,
      name: user.name,
      role: user.role,
      authMode: user.authMode,
      isActive: user.isActive,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
    })),
    meta: { page, limit, total },
  };
};

export const createUser = async (params: {
  email: string;
  name?: string;
  role: string;
  password?: string;
}) => {
  const email = params.email.trim().toLowerCase();
  if (!isValidEmail(email)) {
    throw new Error("Email invalido");
  }
  if (!isValidRole(params.role)) {
    throw new Error("Rol invalido");
  }

  const exists = await User.findOne({ email });
  if (exists) {
    throw new Error("Email ya registrado");
  }

  const password = params.password?.trim() || generateTempPassword();
  if (!validatePasswordPolicy(password)) {
    throw new Error("Password no cumple la politica minima");
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const created = await User.create({
    email,
    name: params.name?.trim() || undefined,
    role: params.role,
    authMode: "PASSWORD",
    passwordHash,
    isActive: true,
  });

  return {
    user: created,
    tempPassword: params.password ? undefined : password,
  };
};

export const getUserById = async (id: string) => {
  const user = await User.findById(id)
    .select("email name role authMode isActive createdAt lastLoginAt")
    .lean();
  return user;
};

export const updateUser = async (params: {
  id: string;
  requesterId: string;
  name?: string;
  role?: string;
  isActive?: boolean;
}) => {
  const user = await User.findById(params.id);
  if (!user) {
    throw new Error("Usuario no encontrado");
  }

  const nextRole = params.role ?? user.role;
  const nextActive = params.isActive ?? user.isActive;

  if (params.role && !isValidRole(params.role)) {
    throw new Error("Rol invalido");
  }

  if (params.requesterId === user._id.toString() && params.isActive === false) {
    throw new Error("No puedes desactivar tu propia cuenta");
  }

  const isRemovingAdmin =
    user.role === "ADMIN" && (nextRole !== "ADMIN" || nextActive === false);
  if (isRemovingAdmin) {
    const remaining = await countActiveAdmins(user._id.toString());
    if (remaining === 0) {
      throw new Error("No se puede desactivar el ultimo ADMIN");
    }
  }

  if (params.name !== undefined) {
    user.name = params.name?.trim() || undefined;
  }
  if (params.role !== undefined) {
    user.role = params.role as UserRole;
  }
  if (params.isActive !== undefined) {
    user.isActive = params.isActive;
  }

  await user.save();

  return {
    id: user._id,
    email: user.email,
    name: user.name,
    role: user.role,
    authMode: user.authMode,
    isActive: user.isActive,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
  };
};

export const resetPassword = async (id: string) => {
  const user = await User.findById(id);
  if (!user) {
    throw new Error("Usuario no encontrado");
  }

  const tempPassword = generateTempPassword();
  const passwordHash = await bcrypt.hash(tempPassword, 10);
  user.passwordHash = passwordHash;
  user.authMode = "PASSWORD";
  await user.save();

  return { id: user._id, tempPassword };
};

export const convertGuest = async (id: string, password: string) => {
  const user = await User.findById(id);
  if (!user) {
    throw new Error("Usuario no encontrado");
  }

  if (user.authMode !== "GUEST" && user.passwordHash) {
    throw new Error("El usuario ya tiene credenciales");
  }

  if (!validatePasswordPolicy(password)) {
    throw new Error("Password no cumple la politica minima");
  }

  const passwordHash = await bcrypt.hash(password, 10);
  user.passwordHash = passwordHash;
  user.authMode = "PASSWORD";
  await user.save();

  return { ok: true };
};
