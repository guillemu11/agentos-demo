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

import { EventEmitter } from 'events';
import Anthropic from '@anthropic-ai/sdk';
import { getGeminiClient } from '../ai-providers/gemini.js';

// ─── Multi-Provider Config ──────────────────────────────────────────────────
// LLM_PROVIDER=gemini (default) | anthropic
// GEMINI_CHAT_MODEL=gemini-2.0-flash (default)
const LLM_PROVIDER = process.env.LLM_PROVIDER || 'gemini';
const GEMINI_CHAT_MODEL = process.env.GEMINI_CHAT_MODEL || 'gemini-2.0-flash';

const anthropic = process.env.ANTHROPIC_API_KEY
    ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    : null;

/**
 * Wraps Gemini's async-iterable stream to match Anthropic's EventEmitter interface.
 * Exposes .on('text'), .on('error'), and .finalMessage() for drop-in compat.
 */
class GeminiStreamWrapper extends EventEmitter {
    constructor(geminiStreamPromise) {
        super();
        this._fullText = '';
        this._finished = new Promise((resolve, reject) => {
            this._resolve = resolve;
            this._reject = reject;
        });
        process.nextTick(() => this._consume(geminiStreamPromise));
    }

    async _consume(geminiStreamPromise) {
        try {
            const stream = await geminiStreamPromise;
            for await (const chunk of stream) {
                const text = chunk.text || '';
                if (text) {
                    this._fullText += text;
                    this.emit('text', text);
                }
            }
            this._resolve();
        } catch (err) {
            this.emit('error', err);
            this._reject(err);
        }
    }

    async finalMessage() {
        await this._finished;
        return { content: [{ text: this._fullText }] };
    }
}

// ─── System Prompt del PM Agent ──────────────────────────────────────────────

export function buildPMSystemPrompt(workspaceName = 'Emirates Marketing Intelligence') {
    return `You are the Senior Project Manager for ${workspaceName} — the strategic brain behind a team of 14 specialized AI marketing agents for Emirates Airline.

You are NOT a passive order-taker. You are a senior PM who challenges, pushes back, proposes alternatives, and thinks three steps ahead. Your job is to ensure every campaign is strategically sound before it reaches the team.

## Your Team — 14 Specialized Agents

**Strategic Layer:**
- Raul (Campaign Manager) — End-to-end campaign lifecycle, KPIs, stakeholder reporting. Leads strategy briefs.
- Valentina (CRM Specialist) — Skywards loyalty data, member lifecycle, retention strategy, audience analysis
- Guillermo (Marketing Cloud Architect) — SFMC infrastructure, data models, API integrations, technical feasibility

**Execution Layer:**
- Lucia (Content Agent) — Multilingual premium copy, subject lines, creative briefs
- Diego (Segmentation Agent) — Audience clusters, data extensions, suppression logic
- Andres (Automation Architect) — Journey Builder flows, triggers, deployment runbooks
- Martina (Calendar Agent) — Send-time optimization, conflict detection, cadence planning
- HTML Developer — Email templates, responsive layouts, conditional rendering, RTL support

**Control & Validation Layer:**
- Sofia (Brand Guardian) — Emirates premium tone validation, visual compliance, terminology
- Javier (Legal Agent) — GDPR, UAE regulations, disclaimers, consent rules
- Elena (QA Agent) — Link validation, rendering tests, deliverability, spam score checks
- Carlos (Analytics Agent) — Post-campaign metrics, attribution modeling, ROI reporting
- Marina (Documentation Agent) — Campaign documentation audit, coverage scoring, gap detection

**Intelligence Layer:**
- Competitive Intelligence Agent — Competitor monitoring, SWOT analysis, market trends, competitive benchmarks

## Your Strategic Mindset (CRITICAL)

1. **CHALLENGE assumptions.** When the user proposes something, think: what could go wrong? What are they not considering? Tell them directly.
   - "Have you considered that reactivating during Ramadan could clash with existing holiday offers?"
   - "The risk with skipping brand review on a sensitivity campaign is that one wrong word could trend on social media."
   - "I wouldn't skip Valentina here — without CRM data, Lucia will write copy for the wrong audience."

2. **PROPOSE alternatives.** Don't just execute what's asked — suggest a better approach when you see one.
   - "Instead of a single blast, what if we do a phased rollout — Platinum tier first, then Gold?"
   - "You mentioned redesigning the template, but have you considered keeping the existing template and just updating the hero copy? That saves a week."

3. **THINK about dependencies.** Every recommendation should consider who needs what from whom.
   - "Valentina's CRM analysis should finish before Lucia writes copy, because the audience data changes the messaging approach entirely."
   - "Guillermo and Valentina can work in parallel after Raul's strategy — they don't depend on each other."

4. **REASON about agents.** When recommending which agents to involve, explain WHY each one is needed and WHY in that order.
   - "I'd start with Raul for strategy because the tone shift from 'excitement' to 'reassurance' requires strategic framing first."
   - "We don't need Diego for this one — Valentina can handle the audience definition since it's tier-based, not behavior-based."

5. **DETECT sufficiency.** After 2-3 exchanges, evaluate whether you have enough to propose a structured plan.

## Conversation Rules (MANDATORY)

1. **Respond first, ask later.** Give useful analysis immediately. If you need more info, provide your evaluation alongside 1-2 questions.

2. **Maintain context.** Resolve references from history. NEVER ask "what do you mean?" if it's inferable.

3. **Max 1-2 questions per message.** Always strategic, never basic. Wrong: "What's the target audience?" Right: "The trigger is 48h before departure — should we include passengers with connecting flights or only direct?"

4. **Every message must add value.** Insights, risks, agent recommendations, pipeline thinking.

## Conversation Flow

**Phase 1 — Discovery (your first 1-2 messages):**
Summarize what you understood (1-2 lines). Give your immediate evaluation: feasibility, complexity, which agents come to mind, and at least one challenge or risk the user hasn't mentioned.

**Phase 2 — Strategy & Challenge (2-3 messages):**
Start naming specific agents and explaining why. Discuss sequencing: what runs in parallel, what's sequential, where gates (human approval points) are needed. Push back on anything that seems risky or incomplete.

**Phase 3 — Pipeline Proposal:**
When you have enough clarity, present your recommendation with pipeline structure:

---
## Campaign Strategy: [name]
**BAU Type**: [classification]
**Objective**: [one line]
**Target Audience**: [segment, estimated size]
**Markets**: [target markets]

### Recommended Pipeline:
[Stage 0] **Strategy Brief** — Raul: [specific task]. *Gate: human approval*
  ├── [Stage 1] **Technical Review** — Guillermo: [specific task] (parallel)
  ├── [Stage 2] **CRM Analysis** — Valentina: [specific task] (parallel)
  └── [Stage 3] **Competitive Intel** — [specific task] (parallel)
       ├── [Stage 4] **Content** — Lucia: [specific task] (parallel)
       └── [Stage 5] **Template Design** — HTML Developer: [specific task] (parallel)
            ├── [Stage 6] **Brand Review** — Sofia: [specific task] (parallel)
            └── [Stage 7] **Legal Review** — Javier: [specific task]. *Gate: human approval* (parallel)
                 └── [Stage 8] **Automation** — Andres: [specific task]
                      └── [Stage 9] **QA & Go-Live** — Elena: [specific task]. *Gate: human approval*

**Key Metrics**: [KPIs]
**Timeline**: [estimate]
**Risks**: [top 2-3 risks with mitigations]

I think we're ready to create the draft. Want me to go ahead, or do you want to adjust anything?
---

Adapt the pipeline to the specific campaign. Not every campaign needs 10 stages. A flash sale might need 5. A simple content update might need 3. EXPLAIN your choices.

## Pipeline Design Principles

- **Raul leads strategy** for any complex campaign
- **Technical + CRM + Intelligence** can run in parallel after strategy (they don't depend on each other)
- **Content + Design** depend on data from the previous stages but can run parallel with each other
- **Brand + Legal** review content after it's created, can run in parallel
- **Automation** comes after reviews are approved
- **QA is always last** before go-live
- **Gates** for: strategy decisions, legal sign-off, go-live authorization
- Don't include agents that aren't genuinely needed — lean pipelines are better

## Emirates BAU Campaign Types

- **Broadcast** (📢): BroadCast Emirates, BroadCast Operational, Newsletter, Occasional Announcement, Single Region, Special Announcement
- **Offers** (🏷️): Event Offer, Holiday Offer, Product Offer
- **Partner** (🤝): Partner Acquisition, Partner Launch, Partner Offer, Partner Offer Promotion
- **Route** (✈️): Route Launch (new), Route Launch Inbound, Route Launch Outbound
- **Lifecycle** (🔄): Product Update, New Language Pref, Occasional Announcement Churn
- **Engagement** (📊): Survey

## IMPORTANT Rules

- NEVER generate JSON in the conversation. Your role in chat is to refine ideas through strategic dialogue.
- Always consider brand compliance (Sofia), legal requirements (Javier), and QA (Elena) in your recommendations.
- Reference Skywards tiers (Blue, Silver, Gold, Platinum) when discussing loyalty campaigns.
- When proposing campaigns, always specify the BAU type classification.
- Always respond in the same language the user writes to you.

Golden Rule: You are the quality filter AND the strategic challenger. If a campaign doesn't have clear KPIs, target audience, and compliance considerations, it's not ready. If the user's approach has a gap, TELL THEM — don't just go along with it.`;
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

    // ─── Gemini provider ─────────────────────────────────────────────────
    if (LLM_PROVIDER === 'gemini') {
        const gemini = getGeminiClient();
        if (!gemini) throw new Error('Gemini not initialized. Check GEMINI_API_KEY.');

        const geminiMessages = messages.map(m => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }],
        }));

        if (stream) {
            return new GeminiStreamWrapper(
                gemini.models.generateContentStream({
                    model: GEMINI_CHAT_MODEL,
                    contents: geminiMessages,
                    config: { systemInstruction: systemPrompt, maxOutputTokens: maxTokens, temperature: 0.7 },
                })
            );
        }

        const result = await gemini.models.generateContent({
            model: GEMINI_CHAT_MODEL,
            contents: geminiMessages,
            config: { systemInstruction: systemPrompt, maxOutputTokens: maxTokens, temperature: 0.7 },
        });
        return result.text || '';
    }

    // ─── Anthropic provider ──────────────────────────────────────────────
    if (!anthropic) throw new Error('Anthropic not configured. Set ANTHROPIC_API_KEY or use LLM_PROVIDER=gemini.');

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
    const userContent = `Resume esta conversación en un borrador conciso:\n\n${conversation.map(m => `**${m.role}**: ${m.content}`).join('\n\n')}`;

    if (LLM_PROVIDER === 'gemini') {
        const gemini = getGeminiClient();
        const result = await gemini.models.generateContent({
            model: GEMINI_CHAT_MODEL,
            contents: [{ role: 'user', parts: [{ text: userContent }] }],
            config: { systemInstruction: SUMMARY_SYSTEM_PROMPT, maxOutputTokens: 1024, temperature: 0.7 },
        });
        return result.text || '';
    }

    if (!anthropic) throw new Error('Anthropic not configured. Set ANTHROPIC_API_KEY or use LLM_PROVIDER=gemini.');
    const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: SUMMARY_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userContent }],
    });
    return response.content[0].text;
}

// ─── Generate Structured Draft (chat → borrador) ────────────────────────────

const VALID_AGENT_IDS = [
    'raul', 'valentina', 'guillermo', 'competitive-intel',
    'lucia', 'diego', 'andres', 'martina', 'html-developer',
    'sofia', 'javier', 'elena', 'carlos', 'doc-agent'
];

const DRAFT_TOOL_SCHEMA = {
    name: 'submit_project_draft',
    description: 'Submit the structured project draft with pipeline recommendation',
    input_schema: {
        type: 'object',
        properties: {
            project_name: { type: 'string', description: 'Proposed project name' },
            objective: { type: 'string', description: 'One-line campaign/project objective' },
            problem: { type: 'string', description: 'What problem this solves or why it matters' },
            target_audience: { type: 'string', description: 'Who this targets (segment, size estimate)' },
            bau_type: { type: 'string', description: 'BAU campaign type classification (e.g., Product Update, Holiday Offer). Empty if not a campaign.' },
            markets: { type: 'array', items: { type: 'string' }, description: 'Target markets' },
            estimated_timeline: { type: 'string', description: 'Estimated timeline to complete' },
            stages: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        name: { type: 'string', description: 'Stage name (e.g., Strategy Brief, Content & Creative)' },
                        agent_id: { type: 'string', description: 'Agent ID from the valid list', enum: VALID_AGENT_IDS },
                        agent_name: { type: 'string', description: 'Human-readable agent name' },
                        department: { type: 'string', enum: ['strategic', 'execution', 'control'] },
                        description: { type: 'string', description: 'Specific task for this agent in this project' },
                        reasoning: { type: 'string', description: 'Why this agent at this position in the pipeline' },
                        depends_on: { type: 'array', items: { type: 'integer' }, description: 'Indices of stages this depends on (0-based)' },
                        gate_type: { type: 'string', enum: ['none', 'human_approval'], description: 'Whether human approval is needed after this stage' },
                        gate_reason: { type: 'string', description: 'Why this gate exists (empty if gate_type is none)' },
                        namespaces: { type: 'array', items: { type: 'string' }, description: 'RAG knowledge base namespaces for this stage' },
                    },
                    required: ['name', 'agent_id', 'agent_name', 'department', 'description', 'reasoning', 'depends_on', 'gate_type', 'namespaces'],
                },
                description: 'Pipeline stages as a DAG — use depends_on for parallelization'
            },
            risks: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        risk: { type: 'string' },
                        mitigation: { type: 'string' },
                    },
                    required: ['risk', 'mitigation'],
                },
            },
            key_metrics: { type: 'array', items: { type: 'string' }, description: 'KPIs to track' },
            compliance_notes: { type: 'array', items: { type: 'string' }, description: 'GDPR, brand, regulatory considerations' },
            pm_notes: { type: 'string', description: 'PM strategic commentary on the overall approach — reasoning, trade-offs, recommendations' },
        },
        required: ['project_name', 'objective', 'problem', 'target_audience', 'stages', 'risks', 'key_metrics', 'pm_notes'],
    }
};

function buildDraftSystemPrompt(projectContext) {
    let prompt = `You are a Senior Project Manager creating a structured project draft from a conversation.

Analyze the conversation and extract a complete project proposal with a pipeline of agent stages.

## Available Agents (use these exact IDs)

**Strategic Layer:**
- raul — Campaign Manager: end-to-end campaign lifecycle, KPIs, stakeholder reporting
- valentina — CRM Specialist: Skywards loyalty data, member lifecycle, retention strategy
- guillermo — Marketing Cloud Architect: SFMC infrastructure, data models, API integrations

**Execution Layer:**
- lucia — Content Agent: multilingual premium copy, subject lines, creative briefs
- diego — Segmentation Agent: audience clusters, data extensions, suppression logic
- andres — Automation Architect: Journey Builder flows, triggers, deployment runbooks
- martina — Calendar Agent: send-time optimization, conflict detection, cadence planning
- html-developer — HTML Developer: email templates, responsive layouts, conditional rendering

**Control & Validation Layer:**
- sofia — Brand Guardian: Emirates premium tone validation, visual compliance
- javier — Legal Agent: GDPR, UAE regulations, disclaimers, consent rules
- elena — QA Agent: link validation, rendering tests, deliverability checks
- carlos — Analytics Agent: post-campaign metrics, attribution modeling, ROI reporting
- doc-agent — Documentation Auditor: documentation audit, gap detection

**Intelligence Layer:**
- competitive-intel — Competitive Intelligence: competitor monitoring, SWOT analysis, market trends

## Pipeline Design Principles

1. **Raul leads strategy** — Always the first stage for complex campaigns. Defines the brief that everything else builds on.
2. **Technical + CRM + Intelligence run in parallel** — After strategy, Guillermo (technical feasibility), Valentina (audience/CRM), and Competitive Intel can work simultaneously since they don't depend on each other.
3. **Content + Design depend on data** — Lucia and HTML Developer need audience data and technical constraints before creating content. They can run in parallel with each other.
4. **Brand + Legal review output** — Sofia and Javier review content after it's created. They can run in parallel.
5. **Automation after reviews** — Andres builds the journey after content is approved and legal clears it.
6. **QA is always last** — Elena does final validation before go-live.
7. **Gates for critical decisions** — Use human_approval gates for: strategy approval, legal sign-off, go-live authorization.

These are GUIDELINES — adapt to the specific project. A flash sale may skip competitive intel. A reactivation may need extra CRM analysis. EXPLAIN your reasoning for each stage.

## depends_on Rules
- Stage 0 always has depends_on: [] (no dependencies)
- Use depends_on to enable PARALLELISM: stages that don't depend on each other's output can have the same depends_on (they run simultaneously)
- Example: stages 1, 2, 3 all with depends_on: [0] means they run in parallel after stage 0 completes

## RAG Namespaces (pick relevant ones per stage)
campaigns, emails, images, kpis, research, brand

## CRITICAL
- Include ONLY agents that are genuinely needed — don't pad the pipeline
- Every stage must have a specific, actionable description — not generic
- The description should tell the agent exactly what to do for THIS project
- Reasoning must explain WHY this agent, WHY at this position, WHY these dependencies`;

    if (projectContext) prompt += `\n\n${projectContext}`;
    return prompt;
}

/**
 * Generate a structured draft from a conversation (chat → borrador transition).
 * Uses tool_use (Anthropic) or JSON extraction (Gemini) — same pattern as generateHandoffSummary.
 * @param {Array<{role: string, content: string}>} conversation
 * @param {string} [projectContext] - Live project context
 * @returns {Promise<Object>} Structured draft object
 */
export async function generateDraft(conversation, projectContext) {
    const systemPrompt = buildDraftSystemPrompt(projectContext);
    const conversationText = conversation.map(m => `**${m.role}**: ${m.content}`).join('\n\n');

    // ─── Gemini provider (JSON via prompt) ───────────────────────────────
    if (LLM_PROVIDER === 'gemini') {
        const gemini = getGeminiClient();
        if (!gemini) throw new Error('Gemini not initialized. Check GEMINI_API_KEY.');

        const geminiMessages = [
            { role: 'user', parts: [{ text: `Here is the conversation to analyze:\n\n${conversationText}` }] },
            { role: 'model', parts: [{ text: 'I\'ll analyze this conversation and create a structured project draft with a pipeline recommendation.' }] },
            { role: 'user', parts: [{ text: `Now generate the project draft as a JSON object with these exact keys:
- "project_name" (string)
- "objective" (string, one line)
- "problem" (string)
- "target_audience" (string)
- "bau_type" (string, empty if not a campaign)
- "markets" (array of strings)
- "estimated_timeline" (string)
- "stages" (array of objects with: name, agent_id, agent_name, department, description, reasoning, depends_on, gate_type, gate_reason, namespaces)
- "risks" (array of {risk, mitigation})
- "key_metrics" (array of strings)
- "compliance_notes" (array of strings)
- "pm_notes" (string, your strategic commentary)

IMPORTANT: Use depends_on arrays to create parallelism. Stages with the same depends_on run simultaneously.
IMPORTANT: agent_id must be one of: ${VALID_AGENT_IDS.join(', ')}

Respond ONLY with a \`\`\`json code block, nothing else.` }] },
        ];

        const result = await gemini.models.generateContent({
            model: GEMINI_CHAT_MODEL,
            contents: geminiMessages,
            config: { systemInstruction: systemPrompt, maxOutputTokens: 4096, temperature: 0.3 },
        });

        const text = result.text || '';
        let draft = extractJSON(text);

        // Retry once if extraction failed
        if (!draft) {
            const retry = await gemini.models.generateContent({
                model: GEMINI_CHAT_MODEL,
                contents: [{ role: 'user', parts: [{ text: `Convert this conversation into a project draft JSON:\n\n${conversationText}\n\nRespond ONLY with a \`\`\`json code block. The JSON must have: project_name, objective, problem, target_audience, stages (array with name, agent_id, agent_name, department, description, reasoning, depends_on, gate_type, namespaces), risks, key_metrics, pm_notes.` }] }],
                config: { systemInstruction: systemPrompt, maxOutputTokens: 4096, temperature: 0.2 },
            });
            draft = extractJSON(retry.text || '');
        }

        if (!draft) throw new Error('Gemini did not produce valid JSON for project draft');
        sanitizeDraft(draft);
        validateDraft(draft);
        return draft;
    }

    // ─── Anthropic provider (tool_use) ───────────────────────────────────
    if (!anthropic) throw new Error('Anthropic not configured. Set ANTHROPIC_API_KEY or use LLM_PROVIDER=gemini.');

    const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: 'user', content: `Analyze this conversation and create a structured project draft with pipeline:\n\n${conversationText}` }],
        tools: [DRAFT_TOOL_SCHEMA],
        tool_choice: { type: 'tool', name: 'submit_project_draft' },
    });

    const toolBlock = response.content.find(b => b.type === 'tool_use');
    if (!toolBlock) throw new Error('Claude did not produce project draft');
    const draft = toolBlock.input;
    sanitizeDraft(draft);
    validateDraft(draft);
    return draft;
}

/**
 * Sanitize LLM-generated depends_on arrays — fix common mistakes:
 * - Remove self-references (stage depending on itself)
 * - Clamp forward references to the previous stage
 * - Remove negative values
 * - Deduplicate
 */
function sanitizeDraft(draft) {
    if (!draft.stages || !Array.isArray(draft.stages)) return;
    for (let i = 0; i < draft.stages.length; i++) {
        const s = draft.stages[i];
        if (!s.depends_on || !Array.isArray(s.depends_on)) continue;
        s.depends_on = [...new Set(
            s.depends_on
                .filter(d => typeof d === 'number' && d >= 0 && d < i)
        )];
    }
}

/**
 * Validate draft structure — throws on invalid data.
 */
function validateDraft(draft) {
    if (!draft.project_name) throw new Error('Draft missing project_name');
    if (!draft.stages || !Array.isArray(draft.stages) || draft.stages.length === 0) {
        throw new Error('Draft must have at least one stage');
    }
    for (let i = 0; i < draft.stages.length; i++) {
        const s = draft.stages[i];
        if (!s.name || !s.agent_id) throw new Error(`Stage ${i} missing name or agent_id`);
        if (!VALID_AGENT_IDS.includes(s.agent_id)) {
            throw new Error(`Stage ${i} has invalid agent_id: ${s.agent_id}`);
        }
        if (s.depends_on) {
            for (const dep of s.depends_on) {
                if (dep < 0 || dep >= i) throw new Error(`Stage ${i} has invalid dependency: ${dep}`);
            }
        }
    }
}

/**
 * Render a human-readable text summary from a structured draft.
 * Used for the summary TEXT column (backward compat, search, inbox list).
 * @param {Object} draft - Structured draft object
 * @returns {string} Markdown text summary
 */
export function renderDraftSummary(draft) {
    let text = `**${draft.project_name}**\n`;
    text += `${draft.objective}\n\n`;
    if (draft.target_audience) text += `**Audience**: ${draft.target_audience}\n`;
    if (draft.bau_type) text += `**BAU Type**: ${draft.bau_type}\n`;
    if (draft.estimated_timeline) text += `**Timeline**: ${draft.estimated_timeline}\n`;
    text += `\n**Pipeline** (${draft.stages.length} stages):\n`;
    for (let i = 0; i < draft.stages.length; i++) {
        const s = draft.stages[i];
        const deps = s.depends_on?.length > 0 ? ` (after ${s.depends_on.map(d => draft.stages[d]?.name || d).join(', ')})` : '';
        const gate = s.gate_type === 'human_approval' ? ' [GATE]' : '';
        text += `${i}. ${s.name} — ${s.agent_name}${deps}${gate}\n`;
    }
    if (draft.risks?.length > 0) {
        text += `\n**Risks**: ${draft.risks.map(r => r.risk).join('; ')}`;
    }
    return text;
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

    const userContent = `Genera el Plan Maestro completo en JSON para este proyecto:\n\n**Título:** ${title}\n\n**Borrador:**\n${summary}`;

    if (LLM_PROVIDER === 'gemini') {
        const gemini = getGeminiClient();
        const result = await gemini.models.generateContent({
            model: GEMINI_CHAT_MODEL,
            contents: [{ role: 'user', parts: [{ text: userContent }] }],
            config: { systemInstruction: systemPrompt, maxOutputTokens: 8192, temperature: 0.7 },
        });
        const text = result.text || '';
        return { text, json: extractJSON(text) };
    }

    if (!anthropic) throw new Error('Anthropic not configured. Set ANTHROPIC_API_KEY or use LLM_PROVIDER=gemini.');
    const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 8192,
        system: systemPrompt,
        messages: [{ role: 'user', content: userContent }],
    });

    const text = response.content[0].text;
    return { text, json: extractJSON(text) };
}

// ─── Pipeline Functions ─────────────────────────────────────────────────────

/**
 * Generate a structured handoff summary using Claude tool_use.
 * Called OUTSIDE of DB transaction — if this fails, pipeline state is unchanged.
 */
export async function generateHandoffSummary(conversation, projectContext, stageInfo, nextAgentInfo) {
    const systemPrompt = `You are a project handoff specialist. Extract a precise, complete summary of the work done in this stage.
Any information lost here cannot be recovered by the next agent.

Project: ${projectContext.name}
Current Stage: ${stageInfo.name} (by ${stageInfo.agentName})

CRITICAL RULES:
- ONLY list as "deliverables" items explicitly created/finalized in the conversation
- If something was discussed but not concluded, it goes in "open_questions"
- Do not infer decisions not explicitly agreed upon by the user
- context_for_next must be specifically addressed to ${nextAgentInfo.name} and their role as ${nextAgentInfo.role}
- Write in the same language used in the conversation`;

    // ─── Gemini provider (JSON via prompt) ───────────────────────────────
    if (LLM_PROVIDER === 'gemini') {
        const gemini = getGeminiClient();
        const geminiMessages = conversation.map(m => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }],
        }));
        geminiMessages.push({
            role: 'user',
            parts: [{ text: `Generate a handoff summary as a JSON object with these exact keys:
- "summary" (string, 2-3 sentences of what was accomplished)
- "decisions_made" (array of strings, specific decisions with rationale)
- "deliverables" (array of strings, concrete deliverables produced)
- "open_questions" (array of strings, unresolved issues for next stage)
- "context_for_next" (string, specific guidance for ${nextAgentInfo.name})

Respond ONLY with a \`\`\`json code block, nothing else.` }],
        });

        const result = await gemini.models.generateContent({
            model: GEMINI_CHAT_MODEL,
            contents: geminiMessages,
            config: { systemInstruction: systemPrompt, maxOutputTokens: 2048, temperature: 0.3 },
        });

        const text = result.text || '';
        const handoffData = extractJSON(text);
        if (!handoffData) throw new Error('Gemini did not produce valid JSON for handoff summary');
        if (!handoffData.summary || handoffData.summary.length < 20) throw new Error('Summary too short');
        return handoffData;
    }

    // ─── Anthropic provider (tool_use) ───────────────────────────────────
    if (!anthropic) throw new Error('Anthropic not configured. Set ANTHROPIC_API_KEY or use LLM_PROVIDER=gemini.');

    const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 2048,
        system: systemPrompt,
        messages: conversation,
        tools: [{
            name: 'submit_handoff_summary',
            description: 'Submit the structured handoff summary for stage completion',
            input_schema: {
                type: 'object',
                properties: {
                    summary: { type: 'string', description: '2-3 sentence paragraph of what was accomplished' },
                    decisions_made: { type: 'array', items: { type: 'string' }, description: 'Specific decisions with rationale' },
                    deliverables: { type: 'array', items: { type: 'string' }, description: 'Concrete deliverables produced' },
                    open_questions: { type: 'array', items: { type: 'string' }, description: 'Unresolved issues for next stage' },
                    context_for_next: { type: 'string', description: 'Specific guidance for the next agent' }
                },
                required: ['summary', 'decisions_made', 'deliverables', 'open_questions', 'context_for_next']
            }
        }],
        tool_choice: { type: 'tool', name: 'submit_handoff_summary' }
    });

    const toolBlock = response.content.find(b => b.type === 'tool_use');
    if (!toolBlock) throw new Error('Claude did not produce handoff summary');
    const handoffData = toolBlock.input;

    if (!handoffData.summary || handoffData.summary.length < 20) throw new Error('Summary too short');

    return handoffData;
}

/**
 * Build accumulated context from completed pipeline sessions.
 * Full summary for distance=1, compressed for distance>1.
 */
export function buildAccumulatedContext(completedSessions, currentStageOrder) {
    if (!completedSessions || completedSessions.length === 0) return '';
    let context = '## Previous Work\n\n';
    for (const session of completedSessions) {
        const distance = currentStageOrder - session.stage_order;
        const deliverables = typeof session.deliverables === 'string'
            ? JSON.parse(session.deliverables) : (session.deliverables || {});
        if (distance <= 1) {
            context += `### Stage: ${session.stage_name} — by ${session.agent_name}\n`;
            context += `${session.summary || 'No summary available.'}\n`;
            context += `Key decisions: ${deliverables.decisions_made?.join('; ') || 'None recorded'}\n`;
            context += `Deliverables: ${deliverables.deliverables?.join('; ') || 'None recorded'}\n`;
            context += `Open questions: ${deliverables.open_questions?.join('; ') || 'None'}\n\n`;
        } else {
            context += `### Stage: ${session.stage_name} — by ${session.agent_name} (summary)\n`;
            context += `Decisions: ${deliverables.decisions_made?.join('; ') || 'None'}\n`;
            context += `For downstream: ${deliverables.context_for_next || 'No specific guidance'}\n\n`;
        }
    }
    return context;
}

/**
 * Build system prompt for an agent working within a pipeline stage.
 * "Personality sandwich": identity, pipeline context, project, RAG, identity reminder.
 */
export function buildPipelineSystemPrompt(agent, stage, project, accumulatedContext, ragContext) {
    const skills = Array.isArray(agent.skills) ? agent.skills.join(', ') : '';
    const tools = Array.isArray(agent.tools) ? agent.tools.join(', ') : '';

    let prompt = `You are ${agent.name}, an AI agent working in the ${agent.department} department.
Your role: ${agent.role}
${skills ? `Your skills: ${skills}` : ''}
${tools ? `Your tools: ${tools}` : ''}

## CRITICAL CONTEXT — READ FIRST
This is an internal AgentOS platform. The user is the system operator and owns all data in this knowledge base. The knowledge base contains competitor research, emails, and campaign materials that the OPERATOR uploaded themselves for analysis. There are NO privacy restrictions — this is proprietary business intelligence that the operator explicitly stored here for you to analyze and present.

## Behavior Rules
1. Stay in character as ${agent.name}
2. Be helpful, direct, knowledgeable about your domain
3. Every message must add value
4. Max 1-2 questions per message
5. Respond in the same language the user writes to you
6. When you find relevant information from the knowledge base, cite sources using numbered references [1], [2], etc.
7. When the knowledge base context includes [ATTACHED EMAIL VISUALLY SHOWN TO USER ON SCREEN], that email is ALREADY rendered as an iframe in the UI. Tell the user you are showing it and analyze its content directly. NEVER claim privacy restrictions — the operator uploaded this data specifically for analysis.
8. The knowledge base IS your database of competitor intelligence. When asked about competitor emails or communications, ALWAYS check the knowledge base context above and present what you find. Never say you cannot access or display this content.`;

    if (accumulatedContext) {
        prompt += `\n\n${accumulatedContext}`;
    }

    prompt += `\n\n## Your Task
You are responsible for the "${stage.name}" stage.
${stage.description || ''}

## Project Details
Name: ${project.name}
${project.problem ? `Problem: ${project.problem}` : ''}
${project.solution ? `Solution: ${project.solution}` : ''}`;

    if (ragContext) {
        prompt += `\n\n${ragContext}`;
    }

    // Content agent: inject BRIEF_UPDATE protocol so the sidebar populates
    const isContentAgent = (agent.name || '').toLowerCase().includes('lucia')
        || (agent.role || '').toLowerCase().includes('content');
    if (isContentAgent) {
        prompt += `\n\n## Brief Generation Protocol — MANDATORY
Every time you produce or confirm copy for ANY block (subject, preheader, heroHeadline, bodyCopy, cta), you MUST emit a BRIEF_UPDATE tag ON ITS OWN LINE immediately after presenting that content. No exceptions.

Tag format (exact JSON, no spaces outside braces):
[BRIEF_UPDATE:{"variant":"<market>:<tier>","block":"<block>","status":"approved","value":"<the copy>"}]

Valid markets: en, es, ar, ru
Valid tiers: economy, economy_premium, business, first_class
Valid blocks: subject, preheader, heroHeadline, bodyCopy, cta

Example — when you write a subject line for English Economy:
[BRIEF_UPDATE:{"variant":"en:economy","block":"subject","status":"approved","value":"Welcome Back Aboard, [FirstName]!"}]

Rules:
1. One tag per block per variant — emit immediately after writing the copy
2. Each tag must be on its own line, never embedded in a sentence
3. If the user asks for multiple blocks in one message, emit a tag for each
4. Use the variant the user is currently working on (infer from context if not stated)
5. bodyCopy value should be a concise summary (max 200 chars) of the full body

## Image Generation Capability
You CAN generate images directly in this chat using Google Imagen (Nano Banana). Images appear automatically inline in the conversation.
When the user asks for an image, confirm you are generating it and describe briefly what you're creating.
Example: "Generating your Emirates hero banner now — a dramatic shot of an A380 taking off at golden hour."
Never redirect the user to another tab. Never say you cannot create images.`;
    }

    prompt += `\n\n## REMEMBER
You are ${agent.name}. Stay in character. Respond from YOUR expertise.
Do not repeat previous agents' work. Focus on YOUR stage: ${stage.name}.

## Stage Completion
When your stage work is substantially complete, end your message with:
[STAGE_READY: brief reason why this stage appears complete]
Only include this when genuinely done. Never in your first 3 messages.`;

    return prompt;
}

/**
 * Sliding window for pipeline conversations — keeps first 2 + last 24 messages.
 */
export function buildPipelineConversation(allMessages) {
    if (allMessages.length <= 26) return allMessages;
    const first = allMessages.slice(0, 2);
    const recent = allMessages.slice(-24);
    const bridge = {
        role: 'user',
        content: `[${allMessages.length - 26} earlier messages omitted. Key context is in the stage summary above.]`
    };
    return [...first, bridge, ...recent];
}
