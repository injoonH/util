export interface RateLimiter {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

export interface Env {
  DB: D1Database;
  CLIPBOARD_CREATE_LIMITER: RateLimiter;
  CLIPBOARD_READ_LIMITER: RateLimiter;
}
