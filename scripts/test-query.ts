// Test the AI NL query flow (deterministic + LLM parser) directly.
import { loadData } from "../src/lib/data/pipeline";
import { runDeterministicQuery, executeStructuredSpec, type StructuredQuerySpec } from "../src/lib/data/query-engine";
import { chat, extractJSON } from "../src/lib/ai/provider";
import { QUERY_SYSTEM_PROMPT, QUERY_USER_TEMPLATE, queryContext } from "../src/lib/ai/prompts";

const { leads, audit } = loadData();

console.log("=== 1. Deterministic queries ===");
const dets = [
  "Which deals are overdue?",
  "What is the total value in Proposal stage?",
  "Which companies have missing contact details?",
  "Show all leads in the Meeting stage",
  "Which deals have the highest value?",
  "How many deals are currently lost?",
  "Which leads should we follow up with first?",
  "How many paid deals do we have?",
  "Show me the duplicates",
];
for (const q of dets) {
  const r = runDeterministicQuery(q, leads, audit);
  console.log(`\nQ: "${q}"`);
  console.log(`  matched=${r.matched} intent=${r.intent}`);
  console.log(`  summary: ${r.summary}`);
  if (r.rows) console.log(`  rows: ${r.rows.length}`);
}

console.log("\n=== 2. LLM-assisted query (flexible) ===");
const flexible = "Which manufacturing companies have a deal value over 100000?";
const result = await chat(
  [
    { role: "system", content: QUERY_SYSTEM_PROMPT },
    { role: "user", content: QUERY_USER_TEMPLATE(flexible, queryContext()) },
  ],
  { temperature: 0, maxTokens: 400, jsonMode: true },
);
console.log("LLM spec response:");
console.log(result.content);
const spec = extractJSON<StructuredQuerySpec & { understood?: boolean; human_label?: string }>(result.content);
console.log("parsed spec:", JSON.stringify(spec, null, 2));
if (spec.understood !== false) {
  const executed = executeStructuredSpec(spec, leads);
  console.log("\nExecuted:");
  console.log("  summary:", executed.summary);
  console.log("  rows:", executed.rows?.length);
  if (executed.rows) {
    for (const l of executed.rows) {
      console.log(`    ${l.leadId} ${l.company} (${l.industry}) ${l.dealValue} BDT — ${l.stageNormalized}`);
    }
  }
}
