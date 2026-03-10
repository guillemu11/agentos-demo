-- ============================================================
-- Emirates Agentic Marketing Intelligence — Seed Data
-- Run: psql -h localhost -p 5433 -U agentos -d agentos -f seed-emirates.sql
-- ============================================================

-- Clear all data and reset SERIAL counters (CASCADE handles FK dependencies)
TRUNCATE TABLE
    brainstorm_messages,
    brainstorm_conversations,
    weekly_brainstorms,
    weekly_sessions,
    eod_reports,
    raw_events,
    tasks,
    phases,
    projects,
    agent_memory,
    agent_conversations,
    collaboration_raises,
    workflow_runs,
    inbox_items,
    audit_log,
    pm_reports,
    agents
RESTART IDENTITY CASCADE;

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
-- Distributed across last 3 days so Daily Standup always has data

INSERT INTO eod_reports (agent_id, date, completed_tasks, in_progress_tasks, blockers, insights, mood, plan_tomorrow) VALUES
-- Today: 1 agent per department
('lucia', CURRENT_DATE,
  '[{"desc":"Drafted 3 subject line variants for DE Skywards Silver campaign","duration":"2h"},{"desc":"Localized UK Spring Sale email to Arabic (UAE market)","duration":"3h"},{"desc":"Created A/B copy variants for loyalty upsell push notification","duration":"1.5h"}]',
  '[{"desc":"Finalizing FR market copy for summer destinations campaign","pct":65}]',
  '[]',
  '["German market responds 12% better to subject lines under 38 characters — adjusting all DE templates accordingly."]',
  'productive',
  '["Complete FR localization, start KSA Ramadan-themed inspirational copy"]'),
('sofia', CURRENT_DATE,
  '[{"desc":"Reviewed and approved 12 copy variants for brand compliance","duration":"4h"},{"desc":"Flagged 2 tone violations in FR market copy (too casual for Emirates)","duration":"1h"},{"desc":"Updated terminology glossary with 5 new approved phrases","duration":"45min"}]',
  '[{"desc":"Visual audit of new email template designs","pct":40}]',
  '[]',
  '["Maintaining 98.5% brand compliance rate across all markets this quarter."]',
  'accomplished',
  '["Complete visual audit, review KSA Ramadan creative for cultural sensitivity"]'),
('raul', CURRENT_DATE,
  '[{"desc":"Finalized Q2 campaign calendar with stakeholder sign-off","duration":"3h"},{"desc":"Allocated budget across 4 active campaigns","duration":"2h"},{"desc":"Prepared strategic brief for Skywards 25th anniversary campaign","duration":"2.5h"}]',
  '[{"desc":"Coordinating cross-market launch timeline for Summer Sale","pct":30}]',
  '[]',
  '["Cross-market coordination reducing campaign overlap by 40% compared to last quarter."]',
  'strategic',
  '["Finalize Summer Sale timeline, kickoff anniversary campaign planning"]'),
-- Yesterday
('diego', CURRENT_DATE - 1,
  '[{"desc":"Built DE_Silver_Active_90D segment (n=45,231)","duration":"3h"},{"desc":"Validated suppression lists for UK GDPR compliance","duration":"2h"},{"desc":"Created lookalike model for high-value Skywards Gold converters","duration":"4h"}]',
  '[{"desc":"Sizing FR Spring campaign audience","pct":70}]',
  '[]',
  '["Silver tier members who engaged with upgrade offers in the last 60 days show 3.2x higher conversion propensity."]',
  'focused',
  '["Finalize FR segment, start KSA Ramadan audience clustering"]'),
('carlos', CURRENT_DATE - 1,
  '[{"desc":"Completed post-flight analysis for Feb UK campaign — 18% uplift vs control","duration":"4h"},{"desc":"Generated executive summary for Q1 EMEA performance","duration":"2h"},{"desc":"Set up anomaly detection alerts for KSA market KPIs","duration":"1.5h"}]',
  '[{"desc":"Attribution modeling for multi-touch DE campaign","pct":55}]',
  '[]',
  '["UK campaign showed strongest performance in Tuesday 10am sends. Recommending this as default slot for UK market."]',
  'strategic',
  '["Complete DE attribution model, prepare Q1 board-ready report"]'),
-- 2 days ago
('andres', CURRENT_DATE - 2,
  '[{"desc":"Deployed Journey Builder flow for Skywards Silver upgrade campaign","duration":"3h"},{"desc":"Configured retry logic for transactional email failures","duration":"2h"},{"desc":"Created deployment runbook for NPS recovery automation","duration":"1.5h"}]',
  '[{"desc":"Setting up A/B test splits for DE campaign journey","pct":45}]',
  '[{"desc":"SFMC API rate limit preventing bulk journey activation","severity":"medium"}]',
  '["New retry policy reduced failed sends by 34% in the last week."]',
  'productive',
  '["Complete A/B journey setup, start FR Spring campaign automation scaffold"]');

-- ─── RAW EVENTS (for Generate EODs demo) ────────────────────────────────────
-- Events for agents without EOD today, so "Generate EODs" button works

INSERT INTO raw_events (agent_id, event_type, content, timestamp) VALUES
('diego', 'tool_call', '{"tool": "segment-builder", "action": "Created FR_Spring_Audience segment", "result": "Segment sized at 28,450 members"}', CURRENT_TIMESTAMP - INTERVAL '3 hours'),
('diego', 'message', '{"text": "Completed FR Spring campaign audience sizing. Ready for review."}', CURRENT_TIMESTAMP - INTERVAL '1 hour'),
('carlos', 'tool_call', '{"tool": "analytics-dashboard", "action": "Generated DE campaign attribution report", "result": "Multi-touch attribution complete, email drove 42% of conversions"}', CURRENT_TIMESTAMP - INTERVAL '4 hours'),
('carlos', 'message', '{"text": "DE attribution model finalized. Email is the strongest channel at 42% contribution."}', CURRENT_TIMESTAMP - INTERVAL '2 hours'),
('andres', 'tool_call', '{"tool": "journey-builder", "action": "Configured A/B test splits for DE campaign", "result": "50/50 split configured with holdout group"}', CURRENT_TIMESTAMP - INTERVAL '5 hours'),
('andres', 'commit', '{"message": "feat: add A/B test configuration for DE Silver upgrade journey", "files_changed": 3}', CURRENT_TIMESTAMP - INTERVAL '3 hours'),
('martina', 'tool_call', '{"tool": "calendar-optimizer", "action": "Optimized send times for Summer Sale across 4 markets", "result": "UK: Tue 10am, DE: Wed 9am, FR: Thu 11am, KSA: Sun 8pm"}', CURRENT_TIMESTAMP - INTERVAL '2 hours'),
('martina', 'message', '{"text": "Send time optimization complete for Summer Sale. No conflicts detected with existing scheduled sends."}', CURRENT_TIMESTAMP - INTERVAL '30 minutes');

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
('Spring Flash Sale — European Routes', 'Limited 72h flash sale on European routes. Requires rapid deployment.', 'dashboard', 'execution', 'chat', '{"bau_type": "product-offer", "markets": ["UK", "DE", "FR"], "priority": "urgent"}'),
('Skywards 25th Anniversary — Global Celebration', 'Milestone campaign celebrating 25 years of Skywards loyalty program. Multi-channel.', 'dashboard', 'strategic', 'proyecto', '{"bau_type": "special-announcement", "markets": ["all"], "priority": "high"}'),
('DXB-BCN New Route — Spanish Market Launch', 'New Barcelona route launching August 2026. Need awareness + booking campaigns for Spain.', 'agent', 'execution', 'chat', '{"bau_type": "route-launch-new", "markets": ["ES"], "priority": "medium"}'),
('Skywards Platinum Retention — At-Risk Members', 'Re-engage Platinum members showing declining activity. Personalized offers.', 'agent', 'strategic', 'borrador', '{"bau_type": "churn", "skywards_tiers": ["Platinum"], "priority": "high"}'),
('Email Template Modernization — Responsive Refresh', 'Upgrade legacy email templates to new responsive design system.', 'dashboard', 'execution', 'proyecto', '{"bau_type": "product-update", "priority": "medium"}'),
('GDPR Consent Refresh — EU Markets Q2', 'Proactive consent renewal before expiry for GDPR-affected EU contacts.', 'agent', 'control', 'chat', '{"bau_type": "occasional-announcement", "markets": ["UK", "DE", "FR"], "priority": "high"}'),
('Paid Lounge Promotion — Premium Segment', 'Promote paid lounge access to Business class passengers pre-flight.', 'dashboard', 'execution', 'borrador', '{"bau_type": "paid-lounge", "priority": "low"}');

-- ─── PROJECTS WITH PHASES AND TASKS ──────────────────────────────────────────

-- Project 1: Ramadan GCC Holiday Offer
INSERT INTO projects (name, description, problem, solution, department, status, type,
  pain_points, requirements, risks, estimated_budget, estimated_timeline,
  future_improvements, success_metrics) VALUES
('Ramadan GCC Holiday Offer',
 'Seasonal campaign targeting GCC markets during Ramadan with localized content and offers',
 'GCC market engagement drops during Ramadan without culturally relevant offers',
 'Localized Ramadan fare packages with Skywards bonus miles and culturally sensitive messaging',
 'strategic', 'Completed', 'campaign',
 '["Low engagement with generic offers during Ramadan period","Cultural missteps in previous years reduced brand trust in KSA","Competitor airlines (Etihad, Qatar) launching Ramadan campaigns earlier each year"]',
 '["Arabic-first copywriting with cultural sensitivity review","Skywards bonus miles integration (2x miles on selected routes)","GCC-specific audience segments (KSA, UAE, Kuwait, Bahrain)","RTL email template support","Halal travel content and family-focused messaging"]',
 '["Cultural insensitivity in messaging could damage brand in KSA market","Competitor pre-emption if campaign launches late","Ramadan dates shift annually — timing miscalculation risk"]',
 8.50, '6 weeks',
 '["Extend to Eid al-Fitr follow-up campaign with post-Ramadan travel deals","Add push notification channel for real-time iftar-time offers","Build predictive model for Ramadan booking patterns across GCC markets"]',
 '["Open rate >25% across GCC markets","Booking conversion rate >3.5%","Skywards miles redemption uplift >15%","Revenue target: $2.1M in attributed bookings","Brand sentiment score >4.2/5 in post-campaign survey"]'
);

-- Project 2: Skywards Gold to Platinum
INSERT INTO projects (name, description, problem, solution, department, status, type,
  pain_points, requirements, risks, estimated_budget, estimated_timeline,
  future_improvements, success_metrics) VALUES
('Skywards Gold to Platinum Conversion Program',
 'Loyalty upgrade campaign converting Skywards Gold members to Platinum tier through targeted incentives',
 '68% of Gold members never upgrade to Platinum — current upgrade path is unclear and not actively promoted',
 'Personalized upgrade pathways with dynamic miles calculator, exclusive Platinum preview experiences, and CRM-driven timing optimization',
 'strategic', 'Completed', 'campaign',
 '["Gold members plateau — 68% never upgrade to Platinum","Current upgrade path unclear and not actively promoted","Competitor loyalty programs offer more transparent tier progression"]',
 '["Personalized upgrade pathways based on individual flight patterns","Dynamic miles-to-upgrade calculator in email","Exclusive Platinum preview experiences (lounge access, priority boarding trial)","CRM integration for real-time tier progress tracking"]',
 '["Over-discounting Platinum benefits could devalue tier","Members who recently earned Gold may feel pressured too soon","Revenue impact if too many members upgrade via promotional path vs organic"]',
 9.00, '8 weeks',
 '["AI-driven optimal upgrade timing per member","Gamified tier progression with milestone rewards","Partner benefits integration (hotel upgrades, car rental status match)"]',
 '["Gold-to-Platinum conversion rate >8%","Campaign engagement rate >30%","Revenue per converted member >$5,000 annual increase","NPS improvement among converted members >10 points","Retention rate of converted Platinum members >90% at 12 months"]'
);

-- Project 3: DXB-MAN Route Launch
INSERT INTO projects (name, description, problem, solution, department, status, type,
  pain_points, requirements, risks, estimated_budget, estimated_timeline,
  future_improvements, success_metrics) VALUES
('DXB-MAN Route Launch Campaign',
 'Full email campaign for the new Dubai-Manchester route launching June 15',
 'Need to build awareness and drive bookings for new Manchester route in UK market',
 'Multi-wave email campaign: announcement → early bird fares → launch day countdown',
 'execution', 'In Progress', 'campaign',
 '["UK market saturated with route launch announcements from competitors","Manchester has limited brand awareness compared to London routes","No existing Emirates customer base in Manchester catchment area"]',
 '["Multi-wave email campaign: teaser → early bird → launch day","UK-specific audience segments (Manchester metro, frequent UK-DXB travelers)","Competitive fare positioning against direct competitors","Landing page with route-specific content and booking widget"]',
 '["Low initial load factor if awareness campaign underperforms","UK regulatory changes (post-Brexit visa rules) could affect demand","Seasonal weather in Manchester may reduce summer travel appeal"]',
 6.50, '5 weeks',
 '["Expand to social media retargeting for email non-openers","Add in-flight experience preview video content","Build Manchester hub partnership program (airport, tourism board)"]',
 '["Email open rate >22% across all waves","Early bird fare uptake >500 bookings in first 72 hours","Route awareness survey: >40% prompted recall in Manchester metro","First month load factor >65%","Cost per acquisition <$45"]'
);

-- Project 4: Ramadan 2026 GCC Campaign
INSERT INTO projects (name, description, problem, solution, department, status, type,
  pain_points, requirements, risks, estimated_budget, estimated_timeline,
  future_improvements, success_metrics) VALUES
('Ramadan 2026 GCC Campaign',
 'Seasonal Ramadan campaign with special fares and Skywards bonus miles for GCC markets',
 'Ramadan campaign requires cultural sensitivity, localized content, and rapid multi-market deployment',
 'Phased approach: pre-Ramadan teasers → main offers → Eid follow-up',
 'strategic', 'In Progress', 'campaign',
 '["Previous Ramadan campaigns launched too late, losing early bookers to competitors","Content localization bottleneck — Arabic copy takes 3x longer than English","GCC market preferences vary significantly between KSA and UAE"]',
 '["Pre-Ramadan launch (4 weeks before start)","Market-specific content for KSA, UAE, Kuwait","Arabic-first creative with RTL templates","Skywards Ramadan bonus miles promotion","Family travel packages with child-friendly routing"]',
 '["Exact Ramadan start date depends on moon sighting — need flexible launch trigger","KSA market regulatory requirements for promotional disclaimers","Budget pressure from competing Q2 campaigns"]',
 9.50, '8 weeks',
 '["Real-time personalization based on individual Ramadan travel history","WhatsApp channel for GCC markets","AI-generated culturally-aware content variants per sub-market"]',
 '["Campaign launch >3 weeks before Ramadan start","Open rate >28% in KSA, >24% in UAE","Booking revenue >$3.2M across GCC markets","Skywards engagement uplift >20% during campaign period","Cultural sensitivity audit score: 0 violations"]'
);

-- Project 5: Skywards 25th Anniversary
INSERT INTO projects (name, description, problem, solution, department, status, type,
  pain_points, requirements, risks, estimated_budget, estimated_timeline,
  future_improvements, success_metrics) VALUES
('Skywards 25th Anniversary',
 'Global celebration campaign for Skywards loyalty program milestone',
 'Need a premium multi-channel campaign that reinforces brand loyalty and drives re-engagement',
 'Tiered rewards unlock + exclusive member experiences + retrospective storytelling',
 'strategic', 'Planning', 'campaign',
 '["Anniversary campaigns risk being purely nostalgic without driving revenue","Multi-channel coordination across 14 markets is operationally complex","Need to balance celebration messaging with commercial offers"]',
 '["Global multi-channel campaign (email, push, social, in-flight)","Tiered rewards unlock for each Skywards tier","25th anniversary exclusive experiences catalog","Retrospective storytelling content series","Celebrity/influencer partnership integration"]',
 '["SFMC infrastructure may not handle projected 4M sends/day volume","Brand messaging dilution across too many markets simultaneously","Budget approval pending — Q2 planning may be delayed"]',
 10.00, '12 weeks',
 '["Convert anniversary momentum into permanent loyalty program enhancements","Build member-generated content platform for ongoing engagement","Launch anniversary-inspired permanent tier benefits"]',
 '["Global reach >5M unique recipients","Engagement rate >35% across all channels","Anniversary offer redemption >100K members","Brand awareness uplift >15% in key markets","Skywards new enrollments >50K during campaign period","Social media impressions >25M"]'
);

-- Project 6: Email Template Modernization
INSERT INTO projects (name, description, problem, solution, department, status, type,
  pain_points, requirements, risks, estimated_budget, estimated_timeline,
  future_improvements, success_metrics) VALUES
('Email Template Modernization',
 'Upgrade all email templates to new responsive design system with dark mode support',
 'Current templates are 3+ years old, poor mobile rendering, no dark mode',
 'New modular template library with reusable content blocks and responsive breakpoints',
 'execution', 'In Progress', 'general',
 '["Current templates are 3+ years old with poor mobile rendering","No dark mode support — 40% of opens now on dark mode clients","Template build time averages 2 days per campaign variant","Inconsistent design across markets creates brand fragmentation"]',
 '["Responsive design with breakpoints for mobile, tablet, desktop","Dark mode support for Apple Mail, Gmail, Outlook","Modular content block library (12+ reusable blocks)","RTL support for Arabic markets","Cross-client rendering validation (Outlook, Gmail, Apple Mail)"]',
 '["Migration of active campaigns to new templates may cause rendering issues","Training gap — team needs to learn new block-based workflow","Legacy template dependencies in active Journey Builder flows"]',
 45000, '10 weeks',
 '["AI-powered template selection based on campaign type","Dynamic content blocks that adapt to recipient preferences","AMP for Email interactive elements (carousels, forms)"]',
 '["Template build time reduced from 2 days to 4 hours","Mobile rendering score >95% across top 5 email clients","Dark mode compatibility for 100% of new templates","Template reuse rate >60% across campaigns","Click-through rate improvement >10% vs legacy templates"]'
);

-- Project 7: Flash Sale Automation Framework
INSERT INTO projects (name, description, problem, solution, department, status, type,
  pain_points, requirements, risks, estimated_budget, estimated_timeline,
  future_improvements, success_metrics) VALUES
('Flash Sale Automation Framework',
 'Build reusable rapid-deploy pipeline for flash sales — target <4h from brief to send',
 'Flash sales currently take 2-3 days to deploy, missing revenue windows',
 'Pre-approved template + automated segment selection + expedited approval flow',
 'execution', 'Completed', 'general',
 '["Flash sales currently take 2-3 days to deploy, missing revenue windows","Manual segment selection causes errors and delays","No pre-approved template pipeline — each sale needs full creative cycle","Approval bottleneck with 4+ stakeholders for each flash sale"]',
 '["Pre-approved flash sale template library","Automated segment selection based on route and market","Expedited 2-person approval flow (vs standard 4-person)","<4 hour deployment target from brief to send","Real-time inventory integration for fare accuracy"]',
 '["Rushed deployment may bypass brand compliance checks","Fare accuracy errors in automated pipeline could cause revenue loss","Over-frequent flash sales may train customers to wait for discounts"]',
 55000, '6 weeks',
 '["AI-triggered flash sales based on inventory and demand signals","Dynamic pricing integration for real-time fare optimization","Automated post-sale performance reporting within 24 hours"]',
 '["Deployment time <4 hours from brief to send","Revenue per flash sale >$500K","Zero fare accuracy errors in automated pipeline","Booking conversion rate >5%","Framework reuse across >3 markets per quarter"]'
);

-- Project 8: Brand Compliance Auto-Scoring
INSERT INTO projects (name, description, problem, solution, department, status, type,
  pain_points, requirements, risks, estimated_budget, estimated_timeline,
  future_improvements, success_metrics) VALUES
('Brand Compliance Auto-Scoring',
 'Automated brand compliance scoring for all outgoing communications',
 'Manual brand reviews are bottleneck — Sofia reviews 40+ pieces/week',
 'AI-powered compliance scoring with auto-approve for >95% score, manual review for rest',
 'control', 'Planning', 'general',
 '["Manual brand reviews are bottleneck — Sofia reviews 40+ pieces/week","Subjective compliance scoring leads to inconsistent approvals","FR and DE market content frequently has tone violations","Review turnaround time averages 48 hours, slowing campaign launches"]',
 '["AI-powered compliance scoring engine using Emirates brand guidelines","Auto-approve threshold (>95% score) for low-risk content","Manual review queue for scores between 80-95%","Auto-reject with feedback for scores <80%","Multi-language support (EN, AR, DE, FR)"]',
 '["AI model may miss nuanced cultural tone issues","Over-reliance on automation could reduce human brand expertise","False positives could slow down campaign deployment"]',
 75000, '10 weeks',
 '["Real-time compliance scoring in content creation workflow","Visual compliance extension for image and layout review","Predictive compliance scoring during content drafting"]',
 '["Compliance review turnaround reduced from 48h to <2h for auto-approved content","Brand compliance rate maintained >96%","Manual review volume reduced by 60%","Zero brand incidents from auto-approved content","Sofia review queue reduced from 40+/week to <15/week"]'
);

-- Project 9: GDPR Consent Refresh Engine
INSERT INTO projects (name, description, problem, solution, department, status, type,
  pain_points, requirements, risks, estimated_budget, estimated_timeline,
  future_improvements, success_metrics) VALUES
('GDPR Consent Refresh Engine',
 'Proactive re-consent collection system for EU markets',
 'Consent expiry causing audience shrinkage in EU markets — 15% contacts at risk',
 'Automated consent lifecycle tracking + multi-touch re-consent journeys',
 'control', 'In Progress', 'general',
 '["15% of EU contacts at risk of consent expiry","No proactive re-consent mechanism — contacts lost silently","Manual tracking of consent dates across multiple data extensions","Re-consent emails have historically low engagement (<5% response rate)"]',
 '["Automated consent lifecycle tracking per contact","Multi-touch re-consent journey (3 touches before expiry)","Market-specific compliance (GDPR, UK GDPR post-Brexit, UWG for DE)","Consent status dashboard with real-time expiry forecasting","Preference center integration for granular consent management"]',
 '["Aggressive re-consent outreach may increase unsubscribe rates","Regulatory interpretation differences between EU markets","Data synchronization lag between CRM and consent database"]',
 60000, '8 weeks',
 '["Predictive consent decay modeling — trigger re-consent before risk","Cross-channel consent synchronization (email, push, SMS)","Automated regulatory compliance updates when laws change"]',
 '["Consent recovery rate >25% of at-risk contacts","EU addressable audience maintained within 2% of current size","Re-consent journey response rate >12%","Zero GDPR compliance incidents","Consent expiry forecast accuracy >90%"]'
);

-- Project 10: Q1 Performance Analytics Dashboard
INSERT INTO projects (name, description, problem, solution, department, status, type,
  pain_points, requirements, risks, estimated_budget, estimated_timeline,
  future_improvements, success_metrics) VALUES
('Q1 Performance Analytics',
 'Comprehensive Q1 EMEA performance report with attribution modeling',
 'Stakeholders lack unified view of cross-market campaign performance',
 'Unified analytics dashboard with market comparison, channel attribution, and ROI tracking',
 'control', 'Completed', 'general',
 '["Stakeholders lack unified view of cross-market campaign performance","Attribution modeling is manual and inconsistent across markets","Report generation takes 3+ days per quarter","No real-time KPI anomaly detection"]',
 '["Unified analytics dashboard covering UK, DE, FR, KSA, UAE markets","Channel attribution modeling (email, push, web)","Automated KPI anomaly detection with alerting","Executive-ready report generation with visualizations","Market comparison and benchmarking capabilities"]',
 '["Data quality issues across different market tracking implementations","Attribution model accuracy depends on consistent UTM tagging","Stakeholder expectations may exceed what data supports"]',
 40000, '6 weeks',
 '["Real-time streaming analytics dashboard","Predictive performance modeling for future campaigns","Automated insight generation using AI summarization"]',
 '["Report generation time reduced from 3 days to <4 hours","Dashboard adoption by >80% of stakeholders","KPI anomaly detection catches >90% of significant deviations","Cross-market comparison available for all active campaigns","Executive satisfaction score >4.5/5 on report quality"]'
);

-- Phases and Tasks for Project 3 (DXB-MAN Route Launch)
INSERT INTO phases (project_id, phase_number, name, objective) VALUES
(3, 1, 'Strategy & Briefing', 'Define campaign objectives, audience segments, and creative direction'),
(3, 2, 'Content & Build', 'Create all campaign assets — copy, templates, and automation flows'),
(3, 3, 'QA & Launch', 'Test, approve, and deploy the campaign');

-- Tasks for Phase 1 of DXB-MAN
INSERT INTO tasks (phase_id, description, agent, effort, status, priority) VALUES
(1, 'Create campaign brief with KPIs and timeline', 'raul', 'M', 'Done', 'High'),
(1, 'Build UK_Travelers_Active_180D audience segment', 'diego', 'M', 'Done', 'High'),
(1, 'Validate GDPR compliance for UK market targeting', 'javier', 'S', 'Done', 'High'),
(1, 'Reserve calendar slots for 3-wave send schedule', 'martina', 'S', 'In Progress', 'Medium');

-- Tasks for Phase 2 of Project 3
INSERT INTO tasks (phase_id, description, agent, effort, status, priority) VALUES
(2, 'Draft subject lines and body copy — EN + AR variants', 'lucia', 'L', 'In Progress', 'High'),
(2, 'Build responsive email template with route imagery', 'html-developer', 'L', 'In Progress', 'High'),
(2, 'Configure Journey Builder flow — announcement + reminder + launch', 'andres', 'L', 'Todo', 'High'),
(2, 'Set up A/B test for subject line variants', 'andres', 'M', 'Todo', 'Medium');

-- Tasks for Phase 3 of Project 3
INSERT INTO tasks (phase_id, description, agent, effort, status, priority) VALUES
(3, 'Brand compliance review of all creative assets', 'sofia', 'M', 'Todo', 'High'),
(3, 'QA rendering across email clients + spam score check', 'elena', 'M', 'Todo', 'High'),
(3, 'Final stakeholder sign-off and campaign activation', 'raul', 'S', 'Todo', 'Critical');

-- Phases and Tasks for Project 4 (Ramadan 2026 GCC Campaign)
INSERT INTO phases (project_id, phase_number, name, objective) VALUES
(4, 1, 'Cultural Planning', 'Research Ramadan calendar, cultural nuances, and market-specific requirements'),
(4, 2, 'Content Creation', 'Produce culturally sensitive content in Arabic and English'),
(4, 3, 'Deployment & Tracking', 'Deploy across GCC markets and track performance');

INSERT INTO tasks (phase_id, description, agent, effort, status, priority) VALUES
(4, 'Research Ramadan dates and market-specific customs for KSA, UAE', 'raul', 'M', 'Done', 'High'),
(4, 'Define GCC audience segments with Ramadan-specific filters', 'diego', 'M', 'Done', 'High'),
(4, 'Plan 3-phase cadence: pre-Ramadan, Ramadan offers, Eid', 'martina', 'M', 'In Progress', 'High'),
(5, 'Write Arabic-first copy with cultural sensitivity review', 'lucia', 'L', 'In Progress', 'High'),
(5, 'Build Ramadan-themed email templates with RTL support', 'html-developer', 'L', 'Todo', 'High'),
(5, 'Validate religious/cultural compliance of all assets', 'sofia', 'M', 'Todo', 'Critical'),
(6, 'Configure market-specific journey flows for KSA and UAE', 'andres', 'L', 'Todo', 'High'),
(6, 'Set up real-time performance tracking dashboards', 'carlos', 'M', 'Todo', 'Medium');

-- Phases for Project 6 (Email Template Modernization)
INSERT INTO phases (project_id, phase_number, name, objective) VALUES
(6, 1, 'Audit & Design', 'Audit existing templates and design new modular system'),
(6, 2, 'Development', 'Build new templates with responsive framework'),
(6, 3, 'Migration', 'Migrate active campaigns to new templates');

INSERT INTO tasks (phase_id, description, agent, effort, status, priority) VALUES
(7, 'Audit all 42 existing templates — categorize by usage and quality', 'html-developer', 'L', 'Done', 'High'),
(7, 'Design new modular block system with 12 reusable components', 'html-developer', 'L', 'In Progress', 'High'),
(7, 'Define brand-compliant color palette and typography for dark mode', 'sofia', 'M', 'In Progress', 'Medium'),
(8, 'Build 6 core template layouts with responsive breakpoints', 'html-developer', 'L', 'In Progress', 'High'),
(8, 'Cross-client rendering tests (Outlook, Gmail, Apple Mail, dark mode)', 'elena', 'L', 'Todo', 'High'),
(9, 'Migrate top 10 active campaigns to new template system', 'html-developer', 'L', 'Todo', 'High'),
(9, 'Deprecate legacy templates and update documentation', 'doc-agent', 'M', 'Todo', 'Medium');

-- ─── WEEKLY SESSIONS ─────────────────────────────────────────────────────────

INSERT INTO weekly_sessions (department, session_date, week_number, status, steps_data) VALUES
('strategic', '2026-03-09', 11, 'completed', '{"review": {"status": "completed"}, "brainstorm": {"status": "completed"}, "prioritize": {"status": "completed"}}'),
('execution', '2026-03-09', 11, 'active', '{"review": {"status": "completed"}, "brainstorm": {"status": "in_progress"}, "prioritize": {"status": "pending"}}'),
('control', '2026-03-09', 11, 'active', '{"review": {"status": "completed"}, "brainstorm": {"status": "pending"}, "prioritize": {"status": "pending"}}');

-- ─── WEEKLY BRAINSTORMS ──────────────────────────────────────────────────────

INSERT INTO weekly_brainstorms (weekly_session_id, agent_id, contribution_type, content, context) VALUES
(1, 'raul', 'proposal', 'Propose launching Skywards 25th Anniversary campaign in Q2 — align with summer travel peak for maximum impact.', '{"campaign": "Skywards Anniversary", "estimated_reach": "2.5M members"}'),
(1, 'valentina', 'insight', 'CRM data shows 23% of Gold members havent engaged in 90 days. Recommend targeted re-engagement before anniversary campaign.', '{"segment": "Gold_Inactive_90D", "size": 34500}'),
(1, 'guillermo', 'concern', 'Current SFMC infrastructure may not handle projected anniversary campaign volume (est. 4M sends/day). Need capacity planning.', '{"current_capacity": "2M/day", "required": "4M/day"}'),
(2, 'lucia', 'proposal', 'Create a modular copy library for route launches — reduce creation time from 3 days to 4 hours per market.', '{"current_time": "3 days", "target_time": "4 hours"}'),
(2, 'andres', 'improvement', 'Journey Builder templates should include pre-configured A/B test splits — currently set up manually each time.', '{"affected_workflows": ["campaign-creation", "ab-test-pipeline"]}'),
(2, 'html-developer', 'proposal', 'New responsive email framework with dark mode support ready for review. Reduces template build time by 60%.', '{"templates_ready": 6, "time_reduction": "60%"}'),
(3, 'sofia', 'insight', 'Brand compliance rate dropped to 94% this week — 3 pieces had tone violations in the FR market. Need refresher training.', '{"compliance_rate": "94%", "violations": 3, "market": "FR"}'),
(3, 'elena', 'concern', 'Spam scores increasing on DE market sends — need deliverability audit before next campaign wave.', '{"avg_spam_score": 4.2, "threshold": 5.0, "market": "DE"}'),
(3, 'carlos', 'insight', 'UK market A/B tests show 22% better open rates with personalized subject lines vs generic. Recommend as default strategy.', '{"uplift": "22%", "sample_size": 15000, "market": "UK"}');

-- ─── WORKFLOW RUNS ───────────────────────────────────────────────────────────

INSERT INTO workflow_runs (workflow_id, status, triggered_by, started_at, completed_at, duration_ms, output_summary) VALUES
('campaign-creation', 'completed', 'user', NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days' + INTERVAL '45 minutes', 2700000, 'Successfully created DXB-MAN Route Launch campaign — 3 email variants generated, segments built, journey configured.'),
('campaign-creation', 'completed', 'user', NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days' + INTERVAL '52 minutes', 3120000, 'Ramadan GCC Campaign created — Arabic and English copy variants, GCC audience segments, 3-phase journey deployed.'),
('flash-sale-rapid-deploy', 'completed', 'user', NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days' + INTERVAL '3 hours', 10800000, 'Spring Flash Sale deployed in 2h 47m — 3 markets (UK, DE, FR), pre-approved templates used.'),
('weekly-performance-digest', 'completed', 'schedule', NOW() - INTERVAL '7 days', NOW() - INTERVAL '7 days' + INTERVAL '12 minutes', 720000, 'Week 10 digest: 18% avg open rate, UK market leading at 24%. 3 campaigns active, 2 completed.'),
('weekly-performance-digest', 'completed', 'schedule', NOW() - INTERVAL '14 hours', NOW() - INTERVAL '14 hours' + INTERVAL '10 minutes', 600000, 'Week 11 digest: 21% avg open rate (+3pp WoW). Ramadan GCC pre-campaign showing strong preview engagement.'),
('brand-audit-cycle', 'completed', 'user', NOW() - INTERVAL '4 days', NOW() - INTERVAL '4 days' + INTERVAL '30 minutes', 1800000, 'Monthly brand audit complete: 96% compliance rate. 2 tone violations flagged in FR market, corrected and re-approved.'),
('ab-test-pipeline', 'completed', 'user', NOW() - INTERVAL '6 days', NOW() - INTERVAL '6 days' + INTERVAL '2 hours', 7200000, 'A/B test for UK Skywards upgrade — personalized subject line won with 22% higher open rate. Winner deployed.'),
('doc-audit', 'completed', 'agent', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day' + INTERVAL '18 minutes', 1080000, 'Documentation audit: 78% coverage. 4 campaigns missing specs, 6 pages outdated. Gap report posted to Control inbox.'),
('audience-hygiene-cleanup', 'failed', 'user', NOW() - INTERVAL '8 hours', NULL, NULL, NULL),
('email-deliverability-check', 'running', 'user', NOW() - INTERVAL '25 minutes', NULL, NULL, NULL);

-- Update the failed workflow run with error info
UPDATE workflow_runs SET error = 'Connection timeout to Salesforce MC data extension API — retry scheduled' WHERE workflow_id = 'audience-hygiene-cleanup' AND status = 'failed';

-- ─── PM REPORTS ──────────────────────────────────────────────────────────────

INSERT INTO pm_reports (title, summary, body_md, metrics, risks, next_steps) VALUES
('Week 10 — EMEA Campaign Performance', 'Strong week with UK market outperforming benchmarks. Ramadan prep on track. Template modernization hitting milestones.',
'## Weekly Summary\n\n### Highlights\n- UK Skywards upgrade campaign: **18% uplift** vs control\n- Flash Sale framework completed — now operational\n- 3 new audience segments validated for GCC markets\n\n### Active Campaigns\n| Campaign | Market | Status | Open Rate |\n|----------|--------|--------|-----------|\n| Skywards Silver Upgrade | DE | Live | 19.2% |\n| Spring Flash Sale | UK/DE/FR | Completed | 24.1% |\n| Ramadan Pre-Campaign | GCC | Building | — |\n\n### Agent Productivity\n- 13 agents active, 0 blockers reported\n- Average task completion: 4.2 tasks/agent/day',
'{"open_rate_avg": 21.3, "campaigns_active": 3, "campaigns_completed": 2, "agent_tasks_completed": 47, "compliance_rate": 96}',
'["SFMC capacity may be insufficient for anniversary campaign volume (est. 4M sends/day)", "FR market brand compliance dropped to 94% — needs attention", "DE spam scores trending up — deliverability audit recommended"]',
'["Complete DXB-MAN Route Launch campaign build", "Finalize Ramadan GCC content and get cultural sign-off", "Start Skywards 25th Anniversary strategic brief", "Run deliverability audit for DE market"]'),

('Week 9 — Q1 Close & Planning', 'Q1 wrap-up with strong performance across markets. Q2 planning initiated with focus on loyalty and seasonal campaigns.',
'## Weekly Summary\n\n### Q1 Results\n- Total campaigns deployed: **14**\n- Average open rate: **19.8%** (vs 17.2% industry benchmark)\n- Best performing: UK Flash Sale at **26.3%** open rate\n- Audience growth: **+12%** net new opt-ins across EU markets\n\n### Q2 Priorities\n1. Skywards 25th Anniversary (May launch)\n2. Summer Route Launches (June-July)\n3. Template Modernization completion\n4. GDPR Consent Refresh for EU markets',
'{"open_rate_avg": 19.8, "campaigns_deployed": 14, "audience_growth": 12, "agent_tasks_completed": 89, "compliance_rate": 98}',
'["Template modernization timeline tight — need to parallelize development and migration", "Q2 budget approval pending for anniversary campaign"]',
'["Kick off Q2 campaign calendar planning", "Start Skywards anniversary brief", "Accelerate template modernization Phase 2"]');

-- ─── MORE AUDIT LOG ENTRIES ──────────────────────────────────────────────────

INSERT INTO audit_log (event_type, department, agent_id, title, details) VALUES
('workflow_completed', 'execution', 'andres', 'Flash Sale Rapid Deploy — Spring EU Routes', '{"workflow": "flash-sale-rapid-deploy", "duration_minutes": 167, "markets": ["UK", "DE", "FR"]}'),
('campaign_launched', 'execution', 'andres', 'Ramadan GCC Pre-Campaign — Teaser Wave', '{"campaign": "Ramadan_GCC_Teaser_2026", "segment_size": 128000, "channels": ["email"]}'),
('segment_created', 'execution', 'diego', 'UK_Travelers_Active_180D — Route Launch Audience', '{"segment_id": "UK_Travelers_Active_180D", "size": 67432, "criteria": "UK market + travel 180d + opted-in"}'),
('compliance_review', 'control', 'javier', 'GDPR re-consent audit — DE market', '{"market": "DE", "contacts_reviewed": 45000, "at_risk": 6750, "action": "re-consent journey triggered"}'),
('report_generated', 'control', 'carlos', 'Weekly Performance Digest — Week 11', '{"markets": ["UK", "DE", "FR", "KSA", "UAE"], "avg_open_rate": "21.3%", "campaigns_active": 3}'),
('workflow_completed', 'control', 'doc-agent', 'Documentation Audit — Q1 Coverage Report', '{"coverage": "78%", "missing_docs": 4, "outdated_pages": 6, "recommendations": 8}')
