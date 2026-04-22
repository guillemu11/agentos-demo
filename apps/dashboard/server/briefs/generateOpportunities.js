// Turn a mock data signal into a proactive campaign brief using Claude tool-use.

import Anthropic from '@anthropic-ai/sdk';
import { pickRandomSignals } from '../../src/data/mockSignals.js';

const MODEL = 'claude-sonnet-4-6';

const COMPOSE_TOOL = {
  name: 'compose_opportunity_brief',
  description: 'Compose a campaign brief from a detected signal.',
  input_schema: {
    type: 'object',
    required: [
      'name', 'audience_summary', 'opportunity_reason',
      'suggested_send_date', 'template_id', 'markets', 'languages',
    ],
    properties: {
      name:                 { type: 'string', description: 'Short, concrete campaign name.' },
      audience_summary:     { type: 'string', description: '1 sentence describing who this targets.' },
      opportunity_reason:   { type: 'string', description: '1-2 sentences. Must cite the signal data to justify the opportunity. Data-driven tone.' },
      suggested_send_date:  { type: 'string', description: 'ISO date/time (YYYY-MM-DDTHH:MM:SSZ). Pick something sensible given the signal.' },
      template_id:          { type: 'string', description: 'BAU template id aligned to the signal (e.g. lifecycle-winback).' },
      markets:              { type: 'array', items: { type: 'string' }, description: 'ISO country codes.' },
      languages:            { type: 'array', items: { type: 'string' }, description: 'ISO language codes.' },
    },
  },
};

const PREVIEW_BY_TEMPLATE = {
  'lifecycle-winback':    '/assets/ai-previews/winback.png',
  'recovery-offer':       '/assets/ai-previews/recovery.png',
  'route-launch':         '/assets/ai-previews/route.png',
  'engagement-broadcast': '/assets/ai-previews/broadcast.png',
  'offers-promotion':     '/assets/ai-previews/offer.png',
};

const SYSTEM = `You are an email marketing strategist. A data signal has been detected.
Compose a proactive campaign brief the team should consider launching. The opportunity_reason
must cite the signal data concretely (numbers, audience size, time windows).
Be specific, not generic. Match the audience's likely language(s).`;

export async function composeOpportunityFromSignal({ signal, apiKey }) {
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set');
  const client = new Anthropic({ apiKey });

  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 512,
    system: SYSTEM,
    tools: [COMPOSE_TOOL],
    tool_choice: { type: 'tool', name: 'compose_opportunity_brief' },
    messages: [{
      role: 'user',
      content:
`Detected signal:
type: ${signal.type}
suggested template: ${signal.brief_template}
payload: ${JSON.stringify(signal.payload)}

Compose a proactive brief.`,
    }],
  });

  const toolUse = res.content.find(c => c.type === 'tool_use');
  if (!toolUse) throw new Error('Claude did not call compose_opportunity_brief');

  const b = toolUse.input || {};
  return {
    ...b,
    preview_image_url: PREVIEW_BY_TEMPLATE[b.template_id] || null,
    opportunity_signals: signal,
  };
}

export async function generateOpportunities({ count = 4, exclude = [], apiKey }) {
  const signals = pickRandomSignals(count, exclude);
  const briefs = [];
  for (const s of signals) {
    briefs.push(await composeOpportunityFromSignal({ signal: s, apiKey }));
  }
  return briefs;
}
