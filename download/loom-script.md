# BIAI Corporate Intelligence — Loom Demo Script (under 5 minutes)

**Target length:** ~4:30. Speak naturally; do not read verbatim.

---

**[0:00 — 0:20] Intro & the problem**

> "Hi, this is my submission for the BIAI AI Intern Round 2, Task 2 — the Corporate Leads Pipeline. BIAI sells corporate training, and right now leads sit in messy spreadsheets: some have no owner, follow-ups are overdue, duplicates create confusion, and managers can't see which deal is stuck. I built **BIAI Corporate Intelligence** to fix that. Every lead, every follow-up, one clear pipeline."

**[0:20 — 0:50] Dashboard**

> "Starting on the Executive Dashboard — all numbers are calculated live from the 25 sample leads BIAI supplied. Total Leads 25, active pipeline value 3.92 million BDT, 9 overdue follow-ups, 3 deals in Proposal worth 1.62 million, and 1 Paid deal at 300,000. The pipeline chart shows lead count per stage — New, Contacted, Meeting, Proposal, Invoice sent, then the terminal Paid and Lost. Below it, the overdue list and a data-quality summary showing 15 leads flagged across duplicates, missing contacts, date errors and overdue."

**[0:50 — 1:30] Pipeline table**

> "The Pipeline screen is the working view. Search by company, filter by stage, industry or owner, sort by deal value or follow-up date. Each row shows the contact, value, stage, owner and next follow-up. Flags on the right highlight overdue leads in amber, missing contacts and date errors in red, and duplicates with a layers icon. Clicking any row opens the lead's full detail."

**[1:30 — 2:20] Lead Details + AI Email**

> "Here's a lead — Karnaphuli Foods, overdue, Contacted stage. I see the full contact info, timeline, the actual notes, and every data-quality warning with the raw values preserved. Now the AI part: I click **Generate Follow-up Email**. The app sends this lead's real notes, stage and contact details to the AI — and you get a short, personalized follow-up that references the sales-team AI training from the notes, signed off as Mehedi Hasan from BIAI. It's polite, specific, and it never invented a meeting or a missing phone number. I can regenerate or copy it."

**[2:20 — 3:10] Data Quality Center**

> "The Data Quality Center is where the messy data gets tamed. Duplicates tab: L01 and L23 are an exact duplicate — same Padma Textiles, same contact, entered twice. L02 and L03 are a potential duplicate — different company name, but the same Dr. Sultana Begum, same email and phone. Each pair has a safe review workflow: keep one, keep the other, or dismiss — nothing is ever auto-deleted. The Missing info tab shows L06 missing a phone and L24 missing name and email. The Dates tab shows L25 where the next follow-up is before the last contact — a real date-order error — plus the 9 overdue follow-ups listed separately so they're not confused with date errors."

**[3:10 — 4:00] AI Sales Analyst**

> "Finally, the AI Sales Analyst. I ask in plain English: 'Which deals are overdue?' — answered deterministically, 9 leads, exact calculation, no AI involved. 'Total value in Proposal stage?' — 1.62 million BDT, deterministic. Now a flexible one: 'Which manufacturing companies have deal value over 100000?' — this one goes to the AI, which returns a structured query spec, and the app executes it against the real data. Two matching leads: Eastern Cable Industries and Khulna Jute Works. The model never invented a number — it just wrote the query plan."

**[4:00 — 4:30] Wrap-up**

> "To recap: all 25 leads loaded, none discarded. 1 exact duplicate, 1 potential duplicate, 2 missing contacts, 1 date error, 9 overdue — all flagged correctly and verified by 37 unit tests and an independent Python audit. AI is used where it adds real value — personalized emails and flexible queries — and never where simple code is more accurate. The code is on GitHub and the app is live. Thanks for watching."

---

## Demonstration checklist (tick off before recording)

- [ ] App running, all 25 leads loaded
- [ ] Dashboard KPIs correct: 25 / 3,920,000 BDT / 9 overdue / 3 Proposal / 1 Paid
- [ ] Pipeline: search works, at least one filter + one sort demonstrated
- [ ] Click a lead row → Lead Details opens
- [ ] Generate Follow-up Email → shows subject + body, personalized, copy button works
- [ ] Data Quality: show L01/L23 exact duplicate + L02/L03 potential duplicate + merge buttons
- [ ] Data Quality: Missing info tab (L06, L24) + Dates tab (L25 date-order violation)
- [ ] AI Analyst: ask "Which deals are overdue?" (deterministic) + one flexible question (LLM)
- [ ] Mention: 37 unit tests pass, numbers verified against Python audit
- [ ] Mention: keys server-side only, never committed; multi-provider AI

## Recording tips

- 1440×900 viewport; hide the browser bookmark bar.
- Have the email generation + a flexible analyst question prepared so there's no dead air.
- If the AI is slow on screen, say "give it a second" — it's usually 1–2s.
- Keep moving; don't linger on any one screen for more than ~40s.
