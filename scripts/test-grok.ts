// Direct test of the Grok (xAI) API — bypasses the dev server.
// Bun auto-loads .env. Verifies the multi-provider client + key actually work.
import { chat } from "../src/lib/ai/provider";
import { EMAIL_SYSTEM_PROMPT, EMAIL_USER_TEMPLATE, leadEmailContext } from "../src/lib/ai/prompts";
import { loadData } from "../src/lib/data/pipeline";

console.log("XAI_API_KEY set?", process.env.XAI_API_KEY ? `yes (${process.env.XAI_API_KEY.slice(0, 8)}...)` : "NO");
console.log("AI_PRIMARY_PROVIDER:", process.env.AI_PRIMARY_PROVIDER);

const { leads } = loadData();
const lead = leads.find((l) => l.leadId === "L04")!;
console.log("Lead:", lead.leadId, lead.company, "| stage:", lead.stageNormalized, "| overdue:", lead.isOverdue);

try {
  const result = await chat(
    [
      { role: "system", content: EMAIL_SYSTEM_PROMPT },
      { role: "user", content: EMAIL_USER_TEMPLATE(leadEmailContext(lead)) },
    ],
    { temperature: 0.5, maxTokens: 700, jsonMode: true },
  );
  console.log("=== RESPONSE ===");
  console.log("provider:", result.provider, "| model:", result.model, "| ms:", result.ms);
  console.log("--- content ---");
  console.log(result.content);
} catch (e) {
  console.error("FAILED:", e instanceof Error ? `${e.name}: ${e.message}` : String(e));
  process.exit(1);
}
