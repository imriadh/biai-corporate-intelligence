"use client";

import { useCallback, useEffect, useState } from "react";
import { Copy, UserX, CalendarX, AlertTriangle, Check, X, Layers, FileWarning, ChevronRight, Sparkles, Scissors, Mail, Merge, Trash2, History, Undo2, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { api, type CleanPreviewAction, type CleanLogEntry, type CleanActionId } from "@/lib/api";
import type { AuditSummary, NormalizedLead } from "@/lib/types";
import { fmtBDT, fmtDate } from "./format";
import { StageBadge } from "./stage-badge";
import { cn } from "@/lib/utils";

interface Props {
  leads: NormalizedLead[];
  audit: AuditSummary;
  onOpenLead: (id: string) => void;
  onRefresh: () => void;
}

export function DataQuality({ leads, audit, onOpenLead, onRefresh }: Props) {
  const exactPairs = audit.exactDuplicatePairs;
  const potentialPairs = audit.potentialDuplicatePairs;
  const missingLeads = leads.filter((l) => l.missingFields.length > 0);
  const dateErrLeads = leads.filter((l) => l.issues.some((i) => i.type === "date_order_violation" || i.type === "invalid_date"));
  const overdueLeads = leads.filter((l) => l.isOverdue);
  const emailCasingLeads = leads.filter((l) => l.issues.some((i) => i.type === "email_casing"));

  const [preview, setPreview] = useState<CleanPreviewAction[] | null>(null);
  const [log, setLog] = useState<CleanLogEntry[]>([]);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const loadCleanData = useCallback(async () => {
    try {
      const [p, l] = await Promise.all([api.cleanPreview(), api.cleanLog()]);
      setPreview(p.actions);
      setLog(l.log);
    } catch {
      /* preview is auxiliary — the rest of the screen still works */
    }
  }, []);

  useEffect(() => { loadCleanData(); }, [loadCleanData]);

  const totalCleanable = preview?.reduce((n, a) => n + a.affected, 0) ?? 0;

  const applyClean = async (ids: CleanActionId[], busyKey: string) => {
    setBusyAction(busyKey);
    try {
      const res = await api.cleanApply(ids);
      const deletedBit = res.deletedIds.length > 0 ? `, deleted ${res.deletedIds.join(", ")}` : "";
      toast.success("Pipeline cleaned", {
        description: `${res.totalAffected} record(s) changed${deletedBit}. Everything is reversible.`,
        action: {
          label: "Undo",
          onClick: () => void undoLog(res.logId),
        },
      });
      await loadCleanData();
      onRefresh();
    } catch (e) {
      toast.error("Clean failed", { description: e instanceof Error ? e.message : "?" });
    } finally {
      setBusyAction(null);
    }
  };

  const undoLog = async (logId: number) => {
    try {
      const res = await api.cleanUndo(logId);
      toast.success("Restored", { description: `${res.restoredIds.join(", ")} back to its previous state.` });
      await loadCleanData();
      onRefresh();
    } catch (e) {
      toast.error("Undo failed", { description: e instanceof Error ? e.message : "?" });
    }
  };

  const mergePair = async (keepId: string, mergeId: string) => {
    try {
      const res = await api.mergeLeads(keepId, mergeId);
      toast.success(`${mergeId} merged into ${keepId}`, {
        description: "Empty fields filled, notes appended, duplicate deleted.",
        action: { label: "Undo", onClick: () => void undoLog(res.logId) },
      });
      await loadCleanData();
      onRefresh();
    } catch (e) {
      toast.error("Merge failed", { description: e instanceof Error ? e.message : "?" });
    }
  };

  const deleteLead = async (id: string) => {
    try {
      const res = await api.deleteLead(id);
      toast.success(`${id} deleted`, {
        description: "Removed from the pipeline. One click brings it back.",
        action: { label: "Undo", onClick: () => void undoLog(res.logId) },
      });
      await loadCleanData();
      onRefresh();
    } catch (e) {
      toast.error("Delete failed", { description: e instanceof Error ? e.message : "?" });
    }
  };

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
                {audit.flaggedLeadIds.length} of {audit.totalRecords} leads have at least one flag. Fix issues right here —
                merge or delete duplicates, run one-click cleaning, edit any field — and undo every change with one click.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 mt-4">
            <SummaryStat label="Exact dup pairs" value={exactPairs.length} tone="warn" icon={Layers} />
            <SummaryStat label="Potential dup pairs" value={potentialPairs.length} tone="warn" icon={Copy} />
            <SummaryStat label="Missing contacts" value={missingLeads.length} tone="error" icon={UserX} />
            <SummaryStat label="Date errors" value={dateErrLeads.length} tone="error" icon={CalendarX} />
            <SummaryStat label="Overdue" value={overdueLeads.length} tone="overdue" icon={AlertTriangle} />
            <SummaryStat label="Quick-clean items" value={totalCleanable} tone="info" icon={Sparkles} />
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="quick-clean">
        <TabsList>
          <TabsTrigger value="quick-clean">Quick clean ({totalCleanable})</TabsTrigger>
          <TabsTrigger value="duplicates">Duplicates ({exactPairs.length + potentialPairs.length})</TabsTrigger>
          <TabsTrigger value="missing">Missing info ({missingLeads.length})</TabsTrigger>
          <TabsTrigger value="dates">Dates ({dateErrLeads.length + overdueLeads.length})</TabsTrigger>
          <TabsTrigger value="other">Other ({emailCasingLeads.length})</TabsTrigger>
        </TabsList>

        {/* Quick clean — one-click actions + history */}
        <TabsContent value="quick-clean" className="space-y-3">
          <SectionHeader
            title="One-click cleaning"
            desc="Safe, reviewable fixes computed from your current data. Every action shows exactly what it will change before you run it — and every run can be undone."
          />
          {!preview ? (
            <Card><CardContent className="py-8 text-center flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Computing cleaning plan…
            </CardContent></Card>
          ) : totalCleanable === 0 ? (
            <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
              Nothing to clean — no stray spaces, no casing issues, no exact duplicates. Your pipeline is tidy.
            </CardContent></Card>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  className="h-8 text-[12px] bg-brand text-brand-foreground hover:bg-brand/90"
                  disabled={busyAction !== null}
                  onClick={() => applyClean(preview.filter((a) => a.affected > 0).map((a) => a.id), "all")}
                >
                  {busyAction === "all" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  Clean all {totalCleanable} issue{totalCleanable === 1 ? "" : "s"}
                </Button>
                <span className="text-[11px] text-muted-foreground">Runs every fix below in one go — one Undo restores everything.</span>
              </div>
              {preview.filter((a) => a.affected > 0 || a.id === "merge_exact_duplicates").map((a) => (
                <CleanActionCard
                  key={a.id}
                  action={a}
                  busy={busyAction !== null}
                  onApply={() => applyClean([a.id], a.id)}
                />
              ))}
            </>
          )}

          {/* Recent cleanups + undo */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2"><History className="h-4 w-4 text-muted-foreground" /> Recent cleanups</CardTitle>
              <CardDescription>Every edit, delete, merge and cleaning run is logged with a full snapshot of the data it touched.</CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              {log.length === 0 ? (
                <EmptyInline text="No cleanups yet." />
              ) : (
                <ul className="divide-y divide-border">
                  {log.map((entry) => (
                    <li key={entry.id} className="py-2 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-[12.5px] font-medium flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px] capitalize">{entry.action.replace("_", " ")}</Badge>
                          <span className="truncate">{entry.summary}</span>
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          {new Date(entry.createdAt + "Z").toLocaleString()} · touched {entry.targetIds.join(", ") || "—"}
                        </div>
                      </div>
                      <Button size="sm" variant="outline" className="h-7 text-[11px] shrink-0" disabled={busyAction !== null} onClick={() => void undoLog(entry.id)}>
                        <Undo2 className="h-3 w-3" /> Undo
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Duplicates — real merge / delete */}
        <TabsContent value="duplicates" className="space-y-3">
          <SectionHeader
            title="Duplicate companies"
            desc="Exact duplicates share an identical normalized company name. Potential duplicates have different company names but the same contact identity (email/phone). Merge fills empty fields and keeps the richer record; delete removes a row — both are undoable."
          />
          {exactPairs.length === 0 && potentialPairs.length === 0 && (
            <EmptyCard text="No duplicates detected." />
          )}
          {exactPairs.map((pair, i) => (
            <DuplicatePairCard key={`exact-${i}`} pair={pair} kind="exact" leads={leads} onOpenLead={onOpenLead} onMerge={mergePair} onDelete={deleteLead} />
          ))}
          {potentialPairs.map((pair, i) => (
            <DuplicatePairCard key={`pot-${i}`} pair={pair} kind="potential" leads={leads} onOpenLead={onOpenLead} onMerge={mergePair} onDelete={deleteLead} />
          ))}
        </TabsContent>

        {/* Missing info */}
        <TabsContent value="missing" className="space-y-3">
          <SectionHeader
            title="Missing information"
            desc="Required contact fields that are empty. Open a lead to fill the gaps — edits are saved to the database and undoable from Recent cleanups."
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
                    <th className="text-left font-medium py-2 pr-4">Suggested next step</th>
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
            desc="Invalid/unparseable dates and date-order violations (follow-up before last contact). Overdue follow-ups are listed separately — they are not date errors, just past due. Fix any date by editing the lead."
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
            desc="Email casing signals likely data-entry typos — fix them instantly from Quick clean. Notes that explicitly flag duplicates or data errors are surfaced for cross-checking."
          />
          {emailCasingLeads.length === 0 ? <EmptyCard text="No other issues." /> : (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" className="h-8 text-[12px]" disabled={busyAction !== null || !(preview?.find((a) => a.id === "lowercase_emails")?.affected)} onClick={() => applyClean(["lowercase_emails"], "lowercase_emails")}>
                  {busyAction === "lowercase_emails" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
                  Lowercase all {preview?.find((a) => a.id === "lowercase_emails")?.affected ?? emailCasingLeads.length} emails
                </Button>
                <span className="text-[11px] text-muted-foreground">One click — undoable from Recent cleanups.</span>
              </div>
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

/* ------------------------------ quick clean card ----------------------------- */

function CleanActionCard({ action, busy, onApply }: { action: CleanPreviewAction; busy: boolean; onApply: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const Icon = action.id === "trim_spaces" ? Scissors : action.id === "lowercase_emails" ? Mail : Merge;
  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5 min-w-0">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-amber-50 border border-amber-200 text-status-warn shrink-0">
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[13px] font-semibold">{action.label}</span>
                <Badge variant="outline" className={cn("text-[10px]", action.affected > 0 ? "border-amber-200 bg-amber-50 text-status-warn" : "border-slate-200 bg-slate-50 text-muted-foreground")}>
                  {action.affected} affected
                </Badge>
              </div>
              <p className="text-[12px] text-muted-foreground mt-0.5">{action.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {action.rows.length > 0 && (
              <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={() => setExpanded(!expanded)}>
                {expanded ? "Hide" : "Review"}
              </Button>
            )}
            <Button size="sm" variant={action.affected > 0 ? "default" : "outline"} className="h-7 text-[11px] bg-brand text-brand-foreground hover:bg-brand/90" disabled={busy || action.affected === 0} onClick={onApply}>
              {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
              Clean
            </Button>
          </div>
        </div>
        {expanded && action.rows.length > 0 && (
          <ul className="mt-2 rounded-md border border-border bg-muted/30 divide-y divide-border max-h-56 overflow-y-auto">
            {action.rows.map((r) => (
              <li key={`${action.id}-${r.leadId}`} className="px-3 py-1.5 text-[11.5px] font-mono text-muted-foreground truncate" title={r.detail}>
                <span className="font-semibold text-foreground">{r.leadId}</span> — {r.detail}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

/* ------------------------------ duplicate pair ------------------------------- */

function DuplicatePairCard({ pair, kind, leads, onOpenLead, onMerge, onDelete }: {
  pair: [string, string];
  kind: "exact" | "potential";
  leads: NormalizedLead[];
  onOpenLead: (id: string) => void;
  onMerge: (keepId: string, mergeId: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [hidden, setHidden] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const a = leads.find((l) => l.leadId === pair[0])!;
  const b = leads.find((l) => l.leadId === pair[1])!;
  const link = a.duplicateLinks.find((d) => d.partnerIds.includes(b.leadId)) ?? b.duplicateLinks.find((d) => d.partnerIds.includes(a.leadId));

  if (hidden) return null;

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try { await fn(); } finally { setBusy(false); }
  };

  const deleteButton = (target: NormalizedLead, other: NormalizedLead) => (
    <Button
      size="sm"
      variant="ghost"
      className={cn("h-7 text-[11px]", pendingDelete === target.leadId ? "text-status-lost hover:text-status-lost bg-rose-50" : "text-muted-foreground")}
      disabled={busy}
      onClick={() => {
        if (pendingDelete === target.leadId) {
          setPendingDelete(null);
          void run(() => onDelete(target.leadId));
        } else {
          setPendingDelete(target.leadId);
          window.setTimeout(() => setPendingDelete((p) => (p === target.leadId ? null : p)), 4000);
        }
      }}
    >
      <Trash2 className="h-3 w-3" />
      {pendingDelete === target.leadId ? `Really delete ${target.leadId}?` : `Delete ${target.leadId}`}
    </Button>
  );

  return (
    <Card>
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
          {[a, b].map((l, idx) => {
            const other = idx === 0 ? b : a;
            return (
              <div
                key={l.leadId}
                className={cn(
                  "rounded-md border p-2.5 text-[12px]",
                  idx === 0 ? "border-amber-200 bg-amber-50/40" : "border-border",
                )}
              >
                <button onClick={() => onOpenLead(l.leadId)} className="text-left w-full">
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
                <div className="mt-2 border-t border-border pt-2 flex flex-wrap gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-[11px]"
                    disabled={busy}
                    onClick={() => void run(() => onMerge(l.leadId, other.leadId))}
                  >
                    <Merge className="h-3 w-3 text-status-paid" /> Merge {other.leadId} into this
                  </Button>
                  {deleteButton(l, other)}
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-3 border-t border-border pt-3 flex items-center gap-2 flex-wrap">
          <span className="text-[11px] text-muted-foreground">
            Merge = keep this record, fill its empty fields from the other, append its notes, delete the other.
          </span>
          <Button size="sm" variant="ghost" className="h-7 text-[11px] ml-auto" disabled={busy} onClick={() => setHidden(true)}>
            <X className="h-3 w-3" /> Keep both — hide this pair
          </Button>
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
