// ─── Mock Data for Agent-Specific Views ─────────────────────────────────────
// Each key matches the agent ID used in viewMap

// ═══════════════════════════════════════════════════════════════════════════════
// 1. Campaign Manager Agent
// ═══════════════════════════════════════════════════════════════════════════════
export const campaignManagerData = {
  campaigns: [
    {
      id: 'camp-1',
      name: 'DXB-MAN Route Launch',
      bauType: 'route-launch-new',
      status: 'qa',
      progress: 75,
      targetDate: '2026-03-28',
      phases: [
        { name: 'Brief', done: true },
        { name: 'Segment', done: true },
        { name: 'Content', done: true },
        { name: 'QA', done: false, current: true },
        { name: 'Launch', done: false },
      ],
      assignedAgents: ['content-agent', 'segmentation-agent', 'qa-agent', 'calendar-agent'],
      metrics: null,
    },
    {
      id: 'camp-2',
      name: 'Ramadan Holiday Offer',
      bauType: 'holiday-offer',
      status: 'content',
      progress: 35,
      targetDate: '2026-03-20',
      phases: [
        { name: 'Brief', done: true },
        { name: 'Segment', done: true },
        { name: 'Content', done: false, current: true },
        { name: 'QA', done: false },
        { name: 'Launch', done: false },
      ],
      assignedAgents: ['content-agent', 'segmentation-agent', 'brand-guardian'],
      metrics: null,
    },
    {
      id: 'camp-3',
      name: 'Marriott Partner Launch',
      bauType: 'partner-launch',
      status: 'launched',
      progress: 100,
      targetDate: '2026-02-28',
      phases: [
        { name: 'Brief', done: true },
        { name: 'Segment', done: true },
        { name: 'Content', done: true },
        { name: 'QA', done: true },
        { name: 'Launch', done: true },
      ],
      assignedAgents: ['content-agent', 'automation-architect', 'brand-guardian'],
      metrics: { openRate: 35.8, ctr: 5.1, conversions: 2800 },
    },
    {
      id: 'camp-4',
      name: 'March Newsletter',
      bauType: 'newsletter',
      status: 'qa',
      progress: 80,
      targetDate: '2026-03-12',
      phases: [
        { name: 'Brief', done: true },
        { name: 'Segment', done: true },
        { name: 'Content', done: true },
        { name: 'QA', done: false, current: true },
        { name: 'Launch', done: false },
      ],
      assignedAgents: ['content-agent', 'calendar-agent', 'qa-agent'],
      metrics: null,
    },
    {
      id: 'camp-5',
      name: 'Spring Flash Sale',
      bauType: 'product-offer',
      status: 'brief',
      progress: 10,
      targetDate: '2026-04-05',
      phases: [
        { name: 'Brief', done: false, current: true },
        { name: 'Segment', done: false },
        { name: 'Content', done: false },
        { name: 'QA', done: false },
        { name: 'Launch', done: false },
      ],
      assignedAgents: ['content-agent'],
      metrics: null,
    },
    {
      id: 'camp-6',
      name: 'Skywards Survey Q1',
      bauType: 'survey',
      status: 'launched',
      progress: 100,
      targetDate: '2026-03-01',
      phases: [
        { name: 'Brief', done: true },
        { name: 'Segment', done: true },
        { name: 'Content', done: true },
        { name: 'QA', done: true },
        { name: 'Launch', done: true },
      ],
      assignedAgents: ['content-agent', 'analytics-agent', 'automation-architect'],
      metrics: { openRate: 39.2, ctr: 12.4, conversions: 0 },
    },
    {
      id: 'camp-7',
      name: 'Hertz Partner Offer',
      bauType: 'partner-offer',
      status: 'content',
      progress: 45,
      targetDate: '2026-03-22',
      phases: [
        { name: 'Brief', done: true },
        { name: 'Segment', done: true },
        { name: 'Content', done: false, current: true },
        { name: 'QA', done: false },
        { name: 'Launch', done: false },
      ],
      assignedAgents: ['content-agent', 'legal-agent'],
      metrics: null,
    },
    {
      id: 'camp-8',
      name: 'New A350 Announcement',
      bauType: 'special-announcement',
      status: 'brief',
      progress: 5,
      targetDate: '2026-04-15',
      phases: [
        { name: 'Brief', done: false, current: true },
        { name: 'Segment', done: false },
        { name: 'Content', done: false },
        { name: 'QA', done: false },
        { name: 'Launch', done: false },
      ],
      assignedAgents: ['content-agent', 'brand-guardian', 'cloud-architect'],
      metrics: null,
    },
  ],
  dependencies: [
    { from: 'content-agent', to: 'brand-guardian', campaign: 'Ramadan Holiday Offer', status: 'waiting', description: 'Copy pending brand review' },
    { from: 'segmentation-agent', to: 'automation-architect', campaign: 'DXB-MAN Route Launch', status: 'waiting', description: 'Segments needed for journey setup' },
    { from: 'qa-agent', to: 'campaign-manager', campaign: 'DXB-MAN Route Launch', status: 'in-progress', description: 'QA tests running' },
    { from: 'legal-agent', to: 'campaign-manager', campaign: 'Marriott Partner Launch', status: 'resolved', description: 'Legal approved' },
  ],
  metricsHistory: [
    { week: 'W1', openRate: 28, ctr: 3.2, conversions: 800 },
    { week: 'W2', openRate: 30, ctr: 3.8, conversions: 950 },
    { week: 'W3', openRate: 32, ctr: 4.1, conversions: 1100 },
    { week: 'W4', openRate: 31, ctr: 4.5, conversions: 1050 },
    { week: 'W5', openRate: 35, ctr: 5.0, conversions: 1300 },
    { week: 'W6', openRate: 33, ctr: 4.8, conversions: 1240 },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// 2. CRM Agent
// ═══════════════════════════════════════════════════════════════════════════════
export const crmAgentData = {
  kpis: { retentionRate: 87.3, retentionTrend: 2.1, churnRiskCount: 4, activeSegments: 23 },
  segments: [
    { id: 'seg-1', name: 'High-Value Frequent Flyers', size: 45200, criteria: ['Tier: Gold+', 'Flights > 6/yr', 'Revenue > $5K'], lastUpdated: '2026-03-07', overlapPercent: 12 },
    { id: 'seg-2', name: 'Lapsed Premium', size: 18700, criteria: ['No flight 6mo+', 'Was Gold/Platinum'], lastUpdated: '2026-03-05', overlapPercent: 8 },
    { id: 'seg-3', name: 'New Enrollments Q1', size: 32100, criteria: ['Joined 2026-Q1', 'Age 25-45'], lastUpdated: '2026-03-08', overlapPercent: 3 },
    { id: 'seg-4', name: 'Business Travelers', size: 28400, criteria: ['Business class 3+/yr', 'Corporate account'], lastUpdated: '2026-03-06', overlapPercent: 22 },
    { id: 'seg-5', name: 'Family Vacationers', size: 51300, criteria: ['Economy', '2+ PAX bookings', 'School holiday travel'], lastUpdated: '2026-03-04', overlapPercent: 15 },
  ],
  cohorts: [
    { month: 'Oct', m0: 100, m1: 82, m2: 74, m3: 68, m4: 62, m5: 58 },
    { month: 'Nov', m0: 100, m1: 85, m2: 76, m3: 70, m4: 65, m5: null },
    { month: 'Dec', m0: 100, m1: 88, m2: 79, m3: 73, m4: null, m5: null },
    { month: 'Jan', m0: 100, m1: 84, m2: 77, m3: null, m4: null, m5: null },
    { month: 'Feb', m0: 100, m1: 86, m2: null, m3: null, m4: null, m5: null },
    { month: 'Mar', m0: 100, m1: null, m2: null, m3: null, m4: null, m5: null },
  ],
  alerts: [
    { id: 'a1', type: 'refresh', segment: 'Lapsed Premium', message: 'Segment not refreshed in 5 days', severity: 'warning' },
    { id: 'a2', type: 'anomaly', segment: 'High-Value Frequent Flyers', message: 'Unusual 8% drop in segment size', severity: 'critical' },
    { id: 'a3', type: 'refresh', segment: 'Family Vacationers', message: 'Criteria may need seasonal update', severity: 'info' },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// 3. Cloud Architect Agent
// ═══════════════════════════════════════════════════════════════════════════════
export const cloudArchitectData = {
  health: { running: 8, paused: 2, error: 1, throughput: 12340, errorRate: 0.3 },
  journeys: [
    { id: 'j1', name: 'Welcome Series', status: 'running', entryCount: 4520, description: '3-email onboarding flow for new members' },
    { id: 'j2', name: 'Cart Abandonment', status: 'running', entryCount: 1230, description: 'Triggered 2h after cart abandon' },
    { id: 'j3', name: 'Birthday Rewards', status: 'running', entryCount: 890, description: 'Monthly birthday milestone emails' },
    { id: 'j4', name: 'Re-engagement 90d', status: 'paused', entryCount: 0, description: 'Winback for 90-day inactive' },
    { id: 'j5', name: 'Tier Upgrade Notification', status: 'running', entryCount: 340, description: 'Triggered on tier change event' },
    { id: 'j6', name: 'Post-Flight Survey', status: 'error', entryCount: 0, description: 'NPS survey 24h after arrival — API timeout' },
  ],
  infrastructure: [
    { name: 'SFMC API', status: 'connected', latency: '120ms', limit: '10K/hr', usage: '62%' },
    { name: 'Data Extensions', status: 'connected', latency: '45ms', limit: '500 DE', usage: '78%' },
    { name: 'Automation Studio', status: 'connected', latency: '200ms', limit: '50 automations', usage: '44%' },
    { name: 'Looker Studio API', status: 'degraded', latency: '890ms', limit: '5K/hr', usage: '91%' },
  ],
  changelog: [
    { id: 'cl1', timestamp: '2026-03-09 14:30', action: 'Journey modified', target: 'Welcome Series', diff: 'Added 4th email step for premium tier' },
    { id: 'cl2', timestamp: '2026-03-08 09:15', action: 'DE created', target: 'Q1_Promo_Segments', diff: 'New data extension with 12 fields' },
    { id: 'cl3', timestamp: '2026-03-07 16:45', action: 'Journey paused', target: 'Re-engagement 90d', diff: 'Paused due to content refresh needed' },
    { id: 'cl4', timestamp: '2026-03-06 11:20', action: 'API limit increased', target: 'SFMC API', diff: 'Limit raised from 8K to 10K/hr' },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// 4. Content Agent
// ═══════════════════════════════════════════════════════════════════════════════
export const contentAgentData = {
  kpis: { pendingReview: 5, createdToday: 12, approvalRate: 94.2 },
  portfolio: [
    { id: 'c1', title: 'Summer Sale — Email Subject', type: 'email-subject', language: 'en', status: 'approved', preview: 'Exclusive Summer Savings — Up to 40% Off Flights', score: 92 },
    { id: 'c2', title: 'Summer Sale — Email Subject', type: 'email-subject', language: 'es', status: 'approved', preview: 'Ofertas Exclusivas de Verano — Hasta 40% de Descuento', score: 88 },
    { id: 'c3', title: 'Summer Sale — Email Body', type: 'email-body', language: 'en', status: 'review', preview: 'Dear [Name], Your next adventure awaits...', score: null },
    { id: 'c4', title: 'Ramadan Welcome — Push', type: 'push', language: 'ar', status: 'draft', preview: 'Ramadan Kareem — Special fares inside', score: null },
    { id: 'c5', title: 'Flash Promo — SMS', type: 'sms', language: 'en', status: 'approved', preview: '48h flash sale! Book now at emirates.com/promo', score: 95 },
    { id: 'c6', title: 'Loyalty Upgrade — Email Body', type: 'email-body', language: 'en', status: 'rejected', preview: 'You are just 5,000 miles away from Gold...', score: 65 },
    { id: 'c7', title: 'Birthday Reward — Email Subject', type: 'email-subject', language: 'en', status: 'approved', preview: 'Happy Birthday! A special gift from Emirates', score: 91 },
    { id: 'c8', title: 'NPS Survey — Email Body', type: 'email-body', language: 'en', status: 'review', preview: 'We value your feedback. Tell us about your recent flight...', score: null },
  ],
  abTests: [
    {
      id: 'ab1',
      name: 'Summer Sale Subject Lines',
      variantA: { text: 'Exclusive Summer Savings — Up to 40% Off', openRate: 32.1 },
      variantB: { text: 'Your Summer Escape Starts Here — 40% Off Flights', openRate: 28.7 },
      winner: 'A',
    },
    {
      id: 'ab2',
      name: 'CTA Button Text',
      variantA: { text: 'Book Now', ctr: 6.2 },
      variantB: { text: 'Explore Deals', ctr: 5.8 },
      winner: 'A',
    },
  ],
  quality: [
    { piece: 'Summer Sale — Email Body', score: 88, feedback: 'Tone slightly casual for premium brand. Adjust opening line.', from: 'brand-guardian' },
    { piece: 'Loyalty Upgrade — Email Body', score: 65, feedback: 'Missing legal disclaimer. Urgency language too aggressive.', from: 'brand-guardian' },
    { piece: 'Flash Promo — SMS', score: 95, feedback: 'Concise, on-brand, clear CTA. Approved.', from: 'brand-guardian' },
  ],
  generatedImages: [
    { id: 'img1', prompt: 'Luxury summer travel hero banner with golden sunset over Dubai skyline, premium feel', campaign: 'Summer Sale 2026', size: '1200x628', status: 'approved', timestamp: '2026-03-09 11:20', url: '/images/emirates-summer-hero.png' },
    { id: 'img2', prompt: 'Ramadan themed email header with crescent moon and lanterns, elegant navy and gold palette', campaign: 'Ramadan Campaign', size: '600x200', status: 'review', timestamp: '2026-03-09 09:45', url: '/images/emirates-ramadan-header.png' },
    { id: 'img3', prompt: 'Birthday celebration banner with confetti and gift box, warm and inviting', campaign: 'Birthday Rewards', size: '1200x628', status: 'approved', timestamp: '2026-03-08 16:10', url: '/images/emirates-birthday-banner.png' },
    { id: 'img4', prompt: 'Flash sale countdown graphic with bold red and white, urgency feel', campaign: 'Flash Promo Weekend', size: '600x600', status: 'rejected', timestamp: '2026-03-08 14:30', url: '/images/emirates-flash-sale.png' },
    { id: 'img5', prompt: 'First class cabin interior, luxurious travel experience, soft lighting', campaign: 'Loyalty Tier Upgrade', size: '1200x628', status: 'approved', timestamp: '2026-03-07 10:00', url: '/images/emirates-first-class.png' },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// 6. Segmentation Agent
// ═══════════════════════════════════════════════════════════════════════════════
export const segmentationAgentData = {
  distribution: [
    { name: 'High Value', percent: 15, count: 67500 },
    { name: 'Mid Value', percent: 45, count: 202500 },
    { name: 'Low Value', percent: 40, count: 180000 },
  ],
  createdThisWeek: 4,
  segments: [
    { id: 's1', name: 'High-Value Business', size: 28400, criteria: ['Business 3+/yr', 'Corporate'], created: '2026-03-08', overlap: 18, bauTypes: ['broadcast-emirates', 'product-offer', 'special-announcement'] },
    { id: 's2', name: 'Lapsed Gold Members', size: 12300, criteria: ['Gold tier', 'No flight 6mo+'], created: '2026-03-07', overlap: 8, bauTypes: ['occasional-announcement-churn', 'product-offer'] },
    { id: 's3', name: 'Family Segment Q1', size: 45100, criteria: ['2+ PAX', 'Economy', 'School holidays'], created: '2026-03-06', overlap: 25, bauTypes: ['holiday-offer', 'event-offer'] },
    { id: 's4', name: 'New Signups Mar 2026', size: 8900, criteria: ['Joined Mar 2026'], created: '2026-03-09', overlap: 2, bauTypes: ['newsletter', 'broadcast-emirates'] },
    { id: 's5', name: 'Premium Leisure', size: 19700, criteria: ['First/Business', 'Leisure routing'], created: '2026-03-05', overlap: 14, bauTypes: ['product-offer', 'special-announcement'] },
    { id: 's6', name: 'Dubai Residents', size: 34200, criteria: ['Home: DXB', 'Active 12mo'], created: '2026-03-04', overlap: 31, bauTypes: ['route-launch-outbound', 'single-region'] },
    { id: 's7', name: 'High Spenders Online', size: 15600, criteria: ['Online booking', 'AOV > $2K'], created: '2026-03-08', overlap: 20, bauTypes: ['product-offer', 'partner-offer'] },
    { id: 's8', name: 'Upgrade Propensity', size: 22800, criteria: ['ML score > 0.7', 'Economy frequent'], created: '2026-03-09', overlap: 11, bauTypes: ['product-offer', 'product-update'] },
    { id: 's9', name: 'Route: UK Residents', size: 41200, criteria: ['Home: UK', 'Active 12mo', 'Not suppressed'], created: '2026-03-09', overlap: 5, bauTypes: ['route-launch-new', 'route-launch-inbound'] },
    { id: 's10', name: 'Partner: Car Rental Interest', size: 18900, criteria: ['Rented car via Skywards', 'Travel freq > 4/yr'], created: '2026-03-08', overlap: 12, bauTypes: ['partner-offer', 'partner-offer-promotion'] },
    { id: 's11', name: 'Newsletter Subscribers', size: 189400, criteria: ['Newsletter opt-in', 'Active email'], created: '2026-03-09', overlap: 45, bauTypes: ['newsletter', 'broadcast-emirates'] },
    { id: 's12', name: 'Gulf Region (Ramadan)', size: 67800, criteria: ['Home: UAE/KSA/QA/BH/KW/OM', 'Active 6mo'], created: '2026-03-07', overlap: 22, bauTypes: ['holiday-offer', 'single-region'] },
  ],
  validation: [
    { segment: 'Dubai Residents', issue: 'Overlap with Family Segment Q1 exceeds 30%', severity: 'warning' },
    { segment: 'New Signups Mar 2026', issue: 'Pending size verification — data ingestion lag', severity: 'info' },
    { segment: 'Family Segment Q1', issue: 'Criteria may over-select — review PAX logic', severity: 'warning' },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// 7. Automation Architect Agent
// ═══════════════════════════════════════════════════════════════════════════════
export const automationArchitectData = {
  kpis: { activeJourneys: 6, draftJourneys: 3, errorRate: 0.8 },
  automations: [
    { id: 'au1', name: 'Welcome Series', status: 'active', trigger: 'New member enrollment', steps: 4, entryCount: 4520 },
    { id: 'au2', name: 'Cart Abandonment', status: 'active', trigger: 'Cart abandon after 2h', steps: 3, entryCount: 1230 },
    { id: 'au3', name: 'Birthday Rewards', status: 'active', trigger: 'Birthday date match', steps: 2, entryCount: 890 },
    { id: 'au4', name: 'Post-Flight NPS', status: 'error', trigger: 'Flight arrival + 24h', steps: 2, entryCount: 0 },
    { id: 'au5', name: 'Tier Change Alert', status: 'active', trigger: 'Tier upgrade/downgrade event', steps: 3, entryCount: 340 },
    { id: 'au6', name: 'Re-engagement 90d', status: 'draft', trigger: '90-day inactivity', steps: 5, entryCount: 0 },
    { id: 'au7', name: 'Flash Sale Blast', status: 'draft', trigger: 'Manual trigger', steps: 2, entryCount: 0 },
    { id: 'au8', name: 'Loyalty Milestone', status: 'draft', trigger: 'Miles threshold reached', steps: 3, entryCount: 0 },
  ],
  executions: [
    { journey: 'Welcome Series', timestamp: '2026-03-09 14:22', result: 'success', duration: '1.2s' },
    { journey: 'Welcome Series', timestamp: '2026-03-09 14:18', result: 'success', duration: '1.1s' },
    { journey: 'Cart Abandonment', timestamp: '2026-03-09 13:45', result: 'success', duration: '0.8s' },
    { journey: 'Post-Flight NPS', timestamp: '2026-03-09 12:00', result: 'fail', duration: '30.0s' },
    { journey: 'Birthday Rewards', timestamp: '2026-03-09 08:00', result: 'success', duration: '0.9s' },
    { journey: 'Tier Change Alert', timestamp: '2026-03-09 07:30', result: 'success', duration: '1.5s' },
    { journey: 'Cart Abandonment', timestamp: '2026-03-08 22:10', result: 'success', duration: '0.7s' },
    { journey: 'Welcome Series', timestamp: '2026-03-08 20:15', result: 'success', duration: '1.3s' },
    { journey: 'Post-Flight NPS', timestamp: '2026-03-08 12:00', result: 'timeout', duration: '60.0s' },
    { journey: 'Birthday Rewards', timestamp: '2026-03-08 08:00', result: 'success', duration: '1.0s' },
  ],
  errors: [
    { type: 'API Timeout', count: 12, lastSeen: '2026-03-09 12:00', message: 'SFMC Journey Builder API timeout after 30s' },
    { type: 'Data Extension Missing', count: 3, lastSeen: '2026-03-07 16:30', message: 'Referenced DE "Q4_Segments" not found' },
    { type: 'Invalid Entry Event', count: 1, lastSeen: '2026-03-06 09:15', message: 'Event schema mismatch in Post-Flight NPS trigger' },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// 8. Calendar Agent
// ═══════════════════════════════════════════════════════════════════════════════
export const calendarAgentData = {
  events: [
    { id: 'ev1', date: '2026-03-10', campaign: 'March Newsletter', bauType: 'newsletter', type: 'email', segment: 'Newsletter Subscribers', color: '#D71920' },
    { id: 'ev2', date: '2026-03-10', campaign: 'Ramadan Holiday Offer', bauType: 'holiday-offer', type: 'push', segment: 'Gulf Region', color: '#D4AF37' },
    { id: 'ev3', date: '2026-03-12', campaign: 'Hertz Partner Offer', bauType: 'partner-offer', type: 'email', segment: 'Car Rental Interest', color: '#6366f1' },
    { id: 'ev4', date: '2026-03-14', campaign: 'DXB-MAN Route Launch', bauType: 'route-launch-new', type: 'email', segment: 'UK Residents', color: '#10b981' },
    { id: 'ev5', date: '2026-03-14', campaign: 'MAN-DXB Inbound Wave', bauType: 'route-launch-inbound', type: 'email', segment: 'Manchester Metro', color: '#10b981' },
    { id: 'ev6', date: '2026-03-17', campaign: 'Weekly Broadcast', bauType: 'broadcast-emirates', type: 'email', segment: 'Tier Gold+', color: '#D71920' },
    { id: 'ev7', date: '2026-03-20', campaign: 'Ramadan Holiday Offer', bauType: 'holiday-offer', type: 'email', segment: 'All Active', color: '#D4AF37' },
    { id: 'ev8', date: '2026-03-22', campaign: 'Post-Flight Survey', bauType: 'survey', type: 'email', segment: 'Recent Flyers', color: '#f59e0b' },
    { id: 'ev9', date: '2026-03-25', campaign: 'Avis Partner Promo', bauType: 'partner-offer-promotion', type: 'push', segment: 'Car Rental Segment', color: '#6366f1' },
    { id: 'ev10', date: '2026-03-28', campaign: 'DXB-MAN Outbound Wave 2', bauType: 'route-launch-outbound', type: 'email', segment: 'Dubai Residents', color: '#10b981' },
  ],
  conflicts: [
    { id: 'conf1', date: '2026-03-10', campaigns: ['March Newsletter', 'Ramadan Holiday Offer'], bauTypes: ['newsletter', 'holiday-offer'], segment: 'Gulf Region overlap with Newsletter', severity: 'high', description: '2 BAU types (Broadcast + Offer) targeting overlapping segments within 24h' },
    { id: 'conf2', date: '2026-03-14', campaigns: ['DXB-MAN Route Launch', 'MAN-DXB Inbound Wave'], bauTypes: ['route-launch-new', 'route-launch-inbound'], segment: 'UK market overlap', severity: 'medium', description: '2 Route Launch waves same day — check segment overlap' },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// 9. Brand Guardian Agent
// ═══════════════════════════════════════════════════════════════════════════════
export const brandGuardianData = {
  kpis: { pendingReviews: 3, approvedToday: 8, rejectedToday: 2 },
  reviewQueue: [
    { id: 'rq1', piece: 'Summer Sale — Email Body EN', campaign: 'Summer Sale 2026', submittedBy: 'content-agent', preview: 'Dear [Name], Your next adventure awaits with exclusive summer savings...', status: 'pending' },
    { id: 'rq2', piece: 'Ramadan Welcome — Push AR', campaign: 'Ramadan Campaign', submittedBy: 'content-agent', preview: 'Ramadan Kareem — Special fares inside', status: 'pending' },
    { id: 'rq3', piece: 'Loyalty Upgrade — Email Body v2', campaign: 'Loyalty Tier Upgrade', submittedBy: 'content-agent', preview: 'You are steps away from Gold status...', status: 'pending' },
  ],
  history: [
    { piece: 'Flash Promo — SMS', campaign: 'Flash Promo Weekend', decision: 'approved', reason: 'On-brand, concise, clear CTA', timestamp: '2026-03-09 10:30' },
    { piece: 'Summer Sale — Subject EN', campaign: 'Summer Sale 2026', decision: 'approved', reason: 'Premium tone, compelling offer', timestamp: '2026-03-09 09:15' },
    { piece: 'Loyalty Upgrade — Email Body', campaign: 'Loyalty Tier Upgrade', decision: 'rejected', reason: 'Too aggressive urgency language, missing disclaimer', timestamp: '2026-03-08 16:20' },
    { piece: 'Birthday Reward — Subject', campaign: 'Birthday Rewards', decision: 'approved', reason: 'Warm, personal, on-brand', timestamp: '2026-03-08 14:00' },
    { piece: 'Cart Abandon — Email Body', campaign: 'Cart Abandonment', decision: 'approved', reason: 'Good balance of urgency and premium tone', timestamp: '2026-03-08 11:30' },
    { piece: 'NPS Survey — Email Body', campaign: 'Post-Flight Survey', decision: 'approved', reason: 'Professional, respectful tone', timestamp: '2026-03-07 15:45' },
    { piece: 'Re-engagement — Subject', campaign: 'Re-engagement 90d', decision: 'rejected', reason: 'Subject too clickbaity, not aligned with brand voice', timestamp: '2026-03-07 10:20' },
    { piece: 'Weekend Getaway — Push', campaign: 'Weekend Getaway', decision: 'approved', reason: 'Approved with minor edit to CTA', timestamp: '2026-03-06 16:00' },
    { piece: 'Companion Fare — Email Body', campaign: 'Companion Fare Promo', decision: 'approved', reason: 'Excellent premium positioning', timestamp: '2026-03-06 09:30' },
    { piece: 'Summer Sale — Hero Banner', campaign: 'Summer Sale 2026', decision: 'approved', reason: 'Visual meets brand guidelines', timestamp: '2026-03-05 14:15' },
  ],
  guidelines: [
    { rule: 'Premium Tone of Voice', compliance: 94, description: 'Language reflects luxury, aspiration, and exclusivity' },
    { rule: 'Brand Color Palette', compliance: 100, description: 'Only approved colors: Red #D71920, Gold #D4AF37, White, Dark Gray' },
    { rule: 'Logo Usage', compliance: 100, description: 'Logo placement, minimum size, and clear space rules' },
    { rule: 'Typography Standards', compliance: 98, description: 'Inter for digital, approved weights and sizes' },
    { rule: 'Imagery Guidelines', compliance: 88, description: 'High-quality lifestyle photography, diverse representation' },
    { rule: 'Legal Disclaimers', compliance: 82, description: 'Required disclaimers present on all promotional content' },
    { rule: 'Accessibility Standards', compliance: 90, description: 'Alt text, contrast ratios, screen reader compatibility' },
    { rule: 'Multilingual Consistency', compliance: 86, description: 'EN/ES/AR versions maintain same brand voice' },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// 10. Legal Agent
// ═══════════════════════════════════════════════════════════════════════════════
export const legalAgentData = {
  campaignCompliance: [
    { campaign: 'Summer Sale 2026', checks: { GDPR: 'pass', 'CAN-SPAM': 'pass', 'UAE Local': 'pass', Consent: 'pass' } },
    { campaign: 'Ramadan Campaign', checks: { GDPR: 'pass', 'CAN-SPAM': 'pass', 'UAE Local': 'pass', Consent: 'warning' } },
    { campaign: 'Flash Promo Weekend', checks: { GDPR: 'fail', 'CAN-SPAM': 'pass', 'UAE Local': 'pass', Consent: 'warning' } },
    { campaign: 'Loyalty Tier Upgrade', checks: { GDPR: 'pass', 'CAN-SPAM': 'pass', 'UAE Local': 'warning', Consent: 'pass' } },
  ],
  risks: [
    { id: 'r1', campaign: 'Flash Promo Weekend', regulation: 'GDPR', severity: 'critical', description: 'Missing explicit opt-in for EU recipients', action: 'Add consent gate before EU segment entry', deadline: '2026-03-11', responsible: 'automation-architect' },
    { id: 'r2', campaign: 'Ramadan Campaign', regulation: 'Consent', severity: 'warning', description: 'Consent records older than 12 months for 15% of segment', action: 'Re-consent flow needed', deadline: '2026-03-15', responsible: 'crm-agent' },
    { id: 'r3', campaign: 'Loyalty Tier Upgrade', regulation: 'UAE Local', severity: 'warning', description: 'Promotion terms may need TRA approval', action: 'Submit to TRA for pre-approval', deadline: '2026-03-20', responsible: 'legal-agent' },
    { id: 'r4', campaign: 'Flash Promo Weekend', regulation: 'Terms', severity: 'warning', description: 'Promo T&C not finalized', action: 'Legal team to finalize terms', deadline: '2026-03-10', responsible: 'legal-agent' },
    { id: 'r5', campaign: 'Summer Sale 2026', regulation: 'GDPR', severity: 'info', description: 'Annual DPIA review due', action: 'Schedule DPIA review session', deadline: '2026-04-01', responsible: 'legal-agent' },
  ],
  auditLog: [
    { timestamp: '2026-03-09 14:00', campaign: 'Flash Promo Weekend', check: 'GDPR Consent Validation', result: 'fail', notes: 'EU segment missing explicit opt-in' },
    { timestamp: '2026-03-09 13:30', campaign: 'Summer Sale 2026', check: 'CAN-SPAM Headers', result: 'pass', notes: 'All required headers present' },
    { timestamp: '2026-03-09 12:00', campaign: 'Ramadan Campaign', check: 'Consent Age Check', result: 'warning', notes: '15% of records > 12 months' },
    { timestamp: '2026-03-08 16:00', campaign: 'Loyalty Tier Upgrade', check: 'UAE TRA Compliance', result: 'warning', notes: 'Requires TRA pre-approval' },
    { timestamp: '2026-03-08 14:30', campaign: 'Summer Sale 2026', check: 'GDPR Data Mapping', result: 'pass', notes: 'All PII fields documented' },
    { timestamp: '2026-03-08 10:00', campaign: 'Flash Promo Weekend', check: 'Terms & Conditions', result: 'warning', notes: 'Draft T&C pending legal sign-off' },
    { timestamp: '2026-03-07 15:00', campaign: 'Birthday Rewards', check: 'Full Compliance Scan', result: 'pass', notes: 'All checks passed' },
    { timestamp: '2026-03-07 11:00', campaign: 'Cart Abandonment', check: 'Full Compliance Scan', result: 'pass', notes: 'Compliant across all regulations' },
    { timestamp: '2026-03-06 16:30', campaign: 'Ramadan Campaign', check: 'UAE Local Content Review', result: 'pass', notes: 'Content approved for UAE market' },
    { timestamp: '2026-03-06 09:00', campaign: 'Welcome Series', check: 'Full Compliance Scan', result: 'pass', notes: 'Standard onboarding — all clear' },
    { timestamp: '2026-03-05 14:00', campaign: 'Re-engagement 90d', check: 'GDPR Right to Erasure', result: 'pass', notes: 'Suppression list applied' },
    { timestamp: '2026-03-05 10:00', campaign: 'Companion Fare Promo', check: 'Full Compliance Scan', result: 'pass', notes: 'All regulations met' },
    { timestamp: '2026-03-04 16:00', campaign: 'NPS Survey', check: 'Data Retention Policy', result: 'pass', notes: 'Survey data retention within policy' },
    { timestamp: '2026-03-04 11:00', campaign: 'Weekend Getaway', check: 'Full Compliance Scan', result: 'pass', notes: 'No issues found' },
    { timestamp: '2026-03-03 15:00', campaign: 'Summer Sale 2026', check: 'Initial Compliance Review', result: 'pass', notes: 'Campaign brief approved' },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// 11. QA Agent
// ═══════════════════════════════════════════════════════════════════════════════
export const qaAgentData = {
  kpis: { passed: 145, failed: 3, pending: 7 },
  testResults: [
    { id: 'tr1', piece: 'Summer Sale — Email', links: { ok: 12, broken: 0 }, render: { desktop: 98, mobile: 95, tablet: 96 }, spamScore: 1.2, loadTime: 420 },
    { id: 'tr2', piece: 'Ramadan — Push', links: { ok: 2, broken: 0 }, render: { desktop: 100, mobile: 100, tablet: 100 }, spamScore: 0.5, loadTime: 180 },
    { id: 'tr3', piece: 'Flash Promo — SMS', links: { ok: 1, broken: 0 }, render: { desktop: 100, mobile: 100, tablet: 100 }, spamScore: 0.8, loadTime: 90 },
    { id: 'tr4', piece: 'Loyalty Upgrade — Email', links: { ok: 8, broken: 2 }, render: { desktop: 85, mobile: 72, tablet: 80 }, spamScore: 4.5, loadTime: 890 },
    { id: 'tr5', piece: 'Birthday Reward — Email', links: { ok: 6, broken: 0 }, render: { desktop: 97, mobile: 94, tablet: 95 }, spamScore: 1.0, loadTime: 350 },
    { id: 'tr6', piece: 'Cart Abandon — Email', links: { ok: 5, broken: 0 }, render: { desktop: 96, mobile: 92, tablet: 93 }, spamScore: 2.1, loadTime: 410 },
    { id: 'tr7', piece: 'NPS Survey — Email', links: { ok: 3, broken: 1 }, render: { desktop: 94, mobile: 88, tablet: 90 }, spamScore: 1.8, loadTime: 520 },
    { id: 'tr8', piece: 'Re-engagement — Email', links: { ok: 7, broken: 0 }, render: { desktop: 95, mobile: 91, tablet: 93 }, spamScore: 3.2, loadTime: 480 },
    { id: 'tr9', piece: 'Companion Fare — Email', links: { ok: 9, broken: 0 }, render: { desktop: 98, mobile: 96, tablet: 97 }, spamScore: 0.9, loadTime: 380 },
    { id: 'tr10', piece: 'Weekend Getaway — Push', links: { ok: 1, broken: 0 }, render: { desktop: 100, mobile: 100, tablet: 100 }, spamScore: 0.4, loadTime: 150 },
  ],
  queue: [
    { id: 'q1', name: 'Ramadan — Email Body AR', type: 'email', priority: 'high', submitted: '2026-03-09' },
    { id: 'q2', name: 'Loyalty Upgrade — Email v2', type: 'email', priority: 'high', submitted: '2026-03-09' },
    { id: 'q3', name: 'Summer Sale — Landing Page', type: 'landing', priority: 'medium', submitted: '2026-03-08' },
    { id: 'q4', name: 'NPS Survey — Email v2', type: 'email', priority: 'low', submitted: '2026-03-08' },
  ],
  bugs: [
    { id: 'b1', title: 'Broken CTA link in Loyalty Upgrade email', severity: 'critical', status: 'open', description: 'Main CTA button links to 404 page' },
    { id: 'b2', title: 'Mobile render issue — overlapping text', severity: 'major', status: 'in-progress', description: 'Email body text overlaps hero image on iPhone 14' },
    { id: 'b3', title: 'NPS Survey — broken tracking pixel', severity: 'major', status: 'open', description: 'Open tracking pixel returns 500' },
    { id: 'b4', title: 'Spam score warning on Loyalty email', severity: 'minor', status: 'open', description: 'Spam score 4.5 exceeds threshold of 3.0' },
    { id: 'b5', title: 'Alt text missing on hero images', severity: 'minor', status: 'fixed', description: 'Accessibility issue in 3 email templates' },
    { id: 'b6', title: 'Slow load time on Loyalty email', severity: 'minor', status: 'fixed', description: 'Image optimization reduced load from 890ms to 420ms' },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// 12. Analytics Agent
// ═══════════════════════════════════════════════════════════════════════════════
export const analyticsAgentData = {
  kpis: { totalRevenue: 1200000, avgRoi: 3.2, reportsGenerated: 8 },
  timeSeries: [
    { week: 'W1', opens: 12400, clicks: 1860, conversions: 620 },
    { week: 'W2', opens: 13100, clicks: 2010, conversions: 680 },
    { week: 'W3', opens: 11800, clicks: 1750, conversions: 590 },
    { week: 'W4', opens: 14200, clicks: 2200, conversions: 740 },
    { week: 'W5', opens: 15600, clicks: 2480, conversions: 830 },
    { week: 'W6', opens: 13900, clicks: 2100, conversions: 710 },
    { week: 'W7', opens: 16200, clicks: 2600, conversions: 890 },
    { week: 'W8', opens: 14800, clicks: 2350, conversions: 780 },
    { week: 'W9', opens: 17100, clicks: 2750, conversions: 920 },
    { week: 'W10', opens: 15400, clicks: 2450, conversions: 810 },
    { week: 'W11', opens: 18200, clicks: 2900, conversions: 980 },
    { week: 'W12', opens: 16800, clicks: 2700, conversions: 900 },
  ],
  roiByCampaign: [
    { campaign: 'Marriott Partner Launch', roi: 4.5 },
    { campaign: 'Ramadan Holiday Offer', roi: 3.8 },
    { campaign: 'DXB-MAN Route Launch', roi: 3.2 },
    { campaign: 'March Newsletter', roi: 2.9 },
    { campaign: 'Skywards Survey Q1', roi: 2.1 },
  ],
  bauTypePerformance: [
    { bauType: 'broadcast-emirates', name: 'BroadCast Emirates', sends: 245000, openRate: 28.3, ctr: 3.1, conversions: 4200, revenue: 180000 },
    { bauType: 'holiday-offer', name: 'Holiday Offer', sends: 89000, openRate: 35.2, ctr: 5.8, conversions: 3100, revenue: 420000 },
    { bauType: 'route-launch-new', name: 'Route Launch (new)', sends: 67000, openRate: 42.1, ctr: 7.2, conversions: 2800, revenue: 380000 },
    { bauType: 'partner-offer', name: 'Partner Offer', sends: 112000, openRate: 24.6, ctr: 3.8, conversions: 1900, revenue: 95000 },
    { bauType: 'newsletter', name: 'Newsletter', sends: 198000, openRate: 31.4, ctr: 4.2, conversions: 2100, revenue: 120000 },
    { bauType: 'product-offer', name: 'Product Offer', sends: 78000, openRate: 33.8, ctr: 5.1, conversions: 2400, revenue: 210000 },
    { bauType: 'survey', name: 'Survey', sends: 45000, openRate: 38.9, ctr: 12.1, conversions: 0, revenue: 0 },
    { bauType: 'special-announcement', name: 'Special Announcement', sends: 320000, openRate: 45.2, ctr: 2.1, conversions: 800, revenue: 45000 },
  ],
  attribution: [
    { channel: 'Email', percent: 42, revenue: 504000, trend: 'up' },
    { channel: 'Push Notifications', percent: 18, revenue: 216000, trend: 'up' },
    { channel: 'SMS', percent: 15, revenue: 180000, trend: 'stable' },
    { channel: 'In-App', percent: 14, revenue: 168000, trend: 'up' },
    { channel: 'Web Retargeting', percent: 11, revenue: 132000, trend: 'down' },
  ],
  reports: [
    { id: 'rep1', title: 'Weekly Performance Report — W10', date: '2026-03-07', type: 'weekly' },
    { id: 'rep2', title: 'Flash Promo Post-Campaign Analysis', date: '2026-03-05', type: 'campaign' },
    { id: 'rep3', title: 'Q1 Attribution Deep Dive', date: '2026-03-03', type: 'adhoc' },
    { id: 'rep4', title: 'Weekly Performance Report — W9', date: '2026-02-28', type: 'weekly' },
    { id: 'rep5', title: 'Birthday Rewards ROI Report', date: '2026-02-25', type: 'campaign' },
    { id: 'rep6', title: 'Channel Mix Optimization', date: '2026-02-20', type: 'adhoc' },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// 13. HTML Developer Agent
// ═══════════════════════════════════════════════════════════════════════════════
export const htmlDeveloperData = {
  kpis: { templatesCreated: 18, blocksLibrary: 45, lastDeployed: '2h ago' },
  templates: [
    {
      id: 'tpl-1',
      name: 'Welcome Email Template',
      type: 'Full Template',
      lastEdited: '2h ago',
      usedIn: ['Welcome Series', 'Re-engagement 90d', 'Birthday Rewards'],
      html: `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif"><table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#ffffff"><tr><td style="padding:20px;text-align:center;background:#D71920"><img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='30'%3E%3Ctext y='22' fill='white' font-family='Arial' font-weight='bold' font-size='18'%3EAgentOS%3C/text%3E%3C/svg%3E" alt="Logo" /></td></tr><tr><td style="padding:0"><div style="background:linear-gradient(135deg,%23D71920,%23ff6b6b);height:200px;display:flex;align-items:center;justify-content:center"><h1 style="color:white;font-size:28px;text-align:center;padding:20px">Welcome Aboard!</h1></div></td></tr><tr><td style="padding:30px"><h2 style="color:#1a1a2e;margin:0 0 15px">Hello [Name],</h2><p style="color:#475569;line-height:1.6">Thank you for joining us. We are excited to have you as part of our community. Explore everything we have to offer.</p><div style="text-align:center;padding:20px 0"><a href="#" style="background:#D71920;color:white;padding:14px 32px;text-decoration:none;border-radius:6px;font-weight:bold">Get Started</a></div></td></tr><tr><td style="padding:20px;text-align:center;background:#1a1a2e;color:#94a3b8;font-size:12px"><p>© 2026 AgentOS. All rights reserved.</p><p><a href="#" style="color:#94a3b8">Unsubscribe</a></p></td></tr></table></body></html>`,
    },
    {
      id: 'tpl-2',
      name: 'Promotional Sale Template',
      type: 'Full Template',
      lastEdited: '1d ago',
      usedIn: ['Summer Sale 2026', 'Flash Promo Weekend'],
      html: `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif"><table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#ffffff"><tr><td style="padding:20px;text-align:center;background:#D71920"><img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='30'%3E%3Ctext y='22' fill='white' font-family='Arial' font-weight='bold' font-size='18'%3EAgentOS%3C/text%3E%3C/svg%3E" alt="Logo" /></td></tr><tr><td style="padding:0;background:linear-gradient(135deg,%23D4AF37,%23f7dc6f);text-align:center;padding:40px 20px"><h1 style="color:#1a1a2e;font-size:32px;margin:0">SUMMER SALE</h1><p style="color:#1a1a2e;font-size:48px;font-weight:bold;margin:10px 0">40% OFF</p><p style="color:#475569">Limited time offer on select flights</p></td></tr><tr><td style="padding:30px"><table width="100%" cellpadding="10"><tr><td width="50%" style="text-align:center;background:#f8f9fa;border-radius:8px"><strong>DXB → LHR</strong><br/><span style="color:#D71920;font-size:24px;font-weight:bold">$499</span><br/><del style="color:#94a3b8">$832</del></td><td width="50%" style="text-align:center;background:#f8f9fa;border-radius:8px"><strong>DXB → CDG</strong><br/><span style="color:#D71920;font-size:24px;font-weight:bold">$459</span><br/><del style="color:#94a3b8">$765</del></td></tr></table><div style="text-align:center;padding:25px 0"><a href="#" style="background:#D71920;color:white;padding:14px 40px;text-decoration:none;border-radius:6px;font-weight:bold;font-size:16px">Book Now</a></div></td></tr><tr><td style="padding:20px;text-align:center;background:#1a1a2e;color:#94a3b8;font-size:12px"><p>© 2026 AgentOS. All rights reserved.</p><p><a href="#" style="color:#94a3b8">Unsubscribe</a></p></td></tr></table></body></html>`,
    },
    {
      id: 'tpl-3',
      name: 'Survey/NPS Template',
      type: 'Full Template',
      lastEdited: '3d ago',
      usedIn: ['Post-Flight Survey'],
      html: `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif"><table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#ffffff"><tr><td style="padding:20px;text-align:center;background:#1a1a2e"><img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='30'%3E%3Ctext y='22' fill='white' font-family='Arial' font-weight='bold' font-size='18'%3EAgentOS%3C/text%3E%3C/svg%3E" alt="Logo" /></td></tr><tr><td style="padding:40px 30px;text-align:center"><h1 style="color:#1a1a2e;font-size:24px">How was your experience?</h1><p style="color:#475569;line-height:1.6">We would love to hear about your recent journey. Your feedback helps us improve.</p><div style="padding:20px 0"><table width="100%" cellpadding="5"><tr style="text-align:center"><td><a href="#" style="display:inline-block;width:40px;height:40px;line-height:40px;background:#fef2f2;border-radius:50%;text-decoration:none;font-size:18px">1</a></td><td><a href="#" style="display:inline-block;width:40px;height:40px;line-height:40px;background:#fff7ed;border-radius:50%;text-decoration:none;font-size:18px">2</a></td><td><a href="#" style="display:inline-block;width:40px;height:40px;line-height:40px;background:#fefce8;border-radius:50%;text-decoration:none;font-size:18px">3</a></td><td><a href="#" style="display:inline-block;width:40px;height:40px;line-height:40px;background:#f0fdf4;border-radius:50%;text-decoration:none;font-size:18px">4</a></td><td><a href="#" style="display:inline-block;width:40px;height:40px;line-height:40px;background:#ecfdf5;border-radius:50%;text-decoration:none;font-size:18px">5</a></td></tr></table><p style="color:#94a3b8;font-size:12px">1 = Poor &nbsp;&nbsp;&nbsp; 5 = Excellent</p></div></td></tr><tr><td style="padding:20px;text-align:center;background:#1a1a2e;color:#94a3b8;font-size:12px"><p>© 2026 AgentOS. All rights reserved.</p><p><a href="#" style="color:#94a3b8">Unsubscribe</a></p></td></tr></table></body></html>`,
    },
    {
      id: 'tpl-4',
      name: 'Loyalty Milestone Template',
      type: 'Full Template',
      lastEdited: '5d ago',
      usedIn: ['Loyalty Tier Upgrade', 'Birthday Rewards'],
      html: `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif"><table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#ffffff"><tr><td style="padding:20px;text-align:center;background:#D4AF37"><img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='30'%3E%3Ctext y='22' fill='white' font-family='Arial' font-weight='bold' font-size='18'%3EAgentOS%3C/text%3E%3C/svg%3E" alt="Logo" /></td></tr><tr><td style="padding:40px 30px;text-align:center;background:linear-gradient(135deg,%23D4AF37,%23f7dc6f)"><p style="font-size:48px;margin:0">🏆</p><h1 style="color:#1a1a2e;font-size:28px;margin:10px 0">Congratulations!</h1><p style="color:#475569;font-size:16px">You have reached a new milestone</p></td></tr><tr><td style="padding:30px"><div style="text-align:center;padding:20px;background:#fffbeb;border-radius:12px;margin-bottom:20px"><p style="color:#D4AF37;font-size:36px;font-weight:bold;margin:0">Gold Status</p><p style="color:#475569;margin:5px 0 0">You are now a Gold member</p></div><p style="color:#475569;line-height:1.6;text-align:center">Enjoy exclusive benefits including priority boarding, lounge access, and bonus miles on every flight.</p><div style="text-align:center;padding:20px 0"><a href="#" style="background:#D4AF37;color:white;padding:14px 32px;text-decoration:none;border-radius:6px;font-weight:bold">View Benefits</a></div></td></tr><tr><td style="padding:20px;text-align:center;background:#1a1a2e;color:#94a3b8;font-size:12px"><p>© 2026 AgentOS. All rights reserved.</p><p><a href="#" style="color:#94a3b8">Unsubscribe</a></p></td></tr></table></body></html>`,
    },
  ],
  blocks: [
    { id: 'blk-1', name: 'Standard Header', category: 'Header', usedInCount: 12, html: `<table width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:20px;text-align:center;background:#D71920"><img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='30'%3E%3Ctext y='22' fill='white' font-family='Arial' font-weight='bold' font-size='18'%3EAgentOS%3C/text%3E%3C/svg%3E" alt="Logo" /></td></tr></table>` },
    { id: 'blk-2', name: 'Gold Header', category: 'Header', usedInCount: 5, html: `<table width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:20px;text-align:center;background:#D4AF37"><img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='30'%3E%3Ctext y='22' fill='white' font-family='Arial' font-weight='bold' font-size='18'%3EAgentOS%3C/text%3E%3C/svg%3E" alt="Logo" /></td></tr></table>` },
    { id: 'blk-3', name: 'Hero Banner — Image + CTA', category: 'Hero', usedInCount: 7, html: `<table width="100%" cellpadding="0" cellspacing="0"><tr><td style="background:linear-gradient(135deg,#D71920,#ff6b6b);text-align:center;padding:40px 20px"><h1 style="color:white;font-size:28px;margin:0 0 10px">[Headline]</h1><p style="color:rgba(255,255,255,0.9);margin:0 0 20px">[Subheadline]</p><a href="#" style="background:white;color:#D71920;padding:12px 28px;text-decoration:none;border-radius:6px;font-weight:bold">[CTA]</a></td></tr></table>` },
    { id: 'blk-4', name: 'Hero Banner — Gold', category: 'Hero', usedInCount: 4, html: `<table width="100%" cellpadding="0" cellspacing="0"><tr><td style="background:linear-gradient(135deg,#D4AF37,#f7dc6f);text-align:center;padding:40px 20px"><h1 style="color:#1a1a2e;font-size:28px;margin:0 0 10px">[Headline]</h1><p style="color:#475569;margin:0 0 20px">[Subheadline]</p><a href="#" style="background:#1a1a2e;color:white;padding:12px 28px;text-decoration:none;border-radius:6px;font-weight:bold">[CTA]</a></td></tr></table>` },
    { id: 'blk-5', name: 'Single Column Text', category: 'Content', usedInCount: 15, html: `<table width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:30px"><h2 style="color:#1a1a2e;margin:0 0 15px">[Title]</h2><p style="color:#475569;line-height:1.6">[Body text goes here. Keep it concise and actionable.]</p></td></tr></table>` },
    { id: 'blk-6', name: 'Two Column Layout', category: 'Content', usedInCount: 8, html: `<table width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:20px"><table width="100%" cellpadding="10"><tr><td width="50%" style="background:#f8f9fa;border-radius:8px;text-align:center;vertical-align:top"><strong>[Col 1 Title]</strong><br/><span style="color:#475569">[Col 1 content]</span></td><td width="50%" style="background:#f8f9fa;border-radius:8px;text-align:center;vertical-align:top"><strong>[Col 2 Title]</strong><br/><span style="color:#475569">[Col 2 content]</span></td></tr></table></td></tr></table>` },
    { id: 'blk-7', name: 'CTA Button — Primary', category: 'CTA', usedInCount: 18, html: `<table width="100%" cellpadding="0" cellspacing="0"><tr><td style="text-align:center;padding:20px"><a href="#" style="background:#D71920;color:white;padding:14px 32px;text-decoration:none;border-radius:6px;font-weight:bold;font-size:16px">[Button Text]</a></td></tr></table>` },
    { id: 'blk-8', name: 'CTA Button — Gold', category: 'CTA', usedInCount: 6, html: `<table width="100%" cellpadding="0" cellspacing="0"><tr><td style="text-align:center;padding:20px"><a href="#" style="background:#D4AF37;color:white;padding:14px 32px;text-decoration:none;border-radius:6px;font-weight:bold;font-size:16px">[Button Text]</a></td></tr></table>` },
    { id: 'blk-9', name: 'Standard Footer', category: 'Footer', usedInCount: 14, html: `<table width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:20px;text-align:center;background:#1a1a2e;color:#94a3b8;font-size:12px"><p style="margin:0 0 8px">© 2026 AgentOS. All rights reserved.</p><p style="margin:0"><a href="#" style="color:#94a3b8;margin:0 8px">Privacy</a><a href="#" style="color:#94a3b8;margin:0 8px">Terms</a><a href="#" style="color:#94a3b8;margin:0 8px">Unsubscribe</a></p></td></tr></table>` },
    { id: 'blk-10', name: 'Social Links Bar', category: 'Footer', usedInCount: 10, html: `<table width="100%" cellpadding="0" cellspacing="0"><tr><td style="text-align:center;padding:15px;background:#f8f9fa"><a href="#" style="margin:0 8px;color:#475569;text-decoration:none">Twitter</a><a href="#" style="margin:0 8px;color:#475569;text-decoration:none">LinkedIn</a><a href="#" style="margin:0 8px;color:#475569;text-decoration:none">Instagram</a><a href="#" style="margin:0 8px;color:#475569;text-decoration:none">Facebook</a></td></tr></table>` },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// 13. Marina — Documentation Agent
// ═══════════════════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════════
// 14. Competitive Intelligence Agent
// ═══════════════════════════════════════════════════════════════════════════════
export const competitiveIntelData = {
  kpis: {
    competitorsTracked: 5,
    insightsThisWeek: 12,
    opportunitiesFound: 4,
    activeThreats: 2,
  },
  competitors: [
    { id: 'qatar', name: 'Qatar Airways', region: 'Middle East', strength: 'Qsuite business class & FIFA sponsorship reach', threatLevel: 'high', lastActivity: '2026-03-09', recentMove: 'Launched AI-powered personalized itineraries in Privilege Club app' },
    { id: 'etihad', name: 'Etihad Airways', region: 'Middle East', strength: 'Sustainability positioning & Abu Dhabi hub growth', threatLevel: 'high', lastActivity: '2026-03-08', recentMove: 'Rolled out dynamic pricing for loyalty redemptions across 40 routes' },
    { id: 'singapore', name: 'Singapore Airlines', region: 'Asia-Pacific', strength: 'Premium service consistency & KrisFlyer ecosystem', threatLevel: 'medium', lastActivity: '2026-03-07', recentMove: 'Integrated real-time NPS feedback loop into post-flight email sequence' },
    { id: 'turkish', name: 'Turkish Airlines', region: 'Europe/Middle East', strength: 'Network breadth (340+ destinations) & competitive pricing', threatLevel: 'medium', lastActivity: '2026-03-06', recentMove: 'Expanded Miles&Smiles with 15 new retail partners in GCC' },
    { id: 'british', name: 'British Airways', region: 'Europe', strength: 'Avios ecosystem & transatlantic dominance', threatLevel: 'low', lastActivity: '2026-03-05', recentMove: 'Redesigned Executive Club app with predictive travel suggestions' },
  ],
  intelligenceFeed: [
    { id: 'intel-1', source: 'email', competitor: 'Qatar Airways', date: '2026-03-09', title: 'Privilege Club: "Your AI Travel Companion is Here"', aiSummary: 'Qatar launched an AI concierge in their loyalty app that suggests destinations, upgrades and experiences based on travel history. This is a direct threat to Skywards digital experience.', sentiment: 'negative', category: 'innovation', impact: 'high' },
    { id: 'intel-2', source: 'press', competitor: 'Etihad Airways', date: '2026-03-08', title: 'Etihad Introduces Dynamic Loyalty Pricing', aiSummary: 'Etihad now uses real-time demand signals to price award tickets. Members see different mile costs based on route popularity and booking window. Could pressure Emirates to modernize Skywards redemption model.', sentiment: 'negative', category: 'loyalty', impact: 'high' },
    { id: 'intel-3', source: 'social', competitor: 'Singapore Airlines', date: '2026-03-07', title: 'SIA shares real-time NPS dashboard on LinkedIn', aiSummary: 'Singapore Airlines publicly shared their NPS improvement journey, showcasing a closed-loop feedback system that triggers personalized recovery emails within 2 hours of negative feedback.', sentiment: 'neutral', category: 'experience', impact: 'medium' },
    { id: 'intel-4', source: 'email', competitor: 'Turkish Airlines', date: '2026-03-06', title: 'Miles&Smiles: "Shop, Earn, Fly — 15 New Partners"', aiSummary: 'Turkish expanded earn opportunities beyond flights with GCC retail partnerships. The earn-outside-flying model increases engagement and reduces churn in their loyalty base.', sentiment: 'negative', category: 'loyalty', impact: 'medium' },
    { id: 'intel-5', source: 'blog', competitor: 'British Airways', date: '2026-03-05', title: 'BA Redesigns Executive Club App with Predictive Features', aiSummary: 'BA rebuilt their loyalty app with ML-powered travel predictions, proactive disruption alerts and one-tap rebooking. Clean UX and strong personalization.', sentiment: 'neutral', category: 'innovation', impact: 'medium' },
    { id: 'intel-6', source: 'social', competitor: 'Qatar Airways', date: '2026-03-04', title: 'Qatar posts behind-the-scenes of Qsuite Next Gen', aiSummary: 'Social campaign teasing next-generation Qsuite with holographic displays and AI mood lighting. Generated 50K+ engagement in 24 hours.', sentiment: 'negative', category: 'experience', impact: 'low' },
    { id: 'intel-7', source: 'press', competitor: 'Etihad Airways', date: '2026-03-03', title: 'Etihad Greenliner achieves 30% fuel reduction milestone', aiSummary: 'Sustainability narrative continues to strengthen. Etihad positions eco-conscious messaging prominently in all customer-facing communications.', sentiment: 'neutral', category: 'partnership', impact: 'low' },
    { id: 'intel-8', source: 'email', competitor: 'Singapore Airlines', date: '2026-03-02', title: 'KrisFlyer: "Your Year in Review — Personalized"', aiSummary: 'Singapore Airlines sent hyper-personalized year-in-review emails with travel stats, CO2 offset impact, and tailored upgrade offers. Best-in-class email personalization.', sentiment: 'negative', category: 'innovation', impact: 'medium' },
  ],
  swot: {
    strengths: [
      { id: 's1', description: 'Skywards is one of the largest loyalty programs globally with 30M+ members', evidence: 'Internal data — larger base than Qatar (12M) and Etihad (8M)', priority: 'high' },
      { id: 's2', description: 'Unmatched fleet diversity (A380, 777X) enables premium cabin differentiation', evidence: 'No competitor matches the A380 first-class suite offering', priority: 'high' },
      { id: 's3', description: 'Dubai hub connectivity — 260+ destinations with strong 6th freedom traffic', evidence: 'Turkish has more destinations (340+) but Emirates has stronger premium mix', priority: 'medium' },
    ],
    weaknesses: [
      { id: 'w1', description: 'Skywards digital experience lags behind competitor loyalty apps', evidence: 'Qatar AI concierge, BA predictive app, Etihad dynamic pricing — Emirates app unchanged in 18 months', priority: 'high' },
      { id: 'w2', description: 'Limited earn-outside-flying partnerships in GCC market', evidence: 'Turkish expanded to 15 new retail partners; Emirates has minimal local earn options', priority: 'high' },
      { id: 'w3', description: 'Post-flight engagement loop is reactive, not proactive', evidence: 'Singapore Airlines closes NPS loop in 2 hours; Emirates survey arrives 72h+ after flight', priority: 'medium' },
    ],
    opportunities: [
      { id: 'o1', description: 'Launch AI-powered personalization in Skywards app and email campaigns', evidence: 'Qatar and BA have moved first, but neither has scaled it to email marketing yet', priority: 'high' },
      { id: 'o2', description: 'Build GCC earn ecosystem with retail, dining, and lifestyle partners', evidence: 'Turkish success with Miles&Smiles retail shows 20% higher engagement from non-flight earners', priority: 'high' },
      { id: 'o3', description: 'Implement real-time NPS feedback loop with automated recovery emails', evidence: 'Singapore Airlines model proven to increase repeat booking by 15%', priority: 'medium' },
      { id: 'o4', description: 'Create hyper-personalized year-in-review and milestone campaigns', evidence: 'SIA year-in-review email achieved 62% open rate — 3x industry average', priority: 'medium' },
    ],
    threats: [
      { id: 't1', description: 'Qatar AI concierge could redefine loyalty engagement expectations', evidence: 'If members expect AI-driven experiences, Skywards risks feeling outdated', priority: 'high' },
      { id: 't2', description: 'Etihad dynamic pricing may attract price-sensitive premium travelers', evidence: 'Dynamic redemption pricing creates perception of better value vs fixed tables', priority: 'high' },
    ],
  },
  actionableOpportunities: [
    { id: 'opp-1', title: 'AI Personalization Engine for Email Campaigns', description: 'Use Claude to generate personalized subject lines, content blocks, and offers based on member travel history and tier. Start with top 3 BAU types.', impact: 'high', effort: 'medium', inspiredBy: 'Qatar Airways', area: 'digital' },
    { id: 'opp-2', title: 'GCC Retail Earn Partnership Program', description: 'Partner with 10+ GCC retailers, restaurants, and hotels to allow Skywards mile earning outside flights. Target 20% engagement lift.', impact: 'high', effort: 'high', inspiredBy: 'Turkish Airlines', area: 'loyalty' },
    { id: 'opp-3', title: 'Real-Time NPS Recovery Loop', description: 'Trigger personalized recovery email within 2 hours of negative NPS score. Include upgrade offer or lounge pass for next flight.', impact: 'medium', effort: 'low', inspiredBy: 'Singapore Airlines', area: 'experience' },
    { id: 'opp-4', title: 'Skywards Year-in-Review Campaign', description: 'Hyper-personalized annual email with travel stats, CO2 impact, tier progress, and tailored upgrade offers. Target 50%+ open rate.', impact: 'medium', effort: 'medium', inspiredBy: 'Singapore Airlines', area: 'digital' },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// 15. Marina — Documentation Agent
// ═══════════════════════════════════════════════════════════════════════════════
export const marinaData = {
  kpis: {
    auditedCampaigns: 31,
    outdatedDocs: 7,
    missingDocs: 4,
    coverageScore: 65,
  },
  auditHistory: [
    { id: 'ah1', runDate: '2026-03-10', scope: 'All lifecycle campaigns', total: 31, outdated: 7, missing: 4, score: 65 },
    { id: 'ah2', runDate: '2026-02-24', scope: 'Active campaigns only', total: 18, outdated: 5, missing: 2, score: 72 },
    { id: 'ah3', runDate: '2026-02-10', scope: 'BAU types full scan', total: 20, outdated: 3, missing: 1, score: 80 },
  ],
  coverageByGroup: [
    { group: 'Abandon & Recovery', total: 4, documented: 4, score: 100 },
    { group: 'Pre-Flight Journey', total: 4, documented: 3, score: 75 },
    { group: 'Post-Flight Engagement', total: 3, documented: 2, score: 67 },
    { group: 'Loyalty & Tiers', total: 9, documented: 5, score: 56 },
    { group: 'Onboarding', total: 4, documented: 4, score: 100 },
    { group: 'Communications', total: 3, documented: 1, score: 33 },
  ],
  outdatedFindings: [
    { id: 'f1', campaign: 'Birthday Rewards Email', group: 'Loyalty & Tiers', issue: 'KPI mismatch — open rate in doc (22%) vs actual (35%)', severity: 'high', lastUpdated: '2025-12-01', docPage: 'confluence://campaigns/birthday-rewards' },
    { id: 'f2', campaign: 'Companion Fare Promo', group: 'Loyalty & Tiers', issue: 'Status mismatch — doc says "draft", campaign is live', severity: 'high', lastUpdated: '2025-11-15', docPage: 'confluence://campaigns/companion-fare' },
    { id: 'f3', campaign: 'Re-engagement 90d', group: 'Post-Flight Engagement', issue: 'Trigger config changed — not reflected in doc', severity: 'medium', lastUpdated: '2026-01-10', docPage: 'confluence://campaigns/re-engagement-90d' },
    { id: 'f4', campaign: 'Skywards Gold Upgrade', group: 'Loyalty & Tiers', issue: 'Audience spec outdated — segment rebuilt in Jan 2026', severity: 'medium', lastUpdated: '2025-12-20', docPage: 'confluence://campaigns/gold-upgrade' },
    { id: 'f5', campaign: 'Flash Sale Weekend', group: 'Abandon & Recovery', issue: 'No KPI targets documented', severity: 'low', lastUpdated: '2026-02-01', docPage: 'confluence://campaigns/flash-sale' },
    { id: 'f6', campaign: 'NPS Survey Q1', group: 'Post-Flight Engagement', issue: 'Missing channel config (push added, doc only shows email)', severity: 'low', lastUpdated: '2026-01-28', docPage: 'confluence://campaigns/nps-survey' },
    { id: 'f7', campaign: 'Route Launch DXB-MAN', group: 'Pre-Flight Journey', issue: 'ROI targets stale — Q4 actuals not recorded', severity: 'medium', lastUpdated: '2025-12-05', docPage: 'confluence://campaigns/dxb-man' },
  ],
  gapFindings: [
    { id: 'g1', campaign: 'Marriott Partner Campaign', group: 'Communications', reason: 'No Confluence page found for this campaign' },
    { id: 'g2', campaign: 'Loyalty Tier Expire Reminder', group: 'Loyalty & Tiers', reason: 'New campaign — no doc created yet' },
    { id: 'g3', campaign: 'Summer Splash Promo', group: 'Abandon & Recovery', reason: 'Campaign created from template, no standalone doc' },
    { id: 'g4', campaign: 'DXB-LHR Route Reactivation', group: 'Pre-Flight Journey', reason: 'Archived page — cannot be found or accessed' },
  ],
};
