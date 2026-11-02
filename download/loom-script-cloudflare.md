# BIAI Corporate Intelligence — Loom Demo Script (Cloudflare edition, ~5 min)

**Live URL:** https://biai-corporate-intelligence.imriad.workers.dev
**Login:** `admin` / `biai-demo-2026`

---

**[0:00–0:25] Intro + the problem + what's different**

> "This is the Cloudflare deployment of BIAI Corporate Intelligence — my Round 2 submission. In the first version I built the full app on Next.js; for this deployment I rebuilt it on Cloudflare Workers with D1 for persistence, added login, a one-click Gmail send for AI emails, and a CSV import flow. Same data engine, same 25 BIAI leads, now running on serverless infrastructure that scales to zero and costs nothing to demo."

**[0:25–0:45] Login (the new auth layer)**

> "The app now requires login so other business owners can't see my pipeline. I sign in with the demo credential — admin, biai-demo-2026. The session is a JWT in an httpOnly cookie, so the token is never readable by client JavaScript. The users table supports multiple roles for when this grows beyond a personal demo."

**[0:45–1:30] Dashboard + D1 persistence**

> "Dashboard — all numbers come live from Cloudflare D1, the SQLite database. 25 leads, 3.92 million BDT active pipeline, 9 overdue, 3 in Proposal, 1 Paid at 300,000. The pipeline chart shows the 5 active stages plus Paid and Lost as terminal. If I redeploy the Worker, the data persists because it's in D1, not in memory."

**[1:30–2:15] Lead Details + AI Email + Send via Gmail (the headline feature)**

> "I open Karnaphuli Foods — overdue, Contacted stage. Full record, timeline, real notes, data-quality warnings. Now I click Generate Follow-up Email. The Worker sends the lead's actual notes to Cloudflare Workers AI — the free, native model — and it drafts a personalized follow-up referencing the sales-team AI training from the notes. Here's the new part: instead of copy-paste, I click **Send via Gmail** — it opens Gmail compose with the To, Subject and Body all pre-filled. I just review and hit Send. That's the ChatGPT-style 'open in Gmail' experience, applied to sales follow-ups."

**[2:15–3:00] Data Quality Center**

> "The Data Quality Center catches everything the messy CSV threw at it. L01 and L23 — exact duplicate, same Padma Textiles entered twice. L02 and L03 — potential duplicate, different company name but the same Dr. Sultana, same email and phone. Each pair has a safe review workflow, nothing auto-deleted. Missing contacts: L06 missing a phone, L24 missing name and email. Date error: L25 where the follow-up is before the last contact. Nine overdue follow-ups listed separately so they're not confused with date errors."

**[3:00–3:45] AI Sales Analyst**

> "The AI Analyst answers plain-English questions. 'Which deals are overdue?' — handled deterministically, 9 leads, exact calculation, no AI involved. 'Total value in Proposal stage?' — 1.62 million, deterministic. Now a flexible one: 'Which manufacturing companies have deal value over 100000?' — this goes to Workers AI, which returns a structured query spec, and the app executes it against the real D1 data. Two matches: Eastern Cable and Khulna Jute Works. The model never invented a number — it just wrote the query plan."

**[3:45–4:30] Import / update CSV — handling future data**

> "Finally, the Import screen — this is how I keep the pipeline current. I can upload a new CSV or paste it. I preview first: it tells me which rows will insert (new lead id), update (existing lead id), or skip (invalid). If I add a lead with a follow-up 5 days from now, it's stored as-is and shows as upcoming, not overdue — the overdue engine handles future dates correctly. I commit, and it upserts into D1 — existing leads update, new leads add, nothing is ever deleted. Every import is logged for audit."

**[4:30–5:00] Architecture + wrap-up**

> "To recap the stack: React and Vite frontend, Hono on Cloudflare Workers for the API, D1 for persistent SQLite, Cloudflare Workers AI for the free native model, JWT auth in an httpOnly cookie. All AI keys are server-side Cloudflare secrets — never in frontend JavaScript. The live URL is on screen, the code is on GitHub, and every number you saw is computed from the real 25 BIAI sample leads. Thanks for watching."

---

## Demo checklist (tick before recording)

- [ ] App open at the live URL, login page visible
- [ ] Sign in with admin / biai-demo-2026
- [ ] Dashboard: confirm 25 / 3,920,000 BDT / 9 overdue / 3 Proposal / 1 Paid
- [ ] Pipeline: one search + one filter demonstrated
- [ ] Lead Details: open L04 (Karnaphuli Foods)
- [ ] Generate Follow-up Email → subject + body appear
- [ ] **Click "Send via Gmail"** → Gmail compose opens, pre-filled (the money shot)
- [ ] Data Quality: show L01/L23 + L02/L03 duplicates + L25 date error
- [ ] AI Analyst: "Which deals are overdue?" (deterministic) + one flexible question
- [ ] Import: paste a small CSV with a future-dated row → Preview → show insert/update
- [ ] Mention: Cloudflare Workers + D1 + Workers AI, all free tier
- [ ] Mention: code on GitHub, live URL on screen

## Recording tips

- 1440×900, hide bookmarks bar.
- Have the Gmail tab ready so the "Send via Gmail" click lands instantly.
- For the import demo, pre-copy a 2-row CSV (1 new + 1 update) so you don't type live.
- Keep each screen under 45 seconds.
