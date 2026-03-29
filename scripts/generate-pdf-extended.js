import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function imgToBase64(filePath) {
  const abs = path.resolve(__dirname, filePath);
  const buf = fs.readFileSync(abs);
  const ext = path.extname(filePath).slice(1).replace('jpg', 'jpeg');
  return `data:image/${ext};base64,${buf.toString('base64')}`;
}

const merkleSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 120">
  <polygon points="18,95 52,95 35,62" fill="#E8451C"/>
  <text x="62" y="92" font-family="Inter,Arial,Helvetica,sans-serif" font-size="88" font-weight="800" fill="#FFFFFF" letter-spacing="4">MERKLE</text>
</svg>`;
const merkleFull = `data:image/svg+xml;base64,${Buffer.from(merkleSvg).toString('base64')}`;

const merkleIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <polygon points="10,75 30,75 20,52" fill="#E8451C"/>
  <text x="32" y="74" font-family="Inter,Arial,Helvetica,sans-serif" font-size="62" font-weight="800" fill="#1B2A4A" letter-spacing="1">M</text>
</svg>`;
const merkleIcon = `data:image/svg+xml;base64,${Buffer.from(merkleIconSvg).toString('base64')}`;

const emiratesLogo = imgToBase64('../apps/dashboard/public/emirates-logo.png');

// ─── AGENT DATA ──────────────────────────────────────────────────────────────

const agents = [
  {
    num: '01', name: 'Campaign Manager Agent', layer: 'strategic', layerLabel: 'Strategic Layer',
    role: 'End-to-end campaign lifecycle management, KPI definition, budget optimization, and stakeholder reporting. This agent serves as the primary orchestrator for all campaign operations, coordinating work across the entire agent team and ensuring campaigns move through each phase on schedule.',
    capabilities: [
      { name: 'Campaign Orchestration', desc: 'Coordinates the full campaign lifecycle from brief creation through launch, managing dependencies between agents and ensuring smooth handoffs at each phase.' },
      { name: 'KPI Definition & Tracking', desc: 'Defines measurable success criteria for each campaign — open rates, CTR, conversions, ROI — and tracks performance against targets throughout the campaign lifecycle.' },
      { name: 'Budget Optimization', desc: 'Allocates campaign budgets across channels and markets, optimizing spend based on historical performance data and forecasted returns.' },
      { name: 'Cross-Channel Strategy', desc: 'Plans multi-channel campaign strategies that span email, push, SMS, and in-app, ensuring consistent messaging and optimal channel selection per audience segment.' },
      { name: 'Performance Forecasting', desc: 'Uses historical data and market signals to forecast campaign performance, enabling proactive adjustments before launch.' },
      { name: 'Stakeholder Reporting', desc: 'Generates executive-ready campaign status reports, performance summaries, and strategic recommendations for stakeholders.' },
    ],
    tools: [
      { name: 'Salesforce Marketing Cloud', usage: 'Campaign setup, email deployment, journey configuration, and send management' },
      { name: 'Looker Studio', usage: 'Campaign performance dashboards, KPI tracking, and stakeholder reporting' },
      { name: 'Tableau', usage: 'Advanced data visualization for budget allocation and ROI analysis' },
    ],
    workflows: [
      { name: 'Campaign Creation Engine', action: 'Create campaign brief, define objectives & coordinate pipeline' },
      { name: 'Flash Sale Rapid Deploy', action: 'Create urgent brief with product, discount & markets' },
      { name: 'Seasonal Campaign Planning', action: 'Define quarterly campaign calendar & objectives' },
      { name: 'Brand Audit Cycle', action: 'Review violations & decide escalation' },
      { name: 'Email Deliverability Check', action: 'Review findings & decide corrective actions' },
      { name: 'A/B Test Pipeline', action: 'Decide winner & roll out' },
      { name: 'Weekly Performance Digest', action: 'Add strategic commentary & recommendations' },
    ],
    impact: 'Central coordination point that prevents campaign bottlenecks, ensures deadline compliance, and provides executive visibility into the entire campaign portfolio.'
  },
  {
    num: '02', name: 'CRM Intelligence Agent', layer: 'strategic', layerLabel: 'Strategic Layer',
    role: 'Loyalty and retention intelligence powered by Emirates Skywards data. This agent manages member lifecycle analysis, identity resolution across systems, and precision targeting by loyalty tier — Blue, Silver, Gold, and Platinum — to maximize member engagement and lifetime value.',
    capabilities: [
      { name: 'CRM Segmentation', desc: 'Creates sophisticated audience segments based on Skywards tier, booking history, engagement patterns, and preference data for targeted campaign delivery.' },
      { name: 'Loyalty Analytics', desc: 'Analyzes Skywards program metrics — tier distribution, miles accrual patterns, redemption behavior — to identify growth and retention opportunities.' },
      { name: 'Lifecycle Automation', desc: 'Designs automated member lifecycle journeys from onboarding through tier upgrades, renewal reminders, and churn prevention.' },
      { name: 'Member Scoring', desc: 'Calculates engagement and propensity scores for each member, enabling predictive targeting for upgrade offers and retention campaigns.' },
      { name: 'Preference Targeting', desc: 'Leverages member preferences (destinations, cabin class, meal preferences) to personalize campaign content and offers.' },
      { name: 'Data Quality Flagging', desc: 'Identifies and flags data quality issues — duplicate records, stale contacts, consent gaps — to maintain CRM hygiene.' },
    ],
    tools: [
      { name: 'Salesforce CRM', usage: 'Member profile management, contact records, and interaction history' },
      { name: 'Skywards API', usage: 'Real-time member tier status, miles balance, and loyalty program data' },
      { name: 'CDP Profiles', usage: 'Unified customer profiles with cross-channel identity resolution' },
      { name: 'Customer 360 Dashboard', usage: 'Holistic view of member interactions across all touchpoints' },
    ],
    workflows: [
      { name: 'Audience Hygiene Cleanup', action: 'Validate contact data quality & enrich records' },
    ],
    impact: 'Enables precision targeting across 4 Skywards tiers and multiple markets, driving higher engagement rates through personalized loyalty-aware campaigns.'
  },
  {
    num: '03', name: 'MarTech Architecture Agent', layer: 'strategic', layerLabel: 'Strategic Layer',
    role: 'Marketing Cloud infrastructure ownership, data model design, API integration architecture, and platform scalability. This agent ensures the technical foundation supports high-volume campaign operations without bottlenecks or failures.',
    capabilities: [
      { name: 'Architecture Validation', desc: 'Reviews and validates the technical architecture of proposed campaigns, ensuring they can be supported by current infrastructure capacity and configuration.' },
      { name: 'Data Extension Modeling', desc: 'Designs and maintains the data extension structure in SFMC — subscriber tables, preference stores, transactional data — for optimal query performance.' },
      { name: 'API Integration Patterns', desc: 'Architects integrations between SFMC, Skywards API, CRM, and analytics platforms using secure, scalable API patterns.' },
      { name: 'Performance Optimization', desc: 'Monitors platform performance metrics (API response times, query execution, send throughput) and optimizes for peak campaign periods.' },
      { name: 'Implementation Risk Identification', desc: 'Proactively identifies technical risks in campaign plans — capacity limits, data dependencies, integration failures — before they become blockers.' },
      { name: 'Technical Feasibility Assessment', desc: 'Evaluates whether proposed campaign mechanics (dynamic content, real-time triggers, multi-step journeys) are technically feasible within current platform constraints.' },
    ],
    tools: [
      { name: 'SFMC Architecture', usage: 'Platform configuration, business unit setup, and infrastructure management' },
      { name: 'Data Model Standards', usage: 'Data extension schemas, naming conventions, and relationship mapping' },
      { name: 'Integration Blueprints', usage: 'API integration documentation, authentication flows, and error handling patterns' },
      { name: 'Security Guidelines', usage: 'Data encryption standards, access control policies, and compliance requirements' },
    ],
    workflows: [
      { name: 'Campaign Creation Engine', action: 'Validate infrastructure & capacity' },
      { name: 'Seasonal Campaign Planning', action: 'Reserve infrastructure capacity for peak periods' },
      { name: 'Email Deliverability Check', action: 'Validate infrastructure health & API limits' },
      { name: 'Audience Hygiene Cleanup', action: 'Clean data extensions & remove stale records' },
    ],
    impact: 'Prevents infrastructure-related campaign failures, ensures platform scalability during peak periods (Ramadan, holiday season), and maintains data integrity across all integrations.'
  },
  {
    num: '04', name: 'Competitive Intelligence Agent', layer: 'strategic', layerLabel: 'Strategic Layer',
    role: 'Monitors competitor airline communications across email, social media, and web channels. Identifies strategic opportunities, performs SWOT analysis, and detects emerging market trends to keep Emirates campaigns ahead of the competitive landscape.',
    capabilities: [
      { name: 'Competitor Monitoring', desc: 'Continuously tracks competitor airline marketing activities — email campaigns, social posts, website promotions — to maintain competitive awareness.' },
      { name: 'Multi-Channel Analysis', desc: 'Analyzes competitor presence across email, social media, web, and paid channels to identify gaps and opportunities in Emirates\' channel strategy.' },
      { name: 'SWOT Analysis', desc: 'Performs structured Strengths, Weaknesses, Opportunities, and Threats analysis for each major competitor, updated on a regular cadence.' },
      { name: 'Opportunity Detection', desc: 'Identifies market opportunities based on competitor weaknesses, unserved audience segments, or trending topics that Emirates can capitalize on.' },
      { name: 'Sentiment Analysis', desc: 'Monitors public sentiment toward competitor brands, detecting reputation issues or positive trends that may affect Emirates\' competitive positioning.' },
      { name: 'Trend Identification', desc: 'Tracks industry trends in airline marketing — personalization techniques, content formats, loyalty innovations — and recommends adoption strategies.' },
    ],
    tools: [
      { name: 'Email Scanner', usage: 'Captures and analyzes competitor email campaigns for subject lines, content, and send frequency' },
      { name: 'Social Monitor', usage: 'Tracks competitor social media activity, engagement metrics, and content themes' },
      { name: 'Sentiment Analyzer', usage: 'Natural language processing for brand sentiment scoring across public channels' },
      { name: 'Claude AI', usage: 'Advanced analysis of competitor strategies, trend synthesis, and report generation' },
      { name: 'News Aggregator', usage: 'Real-time industry news and competitor press release monitoring' },
    ],
    workflows: [
      { name: 'Competitor Digest', action: 'Weekly competitive intelligence digest with key findings and strategic recommendations' },
      { name: 'Opportunity Alerts', action: 'Real-time alerts when significant competitive opportunities or threats are detected' },
    ],
    impact: 'Keeps Emirates marketing strategy informed by competitive landscape, enabling proactive rather than reactive campaign planning.'
  },
  {
    num: '05', name: 'Content & Copywriting Agent', layer: 'execution', layerLabel: 'Execution Layer',
    role: 'Creates premium, brand-compliant marketing copy in English and Arabic. Generates subject line variants, personalized email content, and A/B testing copy while maintaining Emirates\' luxury brand tone across all communications.',
    capabilities: [
      { name: 'Subject Line Generation', desc: 'Generates multiple subject line variants optimized for open rates, incorporating personalization tokens, urgency cues, and brand-appropriate language.' },
      { name: 'Email Copy Drafting', desc: 'Writes full email body copy including headers, body text, CTAs, and pre-headers — tailored to campaign objectives and audience segments.' },
      { name: 'Multilingual Localization (EN/AR)', desc: 'Creates native-quality copy in English and Arabic, adapting tone, cultural references, and messaging for each market rather than simple translation.' },
      { name: 'Personalization Logic', desc: 'Embeds dynamic personalization tokens (name, tier, destination history) and conditional content blocks based on subscriber attributes.' },
      { name: 'A/B Variant Ideation', desc: 'Creates differentiated content variants for A/B testing with clear hypotheses — tone vs. urgency, short vs. long, benefit-led vs. offer-led.' },
      { name: 'Copy Optimization', desc: 'Analyzes historical campaign performance to refine copy patterns, word choices, and CTA language that drive higher engagement.' },
    ],
    tools: [
      { name: 'Claude AI', usage: 'Core LLM engine for copy generation, variant creation, and language adaptation' },
      { name: 'Emirates Prompt Library', usage: 'Pre-built prompt templates for consistent brand voice across campaign types' },
      { name: 'Brand Phrases DB', usage: 'Approved brand expressions, taglines, and terminology for Emirates communications' },
      { name: 'Translation Engine', usage: 'Supports multilingual copy creation with cultural adaptation rules' },
    ],
    workflows: [
      { name: 'Campaign Creation Engine', action: 'Generate multilingual copy variants (EN/AR)' },
      { name: 'Re-engagement Campaign', action: 'Generate "we miss you" copy & personalized offers' },
      { name: 'Flash Sale Rapid Deploy', action: 'Generate multilingual copy (EN/AR) — fast track' },
      { name: 'Seasonal Campaign Planning', action: 'Start creative briefs for planned campaigns' },
      { name: 'Brand Audit Cycle', action: 'Correct flagged pieces & resubmit' },
      { name: 'GDPR Consent Refresh', action: 'Generate re-consent request messaging' },
      { name: 'A/B Test Pipeline', action: 'Generate copy variants based on hypothesis' },
    ],
    impact: 'Generates premium multilingual copy at scale, reducing content creation time while maintaining consistent brand voice across 45+ concurrent campaigns.'
  },
  {
    num: '06', name: 'Audience Segmentation Agent', layer: 'execution', layerLabel: 'Execution Layer',
    role: 'Builds audience clusters with targeting logic, suppression rules, and data extension queries. Handles tier-market combinations, audience sizing, overlap detection, and reusable segment templates for recurring campaign types.',
    capabilities: [
      { name: 'Segment Definition', desc: 'Creates precise audience segments using combinations of Skywards tier, market, booking history, engagement recency, and preference data.' },
      { name: 'Suppression Logic', desc: 'Applies multi-layer suppression rules — recent purchasers, opt-outs, frequency caps, competitor exclusions — to prevent over-communication.' },
      { name: 'Audience Sizing', desc: 'Calculates accurate audience counts before campaign deployment, flagging segments that are too small (low impact) or too large (low relevance).' },
      { name: 'Tier-Market Targeting', desc: 'Builds combinatorial segments across 4 Skywards tiers and multiple markets (UK, UAE, US, DE) for precision targeting.' },
      { name: 'Overlap Detection', desc: 'Identifies segment overlaps exceeding 30%, flagging potential audience fatigue risks and recommending deduplication strategies.' },
      { name: 'Reusable Templates', desc: 'Maintains a library of reusable segment templates for recurring campaign types (route launches, holiday offers, newsletters) to accelerate future campaigns.' },
    ],
    tools: [
      { name: 'SFMC Data Extensions', usage: 'Core data store for subscriber attributes, preferences, and transactional data' },
      { name: 'Audience Rules Library', usage: 'Pre-defined segmentation rules and combinatorial logic templates' },
      { name: 'Consent & Suppression Lists', usage: 'Opt-out registers, frequency caps, and regulatory suppression lists' },
      { name: 'SQL Query Builder', usage: 'Custom SQL queries for complex segmentation logic against data extensions' },
    ],
    workflows: [
      { name: 'Campaign Creation Engine', action: 'Build audience segments & suppression logic' },
      { name: 'Re-engagement Campaign', action: 'Build re-engagement cohort with suppression rules' },
      { name: 'Seasonal Campaign Planning', action: 'Pre-build target audiences for upcoming campaigns' },
      { name: 'GDPR Consent Refresh', action: 'Build affected contacts segment' },
      { name: 'Audience Hygiene Cleanup', action: 'Audit segment overlaps & flag >30% duplicates' },
    ],
    impact: 'Ensures every campaign reaches the right audience with proper suppression, preventing fatigue and maximizing engagement through precision targeting.'
  },
  {
    num: '07', name: 'Automation Architect Agent', layer: 'execution', layerLabel: 'Execution Layer',
    role: 'Designs and deploys Journey Builder flows, automation sequences, and triggered campaigns. Configures triggers, scheduling, dependency mapping, and failure handling with intelligent retry logic.',
    capabilities: [
      { name: 'Workflow Design', desc: 'Architects multi-step automation workflows with decision splits, wait steps, and conditional branching based on subscriber behavior.' },
      { name: 'Journey Scaffolding', desc: 'Creates Journey Builder canvas layouts with entry sources, activities, and exits — ready for content insertion and testing.' },
      { name: 'Trigger & Scheduling', desc: 'Configures event-based triggers (purchase, browse, milestone) and time-based scheduling with timezone-aware send windows.' },
      { name: 'Dependency Mapping', desc: 'Maps dependencies between automation components — data feeds, API calls, content blocks — ensuring all prerequisites are met before activation.' },
      { name: 'Failure Handling & Retry', desc: 'Implements intelligent retry logic for failed sends, API timeouts, and data sync errors — reducing failed sends by 34% through automated recovery.' },
      { name: 'Deployment Runbooks', desc: 'Generates step-by-step deployment checklists for each journey, ensuring consistent activation and rollback procedures.' },
    ],
    tools: [
      { name: 'Journey Builder', usage: 'Visual journey design, entry source configuration, and journey activation' },
      { name: 'Automation Studio', usage: 'Scheduled automations, file imports, data extracts, and SQL activities' },
      { name: 'SFMC REST/SOAP APIs', usage: 'Programmatic journey management, triggered sends, and data operations' },
      { name: 'Monitoring & Retry', usage: 'Real-time journey health monitoring with automated failure recovery' },
    ],
    workflows: [
      { name: 'Campaign Creation Engine', action: 'Configure Journey Builder automation & triggers' },
      { name: 'Re-engagement Campaign', action: 'Deploy drip sequence journey' },
      { name: 'GDPR Consent Refresh', action: 'Deploy re-consent journey with reminders' },
      { name: 'A/B Test Pipeline', action: 'Configure split test in Journey Builder' },
    ],
    impact: 'Automates complex multi-step customer journeys, reducing manual deployment effort and preventing send failures through intelligent retry mechanisms.'
  },
  {
    num: '08', name: 'Calendar & Send-Time Agent', layer: 'execution', layerLabel: 'Execution Layer',
    role: 'Optimizes send times per market and detects scheduling conflicts across the entire campaign portfolio. Enforces holiday awareness, cadence rules, and priority balancing to maximize engagement and avoid audience fatigue.',
    capabilities: [
      { name: 'Send-Time Optimization', desc: 'Analyzes historical open/click data per market to determine optimal send windows (e.g., UK: Tuesday 10am, UAE: Sunday 8pm) for maximum engagement.' },
      { name: 'Conflict Detection', desc: 'Scans the campaign calendar for scheduling conflicts — overlapping sends to the same segment, competing promotions, or frequency cap violations.' },
      { name: 'Cadence Optimization', desc: 'Manages communication frequency per subscriber, ensuring no contact receives more than the designated number of messages per week/month.' },
      { name: 'Holiday-Aware Scheduling', desc: 'Maintains a market-specific holiday calendar (Ramadan, Christmas, National Day, Diwali) to avoid or leverage cultural moments.' },
      { name: 'Priority Balancing', desc: 'When send slots conflict, applies priority rules based on campaign type, revenue potential, and business urgency to determine scheduling order.' },
      { name: 'Timeline Planning', desc: 'Creates backward-scheduled timelines from launch date, calculating deadlines for each production phase (brief, content, QA, deploy).' },
    ],
    tools: [
      { name: 'Campaign Calendar', usage: 'Central calendar showing all scheduled sends, statuses, and conflicts' },
      { name: 'Send Time Signals', usage: 'Historical engagement data by market, day, and time slot' },
      { name: 'Market Holiday Calendar', usage: 'Comprehensive holiday database for all Emirates markets' },
      { name: 'Peak Traffic Curves', usage: 'Email platform traffic patterns to avoid high-congestion send windows' },
    ],
    workflows: [
      { name: 'Campaign Creation Engine', action: 'Schedule send date & detect conflicts' },
      { name: 'Seasonal Campaign Planning', action: 'Validate dates, detect conflicts & blackout periods' },
    ],
    impact: 'Prevents send-time collisions, optimizes engagement through data-driven scheduling, and ensures cultural sensitivity across all markets.'
  },
  {
    num: '09', name: 'Email Developer Agent', layer: 'execution', layerLabel: 'Execution Layer',
    role: 'Builds responsive HTML email templates, creates reusable content blocks, and validates cross-client rendering. Maintains a modular template library for rapid campaign deployment across all device types and email clients.',
    capabilities: [
      { name: 'Email Template Design', desc: 'Creates pixel-perfect responsive email templates that render correctly across desktop, mobile, and tablet — following Emirates brand guidelines.' },
      { name: 'Responsive HTML/CSS', desc: 'Writes optimized HTML and inline CSS that works across all major email clients (Gmail, Outlook, Apple Mail, Yahoo) including dark mode support.' },
      { name: 'Content Block Library', desc: 'Maintains a library of reusable, modular content blocks (hero banners, product cards, CTAs, footers) for rapid template assembly.' },
      { name: 'HTML Optimization', desc: 'Optimizes email HTML for file size, load time, and rendering performance — stripping unnecessary code and compressing images.' },
      { name: 'Cross-Client Rendering', desc: 'Tests and validates email rendering across 90+ email client/device combinations using automated preview tools.' },
      { name: 'Template Deployment', desc: 'Deploys finalized templates to SFMC Content Builder with proper naming conventions, folder structure, and version control.' },
    ],
    tools: [
      { name: 'SFMC Content Builder', usage: 'Template storage, content block management, and deployment' },
      { name: 'HTML/CSS Validator', usage: 'Code validation against email-specific HTML standards' },
      { name: 'Litmus Preview', usage: 'Cross-client rendering previews across 90+ email clients and devices' },
      { name: 'Block Library', usage: 'Centralized library of approved, reusable content blocks' },
    ],
    workflows: [
      { name: 'Campaign Creation Engine', action: 'Build email templates & HTML blocks' },
      { name: 'Flash Sale Rapid Deploy', action: 'Assemble email from pre-approved template blocks' },
      { name: 'A/B Test Pipeline', action: 'Build both template versions' },
      { name: 'Template Library Refresh', action: 'Audit existing templates against current standards' },
    ],
    impact: 'Enables rapid template production with consistent rendering quality, reducing development time through reusable blocks while maintaining pixel-perfect brand presentation.'
  },
  {
    num: '10', name: 'Brand Guardian Agent', layer: 'control', layerLabel: 'Control & Validation',
    role: 'Validates premium airline tone and brand compliance across all marketing communications. Enforces Emirates terminology glossary, flags casual or risky language, scores brand adherence, and ensures visual-copy alignment.',
    capabilities: [
      { name: 'Tone Consistency', desc: 'Analyzes copy for adherence to Emirates\' premium tone — confident, aspirational, and sophisticated — flagging language that feels too casual, urgent, or off-brand.' },
      { name: 'Brand Compliance Scoring', desc: 'Assigns a quantitative compliance score (0-100%) to each piece of content based on tone, terminology, visual alignment, and guideline adherence.' },
      { name: 'Terminology Enforcement', desc: 'Validates use of approved brand terminology (e.g., "Experience" not "deal", "Premium Economy" not "premium coach") against the Emirates glossary.' },
      { name: 'Content Risk Flagging', desc: 'Identifies potentially risky content — competitor mentions, price guarantees, unsubstantiated claims — before publication.' },
      { name: 'Rewrite Suggestions', desc: 'Provides specific, actionable rewrite suggestions for flagged content, maintaining the original intent while aligning with brand guidelines.' },
      { name: 'Visual-Copy Alignment', desc: 'Verifies that copy messaging aligns with visual creative — ensuring consistency between headlines, images, and CTAs.' },
    ],
    tools: [
      { name: 'Emirates Brand Guidelines', usage: 'Official brand rulebook for tone, colors, typography, and imagery standards' },
      { name: 'Tone & Style Analyzer', usage: 'AI-powered analysis of copy tone, readability, and brand alignment scoring' },
      { name: 'Terminology Glossary', usage: 'Approved and prohibited terms database for Emirates communications' },
      { name: 'Approved Copy Library', usage: 'Archive of previously approved copy for reference and pattern matching' },
    ],
    workflows: [
      { name: 'Campaign Creation Engine', action: 'Brand compliance review & tone validation' },
      { name: 'Flash Sale Rapid Deploy', action: 'Fast-track brand review' },
      { name: 'Brand Audit Cycle', action: 'Audit all active pieces — tone, colors, fonts, imagery' },
      { name: 'Template Library Refresh', action: 'Validate templates against updated brand guidelines' },
    ],
    impact: 'Maintains a 98.5% brand compliance rate across all campaigns, protecting Emirates\' premium brand positioning while enabling high-velocity content production.'
  },
  {
    num: '11', name: 'Legal & Compliance Agent', layer: 'control', layerLabel: 'Control & Validation',
    role: 'Ensures regulatory compliance across GDPR, UAE data protection, CAN-SPAM, and market-specific regulations. Generates disclaimers, audits consent status, validates claims, and flags regulatory risks before campaign deployment.',
    capabilities: [
      { name: 'Compliance Validation', desc: 'Reviews campaign content against applicable regulations for each target market — GDPR (EU), UAE Federal Law, CAN-SPAM (US), CASL (Canada).' },
      { name: 'Disclaimer Generation', desc: 'Automatically generates market-specific disclaimers, terms & conditions, and legal footnotes required for each campaign type and market.' },
      { name: 'Claims Scrutiny', desc: 'Validates promotional claims (pricing, savings percentages, service guarantees) against verifiable data to prevent misleading advertising.' },
      { name: 'Data Privacy Checks', desc: 'Verifies that personal data usage in campaigns complies with consent scope, purpose limitation, and data minimization principles.' },
      { name: 'Escalation Recommendations', desc: 'When compliance issues are detected, recommends severity level and escalation path — minor (self-correct), major (legal review), critical (block send).' },
      { name: 'Audit-Ready Documentation', desc: 'Generates compliance notes and decision logs for each campaign, creating an audit trail that meets regulatory inspection requirements.' },
    ],
    tools: [
      { name: 'Regulatory Requirements KB', usage: 'Comprehensive database of market-specific regulations and requirements' },
      { name: 'Market Disclaimer Library', usage: 'Pre-approved disclaimer templates for each market and campaign type' },
      { name: 'Consent & Privacy Rules', usage: 'Consent scope definitions, expiration rules, and purpose limitation logic' },
      { name: 'Risk Flagging Ruleset', usage: 'Automated rules for detecting high-risk content patterns and claims' },
    ],
    workflows: [
      { name: 'Campaign Creation Engine', action: 'Legal & regulatory compliance check (GDPR, CAN-SPAM, UAE)' },
      { name: 'Flash Sale Rapid Deploy', action: 'Expedited compliance check' },
      { name: 'GDPR Consent Refresh', action: 'Detect consents approaching expiration by regulation' },
      { name: 'Audience Hygiene Cleanup', action: 'Verify consent status for all active segments' },
    ],
    impact: 'Prevents regulatory violations that could result in significant fines (up to 4% of global turnover under GDPR), while enabling compliant campaign velocity.'
  },
  {
    num: '12', name: 'QA & Deliverability Agent', layer: 'control', layerLabel: 'Control & Validation',
    role: 'Performs comprehensive pre-send validation across link checking, cross-client rendering, spam scoring, tracking validation, and content completeness. Acts as the final quality gate before any campaign goes live.',
    capabilities: [
      { name: 'Link Validation', desc: 'Checks every link in the email — UTM parameters, redirect chains, landing page status codes — ensuring zero broken links at send time.' },
      { name: 'Render Testing', desc: 'Tests email rendering across major clients (Gmail, Outlook 2016/2019/365, Apple Mail, Yahoo) and devices (iOS, Android, desktop) flagging visual issues.' },
      { name: 'Content Completeness', desc: 'Validates that all content slots are filled — no placeholder text, missing images, empty personalization tokens, or broken dynamic content.' },
      { name: 'Subject Line Compliance', desc: 'Checks subject line length (< 50 chars optimal), preview text presence, and spam trigger word avoidance.' },
      { name: 'Spam Risk Scoring', desc: 'Runs spam score analysis against major ISP filters, checking content patterns, image-to-text ratio, and authentication records (DKIM, SPF, DMARC).' },
      { name: 'QA Checklist Output', desc: 'Generates a structured pass/fail QA checklist for each campaign, providing clear go/no-go status with specific failure details.' },
    ],
    tools: [
      { name: 'Link Checker', usage: 'Automated link validation with redirect chain analysis and status code verification' },
      { name: 'Litmus / Email on Acid', usage: 'Cross-client rendering previews and visual regression testing' },
      { name: 'HTML/CSS Validator', usage: 'Email-specific HTML validation against coding standards' },
      { name: 'Tracking Validator', usage: 'UTM parameter validation and analytics tracking verification' },
    ],
    workflows: [
      { name: 'Campaign Creation Engine', action: 'QA testing: links, renders, spam score & deliverability' },
      { name: 'Re-engagement Campaign', action: 'Validate renders & deliverability' },
      { name: 'Flash Sale Rapid Deploy', action: 'Rapid QA: links, renders & spam score' },
      { name: 'Email Deliverability Check', action: 'Run spam score, DKIM & SPF checks across active sends' },
      { name: 'A/B Test Pipeline', action: 'Validate renders for all variants' },
      { name: 'Template Library Refresh', action: 'Re-test renders across email clients & deprecate broken ones' },
    ],
    impact: 'Acts as the final quality gate, catching issues that would damage deliverability, engagement, or brand perception before they reach the inbox.'
  },
  {
    num: '13', name: 'Analytics & Attribution Agent', layer: 'control', layerLabel: 'Control & Validation',
    role: 'Generates post-campaign performance reports with multi-touch attribution and ROI analysis. Detects KPI anomalies, synthesizes audience insights, estimates incrementality, and produces executive summaries with next-best-action recommendations.',
    capabilities: [
      { name: 'Post-Campaign Analysis', desc: 'Produces comprehensive post-send reports covering open rates, CTR, conversion rates, revenue attribution, and benchmark comparisons within 24 hours of send.' },
      { name: 'Audience Insights Synthesis', desc: 'Analyzes response patterns by segment, tier, and market to reveal which audiences over/under-performed expectations and why.' },
      { name: 'Incrementality Estimation', desc: 'Estimates the true incremental impact of campaigns using holdout group analysis and statistical modeling to separate correlation from causation.' },
      { name: 'KPI Anomaly Detection', desc: 'Monitors campaign metrics in real-time, automatically flagging statistically significant deviations from expected performance (±2 standard deviations).' },
      { name: 'Executive Summaries', desc: 'Generates concise, stakeholder-ready summaries with key findings, performance highlights, and strategic recommendations — no data science expertise required.' },
      { name: 'Next-Best-Action Recommendations', desc: 'Based on campaign results, recommends follow-up actions — retarget non-openers, expand to new segments, adjust messaging for underperformers.' },
    ],
    tools: [
      { name: 'GA4 / Looker Studio', usage: 'Web analytics, conversion tracking, and custom performance dashboards' },
      { name: 'SFMC Engagement Logs', usage: 'Email engagement data — opens, clicks, bounces, unsubscribes' },
      { name: 'CRM / Loyalty DB', usage: 'Post-campaign booking and loyalty program data for revenue attribution' },
      { name: 'Tableau / PowerBI', usage: 'Advanced analytics visualization and cross-channel attribution modeling' },
    ],
    workflows: [
      { name: 'Re-engagement Campaign', action: 'Detect inactive contacts (90+ days) & analyze patterns' },
      { name: 'GDPR Consent Refresh', action: 'Measure opt-in rate & report compliance status' },
      { name: 'Email Deliverability Check', action: 'Report bounce/complaint rate trends' },
      { name: 'A/B Test Pipeline', action: 'Measure results & statistical significance' },
      { name: 'Weekly Performance Digest', action: 'Compile weekly KPIs across all channels & campaigns' },
      { name: 'Audience Hygiene Cleanup', action: 'Report impact on deliverability & audience metrics' },
    ],
    impact: 'Transforms raw campaign data into actionable intelligence, enabling data-driven optimization and providing executive visibility into marketing ROI.'
  },
  {
    num: '14', name: 'Documentation Auditor Agent', layer: 'control', layerLabel: 'Control & Validation',
    role: 'Audits campaign documentation for completeness, detects gaps, flags outdated documents, and scores coverage across compliance and operational documentation. Maintains audit history for governance and regulatory requirements.',
    capabilities: [
      { name: 'Documentation Auditing', desc: 'Systematically reviews all campaign-related documentation — briefs, specs, approvals, test results — against required documentation standards.' },
      { name: 'Coverage Scoring', desc: 'Calculates a documentation coverage score per campaign and per department, identifying areas where documentation falls below acceptable thresholds.' },
      { name: 'Gap Detection', desc: 'Identifies missing documentation — unsigned approvals, absent test reports, incomplete compliance records — and generates remediation tasks.' },
      { name: 'Outdated Document Flagging', desc: 'Flags documents that haven\'t been updated within their review period, ensuring all active documentation reflects current processes and requirements.' },
      { name: 'Audit History', desc: 'Maintains a complete audit trail of all documentation reviews, scores, and remediation actions for regulatory inspection readiness.' },
      { name: 'Compliance Documentation', desc: 'Ensures all regulatory-required documentation (consent records, data processing agreements, impact assessments) is present and current.' },
    ],
    tools: [
      { name: 'Claude AI', usage: 'Document analysis, gap detection, and coverage scoring through natural language understanding' },
      { name: 'Confluence', usage: 'Documentation storage, retrieval, and version history tracking' },
    ],
    workflows: [
      { name: 'Documentation Audit', action: 'Full documentation audit cycle with scoring, gap detection, and remediation tracking' },
    ],
    impact: 'Ensures campaign governance through systematic documentation coverage, reducing audit preparation time and maintaining regulatory readiness.'
  },
  {
    num: '15', name: 'Campaign Intelligence Coordinator', layer: 'orchestration', layerLabel: 'Orchestration',
    role: 'The strategic brain of AgentOS. This meta-agent orchestrates all 14 operational agents, maintains context across the entire campaign portfolio, and acts as the primary interface for human operators. It refines campaign ideas through natural language conversation, recommends optimal agent pipelines, classifies campaigns into 29 BAU types, and generates detailed project specifications.',
    capabilities: [
      { name: 'Agent Orchestration', desc: 'Routes campaign requests to the appropriate agents based on campaign type, complexity, and current agent workload — ensuring optimal resource allocation.' },
      { name: 'Pipeline Recommendation', desc: 'Analyzes campaign requirements and recommends the optimal agent pipeline — which agents are needed, in what order, and with what dependencies.' },
      { name: 'Brief Generation', desc: 'Generates detailed campaign project specifications from natural language conversation — objectives, target audience, messaging, timeline, and success metrics.' },
      { name: 'BAU Classification', desc: 'Classifies campaigns into 29 Business-As-Usual types (Route Launch, Holiday Offer, Partner Launch, Newsletter, etc.) to apply proven playbooks and templates.' },
      { name: 'Strategic Context Maintenance', desc: 'Maintains awareness of all active campaigns, agent statuses, and portfolio-level metrics to make informed orchestration decisions.' },
      { name: 'Natural Language Interface', desc: 'Enables human operators to interact with the entire agent system through conversational AI, lowering the barrier to campaign planning and execution.' },
    ],
    tools: [
      { name: 'Claude AI (Sonnet 4.6)', usage: 'Core reasoning engine for conversation, analysis, and project generation' },
      { name: 'All 14 Operational Agents', usage: 'Full orchestration access to delegate tasks and coordinate workflows' },
      { name: 'Campaign Portfolio Database', usage: 'Historical and active campaign data for context-aware recommendations' },
      { name: 'Workspace Context', usage: 'Team structure, department organization, and operational parameters' },
    ],
    workflows: [
      { name: 'All Workflows', action: 'Orchestrates, monitors, and coordinates agent pipelines across all 11 defined workflows' },
    ],
    impact: 'Enables teams to go from campaign idea to structured execution plan in minutes through natural language conversation, dramatically reducing planning overhead.'
  },
];

// ─── WORKFLOW DATA ───────────────────────────────────────────────────────────

const workflows = [
  {
    name: 'Campaign Creation Engine',
    desc: 'End-to-end campaign production pipeline that takes a campaign from initial brief to live deployment. This is the core workflow that coordinates the most agents and represents the primary value chain of the system.',
    trigger: 'New campaign request from stakeholder or generated from weekly planning session',
    output: 'Fully deployed, QA-validated campaign with all compliance approvals, live in Journey Builder',
    steps: [
      { agent: 'Campaign Manager Agent', action: 'Create campaign brief, define objectives, KPIs, target markets, and budget allocation. Coordinate the full agent pipeline.' },
      { agent: 'Segmentation Agent', action: 'Build audience segments with Skywards tier targeting and multi-layer suppression rules. Size audiences and validate data quality.' },
      { agent: 'Content Agent', action: 'Generate multilingual copy variants (EN/AR) — subject lines, body copy, CTAs, and pre-headers with personalization tokens.' },
      { agent: 'Email Developer Agent', action: 'Build responsive email templates using content blocks. Assemble final creative with dynamic content zones.' },
      { agent: 'Brand Guardian Agent', action: 'Brand compliance review — validate tone, terminology, visual-copy alignment. Score compliance and flag violations.' },
      { agent: 'Legal Agent', action: 'Regulatory compliance check — GDPR, CAN-SPAM, UAE law. Generate market-specific disclaimers and validate claims.' },
      { agent: 'Calendar Agent', action: 'Schedule optimal send date and time per market. Detect conflicts with other campaigns and enforce cadence rules.' },
      { agent: 'Automation Architect Agent', action: 'Configure Journey Builder flow — entry sources, decision splits, wait steps, and triggered sends.' },
      { agent: 'MarTech Architecture Agent', action: 'Validate infrastructure capacity — API limits, data extension performance, send throughput for expected volume.' },
      { agent: 'QA Agent', action: 'Final quality gate — link validation, cross-client rendering (90+ clients), spam scoring, tracking verification, and go/no-go checklist.' },
    ],
  },
  {
    name: 'Re-engagement Campaign',
    desc: 'Automated win-back workflow for contacts inactive for 90+ days. Uses behavioral analysis to identify at-risk contacts and deploys targeted drip sequences to re-engage them before they churn.',
    trigger: 'Analytics agent detects contacts with 90+ days of inactivity',
    output: 'Multi-step drip sequence deployed via Journey Builder targeting inactive contacts',
    steps: [
      { agent: 'Analytics Agent', action: 'Detect inactive contacts (90+ days of no opens, clicks, or site visits). Analyze inactivity patterns to identify recoverable vs. lost contacts.' },
      { agent: 'Segmentation Agent', action: 'Build re-engagement cohort with layered suppression — exclude recent purchasers, active complainers, and hard bounces.' },
      { agent: 'Content Agent', action: 'Generate personalized "we miss you" copy with tiered offers based on member value (exclusive fares for Gold/Platinum, miles bonuses for Blue/Silver).' },
      { agent: 'QA Agent', action: 'Validate email renders across clients, check all links, verify personalization tokens render correctly for each tier variant.' },
      { agent: 'Automation Architect Agent', action: 'Deploy multi-step drip sequence — initial reach-out, 7-day reminder, final offer with expiration — with behavioral triggers for early conversion.' },
    ],
  },
  {
    name: 'Flash Sale Rapid Deploy',
    desc: 'Emergency campaign deployment workflow designed for time-sensitive promotions. Uses pre-approved templates and fast-track review processes to achieve launch in under 4 hours.',
    trigger: 'Urgent business request for time-sensitive promotion (flash sale, partner deal, competitive response)',
    output: 'Live campaign deployed within 4 hours using pre-approved templates and expedited reviews',
    steps: [
      { agent: 'Campaign Manager Agent', action: 'Create urgent brief specifying product, discount percentage, target markets, and promotion window. Flag as high-priority.' },
      { agent: 'Content Agent', action: 'Fast-track multilingual copy generation (EN/AR) using pre-approved flash sale prompt templates for consistent brand voice under time pressure.' },
      { agent: 'Email Developer Agent', action: 'Rapid template assembly using pre-approved content blocks — swap hero image, update offer details, configure countdown timer.' },
      { agent: 'Brand Guardian Agent', action: 'Fast-track brand review — focused on critical items (tone, claims, imagery) with relaxed checks on minor style elements.' },
      { agent: 'Legal Agent', action: 'Expedited compliance check — validate pricing claims, generate required disclaimers, check offer terms against regulations.' },
      { agent: 'QA Agent', action: 'Rapid QA pass — critical link checks, primary client renders (Gmail, Outlook, Apple Mail), spam score verification.' },
    ],
  },
  {
    name: 'Seasonal Campaign Planning',
    desc: 'Quarterly strategic planning workflow that defines the campaign calendar, pre-builds audiences, starts creative briefs, and reserves infrastructure capacity for upcoming peak periods (Ramadan, summer, holiday season).',
    trigger: 'Quarterly planning cycle (typically 6-8 weeks before season start)',
    output: 'Complete quarterly campaign calendar with pre-built audiences, draft briefs, and reserved infrastructure',
    steps: [
      { agent: 'Campaign Manager Agent', action: 'Define quarterly campaign calendar — map all planned campaigns against key dates, allocate budgets, and set objective targets per campaign.' },
      { agent: 'Calendar Agent', action: 'Validate proposed dates against market holidays, blackout periods, and existing commitments. Detect conflicts and recommend alternatives.' },
      { agent: 'Segmentation Agent', action: 'Pre-build target audiences for all planned campaigns — create segment definitions, estimate sizes, and identify potential overlaps across the quarter.' },
      { agent: 'Content Agent', action: 'Start creative briefs for planned campaigns — draft thematic direction, key messages, and content requirements for early production cycles.' },
      { agent: 'MarTech Architecture Agent', action: 'Reserve infrastructure capacity for peak periods — validate send throughput, data extension capacity, and API rate limits for projected volume.' },
    ],
  },
  {
    name: 'Brand Audit Cycle',
    desc: 'Monthly audit of all active marketing materials for brand compliance. Reviews tone, colors, fonts, imagery, and terminology across every live campaign and content piece.',
    trigger: 'Monthly scheduled audit (first week of each month)',
    output: 'Brand compliance report with per-campaign scores, violation details, and corrective action plan',
    steps: [
      { agent: 'Brand Guardian Agent', action: 'Audit all active marketing pieces — review tone consistency, color usage, font compliance, imagery standards, and terminology correctness.' },
      { agent: 'Brand Guardian Agent', action: 'Generate comprehensive compliance report with percentage score per campaign, detailed violation breakdowns, and severity classification.' },
      { agent: 'Campaign Manager Agent', action: 'Review violations with stakeholders, decide escalation level for each issue, and assign corrective actions to responsible agents.' },
      { agent: 'Content Agent', action: 'Correct all flagged content pieces — rewrite off-brand copy, update terminology, adjust messaging — and resubmit for review.' },
      { agent: 'Brand Guardian Agent', action: 'Re-review corrected pieces against original violations, verify fixes are adequate, and close audit with final compliance scores.' },
    ],
  },
  {
    name: 'GDPR Consent Refresh',
    desc: 'Proactive re-consent collection workflow that identifies consents approaching expiration and deploys automated re-consent journeys to maintain database compliance before regulatory deadlines.',
    trigger: 'Legal agent detects consents within 30 days of expiration',
    output: 'Re-consent journey deployed with measurement of opt-in rates and compliance status report',
    steps: [
      { agent: 'Legal Agent', action: 'Detect consents approaching expiration by regulation type and market. Calculate affected contact volumes and prioritize by risk.' },
      { agent: 'Segmentation Agent', action: 'Build affected contacts segment with precise targeting — filter by consent type, market, and expiration window.' },
      { agent: 'Content Agent', action: 'Generate re-consent request messaging — clear value proposition for maintaining subscription, easy opt-in/opt-out mechanisms, regulatory-compliant language.' },
      { agent: 'Automation Architect Agent', action: 'Deploy multi-step re-consent journey — initial request, 7-day reminder, final notice with opt-out confirmation — with tracking for compliance reporting.' },
      { agent: 'Analytics Agent', action: 'Measure re-consent opt-in rate by market and segment. Report compliance status and identify at-risk populations for manual outreach.' },
    ],
  },
  {
    name: 'Email Deliverability Health Check',
    desc: 'Infrastructure and deliverability audit that reviews spam scores, authentication records (DKIM, SPF, DMARC), bounce trends, and complaint rates to maintain inbox placement.',
    trigger: 'Weekly scheduled check or triggered by bounce rate exceeding 2% threshold',
    output: 'Deliverability health report with corrective action recommendations',
    steps: [
      { agent: 'QA Agent', action: 'Run comprehensive spam score checks across all active sends. Validate DKIM signatures, SPF records, and DMARC policies for all sending domains.' },
      { agent: 'MarTech Architecture Agent', action: 'Validate infrastructure health — API response times, send queue depth, data extension query performance, and IP reputation scores.' },
      { agent: 'Analytics Agent', action: 'Report bounce rate trends (hard/soft), complaint rates by ISP, unsubscribe trends, and inbox placement rates across major providers.' },
      { agent: 'Campaign Manager Agent', action: 'Review deliverability findings, decide corrective actions (IP warmup, list cleanup, authentication fixes), and assign to responsible agents.' },
    ],
  },
  {
    name: 'A/B Test Pipeline',
    desc: 'End-to-end A/B testing workflow covering variant creation, split configuration, statistical measurement, and winner deployment. Ensures tests are properly designed with clear hypotheses and adequate sample sizes.',
    trigger: 'Test hypothesis defined by Campaign Manager or Content Agent',
    output: 'Statistically validated winner variant deployed to full audience',
    steps: [
      { agent: 'Content Agent', action: 'Generate copy variants based on defined hypothesis — e.g., urgency vs. benefit messaging, short vs. long subject lines, personalized vs. generic CTA.' },
      { agent: 'Email Developer Agent', action: 'Build both template versions with identical layout, varying only the test element to ensure clean measurement.' },
      { agent: 'QA Agent', action: 'Validate renders for all variants across target email clients. Ensure both versions are technically identical except for the test variable.' },
      { agent: 'Automation Architect Agent', action: 'Configure split test in Journey Builder — define split percentage, test duration, winning metric, and automatic winner deployment rules.' },
      { agent: 'Analytics Agent', action: 'Monitor test results in real-time. Calculate statistical significance (95% confidence), measure lift, and produce final test report.' },
      { agent: 'Campaign Manager Agent', action: 'Review test results with stakeholders. Decide whether to deploy winner, extend test, or run follow-up test. Document learnings.' },
    ],
  },
  {
    name: 'Weekly Performance Digest',
    desc: 'Automated weekly reporting workflow that compiles KPIs across all active campaigns and channels, enriched with strategic commentary and forward-looking recommendations.',
    trigger: 'Scheduled every Monday morning (automated)',
    output: 'Executive-ready weekly performance report distributed to stakeholders',
    steps: [
      { agent: 'Analytics Agent', action: 'Compile weekly KPIs across all channels and campaigns — aggregate open rates, CTR, conversions, revenue, and benchmark comparisons. Identify week-over-week trends and anomalies.' },
      { agent: 'Campaign Manager Agent', action: 'Add strategic commentary — explain performance drivers, highlight wins and concerns, provide recommendations for the upcoming week, and flag campaigns requiring attention.' },
    ],
  },
  {
    name: 'Template Library Refresh',
    desc: 'Periodic audit and maintenance of the email template library. Reviews existing templates against current brand guidelines and coding standards, re-tests renders, and deprecates broken or outdated templates.',
    trigger: 'Quarterly scheduled refresh or triggered by brand guideline update',
    output: 'Updated template library with deprecated templates removed and new standards applied',
    steps: [
      { agent: 'Email Developer Agent', action: 'Audit existing templates against current HTML/CSS standards, responsive design requirements, and dark mode compatibility. Flag outdated patterns.' },
      { agent: 'Brand Guardian Agent', action: 'Validate templates against latest brand guidelines — check colors, fonts, spacing, imagery standards, and tone alignment.' },
      { agent: 'QA Agent', action: 'Re-test all template renders across email clients. Identify broken templates and deprecate those that cannot be cost-effectively updated.' },
    ],
  },
  {
    name: 'Audience Hygiene Cleanup',
    desc: 'Data quality maintenance workflow that audits segment overlaps, validates contact data, verifies consent status, cleans stale records, and reports impact on deliverability metrics.',
    trigger: 'Monthly scheduled cleanup or triggered by segment overlap exceeding 30%',
    output: 'Clean audience data with validated consent, reduced overlaps, and improved deliverability metrics',
    steps: [
      { agent: 'Segmentation Agent', action: 'Audit all active segments for overlaps exceeding 30%. Recommend deduplication strategies and segment consolidation where appropriate.' },
      { agent: 'CRM Intelligence Agent', action: 'Validate contact data quality — check for missing fields, invalid email formats, duplicate records, and stale profiles (no activity in 12+ months).' },
      { agent: 'Legal Agent', action: 'Verify consent status for all active segments — check expiration dates, consent scope, and purpose limitation compliance across markets.' },
      { agent: 'MarTech Architecture Agent', action: 'Clean data extensions — remove orphaned records, archive stale contacts, optimize table indexes, and validate referential integrity.' },
      { agent: 'Analytics Agent', action: 'Report the impact of cleanup on key metrics — deliverability improvements, bounce rate changes, audience size adjustments, and projected engagement uplift.' },
    ],
  },
];

// ─── HTML GENERATION ─────────────────────────────────────────────────────────

function pageHeader(pageNum) {
  return `<div class="page-header">
    <div class="page-header-left">
      <img src="${merkleIcon}" alt="Merkle">
      <span class="page-header-title">AgentOS — Emirates Extended Overview</span>
    </div>
    <span class="page-header-page">Page ${pageNum}</span>
  </div>`;
}

function footer(pageNum) {
  return `<div class="page-footer">
    <span>Merkle, a dentsu company</span>
    <span>Page ${pageNum}</span>
  </div>`;
}

function agentPage(agent, pageNum) {
  const layerClass = agent.layer;
  return `
  <div class="page inner">
    ${pageHeader(pageNum)}
    <div class="agent-profile-header">
      <div>
        <span class="layer-label ${layerClass}">${agent.layerLabel}</span>
        <h2 class="agent-profile-name">${agent.num} — ${agent.name}</h2>
      </div>
    </div>
    <p class="agent-role">${agent.role}</p>

    <div class="two-col">
      <div>
        <h3 class="section-sm">Key Capabilities</h3>
        ${agent.capabilities.map(c => `
          <div class="cap-item">
            <h4>${c.name}</h4>
            <p>${c.desc}</p>
          </div>
        `).join('')}
      </div>
      <div>
        <h3 class="section-sm">Tools & Integrations</h3>
        ${agent.tools.map(t => `
          <div class="tool-item">
            <h4>${t.name}</h4>
            <p>${t.usage}</p>
          </div>
        `).join('')}

        <h3 class="section-sm" style="margin-top:14px;">Workflow Participation</h3>
        ${agent.workflows.map(w => `
          <div class="wf-item">
            <strong>${w.name}</strong>
            <span>${w.action}</span>
          </div>
        `).join('')}

        <h3 class="section-sm" style="margin-top:14px;">Business Impact</h3>
        <p class="impact-text">${agent.impact}</p>
      </div>
    </div>
    ${footer(pageNum)}
  </div>`;
}

function workflowPage(wf, pageNum) {
  const uniqueAgents = [...new Set(wf.steps.map(s => s.agent))];
  return `
  <div class="page inner">
    ${pageHeader(pageNum)}
    <h2 class="wf-title">${wf.name}</h2>
    <p class="wf-desc">${wf.desc}</p>

    <div class="wf-meta-grid">
      <div class="wf-meta-card">
        <div class="wf-meta-label">Trigger</div>
        <div class="wf-meta-value">${wf.trigger}</div>
      </div>
      <div class="wf-meta-card">
        <div class="wf-meta-label">Output</div>
        <div class="wf-meta-value">${wf.output}</div>
      </div>
      <div class="wf-meta-card">
        <div class="wf-meta-label">Agents Involved</div>
        <div class="wf-meta-value">${uniqueAgents.length} agents: ${uniqueAgents.join(', ')}</div>
      </div>
    </div>

    <h3 class="section-sm" style="margin-top:18px;">Step-by-Step Breakdown</h3>
    <div class="wf-steps">
      ${wf.steps.map((s, i) => `
        <div class="wf-step-card">
          <div class="wf-step-num">${i + 1}</div>
          <div class="wf-step-content">
            <h4>${s.agent}</h4>
            <p>${s.action}</p>
          </div>
        </div>
      `).join('')}
    </div>
    ${footer(pageNum)}
  </div>`;
}

let pageCounter = 1;

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');

  :root {
    --navy: #1B2A4A;
    --navy-light: #243656;
    --red: #E8451C;
    --white: #FFFFFF;
    --gray-50: #F8F9FA;
    --gray-100: #F1F3F5;
    --gray-200: #E9ECEF;
    --gray-300: #DEE2E6;
    --gray-500: #6C757D;
    --gray-700: #495057;
    --gray-900: #212529;
  }

  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    color: var(--gray-900);
    font-size: 10px;
    line-height: 1.5;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .page {
    width: 210mm;
    min-height: 297mm;
    padding: 0;
    page-break-after: always;
    position: relative;
    overflow: hidden;
  }
  .page:last-child { page-break-after: auto; }

  /* Cover */
  .cover {
    background: #192742;
    color: var(--white);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 60px 50px;
    min-height: 297mm;
  }
  .cover-merkle-logo { width: 320px; margin-bottom: 20px; }
  .cover-divider { width: 80px; height: 3px; background: var(--red); margin: 25px auto; }
  .cover-emirates-logo { width: 150px; margin: 20px auto; background: white; border-radius: 12px; padding: 15px 20px; }
  .cover-title { font-size: 28px; font-weight: 800; letter-spacing: -0.5px; margin-top: 30px; line-height: 1.2; }
  .cover-subtitle { font-size: 16px; font-weight: 300; margin-top: 10px; opacity: 0.85; }
  .cover-meta { margin-top: 50px; font-size: 12px; font-weight: 400; opacity: 0.7; line-height: 1.8; }

  /* Inner pages */
  .inner {
    padding: 35px 45px 55px;
    min-height: 297mm;
    position: relative;
  }
  .inner::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 4px;
    background: linear-gradient(90deg, var(--navy) 0%, var(--red) 100%);
  }

  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 22px;
    padding-bottom: 12px;
    border-bottom: 1px solid var(--gray-200);
  }
  .page-header-left { display: flex; align-items: center; gap: 10px; }
  .page-header img { height: 22px; }
  .page-header-title { font-size: 9px; color: var(--gray-500); font-weight: 500; letter-spacing: 0.5px; text-transform: uppercase; }
  .page-header-page { font-size: 9px; color: var(--gray-500); }

  .page-footer {
    position: absolute;
    bottom: 22px; left: 45px; right: 45px;
    display: flex;
    justify-content: space-between;
    font-size: 8px;
    color: var(--gray-400);
    border-top: 1px solid var(--gray-200);
    padding-top: 8px;
  }

  /* Section titles */
  .section-title { font-size: 20px; font-weight: 800; color: var(--navy); margin-bottom: 4px; }
  .section-subtitle { font-size: 11px; color: var(--gray-500); margin-bottom: 20px; }
  .section-sm { font-size: 10px; font-weight: 700; color: var(--navy); text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 8px; padding-bottom: 4px; border-bottom: 2px solid var(--red); display: inline-block; }

  p { margin-bottom: 8px; font-size: 10px; line-height: 1.6; color: var(--gray-700); }
  .lead { font-size: 11.5px; color: var(--gray-900); line-height: 1.7; }

  /* Layer labels */
  .layer-label {
    display: inline-block;
    padding: 2px 10px;
    border-radius: 4px;
    font-size: 8px;
    font-weight: 700;
    letter-spacing: 1px;
    text-transform: uppercase;
    color: var(--white);
    margin-bottom: 6px;
  }
  .layer-label.strategic { background: var(--navy); }
  .layer-label.execution { background: var(--navy-light); }
  .layer-label.control { background: #2d4a73; }
  .layer-label.orchestration { background: var(--red); }

  /* Agent profile page */
  .agent-profile-name { font-size: 18px; font-weight: 800; color: var(--navy); margin-bottom: 6px; }
  .agent-role { font-size: 10.5px; color: var(--gray-700); line-height: 1.65; margin-bottom: 16px; }

  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }

  .cap-item { margin-bottom: 8px; }
  .cap-item h4 { font-size: 9.5px; font-weight: 700; color: var(--navy); margin-bottom: 1px; }
  .cap-item p { font-size: 8.5px; color: var(--gray-500); margin: 0; line-height: 1.45; }

  .tool-item { background: var(--gray-50); border-radius: 5px; padding: 6px 10px; margin-bottom: 5px; }
  .tool-item h4 { font-size: 9px; font-weight: 700; color: var(--navy); margin-bottom: 1px; }
  .tool-item p { font-size: 8px; color: var(--gray-500); margin: 0; line-height: 1.4; }

  .wf-item { display: flex; gap: 6px; margin-bottom: 4px; font-size: 8.5px; line-height: 1.4; }
  .wf-item strong { color: var(--navy); min-width: 0; white-space: nowrap; font-size: 8.5px; }
  .wf-item span { color: var(--gray-500); font-size: 8.5px; }

  .impact-text { font-size: 9.5px; color: var(--navy); font-weight: 500; line-height: 1.55; background: var(--gray-50); border-left: 3px solid var(--red); padding: 8px 12px; border-radius: 0 6px 6px 0; }

  /* Workflow page */
  .wf-title { font-size: 18px; font-weight: 800; color: var(--navy); margin-bottom: 6px; }
  .wf-desc { font-size: 10.5px; color: var(--gray-700); line-height: 1.65; margin-bottom: 16px; }

  .wf-meta-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; }
  .wf-meta-card { background: var(--gray-50); border-radius: 8px; padding: 10px 14px; }
  .wf-meta-label { font-size: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: var(--gray-500); margin-bottom: 3px; }
  .wf-meta-value { font-size: 9px; color: var(--navy); font-weight: 500; line-height: 1.45; }

  .wf-steps { margin-top: 10px; }
  .wf-step-card { display: flex; gap: 12px; margin-bottom: 8px; align-items: flex-start; }
  .wf-step-num {
    background: var(--navy);
    color: var(--white);
    border-radius: 50%;
    min-width: 24px; height: 24px;
    display: flex; align-items: center; justify-content: center;
    font-size: 10px; font-weight: 700;
    margin-top: 2px;
  }
  .wf-step-content { flex: 1; }
  .wf-step-content h4 { font-size: 10px; font-weight: 700; color: var(--navy); margin-bottom: 2px; }
  .wf-step-content p { font-size: 9px; color: var(--gray-500); margin: 0; line-height: 1.5; }

  /* Architecture */
  .arch-layer {
    border-radius: 10px; padding: 16px 20px; margin-bottom: 10px;
    color: var(--white); display: flex; gap: 14px; align-items: flex-start;
  }
  .arch-layer.strategic { background: var(--navy); }
  .arch-layer.execution { background: var(--navy-light); }
  .arch-layer.control { background: #2d4a73; }
  .arch-layer.orchestration { background: linear-gradient(135deg, var(--red) 0%, #c73a17 100%); }
  .arch-layer-badge { background: rgba(255,255,255,0.15); border-radius: 6px; padding: 7px 11px; font-size: 16px; min-width: 38px; text-align: center; }
  .arch-layer-content h4 { font-size: 12px; font-weight: 700; margin-bottom: 2px; }
  .arch-layer-content p { font-size: 9.5px; color: rgba(255,255,255,0.75); margin: 0; line-height: 1.5; }
  .arch-arrows { text-align: center; color: var(--gray-300); font-size: 16px; margin: -3px 0; letter-spacing: 8px; }

  /* Value cards */
  .value-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 16px; }
  .value-card { background: var(--gray-50); border-radius: 8px; padding: 14px 16px; border-left: 3px solid var(--red); }
  .value-card h4 { font-size: 10.5px; font-weight: 700; color: var(--navy); margin-bottom: 3px; }
  .value-card p { font-size: 9px; margin: 0; color: var(--gray-500); line-height: 1.5; }

  /* Features */
  .feature-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 14px; }
  .feature-card { background: var(--gray-50); border-radius: 8px; padding: 14px 16px; }
  .feature-icon { width: 30px; height: 30px; background: var(--navy); border-radius: 7px; display: flex; align-items: center; justify-content: center; color: var(--white); font-size: 13px; margin-bottom: 8px; }
  .feature-card h4 { font-size: 10.5px; font-weight: 700; color: var(--navy); margin-bottom: 3px; }
  .feature-card p { font-size: 9px; color: var(--gray-500); margin: 0; line-height: 1.5; }

  /* Section dividers */
  .section-divider {
    background: var(--navy);
    color: var(--white);
    min-height: 297mm;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 60px;
  }
  .section-divider h2 { font-size: 32px; font-weight: 800; margin-bottom: 10px; }
  .section-divider p { font-size: 14px; font-weight: 300; opacity: 0.7; }
  .section-divider .divider-line { width: 60px; height: 3px; background: var(--red); margin: 20px auto; }

  /* Back cover */
  .back-cover {
    background: #192742;
    color: var(--white);
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    text-align: center; min-height: 297mm; padding: 60px 50px;
  }
  .back-cover-logo { width: 280px; margin-bottom: 10px; }
  .back-dentsu { font-size: 13px; font-weight: 300; opacity: 0.6; margin-bottom: 50px; letter-spacing: 1px; }
  .back-contact { font-size: 13px; font-weight: 500; line-height: 2; }
  .back-contact span { display: block; font-size: 11px; font-weight: 300; opacity: 0.6; }
  .back-line { width: 60px; height: 2px; background: var(--red); margin: 30px auto; }
</style>
</head>
<body>

<!-- PAGE 1: COVER -->
<div class="page cover">
  <img src="${merkleFull}" class="cover-merkle-logo" alt="Merkle">
  <div class="cover-divider"></div>
  <img src="${emiratesLogo}" class="cover-emirates-logo" alt="Emirates">
  <div class="cover-title">AgentOS</div>
  <div class="cover-subtitle" style="font-size: 18px; font-weight: 400; margin-top: 8px;">AI-Powered Marketing Operations Platform</div>
  <div class="cover-subtitle">Emirates Airline — Extended Overview</div>
  <div class="cover-meta">
    Guillermo Munoz<br>
    March 2026
  </div>
</div>

<!-- PAGE 2: EXECUTIVE SUMMARY -->
<div class="page inner">
  ${pageHeader(2)}
  <div class="section-title">Executive Summary</div>
  <div class="section-subtitle">Why AgentOS and what it solves</div>
  <p class="lead">Emirates operates <strong>45+ concurrent marketing campaigns</strong> across multiple markets, loyalty tiers, and channels. Managing this scale with traditional tools creates bottlenecks in coordination, compliance, and time-to-market. Every campaign must pass through brand validation, legal review, QA testing, and performance analysis — multiplying complexity at each step.</p>
  <p class="lead" style="margin-top: 10px;"><strong>AgentOS</strong> is an AI-powered operations platform purpose-built for teams working with autonomous AI agents. It orchestrates a team of <strong>15 specialized AI agents</strong> that handle the end-to-end campaign lifecycle — from strategic planning through execution to post-launch analytics — with built-in compliance at every step.</p>
  <div class="value-grid">
    <div class="value-card"><h4>Faster Campaign Launches</h4><p>Specialized AI agents work in parallel across content, segmentation, automation, and QA — dramatically reducing the brief-to-launch cycle.</p></div>
    <div class="value-card"><h4>Compliance by Design</h4><p>Brand, legal, and QA agents are embedded in every workflow. GDPR, UAE regulations, and premium brand tone are validated automatically.</p></div>
    <div class="value-card"><h4>Full Visibility & Audit Trail</h4><p>Centralized dashboard with real-time agent status, daily standups, EOD reports, and a complete audit log for governance.</p></div>
    <div class="value-card"><h4>Intelligent Orchestration</h4><p>A Campaign Intelligence Coordinator recommends agent pipelines, optimizes scheduling, and prevents conflicts across campaigns.</p></div>
    <div class="value-card"><h4>Skywards-Aware Targeting</h4><p>CRM intelligence agent understands Emirates loyalty tiers (Blue, Silver, Gold, Platinum) for precision targeting and lifecycle automation.</p></div>
    <div class="value-card"><h4>Multilingual at Scale</h4><p>Content agents generate premium-quality copy in English and Arabic, with personalization logic and A/B variant creation built in.</p></div>
  </div>
  ${footer(2)}
</div>

<!-- PAGE 3: ARCHITECTURE -->
<div class="page inner">
  ${pageHeader(3)}
  <div class="section-title">The Agent Architecture</div>
  <div class="section-subtitle">15 specialized AI agents organized in 3 operational layers</div>
  <p class="lead" style="margin-bottom: 18px;">AgentOS organizes its AI agents into three complementary layers, each with a distinct responsibility. This structure ensures that every campaign flows through strategic planning, hands-on execution, and rigorous validation before reaching the customer.</p>
  <div>
    <div class="arch-layer orchestration">
      <div class="arch-layer-badge">&#x1f9e0;</div>
      <div class="arch-layer-content"><h4>Campaign Intelligence Coordinator</h4><p>The orchestration brain — routes campaigns to the right agents, recommends pipelines, generates project briefs, and maintains strategic context across all operations.</p></div>
    </div>
    <div class="arch-arrows">&#x25BC; &#x25BC; &#x25BC;</div>
    <div class="arch-layer strategic">
      <div class="arch-layer-badge">&#x1f3af;</div>
      <div class="arch-layer-content"><h4>Strategic Layer — 4 Agents</h4><p>Campaign planning & orchestration, CRM & Skywards intelligence, MarTech architecture, competitive monitoring. These agents define what to do and why.</p></div>
    </div>
    <div class="arch-arrows">&#x25BC; &#x25BC; &#x25BC;</div>
    <div class="arch-layer execution">
      <div class="arch-layer-badge">&#x26A1;</div>
      <div class="arch-layer-content"><h4>Execution Layer — 5 Agents</h4><p>Content creation (multilingual), audience segmentation, journey automation, send-time optimization, and email template development. These agents do the hands-on work.</p></div>
    </div>
    <div class="arch-arrows">&#x25BC; &#x25BC; &#x25BC;</div>
    <div class="arch-layer control">
      <div class="arch-layer-badge">&#x1f6e1;</div>
      <div class="arch-layer-content"><h4>Control & Validation Layer — 5 Agents</h4><p>Brand compliance, legal & regulatory review, QA testing, post-campaign analytics, and documentation auditing. These agents ensure quality and compliance.</p></div>
    </div>
  </div>
  <p style="margin-top: 14px; font-size: 9px; color: var(--gray-500); text-align: center;">Each layer operates independently but communicates through the Coordinator, enabling parallel processing and built-in checks at every stage.</p>
  ${footer(3)}
</div>

<!-- SECTION DIVIDER: AGENTS -->
<div class="page section-divider">
  <h2>AI Agent Profiles</h2>
  <div class="divider-line"></div>
  <p>Detailed capabilities, tools, and workflow participation<br>for each of the 15 specialized agents</p>
</div>

<!-- AGENT PAGES -->
${agents.map((a, i) => agentPage(a, 5 + i)).join('\n')}

<!-- SECTION DIVIDER: WORKFLOWS -->
<div class="page section-divider">
  <h2>Workflow Deep Dives</h2>
  <div class="divider-line"></div>
  <p>Step-by-step breakdowns of all 11 automated workflows<br>that orchestrate multi-agent collaboration</p>
</div>

<!-- WORKFLOW PAGES -->
${workflows.map((w, i) => workflowPage(w, 21 + i)).join('\n')}

<!-- PLATFORM CAPABILITIES -->
<div class="page inner">
  ${pageHeader(32)}
  <div class="section-title">Platform Capabilities</div>
  <div class="section-subtitle">Built-in features that power the agent ecosystem</div>
  <div class="feature-grid">
    <div class="feature-card"><div class="feature-icon">&#x1f4ca;</div><h4>Centralized Dashboard</h4><p>Real-time visibility into all agents, campaigns, and departments. Workspace overview with KPI cards, status badges, and activity feeds.</p></div>
    <div class="feature-card"><div class="feature-icon">&#x2600;</div><h4>Daily Operations</h4><p>Automated daily standups by department, AI-generated summaries, and end-of-day reports with completed tasks, blockers, and next-day planning.</p></div>
    <div class="feature-card"><div class="feature-icon">&#x1f4c5;</div><h4>Weekly Planning Board</h4><p>5-tab planning system: brainstorming, prioritization, capacity planning, resource allocation, and weekly reports with KPI tracking.</p></div>
    <div class="feature-card"><div class="feature-icon">&#x1f680;</div><h4>Campaign Management Hub</h4><p>45+ campaign templates across lifecycle stages — acquisition, loyalty, recovery, onboarding, and communications.</p></div>
    <div class="feature-card"><div class="feature-icon">&#x1f4ac;</div><h4>AI Chat Interface</h4><p>Natural language conversation with the Campaign Intelligence Coordinator via streaming chat with voice controls.</p></div>
    <div class="feature-card"><div class="feature-icon">&#x1f6e1;</div><h4>Audit & Compliance</h4><p>Complete audit trail for every action: campaign launches, compliance reviews, segment creation, and legal reviews.</p></div>
    <div class="feature-card"><div class="feature-icon">&#x1f4e5;</div><h4>Unified Inbox</h4><p>Centralized message inbox from all agents with filtering, task creation, and direct PM Agent communication.</p></div>
    <div class="feature-card"><div class="feature-icon">&#x1f50d;</div><h4>Intelligence Hub</h4><p>AI-generated insights, trend analysis, coverage alerts, and PM performance reports with anomaly detection.</p></div>
  </div>
  ${footer(32)}
</div>

<!-- BACK COVER -->
<div class="page back-cover">
  <img src="${merkleFull}" class="back-cover-logo" alt="Merkle">
  <div class="back-dentsu">A dentsu company</div>
  <div class="back-line"></div>
  <div class="back-contact">
    Guillermo Munoz
    <span>Project Owner — Emirates AgentOS</span>
  </div>
  <div class="back-line"></div>
  <div style="margin-top: 30px;">
    <img src="${emiratesLogo}" style="width: 100px; background: white; border-radius: 8px; padding: 10px 14px;" alt="Emirates">
  </div>
</div>

</body>
</html>`;

(async () => {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });

  const outputPath = path.resolve(__dirname, 'AgentOS-Emirates-Extended.pdf');
  await page.pdf({
    path: outputPath,
    format: 'A4',
    printBackground: true,
    preferCSSPageSize: false,
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
  });

  await browser.close();
  console.log(`Extended PDF generated: ${outputPath}`);
})();
