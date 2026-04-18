export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options?: { retries?: number; baseDelayMs?: number }
): Promise<T> {
  const retries = options?.retries ?? 3;
  const baseDelayMs = options?.baseDelayMs ?? 1000;

  let attempt = 0;
  let lastError: unknown;
  while (attempt <= retries) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt === retries) break;
      const waitMs = baseDelayMs * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
    attempt += 1;
  }
  throw lastError;
}
