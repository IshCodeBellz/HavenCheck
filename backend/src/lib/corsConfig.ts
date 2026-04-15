import type { CorsOptions } from 'cors';

/**
 * Production: set `CORS_ORIGIN` to a comma-separated list of allowed browser origins
 * (e.g. `https://app.example.com,https://portal.example.com`). Requests without an
 * `Origin` header (mobile apps, curl) are allowed. If unset in production, no browser
 * origin is allowed until you configure `CORS_ORIGIN`.
 */
export function buildCorsOptions(): CorsOptions {
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    return { origin: true };
  }

  const allowed = (process.env.CORS_ORIGIN ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  return {
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }
      if (allowed.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
  };
}
