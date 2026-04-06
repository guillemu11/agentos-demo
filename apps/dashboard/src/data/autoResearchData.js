// apps/dashboard/src/data/autoResearchData.js

export const EXPERIMENTS = [
  {
    id: 'exp-miles-expiry-14',
    campaignId: 'wa-miles-expiry',
    campaignName: 'Miles Expiry',
    channel: 'whatsapp',
    runNumber: 14,
    status: 'running',
    metric: 'responseRate',
    metricLabel: 'Response Rate',
    windowHours: 24,
    hoursRemaining: 2.25,
    hypothesis: 'Leading with name + exact destination increases urgency perception',
    baseline: { text: 'Your 87,500 miles expire in 7 days. Don\'t let them go to waste...', value: 12.3 },
    challenger: { text: '⚠️ Ahmed — 87,500 miles vanish in 7 days. That\'s a free LHR flight...', value: 18.7 },
  },
  {
    id: 'exp-cart-abandon-7',
    campaignId: 'wa-cart-abandon',
    campaignName: 'Cart Abandon',
    channel: 'whatsapp',
    runNumber: 7,
    status: 'collecting',
    metric: 'ctaClickRate',
    metricLabel: 'CTA Click Rate',
    windowHours: 24,
    hoursRemaining: 5.67,
    hypothesis: 'Scarcity signal ("4 seats left") outperforms generic price warning',
    baseline: { text: 'You left a flight to London in your cart. Prices may change...', value: 9.1 },
    challenger: { text: '✈️ James — only 4 seats left at £892 on your DXB→LHR search.', value: 11.2 },
  },
];

export const KNOWLEDGE_BASE = [
  { id: 'kb-1', tag: 'copy', text: "Opening with member's name + exact miles balance outperforms generic openers", lift: '+28%', runCount: 8 },
  { id: 'kb-2', tag: 'timing', text: 'Thursday sends 09:00–11:00 GST get 2× the response rate of Monday sends', lift: '2×', runCount: 5 },
  { id: 'kb-3', tag: 'format', text: '3 quick-reply buttons outperform 4+ options — too many choices reduce response rate', lift: '+17%', runCount: 6 },
  { id: 'kb-4', tag: 'cta', text: 'Destination-specific CTA ("Redeem DXB→LHR") converts better than generic ("View options")', lift: '+34%', runCount: 4 },
  { id: 'kb-5', tag: 'copy', text: 'Messages under 60 words get higher response — longer copy drops after line 2', lift: '+12%', runCount: 7 },
];

export const EXPERIMENT_LOG = [
  { id: 'log-1', campaignName: 'Miles Expiry', channel: 'whatsapp', runNumber: 13, outcome: 'challenger_promoted', delta: '+5.1%' },
  { id: 'log-2', campaignName: 'Miles Expiry', channel: 'whatsapp', runNumber: 12, outcome: 'baseline_kept', delta: '-1.2%' },
  { id: 'log-3', campaignName: 'Cart Abandon', channel: 'whatsapp', runNumber: 6, outcome: 'challenger_promoted', delta: '+3.8%' },
  { id: 'log-4', campaignName: 'Postflight NPS', channel: 'whatsapp', runNumber: 5, outcome: 'challenger_promoted', delta: '+8.4%' },
  { id: 'log-5', campaignName: 'Miles Expiry', channel: 'whatsapp', runNumber: 11, outcome: 'baseline_kept', delta: '-0.7%' },
  { id: 'log-6', campaignName: 'Preflight Ancillary', channel: 'whatsapp', runNumber: 2, outcome: 'inconclusive', delta: '+0.3%' },
];

// Miles Expiry response rate over 14 iterations
export const CHART_DATA = [
  { run: 1, value: 8.1, promoted: false },
  { run: 2, value: 8.9, promoted: false },
  { run: 3, value: 9.8, promoted: true },
  { run: 4, value: 11.2, promoted: true },
  { run: 5, value: 10.7, promoted: false },
  { run: 6, value: 12.1, promoted: true },
  { run: 7, value: 13.4, promoted: true },
  { run: 8, value: 13.1, promoted: false },
  { run: 9, value: 14.6, promoted: true },
  { run: 10, value: 15.8, promoted: true },
  { run: 11, value: 15.2, promoted: false },
  { run: 12, value: 16.9, promoted: true },
  { run: 13, value: 17.8, promoted: true },
  { run: 14, value: 18.7, promoted: true },
];

export const CAMPAIGN_QUEUE = [
  { campaignId: 'wa-miles-expiry', name: 'Miles Expiry', channel: 'whatsapp', runNumber: 14, status: 'running' },
  { campaignId: 'wa-cart-abandon', name: 'Cart Abandon', channel: 'whatsapp', runNumber: 7, status: 'collecting' },
  { campaignId: 'wa-postflight-nps', name: 'Postflight NPS', channel: 'whatsapp', runNumber: 5, status: 'collecting' },
  { campaignId: 'wa-preflight-ancillary', name: 'Preflight Ancillary', channel: 'whatsapp', runNumber: 3, status: 'queued' },
];
