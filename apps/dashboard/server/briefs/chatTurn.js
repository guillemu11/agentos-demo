// Claude tool-use wrapper for the conversational campaign brief setup.
// Each call takes (current brief state + user message) and returns
// newly-extracted fields, the next question, and a completion flag.

import Anthropic from '@anthropic-ai/sdk';

const MODEL = 'claude-sonnet-4-6';

const EXTRACT_TOOL = {
  name: 'update_brief',
  description: 'Store extracted or inferred brief fields from the conversation so far.',
  input_schema: {
    type: 'object',
    properties: {
      name:            { type: 'string' },
      objective:       { type: 'string' },
      send_date:       { type: 'string', description: 'ISO 8601 UTC datetime (e.g. 2026-04-14T10:00:00Z)' },
      template_id:     { type: 'string', description: 'BAU template id (e.g. a350-premium-launch, lifecycle-winback)' },
      markets:         { type: 'array', items: { type: 'string' }, description: 'ISO country codes (FR, DE, UK, AE, SA, KW, ...)' },
      languages:       { type: 'array', items: { type: 'string' }, description: 'ISO language codes (en, fr, de, ar, ...)' },
      variants_plan:   {
        type: 'array',
        description: 'Planned variants, one entry per audience slice.',
        items: {
          type: 'object',
          properties: {
            tier:      { type: 'string' },
            behaviors: { type: 'array', items: { type: 'string' } },
            size:      { type: 'integer' },
          },
        },
      },
      audience_summary:{ type: 'string', description: '1-2 sentences describing the target audience.' },
      next_question:   { type: 'string', description: 'Next single question to ask the user. Empty string if brief is complete.' },
      is_complete:     { type: 'boolean', description: 'True only when every required field (name, objective, send_date, template_id, markets, languages, variants_plan) has a value.' },
    },
    required: ['next_question', 'is_complete'],
  },
};

const SYSTEM = `You are an email marketing strategist helping a user create a campaign brief through conversation.

Your job:
- Progressively extract these fields: name, objective, send_date, template_id, markets, languages, variants_plan, audience_summary.
- Every turn, call the update_brief tool with whatever you can extract OR sensibly infer from the latest user message — merge with existing state; do NOT blank out fields you don't have new info for.
- Propose smart defaults (optimal send hour per market, default languages given the markets, a reasonable variants_plan given the objective). State the default and ask for confirmation.
- Ask ONE question at a time. Keep questions concise.
- Reply in the user's language.
- Set is_complete=true ONLY when every required field is populated.`;

export async function runChatTurn({ brief, userMessage, apiKey }) {
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set');

  const client = new Anthropic({ apiKey });
  const history = Array.isArray(brief.chat_transcript) ? brief.chat_transcript : [];

  // Build Claude messages from transcript + latest user message
  const messages = [
    ...history.map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: userMessage },
  ];

  const knownFields = {
    name: brief.name,
    objective: brief.objective,
    send_date: brief.send_date,
    template_id: brief.template_id,
    markets: brief.markets,
    languages: brief.languages,
    variants_plan: brief.variants_plan,
    audience_summary: brief.audience_summary,
  };

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: `${SYSTEM}\n\nCurrent known fields (JSON):\n${JSON.stringify(knownFields, null, 2)}`,
    tools: [EXTRACT_TOOL],
    tool_choice: { type: 'tool', name: 'update_brief' },
    messages,
  });

  const toolUse = response.content.find(c => c.type === 'tool_use');
  if (!toolUse) throw new Error('Claude did not call update_brief');

  const extracted = toolUse.input || {};
  const assistantMessage = typeof extracted.next_question === 'string' ? extracted.next_question : '';

  const newHistory = [
    ...messages,
    { role: 'assistant', content: assistantMessage },
  ];

  return { extracted, assistantMessage, newHistory };
}
