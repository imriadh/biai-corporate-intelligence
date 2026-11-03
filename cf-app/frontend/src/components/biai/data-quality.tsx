"use client";

import { useState } from "react";
import { Copy, UserX, CalendarX, AlertTriangle, Check, X, Layers, FileWarning, ChevronRight, ShieldAlert } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { AuditSummary, NormalizedLead } from "@/lib/types";
import { fmtBDT, fmtDate } from "./format";
import { StageBadge } from "./stage-badge";
import { cn } from "@/lib/utils";

interface Props {
  leads: NormalizedLead[];
  audit: AuditSummary;
  onOpenLead: (id: string) => void;
}

export function DataQuality({ leads, audit, onOpenLead }: Props) {
  const exactPairs = audit.exactDuplicatePairs;
  const potentialPairs = audit.potentialDuplicatePairs;
  const missingLeads = leads.filter((l) => l.missingFields.length > 0);
  const dateErrLeads = leads.filter((l) => l.issues.some((i) => i.type === "date_order_violation" || i.type === "invalid_date"));
  const overdueLeads = leads.filter((l) => l.isOverdue);
  const emailCasingLeads = leads.filter((l) => l.issues.some((i) => i.type === "email_casing"));

  const totalIssues =
    exactPairs.length + potentialPairs.length + missingLeads.length + dateErrLeads.length + overdueLeads.length + emailCasingLeads.length;

  return (
    <div className="space-y-4">
      {/* Summary banner */}
      <Card className="border-border">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-rose-50 text-status-lost shrink-0">
              <FileWarning className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-[15px] font-semibold">Data Quality Center</h2>
              <p className="text-[12px] text-muted-foreground mt-0.5">
                {audit.flaggedLeadIds.length} of {audit.totalRecords} leads have at least one flag. Original imported values are always preserved — nothing is auto-corrected or deleted.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 mt-4">
            <SummaryStat label="Exact dup pairs" value={exactPairs.length} tone="warn" icon={Layers} />
            <SummaryStat label="Potential dup pairs" value={potentialPairs.length} tone="warn" icon={Copy} />
            <SummaryStat label="Missing contacts" value={missingLeads.length} tone="error" icon={UserX} />
            <SummaryStat label="Date errors" value={dateErrLeads.length} tone="error" icon={CalendarX} />
            <SummaryStat label="Overdue" value={overdueLeads.length} tone="overdue" icon={AlertTriangle} />
            <SummaryStat label="Email casing" value={emailCasingLeads.length} tone="info" icon={FileWarning} />
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="duplicates">
        <TabsList>
          <TabsTrigger value="duplicates">Duplicates ({exactPairs.length + potentialPairs.length})</TabsTrigger>
          <TabsTrigger value="missing">Missing info ({missingLeads.length})</TabsTrigger>
          <TabsTrigger value="dates">Dates ({dateErrLeads.length + overdueLeads.length})</TabsTrigger>
          <TabsTrigger value="other">Other ({emailCasingLeads.length})</TabsTrigger>
        </TabsList>

        {/* Duplicates */}
        <TabsContent value="duplicates" className="space-y-3">
          <SectionHeader
            title="Duplicate companies"
            desc="Exact duplicates share an identical normalized company name. Potential duplicates have different company names but the same contact identity (email/phone). Merge is never automatic — review each pair."
          />
          {exactPairs.length === 0 && potentialPairs.length === 0 && (
            <EmptyCard text="No duplicates detected." />
          )}
          {exactPairs.map((pair, i) => (
            <DuplicatePairCard
              key={`exact-${i}`}
              pair={pair}
              kind="exact"
              leads={leads}
              onOpenLead={onOpenLead}
            />
          ))}
          {potentialPairs.map((pair, i) => (
            <DuplicatePairCard
              key={`pot-${i}`}
              pair={pair}
              kind="potential"
              leads={leads}
              onOpenLead={onOpenLead}
            />
          ))}
        </TabsContent>

        {/* Missing info */}
        <TabsContent value="missing" className="space-y-3">
          <SectionHeader
            title="Missing information"
            desc="Required contact fields that are empty. Missing values are never guessed or auto-filled."
          />
          {missingLeads.length === 0 ? <EmptyCard text="No missing contact details." /> : (
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-[13px]">
                <thead className="bg-muted/40">
                  <tr className="text-[11px] text-muted-foreground">
                    <th className="text-left font-medium py-2 pl-4">Lead</th>
                    <th className="text-left font-medium px-2">Company</th>
                    <th className="text-left font-medium px-2">Stage</th>
                    <th className="text-left font-medium px-2">Missing fields</th>
                    <th className="text-left font-medium py-2 pr-4">Suggested correction</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {missingLeads.map((l) => (
                    <tr key={l.leadId} className="hover:bg-muted/30 cursor-pointer" onClick={() => onOpenLead(l.leadId)}>
                      <td className="font-mono text-[11px] text-muted-foreground py-2 pl-4">{l.leadId}</td>
                      <td className="px-2 font-medium">{l.company}</td>
                      <td className="px-2"><StageBadge stage={l.stageNormalized} /></td>
                      <td className="px-2">
                        <div className="flex flex-wrap gap-1">
                          {l.missingFields.map((f) => (
                            <Badge key={f} variant="outline" className="text-status-lost border-rose-200 bg-rose-50 text-[10px]">{f}</Badge>
                          ))}
                        </div>
                      </td>
                      <td className="py-2 pr-4 text-[12px] text-muted-foreground">
                        {correctionForMissing(l)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* Dates */}
        <TabsContent value="dates" className="space-y-3">
          <SectionHeader
            title="Date validation"
            desc="Invalid/unparseable dates and date-order violations (follow-up before last contact). Overdue follow-ups are listed separately — they are not date errors, just past due."
          />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2"><CalendarX className="h-4 w-4 text-status-lost" /> Date-order violations &amp; invalid dates</CardTitle>
                <CardDescription>{dateErrLeads.length} record(s)</CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                {dateErrLeads.length === 0 ? <EmptyInline text="None." /> : (
                  <ul className="divide-y divide-border">
                    {dateErrLeads.map((l) => (
                      <li key={l.leadId} className="py-2">
                        <button onClick={() => onOpenLead(l.leadId)} className="text-left w-full hover:bg-muted/30 -mx-2 px-2 rounded-sm">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[13px] font-medium">{l.company} <span className="font-mono text-[11px] text-muted-foreground">{l.leadId}</span></span>
                            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                          </div>
                          {l.issues.filter((i) => i.type === "date_order_violation" || i.type === "invalid_date").map((iss, i) => (
                            <div key={i} className="text-[12px] text-status-lost mt-1">{iss.message}</div>
                          ))}
                          <div className="text-[11px] text-muted-foreground mt-1">
                            <span className="font-medium">Raw:</span> last contact="{l.lastContact || "(empty)"}", next follow-up="{l.nextFollowUp || "(empty)"}"
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-status-overdue" /> Overdue follow-ups</CardTitle>
                <CardDescription>{overdueLeads.length} non-terminal leads past due (before {audit.referenceDate})</CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                {overdueLeads.length === 0 ? <EmptyInline text="None." /> : (
                  <ul className="divide-y divide-border max-h-[300px] overflow-y-auto">
                    {overdueLeads.map((l) => (
                      <li key={l.leadId}>
                        <button onClick={() => onOpenLead(l.leadId)} className="text-left w-full py-2 hover:bg-muted/30 -mx-2 px-2 rounded-sm">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[13px] font-medium truncate">{l.company}</span>
                            <span className="text-[12px] text-status-overdue font-medium shrink-0">due {fmtDate(l.nextFollowUpDate)}</span>
                          </div>
                          <div className="flex items-center justify-between gap-2 mt-0.5">
                            <span className="text-[11px] text-muted-foreground">{l.leadId} · {l.contactName || "—"}</span>
                            <StageBadge stage={l.stageNormalized} />
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Other */}
        <TabsContent value="other" className="space-y-3">
          <SectionHeader
            title="Other data-quality issues"
            desc="Email casing signals likely data-entry typos. Notes that explicitly flag duplicates or data errors are surfaced for cross-checking."
          />
          {emailCasingLeads.length === 0 ? <EmptyCard text="No other issues." /> : (
            <div className="space-y-2">
              {emailCasingLeads.map((l) => (
                <Card key={l.leadId}>
                  <CardContent className="p-3 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-medium">{l.company}</span>
                        <span className="font-mono text-[11px] text-muted-foreground">{l.leadId}</span>
                      </div>
                      <div className="text-[12px] text-muted-foreground mt-0.5">
                        Raw email: <span className="font-mono">{l.contactEmail}</span>
                      </div>
                      <div className="text-[12px] text-status-warn mt-0.5">
                        Normalized (lowercased domain): <span className="font-mono">{l.normalizedEmail}</span>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => onOpenLead(l.leadId)}>Open <ChevronRight className="h-3.5 w-3.5" /></Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function DuplicatePairCard({ pair, kind, leads, onOpenLead }: {
  pair: [string, string];
  kind: "exact" | "potential";
  leads: NormalizedLead[];
  onOpenLead: (id: string) => void;
}) {
  const [decision, setDecision] = useState<"none" | "keep-a" | "keep-b" | "dismissed">("none");
  const a = leads.find((l) => l.leadId === pair[0])!;
  const b = leads.find((l) => l.leadId === pair[1])!;
  const link = a.duplicateLinks.find((d) => d.partnerIds.includes(b.leadId)) ?? b.duplicateLinks.find((d) => d.partnerIds.includes(a.leadId));

  return (
    <Card className={cn(decision !== "none" && "opacity-60")}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm flex items-center gap-2">
            {kind === "exact" ? <Layers className="h-4 w-4 text-status-warn" /> : <Copy className="h-4 w-4 text-status-warn" />}
            {kind === "exact" ? "Exact duplicate" : "Potential duplicate"}: {pair[0]} &amp; {pair[1]}
          </CardTitle>
          <Badge variant="outline" className={cn("text-[10px]", kind === "exact" ? "border-amber-200 bg-amber-50 text-status-warn" : "border-slate-200 bg-slate-50 text-muted-foreground")}>
            {kind}
          </Badge>
        </div>
        <CardDescription className="text-[12px]">{link?.reason}</CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {[a, b].map((l) => (
            <button
              key={l.leadId}
              onClick={() => onOpenLead(l.leadId)}
              className={cn(
                "text-left rounded-md border p-2.5 text-[12px] hover:border-brand",
                decision === "keep-a" && l.leadId === a.leadId && "border-emerald-300 bg-emerald-50",
                decision === "keep-b" && l.leadId === b.leadId && "border-emerald-300 bg-emerald-50",
                (decision === "keep-a" && l.leadId === b.leadId) || (decision === "keep-b" && l.leadId === a.leadId) ? "border-rose-200 bg-rose-50 opacity-70" : "border-border",
              )}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono text-[10px] text-muted-foreground">{l.leadId}</span>
                <StageBadge stage={l.stageNormalized} />
              </div>
              <div className="font-medium text-[13px]">{l.company}</div>
              <div className="text-muted-foreground mt-0.5">{l.contactName || "— no name —"}</div>
              <div className="font-mono text-[11px] text-muted-foreground truncate">{l.contactEmail || "—"}</div>
              <div className="font-mono text-[11px] text-muted-foreground">{l.contactPhone || "—"}</div>
              {l.dealValue > 0 && <div className="mt-1 text-status-paid font-medium">{fmtBDT(l.dealValue)}</div>}
            </button>
          ))}
        </div>
        {/* Merge workflow */}
        <div className="mt-3 border-t border-border pt-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] text-muted-foreground">Safe review workflow:</span>
            <Button size="sm" variant="outline" className="h-7 text-[12px]" disabled={decision !== "none"} onClick={() => setDecision("keep-a")}>
              <Check className="h-3 w-3 text-status-paid" /> Keep {a.leadId}
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-[12px]" disabled={decision !== "none"} onClick={() => setDecision("keep-b")}>
              <Check className="h-3 w-3 text-status-paid" /> Keep {b.leadId}
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-[12px]" disabled={decision !== "none"} onClick={() => setDecision("dismissed")}>
              <X className="h-3 w-3" /> Dismiss
            </Button>
            {decision !== "none" && (
              <Button size="sm" variant="ghost" className="h-7 text-[12px] ml-auto" onClick={() => setDecision("none")}>
                Undo
              </Button>
            )}
          </div>
          {decision !== "none" && (
            <p className="text-[11px] text-muted-foreground mt-1.5">
              {decision === "dismissed"
                ? "Pair dismissed. Neither record is modified."
                : `Marked to keep ${decision === "keep-a" ? a.leadId : b.leadId}. The other record stays in the dataset (never auto-deleted); this decision is a review note only.`}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function correctionForMissing(l: NormalizedLead): string {
  if (l.missingFields.includes("contact name") && l.missingFields.includes("contact email")) {
    return "Re-contact via phone to capture name + email; do not guess.";
  }
  if (l.missingFields.includes("contact phone")) {
    return "Request phone number via email; leave blank until provided.";
  }
  if (l.missingFields.includes("contact email")) {
    return "Request email; do not derive from company domain.";
  }
  if (l.missingFields.includes("contact name")) {
    return "Capture contact name at next touchpoint.";
  }
  return "Fill from a verified source; do not auto-generate.";
}

function SectionHeader({ title, desc }: { title: string; desc: string }) {
  return (
    <div>
      <h3 className="text-[14px] font-semibold">{title}</h3>
      <p className="text-[12px] text-muted-foreground mt-0.5">{desc}</p>
    </div>
  );
}

function SummaryStat({ label, value, tone, icon: Icon }: { label: string; value: number; tone: "warn" | "error" | "overdue" | "info"; icon: typeof Layers }) {
  const cls = {
    warn: "text-status-warn bg-amber-50 border-amber-200",
    error: "text-status-lost bg-rose-50 border-rose-200",
    overdue: "text-status-overdue bg-amber-50 border-amber-200",
    info: "text-muted-foreground bg-slate-50 border-slate-200",
  }[tone];
  return (
    <div className={cn("rounded-md border px-3 py-2", cls)}>
      <div className="flex items-center justify-between">
        <span className="text-lg font-semibold tabular-nums leading-none">{value}</span>
        <Icon className="h-3.5 w-3.5 opacity-70" />
      </div>
      <div className="text-[11px] mt-1">{label}</div>
    </div>
  );
}

function EmptyCard({ text }: { text: string }) {
  return (
    <Card>
      <CardContent className="py-10 text-center text-sm text-muted-foreground">{text}</CardContent>
    </Card>
  );
}

function EmptyInline({ text }: { text: string }) {
  return <div className="py-4 text-center text-[12px] text-muted-foreground">{text}</div>;
}
