import defaultPool from '../db/pool.js';

/**
 * EOD Report Generator
 * Pulls raw events for an agent and day, and generates a structured report.
 * @param {string} agentId
 * @param {string} date - YYYY-MM-DD
 * @param {import('pg').Pool} [externalPool] - Optional pool to avoid double connections when called from server.js
 */
export async function generateEodReport(agentId, date = new Date().toISOString().split('T')[0], externalPool) {
    const pool = externalPool || defaultPool;
    console.log(`[EOD Gen] Processing report for ${agentId} on ${date}...`);

    // 1. Fetch raw events
    const res = await pool.query(
        `SELECT * FROM raw_events
         WHERE agent_id = $1 AND timestamp::date = $2::date
         ORDER BY timestamp ASC`,
        [agentId, date]
    );
    const events = res.rows;

    // Fetch active pipeline sessions for this agent
    const pipelineRes = await pool.query(
        `SELECT pas.stage_name, pas.status, p.name as project_name
         FROM project_agent_sessions pas
         JOIN projects p ON p.id = pas.project_id
         WHERE pas.agent_id = $1 AND pas.status IN ('active', 'pending', 'awaiting_handoff')`,
        [agentId]
    );

    if (events.length === 0) {
        console.log(`[EOD Gen] No events found for ${agentId} on ${date}.`);
        return null;
    }

    // 2. Summarize events into structured report
    //    TODO: Replace with LLM call for richer summaries
    const completed = [];
    const inProgress = [];
    const blockers = [];
    const insights = [];

    for (const e of events) {
        const c = e.content;
        if (c.status === 'success' || c.status === 'completed') {
            completed.push({ desc: c.description || `${e.event_type}: ${c.tool || c.action || 'task'}`, duration: c.duration || null });
        } else if (c.status === 'error' || c.status === 'blocked') {
            blockers.push({ desc: c.description || c.error || `Error in ${e.event_type}`, severity: c.severity || 'medium' });
        } else {
            inProgress.push({ desc: c.description || `${e.event_type} in progress`, pct: c.progress || 50 });
        }
        if (c.insight) {
            insights.push(c.insight);
        }
    }

    // Add pipeline tickets to in-progress
    for (const ticket of pipelineRes.rows) {
        inProgress.push({
            desc: `[Pipeline] ${ticket.project_name} — ${ticket.stage_name}`,
            pct: ticket.status === 'active' ? 50 : ticket.status === 'awaiting_handoff' ? 90 : 10,
        });
    }

    const report = {
        agent_id: agentId,
        date,
        completed_tasks: completed,
        in_progress_tasks: inProgress,
        blockers,
        insights,
        plan_tomorrow: [],
        mood: blockers.length > 0 ? 'blocked' : completed.length > 2 ? 'productive' : 'focused',
    };

    // 3. Persist
    const saveRes = await pool.query(
        `INSERT INTO eod_reports (agent_id, date, completed_tasks, in_progress_tasks, blockers, insights, plan_tomorrow, mood)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (agent_id, date) DO UPDATE
         SET completed_tasks = EXCLUDED.completed_tasks,
             in_progress_tasks = EXCLUDED.in_progress_tasks,
             blockers = EXCLUDED.blockers,
             insights = EXCLUDED.insights,
             plan_tomorrow = EXCLUDED.plan_tomorrow,
             mood = EXCLUDED.mood
         RETURNING id`,
        [report.agent_id, report.date,
         JSON.stringify(report.completed_tasks), JSON.stringify(report.in_progress_tasks),
         JSON.stringify(report.blockers), JSON.stringify(report.insights),
         JSON.stringify(report.plan_tomorrow), report.mood]
    );

    console.log(`[EOD Gen] Report saved (ID: ${saveRes.rows[0].id})`);
    return report;
}

// CLI usage
if (process.argv[2] === '--test') {
    await generateEodReport(process.argv[3] || 'data-agent');
    await defaultPool.end();
}
