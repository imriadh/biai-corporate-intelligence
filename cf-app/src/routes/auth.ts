// /api/auth — login, logout, me

import { Hono } from "hono";
import { setSessionCookie, clearSessionCookie, verifyPassword, issueJwt } from "../lib/auth";
import type { AppEnv } from "../index";

export const authRoute = new Hono<AppEnv>();

authRoute.post("/login", async (c) => {
  let body: { username?: string; password?: string };
  try { body = await c.req.json(); } catch { return c.json({ error: "Invalid JSON body." }, 400); }
  const username = (body.username ?? "").trim().toLowerCase();
  const password = body.password ?? "";
  if (!username || !password) return c.json({ error: "Username and password are required." }, 400);

  const row = await c.env.DB.prepare("SELECT username, password_hash, name, role FROM users WHERE username = ?")
    .bind(username).first<{ username: string; password_hash: string; name: string; role: string }>();
  if (!row) return c.json({ error: "Invalid username or password." }, 401);

  const ok = await verifyPassword(password, row.password_hash);
  if (!ok) return c.json({ error: "Invalid username or password." }, 401);

  const token = await issueJwt(c.env, { sub: row.username, name: row.name, role: row.role });
  c.header("Set-Cookie", setSessionCookie(token));
  return c.json({ user: { username: row.username, name: row.name, role: row.role } });
});

authRoute.post("/logout", (c) => {
  c.header("Set-Cookie", clearSessionCookie());
  return c.json({ ok: true });
});

authRoute.get("/me", async (c) => {
  // public — returns 401 if not logged in (frontend uses this to check session)
  return c.json({ user: c.get("user") ?? null });
});
