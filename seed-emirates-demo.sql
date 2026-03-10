-- ============================================================
-- Emirates Demo Content — Full Seed Data
-- Run AFTER seed-emirates.sql:
--   psql -h localhost -p 5433 -U agentos -d agentos -f seed-emirates-demo.sql
-- ============================================================

-- ─── SECTION 0: CLEAN CONTENT TABLES (preserve agents + workspace_config) ────

DELETE FROM collaboration_raises;
DELETE FROM agent_memory;
DELETE FROM weekly_brainstorms;
DELETE FROM raw_events;
DELETE FROM eod_reports;
DELETE FROM workflow_runs;
DELETE FROM pm_reports;
DELETE FROM audit_log;
DELETE FROM inbox_items;
DELETE FROM tasks;
DELETE FROM phases;
DELETE FROM projects;
DELETE FROM weekly_sessions;

-- ─── SECTION 1: RESET SEQUENCES ─────────────────────────────────────────────

ALTER SEQUENCE projects_id_seq RESTART WITH 1;
ALTER SEQUENCE phases_id_seq RESTART WITH 1;
ALTER SEQUENCE tasks_id_seq RESTART WITH 1;
ALTER SEQUENCE weekly_sessions_id_seq RESTART WITH 1;
ALTER SEQUENCE weekly_brainstorms_id_seq RESTART WITH 1;
ALTER SEQUENCE inbox_items_id_seq RESTART WITH 1;
ALTER SEQUENCE eod_reports_id_seq RESTART WITH 1;
ALTER SEQUENCE raw_events_id_seq RESTART WITH 1;
ALTER SEQUENCE workflow_runs_id_seq RESTART WITH 1;
ALTER SEQUENCE pm_reports_id_seq RESTART WITH 1;
ALTER SEQUENCE audit_log_id_seq RESTART WITH 1;
ALTER SEQUENCE collaboration_raises_id_seq RESTART WITH 1;
ALTER SEQUENCE agent_memory_id_seq RESTART WITH 1;

-- ─── SECTION 2: PROJECTS ────────────────────────────────────────────────────

-- Project 1: Ramadan 2026 Campaign Suite
INSERT INTO projects (name, description, problem, solution, department, sub_area, success_metrics, blocks, pain_points, requirements, risks, estimated_budget, estimated_timeline, future_improvements, status) VALUES
('Ramadan 2026 Campaign Suite',
 'Multi-market Ramadan campaign targeting GCC, UK, and DE Skywards members with personalized fare offers, Iftar lounge promotions, and bonus miles incentives.',
 'Ramadan campaigns historically underperform due to late planning, inconsistent messaging across markets, and lack of personalization by Skywards tier.',
 'Deploy a 4-phase orchestrated campaign with tier-specific offers, culturally sensitive multilingual content, and automated journey flows triggered by member engagement signals.',
 'strategic', 'Seasonal Marketing',
 '["Achieve 32% open rate across GCC markets","15% conversion on Skywards bonus miles offers","Reduce campaign setup time by 50% vs Ramadan 2025","Zero brand compliance violations"]',
 '["Awaiting Arabic creative assets from design team","Skywards API rate limits during peak hours"]',
 '["Manual coordination across 4 markets slows launch","Inconsistent Ramadan messaging tone across regions","Late stakeholder approvals delay send windows"]',
 '["Multilingual content in EN, AR, DE","Skywards tier-based personalization","GDPR-compliant consent for DE market","Cultural sensitivity review for all GCC content"]',
 '["Ramadan dates overlap with school holidays in some markets","API rate limits during peak engagement windows","Arabic RTL rendering issues in older email clients"]',
 7, '6 weeks',
 '["AI-powered send-time optimization per market","Dynamic content blocks based on real-time fare availability","Automated cultural sensitivity scoring"]',
 'Completed');

-- Project 2: Skywards Gold to Platinum Conversion
INSERT INTO projects (name, description, problem, solution, department, sub_area, success_metrics, blocks, pain_points, requirements, risks, estimated_budget, estimated_timeline, future_improvements, status) VALUES
('Skywards Gold to Platinum Conversion Program',
 'Targeted lifecycle campaign to convert high-engagement Gold members to Platinum tier through personalized upgrade incentives and exclusive experience previews.',
 'Gold-to-Platinum conversion rate has stagnated at 4.2% despite a growing Gold member base. Current campaigns use generic messaging without behavioral triggers.',
 'Build a multi-touch journey triggered by booking patterns, lounge usage, and engagement scores. Deliver tier-specific previews of Platinum benefits with personalized upgrade paths.',
 'strategic', 'Loyalty Programs',
 '["Increase Gold-to-Platinum conversion from 4.2% to 6.5%","25% engagement rate on Platinum benefit previews","Reduce time-to-upgrade by 30 days on average"]',
 '["Loyalty tier data refresh delay — 48h lag from Skywards API"]',
 '["Generic upgrade messaging yields low engagement","No behavioral triggers in current journey","Platinum benefit previews not personalized to travel patterns"]',
 '["Real-time Skywards tier and miles data","Booking history for last 12 months","Lounge access frequency data","Personalized benefit calculator"]',
 '["Data privacy concerns with detailed behavioral profiling","Skywards API latency during tier recalculation periods","Risk of cannibalizing paid upgrade revenue"]',
 8, '8 weeks',
 '["Predictive tier upgrade scoring model","Real-time benefit calculator in email","Chauffeur-drive experience preview videos"]',
 'Completed');

-- Project 3: Dubai-Tokyo Route Launch
INSERT INTO projects (name, description, problem, solution, department, sub_area, success_metrics, blocks, pain_points, requirements, risks, estimated_budget, estimated_timeline, future_improvements, status) VALUES
('Dubai-Tokyo Route Launch Campaign',
 'Full-funnel marketing campaign for the new DXB-NRT daily service launching August 2026. Targeting business travelers, leisure segments, and Skywards members with Japan travel interest.',
 'New route launches require coordinated campaigns across 6+ markets with tight timelines. Previous launches suffered from fragmented messaging and missed send windows.',
 'Orchestrate a unified launch campaign with market-specific content, dynamic fare displays, Japan destination content, and automated booking confirmation journeys.',
 'execution', 'Route Launch',
 '["85% seat fill rate within first 90 days","45% open rate on launch announcement emails","10,000 bookings attributed to email channel in first month","Zero compliance issues across all markets"]',
 '["Final fare structure pending revenue management approval","Japan destination photography not yet available"]',
 '["Route launch campaigns require coordination across too many teams","Fare availability changes frequently before launch","Market-specific regulatory requirements add complexity"]',
 '["Confirmed fare structure and booking classes","Japan destination content and imagery","Market-specific regulatory disclaimers","Skywards earning rates for DXB-NRT"]',
 '["Fare changes after content production requires rework","Competitor route announcements may dilute impact","Japan travel advisories could affect demand"]',
 9, '10 weeks',
 '["Dynamic fare insertion from live inventory","AI-generated destination guides personalized to traveler type","Automated social proof (X passengers booked today)"]',
 'Planning');

-- Project 4: Post-Flight NPS Recovery Automation
INSERT INTO projects (name, description, problem, solution, department, sub_area, success_metrics, blocks, pain_points, requirements, risks, estimated_budget, estimated_timeline, future_improvements, status) VALUES
('Post-Flight NPS Recovery Automation',
 'Automated journey to recover detractor NPS scores through personalized apology flows, service recovery offers, and escalation to customer care when needed.',
 'NPS detractors (score 0-6) currently receive a generic follow-up email 72 hours post-survey. Recovery rate is only 12% and many detractors churn within 6 months.',
 'Deploy real-time triggered journeys based on NPS score bands. Detractors receive immediate personalized acknowledgment, tier-appropriate service recovery offers, and automated escalation for scores below 3.',
 'control', 'Customer Experience',
 '["Increase NPS detractor recovery rate from 12% to 40%","Reduce detractor-to-churn rate by 25%","Achieve sub-2-hour response time for critical detractors (score 0-3)"]',
 '[]',
 '["Generic recovery messaging fails to address specific complaints","72-hour delay loses the recovery window","No escalation path for severe detractors"]',
 '["Real-time NPS survey response feed","Flight and service incident data","Skywards tier and lifetime value data","Customer care team capacity API"]',
 '["Over-generous recovery offers could be exploited","Automation errors could worsen detractor sentiment","Customer care team capacity constraints during peak periods"]',
 6, '5 weeks',
 '["Sentiment analysis on survey free-text comments","Predictive churn scoring for at-risk members","Automated root cause categorization"]',
 'In Progress');

-- Project 5: Summer 2026 Fare Campaign (Completed)
INSERT INTO projects (name, description, problem, solution, department, sub_area, success_metrics, blocks, pain_points, requirements, risks, estimated_budget, estimated_timeline, future_improvements, status) VALUES
('Summer 2026 Fare Campaign',
 'Multi-market summer fare promotion across European and GCC routes with tiered discounts for Skywards members and early booking incentives.',
 'Summer fare campaigns have historically launched too late to capture early planners, resulting in 20% lower booking conversion compared to competitors.',
 'Launched an early-bird campaign in February with progressive urgency messaging, tier-based fare visibility, and automated reminder sequences for abandoned searches.',
 'execution', 'Promotional',
 '["32% open rate achieved (target: 28%)","18% booking conversion (target: 12%)","Revenue: $4.2M attributed to email (target: $3M)","Campaign launched 3 weeks ahead of schedule"]',
 '[]',
 '["Late launches miss early planners","Generic pricing without tier benefits","No automated follow-up for abandoned searches"]',
 '["Dynamic fare feeds from revenue management","Market-specific pricing and disclaimers","Skywards tier-based fare visibility rules"]',
 '[]',
 5, '8 weeks (completed in 5)',
 '["Real-time competitor fare comparison","AI-optimized discount tiers based on demand forecasting"]',
 'Completed');

-- Project 6: GDPR Consent Re-permission (DE/FR)
INSERT INTO projects (name, description, problem, solution, department, sub_area, success_metrics, blocks, pain_points, requirements, risks, estimated_budget, estimated_timeline, future_improvements, status) VALUES
('GDPR Consent Re-permission Campaign (DE/FR)',
 'Re-permission campaign for German and French Skywards members whose marketing consent is expiring or ambiguous under updated GDPR interpretations.',
 '23% of DE and 18% of FR Skywards members have consent records older than 24 months or flagged as ambiguous by the latest GDPR audit.',
 'Deploy a transparent, value-led re-permission journey highlighting exclusive Skywards benefits of staying opted-in, with clear unsubscribe options and progressive consent capture.',
 'control', 'Compliance',
 '["Re-permission rate above 65% for contacted members","Zero regulatory complaints from campaign","Full audit trail for all consent changes"]',
 '["Legal review of DE-specific UWG requirements pending","FR CNIL guidance update expected mid-March"]',
 '["Consent records are fragmented across systems","Members may perceive re-permission as spam","Regulatory requirements differ between DE and FR"]',
 '["Updated consent taxonomy aligned with GDPR Art.7","DE UWG and FR CNIL compliance review","Skywards benefit messaging to incentivize opt-in","Full audit logging for all consent state changes"]',
 '["Low re-permission rates could shrink addressable audience significantly","Regulatory complaint if messaging is perceived as coercive","Technical risk with consent state synchronization across systems"]',
 6800, '4 weeks',
 '["Automated consent health monitoring dashboard","Predictive consent decay scoring","Progressive preference center with granular channel controls"]',
 'Planning');

-- Project 7: Emirates App Push Notification Strategy
INSERT INTO projects (name, description, problem, solution, department, sub_area, success_metrics, blocks, pain_points, requirements, risks, estimated_budget, estimated_timeline, future_improvements, status) VALUES
('Emirates App Push Notification Strategy',
 'Define and implement a comprehensive push notification strategy for the Emirates mobile app, covering booking confirmations, Skywards updates, personalized offers, and flight status.',
 'Push notification opt-in rate is 34% and declining. Current notifications are transactional only with no personalization or behavioral triggers.',
 'Design a permission-first push strategy with progressive opt-in prompts, personalized notification categories, smart frequency capping, and A/B tested messaging frameworks.',
 'strategic', 'Digital Channels',
 '["Increase push opt-in rate from 34% to 55%","Achieve 8% tap-through rate on personalized offers","Reduce push-driven uninstalls by 40%"]',
 '["Mobile app team capacity for SDK integration","Push notification service provider selection pending"]',
 '["Low opt-in rate limits addressable audience","No personalization in current push messages","Frequency not managed — leads to notification fatigue and uninstalls"]',
 '["Push notification SDK integration with Emirates app","Skywards tier and preference data for personalization","Frequency capping rules by notification category","A/B testing framework for push content"]',
 '["Aggressive push frequency could increase uninstall rate","Personalization errors could expose wrong tier data","SDK integration delays from mobile team"]',
 22000, '12 weeks',
 '["Rich media push notifications with embedded booking widgets","AI-powered optimal send time per user timezone","In-app notification center with read/archive functionality"]',
 'Planning');

-- Project 8: Skywards Welcome Journey Redesign
INSERT INTO projects (name, description, problem, solution, department, sub_area, success_metrics, blocks, pain_points, requirements, risks, estimated_budget, estimated_timeline, future_improvements, status) VALUES
('Skywards Welcome Journey Redesign',
 'Complete redesign of the Skywards new member welcome journey from enrollment through first booking, replacing the current 3-email series with a dynamic 8-touch adaptive journey.',
 'Current welcome journey has a 22% completion rate and only 8% of new members make their first booking within 90 days. The 3-email static series does not adapt to member behavior.',
 'Deploy an adaptive 8-touch journey that responds to member engagement, progressively reveals Skywards benefits, and uses behavioral triggers to deliver the right message at the right moment.',
 'execution', 'Onboarding',
 '["Increase welcome journey completion rate from 22% to 60%","Boost first-booking-within-90-days from 8% to 18%","Achieve 45% open rate across the journey","Reduce journey drop-off at email 2 from 65% to 30%"]',
 '["A/B test framework for journey branching not yet configured"]',
 '["Static 3-email series does not adapt to behavior","High drop-off after email 2 suggests content is not engaging","No personalization based on enrollment source or travel intent"]',
 '["Enrollment source data (web, app, airport, partner)","First search and booking behavior signals","Skywards tier progression rules and benefits catalog","Dynamic content blocks for benefit previews"]',
 '["Journey complexity may increase maintenance burden","Behavioral triggers require reliable event stream","Content production for 8 touches across 4 languages is significant"]',
 10, '7 weeks',
 '["AI-generated personalized benefit highlights based on member profile","Predictive first-booking propensity model","Interactive miles calculator embedded in email"]',
 'In Progress');

-- ─── SECTION 3: PHASES ──────────────────────────────────────────────────────

-- Project 1: Ramadan 2026 (id=1)
INSERT INTO phases (project_id, phase_number, name, objective) VALUES
(1, 1, 'Strategy & Audience Definition', 'Define target segments, KPIs, messaging strategy, and campaign calendar for Ramadan 2026'),
(1, 2, 'Content & Creative Production', 'Produce multilingual creative assets, email templates, and personalized content blocks'),
(1, 3, 'Technical Setup & QA', 'Configure automation flows, journey triggers, and run comprehensive QA across all markets');

-- Project 2: Skywards Gold to Platinum (id=2)
INSERT INTO phases (project_id, phase_number, name, objective) VALUES
(2, 1, 'Behavioral Analysis & Segmentation', 'Analyze Gold member behavior patterns and build high-propensity conversion segments'),
(2, 2, 'Journey Design & Content', 'Design multi-touch upgrade journey with tier-specific content and benefit previews'),
(2, 3, 'Launch & Optimization', 'Deploy journey, monitor conversion metrics, and optimize based on engagement data');

-- Project 3: Dubai-Tokyo Route Launch (id=3)
INSERT INTO phases (project_id, phase_number, name, objective) VALUES
(3, 1, 'Pre-Launch Planning', 'Define target markets, messaging framework, and creative brief for DXB-NRT launch'),
(3, 2, 'Content Production & Localization', 'Create market-specific content with Japan destination storytelling across 4 languages'),
(3, 3, 'Technical Build & Testing', 'Build automation flows, configure dynamic fare blocks, and run cross-market QA');

-- Project 4: Post-Flight NPS Recovery (id=4)
INSERT INTO phases (project_id, phase_number, name, objective) VALUES
(4, 1, 'NPS Data Integration', 'Establish real-time NPS survey response feed and define detractor score bands for trigger logic'),
(4, 2, 'Recovery Journey Design', 'Design automated recovery flows with tier-appropriate offers and escalation paths'),
(4, 3, 'Deployment & Monitoring', 'Deploy recovery automation and establish real-time monitoring dashboards');

-- Project 5: Summer 2026 Fare Campaign (id=5, Completed)
INSERT INTO phases (project_id, phase_number, name, objective) VALUES
(5, 1, 'Campaign Strategy & Planning', 'Define early-bird strategy, market prioritization, and fare tier structure'),
(5, 2, 'Execution & Launch', 'Produce content, build journeys, and launch across all markets'),
(5, 3, 'Performance Analysis & Wrap-up', 'Analyze campaign performance, document learnings, and archive assets');

-- Project 6: GDPR Re-permission (id=6)
INSERT INTO phases (project_id, phase_number, name, objective) VALUES
(6, 1, 'Consent Audit & Legal Review', 'Audit current consent records and align re-permission approach with DE/FR regulations'),
(6, 2, 'Journey Design & Content', 'Design value-led re-permission journey with clear consent capture mechanics'),
(6, 3, 'Deployment & Compliance Monitoring', 'Deploy re-permission campaign with full audit logging and compliance monitoring');

-- Project 7: App Push Strategy (id=7)
INSERT INTO phases (project_id, phase_number, name, objective) VALUES
(7, 1, 'Strategy & SDK Planning', 'Define push notification categories, frequency rules, and SDK integration requirements'),
(7, 2, 'Content Framework & A/B Design', 'Create messaging templates, opt-in prompts, and A/B testing plan'),
(7, 3, 'Implementation & Rollout', 'Integrate SDK, deploy notification flows, and monitor opt-in metrics');

-- Project 8: Welcome Journey Redesign (id=8)
INSERT INTO phases (project_id, phase_number, name, objective) VALUES
(8, 1, 'Journey Mapping & Data Requirements', 'Map the 8-touch adaptive journey and define behavioral trigger data requirements'),
(8, 2, 'Content Production & Personalization', 'Produce content for all journey touches with dynamic personalization blocks'),
(8, 3, 'Technical Build & A/B Testing', 'Build journey in Journey Builder with branching logic and configure A/B tests');

-- ─── SECTION 4: TASKS ───────────────────────────────────────────────────────

-- Project 1, Phase 1 (phase_id=1)
INSERT INTO tasks (phase_id, description, agent, effort, status, type, priority) VALUES
(1, 'Define Ramadan campaign KPIs and success metrics per market', 'raul', 'M', 'Done', 'Task', 'High'),
(1, 'Build GCC Skywards member segments for Ramadan targeting', 'diego', 'L', 'Done', 'Task', 'High'),
(1, 'Analyze Ramadan 2025 campaign performance for benchmarks', 'carlos', 'M', 'Done', 'Task', 'Medium'),
(1, 'Map Ramadan campaign calendar with send windows per market', 'martina', 'M', 'Done', 'Task', 'High'),
(1, 'Review Ramadan messaging for cultural sensitivity guidelines', 'sofia', 'S', 'In Progress', 'Task', 'Critical');

-- Project 1, Phase 2 (phase_id=2)
INSERT INTO tasks (phase_id, description, agent, effort, status, type, priority) VALUES
(2, 'Draft Ramadan email copy in English for GCC and UK markets', 'lucia', 'L', 'In Progress', 'Task', 'High'),
(2, 'Localize Ramadan content to Arabic with RTL email support', 'lucia', 'L', 'Todo', 'Task', 'High'),
(2, 'Design responsive Ramadan email template with dark theme', 'html-developer', 'L', 'Todo', 'Task', 'Medium'),
(2, 'Review all Ramadan copy for Emirates brand compliance', 'sofia', 'M', 'Todo', 'Task', 'Critical');

-- Project 1, Phase 3 (phase_id=3)
INSERT INTO tasks (phase_id, description, agent, effort, status, type, priority) VALUES
(3, 'Configure Journey Builder flows for Ramadan campaign triggers', 'andres', 'L', 'Todo', 'Task', 'High'),
(3, 'Set up A/B test splits for subject line variants per market', 'andres', 'M', 'Todo', 'Task', 'Medium'),
(3, 'Run link validation and rendering tests across email clients', 'elena', 'M', 'Todo', 'Task', 'High'),
(3, 'Validate GDPR compliance for DE market Ramadan sends', 'javier', 'M', 'Todo', 'Task', 'Critical');

-- Project 2, Phase 1 (phase_id=4)
INSERT INTO tasks (phase_id, description, agent, effort, status, type, priority) VALUES
(4, 'Extract Gold member booking and engagement patterns (12 months)', 'valentina', 'L', 'Done', 'Task', 'High'),
(4, 'Build high-propensity Platinum conversion scoring model', 'diego', 'L', 'Done', 'Task', 'High'),
(4, 'Analyze lounge usage correlation with upgrade likelihood', 'carlos', 'M', 'Done', 'Task', 'Medium'),
(4, 'Size target segments per market and validate suppression rules', 'diego', 'M', 'In Progress', 'Task', 'High');

-- Project 2, Phase 2 (phase_id=5)
INSERT INTO tasks (phase_id, description, agent, effort, status, type, priority) VALUES
(5, 'Design 5-touch upgrade journey with behavioral branching', 'andres', 'L', 'In Progress', 'Task', 'High'),
(5, 'Write Platinum benefit preview copy personalized by travel pattern', 'lucia', 'L', 'In Progress', 'Task', 'High'),
(5, 'Review upgrade messaging for brand tone and legal disclaimers', 'sofia', 'M', 'Todo', 'Task', 'Medium');

-- Project 2, Phase 3 (phase_id=6)
INSERT INTO tasks (phase_id, description, agent, effort, status, type, priority) VALUES
(6, 'Deploy conversion journey to initial test segment', 'andres', 'M', 'Todo', 'Task', 'High'),
(6, 'Set up real-time conversion dashboard in Looker Studio', 'carlos', 'M', 'Todo', 'Task', 'Medium'),
(6, 'Optimize journey based on 7-day engagement data', 'raul', 'M', 'Todo', 'Task', 'High');

-- Project 3, Phase 1 (phase_id=7)
INSERT INTO tasks (phase_id, description, agent, effort, status, type, priority) VALUES
(7, 'Define target markets and audience segments for DXB-NRT launch', 'raul', 'M', 'In Progress', 'Task', 'High'),
(7, 'Research Japan destination content angles for each market', 'lucia', 'M', 'Todo', 'Task', 'Medium'),
(7, 'Draft route launch campaign calendar with milestone deadlines', 'martina', 'S', 'Todo', 'Task', 'High');

-- Project 3, Phase 2 (phase_id=8)
INSERT INTO tasks (phase_id, description, agent, effort, status, type, priority) VALUES
(8, 'Create DXB-NRT launch announcement email copy (EN, AR, DE, FR)', 'lucia', 'L', 'Todo', 'Task', 'High'),
(8, 'Build launch audience segments per market with suppression rules', 'diego', 'L', 'Todo', 'Task', 'High'),
(8, 'Design route launch email template with destination imagery', 'html-developer', 'L', 'Todo', 'Task', 'Medium'),
(8, 'Configure dynamic fare insertion blocks from inventory API', 'guillermo', 'L', 'Todo', 'Task', 'High');

-- Project 3, Phase 3 (phase_id=9)
INSERT INTO tasks (phase_id, description, agent, effort, status, type, priority) VALUES
(9, 'Build Journey Builder automation for launch sequence', 'andres', 'L', 'Todo', 'Task', 'High'),
(9, 'Run cross-market QA: links, rendering, disclaimers', 'elena', 'L', 'Todo', 'Task', 'Critical'),
(9, 'Validate regulatory compliance for all 4 market versions', 'javier', 'M', 'Todo', 'Task', 'Critical');

-- Project 4, Phase 1 (phase_id=10)
INSERT INTO tasks (phase_id, description, agent, effort, status, type, priority) VALUES
(10, 'Establish real-time NPS survey response data feed', 'guillermo', 'L', 'Done', 'Task', 'Critical'),
(10, 'Define detractor score bands and trigger thresholds', 'valentina', 'M', 'Done', 'Task', 'High'),
(10, 'Map NPS data to Skywards tier and flight incident records', 'diego', 'M', 'Done', 'Task', 'High');

-- Project 4, Phase 2 (phase_id=11)
INSERT INTO tasks (phase_id, description, agent, effort, status, type, priority) VALUES
(11, 'Design tiered recovery journey with score-band branching', 'andres', 'L', 'In Progress', 'Task', 'High'),
(11, 'Write empathetic recovery messaging for each detractor band', 'lucia', 'M', 'In Progress', 'Task', 'High'),
(11, 'Review recovery offers for brand tone and legal compliance', 'javier', 'M', 'In Progress', 'Task', 'Critical');

-- Project 4, Phase 3 (phase_id=12)
INSERT INTO tasks (phase_id, description, agent, effort, status, type, priority) VALUES
(12, 'Deploy NPS recovery automation to production', 'andres', 'M', 'Todo', 'Task', 'High'),
(12, 'Build real-time recovery rate monitoring dashboard', 'carlos', 'M', 'Todo', 'Task', 'Medium'),
(12, 'Configure escalation rules for scores below 3', 'valentina', 'S', 'Todo', 'Task', 'Critical');

-- Project 5, Phase 1 (phase_id=13, Completed)
INSERT INTO tasks (phase_id, description, agent, effort, status, type, priority) VALUES
(13, 'Define early-bird fare strategy with progressive urgency tiers', 'raul', 'M', 'Done', 'Task', 'High'),
(13, 'Build summer travel intent segments across EU and GCC markets', 'diego', 'L', 'Done', 'Task', 'High'),
(13, 'Analyze previous summer campaign performance by market', 'carlos', 'M', 'Done', 'Task', 'Medium'),
(13, 'Map summer campaign calendar avoiding market conflicts', 'martina', 'M', 'Done', 'Task', 'High');

-- Project 5, Phase 2 (phase_id=14, Completed)
INSERT INTO tasks (phase_id, description, agent, effort, status, type, priority) VALUES
(14, 'Produce summer fare email content for 5 markets', 'lucia', 'L', 'Done', 'Task', 'High'),
(14, 'Build and deploy Journey Builder automation with urgency triggers', 'andres', 'L', 'Done', 'Task', 'High'),
(14, 'Configure dynamic fare display blocks from revenue management feed', 'guillermo', 'L', 'Done', 'Task', 'High'),
(14, 'Run full QA suite: rendering, links, spam score, compliance', 'elena', 'L', 'Done', 'Task', 'Critical');

-- Project 5, Phase 3 (phase_id=15, Completed)
INSERT INTO tasks (phase_id, description, agent, effort, status, type, priority) VALUES
(15, 'Generate post-campaign performance report with attribution analysis', 'carlos', 'L', 'Done', 'Task', 'High'),
(15, 'Document campaign learnings and best practices', 'raul', 'M', 'Done', 'Task', 'Medium'),
(15, 'Archive campaign assets and templates for reuse', 'html-developer', 'S', 'Done', 'Task', 'Low');

-- Project 6, Phase 1 (phase_id=16)
INSERT INTO tasks (phase_id, description, agent, effort, status, type, priority) VALUES
(16, 'Audit DE and FR consent records for expiry and ambiguity flags', 'javier', 'L', 'In Progress', 'Task', 'Critical'),
(16, 'Extract affected member lists with consent status breakdown', 'diego', 'M', 'Todo', 'Task', 'High'),
(16, 'Review updated DE UWG and FR CNIL requirements', 'javier', 'M', 'In Progress', 'Task', 'Critical');

-- Project 6, Phase 2 (phase_id=17)
INSERT INTO tasks (phase_id, description, agent, effort, status, type, priority) VALUES
(17, 'Write value-led re-permission messaging highlighting Skywards benefits', 'lucia', 'M', 'Todo', 'Task', 'High'),
(17, 'Design re-permission journey with progressive consent capture', 'andres', 'M', 'Todo', 'Task', 'High'),
(17, 'Review re-permission content for regulatory compliance', 'javier', 'M', 'Todo', 'Task', 'Critical');

-- Project 6, Phase 3 (phase_id=18)
INSERT INTO tasks (phase_id, description, agent, effort, status, type, priority) VALUES
(18, 'Deploy re-permission campaign with full audit trail logging', 'andres', 'M', 'Todo', 'Task', 'High'),
(18, 'Monitor consent capture rates and regulatory compliance daily', 'javier', 'S', 'Todo', 'Task', 'Critical');

-- Project 7, Phase 1 (phase_id=19)
INSERT INTO tasks (phase_id, description, agent, effort, status, type, priority) VALUES
(19, 'Define push notification categories and frequency caps', 'raul', 'M', 'Todo', 'Task', 'High'),
(19, 'Document SDK integration requirements for mobile app team', 'guillermo', 'L', 'Todo', 'Task', 'High'),
(19, 'Analyze current push opt-in decline trends and causes', 'carlos', 'M', 'Todo', 'Task', 'Medium');

-- Project 7, Phase 2 (phase_id=20)
INSERT INTO tasks (phase_id, description, agent, effort, status, type, priority) VALUES
(20, 'Create push notification copy templates by category', 'lucia', 'M', 'Todo', 'Task', 'High'),
(20, 'Design progressive opt-in prompt sequence', 'lucia', 'M', 'Todo', 'Task', 'High'),
(20, 'Review push content for brand compliance and character limits', 'sofia', 'S', 'Todo', 'Task', 'Medium');

-- Project 7, Phase 3 (phase_id=21)
INSERT INTO tasks (phase_id, description, agent, effort, status, type, priority) VALUES
(21, 'Build push notification automation flows', 'andres', 'L', 'Todo', 'Task', 'High'),
(21, 'Configure A/B tests for opt-in prompts', 'andres', 'M', 'Todo', 'Task', 'Medium'),
(21, 'Set up push performance monitoring dashboard', 'carlos', 'M', 'Todo', 'Task', 'Medium');

-- Project 8, Phase 1 (phase_id=22)
INSERT INTO tasks (phase_id, description, agent, effort, status, type, priority) VALUES
(22, 'Map 8-touch adaptive journey with behavioral branching logic', 'raul', 'L', 'Done', 'Task', 'High'),
(22, 'Define enrollment source data requirements and event triggers', 'guillermo', 'M', 'Done', 'Task', 'High'),
(22, 'Analyze current welcome journey drop-off points and causes', 'carlos', 'M', 'Done', 'Task', 'Medium'),
(22, 'Build new member segments by enrollment source', 'diego', 'M', 'In Progress', 'Task', 'High');

-- Project 8, Phase 2 (phase_id=23)
INSERT INTO tasks (phase_id, description, agent, effort, status, type, priority) VALUES
(23, 'Write welcome journey content for all 8 touches', 'lucia', 'L', 'In Progress', 'Task', 'High'),
(23, 'Design responsive email templates for welcome series', 'html-developer', 'L', 'In Progress', 'Task', 'Medium'),
(23, 'Review welcome content for brand consistency and tone', 'sofia', 'M', 'Todo', 'Task', 'Medium');

-- Project 8, Phase 3 (phase_id=24)
INSERT INTO tasks (phase_id, description, agent, effort, status, type, priority) VALUES
(24, 'Build adaptive journey in Journey Builder with branching', 'andres', 'L', 'Todo', 'Task', 'High'),
(24, 'Configure A/B test framework for journey variants', 'andres', 'M', 'Todo', 'Task', 'Medium'),
(24, 'Run full QA on all 8 journey touches across email clients', 'elena', 'L', 'Todo', 'Task', 'High'),
(24, 'Validate consent and privacy compliance for all markets', 'javier', 'M', 'Todo', 'Task', 'Critical');

-- ─── SECTION 5: EOD REPORTS (14 days, ~8 agents/day) ────────────────────────

-- Day -13 (2 weeks ago)
INSERT INTO eod_reports (agent_id, date, completed_tasks, in_progress_tasks, blockers, insights, mood, plan_tomorrow) VALUES
('raul', CURRENT_DATE - 13, '["Kicked off Q2 campaign planning with department leads","Reviewed Ramadan 2025 post-mortem findings"]', '["Drafting Ramadan 2026 strategic brief"]', '[]', '["Early planning start gives us 3 extra weeks versus last year."]', 'strategic', '["Continue Ramadan brief, schedule stakeholder alignment call"]'),
('lucia', CURRENT_DATE - 13, '["Completed copy audit of existing Ramadan email templates","Drafted style guide updates for 2026 Ramadan tone"]', '["Researching competitor Ramadan messaging approaches"]', '[]', '["Last year Ramadan subject lines with Arabic greetings had 22% higher open rates in GCC."]', 'creative', '["Start drafting initial Ramadan copy concepts"]'),
('diego', CURRENT_DATE - 13, '["Refreshed Skywards tier data extensions with latest member counts","Validated suppression list sync for DE market"]', '["Building baseline segments for Q2 campaigns"]', '[]', '["DE suppression list had 342 stale records removed after sync."]', 'focused', '["Complete Q2 baseline segments, start Ramadan audience sizing"]'),
('carlos', CURRENT_DATE - 13, '["Published February campaign performance summary","Set up automated KPI dashboards for Q2 tracking"]', '["Analyzing UK Spring Sale attribution data"]', '[]', '["February campaigns showed 14% overall improvement vs January across all markets."]', 'productive', '["Finish UK attribution analysis, start Ramadan 2025 benchmarks"]'),
('andres', CURRENT_DATE - 13, '["Upgraded Journey Builder templates to latest API version","Documented retry logic improvements from Q1"]', '["Planning automation architecture for Ramadan 2026"]', '[]', '["New API version reduces journey deployment time by 25%."]', 'productive', '["Draft Ramadan automation architecture, review NPS recovery requirements"]');

-- Day -12
INSERT INTO eod_reports (agent_id, date, completed_tasks, in_progress_tasks, blockers, insights, mood, plan_tomorrow) VALUES
('raul', CURRENT_DATE - 12, '["Completed Ramadan 2026 strategic brief first draft","Aligned with Valentina on Skywards tier targeting approach"]', '["Preparing budget allocation proposal for 4 Q2 campaigns"]', '[]', '["Tier-based personalization was the #1 driver of conversion in Ramadan 2025."]', 'productive', '["Finalize budget proposal, brief the execution team"]'),
('valentina', CURRENT_DATE - 12, '["Analyzed Gold member engagement patterns for upgrade program","Exported Skywards tier distribution report by market"]', '["Mapping loyalty touchpoints for Platinum conversion journey"]', '[]', '["Gold members with 3+ flights in 6 months have 8.1x higher Platinum conversion rate."]', 'focused', '["Complete touchpoint mapping, define conversion scoring criteria"]'),
('sofia', CURRENT_DATE - 12, '["Updated Emirates brand guidelines with 2026 Ramadan visual standards","Reviewed and approved 8 email templates from Q1 archive"]', '["Preparing cultural sensitivity checklist for GCC Ramadan content"]', '[]', '["Brand compliance rate held at 97.8% across all Q1 campaigns."]', 'accomplished', '["Complete Ramadan cultural sensitivity guide, start reviewing new copy"]'),
('elena', CURRENT_DATE - 12, '["Ran quarterly email deliverability audit across all sending domains","Fixed 3 broken tracking links in live UK campaign"]', '["Testing new email rendering engine compatibility"]', '["Litmus subscription renewal delayed — limited preview capacity this week"]', '["Gmail clipping affected 4% of UK emails due to oversized templates."]', 'focused', '["Continue rendering tests, escalate Litmus renewal"]'),
('javier', CURRENT_DATE - 12, '["Completed quarterly GDPR compliance review for DE market","Updated disclaimer templates for FR CNIL changes"]', '["Reviewing consent record freshness across EU markets"]', '[]', '["23% of DE consent records are older than 24 months — re-permission campaign needed."]', 'strategic', '["Draft re-permission campaign proposal, review FR updates"]');

-- Day -11
INSERT INTO eod_reports (agent_id, date, completed_tasks, in_progress_tasks, blockers, insights, mood, plan_tomorrow) VALUES
('raul', CURRENT_DATE - 11, '["Presented Q2 budget allocation to stakeholders","Got approval for Ramadan and Summer campaigns budget"]', '["Defining DXB-NRT route launch campaign scope"]', '[]', '["Stakeholder alignment achieved in one session — new record."]', 'energized', '["Start DXB-NRT brief, finalize Gold-to-Platinum scope"]'),
('lucia', CURRENT_DATE - 11, '["Drafted 5 Ramadan subject line concepts for GCC market","Created Ramadan email copy framework with personalization slots"]', '["Writing Ramadan body copy variants for UK market"]', '[]', '["Subject lines with Iftar references resonate strongly in UAE but less in UK."]', 'creative', '["Complete UK variants, start Arabic localization brief"]'),
('guillermo', CURRENT_DATE - 11, '["Designed NPS real-time data feed architecture","Documented API integration specs for survey response pipeline"]', '["Building proof-of-concept for NPS data ingestion"]', '[]', '["Real-time NPS feed will reduce response lag from 72h to under 2 minutes."]', 'focused', '["Complete PoC, start Skywards API rate limit analysis"]'),
('diego', CURRENT_DATE - 11, '["Completed Ramadan GCC audience sizing: 2.3M addressable members","Built initial Gold-to-Platinum propensity scoring model"]', '["Refining suppression rules for Ramadan GCC segments"]', '[]', '["Propensity model identifies 18K Gold members with 70%+ upgrade likelihood."]', 'productive', '["Validate propensity model with Valentina, finalize Ramadan segments"]'),
('martina', CURRENT_DATE - 11, '["Mapped Q2 campaign calendar with all market holidays","Identified 3 send-window conflicts between Ramadan and Summer campaigns"]', '["Optimizing send times for GCC Ramadan period"]', '[]', '["Ramadan send times shift significantly — engagement peaks at 9pm local time."]', 'focused', '["Resolve calendar conflicts, publish finalized Q2 calendar"]'),
('carlos', CURRENT_DATE - 11, '["Completed Ramadan 2025 benchmark analysis across 4 markets","Identified top-performing segments and content types from last year"]', '["Building attribution model for Gold-to-Platinum touchpoints"]', '[]', '["GCC markets: Ramadan campaigns had 38% higher engagement vs non-seasonal average."]', 'strategic', '["Complete attribution model, share Ramadan benchmarks with team"]');

-- Day -10
INSERT INTO eod_reports (agent_id, date, completed_tasks, in_progress_tasks, blockers, insights, mood, plan_tomorrow) VALUES
('raul', CURRENT_DATE - 10, '["Finalized Gold-to-Platinum conversion program scope","Briefed execution team on Ramadan campaign requirements"]', '["Drafting DXB-NRT route launch brief"]', '[]', '["Team is 2 weeks ahead of last year schedule for Ramadan."]', 'strategic', '["Complete DXB-NRT brief, review NPS recovery project plan"]'),
('valentina', CURRENT_DATE - 10, '["Defined Platinum conversion scoring criteria with 12 behavioral signals","Validated Gold member data quality across all markets"]', '["Creating lounge usage correlation analysis"]', '[]', '["Data quality score: 94.2% for Gold tier — 2.1% improvement from last quarter."]', 'productive', '["Complete lounge analysis, hand off scoring criteria to Diego"]'),
('andres', CURRENT_DATE - 10, '["Completed NPS recovery journey architecture design","Built deployment runbook template for Q2 campaigns"]', '["Setting up A/B test framework for Skywards upgrade journey"]', '[]', '["NPS recovery journey requires 4 decision nodes and 7 email touchpoints."]', 'productive', '["Start building NPS journey in Journey Builder"]'),
('html-developer', CURRENT_DATE - 10, '["Redesigned Summer Sale email template with new brand assets","Created reusable content block library for Q2 campaigns"]', '["Building Ramadan email template with dark theme and RTL support"]', '[]', '["New block library reduces email build time from 4h to 45 minutes."]', 'creative', '["Continue Ramadan template, test RTL rendering"]');

-- Day -9
INSERT INTO eod_reports (agent_id, date, completed_tasks, in_progress_tasks, blockers, insights, mood, plan_tomorrow) VALUES
('lucia', CURRENT_DATE - 9, '["Completed 8 Ramadan subject line variants for A/B testing","Wrote Ramadan email body copy for GCC market (EN)"]', '["Starting UK market Ramadan copy adaptation"]', '[]', '["Personalized subject lines with member name + Skywards tier show 18% higher opens."]', 'productive', '["Complete UK copy, start DE market localization"]'),
('diego', CURRENT_DATE - 9, '["Finalized Ramadan GCC segments with tier-based splits","Validated all suppression rules against GDPR requirements"]', '["Building Summer 2026 early-bird intent segments"]', '[]', '["Tier-based segmentation yielded 5 distinct audiences with clear engagement patterns."]', 'accomplished', '["Start Summer segments, review Gold-to-Platinum segment with Valentina"]'),
('sofia', CURRENT_DATE - 9, '["Reviewed and approved 5 Ramadan subject line variants","Completed cultural sensitivity guide for GCC Ramadan content"]', '["Reviewing Ramadan body copy for brand tone"]', '[]', '["One subject line variant used informal language — flagged and revised to premium tone."]', 'focused', '["Complete body copy review, start visual template compliance check"]'),
('andres', CURRENT_DATE - 9, '["Built NPS recovery journey framework in Journey Builder","Configured real-time NPS trigger integration"]', '["Adding score-band decision logic to recovery flow"]', '[]', '["Journey Builder new decision node feature simplifies score-band routing significantly."]', 'productive', '["Complete decision logic, add escalation paths"]'),
('carlos', CURRENT_DATE - 9, '["Shared Ramadan 2025 benchmarks with full team","Started building Gold-to-Platinum multi-touch attribution model"]', '["Configuring anomaly detection for Q2 KPI monitoring"]', '[]', '["Multi-touch attribution shows email as primary conversion driver (62%) for tier upgrades."]', 'focused', '["Complete attribution model, set up Q2 anomaly alerts"]');

-- Day -8
INSERT INTO eod_reports (agent_id, date, completed_tasks, in_progress_tasks, blockers, insights, mood, plan_tomorrow) VALUES
('raul', CURRENT_DATE - 8, '["Completed DXB-NRT route launch campaign brief","Reviewed NPS recovery project plan with control team"]', '["Coordinating cross-market Ramadan launch timeline"]', '[]', '["Route launch brief approved by route development team on first review."]', 'accomplished', '["Finalize Ramadan timeline, start push notification strategy planning"]'),
('valentina', CURRENT_DATE - 8, '["Completed lounge usage correlation analysis — strong Platinum predictor","Defined detractor score bands for NPS recovery triggers"]', '["Mapping Skywards welcome journey member touchpoints"]', '[]', '["Lounge users have 3.4x higher Platinum conversion — strongest single signal."]', 'strategic', '["Complete welcome journey touchpoints, review NPS score bands with team"]'),
('guillermo', CURRENT_DATE - 8, '["Completed NPS real-time data feed PoC — sub-2-minute latency achieved","Documented Skywards API rate limit findings"]', '["Planning dynamic fare insertion architecture for DXB-NRT"]', '[]', '["Skywards API can handle 500 req/s — sufficient for all Q2 campaign volumes."]', 'productive', '["Start fare insertion architecture, review NPS feed production readiness"]'),
('javier', CURRENT_DATE - 8, '["Reviewed NPS recovery offer messaging for legal compliance","Drafted GDPR re-permission campaign legal framework"]', '["Auditing DE consent records for expiry dates"]', '[]', '["Recovery offer messaging requires explicit disclaimer about non-transferability."]', 'focused', '["Continue DE audit, draft FR CNIL compliance checklist"]'),
('elena', CURRENT_DATE - 8, '["Resolved Litmus access — full preview capacity restored","Ran rendering tests on 6 existing Q1 templates across 12 clients"]', '["Testing new Ramadan template RTL rendering"]', '[]', '["Outlook 2019 still has the worst RTL rendering — affects 8% of GCC corporate emails."]', 'productive', '["Complete RTL testing, start spam score analysis for Ramadan templates"]');

-- Day -7
INSERT INTO eod_reports (agent_id, date, completed_tasks, in_progress_tasks, blockers, insights, mood, plan_tomorrow) VALUES
('lucia', CURRENT_DATE - 7, '["Completed UK market Ramadan copy adaptation","Started DE market Ramadan email localization"]', '["Writing Platinum benefit preview copy for upgrade journey"]', '[]', '["UK copy required lighter Ramadan references — cultural context differs from GCC."]', 'productive', '["Complete DE localization, continue Platinum benefit copy"]'),
('diego', CURRENT_DATE - 7, '["Built Summer 2026 early-bird audience segments across 5 markets","Completed Gold-to-Platinum segment validation with Valentina"]', '["Starting NPS detractor segment mapping"]', '[]', '["Summer segments total 4.8M addressable members — 12% increase vs 2025."]', 'accomplished', '["Complete NPS segments, refine Summer segment criteria"]'),
('andres', CURRENT_DATE - 7, '["Completed NPS recovery journey with all score-band branches","Configured escalation rules for critical detractors (score 0-3)"]', '["Testing NPS journey flow end-to-end"]', '[]', '["Critical detractor escalation now routes to customer care in under 5 minutes."]', 'productive', '["Complete journey testing, start documenting deployment runbook"]'),
('martina', CURRENT_DATE - 7, '["Published finalized Q2 campaign calendar to all teams","Resolved Ramadan-Summer send window conflict with staggered scheduling"]', '["Optimizing DXB-NRT launch send times by market"]', '[]', '["Staggered scheduling reduces audience overlap from 34% to under 8%."]', 'accomplished', '["Complete DXB-NRT send time analysis, review push notification timing needs"]');

-- Day -6
INSERT INTO eod_reports (agent_id, date, completed_tasks, in_progress_tasks, blockers, insights, mood, plan_tomorrow) VALUES
('raul', CURRENT_DATE - 6, '["Approved Ramadan offer structure (Scenario B)","Kicked off push notification strategy project with stakeholders"]', '["Reviewing DXB-NRT target market definitions"]', '[]', '["Push notification strategy fills a critical gap in our channel mix."]', 'strategic', '["Define push categories, start Emirates App team coordination"]'),
('sofia', CURRENT_DATE - 6, '["Completed Ramadan body copy review — all variants approved","Reviewed Gold-to-Platinum upgrade messaging for brand consistency"]', '["Auditing Q1 visual templates for brand guideline updates"]', '["Waiting for updated brand color palette from headquarters"]', '["Upgrade messaging initially too promotional — repositioned as exclusive invitation."]', 'focused', '["Continue visual audit, review NPS recovery messaging"]'),
('carlos', CURRENT_DATE - 6, '["Completed Gold-to-Platinum multi-touch attribution model","Set up Q2 anomaly detection alerts for all active campaigns"]', '["Building Summer 2026 fare campaign baseline metrics"]', '[]', '["Email drives 62% of tier upgrades, followed by app notifications at 23%."]', 'accomplished', '["Complete Summer baselines, prepare attribution findings presentation"]'),
('guillermo', CURRENT_DATE - 6, '["Designed dynamic fare insertion architecture for route launches","Reviewed NPS data feed for production deployment readiness"]', '["Documenting fare API integration specifications"]', '[]', '["Fare insertion architecture supports real-time pricing updates every 15 minutes."]', 'productive', '["Complete fare API docs, deploy NPS feed to production"]'),
('javier', CURRENT_DATE - 6, '["Completed DE consent record audit — 23% require re-permission","Drafted FR CNIL compliance checklist for re-permission campaign"]', '["Reviewing NPS recovery legal disclaimers"]', '[]', '["DE re-permission affects 142K members. FR affects 89K members."]', 'focused', '["Complete NPS disclaimers, finalize re-permission legal framework"]');

-- Day -5
INSERT INTO eod_reports (agent_id, date, completed_tasks, in_progress_tasks, blockers, insights, mood, plan_tomorrow) VALUES
('lucia', CURRENT_DATE - 5, '["Completed DE market Ramadan localization","Drafted 4 Platinum benefit preview emails for upgrade journey"]', '["Writing NPS recovery empathetic messaging variants"]', '[]', '["DE localization required 30% more formal tone than EN originals."]', 'productive', '["Complete NPS messaging, start welcome journey content planning"]'),
('andres', CURRENT_DATE - 5, '["Completed NPS recovery journey end-to-end testing","Created deployment runbook for NPS automation"]', '["Setting up A/B test splits for Skywards upgrade journey"]', '[]', '["End-to-end test identified 2 timing issues — both resolved."]', 'accomplished', '["Start Skywards upgrade journey build, deploy NPS to staging"]'),
('diego', CURRENT_DATE - 5, '["Completed NPS detractor segment mapping with tier overlay","Refined Summer 2026 segments with travel intent signals"]', '["Building audience for DXB-NRT route launch"]', '[]', '["NPS detractors are 2.1x more likely to be in Silver tier — interesting correlation."]', 'focused', '["Complete DXB-NRT audience, validate with marketing team"]'),
('elena', CURRENT_DATE - 5, '["Completed Ramadan template RTL rendering tests — 2 issues found and fixed","Ran spam score analysis on all Ramadan email variants"]', '["Testing NPS recovery email templates"]', '[]', '["Spam scores all below 2.0 — well within deliverability safe zone."]', 'productive', '["Complete NPS template testing, start Summer template QA"]'),
('html-developer', CURRENT_DATE - 5, '["Completed Ramadan dark theme email template with full RTL support","Built modular content blocks for Ramadan personalization"]', '["Designing Gold-to-Platinum upgrade email template"]', '[]', '["RTL dark theme template tested clean across all major clients including Outlook."]', 'creative', '["Complete upgrade template, start welcome journey template designs"]');

-- Day -4
INSERT INTO eod_reports (agent_id, date, completed_tasks, in_progress_tasks, blockers, insights, mood, plan_tomorrow) VALUES
('raul', CURRENT_DATE - 4, '["Completed cross-market Ramadan launch timeline with all milestones","Reviewed Summer 2026 campaign performance targets"]', '["Coordinating App team on push notification SDK timeline"]', '["App team SDK integration delayed — no confirmed date yet"]', '["SDK delay may push push notification strategy launch by 3 weeks."]', 'focused', '["Escalate SDK timeline, review welcome journey project scope"]'),
('valentina', CURRENT_DATE - 4, '["Completed Skywards welcome journey member touchpoint mapping","Defined enrollment source categories for journey personalization"]', '["Analyzing welcome journey drop-off patterns by enrollment source"]', '[]', '["Airport enrollees have 45% higher first-booking rate than web enrollees."]', 'strategic', '["Complete drop-off analysis, define welcome journey data requirements"]'),
('sofia', CURRENT_DATE - 4, '["Reviewed NPS recovery messaging — approved with minor tone adjustments","Completed Q1 visual template audit — 98.5% compliance"]', '["Preparing brand compliance report for Q1"]', '[]', '["NPS recovery messaging successfully balances empathy with Emirates premium tone."]', 'accomplished', '["Publish Q1 compliance report, start Summer campaign creative review"]'),
('carlos', CURRENT_DATE - 4, '["Presented Gold-to-Platinum attribution findings to leadership","Started configuring real-time conversion dashboard for upgrade program"]', '["Analyzing welcome journey drop-off data"]', '[]', '["Leadership approved expanded attribution tracking for all Q2 campaigns."]', 'energized', '["Complete conversion dashboard, collaborate on welcome journey analysis"]');

-- Day -3
INSERT INTO eod_reports (agent_id, date, completed_tasks, in_progress_tasks, blockers, insights, mood, plan_tomorrow) VALUES
('raul', CURRENT_DATE - 3, '["Defined welcome journey redesign project scope and KPIs","Allocated budget for DXB-NRT route launch campaign"]', '["Planning weekly brainstorm session with strategic team"]', '[]', '["Welcome journey redesign expected to deliver highest ROI of all Q2 initiatives."]', 'strategic', '["Facilitate weekly brainstorm, review Ramadan pre-launch checklist"]'),
('lucia', CURRENT_DATE - 3, '["Completed NPS recovery empathetic messaging for all detractor bands","Started mapping welcome journey content for 8 touches"]', '["Writing Arabic localization for Ramadan campaign"]', '["Arabic localization partner availability limited this week"]', '["Empathetic messaging A/B tests suggest acknowledging specific issue outperforms generic apology by 34%."]', 'creative', '["Continue Arabic localization, outline welcome journey content plan"]'),
('andres', CURRENT_DATE - 3, '["Deployed NPS recovery automation to staging environment","Started building Skywards Gold-to-Platinum upgrade journey"]', '["Configuring staging test scenarios for NPS flow"]', '[]', '["Staging deployment completed in 22 minutes — new team record."]', 'productive', '["Complete staging tests, continue upgrade journey build"]'),
('guillermo', CURRENT_DATE - 3, '["Deployed NPS real-time data feed to production","Completed dynamic fare API integration documentation"]', '["Planning welcome journey enrollment source data pipeline"]', '[]', '["NPS production feed processing 1,200 surveys/day with sub-2-minute latency."]', 'accomplished', '["Start enrollment data pipeline design, monitor NPS feed stability"]'),
('martina', CURRENT_DATE - 3, '["Completed DXB-NRT launch send time optimization by market","Updated Q2 calendar with welcome journey test send windows"]', '["Planning Ramadan pre-launch test schedule"]', '[]', '["DXB-NRT: Business travelers engage most at 7am local, leisure at 10am."]', 'focused', '["Finalize Ramadan test schedule, coordinate Summer campaign windows"]');

-- Day -2
INSERT INTO eod_reports (agent_id, date, completed_tasks, in_progress_tasks, blockers, insights, mood, plan_tomorrow) VALUES
('raul', CURRENT_DATE - 2, '["Facilitated strategic layer weekly brainstorm — 4 strong proposals generated","Reviewed Ramadan pre-launch checklist with execution team"]', '["Preparing weekly PM report"]', '[]', '["Brainstorm surfaced excellent idea: Skywards anniversary campaign for Q3."]', 'energized', '["Publish PM report, start Ramadan final launch approval process"]'),
('valentina', CURRENT_DATE - 2, '["Completed welcome journey drop-off analysis by enrollment source","Defined behavioral trigger events for adaptive journey"]', '["Collaborating with Diego on new member segmentation"]', '[]', '["Web enrollees drop off 65% after email 2 — need stronger value proposition earlier."]', 'focused', '["Finalize trigger events, hand off requirements to Guillermo"]'),
('diego', CURRENT_DATE - 2, '["Built new Skywards member segments by enrollment source","Sized DXB-NRT route launch audience across 4 markets"]', '["Validating welcome journey segment triggers"]', '[]', '["DXB-NRT addressable audience: 1.8M across UK, DE, UAE, and JP markets."]', 'productive', '["Complete trigger validation, start GDPR re-permission member extraction"]'),
('javier', CURRENT_DATE - 2, '["Finalized GDPR re-permission legal framework for DE and FR","Reviewed NPS recovery legal disclaimers — all approved"]', '["Auditing FR consent records for CNIL compliance"]', '[]', '["Legal framework ensures full audit trail for every consent state change."]', 'accomplished', '["Complete FR audit, prepare re-permission campaign legal brief"]'),
('elena', CURRENT_DATE - 2, '["Completed NPS recovery email template testing — all passed","Ran link validation on Ramadan campaign across all markets"]', '["Testing welcome journey template responsiveness"]', '[]', '["NPS templates achieved perfect rendering score across all 12 tested clients."]', 'productive', '["Complete welcome journey testing, prepare Ramadan QA sign-off report"]');

-- Day -1 (yesterday)
INSERT INTO eod_reports (agent_id, date, completed_tasks, in_progress_tasks, blockers, insights, mood, plan_tomorrow) VALUES
('raul', CURRENT_DATE - 1, '["Published Week 9 PM report with full team metrics","Started Ramadan final launch approval workflow"]', '["Coordinating Summer 2026 campaign creative kickoff"]', '[]', '["Team velocity 22% higher than Q1 average — strong start to Q2."]', 'strategic', '["Complete Ramadan approval, facilitate execution team weekly"]'),
('lucia', CURRENT_DATE - 1, '["Completed Ramadan Arabic localization for GCC markets","Outlined welcome journey 8-touch content framework"]', '["Writing Platinum benefit preview personalized variants"]', '[]', '["Arabic RTL copy reads naturally — native speaker review confirmed quality."]', 'accomplished', '["Start welcome journey content production, continue Platinum copy"]'),
('diego', CURRENT_DATE - 1, '["Completed welcome journey segment trigger validation","Started GDPR re-permission member list extraction for DE"]', '["Refining DXB-NRT segments with booking intent signals"]', '[]', '["Trigger validation confirmed 99.7% accuracy on enrollment source detection."]', 'productive', '["Complete DE member extraction, continue DXB-NRT refinement"]'),
('andres', CURRENT_DATE - 1, '["Completed NPS recovery staging tests — all scenarios passed","Continued Skywards Gold-to-Platinum upgrade journey build"]', '["Building welcome journey adaptive branching prototype"]', '[]', '["NPS recovery ready for production deployment — zero test failures."]', 'productive', '["Deploy NPS to production, continue upgrade and welcome journey builds"]'),
('sofia', CURRENT_DATE - 1, '["Reviewed Summer 2026 creative brief for brand alignment","Published Q1 Brand Compliance Report — 98.5% rate"]', '["Reviewing welcome journey copy for brand tone"]', '[]', '["Q1 compliance rate is our highest ever — team has internalized brand guidelines."]', 'accomplished', '["Continue welcome journey review, start DXB-NRT copy review"]'),
('carlos', CURRENT_DATE - 1, '["Completed welcome journey drop-off analysis report","Configured NPS recovery real-time monitoring dashboard"]', '["Building DXB-NRT route launch baseline metrics"]', '[]', '["NPS monitoring dashboard tracks recovery rate, response time, and escalation volume."]', 'focused', '["Complete DXB-NRT baselines, review Q2 anomaly detection rules"]'),
('martina', CURRENT_DATE - 1, '["Finalized Ramadan pre-launch test schedule for all markets","Confirmed Summer campaign send windows with no conflicts"]', '["Planning welcome journey send cadence"]', '[]', '["Welcome journey optimal cadence: Day 0, 2, 5, 10, 18, 30, 45, 60."]', 'productive', '["Publish welcome journey cadence, finalize DXB-NRT launch windows"]');

-- Day 0 (today) — already seeded in seed-emirates.sql for 6 agents, add the rest
INSERT INTO eod_reports (agent_id, date, completed_tasks, in_progress_tasks, blockers, insights, mood, plan_tomorrow) VALUES
('valentina', CURRENT_DATE, '["Finalized behavioral trigger event definitions for welcome journey","Handed off welcome journey data requirements to Guillermo"]', '["Reviewing Platinum conversion segment performance"]', '[]', '["Trigger events now cover 95% of enrollment scenarios — remaining 5% use fallback path."]', 'productive', '["Complete segment review, start Ramadan Skywards tier targeting"]'),
('guillermo', CURRENT_DATE, '["Started welcome journey enrollment source data pipeline design","Monitored NPS production feed — stable at 1,200 surveys/day"]', '["Reviewing dynamic fare API for DXB-NRT integration"]', '[]', '["NPS feed has been stable for 72 hours with zero data loss."]', 'focused', '["Complete pipeline design, start DXB-NRT fare API integration"]'),
('martina', CURRENT_DATE, '["Published welcome journey send cadence to all teams","Confirmed DXB-NRT launch window: August 1-3 across all markets"]', '["Reviewing push notification timing requirements"]', '[]', '["DXB-NRT launch on a Friday maximizes leisure traveler engagement."]', 'accomplished', '["Start push timing analysis, coordinate Ramadan final send schedule"]'),
('javier', CURRENT_DATE, '["Completed FR consent record CNIL audit","Prepared GDPR re-permission legal brief for team review"]', '["Reviewing DXB-NRT market disclaimers for JP and DE"]', '[]', '["FR audit found 89K members requiring re-permission — campaign scope confirmed."]', 'focused', '["Complete DXB-NRT disclaimers, share re-permission brief with team"]'),
('elena', CURRENT_DATE, '["Completed welcome journey responsive template testing — 2 minor issues logged","Prepared Ramadan QA sign-off report — all markets pass"]', '["Testing DXB-NRT route launch template prototypes"]', '[]', '["Ramadan campaign achieves 100% QA pass rate — ready for launch approval."]', 'productive', '["Fix welcome template issues, continue DXB-NRT testing"]'),
('html-developer', CURRENT_DATE, '["Completed Gold-to-Platinum upgrade email template design","Started welcome journey template series (touches 1-3)"]', '["Designing DXB-NRT route launch email template"]', '[]', '["Upgrade template uses progressive disclosure pattern — keeps email compact yet informative."]', 'creative', '["Continue welcome templates, complete DXB-NRT design"]');

-- ─── SECTION 6: WEEKLY SESSIONS ─────────────────────────────────────────────

-- W8 completed sessions (last week)
INSERT INTO weekly_sessions (department, session_date, week_number, steps_data, final_projects, status, report, inbox_snapshot) VALUES
('strategic', CURRENT_DATE - 7, 8, '{"step1":"review","step2":"brainstorm","step3":"prioritize"}', '[1,2,7]', 'completed',
 ('{"period":{"week":8,"start":"' || (CURRENT_DATE - 13)::text || '","end":"' || (CURRENT_DATE - 7)::text || '"},"tasks":{"completed":28,"rate":0.74},"blockers":[{"description":"App team SDK integration timeline unconfirmed","severity":"medium","agent":"raul","date":"' || (CURRENT_DATE - 9)::text || '","resolved":false},{"description":"Arabic localization partner availability limited","severity":"low","agent":"lucia","date":"' || (CURRENT_DATE - 8)::text || '","resolved":true}],"mood":{"productive":8,"focused":6,"strategic":5,"creative":3,"accomplished":4,"trend":"positivo"},"kpis":{},"brainstorm_summary":{"total":4,"accepted":2,"types":{"proposal":2,"improvement":1,"insight":1}},"inbox":{"total":3},"vs_last_week":{"tasks_delta":5,"blockers_delta":-1},"generated_at":"' || (CURRENT_DATE - 6)::text || 'T10:00:00Z"}')::jsonb,
 '[{"title":"DXB-MAN Route Launch — UK Market Email Blast","status":"chat"},{"title":"Ramadan 2025 Holiday Offer — GCC Markets","status":"borrador"},{"title":"Skywards Satisfaction Survey Q1","status":"chat"}]'),

('execution', CURRENT_DATE - 7, 8, '{"step1":"review","step2":"brainstorm","step3":"prioritize"}', '[3,5,8]', 'completed',
 ('{"period":{"week":8,"start":"' || (CURRENT_DATE - 13)::text || '","end":"' || (CURRENT_DATE - 7)::text || '"},"tasks":{"completed":34,"rate":0.81},"blockers":[{"description":"Litmus subscription renewal delayed","severity":"low","agent":"elena","date":"' || (CURRENT_DATE - 12)::text || '","resolved":true}],"mood":{"productive":10,"creative":4,"accomplished":5,"focused":3,"trend":"positivo"},"kpis":{},"brainstorm_summary":{"total":5,"accepted":3,"types":{"proposal":3,"improvement":1,"insight":1}},"inbox":{"total":4},"vs_last_week":{"tasks_delta":8,"blockers_delta":-2},"generated_at":"' || (CURRENT_DATE - 6)::text || 'T11:00:00Z"}')::jsonb,
 '[{"title":"DXB-MAN Route Launch — UK Market Email Blast","status":"chat"},{"title":"Marriott Bonvoy Partner Launch","status":"chat"},{"title":"March Newsletter — All Markets","status":"proyecto"},{"title":"Spring Flash Sale — European Routes","status":"chat"}]'),

('control', CURRENT_DATE - 7, 8, '{"step1":"review","step2":"brainstorm","step3":"prioritize"}', '[4,6]', 'completed',
 ('{"period":{"week":8,"start":"' || (CURRENT_DATE - 13)::text || '","end":"' || (CURRENT_DATE - 7)::text || '"},"tasks":{"completed":22,"rate":0.69},"blockers":[{"description":"Waiting for updated brand color palette from HQ","severity":"medium","agent":"sofia","date":"' || (CURRENT_DATE - 6)::text || '","resolved":false}],"mood":{"focused":7,"accomplished":4,"strategic":3,"productive":2,"trend":"estable"},"kpis":{},"brainstorm_summary":{"total":4,"accepted":2,"types":{"concern":1,"improvement":2,"insight":1}},"inbox":{"total":2},"vs_last_week":{"tasks_delta":3,"blockers_delta":0},"generated_at":"' || (CURRENT_DATE - 6)::text || 'T12:00:00Z"}')::jsonb,
 '[{"title":"Ramadan 2025 Holiday Offer — GCC Markets","status":"borrador"},{"title":"Skywards Satisfaction Survey Q1","status":"chat"}]');

-- W9 active sessions (this week)
INSERT INTO weekly_sessions (department, session_date, week_number, steps_data, final_projects, status, inbox_snapshot) VALUES
('strategic', CURRENT_DATE, 9, '{"step1":"review","step2":"brainstorm"}', '[]', 'active',
 '[{"title":"Emirates App Push Notification SDK Timeline","status":"chat"},{"title":"Skywards 25th Anniversary Campaign Idea","status":"chat"}]'),

('execution', CURRENT_DATE, 9, '{"step1":"review","step2":"brainstorm"}', '[]', 'active',
 '[{"title":"DXB-NRT Launch Template Design","status":"chat"},{"title":"Welcome Journey A/B Testing Framework","status":"borrador"}]'),

('control', CURRENT_DATE, 9, '{"step1":"review"}', '[]', 'active',
 '[{"title":"GDPR Re-permission Campaign Legal Brief","status":"borrador"},{"title":"Ramadan QA Sign-off","status":"chat"}]');

-- ─── SECTION 7: WEEKLY BRAINSTORMS ──────────────────────────────────────────

-- W8 Strategic brainstorms (session_id=1)
INSERT INTO weekly_brainstorms (weekly_session_id, agent_id, contribution_type, content, context, user_response) VALUES
(1, 'raul', 'proposal', 'We should create a Skywards 25th Anniversary campaign for Q3 — a perfect opportunity to celebrate loyalty milestones with personalized member stories and exclusive anniversary offers.', '{"project_refs":["Skywards Gold to Platinum Conversion"],"week":8}', 'Great idea — let us scope this for Q3 planning.'),
(1, 'valentina', 'improvement', 'The Gold-to-Platinum conversion program should include a real-time miles tracker showing members exactly how close they are to Platinum. Our data shows members within 10K miles of upgrade have 5x conversion rate.', '{"project_refs":["Skywards Gold to Platinum Conversion"],"week":8}', 'Accepted — adding miles tracker to upgrade journey requirements.'),
(1, 'guillermo', 'insight', 'Our NPS data feed architecture can be reused for real-time booking event triggers. This means welcome journey and post-flight campaigns could share the same event pipeline, reducing infrastructure complexity by 40%.', '{"project_refs":["Post-Flight NPS Recovery","Skywards Welcome Journey"],"week":8}', NULL),

-- W8 Execution brainstorms (session_id=2)
INSERT INTO weekly_brainstorms (weekly_session_id, agent_id, contribution_type, content, context, user_response) VALUES
(2, 'lucia', 'proposal', 'For the welcome journey redesign, I recommend a storytelling approach where each email reveals a new chapter of the Skywards experience. This narrative arc keeps engagement high across all 8 touches.', '{"project_refs":["Skywards Welcome Journey Redesign"],"week":8}', 'Love this — accepted as the creative direction for the welcome journey.'),
(2, 'diego', 'improvement', 'Our segmentation for route launches currently uses static market definitions. I can build dynamic segments that include booking search behavior from the last 30 days, which would significantly improve targeting precision.', '{"project_refs":["Dubai-Tokyo Route Launch"],"week":8}', 'Yes, let us implement this for DXB-NRT as a pilot.'),
(2, 'andres', 'insight', 'Journey Builder new decision node feature reduces our journey build time by 35%. I recommend we rebuild the Summer campaign automation using this pattern as a template for all future campaigns.', '{"project_refs":["Summer 2026 Fare Campaign"],"week":8}', NULL),
(2, 'martina', 'proposal', 'We need a conflict detection system that automatically flags when two campaigns target overlapping audiences within the same 48-hour window. I have the send-time data to build this.', '{"project_refs":[],"week":8}', 'This would be very valuable — let us add it to the Q2 roadmap.'),
(2, 'html-developer', 'improvement', 'The new modular block library I built can be extended with a drag-and-drop template builder. This would allow content agents to assemble emails without HTML knowledge, reducing build time from 4 hours to 30 minutes.', '{"project_refs":[],"week":8}', 'Interesting concept — let us discuss in next sprint.');

-- W8 Control brainstorms (session_id=3)
INSERT INTO weekly_brainstorms (weekly_session_id, agent_id, contribution_type, content, context, user_response) VALUES
(3, 'sofia', 'concern', 'The increasing volume of multilingual campaigns is straining our brand review capacity. We need to either automate basic brand checks or add review capacity for Arabic and German content.', '{"project_refs":["Ramadan 2026 Campaign Suite"],"week":8}', 'Valid concern — let us explore automated brand scoring as a Phase 2 initiative.'),
(3, 'javier', 'improvement', 'The GDPR re-permission campaign should include a progressive consent capture that asks for channel preferences (email, push, SMS) separately. This granular approach typically yields 20% higher overall opt-in rates.', '{"project_refs":["GDPR Consent Re-permission"],"week":8}', 'Accepted — updating re-permission journey requirements.'),
(3, 'elena', 'improvement', 'I propose implementing automated QA pipelines that run link validation, rendering tests, and spam scoring automatically when any email template is saved. This would catch 80% of issues before human review.', '{"project_refs":[],"week":8}', NULL),
(3, 'carlos', 'insight', 'Cross-campaign attribution analysis shows that members who receive both seasonal offers and loyalty communications have 2.4x higher lifetime value. We should optimize our campaign mix to maximize this effect.', '{"project_refs":["Summer 2026 Fare Campaign","Skywards Gold to Platinum Conversion"],"week":8}', 'Excellent insight — sharing with Raul for Q2 strategy.');

-- W9 Strategic brainstorms (session_id=4) — W8 are 1,2,3 and W9 are 4,5,6
INSERT INTO weekly_brainstorms (weekly_session_id, agent_id, contribution_type, content, context, user_response) VALUES
(4, 'raul', 'proposal', 'Given the SDK delay for push notifications, I recommend we pivot Phase 1 to focus on in-app message strategy which does not require SDK changes. This keeps the project moving while we wait for the mobile team.', '{"project_refs":["Emirates App Push Notification Strategy"],"week":9}', NULL),
(4, 'valentina', 'insight', 'Welcome journey analysis reveals that members who engage with the Skywards miles calculator in email 3 have a 3.2x higher first-booking rate. We should make the calculator the hero element of that touch.', '{"project_refs":["Skywards Welcome Journey Redesign"],"week":9}', NULL);

-- W9 Execution brainstorms (session_id=5)
INSERT INTO weekly_brainstorms (weekly_session_id, agent_id, contribution_type, content, context, user_response) VALUES
(5, 'lucia', 'insight', 'Testing different content frameworks for the welcome journey: the narrative storytelling approach outperforms feature-listing by 28% in preliminary benchmarks. Recommending we commit to the storytelling direction.', '{"project_refs":["Skywards Welcome Journey Redesign"],"week":9}', NULL),
(5, 'andres', 'proposal', 'I can build a reusable journey template that standardizes our campaign automation architecture. Every new campaign would start from a proven base, reducing build time by 40% and ensuring consistent quality.', '{"project_refs":[],"week":9}', NULL),
(5, 'diego', 'improvement', 'DXB-NRT audience segments should include a Japan travel intent signal from search data. I estimate this will improve targeting precision by 25% and reduce wasted sends to uninterested members.', '{"project_refs":["Dubai-Tokyo Route Launch"],"week":9}', NULL);

-- W9 Control brainstorms (session_id=6)
INSERT INTO weekly_brainstorms (weekly_session_id, agent_id, contribution_type, content, context, user_response) VALUES
(6, 'javier', 'concern', 'The Japanese market has specific APPI (data protection) requirements that differ from GDPR. For DXB-NRT campaign targeting Japanese residents, we need to add APPI compliance review to the QA checklist.', '{"project_refs":["Dubai-Tokyo Route Launch"],"week":9}', NULL),
(6, 'elena', 'proposal', 'I propose adding automated accessibility testing to our QA pipeline. Emirates brand guidelines require WCAG 2.1 AA compliance, but we currently only check manually. Automation would cover 70% of accessibility checks.', '{"project_refs":[],"week":9}', NULL),
(6, 'carlos', 'insight', 'NPS recovery automation in staging is showing promising early results: simulated recovery rate of 38% vs the current 12%. If production mirrors staging, this project will exceed its success metrics.', '{"project_refs":["Post-Flight NPS Recovery Automation"],"week":9}', NULL);

-- ─── SECTION 8: INBOX ITEMS ─────────────────────────────────────────────────

-- Existing 6 from seed-emirates.sql are deleted in cleanup, re-insert + add new ones

-- 1. Chat with conversation
INSERT INTO inbox_items (title, description, source, department, status, conversation, structured_data, created_at) VALUES
('DXB-MAN Route Launch — UK Market Email Blast', 'New Manchester route launching June 15. Need email campaign targeting UK residents.', 'agent', 'execution', 'chat',
 '[{"role":"user","content":"We have a new DXB-MAN route launching June 15. We need a full email campaign targeting UK residents, especially Skywards members in the Manchester and London areas."},{"role":"assistant","content":"Great, I will start working on a campaign plan for the DXB-MAN route launch. A few key considerations:\n\n1. **Target Audience**: UK Skywards members, particularly those in Manchester and London postcodes\n2. **Timeline**: We need to start awareness emails by mid-May\n3. **Content**: Highlight direct service, competitive fares, and Manchester as a destination\n\nShall I prioritize business travelers or leisure for the initial wave?"},{"role":"user","content":"Let us focus on leisure travelers first since Manchester is a strong VFR (visiting friends and relatives) market for the UAE diaspora."},{"role":"assistant","content":"Perfect strategic choice. The VFR segment is excellent for DXB-MAN. I recommend:\n\n- **Segment**: UAE diaspora in Manchester area + Skywards members with MAN search history\n- **Messaging**: Family connections, competitive fares, convenient schedules\n- **Languages**: English + Arabic for the diaspora segment\n- **Journey**: 3-touch sequence (announcement, early-bird offer, countdown)\n\nI will draft a full brief. Should I also include a Skywards bonus miles launch offer?"}]',
 '{"bau_type":"route-launch-new","markets":["UK"],"priority":"high"}',
 NOW() - interval '5 days');

-- 2. Chat with conversation
INSERT INTO inbox_items (title, description, source, department, status, conversation, structured_data, created_at) VALUES
('Skywards 25th Anniversary Campaign Idea', 'Brainstorm idea from Raul: celebrate Skywards 25th anniversary with personalized member stories.', 'agent', 'strategic', 'chat',
 '[{"role":"user","content":"Raul proposed a Skywards 25th Anniversary campaign for Q3. Can we explore what this could look like?"},{"role":"assistant","content":"Excellent idea with strong emotional resonance. Here is an initial concept:\n\n**Skywards 25th Anniversary Campaign**\n\n- **Theme**: \"25 Years of Miles & Memories\"\n- **Personalization**: Each member receives a unique email showing their personal Skywards journey (miles earned, destinations visited, tier history)\n- **Content pillars**: Member milestone celebrations, exclusive anniversary offers, limited-edition Skywards merchandise\n- **Channels**: Email, push notifications, in-app\n\nThis could be our highest-engagement campaign of the year. Shall I develop a full strategic brief?"},{"role":"user","content":"Yes, develop the brief. Also consider a limited-time double miles promotion for the anniversary month."}]',
 '{"bau_type":"engagement","priority":"medium"}',
 NOW() - interval '3 days');

-- 3. Borrador with summary
INSERT INTO inbox_items (title, description, source, department, status, summary, structured_data, created_at) VALUES
('Ramadan 2026 Holiday Offer — GCC Markets', 'Special Ramadan fares and Skywards bonus miles for GCC residents.', 'dashboard', 'strategic', 'borrador',
 'A comprehensive Ramadan 2026 campaign targeting GCC Skywards members with tier-based fare discounts, bonus miles promotions, and Iftar lounge access offers. The campaign will run across UAE, KSA, Kuwait, Bahrain, Oman, and Qatar with Arabic-first content and culturally sensitive messaging. Key KPIs: 32% open rate, 15% conversion on bonus miles offers. Estimated budget: $180K across 6 weeks.',
 '{"bau_type":"holiday-offer","markets":["KSA","UAE","KW","BH","OM","QA"],"priority":"high"}',
 NOW() - interval '8 days');

-- 4. Borrador with summary
INSERT INTO inbox_items (title, description, source, department, status, summary, structured_data, created_at) VALUES
('Welcome Journey A/B Testing Framework', 'Need to define A/B testing approach for the new 8-touch welcome journey.', 'dashboard', 'execution', 'borrador',
 'A/B testing framework for the Skywards Welcome Journey Redesign covering: subject line variants (personalized vs generic), content approach (storytelling vs feature-list), send cadence (compressed vs extended), and enrollment source personalization. The framework defines test populations, statistical significance thresholds, and decision criteria for each test.',
 '{"priority":"medium"}',
 NOW() - interval '2 days');

-- 5. Proyecto linked to project 4
INSERT INTO inbox_items (title, description, source, department, status, summary, project_id, structured_data, created_at) VALUES
('Post-Flight NPS Recovery System', 'Automated system to recover NPS detractors through personalized service recovery flows.', 'agent', 'control', 'proyecto',
 'Automated NPS detractor recovery system with real-time survey triggers, score-band-based journey branching, tier-appropriate service recovery offers, and escalation to customer care for critical detractors. Expected to increase recovery rate from 12% to 40%.',
 4,
 '{"bau_type":"lifecycle","priority":"high"}',
 NOW() - interval '10 days');

-- 6. Proyecto linked to project 1
INSERT INTO inbox_items (title, description, source, department, status, summary, project_id, structured_data, created_at) VALUES
('Ramadan 2026 Multi-Market Campaign', 'Full Ramadan campaign suite across GCC, UK, and DE markets.', 'dashboard', 'strategic', 'proyecto',
 'Multi-market Ramadan 2026 campaign with tier-specific offers, multilingual content (EN, AR, DE), automated journey flows, and cultural sensitivity review. 4-phase execution: strategy, content, technical setup, and launch.',
 1,
 '{"bau_type":"holiday-offer","markets":["UAE","KSA","UK","DE"],"priority":"high"}',
 NOW() - interval '12 days');

-- 7. Chat
INSERT INTO inbox_items (title, description, source, department, status, conversation, structured_data, created_at) VALUES
('Marriott Bonvoy Partner Launch — Cross-Promotion', 'New partnership with Marriott Bonvoy: earn miles on hotel stays.', 'agent', 'execution', 'chat',
 '[{"role":"user","content":"We have a new Marriott Bonvoy partnership launching. Members can earn Skywards miles on Marriott stays. Need a launch campaign."},{"role":"assistant","content":"This is a high-value partnership campaign. I recommend a multi-phase approach:\n\n1. **Announcement email** to all Skywards members highlighting the partnership\n2. **Targeted follow-up** to members with hotel booking history\n3. **Joint content** with Marriott featuring destination + hotel packages\n\nKey markets: UAE, UK, US. Shall I coordinate with the partner programs team?"}]',
 '{"bau_type":"partner-launch","partner":"Marriott Bonvoy","priority":"medium"}',
 NOW() - interval '6 days');

-- 8. Discarded
INSERT INTO inbox_items (title, description, source, department, status, structured_data, created_at) VALUES
('Generic Newsletter Frequency Increase', 'Proposal to increase newsletter frequency from monthly to bi-weekly.', 'dashboard', 'execution', 'discarded',
 '{"priority":"low","reason":"Data shows monthly frequency has optimal engagement; bi-weekly risks fatigue"}',
 NOW() - interval '9 days');

-- 9. Chat
INSERT INTO inbox_items (title, description, source, department, status, conversation, structured_data, created_at) VALUES
('GDPR Re-permission Campaign Legal Brief', 'Legal framework review for DE and FR re-permission campaign.', 'agent', 'control', 'chat',
 '[{"role":"user","content":"Javier has prepared the legal brief for the GDPR re-permission campaign. Can we review the approach?"},{"role":"assistant","content":"I have reviewed Javier legal framework. Key points:\n\n- **DE market**: 142K members require re-permission under UWG + GDPR\n- **FR market**: 89K members under CNIL updated guidelines\n- **Approach**: Value-led messaging, progressive consent capture, full audit trail\n- **Risk**: Need to ensure messaging is not perceived as coercive\n\nThe framework is solid. I recommend we proceed to journey design phase."}]',
 '{"priority":"high"}',
 NOW() - interval '2 days');

-- 10. Borrador
INSERT INTO inbox_items (title, description, source, department, status, summary, structured_data, created_at) VALUES
('Emirates App In-App Messaging Strategy', 'Alternative to push notifications that does not require SDK changes.', 'agent', 'strategic', 'borrador',
 'In-app messaging strategy as Phase 1 alternative to push notifications while SDK integration is pending. Covers booking confirmation overlays, Skywards tier update banners, personalized offer cards, and flight status notifications within the existing app framework. No SDK changes required, estimated 2-week implementation.',
 '{"priority":"medium"}',
 NOW() - interval '1 day');

-- 11. Chat
INSERT INTO inbox_items (title, description, source, department, status, conversation, structured_data, created_at) VALUES
('Ramadan QA Sign-off Status', 'Final QA report for Ramadan campaign across all markets.', 'agent', 'control', 'chat',
 '[{"role":"user","content":"Elena completed the Ramadan QA — can we get the sign-off status?"},{"role":"assistant","content":"Elena QA report shows:\n\n- **Link validation**: All links valid across all markets\n- **Rendering**: Clean across 12 email clients including Outlook RTL\n- **Spam score**: All variants below 2.0\n- **Compliance**: All disclaimers verified by Javier\n\nRecommendation: **Ready for launch approval.** All markets pass 100% QA."}]',
 '{"priority":"high"}',
 NOW() - interval '1 day');

-- 12. Discarded
INSERT INTO inbox_items (title, description, source, department, status, structured_data, created_at) VALUES
('Social Media Cross-Post Automation', 'Proposal to auto-generate social posts from email campaigns.', 'dashboard', 'execution', 'discarded',
 '{"priority":"low","reason":"Out of scope for current Q2 priorities; social media is managed by a separate team"}',
 NOW() - interval '7 days');

-- ─── SECTION 9: PM REPORTS ──────────────────────────────────────────────────

INSERT INTO pm_reports (title, summary, body_md, metrics, risks, next_steps, created_at) VALUES
('Week 7 Performance Report', 'Strong foundation week with Q2 planning, Ramadan brief initiated, and NPS architecture designed.',
'# Week 7 Performance Report

## Executive Summary
Week 7 marked the start of Q2 with strong planning momentum. The Ramadan 2026 campaign brief was initiated, NPS recovery architecture was designed, and the Summer 2026 campaign completed its wrap-up phase.

## Highlights
- Q2 campaign planning kicked off with all department leads aligned
- Ramadan 2025 post-mortem analysis completed — key learnings documented
- NPS real-time data feed architecture designed with sub-2-minute latency target
- Summer 2026 campaign wrap-up: $4.2M revenue attributed to email channel
- Brand compliance rate held at 97.8% across all Q1 campaigns

## Team Performance
- **13 agents active** across 3 departments
- **23 tasks completed** this week (68% completion rate)
- **1 blocker** identified (Litmus subscription renewal)
- Mood trend: Positive — predominantly productive and strategic

## Blockers & Risks
- Litmus subscription renewal delayed — limiting email preview capacity
- Arabic localization partner availability may constrain Ramadan timeline

## Recommendations
- Expedite Litmus renewal to restore full QA capacity
- Begin Arabic localization early to avoid timeline pressure
- Schedule Q2 stakeholder alignment meeting for next week',
'{"agentes_total":13,"agentes_activos":13,"proyectos":6,"eod_reports":42,"weekly_sessions":3,"raises_activos":1,"eventos_audit_semana":8,"raw_events":30,"memorias_agente":0}',
'[{"risk":"Litmus subscription renewal may delay QA pipeline","severity":"Medium","mitigation":"Escalate to procurement, use alternative preview tools as backup"},{"risk":"Arabic localization capacity limited for Ramadan timeline","severity":"Medium","mitigation":"Engage backup localization partner, prioritize GCC-critical content"}]',
'[{"action":"Expedite Litmus subscription renewal","priority":"High"},{"action":"Begin Ramadan Arabic localization pipeline","priority":"High"},{"action":"Schedule Q2 stakeholder alignment session","priority":"Medium"},{"action":"Complete NPS data feed proof-of-concept","priority":"Medium"}]',
NOW() - interval '14 days'),

('Week 8 Performance Report', 'High-velocity week with Ramadan content production, NPS journey built, and Gold-to-Platinum attribution completed.',
'# Week 8 Performance Report

## Executive Summary
Week 8 delivered exceptional velocity across all departments. Ramadan content production is well underway, the NPS recovery journey was built and tested, and the Gold-to-Platinum attribution model was completed revealing email as the primary conversion driver.

## Highlights
- **Ramadan 2026**: Strategic brief approved, content production at 60%, segments finalized (2.3M addressable)
- **NPS Recovery**: Full journey built with score-band branching, deployed to staging
- **Gold-to-Platinum**: Multi-touch attribution completed — email drives 62% of conversions
- **Welcome Journey**: Project scoped, journey mapping completed, content planning started
- **Summer 2026**: Fully completed and archived — $4.2M revenue, 32% open rate

## Team Performance
- **13 agents active** across 3 departments
- **34 tasks completed** this week (81% completion rate — up from 68%)
- **2 blockers** identified (SDK delay, brand palette update pending)
- Mood trend: Strongly positive — high productivity and accomplishment scores

## Key Metrics
| Metric | This Week | Last Week | Delta |
|--------|-----------|-----------|-------|
| Tasks Completed | 34 | 23 | +48% |
| Completion Rate | 81% | 68% | +13pp |
| Active Blockers | 2 | 1 | +1 |
| EOD Coverage | 78% | 72% | +6pp |

## Blockers & Risks
- App team SDK integration timeline unconfirmed — push notification project at risk
- Brand color palette update from HQ pending — visual template refresh on hold
- Arabic localization partner constraint resolved

## Recommendations
- Escalate SDK timeline with mobile app team
- Consider in-app messaging as Phase 1 alternative to push notifications
- Deploy NPS recovery to production next week
- Begin welcome journey content production',
'{"agentes_total":13,"agentes_activos":13,"proyectos":8,"eod_reports":68,"weekly_sessions":6,"raises_activos":3,"eventos_audit_semana":14,"raw_events":45,"memorias_agente":15}',
'[{"risk":"SDK integration delay threatens push notification project timeline","severity":"High","mitigation":"Pivot Phase 1 to in-app messaging; continue SDK planning in parallel"},{"risk":"Brand color palette update from HQ delayed","severity":"Low","mitigation":"Proceed with current palette, apply updates retroactively when received"},{"risk":"Increasing campaign volume may strain QA capacity","severity":"Medium","mitigation":"Implement automated QA pipeline for basic checks (links, rendering, spam score)"}]',
'[{"action":"Deploy NPS recovery automation to production","priority":"Critical"},{"action":"Escalate SDK timeline with mobile app team","priority":"High"},{"action":"Begin welcome journey content production across 4 languages","priority":"High"},{"action":"Start DXB-NRT route launch content brief","priority":"Medium"},{"action":"Finalize GDPR re-permission legal framework","priority":"Medium"}]',
NOW() - interval '7 days'),

('Week 9 Performance Report', 'NPS ready for production, Ramadan approaching launch approval, welcome journey content in production.',
'# Week 9 Performance Report

## Executive Summary
Week 9 brings multiple projects to critical milestones. NPS recovery passed all staging tests and is ready for production deployment. Ramadan 2026 achieved 100% QA pass rate and is entering launch approval. Welcome journey content production is underway with the storytelling approach confirmed.

## Highlights
- **NPS Recovery**: All staging tests passed — zero failures, ready for production
- **Ramadan 2026**: 100% QA pass rate across all markets, Arabic localization completed
- **Welcome Journey**: Storytelling approach confirmed (28% better than feature-listing), content in production
- **DXB-NRT Launch**: Competitor analysis shows Emirates well-positioned (8% below average pricing)
- **GDPR Re-permission**: Legal framework finalized for DE (142K) and FR (89K) markets

## Team Performance
- **13 agents active** across 3 departments
- **31 tasks completed** this week (77% completion rate)
- **1 blocker** (SDK delay — mitigated with in-app messaging pivot)
- Mood trend: Positive — strong accomplishment and strategic thinking
- EOD coverage: 82% (highest this quarter)

## Key Metrics
| Metric | This Week | Last Week | Delta |
|--------|-----------|-----------|-------|
| Tasks Completed | 31 | 34 | -9% |
| Completion Rate | 77% | 81% | -4pp |
| Active Blockers | 1 | 2 | -1 |
| EOD Coverage | 82% | 78% | +4pp |

## Blockers & Risks
- SDK integration still unconfirmed — in-app messaging pivot approved as Phase 1

## Recommendations
- Deploy NPS recovery to production immediately
- Proceed with Ramadan launch approval workflow
- Accelerate welcome journey content for all 8 touches
- Begin DXB-NRT content production',
'{"agentes_total":13,"agentes_activos":13,"proyectos":8,"eod_reports":86,"weekly_sessions":6,"raises_activos":2,"eventos_audit_semana":12,"raw_events":52,"memorias_agente":26}',
'[{"risk":"SDK integration timeline still unconfirmed","severity":"Medium","mitigation":"In-app messaging Phase 1 approved; SDK work continues in background"},{"risk":"Welcome journey content production across 4 languages is resource-intensive","severity":"Medium","mitigation":"Prioritize EN content first, parallel-track AR/DE/FR with localization partners"}]',
'[{"action":"Deploy NPS recovery automation to production","priority":"Critical"},{"action":"Complete Ramadan 2026 launch approval workflow","priority":"Critical"},{"action":"Accelerate welcome journey content production","priority":"High"},{"action":"Begin DXB-NRT route launch content and segment production","priority":"High"},{"action":"Start GDPR re-permission journey design","priority":"Medium"}]',
NOW() - interval '0 days');

-- ─── SECTION 10: WORKFLOW RUNS ──────────────────────────────────────────────

INSERT INTO workflow_runs (workflow_id, status, triggered_by, started_at, completed_at, duration_ms, output_summary, metadata) VALUES
('campaign-creation', 'completed', 'user', NOW() - interval '13 days', NOW() - interval '13 days' + interval '4 minutes', 240000, 'Campaign brief generated: Ramadan 2026 Campaign Suite targeting GCC Skywards members with tier-based offers. 4-phase execution plan created with 14 tasks across 5 agents.', '{"campaign":"ramadan-2026","markets":["UAE","KSA","KW"],"prompt":"Create campaign brief for Ramadan 2026 GCC markets"}'),
('brand-audit-cycle', 'completed', 'schedule', NOW() - interval '12 days', NOW() - interval '12 days' + interval '8 minutes', 480000, 'Brand audit completed: 97.8% compliance rate across Q1 campaigns. 2 minor violations flagged and resolved. Updated terminology glossary with 5 new entries.', '{"quarter":"Q1","compliance_rate":97.8}'),
('weekly-performance-digest', 'completed', 'schedule', NOW() - interval '11 days', NOW() - interval '11 days' + interval '3 minutes', 180000, 'Weekly digest generated for Week 7. Key highlights: 23 tasks completed, 1 blocker, positive mood trend. Summer campaign wrap-up completed with $4.2M attributed revenue.', '{"week":7}'),
('audience-hygiene-cleanup', 'completed', 'schedule', NOW() - interval '10 days', NOW() - interval '10 days' + interval '12 minutes', 720000, 'Audience hygiene completed: 342 stale DE suppression records removed. 156 duplicate profiles merged. Overall data quality score improved to 94.2%.', '{"records_cleaned":498}'),
('ab-test-pipeline', 'completed', 'user', NOW() - interval '9 days', NOW() - interval '9 days' + interval '6 minutes', 360000, 'A/B test configured: 8 subject line variants across 3 GCC markets. Test population: 15K per variant. Statistical significance threshold: 95%. Expected completion: 48 hours.', '{"campaign":"ramadan-2026","variants":8,"prompt":"Set up A/B test for Ramadan subject lines in GCC market"}'),
('email-deliverability-check', 'completed', 'schedule', NOW() - interval '8 days', NOW() - interval '8 days' + interval '5 minutes', 300000, 'Deliverability audit completed: All sending domains healthy. Gmail delivery rate 98.2%, Outlook 96.8%. Spam scores all below 2.0. Gmail clipping affecting 4% of oversized templates flagged.', '{"gmail_rate":98.2,"outlook_rate":96.8}'),
('campaign-creation', 'completed', 'user', NOW() - interval '7 days', NOW() - interval '7 days' + interval '5 minutes', 300000, 'Project plan generated: 8-touch adaptive welcome journey with behavioral branching. 3 phases, 12 tasks across 7 agents. Estimated timeline: 7 weeks.', '{"campaign":"welcome-journey-redesign","prompt":"Create project plan for Skywards Welcome Journey Redesign"}'),
('gdpr-consent-refresh', 'completed', 'user', NOW() - interval '5 days', NOW() - interval '5 days' + interval '7 minutes', 420000, 'Consent audit completed: DE market 142K members require re-permission (23% of base). FR market 89K members (18%). Total affected: 231K members. Legal framework documented.', '{"de_affected":142000,"fr_affected":89000,"prompt":"Audit GDPR consent records for DE and FR markets"}'),
('weekly-performance-digest', 'completed', 'schedule', NOW() - interval '4 days', NOW() - interval '4 days' + interval '3 minutes', 180000, 'Weekly digest generated for Week 8. Key highlights: 34 tasks completed (48% increase), NPS recovery deployed to staging, Gold-to-Platinum attribution model completed.', '{"week":8}'),
('brand-audit-cycle', 'completed', 'schedule', NOW() - interval '3 days', NOW() - interval '3 days' + interval '9 minutes', 540000, 'Mid-quarter brand audit: 98.5% compliance rate. Ramadan content reviewed and approved. NPS recovery messaging tone validated. 1 concern flagged on upgrade messaging (resolved).', '{"compliance_rate":98.5}'),
('campaign-creation', 'running', 'user', NOW() - interval '1 hour', NULL, NULL, NULL, '{"campaign":"dxb-nrt-launch","prompt":"Create campaign brief for DXB-NRT route launch across UK, DE, UAE, JP markets"}'),
('email-deliverability-check', 'failed', 'schedule', NOW() - interval '2 days', NOW() - interval '2 days' + interval '2 minutes', 120000, NULL, '{"error":"SFMC API timeout during sending domain verification. Retry scheduled."}'),
('audience-hygiene-cleanup', 'pending', 'schedule', NOW(), NULL, NULL, NULL, '{"scheduled":"weekly"}');

-- ─── SECTION 11: RAW EVENTS ─────────────────────────────────────────────────

INSERT INTO raw_events (agent_id, event_type, content, timestamp) VALUES
('andres', 'tool_call', '{"tool":"Journey Builder","action":"deploy_flow","input":"NPS_Recovery_Staging","output":"Flow deployed successfully to staging","duration_ms":3420}', NOW() - interval '3 days'),
('andres', 'tool_call', '{"tool":"Journey Builder","action":"create_decision_node","input":"NPS_score_band_router","output":"Decision node created with 4 branches","duration_ms":1890}', NOW() - interval '7 days'),
('andres', 'tool_call', '{"tool":"Automation Studio","action":"configure_trigger","input":"NPS_survey_response_trigger","output":"Real-time trigger configured","duration_ms":2100}', NOW() - interval '6 days'),
('lucia', 'tool_call', '{"tool":"Claude AI","action":"generate_copy","input":"Ramadan subject lines GCC market","output":"8 variants generated","duration_ms":4500}', NOW() - interval '9 days'),
('lucia', 'tool_call', '{"tool":"Translation Engine","action":"localize","input":"Ramadan EN to AR","output":"Arabic localization completed with RTL formatting","duration_ms":8200}', NOW() - interval '1 day'),
('lucia', 'tool_call', '{"tool":"Claude AI","action":"generate_copy","input":"NPS recovery empathetic messaging","output":"4 recovery message variants per score band","duration_ms":5100}', NOW() - interval '3 days'),
('diego', 'tool_call', '{"tool":"SFMC Data Extensions","action":"build_segment","input":"GCC_Skywards_Ramadan_2026","output":"Segment built: 2.3M addressable members","duration_ms":12400}', NOW() - interval '11 days'),
('diego', 'tool_call', '{"tool":"SQL Query Builder","action":"execute","input":"Gold_Platinum_propensity_model","output":"Model scored 245K Gold members, 18K high-propensity identified","duration_ms":18900}', NOW() - interval '11 days'),
('diego', 'tool_call', '{"tool":"Audience Rules Library","action":"validate_suppression","input":"DE_GDPR_suppression_check","output":"All suppression rules valid, 342 stale records flagged","duration_ms":6700}', NOW() - interval '13 days'),
('carlos', 'tool_call', '{"tool":"Looker Studio","action":"create_dashboard","input":"Gold_Platinum_conversion_tracking","output":"Real-time dashboard created with 6 KPI widgets","duration_ms":9800}', NOW() - interval '4 days'),
('carlos', 'tool_call', '{"tool":"Attribution Model","action":"run_analysis","input":"Gold_to_Platinum_multi_touch","output":"Attribution complete: email 62%, app 23%, web 15%","duration_ms":34200}', NOW() - interval '6 days'),
('carlos', 'tool_call', '{"tool":"GA4/Looker Studio","action":"generate_report","input":"Ramadan_2025_benchmarks","output":"Benchmark report: 38% avg engagement GCC, 28% UK","duration_ms":7600}', NOW() - interval '11 days'),
('sofia', 'tool_call', '{"tool":"Tone & Style Analyzer","action":"review","input":"Ramadan_copy_8_variants","output":"7 approved, 1 flagged (too casual for Emirates premium tone)","duration_ms":3200}', NOW() - interval '9 days'),
('sofia', 'tool_call', '{"tool":"Emirates Brand Guidelines","action":"audit","input":"Q1_visual_templates","output":"98.5% compliance rate, 2 minor issues flagged","duration_ms":15600}', NOW() - interval '4 days'),
('javier', 'tool_call', '{"tool":"Regulatory Requirements KB","action":"lookup","input":"DE_UWG_consent_requirements","output":"UWG Section 7 requires explicit opt-in for marketing emails","duration_ms":1200}', NOW() - interval '12 days'),
('javier', 'tool_call', '{"tool":"Consent & Privacy Rules","action":"audit","input":"DE_consent_records_freshness","output":"142K records older than 24 months flagged for re-permission","duration_ms":22100}', NOW() - interval '6 days'),
('elena', 'tool_call', '{"tool":"Litmus/Email on Acid","action":"render_test","input":"Ramadan_dark_theme_RTL","output":"Tested across 12 clients: 2 RTL issues in Outlook 2019","duration_ms":28400}', NOW() - interval '5 days'),
('elena', 'tool_call', '{"tool":"Link Checker","action":"validate","input":"Ramadan_all_markets","output":"All 847 links valid, 0 broken, 0 redirects","duration_ms":45200}', NOW() - interval '2 days'),
('elena', 'tool_call', '{"tool":"HTML/CSS Validator","action":"validate","input":"NPS_recovery_templates","output":"All templates valid, WCAG 2.1 AA compliant","duration_ms":8900}', NOW() - interval '2 days'),
('guillermo', 'tool_call', '{"tool":"SFMC Architecture","action":"design","input":"NPS_realtime_feed","output":"Architecture designed: webhook ingestion, event pipeline, sub-2min latency","duration_ms":2800}', NOW() - interval '11 days'),
('guillermo', 'tool_call', '{"tool":"Integration Blueprints","action":"deploy","input":"NPS_feed_production","output":"Production deployment successful, processing 1200 surveys/day","duration_ms":45000}', NOW() - interval '3 days'),
('valentina', 'tool_call', '{"tool":"Skywards API","action":"extract","input":"Gold_member_engagement_12m","output":"Extracted 245K Gold member profiles with engagement scores","duration_ms":38500}', NOW() - interval '12 days'),
('valentina', 'tool_call', '{"tool":"Customer 360 Dashboard","action":"analyze","input":"welcome_journey_dropoff","output":"65% drop-off after email 2 for web enrollees, 32% for airport enrollees","duration_ms":9400}', NOW() - interval '4 days'),
('martina', 'tool_call', '{"tool":"Campaign Calendar","action":"publish","input":"Q2_2026_finalized","output":"Q2 calendar published with 28 campaign slots across 6 markets","duration_ms":3100}', NOW() - interval '7 days'),
('martina', 'tool_call', '{"tool":"Send Time Signals","action":"optimize","input":"DXB_NRT_by_market","output":"Business: 7am local, Leisure: 10am local optimal across all markets","duration_ms":7800}', NOW() - interval '3 days'),
('html-developer', 'tool_call', '{"tool":"SFMC Content Builder","action":"create_template","input":"Ramadan_dark_theme_RTL","output":"Template created with 12 modular content blocks","duration_ms":14200}', NOW() - interval '5 days'),
('html-developer', 'tool_call', '{"tool":"Block Library","action":"publish","input":"Q2_reusable_blocks","output":"24 new reusable blocks published to team library","duration_ms":5600}', NOW() - interval '10 days'),
('raul', 'message', '{"text":"Q2 campaign planning alignment achieved with all department leads. Ramadan, Summer, Route Launch, and NPS Recovery prioritized.","context":"weekly-planning"}', NOW() - interval '13 days'),
('raul', 'message', '{"text":"Stakeholder sign-off received for Q2 budget allocation across 4 campaigns totaling $540K.","context":"budget-approval"}', NOW() - interval '10 days'),
('raul', 'message', '{"text":"DXB-NRT route launch brief approved by route development team on first review.","context":"route-launch"}', NOW() - interval '8 days'),
('andres', 'error', '{"code":"SFMC_RATE_LIMIT","message":"Journey Builder API rate limit exceeded during batch deployment. Retrying with exponential backoff.","severity":"warning"}', NOW() - interval '5 days'),
('elena', 'error', '{"code":"LITMUS_UNAVAILABLE","message":"Litmus API timeout during rendering test batch. Service restored after 30 minutes.","severity":"warning"}', NOW() - interval '12 days'),
('guillermo', 'message', '{"text":"NPS production feed stable for 72 hours. Processing 1,200 surveys/day with sub-2-minute latency. No data loss detected.","context":"nps-monitoring"}', NOW() - interval '1 day'),
('diego', 'message', '{"text":"DXB-NRT addressable audience sized at 1.8M across UK, DE, UAE, and JP markets. Japan travel intent signal improves targeting by estimated 25%.","context":"segmentation"}', NOW() - interval '2 days'),
('carlos', 'message', '{"text":"Gold-to-Platinum attribution complete: email 62%, app 23%, web 15%. Recommending increased email investment for upgrade programs.","context":"attribution"}', NOW() - interval '6 days');

-- ─── SECTION 12: COLLABORATION RAISES ───────────────────────────────────────

INSERT INTO collaboration_raises (from_agent, to_agent, raise_type, title, details, status, resolution, created_at, resolved_at) VALUES
('lucia', 'sofia', 'handoff', 'Ramadan creative assets ready for brand review', 'All 8 Ramadan email copy variants for GCC market are complete and ready for brand tone and cultural sensitivity review. Includes EN and AR versions.', 'resolved', 'All variants approved. One minor tone adjustment applied to variant 3 (AR). Cultural sensitivity guide followed correctly.', NOW() - interval '9 days', NOW() - interval '8 days'),
('diego', 'javier', 'question', 'GDPR suppression rules for new DE segment', 'Building the DE_Silver_Active_90D segment. Need clarification on whether members with "ambiguous" consent status should be included or suppressed.', 'resolved', 'Members with ambiguous consent must be suppressed until re-permission is obtained. Updated suppression rules accordingly.', NOW() - interval '11 days', NOW() - interval '10 days'),
('andres', 'guillermo', 'blocker', 'Journey Builder API rate limit exceeded during batch deployment', 'Hitting rate limits when deploying multiple journey flows simultaneously. Need architecture guidance on throttling strategy.', 'resolved', 'Implemented exponential backoff with 500ms base interval. Also requested rate limit increase from SFMC support.', NOW() - interval '5 days', NOW() - interval '4 days'),
('carlos', 'raul', 'fyi', 'UK campaign outperforming forecast by 22%', 'February UK Spring Sale campaign final results: 22% above revenue forecast. Attribution shows Tuesday 10am sends as the strongest performer. Recommending this as default UK slot.', 'resolved', 'Acknowledged. Tuesday 10am confirmed as default UK send slot for Q2.', NOW() - interval '11 days', NOW() - interval '10 days'),
('elena', 'andres', 'question', 'Spam score elevated on FR market Ramadan template', 'FR market Ramadan template showing spam score of 1.8 (threshold is 2.0). While technically passing, this is higher than our target of under 1.5. Can we optimize the template?', 'acknowledged', NULL, NOW() - interval '4 days', NULL),
('valentina', 'diego', 'handoff', 'Skywards Gold conversion segment criteria defined', 'Platinum conversion scoring criteria finalized with 12 behavioral signals. Handing off to Diego for segment build. Key signals: flight frequency, lounge usage, miles balance, engagement score.', 'resolved', 'Segment built successfully. 18K high-propensity Gold members identified across all markets.', NOW() - interval '10 days', NOW() - interval '9 days'),
('martina', 'raul', 'blocker', 'Ramadan and Summer Sale calendar conflict detected', 'GCC markets: Ramadan last-week sends overlap with Summer Sale early-bird launch window. Cannot send both within 48 hours to overlapping audiences.', 'resolved', 'Resolved with staggered scheduling: Ramadan final sends on Tuesday, Summer early-bird on Friday. Audience overlap reduced from 34% to 8%.', NOW() - interval '8 days', NOW() - interval '7 days');

-- ─── SECTION 13: AGENT MEMORY ───────────────────────────────────────────────

INSERT INTO agent_memory (agent_id, key, value, scope) VALUES
('raul', 'campaign_preferences', '{"default_approval_flow":"brief > content > qa > legal > launch","preferred_meeting_day":"Monday","budget_review_frequency":"weekly","stakeholder_update_cadence":"bi-weekly"}', 'private'),
('raul', 'active_campaign_ids', '["ramadan-2026","gold-platinum-conversion","dxb-nrt-launch","nps-recovery","welcome-journey"]', 'shared'),
('valentina', 'loyalty_insights', '{"gold_to_platinum_conversion_rate":"4.2%","top_upgrade_signal":"lounge_usage_3x","data_quality_score":"94.2%","highest_ltv_segment":"platinum_frequent_flyers"}', 'shared'),
('valentina', 'crm_preferences', '{"preferred_data_refresh":"daily","segment_naming_convention":"MARKET_TIER_BEHAVIOR_PERIOD","identity_resolution_method":"email_skywards_id_match"}', 'private'),
('guillermo', 'architecture_decisions', '{"nps_feed_latency":"sub-2-minutes","skywards_api_rate_limit":"500_req_per_sec","fare_api_refresh_interval":"15_minutes","preferred_integration_pattern":"webhook_event_pipeline"}', 'shared'),
('guillermo', 'platform_config', '{"sfmc_environment":"production-emirates","data_extension_naming":"DE_MARKET_PURPOSE_DATE","api_version":"v2.1","monitoring_tool":"datadog"}', 'private'),
('lucia', 'content_guidelines', '{"emirates_tone":"premium_aspirational","max_subject_length":50,"personalization_tokens":["first_name","skywards_tier","miles_balance","last_destination"],"arabic_quality_score":"native_verified"}', 'shared'),
('lucia', 'language_performance', '{"de_optimal_subject_length":38,"uk_best_cta":"Book Now","gcc_arabic_greeting_uplift":"22%","fr_formal_tone_required":true}', 'private'),
('diego', 'segment_templates', '{"naming":"MARKET_TIER_BEHAVIOR_PERIOD","default_suppression":["gdpr_optout","hard_bounce","spam_complaint","do_not_contact"],"minimum_segment_size":5000}', 'shared'),
('diego', 'audience_benchmarks', '{"gcc_ramadan_addressable":"2.3M","summer_eu_addressable":"4.8M","dxb_nrt_addressable":"1.8M","gold_high_propensity":"18K"}', 'private'),
('andres', 'journey_patterns', '{"preferred_tool":"journey_builder_v2","retry_base_interval_ms":500,"max_retries":3,"deployment_method":"staged_rollout","a_b_test_min_population":15000}', 'shared'),
('andres', 'automation_config', '{"nps_recovery_branches":4,"welcome_journey_touches":8,"upgrade_journey_touches":5,"staging_test_scenarios":12}', 'private'),
('martina', 'calendar_rules', '{"min_gap_between_campaigns_hours":48,"gccc_ramadan_peak_send":"21:00_local","uk_optimal_send":"10:00_tuesday","max_audience_overlap_pct":8}', 'shared'),
('martina', 'scheduling_insights', '{"dxb_nrt_launch_optimal":"friday","welcome_cadence_days":[0,2,5,10,18,30,45,60],"summer_early_bird_lead_weeks":8}', 'private'),
('sofia', 'brand_thresholds', '{"min_compliance_rate":95,"target_compliance_rate":98,"tone_categories":["premium","aspirational","warm","exclusive"],"prohibited_words":["cheap","deal","bargain","discount_heavy"]}', 'shared'),
('sofia', 'compliance_history', '{"q1_2026_rate":"98.5%","violations_q1":3,"common_issue":"informal_tone_in_non_english","cultural_sensitivity_pass_rate":"100%"}', 'private'),
('javier', 'regulatory_framework', '{"gdpr_consent_max_age_months":24,"de_uwg_requirements":"explicit_optin","fr_cnil_updates":"march_2026","uae_data_protection":"federal_decree_45"}', 'shared'),
('javier', 'compliance_status', '{"de_repermission_needed":142000,"fr_repermission_needed":89000,"disclaimer_templates_count":28,"last_full_audit":"2026-02-28"}', 'private'),
('elena', 'qa_benchmarks', '{"max_spam_score":2.0,"target_spam_score":1.5,"rendering_clients_tested":12,"link_validation_coverage":"100%","wcag_compliance":"2.1_AA"}', 'shared'),
('elena', 'testing_insights', '{"outlook_2019_rtl_issue":true,"gmail_clipping_threshold_kb":102,"litmus_vs_emailonacid":"litmus_preferred","avg_qa_cycle_hours":6}', 'private'),
('carlos', 'kpi_benchmarks', '{"email_open_rate_target":"28%","ctr_target":"4.5%","conversion_target":"12%","attribution_model":"multi_touch_linear","anomaly_detection_threshold":"2_std_dev"}', 'shared'),
('carlos', 'analytics_config', '{"looker_refresh_interval":"hourly","attribution_window_days":30,"reporting_tool":"looker_studio","export_format":"google_sheets"}', 'private'),
('html-developer', 'template_library', '{"total_blocks":24,"ramadan_template":"dark_theme_rtl","responsive_breakpoints":["320px","480px","768px","1024px"],"build_time_target_minutes":45}', 'shared'),
('html-developer', 'design_preferences', '{"css_framework":"custom_emirates","dark_mode_support":true,"rtl_support":true,"max_email_width_px":600,"image_optimization":"webp_fallback_png"}', 'private');

-- ─── SECTION 14: AUDIT LOG ──────────────────────────────────────────────────

INSERT INTO audit_log (event_type, department, agent_id, title, details, date) VALUES
('project_created', 'strategic', NULL, 'Ramadan 2026 Campaign Suite created', 'New project: multi-market Ramadan campaign targeting GCC, UK, and DE Skywards members.', NOW() - interval '13 days'),
('project_created', 'strategic', NULL, 'Skywards Gold to Platinum Conversion Program created', 'New project: targeted lifecycle campaign to convert Gold members to Platinum tier.', NOW() - interval '13 days'),
('project_created', 'execution', NULL, 'Dubai-Tokyo Route Launch Campaign created', 'New project: full-funnel marketing campaign for DXB-NRT daily service launching August 2026.', NOW() - interval '12 days'),
('project_created', 'control', NULL, 'Post-Flight NPS Recovery Automation created', 'New project: automated journey to recover detractor NPS scores.', NOW() - interval '12 days'),
('project_status_changed', 'execution', NULL, 'Summer 2026 Fare Campaign marked Completed', 'Project completed: $4.2M revenue attributed, 32% open rate achieved.', NOW() - interval '11 days'),
('project_created', 'control', NULL, 'GDPR Consent Re-permission Campaign created', 'New project: re-permission campaign for DE (142K) and FR (89K) Skywards members.', NOW() - interval '10 days'),
('project_created', 'strategic', NULL, 'Emirates App Push Notification Strategy created', 'New project: comprehensive push notification strategy for Emirates mobile app.', NOW() - interval '10 days'),
('project_created', 'execution', NULL, 'Skywards Welcome Journey Redesign created', 'New project: redesign welcome journey from 3-email static to 8-touch adaptive.', NOW() - interval '8 days'),
('campaign_launched', 'execution', 'andres', 'NPS Recovery Journey deployed to staging', 'Full NPS recovery journey with score-band branching deployed to staging environment.', NOW() - interval '3 days'),
('compliance_review', 'control', 'sofia', 'Q1 Brand Compliance Report published', 'Q1 compliance rate: 98.5%. Highest quarterly rate achieved.', NOW() - interval '1 day'),
('compliance_review', 'control', 'sofia', 'Ramadan creative brand review completed', '7 variants approved, 1 flagged for tone adjustment (too casual). All resolved.', NOW() - interval '9 days'),
('segment_created', 'execution', 'diego', 'GCC Skywards Ramadan 2026 segment built', 'Segment: 2.3M addressable members across GCC markets with tier-based splits.', NOW() - interval '11 days'),
('segment_created', 'execution', 'diego', 'Gold-to-Platinum high-propensity segment created', 'Segment: 18K Gold members with 70%+ upgrade propensity identified.', NOW() - interval '11 days'),
('segment_created', 'execution', 'diego', 'DXB-NRT route launch audience sized', 'Audience: 1.8M across UK, DE, UAE, and JP markets.', NOW() - interval '2 days'),
('report_generated', 'control', 'carlos', 'Ramadan 2025 benchmark analysis completed', 'Benchmark report for 4 markets: GCC 38% avg engagement, UK 28%.', NOW() - interval '11 days'),
('report_generated', 'control', 'carlos', 'Gold-to-Platinum attribution model completed', 'Multi-touch attribution: email 62%, app 23%, web 15%.', NOW() - interval '6 days'),
('legal_review', 'control', 'javier', 'GDPR compliance verified for DE market', 'DE market GDPR + UWG requirements documented. 142K members flagged for re-permission.', NOW() - interval '12 days'),
('legal_review', 'control', 'javier', 'NPS recovery legal disclaimers approved', 'All recovery offer disclaimers reviewed and approved for all markets.', NOW() - interval '2 days'),
('legal_review', 'control', 'javier', 'FR CNIL compliance checklist finalized', 'FR market CNIL updated requirements integrated into compliance framework.', NOW() - interval '6 days'),
('workflow_completed', 'execution', 'lucia', 'Ramadan content production for 3 markets complete', 'Content completed for GCC (EN+AR), UK (EN), DE (DE). 8 subject line variants + body copy.', NOW() - interval '1 day'),
('workflow_completed', 'execution', 'andres', 'NPS recovery staging tests passed', 'All 12 staging test scenarios passed with zero failures. Ready for production.', NOW() - interval '1 day'),
('eod_generated', 'strategic', NULL, 'EOD reports generated for Strategic Layer', '4 agents reported for strategic department.', NOW() - interval '1 day'),
('eod_generated', 'execution', NULL, 'EOD reports generated for Execution Layer', '5 agents reported for execution department.', NOW() - interval '1 day'),
('eod_generated', 'control', NULL, 'EOD reports generated for Control & Validation', '4 agents reported for control department.', NOW() - interval '1 day'),
('weekly', 'strategic', NULL, 'Weekly session W8 completed', 'Strategic Layer Week 8 session completed with 4 brainstorm contributions and report generated.', NOW() - interval '6 days'),
('weekly', 'execution', NULL, 'Weekly session W8 completed', 'Execution Layer Week 8 session completed with 5 brainstorm contributions and report generated.', NOW() - interval '6 days'),
('weekly', 'control', NULL, 'Weekly session W8 completed', 'Control & Validation Week 8 session completed with 4 brainstorm contributions and report generated.', NOW() - interval '6 days'),
('pm_report', NULL, NULL, 'Week 8 PM Report generated', 'Weekly PM report covering team performance, blockers, and recommendations.', NOW() - interval '7 days'),
('pm_report', NULL, NULL, 'Week 9 PM Report generated', 'Weekly PM report: NPS ready for production, Ramadan approaching launch approval.', NOW());
