/**
 * AutoResearch Engine
 *
 * Autonomous research loop: generates queries, searches web (Gemini grounding)
 * and internal KB (Pinecone), synthesizes findings with Claude, proposes experiments.
 */

import Anthropic from '@anthropic-ai/sdk';
import { searchKnowledge, isKBReady } from '../knowledge/retrieval.js';
import { ingestDocument } from '../knowledge/ingestion.js';

const DEPTH_MAP = { quick: 2, standard: 5, deep: 10 };

// Active research sessions for cancellation
const _activeSessions = new Map();

/**
 * Start a research session.
 *
 * @param {import('pg').Pool} pool
 * @param {number} sessionId - ID from research_sessions table
 * @param {{ topic: string, depth: string, sourcesMode: string, campaignId?: string }} config
 * @param {{ onProgress: Function, onQuery: Function, onSource: Function, onPhase: Function }} callbacks
 */
export async function startResearch(pool, sessionId, config, callbacks = {}) {
    const { topic, depth = 'standard', sourcesMode = 'both', campaignId } = config;
    const maxIterations = DEPTH_MAP[depth] || 5;
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    _activeSessions.set(sessionId, { cancelled: false });

    const emit = (type, data) => {
        if (callbacks[type]) callbacks[type](data);
    };

    try {
        await pool.query(
            `UPDATE research_sessions SET status = 'researching', updated_at = NOW() WHERE id = $1`,
            [sessionId]
        );
        emit('onPhase', 'researching');

        let allFindings = [];
        let allQueries = [];
        let allSources = [];

        for (let iteration = 0; iteration < maxIterations; iteration++) {
            if (_activeSessions.get(sessionId)?.cancelled) break;

            const progress = Math.round(((iteration) / maxIterations) * 80);
            emit('onProgress', progress);

            // 1. Generate search queries
            const queryPrompt = iteration === 0
                ? `Generate 3-5 specific search queries to research the following topic. Return ONLY a JSON array of strings.\n\nTopic: ${topic}\n${allFindings.length > 0 ? `\nPrevious findings so far:\n${allFindings.slice(-3).map(f => f.summary).join('\n')}\n\nFocus on gaps not yet covered.` : ''}`
                : `Based on these research findings so far, generate 2-3 follow-up search queries to fill knowledge gaps. Return ONLY a JSON array of strings.\n\nTopic: ${topic}\nFindings:\n${allFindings.slice(-5).map(f => '- ' + f.summary).join('\n')}`;

            const queryRes = await anthropic.messages.create({
                model: 'claude-sonnet-4-6',
                max_tokens: 512,
                messages: [{ role: 'user', content: queryPrompt }],
            });

            let queries = [];
            try {
                const text = queryRes.content[0]?.text || '[]';
                const match = text.match(/\[[\s\S]*\]/);
                queries = match ? JSON.parse(match[0]) : [];
            } catch { queries = [topic]; }

            for (const q of queries) {
                allQueries.push(q);
                emit('onQuery', q);
            }

            // 2. Web search via Gemini grounding (simulated via Claude for now)
            if (sourcesMode === 'web' || sourcesMode === 'both') {
                for (const q of queries) {
                    if (_activeSessions.get(sessionId)?.cancelled) break;

                    try {
                        const webRes = await anthropic.messages.create({
                            model: 'claude-sonnet-4-6',
                            max_tokens: 1024,
                            messages: [{
                                role: 'user',
                                content: `Act as a research analyst. Based on your knowledge, provide a detailed research summary for the query: "${q}"\n\nInclude specific data points, statistics, best practices, and competitive insights. Format as a structured summary with key findings.`,
                            }],
                        });

                        const finding = webRes.content[0]?.text || '';
                        if (finding) {
                            const source = { type: 'web', query: q, content: finding, summary: finding.slice(0, 200) };
                            allFindings.push(source);
                            allSources.push({ type: 'web', query: q, snippet: finding.slice(0, 150) });
                            emit('onSource', { type: 'web', query: q });
                        }
                    } catch { /* continue */ }
                }
            }

            // 3. Internal KB search
            if ((sourcesMode === 'internal' || sourcesMode === 'both') && isKBReady()) {
                for (const q of queries.slice(0, 2)) {
                    if (_activeSessions.get(sessionId)?.cancelled) break;

                    try {
                        const kbResults = await searchKnowledge(pool, q, { topK: 3, minScore: 0.6 });
                        for (const r of kbResults) {
                            const source = { type: 'internal', query: q, content: r.content, summary: r.documentTitle, score: r.score };
                            allFindings.push(source);
                            allSources.push({ type: 'internal', title: r.documentTitle, score: r.score });
                            emit('onSource', { type: 'internal', title: r.documentTitle });
                        }
                    } catch { /* continue */ }
                }
            }

            // Persist progress
            await pool.query(
                `UPDATE research_sessions SET iterations = $1, sources_found = $2, search_queries = $3, sources = $4, progress = $5, updated_at = NOW() WHERE id = $6`,
                [iteration + 1, allSources.length, JSON.stringify(allQueries), JSON.stringify(allSources), progress, sessionId]
            );
        }

        if (_activeSessions.get(sessionId)?.cancelled) {
            await pool.query(`UPDATE research_sessions SET status = 'failed', error = 'Cancelled by user', updated_at = NOW() WHERE id = $1`, [sessionId]);
            emit('onPhase', 'cancelled');
            return;
        }

        // 4. Synthesis phase
        emit('onPhase', 'synthesizing');
        emit('onProgress', 85);

        const synthesisPrompt = `You are a senior research analyst. Synthesize the following research findings into a comprehensive report.

Topic: ${topic}
${campaignId ? `Campaign context: This research is for improving campaign "${campaignId}"` : ''}

## Research Findings
${allFindings.map((f, i) => `### Finding ${i + 1} (${f.type})\n${f.content}`).join('\n\n')}

## Required Report Structure (use markdown):
1. **Executive Summary** (3-5 sentences)
2. **Key Findings** (from web research)
3. **Internal Insights** (from knowledge base, if any)
4. **Competitive Analysis** (if applicable)
5. **Recommendations** (5-7 actionable items)
6. **Proposed Experiments** (3-5 A/B test ideas with hypothesis and expected improvement)

For the Proposed Experiments section, also output a JSON block at the end:
\`\`\`experiments
[{"type":"subject_line|copy|design|segmentation|send_time|cta","hypothesis":"...","variant_a":"...","variant_b":"...","expected_improvement":5}]
\`\`\``;

        const synthesisRes = await anthropic.messages.create({
            model: 'claude-sonnet-4-6',
            max_tokens: 4096,
            messages: [{ role: 'user', content: synthesisPrompt }],
        });

        const reportText = synthesisRes.content[0]?.text || '';

        // Extract experiments JSON
        let experiments = [];
        const expMatch = reportText.match(/```experiments\s*([\s\S]*?)```/);
        if (expMatch) {
            try { experiments = JSON.parse(expMatch[1]); } catch { /* ignore */ }
        }

        // Extract recommendations
        let recommendations = [];
        const recMatch = reportText.match(/## Recommendations\s*([\s\S]*?)(?=##|```|$)/i);
        if (recMatch) {
            recommendations = recMatch[1].split('\n').filter(l => l.trim().startsWith('-') || l.trim().match(/^\d/)).map(l => l.replace(/^[-\d.)\s]+/, '').trim()).filter(Boolean);
        }

        emit('onProgress', 95);

        // 5. Save experiments to DB
        for (const exp of experiments) {
            await pool.query(
                `INSERT INTO campaign_experiments (campaign_id, research_session_id, experiment_type, hypothesis, variant_a, variant_b, status)
                 VALUES ($1, $2, $3, $4, $5, $6, 'proposed')`,
                [campaignId || 'general', sessionId, exp.type || 'copy', exp.hypothesis || '', JSON.stringify({ description: exp.variant_a }), JSON.stringify({ description: exp.variant_b })]
            );
        }

        // 6. Finalize session
        await pool.query(
            `UPDATE research_sessions SET status = 'completed', progress = 100, report_md = $1, experiments = $2, recommendations = $3, completed_at = NOW(), updated_at = NOW() WHERE id = $4`,
            [reportText, JSON.stringify(experiments), JSON.stringify(recommendations), sessionId]
        );

        emit('onProgress', 100);
        emit('onPhase', 'completed');

        // 7. Auto-ingest report into KB
        if (isKBReady()) {
            try {
                await ingestDocument(pool, {
                    title: `Research: ${topic.slice(0, 100)}`,
                    content: reportText,
                    namespace: 'research',
                    sourceType: 'research_report',
                    sourceId: `research-${sessionId}`,
                    metadata: { session_id: sessionId, campaign_id: campaignId, topic },
                });
            } catch { /* non-critical */ }
        }

    } catch (err) {
        await pool.query(
            `UPDATE research_sessions SET status = 'failed', error = $1, updated_at = NOW() WHERE id = $2`,
            [err.message, sessionId]
        );
        emit('onPhase', 'failed');
        throw err;
    } finally {
        _activeSessions.delete(sessionId);
    }
}

/**
 * Cancel an active research session.
 */
export function cancelResearch(sessionId) {
    const session = _activeSessions.get(sessionId);
    if (session) session.cancelled = true;
}

/**
 * Check if a session is currently running.
 */
export function isResearchActive(sessionId) {
    return _activeSessions.has(sessionId);
}
