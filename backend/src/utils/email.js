const nodemailer = require('nodemailer');
const logger = require('./logger');

// Configure via env vars. Works with Gmail (use an App Password, not your
// normal password), SendGrid SMTP, Mailgun SMTP, AWS SES SMTP, or any
// standard SMTP provider.
//
// Required env vars:
//   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS
// Optional:
//   SMTP_FROM (defaults to SMTP_USER)
//   SMTP_SECURE ("true" for port 465, otherwise leave unset)

let transporter = null;

const getTransporter = () => {
  if (transporter) return transporter;

  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    logger.warn('SMTP not configured — OTP emails will be logged to console instead of sent.');
    return null;
  }

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  return transporter;
};

exports.sendOtpEmail = async (toEmail, code) => {
  const t = getTransporter();

  const subject = 'Your Nexus verification code';
  const html = `
    <div style="font-family: -apple-system, Arial, sans-serif; max-width: 420px; margin: 0 auto;">
      <h2 style="color:#111;">Your verification code</h2>
      <p style="color:#444; font-size: 14px;">Enter this code to sign in to Nexus. It expires in 10 minutes.</p>
      <div style="font-size: 32px; font-weight: 700; letter-spacing: 8px; background:#f4f4f5; padding: 16px 24px; border-radius: 12px; text-align:center; margin: 20px 0;">
        ${code}
      </div>
      <p style="color:#999; font-size: 12px;">If you didn't request this, you can safely ignore this email.</p>
    </div>
  `;

  if (!t) {
    // No SMTP configured (e.g. local dev without env vars set). Log it so
    // development/testing can still proceed without an email provider.
    logger.info(`[DEV OTP] Code for ${toEmail}: ${code}`);
    return { delivered: false, devMode: true };
  }

  await t.sendMail({
    from: process.env.EMAIL_FROM || process.env.SMTP_FROM || process.env.SMTP_USER,
    to: toEmail,
    subject,
    html,
  });

  return { delivered: true };
};
