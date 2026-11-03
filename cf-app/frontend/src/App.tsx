import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import type { AuditSummary, NormalizedLead } from "@/lib/types";
import { AppShell } from "@/components/biai/app-shell";
import { Login } from "@/components/biai/login";
import { Landing } from "@/components/biai/landing";
import { Toaster } from "@/components/ui/sonner";
import { Loader2, ShieldCheck } from "lucide-react";

interface User { sub: string; name: string; role: string }

// Path-based routing without react-router:
//   "/"      → marketing landing page
//   "/app"   → the application (login → dashboard)
// The Cloudflare Worker serves index.html for every path (SPA fallback),
// so client-side path switching works without extra config.
function usePath(): string {
  const [path, setPath] = useState(() =>
    typeof window !== "undefined" ? window.location.pathname : "/"
  );
  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  return path;
}

export default function App() {
  const path = usePath();
  const isApp = path === "/app" || path.startsWith("/app/");

  // Landing page is public — no auth, no data fetch
  if (!isApp) return <Landing />;

  return <AppInner />;
}

function AppInner() {
  const [booting, setBooting] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [leads, setLeads] = useState<NormalizedLead[]>([]);
  const [audit, setAudit] = useState<AuditSummary | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const checkSession = useCallback(async () => {
    try {
      const me = await api.me();
      if (me.user) {
        setUser({ sub: me.user.sub, name: me.user.name, role: me.user.role });
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setBooting(false);
    }
  }, []);

  const loadData = useCallback(async () => {
    setLoadError(null);
    try {
      const r = await api.audit();
      setLeads(r.leads);
      setAudit(r.audit);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load data");
    }
  }, []);

  useEffect(() => { checkSession(); }, [checkSession]);
  useEffect(() => { if (user) loadData(); }, [user, loadData]);

  if (booting) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-brand" />
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <Login onLoggedIn={checkSession} />
        <Toaster />
      </>
    );
  }

  if (loadError || !audit) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3">
        <ShieldCheck className="h-8 w-8 text-brand" />
        <p className="text-sm text-muted-foreground">{loadError ?? "Loading your pipeline…"}</p>
        <button onClick={loadData} className="text-brand text-sm underline">Retry</button>
      </div>
    );
  }

  return (
    <>
      <AppShell
        leads={leads}
        audit={audit}
        user={user}
        onRefresh={loadData}
        onLogout={async () => { try { await api.logout(); } catch {} setUser(null); }}
      />
      <Toaster />
    </>
  );
}
