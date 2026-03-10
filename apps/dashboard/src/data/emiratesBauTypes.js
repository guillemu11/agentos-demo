// Emirates BAU (Business As Usual) Campaign Types
// Mirrors the real SFMC campaign folder structure

export const BAU_CATEGORIES = {
  broadcast: { id: 'broadcast', name: 'Broadcast', icon: '📢', color: '#D71920' },
  offers: { id: 'offers', name: 'Offers & Promotions', icon: '🏷️', color: '#D4AF37' },
  partner: { id: 'partner', name: 'Partner Programs', icon: '🤝', color: '#6366f1' },
  route: { id: 'route', name: 'Route Launch', icon: '✈️', color: '#10b981' },
  lifecycle: { id: 'lifecycle', name: 'Lifecycle & Operational', icon: '🔄', color: '#06b6d4' },
  engagement: { id: 'engagement', name: 'Engagement & Research', icon: '📊', color: '#f59e0b' },
};

export const BAU_CAMPAIGN_TYPES = [
  // ── Broadcast ──────────────────────────────────────────────
  {
    id: 'broadcast-emirates',
    name: 'BroadCast Emirates',
    category: 'broadcast',
    frequency: 'weekly',
    complexity: 'medium',
    typicalAgents: ['campaign-manager', 'content-agent', 'segmentation-agent', 'brand-guardian', 'qa-agent', 'calendar-agent'],
    defaultSegments: ['All Active Skywards', 'Tier-based'],
    description: 'General Emirates brand communications to full subscriber base',
    recentCampaigns: [
      { name: 'March Brand Highlights', status: 'launched', date: '2026-03-03', openRate: 29.1, ctr: 3.4, conversions: 4100 },
      { name: 'February Brand Recap', status: 'launched', date: '2026-02-03', openRate: 27.8, ctr: 3.1, conversions: 3800 },
      { name: 'January New Year', status: 'launched', date: '2026-01-06', openRate: 31.2, ctr: 3.7, conversions: 4500 },
    ],
    performanceHistory: [
      { month: 'Jan', openRate: 31.2, ctr: 3.7 },
      { month: 'Feb', openRate: 27.8, ctr: 3.1 },
      { month: 'Mar', openRate: 29.1, ctr: 3.4 },
    ],
  },
  {
    id: 'broadcast-operational',
    name: 'BroadCast Operational',
    category: 'broadcast',
    frequency: 'as-needed',
    complexity: 'low',
    typicalAgents: ['campaign-manager', 'content-agent', 'legal-agent', 'qa-agent'],
    defaultSegments: ['All Active', 'Affected Routes'],
    description: 'Operational updates — schedule changes, policy updates, service advisories',
    recentCampaigns: [
      { name: 'T3 Lounge Renovation Notice', status: 'launched', date: '2026-02-18', openRate: 42.3, ctr: 1.8, conversions: 0 },
      { name: 'Baggage Policy Update', status: 'launched', date: '2026-01-22', openRate: 38.7, ctr: 2.1, conversions: 0 },
    ],
    performanceHistory: [
      { month: 'Jan', openRate: 38.7, ctr: 2.1 },
      { month: 'Feb', openRate: 42.3, ctr: 1.8 },
      { month: 'Mar', openRate: 40.1, ctr: 1.9 },
    ],
  },
  {
    id: 'newsletter',
    name: 'Newsletter',
    category: 'broadcast',
    frequency: 'weekly',
    complexity: 'medium',
    typicalAgents: ['campaign-manager', 'content-agent', 'segmentation-agent', 'brand-guardian', 'calendar-agent', 'qa-agent'],
    defaultSegments: ['Newsletter Subscribers', 'Tier-based'],
    description: 'Regular newsletter with curated content, deals, and destination inspiration',
    recentCampaigns: [
      { name: 'March W1 Newsletter', status: 'launched', date: '2026-03-07', openRate: 32.4, ctr: 4.5, conversions: 2200 },
      { name: 'Feb W4 Newsletter', status: 'launched', date: '2026-02-28', openRate: 30.8, ctr: 4.1, conversions: 1900 },
      { name: 'Feb W3 Newsletter', status: 'launched', date: '2026-02-21', openRate: 31.1, ctr: 4.3, conversions: 2100 },
    ],
    performanceHistory: [
      { month: 'Jan', openRate: 30.2, ctr: 4.0 },
      { month: 'Feb', openRate: 31.0, ctr: 4.2 },
      { month: 'Mar', openRate: 32.4, ctr: 4.5 },
    ],
  },
  {
    id: 'occasional-announcement',
    name: 'Occasional Announcement',
    category: 'broadcast',
    frequency: 'as-needed',
    complexity: 'medium',
    typicalAgents: ['campaign-manager', 'content-agent', 'brand-guardian', 'legal-agent', 'qa-agent'],
    defaultSegments: ['All Active', 'Tier-based'],
    description: 'Ad-hoc announcements — awards, milestones, CEO messages',
    recentCampaigns: [
      { name: 'World\'s Best Airline Award', status: 'launched', date: '2026-02-10', openRate: 48.1, ctr: 5.2, conversions: 1200 },
    ],
    performanceHistory: [
      { month: 'Jan', openRate: 44.0, ctr: 4.8 },
      { month: 'Feb', openRate: 48.1, ctr: 5.2 },
    ],
  },
  {
    id: 'single-region',
    name: 'Single Region',
    category: 'broadcast',
    frequency: 'weekly',
    complexity: 'medium',
    typicalAgents: ['campaign-manager', 'content-agent', 'segmentation-agent', 'brand-guardian', 'legal-agent', 'calendar-agent', 'qa-agent'],
    defaultSegments: ['Region-specific', 'Market Language'],
    description: 'Geo-targeted campaigns for specific market regions',
    recentCampaigns: [
      { name: 'DACH Spring Getaway', status: 'launched', date: '2026-03-01', openRate: 26.4, ctr: 3.8, conversions: 1800 },
      { name: 'France Ski Season', status: 'launched', date: '2026-02-15', openRate: 28.9, ctr: 4.2, conversions: 2100 },
    ],
    performanceHistory: [
      { month: 'Jan', openRate: 25.8, ctr: 3.5 },
      { month: 'Feb', openRate: 28.9, ctr: 4.2 },
      { month: 'Mar', openRate: 26.4, ctr: 3.8 },
    ],
  },
  {
    id: 'special-announcement',
    name: 'Special Announcement',
    category: 'broadcast',
    frequency: 'as-needed',
    complexity: 'high',
    typicalAgents: ['campaign-manager', 'content-agent', 'brand-guardian', 'legal-agent', 'qa-agent', 'cloud-architect'],
    defaultSegments: ['All Active', 'VIP Tier'],
    description: 'High-priority brand announcements — new aircraft, major partnerships',
    recentCampaigns: [
      { name: 'New A350 Fleet Announcement', status: 'brief', date: '2026-04-15', openRate: 0, ctr: 0, conversions: 0 },
      { name: 'Dubai-Singapore A380 Return', status: 'launched', date: '2026-01-20', openRate: 52.3, ctr: 6.1, conversions: 3200 },
    ],
    performanceHistory: [
      { month: 'Jan', openRate: 52.3, ctr: 6.1 },
      { month: 'Feb', openRate: 49.0, ctr: 5.5 },
    ],
  },

  // ── Offers & Promotions ────────────────────────────────────
  {
    id: 'event-offer',
    name: 'Event Offer',
    category: 'offers',
    frequency: 'monthly',
    complexity: 'high',
    typicalAgents: ['campaign-manager', 'content-agent', 'segmentation-agent', 'brand-guardian', 'legal-agent', 'calendar-agent', 'qa-agent'],
    defaultSegments: ['Event Interest', 'Geo-targeted'],
    description: 'Promotional offers tied to events — concerts, exhibitions, sporting events',
    recentCampaigns: [
      { name: 'Dubai Expo 2026 Packages', status: 'content', date: '2026-04-01', openRate: 0, ctr: 0, conversions: 0 },
      { name: 'F1 Abu Dhabi GP Offer', status: 'launched', date: '2026-02-20', openRate: 38.4, ctr: 6.8, conversions: 4200 },
    ],
    performanceHistory: [
      { month: 'Jan', openRate: 35.1, ctr: 5.9 },
      { month: 'Feb', openRate: 38.4, ctr: 6.8 },
    ],
  },
  {
    id: 'holiday-offer',
    name: 'Holiday Offer',
    category: 'offers',
    frequency: 'seasonal',
    complexity: 'high',
    typicalAgents: ['campaign-manager', 'content-agent', 'segmentation-agent', 'brand-guardian', 'legal-agent', 'calendar-agent', 'automation-architect', 'qa-agent'],
    defaultSegments: ['Holiday Travelers', 'Family Segment', 'Seasonal Destination Interest'],
    description: 'Seasonal holiday promotional campaigns — Ramadan, Christmas, Summer, Eid',
    recentCampaigns: [
      { name: 'Ramadan 2026 Special Fares', status: 'content', date: '2026-03-20', openRate: 0, ctr: 0, conversions: 0 },
      { name: 'Christmas Getaway 2025', status: 'launched', date: '2025-12-01', openRate: 36.7, ctr: 7.2, conversions: 5800 },
    ],
    performanceHistory: [
      { month: 'Dec', openRate: 36.7, ctr: 7.2 },
      { month: 'Jan', openRate: 33.4, ctr: 6.1 },
      { month: 'Mar', openRate: 35.2, ctr: 6.8 },
    ],
  },
  {
    id: 'product-offer',
    name: 'Product Offer',
    category: 'offers',
    frequency: 'bi-weekly',
    complexity: 'medium',
    typicalAgents: ['campaign-manager', 'content-agent', 'segmentation-agent', 'brand-guardian', 'qa-agent'],
    defaultSegments: ['Product Interest', 'Upgrade Propensity'],
    description: 'Product-specific offers — class upgrades, lounge access, extra baggage',
    recentCampaigns: [
      { name: 'Spring Flash Sale', status: 'brief', date: '2026-04-05', openRate: 0, ctr: 0, conversions: 0 },
      { name: 'Business Class Upgrade Promo', status: 'launched', date: '2026-02-28', openRate: 34.2, ctr: 5.4, conversions: 3100 },
    ],
    performanceHistory: [
      { month: 'Jan', openRate: 32.1, ctr: 4.9 },
      { month: 'Feb', openRate: 34.2, ctr: 5.4 },
      { month: 'Mar', openRate: 33.8, ctr: 5.1 },
    ],
  },

  // ── Partner Programs ───────────────────────────────────────
  {
    id: 'partner-acquisition',
    name: 'Partner Acquisition',
    category: 'partner',
    frequency: 'quarterly',
    complexity: 'medium',
    typicalAgents: ['campaign-manager', 'content-agent', 'segmentation-agent', 'legal-agent', 'brand-guardian', 'qa-agent'],
    defaultSegments: ['Partner Prospect', 'High-Value Members'],
    description: 'Recruit new partners into the Skywards ecosystem',
    recentCampaigns: [
      { name: 'Q1 Partner Recruitment Drive', status: 'launched', date: '2026-01-15', openRate: 22.1, ctr: 3.2, conversions: 890 },
    ],
    performanceHistory: [
      { month: 'Jan', openRate: 22.1, ctr: 3.2 },
    ],
  },
  {
    id: 'partner-launch',
    name: 'Partner Launch',
    category: 'partner',
    frequency: 'quarterly',
    complexity: 'high',
    typicalAgents: ['campaign-manager', 'content-agent', 'segmentation-agent', 'brand-guardian', 'legal-agent', 'calendar-agent', 'automation-architect', 'qa-agent'],
    defaultSegments: ['All Skywards', 'Partner Category Interest'],
    description: 'Announce new partner brand joining the loyalty network',
    recentCampaigns: [
      { name: 'Marriott Bonvoy Partnership', status: 'launched', date: '2026-02-28', openRate: 35.8, ctr: 5.1, conversions: 2800 },
    ],
    performanceHistory: [
      { month: 'Feb', openRate: 35.8, ctr: 5.1 },
    ],
  },
  {
    id: 'partner-offer',
    name: 'Partner Offer',
    category: 'partner',
    frequency: 'monthly',
    complexity: 'medium',
    typicalAgents: ['campaign-manager', 'content-agent', 'segmentation-agent', 'brand-guardian', 'legal-agent', 'qa-agent'],
    defaultSegments: ['Partner Engaged', 'Tier-based'],
    description: 'Promotional offers from existing partners',
    recentCampaigns: [
      { name: 'Hertz Partner Offer', status: 'content', date: '2026-03-22', openRate: 0, ctr: 0, conversions: 0 },
      { name: 'Avis Weekend Special', status: 'launched', date: '2026-02-14', openRate: 24.9, ctr: 3.9, conversions: 1400 },
    ],
    performanceHistory: [
      { month: 'Jan', openRate: 23.5, ctr: 3.6 },
      { month: 'Feb', openRate: 24.9, ctr: 3.9 },
    ],
  },
  {
    id: 'partner-offer-promotion',
    name: 'Partner Offer Promotion',
    category: 'partner',
    frequency: 'bi-weekly',
    complexity: 'medium',
    typicalAgents: ['campaign-manager', 'content-agent', 'segmentation-agent', 'brand-guardian', 'qa-agent'],
    defaultSegments: ['Partner Engaged', 'Recent Purchasers'],
    description: 'Time-limited partner promotional pushes',
    recentCampaigns: [
      { name: 'Avis Flash Promo', status: 'qa', date: '2026-03-25', openRate: 0, ctr: 0, conversions: 0 },
      { name: 'Hilton Double Points', status: 'launched', date: '2026-02-20', openRate: 26.3, ctr: 4.1, conversions: 1700 },
    ],
    performanceHistory: [
      { month: 'Jan', openRate: 25.0, ctr: 3.8 },
      { month: 'Feb', openRate: 26.3, ctr: 4.1 },
    ],
  },

  // ── Route Launch ───────────────────────────────────────────
  {
    id: 'route-launch-new',
    name: 'Route Launch (new)',
    category: 'route',
    frequency: 'as-needed',
    complexity: 'very-high',
    typicalAgents: ['campaign-manager', 'content-agent', 'segmentation-agent', 'brand-guardian', 'legal-agent', 'calendar-agent', 'automation-architect', 'cloud-architect', 'qa-agent', 'analytics-agent'],
    defaultSegments: ['Origin City Residents', 'Destination Interest', 'Business Travelers'],
    description: 'Launch of completely new route — full multi-wave campaign',
    recentCampaigns: [
      { name: 'DXB-MAN Route Launch', status: 'qa', date: '2026-03-28', openRate: 0, ctr: 0, conversions: 0 },
      { name: 'DXB-Prague Launch', status: 'launched', date: '2026-01-10', openRate: 44.8, ctr: 7.8, conversions: 3400 },
    ],
    performanceHistory: [
      { month: 'Jan', openRate: 44.8, ctr: 7.8 },
      { month: 'Feb', openRate: 42.1, ctr: 7.2 },
    ],
  },
  {
    id: 'route-launch-inbound',
    name: 'Route Launch Inbound',
    category: 'route',
    frequency: 'as-needed',
    complexity: 'high',
    typicalAgents: ['campaign-manager', 'content-agent', 'segmentation-agent', 'brand-guardian', 'legal-agent', 'calendar-agent', 'qa-agent'],
    defaultSegments: ['Destination City Residents', 'Inbound Interest'],
    description: 'Route launch targeting inbound market — destination to Dubai',
    recentCampaigns: [
      { name: 'MAN-DXB Inbound Wave', status: 'brief', date: '2026-03-14', openRate: 0, ctr: 0, conversions: 0 },
      { name: 'Prague-DXB Inbound', status: 'launched', date: '2026-01-18', openRate: 39.2, ctr: 6.4, conversions: 2100 },
    ],
    performanceHistory: [
      { month: 'Jan', openRate: 39.2, ctr: 6.4 },
    ],
  },
  {
    id: 'route-launch-outbound',
    name: 'Route Launch Outbound',
    category: 'route',
    frequency: 'as-needed',
    complexity: 'high',
    typicalAgents: ['campaign-manager', 'content-agent', 'segmentation-agent', 'brand-guardian', 'legal-agent', 'calendar-agent', 'qa-agent'],
    defaultSegments: ['Dubai Residents', 'Origin Market Travelers'],
    description: 'Route launch targeting outbound market — Dubai to new destination',
    recentCampaigns: [
      { name: 'DXB-MAN Outbound Wave 2', status: 'brief', date: '2026-03-28', openRate: 0, ctr: 0, conversions: 0 },
      { name: 'DXB-Prague Outbound', status: 'launched', date: '2026-01-25', openRate: 36.5, ctr: 5.9, conversions: 2600 },
    ],
    performanceHistory: [
      { month: 'Jan', openRate: 36.5, ctr: 5.9 },
    ],
  },

  // ── Lifecycle & Operational ────────────────────────────────
  {
    id: 'product-update',
    name: 'Product Update',
    category: 'lifecycle',
    frequency: 'monthly',
    complexity: 'low',
    typicalAgents: ['campaign-manager', 'content-agent', 'brand-guardian', 'qa-agent'],
    defaultSegments: ['All Active', 'Product Users'],
    description: 'Updates on product changes — new IFE, seat upgrades, service enhancements',
    recentCampaigns: [
      { name: 'New ICE System Launch', status: 'launched', date: '2026-02-25', openRate: 33.1, ctr: 2.8, conversions: 0 },
    ],
    performanceHistory: [
      { month: 'Jan', openRate: 31.5, ctr: 2.5 },
      { month: 'Feb', openRate: 33.1, ctr: 2.8 },
    ],
  },
  {
    id: 'new-language-pref',
    name: 'New Language Pref',
    category: 'lifecycle',
    frequency: 'as-needed',
    complexity: 'low',
    typicalAgents: ['campaign-manager', 'content-agent', 'segmentation-agent', 'automation-architect', 'qa-agent'],
    defaultSegments: ['Language Preference Updated'],
    description: 'Re-engagement after member updates language preference',
    recentCampaigns: [
      { name: 'Arabic Language Welcome', status: 'launched', date: '2026-03-02', openRate: 41.2, ctr: 3.1, conversions: 450 },
    ],
    performanceHistory: [
      { month: 'Jan', openRate: 39.8, ctr: 2.9 },
      { month: 'Feb', openRate: 40.5, ctr: 3.0 },
      { month: 'Mar', openRate: 41.2, ctr: 3.1 },
    ],
  },
  {
    id: 'occasional-announcement-churn',
    name: 'Occasional Announcement Churn',
    category: 'lifecycle',
    frequency: 'as-needed',
    complexity: 'medium',
    typicalAgents: ['campaign-manager', 'content-agent', 'segmentation-agent', 'crm-agent', 'automation-architect', 'qa-agent'],
    defaultSegments: ['Churned Members', 'Lapsed 90d+'],
    description: 'Targeted announcements to win back churned or at-risk members',
    recentCampaigns: [
      { name: 'Win-Back Gold Lapsed', status: 'launched', date: '2026-02-12', openRate: 18.4, ctr: 2.8, conversions: 620 },
      { name: 'Silver Re-engage Q1', status: 'launched', date: '2026-01-20', openRate: 15.2, ctr: 2.1, conversions: 380 },
    ],
    performanceHistory: [
      { month: 'Jan', openRate: 15.2, ctr: 2.1 },
      { month: 'Feb', openRate: 18.4, ctr: 2.8 },
    ],
  },

  // ── Engagement & Research ──────────────────────────────────
  {
    id: 'survey',
    name: 'Survey',
    category: 'engagement',
    frequency: 'monthly',
    complexity: 'low',
    typicalAgents: ['campaign-manager', 'content-agent', 'segmentation-agent', 'automation-architect', 'analytics-agent', 'qa-agent'],
    defaultSegments: ['Post-Flight', 'NPS Target', 'Product Feedback'],
    description: 'Customer surveys — NPS, satisfaction, product feedback',
    recentCampaigns: [
      { name: 'Skywards Survey Q1', status: 'launched', date: '2026-03-01', openRate: 39.2, ctr: 12.4, conversions: 0 },
      { name: 'Post-Flight NPS Feb', status: 'launched', date: '2026-02-15', openRate: 37.8, ctr: 11.8, conversions: 0 },
    ],
    performanceHistory: [
      { month: 'Jan', openRate: 36.5, ctr: 11.2 },
      { month: 'Feb', openRate: 37.8, ctr: 11.8 },
      { month: 'Mar', openRate: 39.2, ctr: 12.4 },
    ],
  },
];

// ── Helpers ────────────────────────────────────────────────────
export const getBauTypeById = (id) => BAU_CAMPAIGN_TYPES.find(t => t.id === id);
export const getBauTypesByCategory = (cat) => BAU_CAMPAIGN_TYPES.filter(t => t.category === cat);
export const getBauCategoryById = (id) => BAU_CATEGORIES[id];
export const getAllBauCategories = () => Object.values(BAU_CATEGORIES);
