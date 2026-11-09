import { Hono } from "hono";
import { clipboardRoutes } from "./clipboard/routes";
import { ClipboardServiceError, clipboardService } from "./clipboard/service";
import type { Env } from "./env";
import { RequestBodyError } from "./middleware/json-body";

export function createApp(options: { now?: () => number } = {}) {
  const app = new Hono<{ Bindings: Env }>();

  app.use("*", async (context, next) => {
    context.header("Cache-Control", "no-store");
    context.header("Referrer-Policy", "no-referrer");
    context.header("X-Content-Type-Options", "nosniff");

    const origin = context.req.header("Origin");
    if (origin && origin !== new URL(context.req.url).origin) {
      return context.json({ error: "Cross-origin requests are not supported." }, 403);
    }

    await next();
  });

  app.route("/api/clipboard", clipboardRoutes(options.now));
  app.notFound((context) => context.json({ error: "Endpoint not found." }, 404));
  app.onError((error, context) => {
    if (error instanceof ClipboardServiceError || error instanceof RequestBodyError) {
      if (error instanceof ClipboardServiceError) {
        if (error.retryAfter) context.header("Retry-After", String(error.retryAfter));
        return context.json(
          {
            error: error.message,
            ...(error.code ? { code: error.code } : {}),
            ...(error.passwordSalt ? { passwordSalt: error.passwordSalt } : {}),
          },
          error.status,
        );
      }
      return context.json({ error: error.message }, error.status);
    }
    return context.json(
      { error: "Sharing is temporarily unavailable. Please try again later." },
      503,
    );
  });

  return app;
}

export const app = createApp();

export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledController, env: Env): Promise<void> {
    await clipboardService(env).cleanup();
  },
} satisfies ExportedHandler<Env>;
