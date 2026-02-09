import nodemailer from "nodemailer";

type MailPayload = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

let cachedTransport: nodemailer.Transporter | null = null;

const getEnv = (key: string) => (process.env[key] ?? "").trim();

const isMailConfigured = () => {
  return Boolean(getEnv("SMTP_HOST") && getEnv("SMTP_PORT") && getEnv("SMTP_USER"));
};

const getTransport = () => {
  if (cachedTransport) return cachedTransport;
  const host = getEnv("SMTP_HOST");
  const port = Number(getEnv("SMTP_PORT"));
  const user = getEnv("SMTP_USER");
  const pass = getEnv("SMTP_PASS");
  const secure = getEnv("SMTP_SECURE") === "true";

  cachedTransport = nodemailer.createTransport({
    host,
    port: Number.isFinite(port) ? port : 587,
    secure,
    auth: user ? { user, pass } : undefined,
  });

  return cachedTransport;
};

export const sendMail = async (payload: MailPayload) => {
  if (!isMailConfigured()) {
    console.warn("[Mailer] SMTP no configurado. Correo omitido.");
    return false;
  }
  const from = getEnv("MAIL_FROM") || "no-reply@civictrack.local";
  const transport = getTransport();
  await transport.sendMail({
    from,
    to: payload.to,
    subject: payload.subject,
    text: payload.text,
    html: payload.html,
  });
  return true;
};

export const isMailerReady = () => isMailConfigured();
