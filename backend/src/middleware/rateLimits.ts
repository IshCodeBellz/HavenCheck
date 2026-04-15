import { rateLimit } from 'express-rate-limit';

const rateLimitJson = {
  error: 'RATE_LIMITED',
  message: 'Too many requests. Try again later.',
} as const;

const base = {
  standardHeaders: true,
  legacyHeaders: false,
  message: rateLimitJson,
} as const;

/** Login attempts per IP (brute-force mitigation). */
export const authLoginLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60 * 1000,
  limit: 20,
});

/** New organization creation. */
export const authOrganizationCreateLimiter = rateLimit({
  ...base,
  windowMs: 60 * 60 * 1000,
  limit: 15,
});

/** Registration / join flow. */
export const authRegisterLimiter = rateLimit({
  ...base,
  windowMs: 60 * 60 * 1000,
  limit: 15,
});

/** Verify token and resend verification (abuse / token guessing). */
export const authEmailFlowLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60 * 1000,
  limit: 40,
});

/** Authenticated password change. */
export const authChangePasswordLimiter = rateLimit({
  ...base,
  windowMs: 60 * 60 * 1000,
  limit: 20,
});
