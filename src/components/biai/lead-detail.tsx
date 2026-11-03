"use client";

import { useState, useEffect, useCallback } from "react";
import { Copy, Check, RefreshCw, Mail, Sparkles, AlertTriangle, Building2, Phone, Mail as MailIcon, Tag, User, Clock, Wallet, FileText, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import type { NormalizedLead } from "@/lib/data/types";
import { fmtBDT, fmtDate, ownerFor } from "./format";
import { StageBadge } from "./stage-badge";
import { cn } from "@/lib/utils";

interface Props {
  leads: NormalizedLead[];
  selected: NormalizedLead | null;
  onSelect: (id: string) => void;
}

interface EmailResult {
  subject: string;
  body: string;
  provider?: string;
  model?: string;
  ms?: number;
}

export function LeadDetail({ leads, selected, onSelect }: Props) {
  const [email, setEmail] = useState<EmailResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  // reset email state when lead changes
  useEffect(() => {
    setEmail(null);
    setError(null);
    setCopied(false);
  }, [selected?.leadId]);

  const generate = useCallback(async () => {
    if (!selected) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId: selected.leadId }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      setEmail(data);
      toast({ title: "Email drafted", description: `via ${data.provider} · ${data.model}` });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setError(msg);
      toast({ title: "Could not draft email", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [selected, toast]);

  const copyEmail = useCallback(() => {
    if (!email) return;
    const text = `Subject: ${email.subject}\n\n${email.body}`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: "Copied to clipboard" });
    });
  }, [email, toast]);

  if (!selected) {
    return (
      <div className="space-y-4">
        <LeadPicker leads={leads} onSelect={onSelect} />
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Building2 className="h-8 w-8 mx-auto mb-2 opacity-40" />
            Select a lead above to see full details and draft a follow-up email.
          </CardContent>
        </Card>
      </div>
    );
  }

  const issues = selected.issues;

  return (
    <div className="space-y-4">
      {/* Picker */}
      <LeadPicker leads={leads} selected={selected.leadId} onSelect={onSelect} />

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Left: details */}
        <div className="lg:col-span-3 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-[11px] text-muted-foreground">{selected.leadId}</span>
                    <StageBadge stage={selected.stageNormalized} />
                  </div>
                  <CardTitle className="text-lg leading-tight">{selected.company}</CardTitle>
                  <CardDescription className="mt-0.5">{selected.industry} · {selected.source}</CardDescription>
                </div>
                {selected.dealValue > 0 && (
                  <div className="text-right shrink-0">
                    <div className="text-[11px] text-muted-foreground uppercase tracking-wide">Deal value</div>
                    <div className="text-lg font-semibold tabular-nums">{fmtBDT(selected.dealValue)}</div>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Contact */}
              <div>
                <h4 className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-2">Contact</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[13px]">
                  <DetailRow icon={User} label="Name" value={selected.contactName} missing={!selected.contactName} />
                  <DetailRow icon={Tag} label="Role" value={selected.contactRole} missing={!selected.contactRole} />
                  <DetailRow icon={MailIcon} label="Email" value={selected.contactEmail} missing={!selected.contactEmail} mono />
                  <DetailRow icon={Phone} label="Phone" value={selected.contactPhone} missing={!selected.contactPhone} mono />
                </div>
              </div>

              {/* Timeline */}
              <div>
                <h4 className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-2">Timeline</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[13px]">
                  <DetailRow icon={Clock} label="Last contact" value={selected.lastContactDate ? fmtDate(selected.lastContactDate) : ""} missing={!selected.lastContactDate} />
                  <DetailRow icon={Clock} label="Next follow-up" value={selected.nextFollowUpDate ? fmtDate(selected.nextFollowUpDate) : ""} missing={!selected.nextFollowUpDate} highlight={selected.isOverdue ? "overdue" : undefined} />
                  <DetailRow icon={Wallet} label="Owner" value={ownerFor(selected)} />
                </div>
                {selected.isOverdue && (
                  <div className="mt-2 rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-[12px] text-status-overdue flex items-center gap-2">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Follow-up overdue — due {fmtDate(selected.nextFollowUpDate)}, before reference date.
                  </div>
                )}
              </div>

              {/* Notes */}
              <div>
                <h4 className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-2">Notes</h4>
                <p className="text-[13px] leading-relaxed bg-muted/40 rounded-md p-3">{selected.notes || "No notes on file."}</p>
              </div>
            </CardContent>
          </Card>

          {/* Data quality warnings */}
          {issues.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-status-lost" />
                  Data-quality warnings ({issues.length})
                </CardTitle>
                <CardDescription>Raw imported values are preserved; nothing is auto-corrected.</CardDescription>
              </CardHeader>
              <CardContent className="pt-0 space-y-2">
                {issues.map((iss, i) => (
                  <div
                    key={i}
                    className={cn(
                      "rounded-md border px-3 py-2 text-[12px]",
                      iss.severity === "error" && "border-rose-200 bg-rose-50 text-status-lost",
                      iss.severity === "warning" && "border-amber-200 bg-amber-50 text-status-overdue",
                      iss.severity === "info" && "border-slate-200 bg-slate-50 text-muted-foreground",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium capitalize">{iss.type.replace(/_/g, " ")}</span>
                      {iss.field && <Badge variant="outline" className="text-[10px]">{iss.field}</Badge>}
                    </div>
                    <p className="mt-0.5">{iss.message}</p>
                  </div>
                ))}
                {selected.duplicateLinks.length > 0 && (
                  <div className="text-[12px] text-muted-foreground pt-1">
                    Linked duplicate records:{" "}
                    {selected.duplicateLinks.map((d) => (
                      <button
                        key={d.groupKey}
                        onClick={() => onSelect(d.partnerIds[0])}
                        className="font-medium text-brand hover:underline mr-2"
                      >
                        {d.partnerIds[0]} <ChevronRight className="inline h-3 w-3" />
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: AI email assistant */}
        <div className="lg:col-span-2">
          <Card className="lg:sticky lg:top-[124px]">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-brand" />
                AI Follow-up Email
              </CardTitle>
              <CardDescription>
                Drafts a short, polite English follow-up using this lead&apos;s real notes. Never invents meetings or missing contact details.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                onClick={generate}
                disabled={loading}
                className="w-full bg-brand text-brand-foreground hover:bg-brand/90"
              >
                {loading ? (
                  <><RefreshCw className="h-4 w-4 animate-spin" /> Drafting…</>
                ) : email ? (
                  <><RefreshCw className="h-4 w-4" /> Regenerate email</>
                ) : (
                  <><Mail className="h-4 w-4" /> Generate follow-up email</>
                )}
              </Button>

              {loading && (
                <div className="space-y-2">
                  <Skeleton className="h-5 w-2/3" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-4/5" />
                </div>
              )}

              {error && !loading && (
                <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-status-lost">
                  <div className="font-medium mb-0.5">AI unavailable</div>
                  {error}
                  <div className="mt-1 text-muted-foreground">The rest of the app keeps working. Try again, or ask the AI Analyst a question instead.</div>
                </div>
              )}

              {email && !loading && (
                <div className="space-y-2">
                  <div>
                    <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Subject</label>
                    <div className="text-[13px] font-medium mt-0.5 rounded-md border border-border bg-muted/30 px-3 py-2">{email.subject}</div>
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Body</label>
                    <Textarea
                      value={email.body}
                      readOnly
                      className="mt-0.5 text-[13px] min-h-[180px] resize-y bg-muted/30"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] text-muted-foreground">
                      {email.provider && `via ${email.provider} · ${email.model}`}
                      {email.ms && ` · ${email.ms}ms`}
                    </span>
                    <Button variant="outline" size="sm" onClick={copyEmail}>
                      {copied ? <><Check className="h-3.5 w-3.5" /> Copied</> : <><Copy className="h-3.5 w-3.5" /> Copy email</>}
                    </Button>
                  </div>
                </div>
              )}

              {!email && !loading && !error && (
                <p className="text-[11px] text-muted-foreground text-center py-2">
                  <FileText className="h-3.5 w-3.5 inline mr-1" />
                  Uses the lead&apos;s actual notes, stage and contact details. Missing fields are respected, never guessed.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function DetailRow({
  icon: Icon, label, value, missing, mono, highlight,
}: {
  icon: typeof User; label: string; value: string; missing?: boolean; mono?: boolean; highlight?: "overdue";
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
      <div className="min-w-0">
        <div className="text-[11px] text-muted-foreground">{label}</div>
        {missing || !value ? (
          <div className="text-[13px] text-status-lost">— missing —</div>
        ) : (
          <div className={cn("text-[13px] break-all", mono && "font-mono text-[12px]", highlight === "overdue" && "text-status-overdue font-medium")}>
            {value}
          </div>
        )}
      </div>
    </div>
  );
}

function LeadPicker({ leads, selected, onSelect }: { leads: NormalizedLead[]; selected?: string; onSelect: (id: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[12px] text-muted-foreground whitespace-nowrap">Viewing lead:</span>
      <Select value={selected ?? ""} onValueChange={onSelect}>
        <SelectTrigger className="h-9 w-full sm:w-[420px]">
          <SelectValue placeholder="Select a lead…" />
        </SelectTrigger>
        <SelectContent className="max-h-[320px]">
          {leads.map((l) => (
            <SelectItem key={l.leadId} value={l.leadId}>
              <span className="font-mono text-[11px] text-muted-foreground mr-2">{l.leadId}</span>
              {l.company}
              <span className="text-muted-foreground ml-2">· {l.stageNormalized}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
