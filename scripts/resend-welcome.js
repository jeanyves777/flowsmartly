require("dotenv").config();
const nodemailer = require("nodemailer");
const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://flowsmartly.com";

(async () => {
  try {
    const token = await p.emailVerification.findFirst({
      where: { email: "qodesh225@gmail.com", usedAt: null },
      orderBy: { createdAt: "desc" },
    });
    const verificationUrl = token
      ? `${APP_URL}/verify-email?token=${token.token}`
      : null;

    console.log("Verification URL:", verificationUrl ? "yes" : "no");

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.hostinger.com",
      port: parseInt(process.env.SMTP_PORT || "465"),
      secure: true,
      auth: {
        user: process.env.SMTP_USER || "info@flowsmartly.com",
        pass: process.env.SMTP_PASSWORD,
      },
    });

    const html = `
<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;background:#f4f4f5;">
<div style="max-width:600px;margin:0 auto;background:#fff;">
  <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:40px 30px;text-align:center;">
    <h1 style="color:#fff;margin:0;font-size:28px;">Welcome to FlowSmartly!</h1>
    <p style="color:rgba(255,255,255,0.9);margin:10px 0 0;">Your AI-powered marketing platform</p>
  </div>
  <div style="padding:30px;">
    <p style="font-size:16px;color:#18181b;">Hi Laikos Albany,</p>
    <p style="color:#52525b;">Welcome aboard! We're thrilled to have you join FlowSmartly. Here's what you can do:</p>
    <ul style="color:#52525b;line-height:1.8;">
      <li><strong>AI Content Creation</strong> - Generate posts, images, and videos</li>
      <li><strong>Smart Scheduling</strong> - Plan and automate your content</li>
      <li><strong>Email & SMS Campaigns</strong> - Reach your audience directly</li>
      <li><strong>Analytics Dashboard</strong> - Track your performance</li>
    </ul>
    ${verificationUrl ? `
    <div style="text-align:center;margin:30px 0;">
      <a href="${verificationUrl}" style="display:inline-block;background:#6366f1;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:16px;">Verify Your Email</a>
    </div>
    <p style="color:#71717a;font-size:13px;text-align:center;">Or copy this link: ${verificationUrl}</p>
    ` : ""}
    <p style="color:#52525b;">Ready to get started? <a href="${APP_URL}/dashboard" style="color:#6366f1;">Go to your dashboard</a></p>
    <p style="color:#52525b;">If you have any questions, we're here to help!</p>
    <p style="color:#52525b;">— The FlowSmartly Team</p>
  </div>
  <div style="background:#f9fafb;padding:20px 30px;text-align:center;border-top:1px solid #e5e7eb;">
    <p style="color:#a1a1aa;font-size:12px;margin:0;">&copy; 2026 FlowSmartly. All rights reserved.</p>
  </div>
</div>
</body></html>`;

    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || "FlowSmartly <info@flowsmartly.com>",
      to: "qodesh225@gmail.com",
      subject: "Welcome to FlowSmartly! 🚀",
      html,
    });

    console.log("Email sent! MessageId:", info.messageId);
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await p.$disconnect();
  }
})();
