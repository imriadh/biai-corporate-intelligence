"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Wallet, AlertTriangle, FileText, CheckCircle2, ArrowRight, TrendingUp, Clock, Sparkles, RefreshCw } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { AuditSummary, NormalizedLead, StageSummary } from "@/lib/types";
import { PIPELINE_STAGES, TERMINAL_STAGES } from "@/lib/types";
import { fmtBDT, fmtNum, fmtDate, STAGE_COLORS } from "./format";
import { StageBadge } from "./stage-badge";
import { api, type ChasePlanResponse } from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { View } from "./app-shell";

// Explicit hex colors per stage for the pipeline chart — SVG fill doesn't
// resolve CSS custom properties, so we use hex values. The palette flows
// cool → warm → green/red to read like a sales funnel.
const STAGE_CHART_COLORS: Record<string, string> = {
  New: "#6366f1",            // indigo — fresh lead
  Contacted: "#0d9488",      // teal — engaged
  Meeting: "#0891b2",        // cyan — progressing
  Proposal: "#f59e0b",       // amber — warming up
  "Invoice sent": "#f97316", // orange — close to close
  Paid: "#10b981",           // emerald — success
  Lost: "#ef4444",           // red — failure
};

interface DashboardProps {
  leads: NormalizedLead[];
  audit: AuditSummary;
  onOpenLead: (id: string) => void;
  onGoTo: (v: View) => void;
  doneLeads: Set<string>;
  onResetDone: () => void;
}

export function Dashboard({ leads, audit, onOpenLead, onGoTo, doneLeads, onResetDone }: DashboardProps) {
  const [chasePlan, setChasePlan] = useState<ChasePlanResponse | null>(null);
  const [chaseLoading, setChaseLoading] = useState(false);

  const overdueLeads = leads.filter((l) => l.isOverdue).sort((a, b) => (a.nextFollowUpDate ?? "").localeCompare(b.nextFollowUpDate ?? ""));
  const flaggedLeads = leads.filter((l) => l.hasIssues);
  const recentlyUpdated = [...leads]
    .filter((l) => l.lastContactDate)
    .sort((a, b) => (b.lastContactDate ?? "").localeCompare(a.lastContactDate ?? ""))
    .slice(0, 6);

  const generateChasePlan = async () => {
    setChaseLoading(true); setChasePlan(null);
    try {
      const r = await api.chasePlan();
      setChasePlan(r);
      if (r.error) toast.error("Chase plan failed", { description: r.error });
    } catch (e) {
      toast.error("Chase plan failed", { description: e instanceof Error ? e.message : "?" });
    } finally { setChaseLoading(false); }
  };

  const chartData = audit.stageSummaries.map((s) => ({
    stage: s.stage,
    label: s.stage === "Invoice sent" ? "Invoice" : s.stage,
    count: s.count,
    value: s.value,
    isTerminal: s.isTerminal,
  }));

  const maxCount = Math.max(...chartData.map((d) => d.count), 1);

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <section>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <KpiCard
            label="Total Leads"
            value={fmtNum(audit.totalRecords)}
            sub={`${audit.uniqueCompaniesNormalized} unique companies`}
            icon={Users}
            accent="brand"
          />
          <KpiCard
            label="Pipeline Value"
            value={fmtBDT(audit.totalPipelineValueActive)}
            sub="active 5 stages"
            icon={Wallet}
            accent="brand"
          />
          <KpiCard
            label="Overdue Follow-ups"
            value={fmtNum(audit.overdueLeadIds.length)}
            sub="non-terminal, due before ref date"
            icon={AlertTriangle}
            accent="overdue"
            onClick={() => onGoTo("pipeline")}
          />
          <KpiCard
            label="Deals in Proposal"
            value={fmtNum(audit.proposalCount)}
            sub={fmtBDT(audit.proposalValue)}
            icon={FileText}
            accent="warn"
          />
          <KpiCard
            label="Paid Deals"
            value={fmtNum(audit.paidCount)}
            sub={fmtBDT(audit.paidValue)}
            icon={CheckCircle2}
            accent="paid"
          />
        </div>
      </section>

      {/* Pipeline chart + stage table */}
      <section className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">Sales pipeline by stage</CardTitle>
            <CardDescription>Lead count and deal value per stage. First five are active; Paid &amp; Lost are terminal.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#64748b" }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#64748b" }} allowDecimals={false} />
                  <Tooltip
                    cursor={{ fill: "#f1f5f9" }}
                    contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}
                    formatter={(v: number, name: string) => name === "value" ? fmtBDT(v) : [`${v} leads`, name]}
                  />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={64}>
                    {chartData.map((d, i) => (
                      <Cell key={i} fill={STAGE_CHART_COLORS[d.stage as Stage] ?? "#0d9488"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-muted-foreground">
              <Legend color="#6366f1" label="New" />
              <Legend color="#0d9488" label="Contacted → Meeting" />
              <Legend color="#f59e0b" label="Proposal / Invoice" />
              <Legend color="#10b981" label="Paid" />
              <Legend color="#ef4444" label="Lost" />
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Stage breakdown</CardTitle>
            <CardDescription>Count and value, terminal stages separated.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <StageBreakoutTable summaries={audit.stageSummaries} />
          </CardContent>
        </Card>
      </section>

      {/* Overdue + data quality */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4 text-status-overdue" />
                Overdue follow-ups
              </CardTitle>
              <CardDescription>{overdueLeads.length} leads need attention now</CardDescription>
            </div>
            <Button variant="ghost" size="sm" className="text-brand" onClick={() => onGoTo("pipeline")}>
              View pipeline <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </CardHeader>
          <CardContent className="pt-0">
            {overdueLeads.length === 0 ? (
              <EmptyState text="No overdue follow-ups." />
            ) : (
              <ul className="divide-y divide-border max-h-[280px] overflow-y-auto">
                {overdueLeads.map((l) => (
                  <li key={l.leadId}>
                    <button
                      onClick={() => onOpenLead(l.leadId)}
                      className="w-full flex items-center justify-between gap-2 py-2.5 text-left hover:bg-muted/40 -mx-2 px-2 rounded-sm"
                    >
                      <div className="min-w-0">
                        <div className="text-[13px] font-medium truncate">{l.company}</div>
                        <div className="text-[11px] text-muted-foreground truncate">
                          {l.contactName || "—"} · due {fmtDate(l.nextFollowUpDate)}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {l.dealValue > 0 && <span className="text-[11px] text-muted-foreground hidden sm:inline">{fmtBDT(l.dealValue)}</span>}
                        <StageBadge stage={l.stageNormalized} />
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-status-lost" />
                Data-quality problems
              </CardTitle>
              <CardDescription>{flaggedLeads.length} of {audit.totalRecords} leads flagged</CardDescription>
            </div>
            <Button variant="ghost" size="sm" className="text-brand" onClick={() => onGoTo("data-quality")}>
              Open center <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-2 gap-2 mb-3">
              <StatChip label="Duplicates" value={audit.exactDuplicatePairs.length + audit.potentialDuplicatePairs.length} tone="warn" />
              <StatChip label="Missing contacts" value={audit.missingContactLeadIds.length} tone="error" />
              <StatChip label="Date errors" value={audit.dateOrderViolationLeadIds.length} tone="error" />
              <StatChip label="Overdue" value={audit.overdueLeadIds.length} tone="overdue" />
            </div>
            <ul className="divide-y divide-border max-h-[180px] overflow-y-auto">
              {flaggedLeads.slice(0, 8).map((l) => (
                <li key={l.leadId}>
                  <button
                    onClick={() => onOpenLead(l.leadId)}
                    className="w-full flex items-center justify-between gap-2 py-2 text-left hover:bg-muted/40 -mx-2 px-2 rounded-sm"
                  >
                    <div className="min-w-0">
                      <div className="text-[13px] font-medium truncate">{l.company}</div>
                      <div className="text-[11px] text-muted-foreground truncate">
                        {l.issues.slice(0, 2).map((i) => i.type.replace(/_/g, " ")).join(", ")}
                      </div>
                    </div>
                    <span className="inline-flex h-5 min-w-5 px-1.5 items-center justify-center rounded-full bg-rose-100 text-status-lost text-[10px] font-semibold shrink-0">
                      {l.issues.length}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </section>

      {/* Recently updated */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-brand" />
            Recently updated leads
          </CardTitle>
          <CardDescription>Sorted by last contact date, most recent first.</CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {recentlyUpdated.map((l) => (
              <button
                key={l.leadId}
                onClick={() => onOpenLead(l.leadId)}
                className="text-left rounded-md border border-border p-3 hover:border-brand hover:bg-brand-soft/40 transition-colors"
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-[13px] font-medium truncate">{l.company}</span>
                  <StageBadge stage={l.stageNormalized} />
                </div>
                <div className="text-[11px] text-muted-foreground flex items-center justify-between">
                  <span>{l.contactName || "—"}</span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {fmtDate(l.lastContactDate)}
                  </span>
                </div>
                {l.isOverdue && (
                  <Badge variant="outline" className="mt-2 text-status-overdue border-amber-200 bg-amber-50 text-[10px]">
                    Overdue
                  </Badge>
                )}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* AI weekly chase plan */}
      <Card className="border-brand/30">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-brand" />
                This week's chase plan
              </CardTitle>
              <CardDescription className="mt-0.5">
                AI-prioritized action list from your {overdueLeads.length} overdue + upcoming leads. Uses real data only — no invented deals.
              </CardDescription>
            </div>
            <Button onClick={generateChasePlan} disabled={chaseLoading} size="sm" className="bg-brand text-brand-foreground hover:bg-brand/90">
              {chaseLoading ? <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Writing…</> : chasePlan ? <><RefreshCw className="h-3.5 w-3.5" /> Regenerate</> : <><Sparkles className="h-3.5 w-3.5" /> Generate chase plan</>}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {chaseLoading && (
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-4/6" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          )}
          {!chaseLoading && chasePlan?.items && chasePlan.items.length > 0 && (() => {
            const doneCount = chasePlan.items.filter((it) => doneLeads.has(it.leadId)).length;
            const pct = Math.round((doneCount / chasePlan.items.length) * 100);
            return (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <p className="text-[13px] text-foreground font-medium">{chasePlan.summary}</p>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[11px]">{doneCount}/{chasePlan.items.length} done · {pct}%</Badge>
                    {doneCount > 0 && <Button variant="ghost" size="sm" className="h-6 text-[11px] px-2" onClick={onResetDone}>Reset</Button>}
                  </div>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-brand transition-all" style={{ width: `${pct}%` }} />
                </div>
                <ul className="space-y-1.5">
                  {chasePlan.items.map((it, i) => {
                    const done = doneLeads.has(it.leadId);
                    const prio = (it.priority || "").toLowerCase();
                    const prioCls = prio === "high" ? "text-status-lost border-rose-200 bg-rose-50" : prio === "medium" ? "text-status-warn border-amber-200 bg-amber-50" : "text-muted-foreground border-slate-200 bg-slate-50";
                    return (
                      <li key={it.leadId + i}>
                        <button
                          onClick={() => onOpenLead(it.leadId)}
                          className={cn(
                            "w-full text-left rounded-md border p-2.5 flex items-start gap-2.5 transition-all hover:border-brand hover:shadow-sm",
                            done ? "border-emerald-200 bg-emerald-50/50 opacity-70" : "border-border bg-card",
                          )}
                        >
                          <span className={cn("mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold", done ? "bg-status-paid text-white" : "bg-muted text-muted-foreground")}>
                            {done ? "✓" : i + 1}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className={cn("font-mono text-[11px] text-muted-foreground", done && "line-through")}>{it.leadId}</span>
                              <span className={cn("text-[13px] font-medium", done && "line-through text-muted-foreground")}>{it.company}</span>
                              <Badge variant="outline" className={cn("text-[10px] capitalize", prioCls)}>{prio || "low"}</Badge>
                              {done && <Badge variant="outline" className="text-[10px] text-status-paid border-emerald-200 bg-emerald-50">Done</Badge>}
                            </div>
                            <p className={cn("text-[12px] text-muted-foreground mt-0.5", done && "line-through")}>{it.action}</p>
                          </div>
                          {!done && <span className="text-[11px] text-brand shrink-0 mt-0.5 inline-flex items-center gap-0.5">Open <ArrowRight className="h-3 w-3" /></span>}
                        </button>
                      </li>
                    );
                  })}
                </ul>
                <div className="pt-1 text-[11px] text-muted-foreground flex items-center gap-3 flex-wrap">
                  <span>{chasePlan.overdue ?? 0} overdue · {chasePlan.upcoming ?? 0} upcoming</span>
                  {chasePlan.provider && <span>via {chasePlan.provider}{chasePlan.ms ? ` · ${chasePlan.ms}ms` : ""}</span>}
                  <span className="text-brand">Click an item → send the email → it marks done</span>
                </div>
              </div>
            );
          })()}
          {!chaseLoading && chasePlan && !chasePlan.items?.length && (chasePlan.plan || chasePlan.summary) && (
            <div className="rounded-md bg-brand-soft/40 border border-brand-muted p-3">
              <pre className="whitespace-pre-wrap font-sans text-[13px] leading-relaxed text-foreground">{chasePlan.plan || chasePlan.summary}</pre>
              {chasePlan.warning && <p className="text-[11px] text-status-warn mt-1">{chasePlan.warning}</p>}
            </div>
          )}
          {!chaseLoading && !chasePlan && (
            <p className="text-[12px] text-muted-foreground py-2">
              Click <b>Generate chase plan</b> to get a prioritized action checklist for this week. Each item links to a lead — click it, send the email, and it marks done so you can move to the next.
            </p>
          )}
          {!chaseLoading && chasePlan?.error && (
            <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-status-lost">{chasePlan.error}</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({
  label, value, sub, icon: Icon, accent, onClick,
}: {
  label: string; value: string; sub: string;
  icon: typeof Users; accent: "brand" | "overdue" | "warn" | "paid"; onClick?: () => void;
}) {
  const accentClass = {
    brand: "text-brand",
    overdue: "text-status-overdue",
    warn: "text-status-warn",
    paid: "text-status-paid",
  }[accent];
  return (
    <Card className={onClick ? "cursor-pointer hover:border-brand/50 transition-colors" : ""} >
      <button disabled={!onClick} onClick={onClick} className="text-left disabled:cursor-default w-full h-full">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
            <Icon className={`h-4 w-4 ${accentClass}`} />
          </div>
          <div className="text-xl font-semibold tabular-nums leading-tight">{value}</div>
          <div className="text-[11px] text-muted-foreground mt-0.5 truncate">{sub}</div>
        </CardContent>
      </button>
    </Card>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: color }} />
      {label}
    </span>
  );
}

function StageBreakoutTable({ summaries }: { summaries: StageSummary[] }) {
  const active = summaries.filter((s) => !s.isTerminal);
  const terminal = summaries.filter((s) => s.isTerminal);
  const totalActiveValue = active.reduce((s, x) => s + x.value, 0);
  const totalActiveCount = active.reduce((s, x) => s + x.count, 0);
  return (
    <div>
      <table className="w-full text-[13px]">
        <thead>
          <tr className="text-[11px] text-muted-foreground border-b border-border">
            <th className="text-left font-medium py-1.5 pl-4">Stage</th>
            <th className="text-right font-medium px-2">Leads</th>
            <th className="text-right font-medium py-1.5 pr-4">Value</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {active.map((s) => (
            <tr key={s.stage}>
              <td className="py-2 pl-4"><StageBadge stage={s.stage} /></td>
              <td className="text-right tabular-nums px-2">{s.count}</td>
              <td className="text-right tabular-nums py-2 pr-4">{fmtBDT(s.value)}</td>
            </tr>
          ))}
          <tr className="bg-muted/40 font-medium">
            <td className="py-2 pl-4 text-[12px]">Active pipeline</td>
            <td className="text-right tabular-nums px-2">{totalActiveCount}</td>
            <td className="text-right tabular-nums py-2 pr-4">{fmtBDT(totalActiveValue)}</td>
          </tr>
          {terminal.map((s) => (
            <tr key={s.stage} className="text-muted-foreground">
              <td className="py-2 pl-4"><StageBadge stage={s.stage} /></td>
              <td className="text-right tabular-nums px-2">{s.count}</td>
              <td className="text-right tabular-nums py-2 pr-4">{fmtBDT(s.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatChip({ label, value, tone }: { label: string; value: number; tone: "warn" | "error" | "overdue" }) {
  const cls = {
    warn: "text-status-warn bg-amber-50 border-amber-200",
    error: "text-status-lost bg-rose-50 border-rose-200",
    overdue: "text-status-overdue bg-amber-50 border-amber-200",
  }[tone];
  return (
    <div className={`rounded-md border px-3 py-2 ${cls}`}>
      <div className="text-lg font-semibold tabular-nums leading-none">{value}</div>
      <div className="text-[11px] mt-0.5">{label}</div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="py-8 text-center text-sm text-muted-foreground">{text}</div>;
}
