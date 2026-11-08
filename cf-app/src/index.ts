// BIAI Corporate Intelligence — Cloudflare Worker entry.
// Hono app: serves /api/* routes + falls through to static assets (frontend).
// Auth middleware protects /api/* except /api/auth/login and /api/health.

import { Hono } from "hono";
import { cors } from "hono/cors";
import { leadsRoute } from "./routes/leads";
import { aiRoute } from "./routes/ai";
import { authRoute } from "./routes/auth";
import { importRoute } from "./routes/import";
import { cleanRoute } from "./routes/clean";
import { readSessionCookie, verifyJwt } from "./lib/auth";
import type { Env } from "./lib/ai";

export interface AppEnv {
  Bindings: Env;
  Variables: {
    user?: { sub: string; name: string; role: string };
  };
}

const app = new Hono<AppEnv>();

// CORS for the frontend (same origin in production, but allow dev split)
app.use("/api/*", cors({ origin: ["*"], credentials: true, allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"], allowHeaders: ["Content-Type", "Authorization"] }));

// health check (no auth)
app.get("/api/health", (c) => c.json({ status: "ok", app: "BIAI Corporate Intelligence", time: new Date().toISOString() }));

// auth routes (login doesn't require a session)
app.route("/api/auth", authRoute);

// auth middleware for everything else under /api
app.use("/api/*", async (c, next) => {
  // skip auth + health (already handled above)
  if (c.req.path.startsWith("/api/auth") || c.req.path === "/api/health") return next();
  const token = readSessionCookie(c.req.header("cookie"));
  if (!token) return c.json({ error: "Not authenticated. Please log in." }, 401);
  const payload = await verifyJwt(c.env, token);
  if (!payload) return c.json({ error: "Session expired. Please log in again." }, 401);
  c.set("user", { sub: payload.sub, name: payload.name, role: payload.role });
  await next();
});

app.route("/api/leads", leadsRoute);
app.route("/api/clean", cleanRoute);
app.route("/api/ai", aiRoute);
app.route("/api/import", importRoute);

// fall-through: serve the Vite-built frontend (SPA) for any non-API route.
// env.ASSETS is the static-assets binding configured in wrangler.toml.
app.all("*", (c) => {
  if (c.env.ASSETS) {
    return c.env.ASSETS.fetch(c.req.raw);
  }
  return c.json({ error: "Not found" }, 404);
});

export default app;
