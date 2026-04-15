import { BAU_CAMPAIGN_TYPES, BAU_CATEGORIES } from '../data/emiratesBauTypes.js';
import { CAMPAIGNS, CAMPAIGN_GROUPS } from '../data/emiratesCampaigns.js';

const ALWAYS_ON_GROUPS = new Set(['abandon-recovery', 'preflight-journey', 'postflight-engagement']);
const FIXED_SCHEDULES = {
  'statement-email': { dayOfMonth: 14, group: 'communications', channel: 'email' },
};

function inRange(isoDate, start, end) {
  return isoDate >= start && isoDate <= end;
}

function toIsoDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function lifecycleColor(groupId) {
  const g = CAMPAIGN_GROUPS.find(cg => cg.id === groupId);
  return g?.color || '#94a3b8';
}

function bauColor(categoryId) {
  return BAU_CATEGORIES[categoryId]?.color || '#94a3b8';
}

function emitScheduledBau(range, out) {
  for (const type of BAU_CAMPAIGN_TYPES) {
    for (const c of type.recentCampaigns || []) {
      if (!inRange(c.date, range.start, range.end)) continue;
      out.push({
        id: `${type.id}-${c.date}`,
        campaignId: type.id,
        campaignName: c.name,
        group: type.category,
        flavor: 'scheduled',
        startDate: c.date,
        endDate: c.date,
        channel: 'email',
        segment: (type.defaultSegments && type.defaultSegments[0]) || '',
        language: 'EN+AR',
        color: bauColor(type.category),
        kpis: { openRate: c.openRate, ctr: c.ctr, conversions: c.conversions },
        status: c.status,
      });
    }
  }
}

function emitFixed(range, out) {
  const start = new Date(range.start);
  const end = new Date(range.end);
  for (const [campaignId, cfg] of Object.entries(FIXED_SCHEDULES)) {
    const iter = new Date(start.getFullYear(), start.getMonth(), 1);
    while (iter <= end) {
      const fixedDate = new Date(iter.getFullYear(), iter.getMonth(), cfg.dayOfMonth);
      const iso = toIsoDate(fixedDate);
      if (inRange(iso, range.start, range.end)) {
        const source = CAMPAIGNS.find(c => c.id === campaignId);
        out.push({
          id: `${campaignId}-${iso}`,
          campaignId,
          campaignName: source?.name || campaignId,
          group: cfg.group,
          flavor: 'fixed',
          startDate: iso,
          endDate: iso,
          channel: cfg.channel,
          segment: source?.audience || '',
          language: 'EN+AR',
          color: lifecycleColor(cfg.group),
          kpis: source?.kpis || null,
          status: 'scheduled',
        });
      }
      iter.setMonth(iter.getMonth() + 1);
    }
  }
}

function emitAlwaysOn(range, out) {
  for (const c of CAMPAIGNS) {
    if (!ALWAYS_ON_GROUPS.has(c.group)) continue;
    if (c.status !== 'live') continue;
    out.push({
      id: `${c.id}-alwayson-${range.start}`,
      campaignId: c.id,
      campaignName: c.name,
      group: c.group,
      flavor: 'always-on',
      startDate: range.start,
      endDate: range.end,
      channel: c.channel,
      segment: c.audience,
      language: 'EN+AR',
      color: lifecycleColor(c.group),
      kpis: c.kpis,
      status: 'live',
      projectedVolume: c.kpis?.sends || 0,
    });
  }
}

export function buildCalendarEvents(startDate, endDate) {
  const range = { start: startDate, end: endDate };
  const out = [];
  emitScheduledBau(range, out);
  emitFixed(range, out);
  emitAlwaysOn(range, out);
  return out;
}
