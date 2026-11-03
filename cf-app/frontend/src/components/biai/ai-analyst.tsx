"use client";

import { useState, useCallback, useRef } from "react";
import { Sparkles, Send, AlertCircle, Database, Cpu, RotateCcw, Table2, Hash } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import type { AuditSummary, NormalizedLead } from "@/lib/types";
import { fmtBDT } from "./format";
import { cn } from "@/lib/utils";

interface Props {
  leads: NormalizedLead[];
  audit: AuditSummary;
  onOpenLead: (id: string) => void;
}

interface QueryResponse {
  handledBy: "deterministic" | "llm";
  understood?: boolean;
  intent?: string;
  humanLabel?: string;
  summary: string;
  scalar?: number;
  scalarLabel?: string;
  columns?: { key: string; label: string }[];
  table?: Record<string, string>[];
  rowCount?: number;
  provider?: string;
  model?: string;
  error?: string;
  suggestion?: string;
  spec?: unknown;
}

const EXAMPLES = [
  "Which deals are overdue?",
  "What is the total value in Proposal stage?",
  "Which companies have missing contact details?",
  "Show all leads in the Meeting stage",
  "Which deals have the highest value?",
  "How many deals are currently lost?",
  "Which leads should we follow up with first?",
  "How many paid deals do we have?",
];

export function AiAnalyst({ audit, onOpenLead }: Props) {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<QueryResponse | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const ask = useCallback(async (q?: string) => {
    const query = (q ?? question).trim();
    if (!query) return;
    setQuestion(query);
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/ai/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: query }),
      });
      const data = (await res.json()) as QueryResponse;
      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      setResult(data);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setResult({ handledBy: "llm", understood: false, summary: msg, error: msg });
      toast.error("Query failed", { description: msg });
    } finally {
      setLoading(false);
    }
  }, [question, toast]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="border-brand/30 bg-gradient-to-br from-brand-soft/40 to-card">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-brand text-brand-foreground shrink-0">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-[15px] font-semibold">AI Sales Analyst</h2>
              <p className="text-[12px] text-muted-foreground mt-0.5">
                Ask a question about the pipeline in plain English. Common questions are answered with exact calculations; flexible questions are parsed by AI into a structured query that runs against the real data. The model never invents records or totals.
              </p>
            </div>
          </div>

          {/* Query box */}
          <div className="flex gap-2 mt-3">
            <Input
              ref={inputRef}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") ask(); }}
              placeholder="e.g. Which deals are overdue?"
              className="h-10 bg-background"
            />
            <Button onClick={() => ask()} disabled={loading || !question.trim()} className="bg-brand text-brand-foreground hover:bg-brand/90 h-10 px-4">
              {loading ? <RotateCcw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              <span className="hidden sm:inline ml-1">Ask</span>
            </Button>
          </div>

          {/* Examples */}
          <div className="flex flex-wrap gap-1.5 mt-3">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                onClick={() => ask(ex)}
                disabled={loading}
                className="text-[11px] px-2.5 py-1 rounded-full border border-border bg-background hover:border-brand hover:text-brand transition-colors disabled:opacity-50"
              >
                {ex}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Result */}
      {loading && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-24 w-full" />
          </CardContent>
        </Card>
      )}

      {!loading && result && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-sm flex items-center gap-2">
                {result.understood === false ? (
                  <AlertCircle className="h-4 w-4 text-status-lost" />
                ) : result.handledBy === "deterministic" ? (
                  <Database className="h-4 w-4 text-brand" />
                ) : (
                  <Cpu className="h-4 w-4 text-brand" />
                )}
                {result.humanLabel ?? "Answer"}
              </CardTitle>
              <div className="flex items-center gap-1.5">
                {result.understood !== false && (
                  <Badge variant="outline" className="text-[10px]">
                    {result.handledBy === "deterministic" ? "deterministic" : `AI-parsed · ${result.provider ?? "?"}`}
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* error / unsupported */}
            {result.error && (
              <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-status-lost">
                <div className="font-medium mb-0.5">Could not answer</div>
                {result.error}
                {result.suggestion && <div className="mt-1 text-muted-foreground">{result.suggestion}</div>}
              </div>
            )}
            {result.understood === false && !result.error && (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-status-overdue">
                <div className="font-medium mb-0.5">Not a pipeline question</div>
                {result.summary}
                {result.suggestion && <div className="mt-1 text-muted-foreground">{result.suggestion}</div>}
              </div>
            )}

            {/* summary + scalar */}
            {result.understood !== false && !result.error && (
              <>
                <p className="text-[13px] leading-relaxed">{result.summary}</p>
                {typeof result.scalar === "number" && result.scalarLabel && (
                  <div className="rounded-md bg-brand-soft/60 border border-brand-muted px-3 py-2">
                    <div className="text-[11px] text-muted-foreground uppercase tracking-wide">{result.scalarLabel}</div>
                    <div className="text-xl font-semibold tabular-nums text-brand">
                      {result.scalarLabel.toLowerCase().includes("value") || result.scalarLabel.toLowerCase().includes("total")
                        ? fmtBDT(result.scalar)
                        : new Intl.NumberFormat("en-US").format(result.scalar)}
                    </div>
                  </div>
                )}

                {/* table */}
                {result.table && result.table.length > 0 && result.columns && (
                  <div className="rounded-md border border-border overflow-hidden">
                    <div className="overflow-x-auto max-h-[360px] overflow-y-auto">
                      <Table>
                        <TableHeader className="sticky top-0 bg-muted/60 backdrop-blur">
                          <TableRow className="hover:bg-transparent">
                            {result.columns.map((c) => (
                              <TableHead key={c.key} className="text-[11px] uppercase tracking-wide">{c.label}</TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {result.table.map((row, i) => {
                            const leadId = Object.values(row)[0];
                            return (
                              <TableRow
                                key={i}
                                className="cursor-pointer hover:bg-muted/40"
                                onClick={() => {
                                  if (/^L\d+$/.test(leadId)) onOpenLead(leadId);
                                }}
                              >
                                {result.columns!.map((c) => (
                                  <TableCell key={c.key} className={cn("text-[12px]", c.key === "dealValue" && "tabular-nums")}>
                                    {row[c.label]}
                                  </TableCell>
                                ))}
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                    <div className="px-3 py-1.5 text-[11px] text-muted-foreground border-t border-border bg-muted/20 flex items-center gap-2">
                      <Table2 className="h-3 w-3" />
                      {result.table.length} row{result.table.length === 1 ? "" : "s"} returned
                      {typeof result.rowCount === "number" && <span>· click a row to open the lead</span>}
                    </div>
                  </div>
                )}

                {result.table && result.table.length === 0 && result.understood !== false && (
                  <div className="rounded-md border border-border bg-muted/20 px-3 py-6 text-center text-[12px] text-muted-foreground">
                    <Hash className="h-4 w-4 mx-auto mb-1 opacity-50" />
                    No leads matched this query.
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* How it works */}
      {!result && !loading && (
        <Card>
          <CardContent className="p-4">
            <h3 className="text-[13px] font-medium mb-2">How answers are computed</h3>
            <ol className="space-y-1.5 text-[12px] text-muted-foreground list-decimal list-inside">
              <li>Common questions (overdue, totals by stage, missing contacts, counts) are answered <span className="text-foreground font-medium">deterministically</span> — exact calculations over the real dataset, no AI.</li>
              <li>Flexible questions go to the AI, which returns a <span className="text-foreground font-medium">structured query spec</span> — never a number or a record.</li>
              <li>The spec is executed locally against the real leads, so totals and rows always come from actual data.</li>
              <li>Unsupported questions get a clear &quot;not a pipeline question&quot; response with suggestions.</li>
            </ol>
            <div className="mt-3 text-[11px] text-muted-foreground border-t border-border pt-2">
              Dataset: {audit.totalRecords} leads · reference date {audit.referenceDate} · active pipeline {fmtBDT(audit.totalPipelineValueActive)}.
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
