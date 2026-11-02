-- BIAI Corporate Intelligence — D1 schema
-- Leads table preserves BOTH raw imported values and normalized helpers.
-- Users table for credential login (no signup). Import log for CSV upsert audit.

CREATE TABLE IF NOT EXISTS leads (
  lead_id          TEXT PRIMARY KEY,
  company          TEXT NOT NULL,
  industry         TEXT,
  contact_name     TEXT,
  contact_role     TEXT,
  contact_email    TEXT,
  contact_phone    TEXT,
  source           TEXT,
  stage            TEXT,
  deal_value_raw   TEXT,
  last_contact     TEXT,
  next_follow_up   TEXT,
  notes            TEXT,
  -- normalized helpers (additive; raw values always preserved)
  normalized_company TEXT,
  normalized_email   TEXT,
  normalized_phone   TEXT,
  deal_value         INTEGER DEFAULT 0,
  created_at       TEXT DEFAULT (datetime('now')),
  updated_at       TEXT DEFAULT (datetime('now')),
  source_file      TEXT DEFAULT 'seed'
);

CREATE INDEX IF NOT EXISTS idx_leads_stage ON leads(stage);
CREATE INDEX IF NOT EXISTS idx_leads_norm_company ON leads(normalized_company);
CREATE INDEX IF NOT EXISTS idx_leads_followup ON leads(next_follow_up);

CREATE TABLE IF NOT EXISTS users (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  username   TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,   -- bcrypt-style hash; for demo a simple SHA-256
  name       TEXT,
  role       TEXT DEFAULT 'manager',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS import_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  file_name  TEXT,
  rows_seen  INTEGER,
  rows_inserted INTEGER,
  rows_updated  INTEGER,
  rows_skipped  INTEGER,
  imported_at TEXT DEFAULT (datetime('now')),
  note       TEXT
);

-- Seed the 25 BIAI sample leads. Raw values preserved verbatim.
-- Reference date for overdue: 2026-11-01 (per stage-definitions.md).
INSERT OR IGNORE INTO leads (lead_id, company, industry, contact_name, contact_role, contact_email, contact_phone, source, stage, deal_value_raw, last_contact, next_follow_up, notes, normalized_company, normalized_email, normalized_phone, deal_value, source_file) VALUES
('L01','Padma Textiles Ltd','Garments','Rafiq Uddin','HR Director','rafiq@padma-textiles.example','01711-200101','Cold email','Meeting','350000','2026-10-24','2026-11-03','Wants a 2-day pilot for merchandising team. Asked for case studies.','padma textiles','rafiq@padma-textiles.example','01711200101',350000,'seed'),
('L02','Meghna Pharma Ltd','Pharma','Dr. Sultana Begum','Head of Operations','sultana@meghna-pharma.example','01819-200102','Referral','Proposal','700000','2026-10-27','2026-11-04','Proposal sent. Budget approval next week. Wants Bangla support.','meghna pharma','sultana@meghna-pharma.example','01819200102',700000,'seed'),
('L03','Meghna Pharmaceuticals','Pharma','Dr. Sultana Begum','Head of Operations','sultana@meghna-pharma.example','01819-200102','Referral','Proposal','700000','2026-10-27','2026-11-04','DUPLICATE of L02 under a different name. Same contact.','meghna pharmaceuticals','sultana@meghna-pharma.example','01819200102',700000,'seed'),
('L04','Karnaphuli Foods','FMCG','Tanvir Hasan','Training Manager','tanvir@karnaphuli-foods.example','01911-200103','LinkedIn','Contacted','0','2026-10-20','2026-10-29','Interested in sales team AI training. Did not reply to last two messages.','karnaphuli foods','tanvir@karnaphuli-foods.example','01911200103',0,'seed'),
('L05','Dhaka Logistics Hub','Logistics','Nasrin Akter','COO','nasrin@dhakalogistics.example','01522-200104','Event','Meeting','180000','2026-10-28','2026-11-05','Met at the free masterclass. Wants dispatch automation for drivers and customers.','dhaka logistics','nasrin@dhakalogistics.example','01522200104',180000,'seed'),
('L06','Sylhet Tea Traders','Agriculture','Imtiaz Ali','Owner','imtiaz@sylhettea.example','','Walk-in','Contacted','0','2026-10-15','2026-10-22','No phone or email on file yet. Asked for a brochure in person.','sylhet tea traders','imtiaz@sylhettea.example','',0,'seed'),
('L07','Bengal Solar Systems','Energy','Farzana Rahman','Operations Manager','farzana@bengalsolar.example','01677-200107','Cold email','Invoice sent','250000','2026-10-30','2026-11-02','Invoice sent, waiting for payment. Ask whether the advance has come in.','bengal solar systems','farzana@bengalsolar.example','01677200107',250000,'seed'),
('L08','Chittagong Steel Works','Manufacturing','Golam Mostafa','Plant Director','golam@ctgsteel.example','01732-200108','Referral','Lost','0','2026-09-30','','Said budget is frozen until next year. Ask again in Q2 2027.','chittagong steel','golam@ctgsteel.example','01732200108',0,'seed'),
('L09','Rangpur Agro Feeds','Agriculture','Hasina Parvin','Admin Head','hasina@rangpuragro.example','01855-200109','Website form','New','0','','2026-11-01','Just came in from the website form. Nobody has contacted her yet.','rangpur agro feeds','hasina@rangpuragro.example','01855200109',0,'seed'),
('L10','Oriental Bank Branch Ops','Banking','Mizanur Rahman','Senior Manager, Training','mizan@orientalbank.example','01944-200110','LinkedIn','Meeting','500000','2026-10-26','2026-10-30','Meeting done. Wants a written proposal with 3 options. Overdue, nobody sent it.','oriental bank branch ops','mizan@orientalbank.example','01944200110',500000,'seed'),
('L11','Jamuna Fashion House','Garments','Shamima Nasrin','Merchandising Lead','shamima@jamunafashion.example','01611-200111','Facebook ad','Contacted','0','2026-10-29','2026-11-03','Ad lead. Asked whether training is in Bangla. Yes, the mentor speaks Bangla.','jamuna fashion house','shamima@jamunafashion.example','01611200111',0,'seed'),
('L12','Eastern Cable Industries','Manufacturing','Kamal Uddin','General Manager','kamal@easterncable.example','01788-200112','Referral','Paid','300000','2026-10-18','','Paid 50 percent advance. Training starts after the second payment.','eastern cable','kamal@easterncable.example','01788200112',300000,'seed'),
('L13','Mou Telecom','Telecom','Riad Chowdhury','Learning and Development','riad@moutelecom.example','01566-200113','Cold email','Contacted','0','2026-10-21','2026-10-28','Replied once: send details. Details were sent. Follow-up overdue.','mou telecom','riad@moutelecom.example','01566200113',0,'seed'),
('L14','Barishal Dairy Co','FMCG','Lipi Sarkar','Marketing Manager','lipi@barishaldairy.example','01745-200114','LinkedIn','Proposal','220000','2026-10-31','2026-11-06','Wants social media content tools. Compare against content agency price.','barishal dairy','lipi@barishaldairy.example','01745200114',220000,'seed'),
('L15','Gulshan Dental Chain','Healthcare','Dr. Arif Hossain','Director','arif@gulshandental.example','01633-200115','Event','Contacted','0','2026-10-12','2026-10-19','Interested in patient reminder automation. No response since 12 Oct.','gulshan dental chain','arif@gulshandental.example','01633200115',0,'seed'),
('L16','Sundarban Shipping','Logistics','Mehedi Hasan','IT Head','mehedi@sundarbanship.example','01839-200116','Cold email','Lost','0','2026-10-08','','Chose an international vendor. Do not contact again this year.','sundarban shipping','mehedi@sundarbanship.example','01839200116',0,'seed'),
('L17','Megna Retail Group','Retail','Sabina Yasmin','HR Manager','sabina@megnaretail.example','01925-200117','Referral','Meeting','400000','2026-10-29','2026-11-04','Wants staff training for 120 store staff. Asked about group discount.','megna retail','sabina@megnaretail.example','01925200117',400000,'seed'),
('L18','Bogura Textile Mills','Garments','Shahidul Islam','Factory Manager','shahidul@bogurateXtile.example','01702-200118','Walk-in','New','0','2026-10-31','2026-11-03','Email has a typo (bogurateXtile), check before sending.','bogura textile mills','shahidul@boguratextile.example','01702200118',0,'seed'),
('L19','Ruhi Digital Agency','Marketing','Ruhi Ahmed','Founder','ruhi@ruhidigital.example','01555-200119','LinkedIn','Meeting','120000','2026-10-25','2026-10-30','Small agency. Wants to resell AI course to clients. Ask about 70/30 partner terms.','ruhi digital agency','ruhi@ruhidigital.example','01555200119',120000,'seed'),
('L20','Cumilla Pharma Depot','Pharma','Ayesha Siddika','Admin Officer','ayesha@cumillapharma.example','01866-200120','Facebook ad','Contacted','0','2026-10-23','2026-10-27','Asked for price list by email. Price list sent. No reply since.','cumilla pharma depot','ayesha@cumillapharma.example','01866200120',0,'seed'),
('L21','Uttara Real Estate Ltd','Real estate','Zahid Hasan','Sales Director','zahid@uttararealty.example','01714-200121','Event','Contacted','0','2026-10-31','2026-11-04','Wants a sales team training. Budget not confirmed yet.','uttara real estate','zahid@uttararealty.example','01714200121',0,'seed'),
('L22','Khulna Jute Works','Manufacturing','Monir Hossain','Director','monir@khulnajute.example','01976-200122','Referral','Invoice sent','150000','2026-10-17','2026-10-24','Invoice sent 17 Oct. Paid? Not marked. Check bank before chasing.','khulna jute works','monir@khulnajute.example','01976200122',150000,'seed'),
('L23','Padma Textiles Ltd','Garments','Rafiq Uddin','HR Director','rafiq@padma-textiles.example','01711-200101','Cold email','Meeting','350000','2026-10-24','2026-11-03','DUPLICATE of L01 (same company, same contact, entered twice).','padma textiles','rafiq@padma-textiles.example','01711200101',350000,'seed'),
('L24','Noakhali Agro Mart','Agriculture','','','','01555-200124','Website form','New','0','','2026-11-02','No contact name or email in the form. Phone only.','noakhali agro mart','','01555200124',0,'seed'),
('L25','Sylhet Hospitality Group','Hospitality','Mahmudul Haque','General Manager','mahmud@sylhethospitality.example','01697-200125','LinkedIn','Contacted','0','2026-10-28','2026-10-21','Data error: next follow-up is before the last contact date. Fix it.','sylhet hospitality group','mahmud@sylhethospitality.example','01697200125',0,'seed');

-- Demo login user (password: biai-demo-2026). Hash = SHA-256 of the password.
-- In production this would be bcrypt; for a single demo credential SHA-256 over HTTPS is acceptable,
-- and the schema supports adding more users / upgrading to bcrypt later.
INSERT OR IGNORE INTO users (username, password_hash, name, role) VALUES
('admin', 'sha256:eecc340ea714c7904db11efa9d95bee75018f4a23fd5d2bd59bbae81139bc439', 'Riad Hossain', 'manager');

INSERT OR IGNORE INTO import_log (file_name, rows_seen, rows_inserted, rows_updated, rows_skipped, note) VALUES
('corporate-leads.csv (BIAI seed)', 25, 25, 0, 0, 'Initial 25 fictional sample leads supplied by BIAI.');
