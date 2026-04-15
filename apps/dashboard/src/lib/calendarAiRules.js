// 2026 holiday calendar (subset relevant to Emirates markets)
const HOLIDAYS = [
  { name: 'Eid Al Fitr 2026', start: '2026-04-29', end: '2026-05-01', offerGroups: ['offers', 'partner'] },
  { name: 'Eid Al Adha 2026', start: '2026-07-06', end: '2026-07-09', offerGroups: ['offers', 'partner'] },
  { name: 'Christmas 2026', start: '2026-12-18', end: '2026-12-26', offerGroups: ['offers'] },
  { name: 'Ramadan Start 2026', start: '2026-03-20', end: '2026-03-20', offerGroups: ['offers'] },
];

const AR_REQUIRED_HINTS = [/dubai/i, /mena/i, /uae/i, /arab/i];
const TIER_SEGMENTS = ['Silver', 'Gold', 'Platinum', 'Premium Skywards'];
const COVERAGE_GAP_DAYS = 10;
const FREQUENCY_MULTIPLIER = 2;

const HIGH_PERFORMERS = [
  { tag: 'Tier upgrade celebration', openRate: 72, segment: 'Tier upgraded', group: 'loyalty-tiers' },
];

function daysBetween(isoA, isoB) {
  const a = new Date(isoA);
  const b = new Date(isoB);
  return Math.round((b - a) / 86400000);
}

function groupBy(arr, keyFn) {
  const m = new Map();
  for (const it of arr) {
    const k = keyFn(it);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(it);
  }
  return m;
}

function rangeOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart <= bEnd && bStart <= aEnd;
}

// ── Rule 1: Segment overload ─────────────────────────────────
export function detectSegmentOverload(events, range) {
  const scheduled = events.filter(e => e.flavor === 'scheduled' || e.flavor === 'fixed');
  const byDaySegment = groupBy(scheduled, e => `${e.startDate}|${e.segment}`);
  const hits = [];
  for (const [key, group] of byDaySegment) {
    if (group.length < 2) continue;
    const [date, segment] = key.split('|');
    hits.push({
      id: `seg-overload-${date}-${segment}`,
      type: 'risk',
      severity: group.length >= 3 ? 'high' : 'medium',
      ruleId: 'segmentOverload',
      dateRange: { start: date, end: date },
      campaignIds: group.map(e => e.campaignId),
      title: `${group.length} campaigns to ${segment} on ${date}`,
      rawEvidence: { segment, date, count: group.length, campaigns: group.map(e => e.campaignName) },
    });
  }
  return hits;
}

// ── Rule 2: BAU-Lifecycle collision ──────────────────────────
export function detectBauLifecycleCollision(events, range) {
  const bau = events.filter(e => e.flavor === 'scheduled' || e.flavor === 'fixed');
  const lifecycle = events.filter(e => e.flavor === 'always-on');
  const hits = [];
  for (const b of bau) {
    for (const l of lifecycle) {
      if (!rangeOverlap(b.startDate, b.endDate, l.startDate, l.endDate)) continue;
      if (!b.segment || !l.segment) continue;
      if (b.segment.toLowerCase() !== l.segment.toLowerCase()) continue;
      hits.push({
        id: `bau-life-${b.id}-${l.campaignId}`,
        type: 'risk',
        severity: 'medium',
        ruleId: 'bauLifecycleCollision',
        dateRange: { start: b.startDate, end: b.endDate },
        campaignIds: [b.campaignId, l.campaignId],
        title: `${b.campaignName} collides with ${l.campaignName} (same segment)`,
        rawEvidence: { bau: b.campaignName, lifecycle: l.campaignName, segment: b.segment },
      });
    }
  }
  return hits;
}

// ── Rule 3: Language imbalance ───────────────────────────────
export function detectLanguageImbalance(events, range) {
  const hits = [];
  for (const e of events) {
    if (e.flavor === 'always-on') continue;
    const needsAr = AR_REQUIRED_HINTS.some(rx => rx.test(e.segment || ''));
    const hasAr = (e.language || '').toUpperCase().includes('AR');
    if (needsAr && !hasAr) {
      hits.push({
        id: `lang-${e.id}`,
        type: 'risk',
        severity: 'medium',
        ruleId: 'languageImbalance',
        dateRange: { start: e.startDate, end: e.endDate },
        campaignIds: [e.campaignId],
        title: `${e.campaignName} missing AR version`,
        rawEvidence: { campaign: e.campaignName, segment: e.segment, language: e.language },
      });
    }
  }
  return hits;
}

// ── Rule 4: Coverage gap for tier segments ───────────────────
export function detectCoverageGap(events, range) {
  const hits = [];
  for (const tier of TIER_SEGMENTS) {
    const tierEvents = events
      .filter(e => (e.segment || '').toLowerCase().includes(tier.toLowerCase()))
      .filter(e => e.flavor !== 'always-on')
      .sort((a, b) => a.startDate.localeCompare(b.startDate));

    if (tierEvents.length === 0) continue;

    let prevDate = range.start;
    for (const ev of tierEvents) {
      if (daysBetween(prevDate, ev.startDate) > COVERAGE_GAP_DAYS) {
        hits.push({
          id: `gap-${tier}-${prevDate}-${ev.startDate}`,
          type: 'opportunity',
          severity: 'medium',
          ruleId: 'coverageGap',
          dateRange: { start: prevDate, end: ev.startDate },
          campaignIds: [],
          title: `${tier} segment has ${daysBetween(prevDate, ev.startDate)}-day gap`,
          rawEvidence: { tier, gapDays: daysBetween(prevDate, ev.startDate), from: prevDate, to: ev.startDate },
        });
      }
      prevDate = ev.endDate;
    }
    const clippedPrev = prevDate > range.end ? range.end : prevDate;
    if (daysBetween(clippedPrev, range.end) > COVERAGE_GAP_DAYS) {
      hits.push({
        id: `gap-${tier}-${clippedPrev}-${range.end}`,
        type: 'opportunity',
        severity: 'medium',
        ruleId: 'coverageGap',
        dateRange: { start: clippedPrev, end: range.end },
        campaignIds: [],
        title: `${tier} segment has ${daysBetween(clippedPrev, range.end)}-day trailing gap`,
        rawEvidence: { tier, gapDays: daysBetween(clippedPrev, range.end), from: clippedPrev, to: range.end },
      });
    }
  }
  return hits;
}

// ── Rule 5: Holiday window gap ───────────────────────────────
export function detectHolidayWindowGap(events, range) {
  const hits = [];
  for (const h of HOLIDAYS) {
    if (!rangeOverlap(h.start, h.end, range.start, range.end)) continue;
    const covered = events.some(e =>
      h.offerGroups.includes(e.group) && rangeOverlap(e.startDate, e.endDate, h.start, h.end)
    );
    if (!covered) {
      hits.push({
        id: `holiday-${h.name}-${h.start}`,
        type: 'opportunity',
        severity: 'high',
        ruleId: 'holidayWindowGap',
        dateRange: { start: h.start, end: h.end },
        campaignIds: [],
        title: `${h.name} window has no offer campaign`,
        rawEvidence: {
          holiday: h.name,
          window: `${h.start} → ${h.end}`,
          offerGroups: h.offerGroups,
          daysUntilHoliday: daysBetween(range.start, h.start),
        },
      });
    }
  }
  return hits;
}

// ── Rule 6: Frequency anomaly ────────────────────────────────
export function detectFrequencyAnomaly(events, range) {
  const hits = [];
  const byCampaign = groupBy(events.filter(e => e.flavor === 'scheduled'), e => e.campaignId);
  for (const [campaignId, list] of byCampaign) {
    if (list.length > FREQUENCY_MULTIPLIER * 4) {
      hits.push({
        id: `freq-${campaignId}-${range.start}`,
        type: 'risk',
        severity: 'medium',
        ruleId: 'frequencyAnomaly',
        dateRange: range,
        campaignIds: [campaignId],
        title: `${list[0].campaignName}: ${list.length} sends in range (>2× historical)`,
        rawEvidence: {
          campaign: list[0].campaignName,
          count: list.length,
          threshold: FREQUENCY_MULTIPLIER * 4,
          historicalMedian: 4,
        },
      });
    }
  }
  return hits;
}

// ── Rule 7: Performance opportunity ──────────────────────────
export function detectPerformanceOpportunity(events, range) {
  const hits = [];
  for (const hp of HIGH_PERFORMERS) {
    const present = events.some(e => (e.campaignName || '').toLowerCase().includes(hp.tag.toLowerCase()));
    if (!present) {
      hits.push({
        id: `perf-${hp.tag}-${range.start}`,
        type: 'insight',
        severity: 'low',
        ruleId: 'performanceOpportunity',
        dateRange: range,
        campaignIds: [],
        title: `High-performing template "${hp.tag}" not in range`,
        rawEvidence: hp,
      });
    }
  }
  return hits;
}

// ── Orchestrator ──────────────────────────────────────────────
export function runAllRules(events, range) {
  return [
    ...detectSegmentOverload(events, range),
    ...detectBauLifecycleCollision(events, range),
    ...detectLanguageImbalance(events, range),
    ...detectCoverageGap(events, range),
    ...detectHolidayWindowGap(events, range),
    ...detectFrequencyAnomaly(events, range),
    ...detectPerformanceOpportunity(events, range),
  ];
}

// ── AI Health Score ──────────────────────────────────────────
export function computeHealthScore(hits) {
  const risks = hits.filter(h => h.type === 'risk');
  const penalty = risks.reduce((acc, h) => {
    if (h.severity === 'high') return acc + 5;
    if (h.severity === 'medium') return acc + 2;
    return acc + 1;
  }, 0);
  return Math.max(0, Math.min(100, 100 - penalty));
}
