import { useState } from "react";
import { ShieldCheck, Loader2, Lock, User, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { api } from "@/lib/api";
import { toast } from "sonner";

const DEMO = { username: "admin", password: "biai-demo-2026" };

export function Login({ onLoggedIn }: { onLoggedIn: () => void }) {
  const [username, setUsername] = useState(DEMO.username);
  const [password, setPassword] = useState(DEMO.password);
  const [loading, setLoading] = useState(false);

  const submit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);
    try {
      await api.login(username, password);
      toast("Welcome back");
      onLoggedIn();
    } catch (err) {
      toast.error("Login failed", { description: err instanceof Error ? err.message : "Unknown error" });
    } finally {
      setLoading(false);
    }
  };

  // one-click demo: fields are pre-filled, just submit
  const demoSignIn = () => {
    setUsername(DEMO.username);
    setPassword(DEMO.password);
    submit();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-md bg-brand text-brand-foreground">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <CardTitle className="text-lg">BIAI Corporate Intelligence</CardTitle>
          <CardDescription>Sign in to view your sales pipeline</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="u">Username</Label>
              <div className="relative">
                <User className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input id="u" value={username} onChange={(e) => setUsername(e.target.value)} className="pl-8" autoFocus />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p">Password</Label>
              <div className="relative">
                <Lock className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input id="p" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-8" />
              </div>
            </div>
            <Button type="submit" disabled={loading || !username || !password} className="w-full bg-brand text-brand-foreground hover:bg-brand/90">
              {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Signing in…</> : "Sign in"}
            </Button>
          </form>

          <Button onClick={demoSignIn} disabled={loading} variant="outline" className="w-full mt-2 border-brand/40 text-brand hover:bg-brand-soft">
            <Zap className="h-4 w-4" /> Sign in as demo (one click)
          </Button>

          <div className="mt-4 rounded-md bg-muted/50 px-3 py-2 text-[11px] text-muted-foreground">
            <div className="font-medium text-foreground mb-0.5">Demo credentials (pre-filled)</div>
            username: <code className="font-mono">admin</code> · password: <code className="font-mono">biai-demo-2026</code>
            <div className="mt-1">Credential-only login (no signup yet). Flexible for growth — the users table supports multiple users + roles.</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
