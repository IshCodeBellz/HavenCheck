import crypto from 'crypto';
import { prisma } from './prisma';

const TOKEN_BYTES = 32;
const TOKEN_TTL_MS = 1000 * 60 * 60 * 48;

export function hashVerificationToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

function generateRawToken(): string {
  return crypto.randomBytes(TOKEN_BYTES).toString('base64url');
}

function webAppBaseUrl(): string {
  return (process.env.WEB_APP_URL || 'http://localhost:3000').replace(/\/$/, '');
}

function buildVerifyUrl(rawToken: string): string {
  return `${webAppBaseUrl()}/verify-email?token=${encodeURIComponent(rawToken)}`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function sendTransactionalEmail(params: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || 'Haven Check <onboarding@resend.dev>';

  if (!apiKey) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('RESEND_API_KEY is required in production to send verification emails');
    }
    const linkMatch = params.html.match(/href="([^"]+)"/);
    console.warn(`[email] RESEND_API_KEY missing — would send verification to ${params.to}`);
    if (linkMatch?.[1]) console.warn(`[email] Link: ${linkMatch[1]}`);
    return;
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [params.to],
      subject: params.subject,
      html: params.html,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Email send failed: ${res.status} ${text}`);
  }
}

/** Creates a fresh token, stores its hash, and emails the user a link to the web app verify page. */
export async function sendEmailVerificationForUser(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true, emailVerifiedAt: true },
  });
  if (!user || user.emailVerifiedAt) return;

  const rawToken = generateRawToken();
  const tokenHash = hashVerificationToken(rawToken);
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

  await prisma.$transaction([
    prisma.emailVerificationToken.deleteMany({ where: { userId } }),
    prisma.emailVerificationToken.create({
      data: { userId, tokenHash, expiresAt },
    }),
  ]);

  const verifyUrl = buildVerifyUrl(rawToken);

  await sendTransactionalEmail({
    to: user.email,
    subject: 'Verify your Haven Check email',
    html: `<p>Hi ${escapeHtml(user.name)},</p><p>Please verify your email before you sign in:</p><p><a href="${verifyUrl}">Verify email</a></p><p>This link expires in 48 hours.</p>`,
  });
}

export async function verifyEmailWithToken(rawToken: string): Promise<{ ok: true } | { ok: false; reason: 'invalid' | 'expired' }> {
  const tokenHash = hashVerificationToken(rawToken);
  const record = await prisma.emailVerificationToken.findUnique({
    where: { tokenHash },
    include: { user: { select: { id: true, emailVerifiedAt: true } } },
  });

  if (!record) {
    return { ok: false, reason: 'invalid' };
  }

  if (record.expiresAt.getTime() < Date.now()) {
    await prisma.emailVerificationToken.delete({ where: { id: record.id } });
    return { ok: false, reason: 'expired' };
  }

  if (record.user.emailVerifiedAt) {
    await prisma.emailVerificationToken.deleteMany({ where: { userId: record.userId } });
    return { ok: true };
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { emailVerifiedAt: new Date() },
    }),
    prisma.emailVerificationToken.deleteMany({ where: { userId: record.userId } }),
  ]);

  return { ok: true };
}
