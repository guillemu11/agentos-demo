// Claude tool-use: given a completed brief, return exactly 3 distinct content directions.
// Each option includes layout direction + full copy set (subject, preheader, headline, body, cta).

import Anthropic from '@anthropic-ai/sdk';

const MODEL = 'claude-sonnet-4-6';

const OPTIONS_TOOL = {
  name: 'propose_options',
  description: 'Propose exactly 3 distinct content directions (layout + copy) for the brief.',
  input_schema: {
    type: 'object',
    properties: {
      options: {
        type: 'array',
        minItems: 3,
        maxItems: 3,
        items: {
          type: 'object',
          required: ['direction', 'headline', 'subject', 'preheader', 'body', 'cta_label', 'cta_url', 'mood'],
          properties: {
            direction: {
              type: 'string',
              enum: ['editorial', 'data-grid', 'emotional'],
              description: 'Exactly one of the three directions. Each direction must appear exactly once across the 3 options.',
            },
            headline:  { type: 'string', description: 'The primary headline — hero copy.' },
            subject:   { type: 'string', description: 'Email subject line.' },
            preheader: { type: 'string', description: 'Preheader text shown in inbox preview.' },
            body:      { type: 'string', description: 'Full body copy, 1-3 short paragraphs.' },
            cta_label: { type: 'string', description: 'CTA button text.' },
            cta_url:   { type: 'string', description: 'CTA destination URL (may be a placeholder like https://emirates.com/...).' },
            mood:      { type: 'string', description: 'One-line description of tone and feel.' },
          },
        },
      },
    },
    required: ['options'],
  },
};

const SYSTEM = `You are an email marketing content strategist. Given a completed campaign brief,
produce exactly 3 distinct content directions — one of each: editorial, data-grid, emotional.
Each must feel like a different angle on the same brief, not three paraphrases. Write real copy,
not placeholders. Match the brief's language(s). Keep subjects under 60 chars and preheaders under 90.`;

export async function generateOptions({ brief, apiKey }) {
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set');
  const client = new Anthropic({ apiKey });

  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    system: SYSTEM,
    tools: [OPTIONS_TOOL],
    tool_choice: { type: 'tool', name: 'propose_options' },
    messages: [
      {
        role: 'user',
        content: `Produce 3 content directions for this brief:\n\n${JSON.stringify(brief, null, 2)}`,
      },
    ],
  });

  const toolUse = res.content.find(c => c.type === 'tool_use');
  if (!toolUse) throw new Error('Claude did not call propose_options');

  const options = toolUse.input?.options;
  if (!Array.isArray(options) || options.length !== 3) {
    throw new Error('propose_options did not return exactly 3 options');
  }
  return options;
}
