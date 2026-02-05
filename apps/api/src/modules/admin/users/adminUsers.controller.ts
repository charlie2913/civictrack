import type { Request, Response } from "express";
import mongoose from "mongoose";
import {
  convertGuest,
  createUser,
  getUserById,
  isValidEmail,
  listUsers,
  resetPassword,
  updateUser,
  validatePasswordPolicy,
} from "./adminUsers.service";

const isValidObjectId = (id: string) => mongoose.Types.ObjectId.isValid(id);

export const listAdminUsers = async (req: Request, res: Response) => {
  const { q, role, isActive, authMode, page, limit } = req.query as {
    q?: string;
    role?: string;
    isActive?: string;
    authMode?: string;
    page?: string;
    limit?: string;
  };

  const parsedPage = page ? Number(page) : undefined;
  const parsedLimit = limit ? Number(limit) : undefined;

  const result = await listUsers({
    q,
    role,
    isActive,
    authMode,
    page: parsedPage,
    limit: parsedLimit,
  });

  return res.json(result);
};

export const createAdminUser = async (req: Request, res: Response) => {
  const { email, name, role, password } = req.body as {
    email?: string;
    name?: string;
    role?: string;
    password?: string;
  };

  if (!email || !role) {
    return res.status(400).json({ error: "Email y rol son requeridos" });
  }

  if (!isValidEmail(email)) {
    return res.status(400).json({ error: "Email invalido" });
  }

  if (password && !validatePasswordPolicy(password)) {
    return res.status(400).json({ error: "Password no cumple la politica minima" });
  }

  try {
    const { user, tempPassword } = await createUser({
      email,
      name,
      role,
      password,
    });

    return res.status(201).json({
      id: user._id,
      email: user.email,
      role: user.role,
      tempPassword,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al crear usuario";
    return res.status(400).json({ error: message });
  }
};

export const getAdminUser = async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!isValidObjectId(id)) {
    return res.status(400).json({ error: "Id invalido" });
  }

  const user = await getUserById(id);
  if (!user) {
    return res.status(404).json({ error: "Usuario no encontrado" });
  }

  return res.json({
    id: user._id,
    email: user.email,
    name: user.name,
    role: user.role,
    authMode: user.authMode,
    isActive: user.isActive,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
  });
};

export const patchAdminUser = async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!isValidObjectId(id)) {
    return res.status(400).json({ error: "Id invalido" });
  }

  const { name, role, isActive } = req.body as {
    name?: string;
    role?: string;
    isActive?: boolean;
  };

  try {
    const updated = await updateUser({
      id,
      requesterId: req.user?.id ?? "",
      name,
      role,
      isActive,
    });
    return res.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al actualizar";
    return res.status(400).json({ error: message });
  }
};

export const resetAdminUserPassword = async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!isValidObjectId(id)) {
    return res.status(400).json({ error: "Id invalido" });
  }

  try {
    const result = await resetPassword(id);
    return res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al resetear password";
    return res.status(400).json({ error: message });
  }
};

export const convertGuestUser = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { password } = req.body as { password?: string };

  if (!isValidObjectId(id)) {
    return res.status(400).json({ error: "Id invalido" });
  }
  if (!password) {
    return res.status(400).json({ error: "Password requerido" });
  }
  if (!validatePasswordPolicy(password)) {
    return res.status(400).json({ error: "Password no cumple la politica minima" });
  }

  try {
    const result = await convertGuest(id, password);
    return res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al convertir usuario";
    return res.status(400).json({ error: message });
  }
};
