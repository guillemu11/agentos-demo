/**
 * Campaign Calendar — AI insights enrichment
 *
 * Wraps Claude with a deterministic rules-engine bridge: takes events[] +
 * ruleHits[] and returns narratives + actions per hit. Falls back to the raw
 * ruleHit titles on any Claude error so the calendar UI never breaks.
 */

const SYSTEM_PROMPT = `You are an email marketing intelligence analyst for Emirates Airline.
You receive a JSON payload with:
- events[]: planned campaigns in the current view range
- ruleHits[]: deterministic risks/opportunities detected by a rules engine
- rangeStart, rangeEnd

For each ruleHit, write a 1-2 sentence narrative in Spanish grounded in the event data provided.
Include concrete numbers (open rates, conversions, day counts) where the raw evidence supports them.
Suggest a concrete action per hit.

Return strict JSON matching this shape:
{
  "enriched": [
    { "id": "<ruleHit.id>", "narrative": "...", "action": "...", "estimatedImpact": "..." }
  ],
  "freeformInsights": [
    { "id": "free-1", "type": "insight", "severity": "low", "title": "...", "narrative": "...", "action": "..." }
  ]
}
Output ONLY the JSON, no markdown fences, no prose.`;

export async function enrichWithClaude({ client, events, ruleHits, rangeStart, rangeEnd }) {
  const payload = { rangeStart, rangeEnd, events, ruleHits };
  try {
    const resp = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: JSON.stringify(payload) }],
    });
    const text = (resp.content || []).find(c => c.type === 'text')?.text || '{}';
    const parsed = JSON.parse(text);
    return {
      enriched: parsed.enriched || [],
      freeformInsights: parsed.freeformInsights || [],
      degraded: false,
    };
  } catch (err) {
    return {
      enriched: ruleHits.map(h => ({
        id: h.id,
        narrative: h.title,
        action: '',
        estimatedImpact: '',
      })),
      freeformInsights: [],
      degraded: true,
      error: err.message,
    };
  }
}

// Simple in-memory cache keyed by eventsHash + range
const cache = new Map();
const TTL_MS = 5 * 60 * 1000;

function hashPayload(events, ruleHits, rangeStart, rangeEnd) {
  const ids = [...events.map(e => e.id), ...ruleHits.map(h => h.id)].sort().join('|');
  return `${rangeStart}|${rangeEnd}|${ids}`;
}

export async function getOrEnrich({ client, events, ruleHits, rangeStart, rangeEnd }) {
  const key = hashPayload(events, ruleHits, rangeStart, rangeEnd);
  const now = Date.now();
  const cached = cache.get(key);
  if (cached && now - cached.at < TTL_MS) return cached.value;
  const value = await enrichWithClaude({ client, events, ruleHits, rangeStart, rangeEnd });
  cache.set(key, { at: now, value });
  return value;
}
