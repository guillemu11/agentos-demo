// ─── Workspace Data ─────────────────────────────────────────────────────────

export const departments = [
    {
        id: 'strategic',
        name: 'Strategic Layer',
        emoji: '🎯',
        color: '#D4AF37',
        theme: 'theme-gold',
        description: 'Campaign strategy, CRM intelligence & marketing architecture',
        health: 'good',
    },
    {
        id: 'execution',
        name: 'Execution Layer',
        emoji: '🚀',
        color: '#D71920',
        theme: 'theme-red',
        description: 'Content creation, segmentation, automation & calendar orchestration',
        health: 'good',
    },
    {
        id: 'control',
        name: 'Control & Validation',
        emoji: '🛡️',
        color: '#2d2d2d',
        theme: 'theme-navy',
        description: 'Brand compliance, legal review, QA testing & performance analytics',
        health: 'good',
    },
];

export const skills = [
    { id: 'campaign-orchestration', name: 'Campaign Orchestration', description: 'End-to-end campaign lifecycle management', icon: '🎖️' },
    { id: 'segment-definition', name: 'Segment Definition', description: 'Audience clustering and targeting logic', icon: '🎯' },
    { id: 'copy-generation', name: 'Copy Generation', description: 'Multilingual premium marketing copy', icon: '✍️' },
    { id: 'brand-compliance', name: 'Brand Compliance', description: 'Emirates premium tone and visual validation', icon: '🛡️' },
    { id: 'compliance-validation', name: 'Compliance Validation', description: 'GDPR, UWG and UAE regulatory checks', icon: '⚖️' },
    { id: 'journey-automation', name: 'Journey Automation', description: 'SFMC Journey Builder flow design', icon: '⚙️' },
    { id: 'qa-testing', name: 'QA Testing', description: 'Link, render and deliverability validation', icon: '🔍' },
    { id: 'attribution-modeling', name: 'Attribution Modeling', description: 'Multi-touch attribution and ROI analysis', icon: '📊' },
    { id: 'doc-auditing', name: 'Documentation Auditing', description: 'Campaign doc coverage analysis and gap detection', icon: '📋' },
];

export const tools = [
    {
        id: 'salesforce-mc',
        name: 'Salesforce Marketing Cloud',
        description: 'Marketing Automation',
        icon: '☁️',
        status: 'connected',
        credits: null,
        category: 'marketing-automation',
        version: 'Enterprise',
        capabilities: [
            { id: 'email-studio', name: 'Email Studio', description: 'Create, send and track email campaigns', icon: '📧' },
            { id: 'journey-builder', name: 'Journey Builder', description: 'Design automated customer journeys', icon: '🗺️' },
            { id: 'audience-builder', name: 'Audience Builder', description: 'Segment and target audiences', icon: '👥' },
            { id: 'automation-studio', name: 'Automation Studio', description: 'Schedule and automate marketing activities', icon: '⚙️' },
            { id: 'content-builder', name: 'Content Builder', description: 'Manage and create marketing content', icon: '📝' },
            { id: 'data-extensions', name: 'Data Extensions', description: 'Store and manage subscriber data', icon: '🗄️' },
        ],
    },
    {
        id: 'looker-studio',
        name: 'Looker Studio',
        description: 'Analytics & Attribution',
        icon: '📊',
        status: 'connected',
        credits: null,
        category: 'analytics',
        version: 'Pro',
        capabilities: [
            { id: 'dashboards', name: 'Custom Dashboards', description: 'Build interactive data dashboards', icon: '📈' },
            { id: 'data-blending', name: 'Data Blending', description: 'Combine multiple data sources', icon: '🔗' },
            { id: 'calculated-fields', name: 'Calculated Fields', description: 'Create custom metrics and dimensions', icon: '🧮' },
            { id: 'sharing', name: 'Report Sharing', description: 'Share and schedule report delivery', icon: '📤' },
            { id: 'attribution', name: 'Attribution Modeling', description: 'Multi-touch attribution and conversion analysis', icon: '🎯' },
            { id: 'explorer', name: 'Data Explorer', description: 'Ad-hoc data exploration and discovery', icon: '🔍' },
        ],
    },
    {
        id: 'anthropic',
        name: 'Claude AI',
        description: 'AI / LLM Engine',
        icon: '🤖',
        status: 'connected',
        credits: null,
        category: 'ai-llm',
        version: 'Claude Sonnet 4.6',
        capabilities: [
            { id: 'text-generation', name: 'Text Generation', description: 'Generate high-quality multilingual content', icon: '✍️' },
            { id: 'analysis', name: 'Data Analysis', description: 'Analyze complex datasets and extract insights', icon: '🔍' },
            { id: 'code-generation', name: 'Code Generation', description: 'Write and review code across languages', icon: '💻' },
            { id: 'summarization', name: 'Summarization', description: 'Condense long documents into key points', icon: '📋' },
            { id: 'reasoning', name: 'Advanced Reasoning', description: 'Multi-step logical reasoning and planning', icon: '🧠' },
            { id: 'streaming', name: 'SSE Streaming', description: 'Real-time streamed responses via SSE', icon: '⚡' },
        ],
    },
    {
        id: 'skywards-api',
        name: 'Skywards API',
        description: 'Loyalty Program',
        icon: '✈️',
        status: 'connected',
        credits: null,
        category: 'loyalty',
        version: 'v2.1',
        capabilities: [
            { id: 'member-lookup', name: 'Member Lookup', description: 'Query member profiles and tier status', icon: '👤' },
            { id: 'points-balance', name: 'Points & Balance', description: 'Check miles balance and transaction history', icon: '💰' },
            { id: 'tier-calculation', name: 'Tier Calculation', description: 'Calculate upgrade eligibility and projections', icon: '📊' },
            { id: 'offer-targeting', name: 'Offer Targeting', description: 'Retrieve personalized offers by segment', icon: '🎯' },
        ],
    },
    {
        id: 'confluence',
        name: 'Confluence',
        description: 'Documentation Hub',
        icon: '📚',
        status: 'connected',
        credits: null,
        category: 'documentation',
        version: 'Cloud',
        capabilities: [
            { id: 'page-search', name: 'Page Search', description: 'Search and retrieve documentation pages', icon: '🔍' },
            { id: 'page-audit', name: 'Doc Audit', description: 'Audit documentation coverage and staleness', icon: '📋' },
            { id: 'page-read', name: 'Read Pages', description: 'Fetch page content and metadata', icon: '📖' },
            { id: 'space-browse', name: 'Space Browser', description: 'Navigate Confluence spaces and hierarchies', icon: '🗂️' },
        ],
    },
    {
        id: 'jira',
        name: 'Jira',
        description: 'Project Management',
        icon: '📋',
        status: 'connected',
        credits: null,
        category: 'project-management',
        version: 'Cloud',
        capabilities: [
            { id: 'create-issue', name: 'Create Issue', description: 'Create Jira tickets from AgentOS projects', icon: '➕' },
            { id: 'status-sync', name: 'Status Sync', description: 'Sync project status changes to Jira', icon: '🔄' },
            { id: 'issue-link', name: 'Issue Linking', description: 'Link AgentOS projects to Jira issues', icon: '🔗' },
            { id: 'browse-issues', name: 'Browse Issues', description: 'View linked Jira issues from the dashboard', icon: '📄' },
        ],
    },
];

export const workflows = [
    {
        id: 'campaign-creation',
        name: 'Campaign Creation Engine',
        description: 'End-to-end campaign production — 60% faster creation',
        status: 'active',
        steps: [
            { agent: 'campaign-manager', action: 'Create campaign brief, define objectives & coordinate pipeline' },
            { agent: 'segmentation-agent', action: 'Build audience segments & suppression logic' },
            { agent: 'content-agent', action: 'Generate multilingual copy variants (EN/ES/AR)' },
            { agent: 'html-developer', action: 'Build email templates & HTML blocks' },
            { agent: 'brand-guardian', action: 'Brand compliance review & tone validation' },
            { agent: 'legal-agent', action: 'Legal & regulatory compliance check (GDPR, CAN-SPAM, UAE)' },
            { agent: 'calendar-agent', action: 'Schedule send date & detect conflicts' },
            { agent: 'automation-architect', action: 'Configure Journey Builder automation & triggers' },
            { agent: 'cloud-architect', action: 'Validate infrastructure & capacity' },
            { agent: 'qa-agent', action: 'QA testing: links, renders, spam score & deliverability' },
        ],
    },
    {
        id: 're-engagement-campaign',
        name: 'Re-engagement Campaign',
        description: 'Win back inactive contacts (90+ days) with targeted drip sequences',
        status: 'active',
        steps: [
            { agent: 'analytics-agent', action: 'Detect inactive contacts (90+ days) & analyze patterns' },
            { agent: 'segmentation-agent', action: 'Build re-engagement cohort with suppression rules' },
            { agent: 'content-agent', action: 'Generate "we miss you" copy & personalized offers' },
            { agent: 'qa-agent', action: 'Validate renders & deliverability' },
            { agent: 'automation-architect', action: 'Deploy drip sequence journey' },
        ],
    },
    {
        id: 'flash-sale-rapid-deploy',
        name: 'Flash Sale Rapid Deploy',
        description: 'Urgent campaign deployment using pre-approved templates — launch in <4h',
        status: 'active',
        steps: [
            { agent: 'campaign-manager', action: 'Create urgent brief with product, discount & markets' },
            { agent: 'content-agent', action: 'Generate multilingual copy (EN/ES/AR) — fast track' },
            { agent: 'html-developer', action: 'Assemble email from pre-approved template blocks' },
            { agent: 'brand-guardian', action: 'Fast-track brand review' },
            { agent: 'legal-agent', action: 'Expedited compliance check' },
            { agent: 'qa-agent', action: 'Rapid QA: links, renders & spam score' },
        ],
    },
    {
        id: 'seasonal-campaign-planning',
        name: 'Seasonal Campaign Planning',
        description: 'Quarterly planning cycle: calendar, audiences & capacity reservation',
        status: 'active',
        steps: [
            { agent: 'campaign-manager', action: 'Define quarterly campaign calendar & objectives' },
            { agent: 'calendar-agent', action: 'Validate dates, detect conflicts & blackout periods' },
            { agent: 'segmentation-agent', action: 'Pre-build target audiences for upcoming campaigns' },
            { agent: 'content-agent', action: 'Start creative briefs for planned campaigns' },
            { agent: 'cloud-architect', action: 'Reserve infrastructure capacity for peak periods' },
        ],
    },
    {
        id: 'brand-audit-cycle',
        name: 'Brand Audit Cycle',
        description: 'Monthly audit of all active pieces for brand compliance',
        status: 'active',
        steps: [
            { agent: 'brand-guardian', action: 'Audit all active pieces — tone, colors, fonts, imagery' },
            { agent: 'brand-guardian', action: 'Generate compliance report with % score per campaign' },
            { agent: 'campaign-manager', action: 'Review violations & decide escalation' },
            { agent: 'content-agent', action: 'Correct flagged pieces & resubmit' },
            { agent: 'brand-guardian', action: 'Re-review corrected pieces & close audit' },
        ],
    },
    {
        id: 'gdpr-consent-refresh',
        name: 'GDPR Consent Refresh',
        description: 'Proactive re-consent collection before expiration windows',
        status: 'active',
        steps: [
            { agent: 'legal-agent', action: 'Detect consents approaching expiration by regulation' },
            { agent: 'segmentation-agent', action: 'Build affected contacts segment' },
            { agent: 'content-agent', action: 'Generate re-consent request messaging' },
            { agent: 'automation-architect', action: 'Deploy re-consent journey with reminders' },
            { agent: 'analytics-agent', action: 'Measure opt-in rate & report compliance status' },
        ],
    },
    {
        id: 'email-deliverability-check',
        name: 'Email Deliverability Health Check',
        description: 'Infrastructure & deliverability audit — spam score, DKIM, SPF, bounce trends',
        status: 'active',
        steps: [
            { agent: 'qa-agent', action: 'Run spam score, DKIM & SPF checks across active sends' },
            { agent: 'cloud-architect', action: 'Validate infrastructure health & API limits' },
            { agent: 'analytics-agent', action: 'Report bounce/complaint rate trends' },
            { agent: 'campaign-manager', action: 'Review findings & decide corrective actions' },
        ],
    },
    {
        id: 'ab-test-pipeline',
        name: 'A/B Test Pipeline',
        description: 'End-to-end A/B testing: variants, split, measure & decide winner',
        status: 'active',
        steps: [
            { agent: 'content-agent', action: 'Generate copy variants based on hypothesis' },
            { agent: 'html-developer', action: 'Build both template versions' },
            { agent: 'qa-agent', action: 'Validate renders for all variants' },
            { agent: 'automation-architect', action: 'Configure split test in Journey Builder' },
            { agent: 'analytics-agent', action: 'Measure results & statistical significance' },
            { agent: 'campaign-manager', action: 'Decide winner & roll out' },
        ],
    },
    {
        id: 'weekly-performance-digest',
        name: 'Weekly Performance Digest',
        description: 'Automated weekly KPI report for stakeholders',
        status: 'active',
        steps: [
            { agent: 'analytics-agent', action: 'Compile weekly KPIs across all channels & campaigns' },
            { agent: 'campaign-manager', action: 'Add strategic commentary & recommendations' },
        ],
    },
    {
        id: 'template-library-refresh',
        name: 'Template Library Refresh',
        description: 'Audit, re-test & deprecate outdated email templates',
        status: 'active',
        steps: [
            { agent: 'html-developer', action: 'Audit existing templates against current standards' },
            { agent: 'brand-guardian', action: 'Validate templates against updated brand guidelines' },
            { agent: 'qa-agent', action: 'Re-test renders across email clients & deprecate broken ones' },
        ],
    },
    {
        id: 'audience-hygiene-cleanup',
        name: 'Audience Hygiene Cleanup',
        description: 'Segment overlap audit, data validation & consent cleanup',
        status: 'active',
        steps: [
            { agent: 'segmentation-agent', action: 'Audit segment overlaps & flag >30% duplicates' },
            { agent: 'crm-agent', action: 'Validate contact data quality & enrich records' },
            { agent: 'legal-agent', action: 'Verify consent status for all active segments' },
            { agent: 'cloud-architect', action: 'Clean data extensions & remove stale records' },
            { agent: 'analytics-agent', action: 'Report impact on deliverability & audience metrics' },
        ],
    },
];

export const agents = [
    // Strategic Layer
    { id: 'campaign-manager', name: 'Campaign Manager Agent', role: 'End-to-end campaign lifecycle management', department: 'strategic', avatar: '🎖️', status: 'active', skills: ['campaign-orchestration'], tools: ['salesforce-mc', 'looker-studio'], workflows: ['campaign-creation', 'flash-sale-rapid-deploy', 'seasonal-campaign-planning', 'brand-audit-cycle', 'email-deliverability-check', 'ab-test-pipeline', 'weekly-performance-digest'], lastRun: null, lastRunStatus: null, totalRuns: 0, successRate: 0 },
    { id: 'crm-agent', name: 'CRM Agent', role: 'Loyalty & retention intelligence', department: 'strategic', avatar: '💎', status: 'active', skills: ['segment-definition'], tools: ['salesforce-mc', 'skywards-api'], workflows: ['audience-hygiene-cleanup'], lastRun: null, lastRunStatus: null, totalRuns: 0, successRate: 0 },
    { id: 'cloud-architect', name: 'Cloud Architect Agent', role: 'Marketing Cloud infrastructure & journeys', department: 'strategic', avatar: '🏗️', status: 'active', skills: ['journey-automation'], tools: ['salesforce-mc'], workflows: ['campaign-creation', 'seasonal-campaign-planning', 'email-deliverability-check', 'audience-hygiene-cleanup'], lastRun: null, lastRunStatus: null, totalRuns: 0, successRate: 0 },
    // Execution Layer
    { id: 'content-agent', name: 'Content Agent', role: 'Multilingual premium copy creation', department: 'execution', avatar: '✍️', status: 'active', skills: ['copy-generation'], tools: ['anthropic'], workflows: ['campaign-creation', 're-engagement-campaign', 'flash-sale-rapid-deploy', 'seasonal-campaign-planning', 'brand-audit-cycle', 'gdpr-consent-refresh', 'ab-test-pipeline'], lastRun: null, lastRunStatus: null, totalRuns: 0, successRate: 0 },
    { id: 'segmentation-agent', name: 'Segmentation Agent', role: 'Audience clusters & targeting logic', department: 'execution', avatar: '🎯', status: 'active', skills: ['segment-definition'], tools: ['salesforce-mc'], workflows: ['campaign-creation', 're-engagement-campaign', 'seasonal-campaign-planning', 'gdpr-consent-refresh', 'audience-hygiene-cleanup'], lastRun: null, lastRunStatus: null, totalRuns: 0, successRate: 0 },
    { id: 'automation-architect', name: 'Automation Architect Agent', role: 'Journey Builder flow design', department: 'execution', avatar: '⚙️', status: 'active', skills: ['journey-automation'], tools: ['salesforce-mc'], workflows: ['campaign-creation', 're-engagement-campaign', 'gdpr-consent-refresh', 'ab-test-pipeline'], lastRun: null, lastRunStatus: null, totalRuns: 0, successRate: 0 },
    { id: 'calendar-agent', name: 'Calendar Agent', role: 'Scheduling & conflict detection', department: 'execution', avatar: '📅', status: 'active', skills: ['campaign-orchestration'], tools: ['salesforce-mc'], workflows: ['campaign-creation', 'seasonal-campaign-planning'], lastRun: null, lastRunStatus: null, totalRuns: 0, successRate: 0 },
    { id: 'html-developer', name: 'HTML Developer Agent', role: 'Email templates & HTML blocks design', department: 'execution', avatar: '🧑‍💻', status: 'active', skills: ['copy-generation'], tools: ['salesforce-mc'], workflows: ['campaign-creation', 'flash-sale-rapid-deploy', 'ab-test-pipeline', 'template-library-refresh'], lastRun: null, lastRunStatus: null, totalRuns: 0, successRate: 0 },
    // Control & Validation Layer
    { id: 'brand-guardian', name: 'Brand Guardian Agent', role: 'Premium tone & brand validation', department: 'control', avatar: '🛡️', status: 'active', skills: ['brand-compliance'], tools: ['salesforce-mc'], workflows: ['campaign-creation', 'flash-sale-rapid-deploy', 'brand-audit-cycle', 'template-library-refresh'], lastRun: null, lastRunStatus: null, totalRuns: 0, successRate: 0 },
    { id: 'legal-agent', name: 'Legal Agent', role: 'GDPR & regulatory compliance', department: 'control', avatar: '⚖️', status: 'active', skills: ['compliance-validation'], tools: ['salesforce-mc'], workflows: ['campaign-creation', 'flash-sale-rapid-deploy', 'gdpr-consent-refresh', 'audience-hygiene-cleanup'], lastRun: null, lastRunStatus: null, totalRuns: 0, successRate: 0 },
    { id: 'qa-agent', name: 'QA Agent', role: 'Link, render & deliverability checks', department: 'control', avatar: '🔍', status: 'active', skills: ['qa-testing'], tools: ['salesforce-mc'], workflows: ['campaign-creation', 're-engagement-campaign', 'flash-sale-rapid-deploy', 'email-deliverability-check', 'ab-test-pipeline', 'template-library-refresh'], lastRun: null, lastRunStatus: null, totalRuns: 0, successRate: 0 },
    { id: 'analytics-agent', name: 'Analytics Agent', role: 'Attribution & ROI reporting', department: 'control', avatar: '📊', status: 'active', skills: ['attribution-modeling'], tools: ['looker-studio'], workflows: ['re-engagement-campaign', 'gdpr-consent-refresh', 'email-deliverability-check', 'ab-test-pipeline', 'weekly-performance-digest', 'audience-hygiene-cleanup'], lastRun: null, lastRunStatus: null, totalRuns: 0, successRate: 0 },
    { id: 'doc-agent', name: 'Marina', role: 'Campaign documentation audit & gap detection', department: 'control', avatar: '📋', status: 'active', skills: ['doc-auditing'], tools: ['anthropic', 'confluence'], workflows: ['doc-audit'], lastRun: null, lastRunStatus: null, totalRuns: 0, successRate: 0 },
    // Competitive Intelligence
    { id: 'competitive-intel', name: 'Competitive Intelligence Agent', role: 'Monitors competitors, analyzes their communications, and identifies strategic opportunities', department: 'strategic', avatar: '🔭', status: 'active', skills: ['competitor-monitoring', 'multi-channel-analysis', 'swot-analysis', 'opportunity-detection'], tools: ['email-scanner', 'social-monitor', 'web-scraper', 'sentiment-analyzer'], workflows: ['competitor-digest', 'opportunity-alert'], lastRun: null, lastRunStatus: null, totalRuns: 0, successRate: 0 },
];

// ─── Helper Functions ────────────────────────────────────────────────────────

export const getAgentsByDepartment = (deptId) =>
    agents.filter((a) => a.department === deptId);

export const getDepartmentById = (deptId) =>
    departments.find((d) => d.id === deptId);

export const getAgentById = (agentId) =>
    agents.find((a) => a.id === agentId);

export const getSkillById = (skillId) =>
    skills.find((s) => s.id === skillId);

export const getToolById = (toolId) =>
    tools.find((t) => t.id === toolId);

export const getWorkflowById = (workflowId) =>
    workflows.find((w) => w.id === workflowId);

export const getAgentsForTool = (toolId) =>
    agents.filter((a) => (a.tools || []).includes(toolId));

export const getWorkflowsForAgent = (agentId) =>
    workflows.filter((w) => w.steps.some((s) => s.agent === agentId));

export const getDepartmentStats = (deptId) => {
    const deptAgents = getAgentsByDepartment(deptId);
    return {
        agentCount: deptAgents.length,
        activeCount: deptAgents.filter((a) => a.status === 'active').length,
        totalRuns: deptAgents.reduce((sum, a) => sum + a.totalRuns, 0),
        avgSuccessRate: deptAgents.length
            ? Math.round(deptAgents.reduce((sum, a) => sum + a.successRate, 0) / deptAgents.length)
            : 0,
        skillsCount: new Set(deptAgents.flatMap((a) => a.skills)).size,
    };
};

// ─── Weekly Brainstorm Sessions (populated from DB) ─────────────────────────

export const weeklySessions = [];

// ─── Pipeline: Projects from Weeklies (populated from DB) ───────────────────

export const weeklyProjects = [];

// ─── Weekly Helper Functions ────────────────────────────────────────────────

export const getWeekliesByDepartment = (deptId) =>
    weeklySessions.filter((w) => w.department === deptId).sort((a, b) => b.date.localeCompare(a.date));

export const getWeeklyById = (weeklyId) =>
    weeklySessions.find((w) => w.id === weeklyId);

export const getProjectsByDepartment = (deptId) =>
    weeklyProjects.filter((p) => p.department === deptId);

export const getProjectById = (projectId) =>
    weeklyProjects.find((p) => p.id === projectId);

export const getProjectsByWeekly = (weeklyId) =>
    weeklyProjects.filter((p) => p.originWeekly === weeklyId);

// ─── Agent End-of-Day Reports (populated from DB) ───────────────────────────

export const eodReports = [];

// ─── EOD Report Helper Functions ────────────────────────────────────────────

export const getEodReportsByDate = (date) =>
    eodReports.filter((r) => r.date === date);

export const getEodReportsByAgent = (agentId) =>
    eodReports.filter((r) => r.agentId === agentId).sort((a, b) => b.date.localeCompare(a.date));

export const getEodReportsByDeptAndDate = (deptId, date) => {
    const deptAgentIds = agents.filter((a) => a.department === deptId).map((a) => a.id);
    return eodReports.filter((r) => r.date === date && deptAgentIds.includes(r.agentId));
};

export const getDailyStandupData = (deptId, date) => {
    const reports = getEodReportsByDeptAndDate(deptId, date);
    return {
        done: reports.flatMap((r) => r.completed.map((c) => ({ ...c, agentId: r.agentId }))),
        inProgress: reports.flatMap((r) => r.inProgress.map((p) => ({ ...p, agentId: r.agentId }))),
        blocked: reports.flatMap((r) => r.blockers.map((b) => ({ ...b, agentId: r.agentId }))),
        insights: reports.flatMap((r) => r.insights.map((i) => ({ text: i, agentId: r.agentId }))),
        reports,
    };
};

export const moodConfig = {
    productive: { emoji: '🚀', label: 'Productive' },
    focused: { emoji: '🎯', label: 'Focused' },
    creative: { emoji: '✨', label: 'Creative' },
    energized: { emoji: '⚡', label: 'Energized' },
    motivated: { emoji: '💪', label: 'Motivated' },
    strategic: { emoji: '🧠', label: 'Strategic' },
    accomplished: { emoji: '🏆', label: 'Accomplished' },
    starting: { emoji: '🌱', label: 'Starting' },
    idle: { emoji: '💤', label: 'Idle' },
};

// ─── Audit (populated from DB) ───────────────────────────────────────────────

export const auditLog = [];

// ─── Helpers ────────────────────────────────────────────────────────────────

export const getAuditLog = (filters = {}) => {
    let filtered = [...auditLog].sort((a, b) => b.date.localeCompare(a.date));
    if (filters.dept && filters.dept !== 'all') filtered = filtered.filter(e => e.dept === filters.dept);
    if (filters.type && filters.type !== 'all') filtered = filtered.filter(e => e.type === filters.type);
    return filtered;
};

// ─── Intelligence (populated from DB) ───────────────────────────────────────

export const intelligenceMetrics = {
    timeSeries: [],
    costBreakdown: [],
};

export const agentCosts = [];

export const systemAlerts = [];

export const forecasting = {
    nextMonthCost: 0,
    predictedGrowth: 0,
    efficiencyGain: 0,
};

// ─── Intelligence Helpers ───────────────────────────────────────────────────

export const getIntelligenceSummary = () => {
    const latest = intelligenceMetrics.timeSeries[intelligenceMetrics.timeSeries.length - 1] || { runs: 0, successRate: 0, cost: 0, errors: 0 };
    const previous = intelligenceMetrics.timeSeries[intelligenceMetrics.timeSeries.length - 2] || { runs: 0, cost: 0 };

    const runChange = previous.runs ? ((latest.runs - previous.runs) / previous.runs) * 100 : 0;
    const costChange = previous.cost ? ((latest.cost - previous.cost) / previous.cost) * 100 : 0;

    return {
        latest,
        runChange: runChange.toFixed(1),
        costChange: costChange.toFixed(1),
        totalMonthlyCost: intelligenceMetrics.timeSeries.reduce((acc, curr) => acc + curr.cost, 0).toFixed(2),
        activeAlerts: systemAlerts.filter(a => a.status === 'active').length,
    };
};

export const getAgentCost = (agentId) =>
    agentCosts.find(c => c.agentId === agentId) || { cost: 0, runs: 0, tokens: '0' };
