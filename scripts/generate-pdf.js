import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Convert images to base64
function imgToBase64(filePath) {
  const abs = path.resolve(__dirname, filePath);
  const buf = fs.readFileSync(abs);
  const ext = path.extname(filePath).slice(1).replace('jpg', 'jpeg');
  return `data:image/${ext};base64,${buf.toString('base64')}`;
}

// Merkle logo as inline SVG (transparent background, white text, red triangle)
const merkleSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 120">
  <polygon points="18,95 52,95 35,62" fill="#E8451C"/>
  <text x="62" y="92" font-family="Inter,Arial,Helvetica,sans-serif" font-size="88" font-weight="800" fill="#FFFFFF" letter-spacing="4">MERKLE</text>
</svg>`;
const merkleFull = `data:image/svg+xml;base64,${Buffer.from(merkleSvg).toString('base64')}`;

// Small Merkle M icon as SVG
const merkleIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <polygon points="10,75 30,75 20,52" fill="#E8451C"/>
  <text x="32" y="74" font-family="Inter,Arial,Helvetica,sans-serif" font-size="62" font-weight="800" fill="#1B2A4A" letter-spacing="1">M</text>
</svg>`;
const merkleIcon = `data:image/svg+xml;base64,${Buffer.from(merkleIconSvg).toString('base64')}`;

const emiratesLogo = imgToBase64('../apps/dashboard/public/emirates-logo.png');

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
    font-size: 11px;
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

  /* ========== COVER PAGE ========== */
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
  .cover-merkle-logo {
    width: 320px;
    margin-bottom: 20px;
  }
  .cover-divider {
    width: 80px;
    height: 3px;
    background: var(--red);
    margin: 25px auto;
  }
  .cover-emirates-logo {
    width: 150px;
    margin: 20px auto;
    background: white;
    border-radius: 12px;
    padding: 15px 20px;
  }
  .cover-title {
    font-size: 28px;
    font-weight: 800;
    letter-spacing: -0.5px;
    margin-top: 30px;
    line-height: 1.2;
  }
  .cover-subtitle {
    font-size: 16px;
    font-weight: 300;
    margin-top: 10px;
    opacity: 0.85;
  }
  .cover-meta {
    margin-top: 50px;
    font-size: 12px;
    font-weight: 400;
    opacity: 0.7;
    line-height: 1.8;
  }
  .cover-confidential {
    margin-top: 30px;
    border: 1px solid rgba(255,255,255,0.25);
    padding: 6px 20px;
    border-radius: 4px;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 2px;
    text-transform: uppercase;
    opacity: 0.6;
  }

  /* ========== INNER PAGES ========== */
  .inner {
    padding: 40px 50px 60px;
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

  /* Header bar */
  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 30px;
    padding-bottom: 15px;
    border-bottom: 1px solid var(--gray-200);
  }
  .page-header-left {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .page-header img {
    height: 24px;
  }
  .page-header-title {
    font-size: 10px;
    color: var(--gray-500);
    font-weight: 500;
    letter-spacing: 0.5px;
    text-transform: uppercase;
  }

  /* Section titles */
  .section-title {
    font-size: 22px;
    font-weight: 800;
    color: var(--navy);
    margin-bottom: 5px;
    letter-spacing: -0.3px;
  }
  .section-subtitle {
    font-size: 12px;
    color: var(--gray-500);
    font-weight: 400;
    margin-bottom: 25px;
  }

  /* Text */
  p { margin-bottom: 10px; font-size: 11px; line-height: 1.65; color: var(--gray-700); }
  .lead { font-size: 12.5px; color: var(--gray-900); font-weight: 400; line-height: 1.7; }

  /* Value prop cards */
  .value-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;
    margin-top: 20px;
  }
  .value-card {
    background: var(--gray-50);
    border-radius: 8px;
    padding: 16px 18px;
    border-left: 3px solid var(--red);
  }
  .value-card h4 {
    font-size: 11.5px;
    font-weight: 700;
    color: var(--navy);
    margin-bottom: 4px;
  }
  .value-card p {
    font-size: 10px;
    margin: 0;
    color: var(--gray-500);
    line-height: 1.5;
  }

  /* Architecture diagram */
  .arch-diagram {
    margin: 20px 0;
  }
  .arch-layer {
    border-radius: 10px;
    padding: 18px 22px;
    margin-bottom: 12px;
    color: var(--white);
    display: flex;
    gap: 15px;
    align-items: flex-start;
  }
  .arch-layer.strategic { background: var(--navy); }
  .arch-layer.execution { background: var(--navy-light); }
  .arch-layer.control { background: #2d4a73; }
  .arch-layer.orchestration {
    background: linear-gradient(135deg, var(--red) 0%, #c73a17 100%);
  }
  .arch-layer-badge {
    background: rgba(255,255,255,0.15);
    border-radius: 6px;
    padding: 8px 12px;
    font-size: 18px;
    min-width: 42px;
    text-align: center;
  }
  .arch-layer-content h4 {
    font-size: 13px;
    font-weight: 700;
    margin-bottom: 3px;
  }
  .arch-layer-content p {
    font-size: 10px;
    color: rgba(255,255,255,0.75);
    margin: 0;
    line-height: 1.5;
  }
  .arch-arrows {
    text-align: center;
    color: var(--gray-300);
    font-size: 18px;
    margin: -4px 0;
    letter-spacing: 8px;
  }

  /* Agent cards */
  .layer-section {
    margin-bottom: 22px;
  }
  .layer-label {
    display: inline-block;
    padding: 3px 12px;
    border-radius: 4px;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 1px;
    text-transform: uppercase;
    color: var(--white);
    margin-bottom: 12px;
  }
  .layer-label.strategic { background: var(--navy); }
  .layer-label.execution { background: var(--navy-light); }
  .layer-label.control { background: #2d4a73; }
  .layer-label.orchestration { background: var(--red); }

  .agent-card {
    background: var(--white);
    border: 1px solid var(--gray-200);
    border-radius: 8px;
    padding: 14px 16px;
    margin-bottom: 10px;
    page-break-inside: avoid;
  }
  .agent-card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 6px;
  }
  .agent-card h4 {
    font-size: 12px;
    font-weight: 700;
    color: var(--navy);
  }
  .agent-card-number {
    background: var(--gray-100);
    border-radius: 50%;
    width: 22px;
    height: 22px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 9px;
    font-weight: 700;
    color: var(--gray-500);
  }
  .agent-card .desc {
    font-size: 10px;
    color: var(--gray-700);
    margin-bottom: 8px;
    line-height: 1.5;
  }
  .agent-caps {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  .agent-cap {
    background: var(--gray-100);
    border-radius: 4px;
    padding: 2px 8px;
    font-size: 8.5px;
    color: var(--gray-700);
    font-weight: 500;
  }
  .agent-tools {
    margin-top: 6px;
    font-size: 9px;
    color: var(--gray-500);
  }
  .agent-tools strong { color: var(--gray-700); }

  /* Workflow */
  .workflow-step {
    display: flex;
    align-items: flex-start;
    gap: 14px;
    margin-bottom: 10px;
  }
  .workflow-num {
    background: var(--navy);
    color: var(--white);
    border-radius: 50%;
    min-width: 26px;
    height: 26px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    font-weight: 700;
    margin-top: 2px;
  }
  .workflow-content h4 {
    font-size: 11px;
    font-weight: 600;
    color: var(--navy);
    margin-bottom: 2px;
  }
  .workflow-content p {
    font-size: 10px;
    color: var(--gray-500);
    margin: 0;
  }
  .workflow-highlight {
    background: linear-gradient(135deg, var(--navy) 0%, var(--navy-light) 100%);
    color: var(--white);
    border-radius: 10px;
    padding: 18px 22px;
    margin-top: 20px;
    text-align: center;
  }
  .workflow-highlight h4 {
    font-size: 14px;
    font-weight: 700;
    margin-bottom: 4px;
  }
  .workflow-highlight p {
    font-size: 11px;
    color: rgba(255,255,255,0.75);
    margin: 0;
  }

  /* Platform features */
  .feature-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;
    margin-top: 15px;
  }
  .feature-card {
    background: var(--gray-50);
    border-radius: 8px;
    padding: 16px 18px;
    page-break-inside: avoid;
  }
  .feature-icon {
    width: 32px;
    height: 32px;
    background: var(--navy);
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--white);
    font-size: 14px;
    margin-bottom: 10px;
  }
  .feature-card h4 {
    font-size: 11.5px;
    font-weight: 700;
    color: var(--navy);
    margin-bottom: 4px;
  }
  .feature-card p {
    font-size: 10px;
    color: var(--gray-500);
    margin: 0;
    line-height: 1.5;
  }

  /* Back cover */
  .back-cover {
    background: #192742;
    color: var(--white);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    min-height: 297mm;
    padding: 60px 50px;
  }
  .back-cover-logo { width: 280px; margin-bottom: 10px; }
  .back-dentsu {
    font-size: 13px;
    font-weight: 300;
    opacity: 0.6;
    margin-bottom: 50px;
    letter-spacing: 1px;
  }
  .back-contact {
    font-size: 13px;
    font-weight: 500;
    line-height: 2;
  }
  .back-contact span {
    display: block;
    font-size: 11px;
    font-weight: 300;
    opacity: 0.6;
  }
  .back-line {
    width: 60px;
    height: 2px;
    background: var(--red);
    margin: 30px auto;
  }
  .back-confidential {
    margin-top: 40px;
    font-size: 9px;
    opacity: 0.4;
    letter-spacing: 1.5px;
    text-transform: uppercase;
  }

  /* Footer */
  .page-footer {
    position: absolute;
    bottom: 25px;
    left: 50px;
    right: 50px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 8px;
    color: var(--gray-400);
    border-top: 1px solid var(--gray-200);
    padding-top: 10px;
  }
  .page-footer img { height: 14px; opacity: 0.4; }
</style>
</head>
<body>

<!-- ==================== PAGE 1: COVER ==================== -->
<div class="page cover">
  <img src="${merkleFull}" class="cover-merkle-logo" alt="Merkle">
  <div class="cover-divider"></div>
  <img src="${emiratesLogo}" class="cover-emirates-logo" alt="Emirates">
  <div class="cover-title">AgentOS</div>
  <div class="cover-subtitle" style="font-size: 18px; font-weight: 400; margin-top: 8px;">AI-Powered Marketing Operations Platform</div>
  <div class="cover-subtitle">Emirates Airline — Project Overview</div>
  <div class="cover-meta">
    Guillermo Munoz<br>
    March 2026
  </div>
</div>

<!-- ==================== PAGE 2: EXECUTIVE SUMMARY ==================== -->
<div class="page inner">
  <div class="page-header">
    <div class="page-header-left">
      <img src="${merkleIcon}" alt="Merkle">
      <span class="page-header-title">AgentOS — Emirates Project Overview</span>
    </div>
  </div>

  <div class="section-title">Executive Summary</div>
  <div class="section-subtitle">Why AgentOS and what it solves</div>

  <p class="lead">
    Emirates operates <strong>45+ concurrent marketing campaigns</strong> across multiple markets, loyalty tiers,
    and channels. Managing this scale with traditional tools creates bottlenecks in coordination, compliance,
    and time-to-market. Every campaign must pass through brand validation, legal review, QA testing, and
    performance analysis — multiplying complexity at each step.
  </p>

  <p class="lead" style="margin-top: 12px;">
    <strong>AgentOS</strong> is an AI-powered operations platform purpose-built for teams working with
    autonomous AI agents. Rather than replacing existing tools, it orchestrates a team of <strong>15 specialized
    AI agents</strong> that handle the end-to-end campaign lifecycle — from strategic planning through execution
    to post-launch analytics — with built-in compliance at every step.
  </p>

  <div class="value-grid">
    <div class="value-card">
      <h4>Faster Campaign Launches</h4>
      <p>Specialized AI agents work in parallel across content, segmentation, automation, and QA — dramatically reducing the brief-to-launch cycle.</p>
    </div>
    <div class="value-card">
      <h4>Compliance by Design</h4>
      <p>Brand, legal, and QA agents are embedded in every workflow. GDPR, UAE regulations, and premium brand tone are validated automatically.</p>
    </div>
    <div class="value-card">
      <h4>Full Visibility & Audit Trail</h4>
      <p>Centralized dashboard with real-time agent status, daily standups, EOD reports, and a complete audit log for governance.</p>
    </div>
    <div class="value-card">
      <h4>Intelligent Orchestration</h4>
      <p>A Campaign Intelligence Coordinator recommends agent pipelines, optimizes scheduling, and prevents conflicts across campaigns.</p>
    </div>
    <div class="value-card">
      <h4>Skywards-Aware Targeting</h4>
      <p>CRM intelligence agent understands Emirates loyalty tiers (Blue, Silver, Gold, Platinum) for precision targeting and lifecycle automation.</p>
    </div>
    <div class="value-card">
      <h4>Multilingual at Scale</h4>
      <p>Content agents generate premium-quality copy in English and Arabic, with personalization logic and A/B variant creation built in.</p>
    </div>
  </div>

  <div class="page-footer">
    <span>Merkle, a dentsu company</span>
    <span>Page 2</span>
  </div>
</div>

<!-- ==================== PAGE 3: ARCHITECTURE ==================== -->
<div class="page inner">
  <div class="page-header">
    <div class="page-header-left">
      <img src="${merkleIcon}" alt="Merkle">
      <span class="page-header-title">AgentOS — Emirates Project Overview</span>
    </div>
  </div>

  <div class="section-title">The Agent Architecture</div>
  <div class="section-subtitle">15 specialized AI agents organized in 3 operational layers</div>

  <p class="lead" style="margin-bottom: 20px;">
    AgentOS organizes its AI agents into three complementary layers, each with a distinct responsibility.
    This structure ensures that every campaign flows through strategic planning, hands-on execution,
    and rigorous validation before reaching the customer.
  </p>

  <div class="arch-diagram">
    <div class="arch-layer orchestration">
      <div class="arch-layer-badge">&#x1f9e0;</div>
      <div class="arch-layer-content">
        <h4>Campaign Intelligence Coordinator</h4>
        <p>The orchestration brain — routes campaigns to the right agents, recommends pipelines, generates project briefs, and maintains strategic context across all operations.</p>
      </div>
    </div>

    <div class="arch-arrows">&#x25BC; &#x25BC; &#x25BC;</div>

    <div class="arch-layer strategic">
      <div class="arch-layer-badge">&#x1f3af;</div>
      <div class="arch-layer-content">
        <h4>Strategic Layer — 4 Agents</h4>
        <p>Campaign planning &amp; orchestration, CRM &amp; Skywards intelligence, MarTech architecture, competitive monitoring. These agents define <em>what</em> to do and <em>why</em>.</p>
      </div>
    </div>

    <div class="arch-arrows">&#x25BC; &#x25BC; &#x25BC;</div>

    <div class="arch-layer execution">
      <div class="arch-layer-badge">&#x26A1;</div>
      <div class="arch-layer-content">
        <h4>Execution Layer — 5 Agents</h4>
        <p>Content creation (multilingual), audience segmentation, journey automation, send-time optimization, and email template development. These agents do the <em>hands-on work</em>.</p>
      </div>
    </div>

    <div class="arch-arrows">&#x25BC; &#x25BC; &#x25BC;</div>

    <div class="arch-layer control">
      <div class="arch-layer-badge">&#x1f6e1;</div>
      <div class="arch-layer-content">
        <h4>Control & Validation Layer — 5 Agents</h4>
        <p>Brand compliance, legal &amp; regulatory review, QA testing, post-campaign analytics, and documentation auditing. These agents ensure <em>quality and compliance</em>.</p>
      </div>
    </div>
  </div>

  <p style="margin-top: 16px; font-size: 10px; color: var(--gray-500); text-align: center;">
    Each layer operates independently but communicates through the Coordinator, enabling parallel processing and built-in checks at every stage.
  </p>

  <div class="page-footer">
    <span>Merkle, a dentsu company</span>
    <span>Page 3</span>
  </div>
</div>

<!-- ==================== PAGE 4: AGENTS — STRATEGIC ==================== -->
<div class="page inner">
  <div class="page-header">
    <div class="page-header-left">
      <img src="${merkleIcon}" alt="Merkle">
      <span class="page-header-title">AgentOS — Emirates Project Overview</span>
    </div>
  </div>

  <div class="section-title">AI Agent Directory</div>
  <div class="section-subtitle">Detailed capabilities of each proposed AI agent</div>

  <div class="layer-section">
    <div class="layer-label strategic">Strategic Layer</div>

    <div class="agent-card">
      <div class="agent-card-header">
        <h4>01 &mdash; Campaign Manager Agent</h4>
      </div>
      <div class="desc">End-to-end campaign lifecycle management. Defines KPIs, manages budgets, coordinates cross-channel strategy, and generates stakeholder reports. Acts as the primary orchestrator for all campaign operations.</div>
      <div class="agent-caps">
        <span class="agent-cap">Campaign orchestration</span>
        <span class="agent-cap">Budget optimization</span>
        <span class="agent-cap">KPI definition</span>
        <span class="agent-cap">Performance forecasting</span>
        <span class="agent-cap">Stakeholder reporting</span>
        <span class="agent-cap">Rollout planning</span>
      </div>
      <div class="agent-tools"><strong>Integrations:</strong> Salesforce Marketing Cloud, Looker Studio, Tableau, Campaign Brief Templates</div>
    </div>

    <div class="agent-card">
      <div class="agent-card-header">
        <h4>02 &mdash; CRM Intelligence Agent</h4>
      </div>
      <div class="desc">Loyalty &amp; retention intelligence powered by Skywards data. Manages member lifecycle analysis, identity resolution across systems, and precision targeting by tier (Blue, Silver, Gold, Platinum).</div>
      <div class="agent-caps">
        <span class="agent-cap">CRM segmentation</span>
        <span class="agent-cap">Loyalty analytics</span>
        <span class="agent-cap">Lifecycle automation</span>
        <span class="agent-cap">Member scoring</span>
        <span class="agent-cap">Preference targeting</span>
        <span class="agent-cap">Data quality flagging</span>
      </div>
      <div class="agent-tools"><strong>Integrations:</strong> Salesforce CRM, Skywards API, CDP Profiles, Customer 360 Dashboard</div>
    </div>

    <div class="agent-card">
      <div class="agent-card-header">
        <h4>03 &mdash; MarTech Architecture Agent</h4>
      </div>
      <div class="desc">Marketing Cloud infrastructure ownership. Validates technical feasibility, designs data extension models, manages API integrations, and ensures platform scalability and performance under high campaign volume.</div>
      <div class="agent-caps">
        <span class="agent-cap">Architecture validation</span>
        <span class="agent-cap">Data model design</span>
        <span class="agent-cap">API integration patterns</span>
        <span class="agent-cap">Performance optimization</span>
        <span class="agent-cap">Risk identification</span>
        <span class="agent-cap">Feasibility assessment</span>
      </div>
      <div class="agent-tools"><strong>Integrations:</strong> SFMC Architecture, Data Model Standards, Integration Blueprints, Security Guidelines</div>
    </div>

    <div class="agent-card">
      <div class="agent-card-header">
        <h4>04 &mdash; Competitive Intelligence Agent</h4>
      </div>
      <div class="desc">Monitors competitor communications across email, social media, and web channels. Identifies strategic opportunities, performs SWOT analysis, and detects emerging market trends to inform campaign strategy.</div>
      <div class="agent-caps">
        <span class="agent-cap">Competitor monitoring</span>
        <span class="agent-cap">Multi-channel analysis</span>
        <span class="agent-cap">SWOT analysis</span>
        <span class="agent-cap">Opportunity detection</span>
        <span class="agent-cap">Sentiment analysis</span>
        <span class="agent-cap">Trend identification</span>
      </div>
      <div class="agent-tools"><strong>Integrations:</strong> Email Scanner, Social Monitor, Sentiment Analyzer, Claude AI, News Aggregator</div>
    </div>
  </div>

  <div class="page-footer">
    <span>Merkle, a dentsu company</span>
    <span>Page 4</span>
  </div>
</div>

<!-- ==================== PAGE 5: AGENTS — EXECUTION ==================== -->
<div class="page inner">
  <div class="page-header">
    <div class="page-header-left">
      <img src="${merkleIcon}" alt="Merkle">
      <span class="page-header-title">AgentOS — Emirates Project Overview</span>
    </div>
  </div>

  <div class="section-title" style="margin-bottom: 20px;">AI Agent Directory <span style="font-size: 14px; font-weight: 400; color: var(--gray-500);">(continued)</span></div>

  <div class="layer-section">
    <div class="layer-label execution">Execution Layer</div>

    <div class="agent-card">
      <div class="agent-card-header">
        <h4>05 &mdash; Content & Copywriting Agent</h4>
      </div>
      <div class="desc">Creates premium, brand-compliant marketing copy in English and Arabic. Generates subject line variants, personalized email content, and A/B testing copy. Ensures Emirates' luxury tone across all communications.</div>
      <div class="agent-caps">
        <span class="agent-cap">Subject line generation</span>
        <span class="agent-cap">Email copy drafting</span>
        <span class="agent-cap">Multilingual (EN/AR)</span>
        <span class="agent-cap">Personalization logic</span>
        <span class="agent-cap">A/B variant ideation</span>
        <span class="agent-cap">Copy optimization</span>
      </div>
      <div class="agent-tools"><strong>Integrations:</strong> Claude AI, Emirates Prompt Library, Brand Phrases DB, Translation Engine</div>
    </div>

    <div class="agent-card">
      <div class="agent-card-header">
        <h4>06 &mdash; Audience Segmentation Agent</h4>
      </div>
      <div class="desc">Builds audience clusters with targeting logic and suppression rules. Handles tier-market combinations, audience sizing, overlap detection (&gt;30% flagged), and reusable segment templates for recurring campaigns.</div>
      <div class="agent-caps">
        <span class="agent-cap">Segment definition</span>
        <span class="agent-cap">Suppression logic</span>
        <span class="agent-cap">Audience sizing</span>
        <span class="agent-cap">Tier-market targeting</span>
        <span class="agent-cap">Overlap detection</span>
        <span class="agent-cap">Reusable templates</span>
      </div>
      <div class="agent-tools"><strong>Integrations:</strong> SFMC Data Extensions, Audience Rules Library, Consent Lists, SQL Query Builder</div>
    </div>

    <div class="agent-card">
      <div class="agent-card-header">
        <h4>07 &mdash; Automation Architect Agent</h4>
      </div>
      <div class="desc">Designs and deploys Journey Builder flows and automation sequences. Configures triggers, scheduling, dependency mapping, and failure handling with retry logic — reducing failed sends by 34%.</div>
      <div class="agent-caps">
        <span class="agent-cap">Workflow design</span>
        <span class="agent-cap">Journey scaffolding</span>
        <span class="agent-cap">Trigger scheduling</span>
        <span class="agent-cap">Dependency mapping</span>
        <span class="agent-cap">Failure handling</span>
        <span class="agent-cap">Deployment runbooks</span>
      </div>
      <div class="agent-tools"><strong>Integrations:</strong> Journey Builder, Automation Studio, SFMC REST/SOAP APIs, Monitoring & Retry</div>
    </div>

    <div class="agent-card">
      <div class="agent-card-header">
        <h4>08 &mdash; Calendar & Send-Time Agent</h4>
      </div>
      <div class="desc">Optimizes send times per market and detects scheduling conflicts across campaigns. Enforces holiday awareness, cadence rules, and priority balancing to maximize engagement and avoid audience fatigue.</div>
      <div class="agent-caps">
        <span class="agent-cap">Send-time optimization</span>
        <span class="agent-cap">Conflict detection</span>
        <span class="agent-cap">Cadence optimization</span>
        <span class="agent-cap">Holiday awareness</span>
        <span class="agent-cap">Priority balancing</span>
        <span class="agent-cap">Timeline planning</span>
      </div>
      <div class="agent-tools"><strong>Integrations:</strong> Campaign Calendar, Send Time Signals, Market Holiday Calendar, Peak Traffic Curves</div>
    </div>

    <div class="agent-card">
      <div class="agent-card-header">
        <h4>09 &mdash; Email Developer Agent</h4>
      </div>
      <div class="desc">Builds responsive HTML email templates, creates reusable content blocks, and validates cross-client rendering. Maintains a modular template library for rapid campaign deployment.</div>
      <div class="agent-caps">
        <span class="agent-cap">Template design</span>
        <span class="agent-cap">Responsive HTML</span>
        <span class="agent-cap">Content blocks</span>
        <span class="agent-cap">HTML optimization</span>
        <span class="agent-cap">Cross-client rendering</span>
        <span class="agent-cap">Template deployment</span>
      </div>
      <div class="agent-tools"><strong>Integrations:</strong> SFMC Content Builder, HTML/CSS Validator, Litmus Preview, Block Library</div>
    </div>
  </div>

  <div class="page-footer">
    <span>Merkle, a dentsu company</span>
    <span>Page 5</span>
  </div>
</div>

<!-- ==================== PAGE 6: AGENTS — CONTROL ==================== -->
<div class="page inner">
  <div class="page-header">
    <div class="page-header-left">
      <img src="${merkleIcon}" alt="Merkle">
      <span class="page-header-title">AgentOS — Emirates Project Overview</span>
    </div>
  </div>

  <div class="section-title" style="margin-bottom: 20px;">AI Agent Directory <span style="font-size: 14px; font-weight: 400; color: var(--gray-500);">(continued)</span></div>

  <div class="layer-section">
    <div class="layer-label control">Control & Validation Layer</div>

    <div class="agent-card">
      <div class="agent-card-header">
        <h4>10 &mdash; Brand Guardian Agent</h4>
      </div>
      <div class="desc">Validates premium airline tone and brand compliance across all communications. Enforces Emirates terminology glossary, flags casual or risky language, and scores brand adherence — maintaining a 98.5% compliance rate.</div>
      <div class="agent-caps">
        <span class="agent-cap">Tone consistency</span>
        <span class="agent-cap">Compliance scoring</span>
        <span class="agent-cap">Terminology enforcement</span>
        <span class="agent-cap">Content risk flagging</span>
        <span class="agent-cap">Rewrite suggestions</span>
        <span class="agent-cap">Visual-copy alignment</span>
      </div>
      <div class="agent-tools"><strong>Integrations:</strong> Emirates Brand Guidelines, Tone Analyzer, Terminology Glossary, Approved Copy Library</div>
    </div>

    <div class="agent-card">
      <div class="agent-card-header">
        <h4>11 &mdash; Legal & Compliance Agent</h4>
      </div>
      <div class="desc">Ensures regulatory compliance across GDPR, UAE data protection, and CAN-SPAM regulations. Generates market-specific disclaimers, audits consent status, and flags regulatory risks before campaign deployment.</div>
      <div class="agent-caps">
        <span class="agent-cap">Compliance validation</span>
        <span class="agent-cap">Disclaimer generation</span>
        <span class="agent-cap">Claims scrutiny</span>
        <span class="agent-cap">Data privacy checks</span>
        <span class="agent-cap">Escalation handling</span>
        <span class="agent-cap">Audit-ready notes</span>
      </div>
      <div class="agent-tools"><strong>Integrations:</strong> Regulatory Requirements KB, Market Disclaimer Library, Consent & Privacy Rules</div>
    </div>

    <div class="agent-card">
      <div class="agent-card-header">
        <h4>12 &mdash; QA & Deliverability Agent</h4>
      </div>
      <div class="desc">Performs comprehensive pre-send validation: link checking, cross-client render testing, spam scoring, tracking validation, and content completeness checks. Acts as the final gate before any campaign goes live.</div>
      <div class="agent-caps">
        <span class="agent-cap">Link validation</span>
        <span class="agent-cap">Render testing</span>
        <span class="agent-cap">Content completeness</span>
        <span class="agent-cap">Subject length check</span>
        <span class="agent-cap">Spam risk scoring</span>
        <span class="agent-cap">QA checklist output</span>
      </div>
      <div class="agent-tools"><strong>Integrations:</strong> Link Checker, Litmus/Email on Acid, HTML Validator, Tracking Validator</div>
    </div>

    <div class="agent-card">
      <div class="agent-card-header">
        <h4>13 &mdash; Analytics & Attribution Agent</h4>
      </div>
      <div class="desc">Generates post-campaign performance reports with ROI attribution. Detects KPI anomalies, synthesizes audience insights, estimates incrementality, and produces executive summaries with next-best-action recommendations.</div>
      <div class="agent-caps">
        <span class="agent-cap">Post-campaign analysis</span>
        <span class="agent-cap">Audience insights</span>
        <span class="agent-cap">Incrementality estimation</span>
        <span class="agent-cap">Anomaly detection</span>
        <span class="agent-cap">Executive summaries</span>
        <span class="agent-cap">Next-best-action</span>
      </div>
      <div class="agent-tools"><strong>Integrations:</strong> GA4/Looker Studio, SFMC Engagement Logs, CRM/Loyalty DB, Tableau/PowerBI</div>
    </div>

    <div class="agent-card">
      <div class="agent-card-header">
        <h4>14 &mdash; Documentation Auditor Agent</h4>
      </div>
      <div class="desc">Audits campaign documentation for completeness, detects gaps, flags outdated documents, and scores coverage across compliance and operational documentation. Maintains audit history for governance.</div>
      <div class="agent-caps">
        <span class="agent-cap">Documentation auditing</span>
        <span class="agent-cap">Coverage scoring</span>
        <span class="agent-cap">Gap detection</span>
        <span class="agent-cap">Outdated doc flagging</span>
        <span class="agent-cap">Audit history</span>
        <span class="agent-cap">Compliance docs</span>
      </div>
      <div class="agent-tools"><strong>Integrations:</strong> Claude AI, Confluence, Document Management Systems</div>
    </div>
  </div>

  <div class="page-footer">
    <span>Merkle, a dentsu company</span>
    <span>Page 6</span>
  </div>
</div>

<!-- ==================== PAGE 7: ORCHESTRATION + WORKFLOW ==================== -->
<div class="page inner">
  <div class="page-header">
    <div class="page-header-left">
      <img src="${merkleIcon}" alt="Merkle">
      <span class="page-header-title">AgentOS — Emirates Project Overview</span>
    </div>
  </div>

  <div class="layer-section" style="margin-bottom: 25px;">
    <div class="layer-label orchestration">Orchestration Layer</div>

    <div class="agent-card" style="border-left: 3px solid var(--red);">
      <div class="agent-card-header">
        <h4>15 &mdash; Campaign Intelligence Coordinator</h4>
      </div>
      <div class="desc">The strategic brain of AgentOS. This meta-agent orchestrates all 14 operational agents, maintains context across the entire campaign portfolio, and acts as the primary interface for human operators. It refines campaign ideas through natural language conversation, recommends optimal agent pipelines, classifies campaigns into 29 BAU types, and generates detailed project specifications — enabling teams to go from idea to execution plan in minutes.</div>
      <div class="agent-caps">
        <span class="agent-cap">Agent orchestration</span>
        <span class="agent-cap">Pipeline recommendation</span>
        <span class="agent-cap">Brief generation</span>
        <span class="agent-cap">BAU classification</span>
        <span class="agent-cap">Strategic context</span>
        <span class="agent-cap">Natural language interface</span>
      </div>
      <div class="agent-tools"><strong>Integrations:</strong> Claude AI (Sonnet 4.6), All 14 agents, Campaign Portfolio Database, Workspace Context</div>
    </div>
  </div>

  <div class="section-title">How Agents Collaborate</div>
  <div class="section-subtitle">Example: Campaign Creation Workflow — from brief to launch</div>

  <div style="margin-top: 15px;">
    <div class="workflow-step">
      <div class="workflow-num">1</div>
      <div class="workflow-content">
        <h4>Campaign Brief</h4>
        <p>Campaign Manager Agent defines objectives, KPIs, target markets, and budget allocation</p>
      </div>
    </div>
    <div class="workflow-step">
      <div class="workflow-num">2</div>
      <div class="workflow-content">
        <h4>Audience Building</h4>
        <p>Segmentation Agent creates audience clusters with Skywards tier targeting and suppression rules</p>
      </div>
    </div>
    <div class="workflow-step">
      <div class="workflow-num">3</div>
      <div class="workflow-content">
        <h4>Content Creation</h4>
        <p>Content Agent generates multilingual copy (EN/AR) with personalization and A/B variants</p>
      </div>
    </div>
    <div class="workflow-step">
      <div class="workflow-num">4</div>
      <div class="workflow-content">
        <h4>Template Development</h4>
        <p>Email Developer Agent builds responsive templates and reusable content blocks</p>
      </div>
    </div>
    <div class="workflow-step">
      <div class="workflow-num">5</div>
      <div class="workflow-content">
        <h4>Brand & Legal Review</h4>
        <p>Brand Guardian + Legal Agent validate tone, compliance, disclaimers, and regulatory requirements</p>
      </div>
    </div>
    <div class="workflow-step">
      <div class="workflow-num">6</div>
      <div class="workflow-content">
        <h4>Schedule & Deploy</h4>
        <p>Calendar Agent optimizes send time; Automation Agent configures Journey Builder and triggers</p>
      </div>
    </div>
    <div class="workflow-step">
      <div class="workflow-num">7</div>
      <div class="workflow-content">
        <h4>QA & Launch</h4>
        <p>QA Agent validates links, renders, spam score — campaign goes live with zero compliance gaps</p>
      </div>
    </div>
    <div class="workflow-step">
      <div class="workflow-num">8</div>
      <div class="workflow-content">
        <h4>Post-Launch Analytics</h4>
        <p>Analytics Agent generates performance reports, ROI attribution, and next-best-action recommendations</p>
      </div>
    </div>
  </div>

  <div class="workflow-highlight">
    <h4>From Brief to Launch — With Built-in Compliance at Every Step</h4>
    <p>Each agent operates autonomously within its domain while the Coordinator ensures seamless handoffs and quality gates.</p>
  </div>

  <div class="page-footer">
    <span>Merkle, a dentsu company</span>
    <span>Page 7</span>
  </div>
</div>

<!-- ==================== PAGE 8: PLATFORM CAPABILITIES ==================== -->
<div class="page inner">
  <div class="page-header">
    <div class="page-header-left">
      <img src="${merkleIcon}" alt="Merkle">
      <span class="page-header-title">AgentOS — Emirates Project Overview</span>
    </div>
  </div>

  <div class="section-title">Platform Capabilities</div>
  <div class="section-subtitle">Built-in features that power the agent ecosystem</div>

  <div class="feature-grid">
    <div class="feature-card">
      <div class="feature-icon">&#x1f4ca;</div>
      <h4>Centralized Dashboard</h4>
      <p>Real-time visibility into all agents, campaigns, and departments. Workspace overview with KPI cards, status badges, and activity feeds — a single source of truth for the entire operation.</p>
    </div>
    <div class="feature-card">
      <div class="feature-icon">&#x2600;</div>
      <h4>Daily Operations</h4>
      <p>Automated daily standups by department, AI-generated summaries, and end-of-day reports with completed tasks, blockers, and next-day planning. Never miss what happened while you were away.</p>
    </div>
    <div class="feature-card">
      <div class="feature-icon">&#x1f4c5;</div>
      <h4>Weekly Planning Board</h4>
      <p>5-tab planning system: brainstorming, prioritization, capacity planning, resource allocation, and weekly reports with KPI tracking across all departments.</p>
    </div>
    <div class="feature-card">
      <div class="feature-icon">&#x1f680;</div>
      <h4>Campaign Management Hub</h4>
      <p>45+ campaign templates across lifecycle stages — acquisition, loyalty, recovery, onboarding, and communications. Full pipeline board with status tracking and performance metrics.</p>
    </div>
    <div class="feature-card">
      <div class="feature-icon">&#x1f4ac;</div>
      <h4>AI Chat Interface</h4>
      <p>Natural language conversation with the Campaign Intelligence Coordinator via streaming chat. Includes voice controls (speech-to-text and text-to-speech) for hands-free operation.</p>
    </div>
    <div class="feature-card">
      <div class="feature-icon">&#x1f6e1;</div>
      <h4>Audit & Compliance</h4>
      <p>Complete audit trail for every action: campaign launches, compliance reviews, segment creation, report generation, and legal reviews. Filterable by category and timestamp.</p>
    </div>
    <div class="feature-card">
      <div class="feature-icon">&#x1f4e5;</div>
      <h4>Unified Inbox</h4>
      <p>Centralized message inbox from all agents with filtering, task creation, and direct PM Agent communication. Stay on top of agent outputs and escalations.</p>
    </div>
    <div class="feature-card">
      <div class="feature-icon">&#x1f50d;</div>
      <h4>Intelligence Hub</h4>
      <p>AI-generated insights, trend analysis, coverage alerts, and PM performance reports with severity levels. Proactive anomaly detection on key metrics.</p>
    </div>
  </div>

  <div class="page-footer">
    <span>Merkle, a dentsu company</span>
    <span>Page 8</span>
  </div>
</div>

<!-- ==================== PAGE 9: BACK COVER ==================== -->
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

  const outputPath = path.resolve(__dirname, 'AgentOS-Emirates-Overview.pdf');

  await page.pdf({
    path: outputPath,
    format: 'A4',
    printBackground: true,
    preferCSSPageSize: false,
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
  });

  await browser.close();
  console.log(`PDF generated successfully: ${outputPath}`);
})();
