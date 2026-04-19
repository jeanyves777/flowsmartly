import nodemailer from "nodemailer";

export const EMAIL_CONFIG = {
  host: process.env.SMTP_HOST || "smtp.hostinger.com",
  port: parseInt(process.env.SMTP_PORT || "465"),
  secure: true,
  auth: {
    user: process.env.SMTP_USER || "info@flowsmartly.com",
    pass: process.env.SMTP_PASSWORD,
  },
};

export const FROM_EMAIL = process.env.SMTP_FROM || "FlowSmartly <info@flowsmartly.com>";
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
export const APP_NAME = "FlowSmartly";

let transporter: nodemailer.Transporter | null = null;

export function getTransporter() {
  if (!transporter) {
    if (!EMAIL_CONFIG.auth.pass) {
      console.warn("SMTP_PASSWORD not set - email sending disabled");
      return null;
    }
    transporter = nodemailer.createTransport(EMAIL_CONFIG);
  }
  return transporter;
}
