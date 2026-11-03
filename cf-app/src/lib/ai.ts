// BIAI Corporate Intelligence — AI provider for Cloudflare Workers.
//
// Priority:
//   1. Cloudflare Workers AI (env.AI binding) — free, native, no external key.
//   2. Z.ai HTTP API (ZAI_API_KEY) — OpenAI-compatible at api.z.ai/api/paas/v4.
//   3. Groq / OpenRouter / NVIDIA — OpenAI-compatible HTTP fallbacks.
//
// The model never invents records or totals: email generation returns strict JSON,
// and NL queries return a structured query spec executed locally.

import type { ChatMessage, ChatOptions, ChatResult } from "./types-ai";

export interface Env {
  DB: D1Database; // Cloudflare D1 binding
  AI: Ai; // Cloudflare Workers AI binding
  ASSETS: Fetcher; // static assets binding
  AI_PRIMARY_PROVIDER?: string; // "workersai" | "zai" | "groq" | "openrouter"
  AI_MODEL?: string; // override Workers AI model
  JWT_SECRET?: string;
  REFERENCE_DATE?: string; // override the overdue reference date (defaults to today)
  ZAI_API_KEY?: string;
  ZAI_BASE_URL?: string;
  ZAI_MODEL?: string;
  GROQ_API_KEY?: string;
  GROQ_BASE_URL?: string;
  GROQ_MODEL?: string;
  OPENROUTER_API_KEY?: string;
  OPENROUTER_BASE_URL?: string;
  OPENROUTER_MODEL?: string;
  [key: string]: string | D1Database | Ai | Fetcher | undefined;
}

const DEFAULT_WORKERS_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

const HTTP_PROVIDERS = {
  zai: { prefix: "ZAI", label: "Z.ai", defaultBaseUrl: "https://api.z.ai/api/paas/v4", defaultModel: "glm-4.6" },
  groq: { prefix: "GROQ", label: "Groq", defaultBaseUrl: "https://api.groq.com/openai/v1", defaultModel: "llama-3.3-70b-versatile" },
  openrouter: { prefix: "OPENROUTER", label: "OpenRouter", defaultBaseUrl: "https://openrouter.ai/api/v1", defaultModel: "anthropic/claude-3.5-sonnet" },
} as const;

type HttpProviderName = keyof typeof HTTP_PROVIDERS;

interface HttpProviderConfig {
  name: HttpProviderName;
  apiKey: string;
  baseUrl: string;
  model: string;
  label: string;
}

function getHttpProviderConfig(env: Env, name: HttpProviderName): HttpProviderConfig | null {
  const meta = HTTP_PROVIDERS[name];
  const apiKey = (env[`${meta.prefix}_API_KEY`] as string) ?? "";
  const baseUrl = (env[`${meta.prefix}_BASE_URL`] as string) ?? meta.defaultBaseUrl;
  const model = (env[`${meta.prefix}_MODEL`] as string) ?? meta.defaultModel;
  if (!apiKey) return null;
  return { name, apiKey, baseUrl, model, label: meta.label };
}

function pickOrder(env: Env): string[] {
  const primary = (env.AI_PRIMARY_PROVIDER ?? "workersai").trim().toLowerCase();
  const all = ["workersai", "zai", "groq", "openrouter"];
  if (all.includes(primary)) return [primary, ...all.filter((p) => p !== primary)];
  return all;
}

// ---------- Cloudflare Workers AI ----------

async function chatWithWorkersAI(env: Env, messages: ChatMessage[], opts: ChatOptions): Promise<ChatResult> {
  const model = opts.model ?? env.AI_MODEL ?? DEFAULT_WORKERS_MODEL;
  const t0 = Date.now();
  // Workers AI text-generation schema. We deliberately do NOT pass response_format
  // here — the schema for some instruct variants rejects it. The system prompt
  // instructs strict JSON output, and extractJSON() parses prose-wrapped JSON.
  const input: {
    messages: { role: string; content: string }[];
    max_tokens?: number;
    temperature?: number;
  } = {
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
    temperature: opts.temperature ?? 0.4,
  };
  if (opts.maxTokens) input.max_tokens = opts.maxTokens;

  const result = await env.AI.run(model as never, input as never) as unknown;
  // Workers AI text-generation returns { response: string } for most models,
  // but some variants return objects/arrays. Handle all shapes robustly.
  let content = "";
  if (typeof result === "string") {
    content = result;
  } else if (result && typeof result === "object") {
    const r = result as { response?: unknown; result?: { response?: unknown } };
    const raw = r.response ?? r.result?.response;
    if (typeof raw === "string") content = raw;
    else if (raw && typeof raw === "object") content = JSON.stringify(raw);
    else content = JSON.stringify(result);
  }
  content = content.trim();
  if (!content) throw new Error("Workers AI returned an empty response.");
  return { provider: "workersai", model, content, ms: Date.now() - t0 };
}

// ---------- OpenAI-compatible HTTP (Z.ai / Groq / OpenRouter) ----------

async function chatWithHttp(env: Env, cfg: HttpProviderConfig, messages: ChatMessage[], opts: ChatOptions): Promise<ChatResult> {
  const body: Record<string, unknown> = {
    model: cfg.model,
    messages,
    temperature: opts.temperature ?? 0.4,
  };
  if (opts.maxTokens) body.max_tokens = opts.maxTokens;
  if (opts.jsonMode) body.response_format = { type: "json_object" };

  const t0 = Date.now();
  const url = `${cfg.baseUrl.replace(/\/$/, "")}/chat/completions`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.apiKey}`,
        "HTTP-Referer": "https://biai-corporate-intelligence.workers.dev",
        "X-Title": "BIAI Corporate Intelligence",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`${cfg.label} HTTP ${res.status}: ${errText.slice(0, 160)}`);
    }
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = data.choices?.[0]?.message?.content ?? "";
    if (!content) throw new Error(`${cfg.label} returned an empty response.`);
    return { provider: cfg.name, model: cfg.model, content, ms: Date.now() - t0 };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") throw new Error(`${cfg.label} timed out after 30s.`);
    throw err instanceof Error ? err : new Error(String(err));
  } finally {
    clearTimeout(timeout);
  }
}

// ---------- public chat() with fallback chain ----------

export async function chat(env: Env, messages: ChatMessage[], opts: ChatOptions = {}): Promise<ChatResult> {
  const order = pickOrder(env);
  const errors: string[] = [];

  for (const name of order) {
    try {
      if (name === "workersai") {
        if (!env.AI) { errors.push("Workers AI: binding not configured"); continue; }
        return await chatWithWorkersAI(env, messages, opts);
      }
      const cfg = getHttpProviderConfig(env, name as HttpProviderName);
      if (!cfg) { continue; } // not configured, skip silently
      return await chatWithHttp(env, cfg, messages, opts);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${name}: ${msg}`);
    }
  }
  throw new Error(`No AI provider could respond. Tried: ${errors.join(" | ") || "none configured"}.`);
}

export function extractJSON<T = unknown>(content: string): T {
  const trimmed = content.trim();
  // Models sometimes emit literal newlines inside JSON string values, which
  // breaks JSON.parse. Escape them before parsing.
  try { return JSON.parse(escapeNewlinesInStrings(trimmed)) as T; } catch { /* fall through */ }
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(trimmed);
  if (fenced) { try { return JSON.parse(escapeNewlinesInStrings(fenced[1])) as T; } catch { /* fall through */ } }
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) {
    try { return JSON.parse(escapeNewlinesInStrings(trimmed.slice(first, last + 1))) as T; } catch { /* fall through */ }
  }
  throw new Error("Model did not return valid JSON.");
}

/** Escape literal newlines/carriage returns that appear inside JSON string values. */
function escapeNewlinesInStrings(text: string): string {
  let out = "";
  let inString = false;
  let escaped = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (escaped) { out += ch; escaped = false; continue; }
    if (ch === "\\") { out += ch; escaped = true; continue; }
    if (ch === '"') { inString = !inString; out += ch; continue; }
    if (inString && ch === "\n") { out += "\\n"; continue; }
    if (inString && ch === "\r") { out += "\\r"; continue; }
    out += ch;
  }
  return out;
}
