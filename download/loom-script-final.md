# BIAI Corporate Intelligence — Final Loom Script (under 5 minutes)

**Live URL:** https://biai-corporate-intelligence.imriad.workers.dev
**Login:** `admin` / `biai-demo-2026` (one-click button — no typing)

---

## The script (speak naturally, don't read verbatim)

**[0:00–0:20] Hook + the problem**

> "BIAI sells corporate training, but leads sit in messy spreadsheets — some have no owner, follow-ups are overdue, duplicates create confusion, and nobody can see which deal is stuck. I built BIAI Corporate Intelligence to fix that. Every lead, every follow-up, one clear pipeline."

**[0:20–0:45] Landing + architecture (quick)**

> "Here's the landing page. The app runs on Cloudflare Workers with D1 for persistence, Workers AI for the free native model, and React on the frontend. I'll click Open the App — login is one click, pre-filled for the demo."

**[0:45–1:25] Dashboard — the numbers are real**

> "Dashboard. Every number is computed live from the 25 sample leads in D1 — 25 leads, 3.92 million BDT active pipeline, 9 overdue follow-ups, 3 in Proposal, 1 Paid at 300,000. The pipeline chart shows the five active stages plus Paid and Lost as terminal. Below it, the overdue list and the data-quality summary showing 15 leads flagged."

**[1:25–2:15] Lead Details + AI Email + Send via Gmail (the headline feature)**

> "I open Karnaphuli Foods — overdue, Contacted stage. Full record, timeline, the actual notes, data-quality warnings. Now I click Generate Follow-up Email. The Worker sends the lead's real notes to Workers AI — it takes about a second — and I get a properly-structured email: greeting, body referencing the sales-team AI training from the notes, a clear next step, and 'Best regards' on its own line with my sign-off. Here's the part I'm proud of — I click **Send via Gmail** and it opens Gmail compose with the To, Subject and Body all pre-filled. I just review and hit Send. No copy-paste, like ChatGPT's open-in-Gmail but for sales follow-ups."

**[2:15–3:00] Data Quality Center — the messy data, cleaned**

> "The Data Quality Center catches every mistake the CSV had on purpose. Duplicates: L01 and L23 are an exact duplicate — same Padma Textiles, entered twice. L02 and L03 are a potential duplicate — different company name, but the same Dr. Sultana, same email and phone. Each pair has a safe review workflow — keep one or dismiss — nothing is ever auto-deleted. Missing contacts: L06 missing a phone, L24 missing name and email. Date error: L25 where the follow-up is before the last contact — a real date-order violation. Nine overdue follow-ups listed separately so they're not confused with date errors."

**[3:00–3:40] AI Sales Analyst — questions in plain English**

> "The AI Analyst. 'Which deals are overdue?' — answered deterministically, 9 leads, exact calculation, no AI involved. 'Total value in Proposal stage?' — 1.62 million BDT, deterministic. Now a flexible one: 'Which manufacturing companies have deal value over 100,000?' — this goes to the AI, which returns a structured query spec, and the app executes it against the real D1 data. Two matches: Eastern Cable and Khulna Jute Works. The model never invented a number — it just wrote the query plan."

**[3:40–4:15] Chase plan + CSV export (the optional extras)**

> "Two optional features from the brief. On the dashboard, Generate Chase Plan — AI reads my overdue and upcoming leads and writes a prioritized action list for the week. And on the Pipeline screen, Export CSV — downloads the cleaned pipeline with data-quality annotations as a spreadsheet. Round-trip: messy CSV in, clean CSV out."

**[4:15–4:45] Why these choices**

> "A few choices worth explaining. I used Cloudflare Workers AI instead of the Z.ai key because the Z.ai account has no balance — Workers AI is free and native, so the demo actually works. The reference date is 1 November 2026 exactly as the brief specifies, so the overdue count matches the audit. Login is credential-only for now — the users table supports multiple roles for when this grows. And the AI never invents data — emails use the real notes, queries return a spec not a number."

**[4:45–5:00] Wrap-up**

> "All 25 leads loaded, none discarded. Every flag verified by 37 unit tests and an independent Python audit. Live on Cloudflare, code on GitHub, login is one click. Thanks for watching."

---

## Recording checklist (tick before you hit record)

- [ ] Landing page loaded at the URL
- [ ] Click "Open the app" → login appears with autofilled creds
- [ ] Click "Sign in as demo (one click)" → dashboard
- [ ] Dashboard: confirm 25 / 3,920,000 BDT / 9 overdue before saying it
- [ ] Open L04 (Karnaphuli Foods) from the overdue list
- [ ] Click "Generate follow-up email" — wait ~1-2s (say "give it a second")
- [ ] Show the structured email, point out "Best regards" on its own line
- [ ] Click "Send via Gmail" — Gmail opens pre-filled (the money shot)
- [ ] Go to Data Quality → show L01/L23 + L02/L03 + L25
- [ ] AI Analyst → click "Which deals are overdue?" chip, then ask the flexible manufacturing question
- [ ] Back to Dashboard → "Generate chase plan"
- [ ] Pipeline → "Export CSV" (file downloads)
- [ ] Mention: Cloudflare Workers + D1 + Workers AI, 37 unit tests, code on GitHub

## Professional presentation tips

1. **Open Gmail in a background tab first** so the "Send via Gmail" click lands instantly — no Gmail load delay on camera.
2. **Pre-warm the AI** by generating one email before you start recording, so the Worker isolate is warm and the on-camera generation is fast (~1s).
3. **Don't narrate loading** — if something takes 2 seconds, just pause and let it happen. Say "generating…" once, then show the result.
4. **Show your face for the first 10 seconds and the last 10 seconds** (intro + outro) — it builds trust. Screen-only in the middle is fine.
5. **Smile when the Gmail tab opens** — that's the "wow" moment; let it land.
6. **Keep moving** — never stay on one screen more than ~40 seconds.
7. **If you stumble, keep going** — one take with minor stumbles beats ten retakes. Confidence > perfection.
8. **Close with the links on screen** for 5 seconds: the live URL and the GitHub URL.
