"use client";

import { useMemo, useState } from "react";
import { Search, ArrowUpDown, AlertTriangle, Copy, PhoneOff, UserX, CalendarX, Layers, Download } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { NormalizedLead, Stage } from "@/lib/types";
import { ALL_STAGES } from "@/lib/types";
import { fmtBDT, fmtDate, ownerFor, ALL_OWNERS } from "./format";
import { StageBadge } from "./stage-badge";
import { cn } from "@/lib/utils";

interface Props {
  leads: NormalizedLead[];
  onOpenLead: (id: string) => void;
}

type SortKey = "value" | "followup" | "company" | "default";

export function PipelineTable({ leads, onOpenLead }: Props) {
  const [search, setSearch] = useState("");
  const [stage, setStage] = useState<string>("all");
  const [industry, setIndustry] = useState<string>("all");
  const [owner, setOwner] = useState<string>("all");
  const [onlyIssues, setOnlyIssues] = useState(false);
  const [sort, setSort] = useState<SortKey>("default");

  const industries = useMemo(() => {
    const set = new Set(leads.map((l) => l.industry).filter(Boolean));
    return Array.from(set).sort();
  }, [leads]);

  const filtered = useMemo(() => {
    let out = leads;
    const q = search.trim().toLowerCase();
    if (q) {
      out = out.filter((l) =>
        l.company.toLowerCase().includes(q) ||
        l.contactName.toLowerCase().includes(q) ||
        l.leadId.toLowerCase().includes(q) ||
        l.contactEmail.toLowerCase().includes(q),
      );
    }
    if (stage !== "all") out = out.filter((l) => l.stageNormalized === (stage as Stage));
    if (industry !== "all") out = out.filter((l) => l.industry === industry);
    if (owner !== "all") out = out.filter((l) => ownerFor(l) === owner);
    if (onlyIssues) out = out.filter((l) => l.hasIssues);

    const sorted = [...out];
    if (sort === "value") sorted.sort((a, b) => b.dealValue - a.dealValue);
    else if (sort === "followup") sorted.sort((a, b) => (a.nextFollowUpDate ?? "9999").localeCompare(b.nextFollowUpDate ?? "9999"));
    else if (sort === "company") sorted.sort((a, b) => a.company.localeCompare(b.company));
    return sorted;
  }, [leads, search, stage, industry, owner, onlyIssues, sort]);

  const activePipelineValue = filtered.reduce((s, l) => s + l.dealValue, 0);

  const exportCSV = async () => {
    try {
      const res = await fetch("/api/leads/export.csv", { credentials: "include" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "biai-pipeline-cleaned.csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert("Export failed: " + (e instanceof Error ? e.message : "?"));
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="rounded-lg border border-border bg-card p-3 space-y-3">
        <div className="flex flex-col lg:flex-row gap-2 lg:items-center">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search company, contact, email or lead ID…"
              className="pl-8 h-9"
            />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:flex gap-2">
            <Select value={stage} onValueChange={setStage}>
              <SelectTrigger className="h-9 w-full lg:w-[140px]"><SelectValue placeholder="Stage" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All stages</SelectItem>
                {ALL_STAGES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={industry} onValueChange={setIndustry}>
              <SelectTrigger className="h-9 w-full lg:w-[140px]"><SelectValue placeholder="Industry" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All industries</SelectItem>
                {industries.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={owner} onValueChange={setOwner}>
              <SelectTrigger className="h-9 w-full lg:w-[140px]"><SelectValue placeholder="Owner" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All owners</SelectItem>
                {ALL_OWNERS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button
              variant={onlyIssues ? "default" : "outline"}
              size="sm"
              className="h-9"
              onClick={() => setOnlyIssues((v) => !v)}
            >
              <AlertTriangle className="h-3.5 w-3.5" /> Issues only
            </Button>
            <Button variant="outline" size="sm" className="h-9" onClick={exportCSV}>
              <Download className="h-3.5 w-3.5" /> Export CSV
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 flex-wrap text-[12px]">
          <div className="flex items-center gap-2 text-muted-foreground">
            <span><span className="font-semibold text-foreground tabular-nums">{filtered.length}</span> of {leads.length} leads</span>
            <span className="text-border">·</span>
            <span>filtered value <span className="font-medium text-foreground tabular-nums">{fmtBDT(activePipelineValue)}</span></span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground mr-1">Sort by:</span>
            {([
              ["default", "Default"],
              ["value", "Deal value"],
              ["followup", "Follow-up"],
              ["company", "Company"],
            ] as const).map(([key, label]) => (
              <Button
                key={key}
                variant={sort === key ? "secondary" : "ghost"}
                size="sm"
                className="h-7 px-2 text-[12px]"
                onClick={() => setSort(key)}
              >
                {label}{sort === key && <ArrowUpDown className="h-3 w-3 ml-1" />}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[60px]">Lead</TableHead>
                <TableHead>Company / Contact</TableHead>
                <TableHead className="hidden md:table-cell">Industry</TableHead>
                <TableHead className="text-right">Value</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead className="hidden lg:table-cell">Owner</TableHead>
                <TableHead className="hidden md:table-cell">Last contact</TableHead>
                <TableHead>Next follow-up</TableHead>
                <TableHead className="text-center">Flags</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-10">
                    No leads match these filters.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((l) => (
                  <TableRow
                    key={l.leadId}
                    onClick={() => onOpenLead(l.leadId)}
                    className="cursor-pointer hover:bg-muted/40 group"
                  >
                    <TableCell className="font-mono text-[11px] text-muted-foreground">{l.leadId}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-[13px] truncate max-w-[200px]">{l.company}</span>
                        {l.duplicateLinks.length > 0 && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-amber-100 text-status-warn">
                                <Copy className="h-2.5 w-2.5" />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent className="text-xs max-w-[220px]">
                              {l.duplicateLinks.map((d) => <div key={d.groupKey}>{d.kind === "exact" ? "Exact" : "Potential"} dup of {d.partnerIds.join(", ")}</div>)}
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                      <div className="text-[11px] text-muted-foreground truncate max-w-[220px]">
                        {l.contactName || <span className="text-status-lost inline-flex items-center gap-1"><UserX className="h-3 w-3" />no contact name</span>}
                        {l.contactEmail || l.contactPhone ? ` · ${l.contactEmail || l.contactPhone}` : ""}
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-[12px] text-muted-foreground">{l.industry || "—"}</TableCell>
                    <TableCell className="text-right tabular-nums text-[12px]">
                      {l.dealValue > 0 ? fmtBDT(l.dealValue) : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell><StageBadge stage={l.stageNormalized} /></TableCell>
                    <TableCell className="hidden lg:table-cell text-[12px]">{ownerFor(l)}</TableCell>
                    <TableCell className="hidden md:table-cell text-[12px] text-muted-foreground">{fmtDate(l.lastContactDate)}</TableCell>
                    <TableCell className="text-[12px]">
                      {l.nextFollowUpDate ? (
                        <span className={cn("inline-flex items-center gap-1", l.isOverdue && "text-status-overdue font-medium")}>
                          {l.isOverdue && <AlertTriangle className="h-3 w-3" />}
                          {fmtDate(l.nextFollowUpDate)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="inline-flex items-center gap-1">
                        {l.isOverdue && <FlagIcon icon={AlertTriangle} tone="overdue" label="Overdue" />}
                        {l.missingFields.length > 0 && <FlagIcon icon={l.missingFields.includes("contact email") || l.missingFields.includes("contact phone") ? PhoneOff : UserX} tone="error" label={`Missing: ${l.missingFields.join(", ")}`} />}
                        {(() => {
                          const dov = l.issues.find((i) => i.type === "date_order_violation");
                          return dov ? <FlagIcon icon={CalendarX} tone="error" label={dov.message} /> : null;
                        })()}
                        {l.issues.some((i) => i.type === "duplicate_exact" || i.type === "duplicate_potential") && <FlagIcon icon={Layers} tone="warn" label="Duplicate" />}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Click any row to open full lead details and the AI email assistant. Flags: <span className="text-status-overdue">●</span> overdue · <span className="text-status-lost">●</span> missing/date error · <span className="text-status-warn">●</span> duplicate.
      </p>
    </div>
  );
}

function FlagIcon({ icon: Icon, tone, label }: { icon: typeof AlertTriangle; tone: "overdue" | "error" | "warn"; label: string }) {
  const cls = {
    overdue: "text-status-overdue",
    error: "text-status-lost",
    warn: "text-status-warn",
  }[tone];
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={cn("inline-flex", cls)}><Icon className="h-3.5 w-3.5" /></span>
      </TooltipTrigger>
      <TooltipContent className="text-xs max-w-[260px]">{label}</TooltipContent>
    </Tooltip>
  );
}
