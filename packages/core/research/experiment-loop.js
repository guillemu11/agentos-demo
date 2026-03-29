/**
 * AutoExperiment Loop Engine
 *
 * Autonomous experimentation loop inspired by Karpathy's AutoResearch.
 * Runs cycles: generate challenger → simulate/measure → evaluate → learn → repeat.
 */

import Anthropic from '@anthropic-ai/sdk';
import { ingestDocument } from '../knowledge/ingestion.js';
import { isKBReady } from '../knowledge/retrieval.js';

// Active loops for scheduling & cancellation
const _activeLoops = new Map();

// Interval parsing: '1h' → ms, '4h' → ms, '12h' → ms, '24h' → ms
function parseInterval(interval) {
    const match = (interval || '4h').match(/^(\d+)(m|h)$/);
    if (!match) return 4 * 3600 * 1000;
    const [, num, unit] = match;
    return parseInt(num) * (unit === 'h' ? 3600000 : 60000);
}

/**
 * Run a single experiment cycle for a loop.
 *
 * @param {import('pg').Pool} pool
 * @param {number} loopId
 * @param {{ onCycleStart: Function, onCycleEnd: Function }} callbacks
 * @returns {Object} cycle result
 */
export async function runExperimentCycle(pool, loopId, callbacks = {}) {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    // 1. Load loop context
    const { rows: [loop] } = await pool.query(
        `SELECT * FROM experiment_loops WHERE id = $1`, [loopId]
    );
    if (!loop) throw new Error(`Loop ${loopId} not found`);
    if (loop.status === 'completed' || loop.status === 'failed') {
        throw new Error(`Loop ${loopId} is ${loop.status}`);
    }

    const cycleNumber = loop.cycle_count + 1;
    if (callbacks.onCycleStart) callbacks.onCycleStart({ loopId, cycleNumber });

    // Load previous cycles for context
    const { rows: prevCycles } = await pool.query(
        `SELECT cycle_number, hypothesis, winner, improvement_pct, learnings
         FROM experiment_cycles WHERE loop_id = $1 ORDER BY cycle_number DESC LIMIT 10`,
        [loopId]
    );

    // 2. Create cycle record
    const { rows: [cycle] } = await pool.query(
        `INSERT INTO experiment_cycles (loop_id, cycle_number, status, baseline)
         VALUES ($1, $2, 'generating', $3) RETURNING id`,
        [loopId, cycleNumber, JSON.stringify(loop.current_baseline || {})]
    );
    const cycleId = cycle.id;

    try {
        // 3. Generate challenger via Claude
        const baselineDesc = loop.current_baseline
            ? JSON.stringify(loop.current_baseline, null, 2)
            : 'No baseline set yet — this is the first cycle. Generate an initial variant.';

        const previousContext = prevCycles.length > 0
            ? `\n## Previous Experiments\n${prevCycles.map(c =>
                `- Cycle ${c.cycle_number}: ${c.hypothesis} → Winner: ${c.winner}${c.improvement_pct ? ` (+${c.improvement_pct}%)` : ''}`
            ).join('\n')}`
            : '';

        const knowledgeContext = loop.knowledge_md
            ? `\n## Accumulated Knowledge\n${loop.knowledge_md}`
            : '';

        const challengerPrompt = `You are an expert email marketing optimizer running an autonomous A/B testing loop for Emirates Airlines campaigns.

## Campaign
- Campaign: ${loop.campaign_id}
- Optimization target: ${loop.metric_target}
- Experiment type: ${loop.experiment_type}
- Cycle: ${cycleNumber} of ${loop.max_cycles}

## Current Baseline
${baselineDesc}
${previousContext}
${knowledgeContext}

## Task
Generate a challenger variant that aims to improve ${loop.metric_target} by modifying the ${loop.experiment_type}.
Be creative but grounded in email marketing best practices.
${prevCycles.length > 0 ? 'Use accumulated knowledge from previous cycles to make smarter decisions.' : 'This is the first cycle — establish a strong initial hypothesis.'}

Return ONLY valid JSON (no markdown, no code fences):
{
  "hypothesis": "Clear statement of what change you're making and why it should improve ${loop.metric_target}",
  "challenger": {
    "description": "Detailed description of the challenger variant",
    "changes": ["list", "of", "specific", "changes"]
  },
  "reasoning": "Why this should work based on email marketing principles and any accumulated knowledge"
}`;

        const challengerRes = await anthropic.messages.create({
            model: 'claude-sonnet-4-6',
            max_tokens: 1024,
            messages: [{ role: 'user', content: challengerPrompt }],
        });

        let challengerData;
        try {
            const raw = challengerRes.content[0]?.text || '{}';
            // Strip any markdown code fences if present
            const cleaned = raw.replace(/```(?:json)?\s*/g, '').replace(/```/g, '').trim();
            challengerData = JSON.parse(cleaned);
        } catch {
            challengerData = {
                hypothesis: 'AI generation parsing failed — using default hypothesis',
                challenger: { description: 'Variant with minor copy adjustments', changes: ['minor tweaks'] },
                reasoning: 'Fallback variant',
            };
        }

        await pool.query(
            `UPDATE experiment_cycles SET status = 'deployed', hypothesis = $1, challenger = $2, updated_at = NOW() WHERE id = $3`,
            [challengerData.hypothesis, JSON.stringify(challengerData.challenger), cycleId]
        );

        // 4. Simulate measurement (MVP — in production, replace with ESP API)
        await pool.query(
            `UPDATE experiment_cycles SET status = 'measuring', updated_at = NOW() WHERE id = $1`,
            [cycleId]
        );

        const baseMetrics = loop.best_result || { openRate: 24.5, clickRate: 8.2, conversionRate: 3.1 };
        const baselineMetrics = simulateMetrics(baseMetrics, loop.metric_target, false);
        const challengerMetrics = simulateMetrics(baseMetrics, loop.metric_target, true, prevCycles.length);

        // 5. Evaluate winner
        const metric = loop.metric_target;
        const baseVal = baselineMetrics[metric];
        const challVal = challengerMetrics[metric];
        const improvementPct = ((challVal - baseVal) / baseVal * 100);
        const challengerWins = improvementPct >= 1.0; // Must beat by at least 1%
        const winner = challengerWins ? 'challenger' : 'baseline';

        // 6. Generate learnings via Claude
        const learningsPrompt = `You are an email marketing analyst. Summarize the learnings from this A/B test cycle in 2-3 concise sentences.

Hypothesis: ${challengerData.hypothesis}
Winner: ${winner}
${metric} improvement: ${improvementPct.toFixed(1)}%
Baseline ${metric}: ${baseVal.toFixed(1)}%
Challenger ${metric}: ${challVal.toFixed(1)}%

Be specific about what worked or didn't. Return ONLY the learning text, no formatting.`;

        let learnings = '';
        try {
            const learnRes = await anthropic.messages.create({
                model: 'claude-sonnet-4-6',
                max_tokens: 256,
                messages: [{ role: 'user', content: learningsPrompt }],
            });
            learnings = learnRes.content[0]?.text || '';
        } catch {
            learnings = `Cycle ${cycleNumber}: ${winner} won. ${metric} ${improvementPct > 0 ? 'improved' : 'decreased'} by ${Math.abs(improvementPct).toFixed(1)}%.`;
        }

        // Update cycle record
        await pool.query(
            `UPDATE experiment_cycles SET
                status = 'evaluated', baseline_metrics = $1, challenger_metrics = $2,
                winner = $3, improvement_pct = $4, learnings = $5, updated_at = NOW()
             WHERE id = $6`,
            [JSON.stringify(baselineMetrics), JSON.stringify(challengerMetrics),
             winner, improvementPct.toFixed(2), learnings, cycleId]
        );

        // 7. Update loop state
        const newBaseline = challengerWins ? challengerData.challenger : (loop.current_baseline || challengerData.challenger);
        const newBestResult = challengerWins ? challengerMetrics : (loop.best_result || baselineMetrics);
        const initialBase = loop.best_result || baseMetrics;
        const totalImprovement = ((newBestResult[metric] - initialBase[metric]) / initialBase[metric] * 100);

        // Append to knowledge
        const knowledgeEntry = `\n### Cycle ${cycleNumber}\n- **Hypothesis**: ${challengerData.hypothesis}\n- **Winner**: ${winner} (${improvementPct > 0 ? '+' : ''}${improvementPct.toFixed(1)}% ${metric})\n- **Learning**: ${learnings}\n`;
        const newKnowledge = (loop.knowledge_md || '') + knowledgeEntry;

        const isComplete = cycleNumber >= loop.max_cycles;
        const newStatus = isComplete ? 'completed' : loop.status;

        await pool.query(
            `UPDATE experiment_loops SET
                cycle_count = $1, current_baseline = $2, best_result = $3,
                total_improvement_pct = $4, knowledge_md = $5, status = $6, updated_at = NOW()
             WHERE id = $7`,
            [cycleNumber, JSON.stringify(newBaseline), JSON.stringify(newBestResult),
             totalImprovement.toFixed(2), newKnowledge, newStatus, loopId]
        );

        // 8. Auto-ingest learnings into KB
        if (isKBReady() && cycleNumber % 5 === 0) {
            try {
                await ingestDocument(pool, {
                    title: `AutoExperiment: ${loop.campaign_id} - Cycles 1-${cycleNumber}`,
                    content: newKnowledge,
                    namespace: 'research',
                    sourceType: 'experiment_loop',
                    sourceId: `loop-${loopId}`,
                    metadata: { loop_id: loopId, campaign_id: loop.campaign_id, cycles: cycleNumber },
                });
            } catch { /* non-critical */ }
        }

        const result = { cycleId, cycleNumber, winner, improvementPct, learnings, isComplete };
        if (callbacks.onCycleEnd) callbacks.onCycleEnd(result);
        return result;

    } catch (err) {
        await pool.query(
            `UPDATE experiment_cycles SET status = 'failed', learnings = $1, updated_at = NOW() WHERE id = $2`,
            [err.message, cycleId]
        );
        await pool.query(
            `UPDATE experiment_loops SET status = 'failed', updated_at = NOW() WHERE id = $1`,
            [loopId]
        );
        throw err;
    }
}

/**
 * Simulate metrics for MVP demo.
 * In production, replace with real ESP API integration (Salesforce Marketing Cloud, etc.)
 */
function simulateMetrics(base, targetMetric, isChallenger, cyclesSoFar = 0) {
    const metrics = { ...base };
    const allMetrics = ['openRate', 'clickRate', 'conversionRate'];

    for (const m of allMetrics) {
        const baseVal = typeof metrics[m] === 'number' ? metrics[m] : 24;
        // Natural variance: ±2%
        const variance = (Math.random() - 0.5) * baseVal * 0.04;

        if (isChallenger && m === targetMetric) {
            // Challenger has ~55% chance of improvement, increases with more cycles (learning effect)
            const learningBonus = Math.min(cyclesSoFar * 0.02, 0.15);
            const improvementChance = 0.55 + learningBonus;
            const direction = Math.random() < improvementChance ? 1 : -1;
            const magnitude = Math.random() * baseVal * 0.06; // Up to 6% change
            metrics[m] = Math.max(0.1, baseVal + (direction * magnitude) + variance);
        } else {
            metrics[m] = Math.max(0.1, baseVal + variance);
        }

        metrics[m] = parseFloat(metrics[m].toFixed(2));
    }

    return metrics;
}

/**
 * Start an automated loop that runs cycles on an interval.
 */
export function startAutoLoop(pool, loopId, interval) {
    stopAutoLoop(loopId);
    const ms = parseInterval(interval);

    const runNext = async () => {
        try {
            const { rows: [loop] } = await pool.query(
                `SELECT status, cycle_count, max_cycles FROM experiment_loops WHERE id = $1`, [loopId]
            );
            if (!loop || loop.status !== 'running' || loop.cycle_count >= loop.max_cycles) {
                stopAutoLoop(loopId);
                return;
            }
            await runExperimentCycle(pool, loopId);
        } catch (err) {
            console.error(`[AutoExperiment] Loop ${loopId} cycle failed:`, err.message);
        }

        // Schedule next if still active
        if (_activeLoops.has(loopId)) {
            const timer = setTimeout(runNext, ms);
            _activeLoops.set(loopId, timer);
        }
    };

    // Run first cycle immediately, then schedule
    const timer = setTimeout(runNext, 100);
    _activeLoops.set(loopId, timer);
}

/**
 * Stop an automated loop.
 */
export function stopAutoLoop(loopId) {
    const timer = _activeLoops.get(loopId);
    if (timer) {
        clearTimeout(timer);
        _activeLoops.delete(loopId);
    }
}

/**
 * Resume all running loops on server start.
 */
export async function resumeActiveLoops(pool) {
    try {
        const { rows } = await pool.query(
            `SELECT id, cycle_interval FROM experiment_loops WHERE status = 'running'`
        );
        for (const loop of rows) {
            console.log(`[AutoExperiment] Resuming loop ${loop.id}`);
            startAutoLoop(pool, loop.id, loop.cycle_interval);
        }
    } catch (err) {
        console.error('[AutoExperiment] Failed to resume loops:', err.message);
    }
}

/**
 * Check if a loop is actively running.
 */
export function isLoopActive(loopId) {
    return _activeLoops.has(loopId);
}
