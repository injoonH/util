import { Hono } from "hono";
import {
  createClipboardSchema,
  deleteClipboardSchema,
  retrieveClipboardSchema,
} from "../../shared/clipboard";
import type { Env } from "../env";
import { readJsonBody } from "../middleware/json-body";
import { rateLimit } from "../middleware/rate-limit";
import { clipboardService } from "./service";

export function clipboardRoutes(now: () => number = Date.now) {
  const routes = new Hono<{ Bindings: Env }>();

  routes.post("/create", rateLimit("create"), async (context) => {
    const input = createClipboardSchema.safeParse(await readJsonBody(context.req.raw));
    if (!input.success) {
      return context.json(
        { error: input.error.issues[0]?.message ?? "Invalid share request." },
        400,
      );
    }
    return context.json(await clipboardService(context.env, now).create(input.data), 201);
  });

  routes.post("/retrieve", rateLimit("read"), async (context) => {
    const input = retrieveClipboardSchema.safeParse(await readJsonBody(context.req.raw));
    if (!input.success) {
      return context.json({ error: "Enter a valid share link token or 6-character code." }, 400);
    }
    return context.json(await clipboardService(context.env, now).retrieve(input.data));
  });

  routes.post("/delete", rateLimit("read"), async (context) => {
    const input = deleteClipboardSchema.safeParse(await readJsonBody(context.req.raw));
    if (!input.success) {
      return context.json({ error: "Invalid deletion request." }, 400);
    }
    await clipboardService(context.env, now).delete(input.data);
    return context.body(null, 204);
  });

  return routes;
}
