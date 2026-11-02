// POST /api/ai/query
// Body: { question: string }
// Returns a deterministic result when possible; otherwise asks the LLM to
// produce a STRUCTURED query spec, then executes it against the real data.
// The LLM never invents records or totals.

import { NextResponse } from "next/server";
import { loadData } from "@/lib/data/pipeline";
import {
  runDeterministicQuery,
  executeStructuredSpec,
  type StructuredQuerySpec,
  type QueryResult,
} from "@/lib/data/query-engine";
import { chat, extractJSON, AIProviderError } from "@/lib/ai/provider";
import { QUERY_SYSTEM_PROMPT, QUERY_USER_TEMPLATE, queryContext } from "@/lib/ai/prompts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface LLMQuerySpec {
  understood?: boolean;
  reason?: string;
  filter?: StructuredQuerySpec["filter"];
  sort?: StructuredQuerySpec["sort"];
  aggregate?: StructuredQuerySpec["aggregate"];
  limit?: number;
  human_label?: string;
}

function serializeRows(rows: QueryResult["rows"], columns: QueryResult["columns"]) {
  if (!rows || !columns) return [];
  return rows.map((l) => {
    const o: Record<string, string> = {};
    for (const c of columns) {
      const key = c.key as keyof typeof l;
      if (c.key === "dealValue") {
        o[c.label] = new Intl.NumberFormat("en-US").format(l.dealValue) + " BDT";
      } else if (c.key === "issues") {
        o[c.label] = l.issues.map((i) => i.type).join(", ");
      } else if (c.key === "missingFields") {
        o[c.label] = l.missingFields.join(", ");
      } else {
        o[c.label] = String(l[key] ?? "");
      }
    }
    return o;
  });
}

export async function POST(req: Request) {
  let body: { question?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const question = (body.question ?? "").trim();
  if (!question) {
    return NextResponse.json({ error: "question is required." }, { status: 400 });
  }

  const { leads, audit } = loadData();

  // 1) Try deterministic first — exact calculations, no LLM cost or hallucination.
  const det = runDeterministicQuery(question, leads, audit);
  if (det.matched) {
    return NextResponse.json({
      handledBy: "deterministic",
      intent: det.intent,
      summary: det.summary,
      scalar: det.scalar,
      scalarLabel: det.scalarLabel,
      columns: det.columns,
      table: serializeRows(det.rows, det.columns),
      rowCount: det.rows?.length ?? 0,
    });
  }

  // 2) Fall back to LLM-assisted structured parser, then execute locally.
  try {
    const result = await chat(
      [
        { role: "system", content: QUERY_SYSTEM_PROMPT },
        { role: "user", content: QUERY_USER_TEMPLATE(question, queryContext()) },
      ],
      { temperature: 0, maxTokens: 400, jsonMode: true },
    );

    let spec: LLMQuerySpec;
    try {
      spec = extractJSON<LLMQuerySpec>(result.content);
    } catch {
      return NextResponse.json(
        {
          handledBy: "llm",
          error: "The model could not produce a valid query spec.",
          provider: result.provider,
        },
        { status: 502 },
      );
    }

    if (spec.understood === false) {
      return NextResponse.json({
        handledBy: "llm",
        understood: false,
        summary:
          spec.reason ??
          "I could not map that question to the pipeline data. Try asking about stages, overdue deals, deal values, missing contacts, or duplicates.",
        suggestion:
          "Examples: 'Which deals are overdue?', 'Total value in Proposal stage', 'Which companies have missing contact details?', 'Show leads in Meeting stage', 'Which deals have the highest value?'",
        provider: result.provider,
      });
    }

    const executed = executeStructuredSpec(
      {
        filter: spec.filter,
        sort: spec.sort,
        aggregate: spec.aggregate,
        limit: spec.limit,
      },
      leads,
    );

    return NextResponse.json({
      handledBy: "llm",
      understood: true,
      intent: executed.intent,
      humanLabel: spec.human_label ?? question,
      summary: executed.summary,
      scalar: executed.scalar,
      scalarLabel: executed.scalarLabel,
      columns: executed.columns,
      table: serializeRows(executed.rows, executed.columns),
      rowCount: executed.rows?.length ?? 0,
      provider: result.provider,
      model: result.model,
      spec,
    });
  } catch (err) {
    if (err instanceof AIProviderError) {
      return NextResponse.json(
        {
          handledBy: "llm",
          error: err.message,
          provider: err.provider,
          suggestion:
            "AI provider unavailable. Deterministic questions still work — try 'Which deals are overdue?' or 'Total value in Proposal stage'.",
        },
        { status: 502 },
      );
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error." },
      { status: 500 },
    );
  }
}
