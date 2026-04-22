// Mock signals that power the "AI opportunity" briefs.
// Replace with real data sources (MC analytics, Competitor Intel, segment API)
// once those connections land.

export const MOCK_SIGNALS = [
  {
    type: 'dormant_segment',
    brief_template: 'lifecycle-winback',
    payload: { segment: 'Silver DE', size: 31200, days_since_last_open: 94 },
  },
  {
    type: 'dormant_segment',
    brief_template: 'lifecycle-winback',
    payload: { segment: 'Gold UK', size: 8400, days_since_last_open: 112 },
  },
  {
    type: 'cart_abandon_spike',
    brief_template: 'recovery-offer',
    payload: { route: 'DXB-LHR', users: 2140, dropoff_step: 'payment' },
  },
  {
    type: 'cart_abandon_spike',
    brief_template: 'recovery-offer',
    payload: { route: 'DXB-CDG', users: 1480, dropoff_step: 'seat-select' },
  },
  {
    type: 'new_route_window',
    brief_template: 'route-launch',
    payload: { route: 'DXB-MXP', launch_date: '2026-05-10', addressable_audience: 42000 },
  },
  {
    type: 'new_route_window',
    brief_template: 'route-launch',
    payload: { route: 'DXB-BOG', launch_date: '2026-06-01', addressable_audience: 28000 },
  },
  {
    type: 'ctr_decline',
    brief_template: 'engagement-broadcast',
    payload: { market: 'FR', delta_pct: -18, window_days: 30 },
  },
  {
    type: 'ctr_decline',
    brief_template: 'engagement-broadcast',
    payload: { market: 'DE', delta_pct: -12, window_days: 30 },
  },
  {
    type: 'seasonal_window',
    brief_template: 'offers-promotion',
    payload: { occasion: 'Eid al-Fitr', markets: ['AE', 'SA', 'KW'], days_until: 14 },
  },
  {
    type: 'seasonal_window',
    brief_template: 'offers-promotion',
    payload: { occasion: 'Summer 2026', markets: ['UK', 'DE', 'FR'], days_until: 42 },
  },
];

function signalKey(s) {
  return `${s.type}|${JSON.stringify(s.payload)}`;
}

export function pickRandomSignals(n, exclude = []) {
  const excludedKeys = new Set(exclude.filter(Boolean).map(signalKey));
  const available = MOCK_SIGNALS.filter(s => !excludedKeys.has(signalKey(s)));
  const shuffled = [...available].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}
