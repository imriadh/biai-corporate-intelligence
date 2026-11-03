"use client";

import { useState, useCallback, useMemo } from "react";
import { LayoutDashboard, Filter, FileWarning, Sparkles, Mail, Building2, CalendarClock, ShieldCheck, Upload, LogOut, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { AuditSummary, NormalizedLead } from "@/lib/types";
import { Dashboard } from "./dashboard";
import { PipelineTable } from "./pipeline-table";
import { LeadDetail } from "./lead-detail";
import { DataQuality } from "./data-quality";
import { AiAnalyst } from "./ai-analyst";
import { ImportScreen } from "./import-screen";

export type View = "dashboard" | "pipeline" | "lead" | "data-quality" | "analyst" | "import";

const NAV: { id: View; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "pipeline", label: "Pipeline", icon: Filter },
  { id: "lead", label: "Lead Details", icon: Building2 },
  { id: "data-quality", label: "Data Quality", icon: FileWarning },
  { id: "analyst", label: "AI Analyst", icon: Sparkles },
  { id: "import", label: "Import", icon: Upload },
];

interface AppShellProps {
  leads: NormalizedLead[];
  audit: AuditSummary;
  user: { sub: string; name: string; role: string };
  onRefresh: () => void;
  onLogout: () => void;
}

export function AppShell({ leads, audit, user, onRefresh, onLogout }: AppShellProps) {
  const [view, setView] = useState<View>("dashboard");
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);

  const selectedLead = useMemo(
    () => leads.find((l) => l.leadId === selectedLeadId) ?? null,
    [leads, selectedLeadId],
  );

  const openLead = useCallback((leadId: string) => {
    setSelectedLeadId(leadId);
    setView("lead");
  }, []);

  const flaggedCount = audit.flaggedLeadIds.length;
  const overdueCount = audit.overdueLeadIds.length;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6">
          <div className="flex h-14 items-center justify-between gap-4">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-brand text-brand-foreground shrink-0">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <span className="font-semibold text-[15px] tracking-tight truncate block">BIAI Corporate Intelligence</span>
                <p className="text-[11px] text-muted-foreground leading-none hidden sm:block">Every lead. Every follow-up. One clear pipeline.</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="hidden md:flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <CalendarClock className="h-3.5 w-3.5" />
                <span>Ref: <span className="font-medium text-foreground">{audit.referenceDate}</span></span>
              </div>
              <Button variant="ghost" size="sm" className="h-8 px-2" onClick={onRefresh} title="Refresh data">
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
              {overdueCount > 0 && <Badge variant="outline" className="hidden sm:inline-flex text-status-overdue border-amber-200 bg-amber-50">{overdueCount} overdue</Badge>}
              <div className="flex items-center gap-1.5 pl-2 border-l border-border">
                <span className="text-[12px] text-muted-foreground hidden sm:inline">{user.name}</span>
                <Button variant="ghost" size="sm" className="h-8 px-2" onClick={onLogout} title="Sign out">
                  <LogOut className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
          <nav className="flex items-center gap-0.5 -mb-px overflow-x-auto">
            {NAV.map((item) => {
              const Icon = item.icon;
              const active = view === item.id;
              const showDot = item.id === "data-quality" && flaggedCount > 0;
              return (
                <button key={item.id} onClick={() => setView(item.id)}
                  className={cn("inline-flex items-center gap-1.5 px-3 py-2 text-[13px] font-medium border-b-2 transition-colors whitespace-nowrap",
                    active ? "border-brand text-brand" : "border-transparent text-muted-foreground hover:text-foreground hover:border-border")}
                  aria-current={active ? "page" : undefined}>
                  <Icon className="h-4 w-4" />
                  {item.label}
                  {showDot && <span className="ml-0.5 inline-flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-rose-100 text-status-lost text-[10px] font-semibold">{flaggedCount}</span>}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="flex-1 mx-auto max-w-[1400px] w-full px-4 sm:px-6 py-6">
        {view === "dashboard" && <Dashboard leads={leads} audit={audit} onOpenLead={openLead} onGoTo={setView} />}
        {view === "pipeline" && <PipelineTable leads={leads} onOpenLead={openLead} />}
        {view === "lead" && <LeadDetail leads={leads} selected={selectedLead} onSelect={setSelectedLeadId} onRefresh={onRefresh} />}
        {view === "data-quality" && <DataQuality leads={leads} audit={audit} onOpenLead={openLead} />}
        {view === "analyst" && <AiAnalyst leads={leads} audit={audit} onOpenLead={openLead} />}
        {view === "import" && <ImportScreen onChanged={onRefresh} />}
      </main>

      <footer className="mt-auto border-t border-border bg-muted/30">
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6 py-3 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-muted-foreground">
          <span>BIAI Corporate Intelligence · Cloudflare Workers + D1 · {leads.length} leads</span>
          <span className="flex items-center gap-1.5"><Mail className="h-3 w-3" />AI follow-up emails + NL queries · signed in as {user.name}</span>
        </div>
      </footer>
    </div>
  );
}
