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
  model?: string; // override the default Workers AI model for this call
}

export interface ChatResult {
  provider: ProviderName;
  model: string;
  content: string;
  ms: number;
}
