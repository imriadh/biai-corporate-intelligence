// POST /api/ai/email
// Body: { leadId: string }
// Returns: { subject, body, provider, model, ms } | { error, provider? }
// Server-only. Reads the lead from the in-memory dataset; never trusts client data.

import { NextResponse } from "next/server";
import { loadData } from "@/lib/data/pipeline";
import { chat, extractJSON, AIProviderError } from "@/lib/ai/provider";
import {
  EMAIL_SYSTEM_PROMPT,
  EMAIL_USER_TEMPLATE,
  leadEmailContext,
} from "@/lib/ai/prompts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface EmailResponse {
  subject: string;
  body: string;
}

export async function POST(req: Request) {
  let body: { leadId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const leadId = (body.leadId ?? "").trim();
  if (!leadId) {
    return NextResponse.json({ error: "leadId is required." }, { status: 400 });
  }

  const { leads } = loadData();
  const lead = leads.find((l) => l.leadId === leadId);
  if (!lead) {
    return NextResponse.json({ error: `Lead ${leadId} not found.` }, { status: 404 });
  }

  try {
    const result = await chat(
      [
        { role: "system", content: EMAIL_SYSTEM_PROMPT },
        { role: "user", content: EMAIL_USER_TEMPLATE(leadEmailContext(lead)) },
      ],
      { temperature: 0.5, maxTokens: 700, jsonMode: true },
    );

    let email: EmailResponse;
    try {
      email = extractJSON<EmailResponse>(result.content);
    } catch {
      return NextResponse.json(
        {
          error: "The model returned a malformed response. Please try Regenerate.",
          provider: result.provider,
          model: result.model,
          raw: result.content.slice(0, 400),
        },
        { status: 502 },
      );
    }

    if (!email.subject || !email.body) {
      return NextResponse.json(
        { error: "The model response was missing subject or body." },
        { status: 502 },
      );
    }

    return NextResponse.json({
      subject: email.subject.trim(),
      body: email.body.trim(),
      provider: result.provider,
      model: result.model,
      ms: result.ms,
    });
  } catch (err) {
    if (err instanceof AIProviderError) {
      return NextResponse.json(
        { error: err.message, provider: err.provider },
        { status: 502 },
      );
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error." },
      { status: 500 },
    );
  }
}
