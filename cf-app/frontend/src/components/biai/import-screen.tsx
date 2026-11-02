import { useState, useEffect, useCallback } from "react";
import { Upload, FileText, CheckCircle2, AlertTriangle, RefreshCw, History, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { api, type ImportResponse } from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function ImportScreen({ onChanged }: { onChanged: () => void }) {
  const [csvText, setCsvText] = useState("");
  const [fileName, setFileName] = useState("upload.csv");
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<ImportResponse | null>(null);
  const [log, setLog] = useState<{ file_name: string; rows_seen: number; rows_inserted: number; rows_updated: number; rows_skipped: number; imported_at: string; note: string }[]>([]);

  const loadLog = useCallback(async () => {
    try { const r = await api.importLog(); setLog(r.log as never); } catch { /* ignore */ }
  }, []);
  useEffect(() => { loadLog(); }, [loadLog]);

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => setCsvText(String(reader.result ?? ""));
    reader.readAsText(file);
  };

  const doPreview = async () => {
    if (!csvText.trim()) { toast.error("Paste or upload a CSV first"); return; }
    setLoading(true); setPreview(null);
    try {
      const r = await api.importPreview(csvText, fileName);
      setPreview(r);
      toast("Preview ready", { description: `${r.toInsert} new · ${r.toUpdate} update · ${r.toSkip} skip` });
    } catch (e) { toast.error("Preview failed", { description: e instanceof Error ? e.message : "?" }); }
    finally { setLoading(false); }
  };

  const doCommit = async () => {
    if (!csvText.trim()) return;
    setLoading(true);
    try {
      const r = await api.importCommit(csvText, fileName);
      toast.success("Import complete", { description: `${r.inserted} inserted · ${r.updated} updated · ${r.skipped} skipped` });
      setPreview(null); setCsvText("");
      onChanged(); loadLog();
    } catch (e) { toast.error("Import failed", { description: e instanceof Error ? e.message : "?" }); }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Upload className="h-4 w-4 text-brand" /> Import / update leads from CSV</CardTitle>
          <CardDescription>
            Upload a new CSV to add leads or refresh existing ones. Rows are matched by <code className="font-mono text-[11px]">lead id</code> — existing leads get <b>updated</b>, new lead ids get <b>inserted</b>, nothing is ever deleted. Future-dated follow-ups (e.g. 5 days ahead) are stored as-is and handled correctly by the overdue engine.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 space-y-1.5">
              <Label htmlFor="csv">CSV text (paste here, or upload a file below)</Label>
              <Textarea id="csv" value={csvText} onChange={(e) => setCsvText(e.target.value)} placeholder="lead id,company,industry,contact name,…" className="min-h-[140px] font-mono text-[11px]" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="file">Upload .csv file</Label>
              <Input id="file" type="file" accept=".csv,text/csv" onChange={onFile} />
              <div className="rounded-md bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground">
                <Info className="h-3 w-3 inline mr-1" />
                Required columns: <code>lead id, company, industry, contact name, contact role, contact email, contact phone, source, stage, deal value (BDT), last contact, next follow-up, notes</code>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={doPreview} disabled={loading || !csvText.trim()}>
              {loading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />} Preview changes
            </Button>
            <Button size="sm" onClick={doCommit} disabled={loading || !csvText.trim()} className="bg-brand text-brand-foreground hover:bg-brand/90">
              <Upload className="h-3.5 w-3.5" /> Commit import
            </Button>
            {csvText && <span className="text-[11px] text-muted-foreground">{csvText.split("\n").filter((l) => l.trim()).length - 1} data rows</span>}
          </div>
        </CardContent>
      </Card>

      {preview && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Preview — what will change</CardTitle>
            <div className="flex gap-2 mt-1">
              <Badge className="bg-emerald-50 text-status-paid border-emerald-200">{preview.toInsert} new</Badge>
              <Badge className="bg-amber-50 text-status-warn border-amber-200">{preview.toUpdate} update</Badge>
              {preview.toSkip > 0 && <Badge className="bg-rose-50 text-status-lost border-rose-200">{preview.toSkip} skip</Badge>}
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {preview.rows && preview.rows.length > 0 ? (
              <div className="rounded-md border border-border overflow-auto max-h-[300px]">
                <table className="w-full text-[12px]">
                  <thead className="bg-muted/40 sticky top-0">
                    <tr><th className="text-left p-2">Lead</th><th className="text-left p-2">Company</th><th className="text-left p-2">Stage</th><th className="text-left p-2">Next follow-up</th><th className="text-left p-2">Action</th><th className="text-left p-2">Issues</th></tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {preview.rows.map((r) => (
                      <tr key={r.leadId + r.company}>
                        <td className="p-2 font-mono text-[11px]">{r.leadId}</td>
                        <td className="p-2">{r.company}</td>
                        <td className="p-2">{r.stage}</td>
                        <td className="p-2">{r.nextFollowUp || "—"}</td>
                        <td className="p-2">
                          <Badge variant="outline" className={cn("text-[10px]", r.action === "insert" ? "text-status-paid border-emerald-200 bg-emerald-50" : r.action === "update" ? "text-status-warn border-amber-200 bg-amber-50" : "text-status-lost border-rose-200 bg-rose-50")}>{r.action}</Badge>
                        </td>
                        <td className="p-2 text-status-lost">{r.issues.join(", ") || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className="text-[12px] text-muted-foreground py-4 text-center">No rows to preview.</p>}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><History className="h-4 w-4 text-muted-foreground" /> Import history</CardTitle>
          <CardDescription>Every import is logged to D1 for audit.</CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          {log.length === 0 ? <p className="text-[12px] text-muted-foreground py-3">No imports yet.</p> : (
            <ul className="divide-y divide-border text-[12px]">
              {log.map((l, i) => (
                <li key={i} className="py-2 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{l.file_name}</div>
                    <div className="text-muted-foreground text-[11px]">{l.imported_at} · {l.note}</div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Badge variant="outline" className="text-status-paid text-[10px]">{l.rows_inserted} in</Badge>
                    <Badge variant="outline" className="text-status-warn text-[10px]">{l.rows_updated} up</Badge>
                    {l.rows_skipped > 0 && <Badge variant="outline" className="text-status-lost text-[10px]">{l.rows_skipped} skip</Badge>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="bg-muted/20">
        <CardContent className="p-3 text-[11px] text-muted-foreground">
          <CheckCircle2 className="h-3.5 w-3.5 inline mr-1 text-status-paid" />
          <b>How future-dated data is handled:</b> the pipeline stores every follow-up date as-is. Overdue is computed at read time against the reference date, so a follow-up scheduled 5 days from now simply shows as "upcoming", not overdue. Drop in a fresh CSV any time — same lead ids update, new lead ids add, history is preserved in <code className="font-mono">import_log</code>.
        </CardContent>
      </Card>
    </div>
  );
}
