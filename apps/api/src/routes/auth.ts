import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User";
import { requireAuth } from "../middleware/auth";

const router = Router();

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET no esta configurado");
  }
  return secret;
};

router.post("/login", async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    return res.status(400).json({ error: "Email y password son requeridos" });
  }

  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    return res.status(401).json({ error: "Credenciales invalidas" });
  }

  if (user.authMode === "GUEST" || !user.passwordHash) {
    return res.status(403).json({
      error:
        "Esta cuenta fue creada solo con correo. Debe completar registro para iniciar sesión.",
    });
  }

  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) {
    return res.status(401).json({ error: "Credenciales invalidas" });
  }

  const token = jwt.sign(
    { sub: user._id.toString(), role: user.role, email: user.email },
    getJwtSecret(),
    { expiresIn: "7d" },
  );

  res.cookie("access_token", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  return res.json({ user: { id: user._id, email: user.email, role: user.role } });
});

router.post("/logout", (_req, res) => {
  res.clearCookie("access_token");
  return res.json({ ok: true });
});

router.get("/me", requireAuth, (req, res) => {
  return res.json({ user: req.user });
});

export default router;
