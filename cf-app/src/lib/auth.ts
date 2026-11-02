// BIAI Corporate Intelligence — Auth (Worker).
// Credential-only login (no signup). JWT signed with HMAC-SHA256 via Web Crypto.
// httpOnly cookie so the token is never readable by client JS.
// Flexible for growth: the users table supports multiple users + roles; a signup
// flow can be added later without changing this layer.

import type { Env } from "./ai";

const COOKIE_NAME = "biai_session";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

// ---------- SHA-256 helper ----------
async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ---------- HMAC-SHA256 JWT ----------
function base64url(input: string | Uint8Array): string {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlDecode(input: string): string {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(padded);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

async function hmacSign(data: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return base64url(new Uint8Array(sig));
}

export interface JwtPayload {
  sub: string; // username
  name: string;
  role: string;
  iat: number;
  exp: number;
}

export async function issueJwt(env: Env, payload: Omit<JwtPayload, "iat" | "exp">): Promise<string> {
  const secret = env.JWT_SECRET ?? "dev-insecure-secret-change-me";
  const now = Math.floor(Date.now() / 1000);
  const full: JwtPayload = { ...payload, iat: now, exp: now + COOKIE_MAX_AGE };
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64url(JSON.stringify(full));
  const sig = await hmacSign(`${header}.${body}`, secret);
  return `${header}.${body}.${sig}`;
}

export async function verifyJwt(env: Env, token: string): Promise<JwtPayload | null> {
  const secret = env.JWT_SECRET ?? "dev-insecure-secret-change-me";
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, body, sig] = parts;
  const expectedSig = await hmacSign(`${header}.${body}`, secret);
  if (sig !== expectedSig) return null;
  try {
    const payload = JSON.parse(base64urlDecode(body)) as JwtPayload;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

// ---------- cookie helpers ----------

export function setSessionCookie(token: string): string {
  return `${COOKIE_NAME}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${COOKIE_MAX_AGE}`;
}

export function clearSessionCookie(): string {
  return `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}

export function readSessionCookie(cookieHeader: string | null | undefined): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === COOKIE_NAME) return v.join("=");
  }
  return null;
}

// ---------- password verification ----------

export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  // stored format: "sha256:<hex>"
  if (stored.startsWith("sha256:")) {
    const hash = await sha256(plain);
    return hash === stored.slice("sha256:".length);
  }
  return false;
}

export { sha256, COOKIE_NAME };
