import { AppShell } from "@/components/biai/app-shell";
import { loadData } from "@/lib/data/pipeline";

// Server component: loads the normalized dataset once at request time and
// passes it to the client shell. The CSV is read from data/raw/ on disk.
export default function Home() {
  const { leads, audit } = loadData();
  return <AppShell leads={leads} audit={audit} />;
}
