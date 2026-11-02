// Shared AI types for the Worker.

export type ProviderName = "workersai" | "zai" | "groq" | "openrouter";

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
