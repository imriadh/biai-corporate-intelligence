// Shared types for the AI provider module (kept separate to avoid circular imports).

export type ProviderName = "zai" | "groq" | "openrouter" | "nvidia";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
}

export interface ChatResult {
  provider: ProviderName;
  model: string;
  content: string;
  ms: number;
}

export class AIProviderError extends Error {
  provider: ProviderName;
  constructor(provider: ProviderName, message: string) {
    super(message);
    this.name = "AIProviderError";
    this.provider = provider;
  }
}
