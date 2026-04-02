/**
 * AgentOS — Guardar Proyecto
 *
 * Persiste el breakdown estructurado del PM Agent en PostgreSQL.
 */

import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
    host: process.env.PG_HOST || 'localhost',
    port: parseInt(process.env.PG_PORT || '5434', 10),
    database: process.env.PG_DB || 'agentos',
    user: process.env.PG_USER || 'agentos',
    password: process.env.PG_PASSWORD || 'changeme',
});

/**
 * Guarda un proyecto completo con sus fases y tareas.
 * @param {Object} data - JSON estructurado del PM Agent
 * @returns {number} ID del proyecto creado
 */
export async function saveProject(data, externalClient = null) {
    const client = externalClient || await pool.connect();
    const ownTransaction = !externalClient;
    try {
        if (ownTransaction) await client.query('BEGIN');

        // 1. Insertar Proyecto
        const projectRes = await client.query(
            `INSERT INTO projects (name, problem, solution, success_metrics, blocks, department, sub_area, pain_points, requirements, risks, estimated_budget, estimated_timeline, future_improvements, status, objective, target_audience, bau_type, markets, pm_notes, key_metrics, compliance_notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
       RETURNING id`,
            [
                data.project_name,
                data.problem,
                data.solution,
                JSON.stringify(data.success_metrics || []),
                JSON.stringify(data.blocks || []),
                data.department || 'General',
                data.sub_area || 'General',
                JSON.stringify(data.pain_points || []),
                JSON.stringify(data.requirements || []),
                JSON.stringify(data.risks || []),
                data.estimated_budget || 0,
                data.estimated_timeline || 'TBD',
                JSON.stringify(data.future_improvements || []),
                'Planning',
                data.objective || '',
                data.target_audience || '',
                data.bau_type || '',
                JSON.stringify(data.markets || []),
                data.pm_notes || '',
                JSON.stringify(data.key_metrics || []),
                JSON.stringify(data.compliance_notes || [])
            ]
        );
        const projectId = projectRes.rows[0].id;

        // 2. Insertar Fases y Tareas
        if (data.phases && Array.isArray(data.phases)) {
            for (const phase of data.phases) {
                const phaseRes = await client.query(
                    `INSERT INTO phases (project_id, phase_number, name, objective)
           VALUES ($1, $2, $3, $4)
           RETURNING id`,
                    [projectId, phase.phase_number, phase.phase_name, phase.objective]
                );
                const phaseId = phaseRes.rows[0].id;

                if (phase.functionalities && Array.isArray(phase.functionalities)) {
                    for (const func of phase.functionalities) {
                        // En el schema actual las tareas cuelgan de la fase directamente, 
                        // pero el JSON del bot incluye "functionalities". 
                        // Vamos a aplanar las tareas de las funcionalidades a la fase, 
                        // o podríamos añadir una tabla functionalities. 
                        // Por simplicidad para el "tipo Notion", aplanamos a la fase 
                        // prefijando la funcionalidad en la descripción si es necesario.

                        if (func.tasks && Array.isArray(func.tasks)) {
                            for (const task of func.tasks) {
                                await client.query(
                                    `INSERT INTO tasks (phase_id, description, agent, effort, status, dependencies, type, priority)
                   VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                                    [
                                        phaseId,
                                        `[${func.name}] ${task.description}`,
                                        task.agent,
                                        task.effort,
                                        'Todo',
                                        JSON.stringify(task.dependencies || []),
                                        task.type || 'Task',
                                        task.priority || 'Medium'
                                    ]
                                );
                            }
                        }
                    }
                }
            }
        }

        if (ownTransaction) await client.query('COMMIT');
        return projectId;
    } catch (err) {
        if (ownTransaction) await client.query('ROLLBACK');
        throw err;
    } finally {
        if (!externalClient) client.release();
    }
}

/**
 * Actualiza un proyecto existente (sobrescribe fases y tareas).
 */
export async function updateProject(projectId, data) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Actualizar Proyecto base
        await client.query(
            `UPDATE projects 
       SET name = $1, problem = $2, solution = $3, success_metrics = $4, blocks = $5, department = $6, sub_area = $7, 
           pain_points = $8, requirements = $9, risks = $10, estimated_budget = $11, estimated_timeline = $12, 
           future_improvements = $13, objective = $14, target_audience = $15, bau_type = $16, markets = $17, 
           pm_notes = $18, key_metrics = $19, compliance_notes = $20, updated_at = NOW()
       WHERE id = $21`,
            [
                data.project_name,
                data.problem,
                data.solution,
                JSON.stringify(data.success_metrics || []),
                JSON.stringify(data.blocks || []),
                data.department || 'General',
                data.sub_area || 'General',
                JSON.stringify(data.pain_points || []),
                JSON.stringify(data.requirements || []),
                JSON.stringify(data.risks || []),
                data.estimated_budget || 0,
                data.estimated_timeline || 'TBD',
                JSON.stringify(data.future_improvements || []),
                data.objective || '',
                data.target_audience || '',
                data.bau_type || '',
                JSON.stringify(data.markets || []),
                data.pm_notes || '',
                JSON.stringify(data.key_metrics || []),
                JSON.stringify(data.compliance_notes || []),
                projectId
            ]
        );

        // 2. Limpiar fases y tareas antiguas para re-insertar
        // (En un sistema real querríamos ser más granulares, pero para el prototipo 
        // de PM Agent, el bot genera el breakdown entero de nuevo).
        await client.query('DELETE FROM phases WHERE project_id = $1', [projectId]);

        // 3. Re-insertar Fases y Tareas
        if (data.phases && Array.isArray(data.phases)) {
            for (const phase of data.phases) {
                const phaseRes = await client.query(
                    `INSERT INTO phases (project_id, phase_number, name, objective)
           VALUES ($1, $2, $3, $4)
           RETURNING id`,
                    [projectId, phase.phase_number, phase.phase_name, phase.objective]
                );
                const phaseId = phaseRes.rows[0].id;

                if (phase.functionalities && Array.isArray(phase.functionalities)) {
                    for (const func of phase.functionalities) {
                        if (func.tasks && Array.isArray(func.tasks)) {
                            for (const task of func.tasks) {
                                await client.query(
                                    `INSERT INTO tasks (phase_id, description, agent, effort, status, dependencies, type, priority)
                   VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                                    [
                                        phaseId,
                                        `[${func.name}] ${task.description}`,
                                        task.agent,
                                        task.effort,
                                        'Todo',
                                        JSON.stringify(task.dependencies || []),
                                        task.type || 'Task',
                                        task.priority || 'Medium'
                                    ]
                                );
                            }
                        }
                    }
                }
            }
        }

        await client.query('COMMIT');
        return projectId;
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}

/**
 * Inyecta una tarea rápida en un proyecto existente.
 * La inserta en la última fase del proyecto.
 * @param {number} projectId - ID del proyecto
 * @param {Object} taskData - { description, agent, effort, type, priority, justification }
 * @returns {Object} Tarea creada
 */
export async function addTaskToProject(projectId, taskData) {
    const client = await pool.connect();
    try {
        // Buscar la última fase del proyecto
        const phaseRes = await client.query(
            'SELECT id FROM phases WHERE project_id = $1 ORDER BY phase_number DESC LIMIT 1',
            [projectId]
        );

        let phaseId;
        if (phaseRes.rows.length === 0) {
            // Si no hay fases, crear una fase "Backlog"
            const newPhase = await client.query(
                `INSERT INTO phases (project_id, phase_number, name, objective)
                 VALUES ($1, 0, 'Backlog', 'Tareas inyectadas vía /task') RETURNING id`,
                [projectId]
            );
            phaseId = newPhase.rows[0].id;
        } else {
            phaseId = phaseRes.rows[0].id;
        }

        const result = await client.query(
            `INSERT INTO tasks (phase_id, description, agent, effort, status, type, priority, dependencies)
             VALUES ($1, $2, $3, $4, 'Todo', $5, $6, '[]') RETURNING *`,
            [
                phaseId,
                taskData.description,
                taskData.agent || 'dev-agent',
                taskData.effort || 'M',
                taskData.type || 'Task',
                taskData.priority || 'Medium',
            ]
        );
        return result.rows[0];
    } finally {
        client.release();
    }
}

// Para cerrar el pool si se usa como script
export async function closePool() {
    await pool.end();
}
