import type { MiddlewareHandler } from "hono";
import type { Env } from "../env";

export function rateLimit(kind: "create" | "read"): MiddlewareHandler<{ Bindings: Env }> {
  return async (context, next) => {
    const limiter =
      kind === "create" ? context.env.CLIPBOARD_CREATE_LIMITER : context.env.CLIPBOARD_READ_LIMITER;

    // A missing binding is a deployment error, never permission to disable limits.
    if (!limiter) {
      return context.json(
        { error: "Sharing is temporarily unavailable. Please try again later." },
        503,
      );
    }

    const ip = context.req.header("CF-Connecting-IP") ?? "local-development";
    const { success } = await limiter.limit({ key: `${kind}:${ip}` });
    if (!success) {
      context.header("Retry-After", "60");
      return context.json({ error: "Too many requests. Please wait a minute and try again." }, 429);
    }

    await next();
  };
}
