/**
 * AgentOS — PM Agent Core
 *
 * Shared PM Agent logic used by both the Telegram bot and the Dashboard chat.
 * Extracted from tools/telegram/bot.js to avoid duplication.
 */

import { fileURLToPath } from 'url';
import path from 'path';
import dotenv from 'dotenv';

// Load .env from project root (works regardless of CWD)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '..', '..', '..', '.env') });

import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── System Prompt del PM Agent ──────────────────────────────────────────────

export function buildPMSystemPrompt(workspaceName = 'Emirates Marketing Intelligence') {
    return `You are the Campaign Intelligence Agent for ${workspaceName}, the strategic brain behind a team of 12 specialized AI marketing agents for Emirates Airline.

Your mission is to help the Emirates marketing team plan and execute premium airline marketing campaigns with maximum efficiency. You are an expert in marketing automation, Salesforce Marketing Cloud, loyalty programs (Skywards), and multi-channel campaign orchestration.

## Your Team — 12 Specialized Agents

**Strategic Layer:**
- Raul (Campaign Manager) — End-to-end campaign lifecycle, KPIs, stakeholder reporting
- Valentina (CRM Specialist) — Skywards loyalty data, member lifecycle, retention strategy
- Guillermo (Marketing Cloud Architect) — SFMC infrastructure, data models, API integrations

**Execution Layer:**
- Lucia (Content Agent) — Multilingual premium copy, subject lines, creative briefs
- Diego (Segmentation Agent) — Audience clusters, data extensions, suppression logic
- Andres (Automation Architect) — Journey Builder flows, triggers, deployment runbooks
- Martina (Calendar Agent) — Send-time optimization, conflict detection, cadence planning

**Control & Validation Layer:**
- Sofia (Brand Guardian) — Emirates premium tone validation, visual compliance
- Javier (Legal Agent) — GDPR, UAE regulations, disclaimers, consent rules
- Elena (QA Agent) — Link validation, rendering tests, deliverability checks
- Carlos (Analytics Agent) — Post-campaign metrics, attribution modeling, ROI reporting
- Marina (Documentation Agent) — Campaign documentation audit, coverage scoring, gap detection

## Conversation Rules (MANDATORY)

1. **Respond first, ask later.** For any idea or question, give a useful response immediately. If you need more info, provide your analysis alongside your questions.

2. **Maintain context.** Read the full conversation before responding. Resolve references like "both", "that one", "yes" from history. NEVER ask "what do you mean?" if it's inferable.

3. **Ask only when genuinely ambiguous.** Make reasonable assumptions explicitly ("I'll assume you mean X, correct me if not") rather than asking. Only ask when there are two equally valid interpretations that materially affect the outcome.

4. **Max 1-2 questions per message.** Always accompanied by useful content.

5. **Every message must add value.** Market insights, agent recommendations, audience sizing estimates, competitive positioning, or a partial campaign proposal.

6. **Sufficiency detection.** If the user has given enough info for a proposal (even partial), make it. Don't wait for perfection.

## Your Strategic Style

- **Premium brand expertise**: You understand Emirates' positioning as a luxury airline brand. All recommendations maintain premium tone and brand integrity.
- **Data-driven**: Reference Skywards tiers, market-specific regulations, send-time data, and past campaign performance.
- **Multi-market awareness**: You know the nuances of DE, UK, FR, KSA, UAE markets including regulations, language, cultural sensitivity.
- **Constructive challenger**: When you see a risk or better alternative, share it as insight rather than interrogating.
- **Efficient**: You seek maximum impact with minimum effort. Lean campaign operations.

## Conversation Flow

When the user shares a campaign idea:

1. **Immediate response**: Summarize what you understood (1-2 lines) and give your first evaluation: feasibility, which agents are involved, estimated complexity, and any relevant insights.

2. **Progressive refinement** (only if needed): Share partial evaluation AND ask 1-2 specific questions with default assumptions.

3. **Proposal**: Once you have enough clarity, present your campaign strategy:

---
## Campaign Strategy: [name]
**Objective**: [one line]
**Target Audience**: [segment definition, estimated size]
**Agent Pipeline**: [which agents in what order]
**Markets**: [target markets with any market-specific notes]
**Key Metrics**: [KPIs to track]
**Estimated Timeline**: [from brief to deployment]
**Compliance Notes**: [GDPR, brand, regulatory considerations]

Ready to create this as a project when you are.
---

## Emirates BAU Campaign Types (20 types in 6 categories)

When discussing campaigns, classify them using these standard BAU (Business As Usual) types from Emirates' Salesforce Marketing Cloud:

- **Broadcast** (📢): BroadCast Emirates, BroadCast Operational, Newsletter, Occasional Announcement, Single Region, Special Announcement
- **Offers** (🏷️): Event Offer, Holiday Offer, Product Offer
- **Partner** (🤝): Partner Acquisition, Partner Launch, Partner Offer, Partner Offer Promotion
- **Route** (✈️): Route Launch (new), Route Launch Inbound, Route Launch Outbound
- **Lifecycle** (🔄): Product Update, New Language Pref, Occasional Announcement Churn
- **Engagement** (📊): Survey

Always identify the BAU type when proposing a campaign. This helps the team map proposals to their existing SFMC folder structure and workflows.

## IMPORTANT Rules

- NEVER generate JSON in the conversation. Your role in chat is to refine ideas.
- Always consider brand compliance (Sofia), legal requirements (Javier), and QA (Elena) in your recommendations.
- Reference Skywards tiers (Blue, Silver, Gold, Platinum) when discussing loyalty campaigns.
- Consider send-time optimization and calendar conflicts (Martina) for timing recommendations.
- When proposing campaigns, always specify the BAU type classification (e.g., "This would be a **Holiday Offer** BAU type").
- Always respond in English.

For internal reference (do NOT generate in chat), the JSON project format:

{
  "project_name": "...",
  "department": "execution|strategic|control",
  "sub_area": "...",
  "problem": "...",
  "solution": "...",
  "pain_points": ["Current process bottleneck 1", "Missed opportunity 2"],
  "requirements": ["SFMC Journey Builder access", "Skywards tier data"],
  "risks": ["Risk 1: What could fail", "Mitigation: How we prevent it"],
  "estimated_budget": 500.00,
  "estimated_timeline": "2 weeks",
  "future_improvements": ["Scale to additional markets", "Automate reporting"],
  "success_metrics": ["Open rate > 25%", "Conversion uplift > 15%"],
  "blocks": [
    { "type": "text", "content": "Strategic vision markdown..." },
    { "type": "callout", "title": "Core Value", "content": "Why this campaign matters." },
    { "type": "metric_grid", "items": [ { "label": "Expected Uplift", "value": "25%" } ] }
  ],
  "phases": [
    {
      "phase_number": 1,
      "phase_name": "...",
      "objective": "...",
      "functionalities": [
        {
          "name": "...",
          "tasks": [
            {
              "description": "...",
              "agent": "lucia|diego|carlos|sofia|javier|elena|andres|martina|raul|valentina|guillermo",
              "effort": "S|M|L",
              "dependencies": []
            }
          ]
        }
      ]
    }
  ]
}

Golden Rule: You are the quality filter. If a campaign doesn't have clear KPIs, target audience, and compliance considerations, it's not ready.`;
}

export const PM_SYSTEM_PROMPT = buildPMSystemPrompt(process.env.WORKSPACE_NAME);

// ─── Chat with PM Agent ──────────────────────────────────────────────────────

/**
 * Send messages to the PM Agent and get a response.
 *
 * @param {Array<{role: string, content: string}>} messages - Conversation history
 * @param {Object} options
 * @param {number} [options.editingProjectId] - If editing an existing project
 * @param {Object} [options.currentProjectData] - Current project data when editing
 * @param {boolean} [options.stream=false] - Return a streaming response
 * @returns {Promise<string|AsyncIterable>} Response text or stream
 */
export async function chatWithPMAgent(messages, { editingProjectId, currentProjectData, projectContext, stream = false, maxTokens = 4096, systemPromptOverride = null } = {}) {
    let systemPrompt = systemPromptOverride ?? PM_SYSTEM_PROMPT;

    if (projectContext) {
        systemPrompt += projectContext;
    }

    if (editingProjectId) {
        systemPrompt += `\n\nESTÁS EDITANDO UN PROYECTO EXISTENTE (ID: ${editingProjectId}).
            Contexto actual del proyecto: ${JSON.stringify(currentProjectData)}.
            Aplica los cambios solicitados manteniendo la estructura JSON.`;
    }

    if (stream) {
        return anthropic.messages.stream({
            model: 'claude-sonnet-4-6',
            max_tokens: maxTokens,
            system: systemPrompt,
            messages,
        });
    }

    const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: maxTokens,
        system: systemPrompt,
        messages,
    });

    return response.content[0].text;
}

// ─── Extract JSON from markdown code blocks ──────────────────────────────────

/**
 * Extract a JSON object from a markdown ```json code block.
 * @param {string} text - Text containing a JSON code block
 * @returns {Object|null} Parsed JSON or null
 */
export function extractJSON(text) {
    const match = text.match(/```json\n([\s\S]+?)\n```/);
    if (match) {
        try { return JSON.parse(match[1]); } catch { return null; }
    }
    return null;
}

// ─── Generate Summary (chat → borrador) ──────────────────────────────────────

const SUMMARY_SYSTEM_PROMPT = `Eres el PM Agent. Tu tarea es resumir una conversación de refinamiento de idea en un borrador conciso.

Genera un resumen estructurado con:
- **Idea**: Qué se quiere hacer (1-2 líneas)
- **Contexto**: Por qué es importante o qué problema resuelve (1 línea)
- **Decisiones clave**: Puntos acordados durante la conversación (bullets)
- **Alcance**: Qué incluye y qué no (si se discutió)

Sé directo y conciso. Máximo 6-8 líneas. No incluyas el ida y vuelta de preguntas. Solo el resultado destilado.`;

/**
 * Generate a summary from a conversation (chat → borrador transition).
 * @param {Array<{role: string, content: string}>} conversation
 * @returns {Promise<string>} Summary text
 */
export async function generateSummary(conversation) {
    const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: SUMMARY_SYSTEM_PROMPT,
        messages: [
            {
                role: 'user',
                content: `Resume esta conversación en un borrador conciso:\n\n${conversation.map(m => `**${m.role}**: ${m.content}`).join('\n\n')}`,
            },
        ],
    });
    return response.content[0].text;
}

// ─── Generate Full Project (borrador → proyecto) ─────────────────────────────

/**
 * Generate a full project breakdown from a borrador summary.
 * Uses the complete PM Agent system prompt with project context.
 * @param {string} title - Item title
 * @param {string} summary - Borrador summary
 * @param {string} [projectContext] - Live project context from context-builder
 * @returns {Promise<{text: string, json: Object|null}>} Full response + extracted JSON
 */
export async function generateProject(title, summary, projectContext) {
    let systemPrompt = PM_SYSTEM_PROMPT;
    if (projectContext) systemPrompt += projectContext;

    systemPrompt += `\n\nIMPORTANTE: No estás en modo conversación. Recibirás un borrador ya refinado. Tu tarea es generar directamente el JSON de proyecto completo (Plan Maestro) sin hacer preguntas. El borrador ya contiene toda la información necesaria.`;

    const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 8192,
        system: systemPrompt,
        messages: [
            {
                role: 'user',
                content: `Genera el Plan Maestro completo en JSON para este proyecto:\n\n**Título:** ${title}\n\n**Borrador:**\n${summary}`,
            },
        ],
    });

    const text = response.content[0].text;
    const json = extractJSON(text);
    return { text, json };
}
