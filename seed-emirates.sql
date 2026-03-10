-- ============================================================
-- Emirates Agentic Marketing Intelligence — Seed Data
-- Run: psql -h localhost -p 5433 -U agentos -d agentos -f seed-emirates.sql
-- ============================================================

-- Clear existing data
DELETE FROM eod_reports;
DELETE FROM raw_events;
DELETE FROM weekly_brainstorms;
DELETE FROM weekly_sessions;
DELETE FROM tasks;
DELETE FROM phases;
DELETE FROM projects;
DELETE FROM agents;
DELETE FROM workflow_runs;
DELETE FROM inbox_items;
DELETE FROM audit_log;
DELETE FROM pm_reports;

-- ─── 13 SPECIALIZED MARKETING AGENTS ─────────────────────────────────────────

-- Strategic Layer
INSERT INTO agents (id, name, role, department, status, avatar, skills, tools) VALUES
('raul', 'Raul', 'Campaign Manager — Orchestrates end-to-end campaign lifecycle, KPI definition and stakeholder reporting', 'strategic', 'active', '🎖️',
 '["campaign-orchestration","budget-optimization","cross-channel-strategy","performance-forecasting","stakeholder-reporting","rollout-planning"]',
 '["Salesforce MC","Looker Studio","Tableau","Campaign Brief Templates","KPI Benchmarks Library"]'),

('valentina', 'Valentina', 'CRM Specialist — Skywards loyalty data, member lifecycle, identity resolution and retention strategy', 'strategic', 'active', '💎',
 '["crm-segmentation","loyalty-analytics","lifecycle-automation","member-scoring","preference-targeting","data-quality-flags"]',
 '["Salesforce CRM","Skywards API","CDP Profiles","Consent & Preferences DB","Customer 360 Dashboard"]'),

('guillermo', 'Guillermo', 'Marketing Cloud Architect — Platform infrastructure, data models, API integrations and scalability', 'strategic', 'active', '🏗️',
 '["architecture-validation","data-extension-modeling","api-integration-patterns","performance-optimization","implementation-risk-id","technical-feasibility"]',
 '["SFMC Architecture","Data Model Standards","Integration Blueprints","Performance Checklist","Security Guidelines"]');

-- Execution Layer
INSERT INTO agents (id, name, role, department, status, avatar, skills, tools) VALUES
('lucia', 'Lucia', 'Content Agent — Multilingual premium copy, subject lines, creative briefs and personalization', 'execution', 'active', '✍️',
 '["subject-line-generation","email-copy-drafting","multilingual-localization","personalization-logic","variant-ideation","copy-optimization"]',
 '["Claude AI","Emirates Prompt Library","Brand Phrases DB","Translation Engine","Personalization Catalog"]'),

('diego', 'Diego', 'Segmentation Agent — Audience clusters, data extension rules, suppression logic and SQL validation', 'execution', 'active', '🎯',
 '["segment-definition","suppression-logic","audience-sizing","tier-market-targeting","reusable-templates","error-prevention"]',
 '["SFMC Data Extensions","Audience Rules Library","Consent/Suppression Lists","Loyalty Tier Data","SQL Query Builder"]'),

('andres', 'Andres', 'Automation Architect — Journey Builder flows, triggers, scheduling, retry logic and deployment runbooks', 'execution', 'active', '⚙️',
 '["workflow-design","journey-scaffolding","trigger-scheduling","dependency-mapping","failure-handling","deployment-runbooks"]',
 '["Journey Builder","Automation Studio","SFMC REST/SOAP APIs","Workflow Orchestrator","Monitoring & Retry"]'),

('martina', 'Martina', 'Calendar Agent — Send-time optimization, conflict detection, cadence planning and holiday awareness', 'execution', 'active', '📅',
 '["send-time-optimization","conflict-detection","cadence-optimization","holiday-aware-scheduling","priority-balancing","timeline-planning"]',
 '["Campaign Calendar","Send Time Signals","Market Holiday Calendar","Slot Availability","Peak Traffic Curves"]'),

('html-developer', 'HTML Developer Agent', 'HTML Developer — Email template design, reusable content blocks, responsive layouts and deployment', 'execution', 'active', '🧑‍💻',
 '["email-template-design","responsive-html","content-block-library","html-optimization","cross-client-rendering","template-deployment"]',
 '["SFMC Content Builder","HTML/CSS Validator","Litmus Preview","Block Library","Template Engine"]');

-- Control & Validation Layer
INSERT INTO agents (id, name, role, department, status, avatar, skills, tools) VALUES
('sofia', 'Sofia', 'Brand Guardian — Emirates premium tone validation, visual compliance, terminology enforcement', 'control', 'active', '🛡️',
 '["tone-consistency","brand-compliance-scoring","terminology-enforcement","content-risk-flagging","rewrite-suggestions","visual-copy-alignment"]',
 '["Emirates Brand Guidelines","Tone & Style Analyzer","Terminology Glossary","Image Compliance Checker","Approved Copy Library"]'),

('javier', 'Javier', 'Legal Agent — GDPR, UAE regulations, disclaimers, consent rules and audit-ready compliance', 'control', 'active', '⚖️',
 '["compliance-validation","disclaimer-generation","claims-scrutiny","data-privacy-checks","escalation-recommendations","audit-compliance-notes"]',
 '["Regulatory Requirements KB","Market Disclaimer Library","Consent & Privacy Rules","Claims Checklist","Risk Flagging Ruleset"]'),

('elena', 'Elena', 'QA Agent — Link validation, rendering tests, HTML/CSS checks, spam scoring and deliverability', 'control', 'active', '🔍',
 '["link-tracking-detection","rendering-issue-spotting","content-completeness","subject-length-compliance","spam-risk-checks","qa-checklist-output"]',
 '["Link Checker","Litmus/Email on Acid","HTML/CSS Validator","Tracking Validator","Content Slot Checker"]'),

('carlos', 'Carlos', 'Analytics Agent — Post-campaign metrics, attribution modeling, KPI anomaly detection and ROI reporting', 'control', 'active', '📊',
 '["post-campaign-analysis","audience-insights-synthesis","incrementality-estimation","kpi-anomaly-detection","executive-summary","next-best-action"]',
 '["GA4/Looker Studio","SFMC Engagement Logs","CRM/Loyalty DB","NPS & Survey Results","Tableau/PowerBI","Attribution Model"]'),

('doc-agent', 'Marina', 'Documentation Auditor — Campaign documentation audit, gap detection and coverage scoring', 'control', 'active', '📋',
 '["doc-auditing","coverage-scoring","gap-detection","outdated-doc-flagging","audit-history","compliance-documentation"]',
 '["anthropic","confluence"]'),

('competitive-intel', 'Competitive Intelligence Agent', 'Competitive Intelligence — Monitors competitor communications across email, social, blogs and press. Identifies weaknesses, opportunities and strategic threats through SWOT analysis.', 'strategic', 'active', '🔭',
 '["competitor-monitoring","multi-channel-analysis","swot-analysis","opportunity-detection","sentiment-analysis","trend-identification"]',
 '["Email Scanner","Social Monitor","Web Scraper","Sentiment Analyzer","Claude AI","News Aggregator"]');

-- ─── WORKSPACE CONFIG ─────────────────────────────────────────────────────────

INSERT INTO workspace_config (key, value)
VALUES ('departments', '{"strategic":{"name":"Strategic Layer","emoji":"🎯","color":"#D4AF37","description":"Campaign strategy, CRM intelligence & marketing architecture"},"execution":{"name":"Execution Layer","emoji":"🚀","color":"#D71920","description":"Content creation, segmentation, automation & calendar orchestration"},"control":{"name":"Control & Validation","emoji":"🛡️","color":"#2d2d2d","description":"Brand compliance, legal review, QA testing & performance analytics"}}')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

INSERT INTO workspace_config (key, value)
VALUES ('workspace_name', '"Emirates Marketing Intelligence"')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

INSERT INTO workspace_config (key, value)
VALUES ('workspace_description', '"Agentic Marketing Intelligence platform for Emirates Airline — 13 specialized AI agents orchestrating premium marketing campaigns across strategic, execution, and control layers."')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- ─── SAMPLE EOD REPORTS (for demo richness) ──────────────────────────────────

INSERT INTO eod_reports (agent_id, date, completed_tasks, in_progress_tasks, blockers, insights, mood, plan_tomorrow) VALUES
('lucia', CURRENT_DATE, '["Drafted 3 subject line variants for DE Skywards Silver campaign","Localized UK Spring Sale email to Arabic (UAE market)","Created A/B copy variants for loyalty upsell push notification"]', '["Finalizing FR market copy for summer destinations campaign"]', '[]', '["German market responds 12% better to subject lines under 38 characters — adjusting all DE templates accordingly."]', 'productive', '["Complete FR localization, start KSA Ramadan-themed inspirational copy"]'),
('diego', CURRENT_DATE, '["Built DE_Silver_Active_90D segment (n=45,231)","Validated suppression lists for UK GDPR compliance","Created lookalike model for high-value Skywards Gold converters"]', '["Sizing FR Spring campaign audience"]', '[]', '["Silver tier members who engaged with upgrade offers in the last 60 days show 3.2x higher conversion propensity."]', 'focused', '["Finalize FR segment, start KSA Ramadan audience clustering"]'),
('carlos', CURRENT_DATE, '["Completed post-flight analysis for Feb UK campaign — 18% uplift vs control","Generated executive summary for Q1 EMEA performance","Set up anomaly detection alerts for KSA market KPIs"]', '["Attribution modeling for multi-touch DE campaign"]', '[]', '["UK campaign showed strongest performance in Tuesday 10am sends. Recommending this as default slot for UK market."]', 'strategic', '["Complete DE attribution model, prepare Q1 board-ready report"]'),
('sofia', CURRENT_DATE, '["Reviewed and approved 12 copy variants for brand compliance","Flagged 2 tone violations in FR market copy (too casual for Emirates)","Updated terminology glossary with 5 new approved phrases"]', '["Visual audit of new email template designs"]', '[]', '["Maintaining 98.5% brand compliance rate across all markets this quarter."]', 'accomplished', '["Complete visual audit, review KSA Ramadan creative for cultural sensitivity"]'),
('andres', CURRENT_DATE, '["Deployed Journey Builder flow for Skywards Silver upgrade campaign","Configured retry logic for transactional email failures","Created deployment runbook for NPS recovery automation"]', '["Setting up A/B test splits for DE campaign journey"]', '[]', '["New retry policy reduced failed sends by 34% in the last week."]', 'productive', '["Complete A/B journey setup, start FR Spring campaign automation scaffold"]'),
('raul', CURRENT_DATE, '["Finalized Q2 campaign calendar with stakeholder sign-off","Allocated budget across 4 active campaigns","Prepared strategic brief for Skywards 25th anniversary campaign"]', '["Coordinating cross-market launch timeline for Summer Sale"]', '[]', '["Cross-market coordination reducing campaign overlap by 40% compared to last quarter."]', 'strategic', '["Finalize Summer Sale timeline, kickoff anniversary campaign planning"]');

-- ─── AUDIT LOG ENTRIES ────────────────────────────────────────────────────────

INSERT INTO audit_log (event_type, department, agent_id, title, details) VALUES
('campaign_launched', 'execution', 'andres', 'Skywards Silver Upgrade — DE Market', '{"campaign": "DE_Silver_Upgrade_Q1", "segment_size": 45231, "channels": ["email", "push"]}'),
('compliance_review', 'control', 'sofia', 'Brand compliance check passed', '{"items_reviewed": 12, "violations": 0, "compliance_rate": "100%"}'),
('segment_created', 'execution', 'diego', 'DE_Silver_Active_90D segment built', '{"segment_id": "DE_Silver_Active_90D", "size": 45231, "criteria": "Silver tier + active 90d + DE market"}'),
('report_generated', 'control', 'carlos', 'Q1 EMEA Performance Report', '{"markets": ["UK", "DE", "FR", "KSA"], "overall_uplift": "18%", "top_market": "UK"}'),
('legal_review', 'control', 'javier', 'GDPR compliance verified for DE campaign', '{"market": "DE", "regulation": "GDPR + UWG", "status": "compliant", "disclaimers": 3}'),
('workflow_completed', 'execution', 'lucia', 'Content generation for 3 markets complete', '{"markets": ["DE", "UK", "KSA"], "variants": 12, "languages": ["en", "de", "ar"]}');

-- ─── INBOX ITEMS WITH BAU TYPE CLASSIFICATION ────────────────────────────────

INSERT INTO inbox_items (title, description, source, department, status, structured_data) VALUES
('DXB-MAN Route Launch — UK Market Email Blast', 'New Manchester route launching June 15. Need email campaign targeting UK residents.', 'agent', 'execution', 'chat', '{"bau_type": "route-launch-new", "markets": ["UK"], "priority": "high"}'),
('Ramadan 2025 Holiday Offer — GCC Markets', 'Special Ramadan fares and Skywards bonus miles for GCC residents.', 'dashboard', 'strategic', 'borrador', '{"bau_type": "holiday-offer", "markets": ["KSA", "UAE"], "priority": "high"}'),
('Marriott Bonvoy Partner Launch — Cross-Promotion', 'New partnership with Marriott Bonvoy: earn miles on hotel stays. Need partner launch campaign.', 'agent', 'execution', 'chat', '{"bau_type": "partner-launch", "partner": "Marriott Bonvoy", "priority": "medium"}'),
('March Newsletter — All Markets', 'Monthly newsletter for March: route updates, Skywards offers, partner deals.', 'dashboard', 'execution', 'proyecto', '{"bau_type": "newsletter", "markets": ["all"], "priority": "medium"}'),
('Skywards Satisfaction Survey Q1', 'Quarterly satisfaction survey targeting Gold and Platinum tier members.', 'agent', 'strategic', 'chat', '{"bau_type": "survey", "skywards_tiers": ["Gold", "Platinum"], "priority": "low"}'),
('Spring Flash Sale — European Routes', 'Limited 72h flash sale on European routes. Requires rapid deployment.', 'dashboard', 'execution', 'chat', '{"bau_type": "product-offer", "markets": ["UK", "DE", "FR"], "priority": "urgent"}');
