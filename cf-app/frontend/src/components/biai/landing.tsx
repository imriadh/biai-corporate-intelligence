import { ShieldCheck, Sparkles, ArrowRight, Mail, MessageSquare, AlertTriangle, Layers, Database, Cloud, Zap, CheckCircle2, TrendingUp, Users, Wallet, Clock, FileWarning, Github, ExternalLink, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

const FEATURES = [
  { icon: BarChart3, title: "Executive Dashboard", desc: "KPI cards, pipeline chart, stage breakdown, overdue + data-quality summaries — every number computed live from real data.", color: "text-brand" },
  { icon: Users, title: "Leads Pipeline", desc: "Search, filter by stage/industry/owner, sort by value or follow-up. Overdue, missing-contact and duplicate flags on every row.", color: "text-status-warn" },
  { icon: Mail, title: "AI Follow-up Emails", desc: "One click drafts a personalized, properly-structured email from the lead's real notes. Send via Gmail opens compose pre-filled — no copy-paste.", color: "text-brand" },
  { icon: FileWarning, title: "Data Quality Center", desc: "Catches exact + potential duplicates, missing contacts, date-order violations and overdue follow-ups. Safe review/merge workflow, nothing auto-deleted.", color: "text-status-lost" },
  { icon: MessageSquare, title: "AI Sales Analyst", desc: "Ask plain-English questions. Deterministic math for common questions; AI-assisted structured query parser for flexible ones. The model never invents numbers.", color: "text-brand" },
  { icon: Zap, title: "Weekly Chase Plan", desc: "AI reads your overdue + upcoming leads and writes a prioritized action list for the week. Built from real data only.", color: "text-status-warn" },
];

const STATS = [
  { value: "25", label: "leads tracked" },
  { value: "9", label: "overdue caught" },
  { value: "2", label: "duplicate pairs flagged" },
  { value: "1", label: "date error found" },
];

const STACK = [
  { name: "Cloudflare Workers", icon: Cloud },
  { name: "D1 (SQLite)", icon: Database },
  { name: "Workers AI", icon: Sparkles },
  { name: "Hono", icon: Zap },
  { name: "React + Vite", icon: BarChart3 },
  { name: "TypeScript", icon: CheckCircle2 },
];

export function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-brand text-brand-foreground">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <span className="font-semibold text-[15px] tracking-tight">BIAI Corporate Intelligence</span>
          </div>
          <div className="flex items-center gap-2">
            <a href="https://github.com/imriadh/biai-corporate-intelligence" target="_blank" rel="noopener noreferrer">
              <Button variant="ghost" size="sm" className="h-8"><Github className="h-4 w-4" /> <span className="hidden sm:inline">GitHub</span></Button>
            </a>
            <a href="/app"><Button size="sm" className="h-8 bg-brand text-brand-foreground hover:bg-brand/90">Try the demo <ArrowRight className="h-3.5 w-3.5" /></Button></a>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-soft/60 via-background to-background" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-brand/10 rounded-full blur-3xl opacity-40" />
        <div className="relative mx-auto max-w-6xl px-4 sm:px-6 py-20 sm:py-28 text-center">
          <Badge variant="outline" className="mb-5 bg-brand-soft/60 border-brand-muted text-brand">
            <Sparkles className="h-3 w-3 mr-1" /> AI-powered sales pipeline · live on Cloudflare
          </Badge>
          <h1 className="text-4xl sm:text-6xl font-bold tracking-tight leading-[1.05] mb-5">
            Every lead.<br />Every follow-up.<br />
            <span className="bg-gradient-to-r from-brand to-emerald-600 bg-clip-text text-transparent">One clear pipeline.</span>
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-8 leading-relaxed">
            A corporate sales intelligence CRM that finds your stuck deals, drafts your follow-up emails, and answers your pipeline questions in plain English — so nothing slips through the cracks.
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <a href="/app"><Button size="lg" className="bg-brand text-brand-foreground hover:bg-brand/90 h-12 px-6 text-base">Open the app <ArrowRight className="h-4 w-4" /></Button></a>
            <a href="https://github.com/imriadh/biai-corporate-intelligence" target="_blank" rel="noopener noreferrer">
              <Button size="lg" variant="outline" className="h-12 px-6 text-base"><Github className="h-4 w-4" /> View source</Button>
            </a>
          </div>
          <p className="text-[13px] text-muted-foreground mt-4">
            Demo login: <code className="font-mono bg-muted px-1.5 py-0.5 rounded">admin</code> / <code className="font-mono bg-muted px-1.5 py-0.5 rounded">biai-demo-2026</code> · one-click sign-in inside
          </p>
        </div>

        {/* Stats strip */}
        <div className="relative mx-auto max-w-5xl px-4 sm:px-6 pb-16">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {STATS.map((s) => (
              <div key={s.label} className="rounded-xl border border-border bg-card p-5 text-center">
                <div className="text-3xl font-bold tabular-nums text-brand">{s.value}</div>
                <div className="text-[12px] text-muted-foreground mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Problem */}
      <section className="mx-auto max-w-5xl px-4 sm:px-6 py-16">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-3">Sales leads don't fail. They get forgotten.</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">Leads sit in messages and spreadsheets. Some have no owner, follow-ups are overdue, duplicates create confusion, and nobody can see which deal is stuck. BIAI Corporate Intelligence fixes all of it.</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { p: "Follow-ups are forgotten", s: "Overdue follow-ups highlighted everywhere — dashboard, pipeline, data-quality center." },
            { p: "Some leads have missing info", s: "Missing contacts flagged per field, never guessed or auto-filled." },
            { p: "Duplicate companies confuse everyone", s: "Exact + potential duplicates detected, with a safe review/merge workflow." },
            { p: "Managers can't see stuck deals", s: "Pipeline chart + stage breakdown show exactly where deals are piling up." },
            { p: "Writing follow-up emails wastes time", s: "AI drafts a personalized email from the real notes — send via Gmail in one click." },
            { p: "Can't answer pipeline questions fast", s: "Ask in plain English, get exact answers from real data in seconds." },
          ].map((item) => (
            <Card key={item.p} className="border-border hover:border-brand/40 transition-colors">
              <CardContent className="p-5">
                <AlertTriangle className="h-5 w-5 text-status-warn mb-2" />
                <div className="font-medium text-[14px] mb-1">{item.p}</div>
                <div className="text-[13px] text-muted-foreground leading-relaxed">{item.s}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="bg-muted/30 border-y border-border py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="text-center mb-12">
            <Badge variant="outline" className="mb-3">Six screens, one pipeline</Badge>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-3">Everything a sales manager needs</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">Built small and focused — 3 to 5 screens is what the brief asked for. Each one earns its place.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <Card key={f.title} className="group hover:border-brand/50 hover:shadow-md transition-all">
                  <CardContent className="p-5">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-soft mb-3 group-hover:bg-brand group-hover:text-brand-foreground transition-colors">
                      <Icon className={`h-5 w-5 ${f.color}`} />
                    </div>
                    <div className="font-semibold text-[15px] mb-1">{f.title}</div>
                    <div className="text-[13px] text-muted-foreground leading-relaxed">{f.desc}</div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* AI section */}
      <section className="mx-auto max-w-5xl px-4 sm:px-6 py-16">
        <div className="grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <Badge variant="outline" className="mb-3 bg-brand-soft/60 border-brand-muted text-brand"><Sparkles className="h-3 w-3 mr-1" /> Smart AI integration</Badge>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-4">AI that helps, never invents</h2>
            <div className="space-y-4">
              {[
                { icon: Mail, t: "Follow-up email assistant", d: "Sends the lead's real notes, stage and contact details to the model. The system prompt forbids inventing meetings, dates, or missing contacts. Returns a properly-structured email — greeting, body, next step, sign-off — with a one-click Send via Gmail button." },
                { icon: MessageSquare, t: "Natural-language analyst", d: "Common questions (overdue, totals, counts) answered deterministically with exact math — no AI, no hallucination. Flexible questions go to the AI, which returns a structured query spec executed locally. The model never returns records or totals." },
                { icon: TrendingUp, t: "Weekly chase plan", d: "AI reads your overdue + upcoming leads and writes a prioritized, plain-English action list. 'Start with Meghna Pharma — proposal since Oct 27, budget decision this week.'" },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.t} className="flex gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-md bg-brand-soft text-brand shrink-0">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="font-medium text-[14px]">{item.t}</div>
                      <div className="text-[13px] text-muted-foreground leading-relaxed mt-0.5">{item.d}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-brand/10 to-emerald-500/10 rounded-2xl blur-2xl" />
            <Card className="relative shadow-xl">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-3 pb-3 border-b border-border">
                  <Sparkles className="h-4 w-4 text-brand" />
                  <span className="font-medium text-[13px]">AI Sales Analyst</span>
                  <Badge variant="outline" className="ml-auto text-[10px] bg-brand-soft/60 border-brand-muted text-brand">deterministic</Badge>
                </div>
                <div className="rounded-md bg-muted/40 px-3 py-2 text-[12px] mb-3">
                  <span className="text-muted-foreground">Q:</span> What is the total value in Proposal stage?
                </div>
                <div className="rounded-md bg-brand-soft/40 border border-brand-muted px-3 py-2 text-[13px] font-medium">
                  3 leads in Proposal stage, total value 1,620,000 BDT.
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-md border border-border p-2"><div className="text-base font-bold tabular-nums">3</div><div className="text-[10px] text-muted-foreground">leads</div></div>
                  <div className="rounded-md border border-border p-2"><div className="text-base font-bold tabular-nums">1.62M</div><div className="text-[10px] text-muted-foreground">BDT</div></div>
                  <div className="rounded-md border border-border p-2"><div className="text-base font-bold tabular-nums">0ms</div><div className="text-[10px] text-muted-foreground">AI time</div></div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Data quality */}
      <section className="bg-muted/30 border-y border-border py-16">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="text-center mb-10">
            <Badge variant="outline" className="mb-3"><Layers className="h-3 w-3 mr-1" /> Data engineering</Badge>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-3">Messy data, cleaned up as you build</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">The sample CSV has mistakes on purpose. The pipeline catches them all — and now fixes them too: merge or delete duplicates, one-click cleaning, and every change is undoable.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { icon: Layers, t: "Duplicates", v: "1 exact + 1 potential", d: "L01/L23 same company; L02/L03 same contact, different name" },
              { icon: Users, t: "Missing contacts", v: "2 records", d: "L06 missing phone; L24 missing name + email" },
              { icon: Clock, t: "Date errors", v: "1 violation", d: "L25 follow-up before last contact" },
              { icon: AlertTriangle, t: "Overdue", v: "9 follow-ups", d: "Due before 1 Nov 2026, excluding Paid/Lost" },
            ].map((s) => {
              const Icon = s.icon;
              return (
                <Card key={s.t}>
                  <CardContent className="p-4">
                    <Icon className="h-5 w-5 text-status-warn mb-2" />
                    <div className="text-lg font-bold tabular-nums">{s.v}</div>
                    <div className="text-[12px] font-medium">{s.t}</div>
                    <div className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{s.d}</div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Stack */}
      <section className="mx-auto max-w-5xl px-4 sm:px-6 py-16 text-center">
        <Badge variant="outline" className="mb-3">Built on a modern serverless stack</Badge>
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-3">Scales to zero. Costs nothing to demo.</h2>
        <p className="text-muted-foreground max-w-2xl mx-auto mb-8">Single Cloudflare Worker serves the API and the frontend. D1 for persistence. Workers AI for the free native model. No external dependencies to manage.</p>
        <div className="flex flex-wrap justify-center gap-2">
          {STACK.map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.name} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-[13px]">
                <Icon className="h-3.5 w-3.5 text-brand" /> {s.name}
              </div>
            );
          })}
        </div>
      </section>

      {/* Final CTA */}
      <section className="mx-auto max-w-5xl px-4 sm:px-6 pb-20">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand to-emerald-700 p-10 sm:p-14 text-center text-white">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
          <ShieldCheck className="h-10 w-10 mx-auto mb-4 relative" />
          <h2 className="text-2xl sm:text-3xl font-bold mb-3 relative">See it working on real data</h2>
          <p className="text-white/80 max-w-xl mx-auto mb-6 relative">25 fictional corporate leads, messy on purpose. Login with one click, explore every screen, draft an email, ask the analyst a question.</p>
          <a href="/app"><Button size="lg" variant="secondary" className="h-12 px-6 text-base relative">Open the app <ArrowRight className="h-4 w-4" /></Button></a>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-muted/30">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-[13px] text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-brand text-brand-foreground"><ShieldCheck className="h-4 w-4" /></div>
            <span>BIAI Corporate Intelligence — prototype</span>
          </div>
          <div className="flex items-center gap-4">
            <a href="/app" className="hover:text-foreground">Open app</a>
            <a href="https://github.com/imriadh/biai-corporate-intelligence" target="_blank" rel="noopener noreferrer" className="hover:text-foreground inline-flex items-center gap-1">GitHub <ExternalLink className="h-3 w-3" /></a>
            <span className="hidden sm:inline">Cloudflare Workers + D1 + Workers AI</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
