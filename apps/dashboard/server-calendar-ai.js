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

For each ruleHit, write a 1-2 sentence narrative in English grounded in the event data provided.
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

function stripJsonFences(text) {
  // Handle ```json\n{...}\n``` or ```\n{...}\n```
  const fencePattern = /^\s*```(?:json)?\s*\n?([\s\S]*?)\n?```\s*$/;
  const m = text.match(fencePattern);
  return m ? m[1] : text;
}

function degradedFallback(ruleHits, errorMsg) {
  return {
    enriched: ruleHits.map(h => ({
      id: h.id,
      narrative: h.title,
      action: '',
      estimatedImpact: '',
    })),
    freeformInsights: [],
    degraded: true,
    error: errorMsg,
  };
}

export async function enrichWithClaude({ client, events, ruleHits, rangeStart, rangeEnd }) {
  const payload = { rangeStart, rangeEnd, events, ruleHits };

  let resp;
  try {
    resp = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: JSON.stringify(payload) }],
    });
  } catch (err) {
    return degradedFallback(ruleHits, `claude-api: ${err.message}`);
  }

  const rawText = (resp.content || []).find(c => c.type === 'text')?.text || '{}';
  const cleaned = stripJsonFences(rawText);
  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    return degradedFallback(ruleHits, `parse: ${err.message}`);
  }

  return {
    enriched: parsed.enriched || [],
    freeformInsights: parsed.freeformInsights || [],
    degraded: false,
  };
}

// Simple in-memory cache keyed by eventsHash + range
const cache = new Map();
const TTL_MS = 5 * 60 * 1000;
const CACHE_MAX = 100;

function hashPayload(events, ruleHits, rangeStart, rangeEnd) {
  const ids = [...events.map(e => e.id), ...ruleHits.map(h => h.id)].sort().join('|');
  return `${rangeStart}|${rangeEnd}|${ids}`;
}

export function clearCache() { cache.clear(); }

export async function getOrEnrich({ client, events, ruleHits, rangeStart, rangeEnd }) {
  const key = hashPayload(events, ruleHits, rangeStart, rangeEnd);
  const now = Date.now();
  const cached = cache.get(key);
  if (cached && now - cached.at < TTL_MS) return cached.value;
  const value = await enrichWithClaude({ client, events, ruleHits, rangeStart, rangeEnd });
  if (cache.size >= CACHE_MAX) {
    // Evict oldest entry (Map iteration order is insertion order)
    const firstKey = cache.keys().next().value;
    if (firstKey !== undefined) cache.delete(firstKey);
  }
  cache.set(key, { at: now, value });
  return value;
}
