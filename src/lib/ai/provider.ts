// BIAI Corporate Intelligence — Multi-provider AI client (server-only).
//
// Providers (priority order):
//   1. AI_PRIMARY_PROVIDER env var, if set and configured.
//   2. "zai"   — Z.ai LLM SDK built into the runtime (no external key needed)
//   3. "groq"  — Groq API (GROQ_API_KEY)
//   4. "openrouter" — OpenRouter (OPENROUTER_API_KEY)
//   5. "nvidia" — NVIDIA (NVIDIA_API_KEY)
//
// Groq/OpenRouter/NVIDIA are OpenAI-compatible HTTP. Z.ai uses its own SDK.
// Keys live only in server-side env vars; never sent to the client.
//
// If no provider works, callers get a clear error and the rest of the app
// keeps working (no fake AI responses).

import type { ChatMessage, ChatOptions, ChatResult, ProviderName } from "./provider-types";

export type { ChatMessage, ChatOptions, ChatResult, ProviderName };
export { AIProviderError } from "./provider-types";

import { AIProviderError } from "./provider-types";

const PROVIDER_ORDER: ProviderName[] = ["zai", "groq", "openrouter", "nvidia"];

const ENV_PREFIX: Record<ProviderName, string | null> = {
  zai: null, // built-in, no env key
  groq: "GROQ",
  openrouter: "OPENROUTER",
  nvidia: "NVIDIA",
};

const LABELS: Record<ProviderName, string> = {
  zai: "Z.ai",
  groq: "Groq",
  openrouter: "OpenRouter",
  nvidia: "NVIDIA",
};

interface OpenAICompatConfig {
  name: Exclude<ProviderName, "zai">;
  apiKey: string;
  baseUrl: string;
  model: string;
  label: string;
}

function getOpenAICompatConfig(name: Exclude<ProviderName, "zai">): OpenAICompatConfig | null {
  const prefix = ENV_PREFIX[name]!;
  const apiKey = process.env[`${prefix}_API_KEY`] ?? "";
  const baseUrl = process.env[`${prefix}_BASE_URL`] ?? "";
  const model = process.env[`${prefix}_MODEL`] ?? "";
  if (!apiKey || !baseUrl || !model) return null;
  return { name, apiKey, baseUrl, model, label: LABELS[name] };
}

function pickOrdered(): ProviderName[] {
  const primary = (process.env.AI_PRIMARY_PROVIDER ?? "").trim().toLowerCase() as ProviderName;
  const order = [...PROVIDER_ORDER];
  if (primary && PROVIDER_ORDER.includes(primary)) {
    return [primary, ...order.filter((p) => p !== primary)];
  }
  return order;
}

// ---------- Z.ai SDK (built-in) ----------
// Lazily import so the module never crashes if the SDK is absent at build time.
let _zaiInstance: unknown | null = null;
let _zaiPromise: Promise<unknown> | null = null;

async function getZai(): Promise<{
  chat: {
    completions: {
      create: (args: {
        messages: { role: string; content: string }[];
        thinking?: { type: string };
      }) => Promise<{ choices?: { message?: { content?: string } }[] }>;
    };
  };
} | null> {
  if (_zaiInstance) return _zaiInstance as never;
  if (_zaiPromise) return (_zaiPromise as Promise<never>);
  _zaiPromise = (async () => {
    try {
      const mod = await import("z-ai-web-dev-sdk");
      const ZAI = (mod as { default?: { create: () => Promise<unknown> } }).default ?? (mod as unknown as { create: () => Promise<unknown> });
      const inst = await ZAI.create();
      _zaiInstance = inst;
      return inst as never;
    } catch (e) {
      _zaiPromise = null;
      throw new AIProviderError("zai", `Z.ai SDK unavailable: ${e instanceof Error ? e.message : String(e)}`);
    }
  })();
  return (_zaiPromise as Promise<never>);
}

async function chatWithZai(messages: ChatMessage[], opts: ChatOptions): Promise<ChatResult> {
  const zai = await getZai();
  if (!zai) throw new AIProviderError("zai", "Z.ai SDK not initialized.");
  // Z.ai SDK convention: system prompt as first 'assistant' message (per docs),
  // thinking disabled for deterministic output.
  const mapped: { role: string; content: string }[] = messages.map((m) =>
    m.role === "system" ? { role: "assistant", content: m.content } : { role: m.role, content: m.content },
  );
  const t0 = Date.now();
  const completion = await zai.chat.completions.create({
    messages: mapped,
    thinking: { type: "disabled" },
  });
  const content = completion.choices?.[0]?.message?.content ?? "";
  if (!content) {
    throw new AIProviderError("zai", "Z.ai returned an empty response.");
  }
  return { provider: "zai", model: "zai-llm", content, ms: Date.now() - t0 };
}

// ---------- OpenAI-compatible (Groq / OpenRouter / NVIDIA) ----------
async function chatWithOpenAICompat(
  cfg: OpenAICompatConfig,
  messages: ChatMessage[],
  opts: ChatOptions,
): Promise<ChatResult> {
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
        "HTTP-Referer": "https://biai-corporate-intelligence.app",
        "X-Title": "BIAI Corporate Intelligence",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new AIProviderError(cfg.name, `${cfg.label} returned HTTP ${res.status}: ${errText.slice(0, 200)}`);
    }
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = data.choices?.[0]?.message?.content ?? "";
    if (!content) {
      throw new AIProviderError(cfg.name, `${cfg.label} returned an empty response.`);
    }
    return { provider: cfg.name, model: cfg.model, content, ms: Date.now() - t0 };
  } catch (err) {
    if (err instanceof AIProviderError) throw err;
    if (err instanceof Error && err.name === "AbortError") {
      throw new AIProviderError(cfg.name, `${cfg.label} request timed out after 30s.`);
    }
    throw new AIProviderError(cfg.name, `${cfg.label} request failed: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Call the active provider. Tries providers in priority order until one works.
 */
export async function chat(messages: ChatMessage[], opts: ChatOptions = {}): Promise<ChatResult> {
  const order = pickOrdered();
  const errors: string[] = [];

  for (const name of order) {
    try {
      if (name === "zai") {
        return await chatWithZai(messages, opts);
      }
      const cfg = getOpenAICompatConfig(name);
      if (!cfg) continue; // not configured, skip silently
      return await chatWithOpenAICompat(cfg, messages, opts);
    } catch (err) {
      const provider = err instanceof AIProviderError ? err.provider : name;
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${LABELS[provider]}: ${msg}`);
    }
  }

  throw new AIProviderError(
    order[0],
    `No AI provider could respond. Tried: ${errors.join(" | ") || "none configured"}. Set GROQ_API_KEY / OPENROUTER_API_KEY in .env, or rely on the built-in Z.ai provider.`,
  );
}

/** Robustly extract a JSON object from a model response that may wrap it in prose. */
export function extractJSON<T = unknown>(content: string): T {
  const trimmed = content.trim();
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(trimmed);
    if (fenced) {
      try {
        return JSON.parse(fenced[1]) as T;
      } catch {
        /* fall through */
      }
    }
    const first = trimmed.indexOf("{");
    const last = trimmed.lastIndexOf("}");
    if (first !== -1 && last !== -1 && last > first) {
      const slice = trimmed.slice(first, last + 1);
      try {
        return JSON.parse(slice) as T;
      } catch {
        /* fall through */
      }
    }
  }
  throw new Error("Model did not return valid JSON.");
}
