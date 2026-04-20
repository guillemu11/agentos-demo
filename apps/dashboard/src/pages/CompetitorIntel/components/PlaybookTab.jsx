import { useState } from 'react';

const API = import.meta.env.VITE_API_URL || '/api';

function StepCard({ step, onAction, isCurrent }) {
    const [noteOpen, setNoteOpen] = useState(false);
    const [note, setNote] = useState(step.notes || '');
    const statusClass = `ci-step-status ci-step-status--${step.status}`;

    async function act(status) {
        await onAction(step.id, { status, notes: note || null });
        setNoteOpen(false);
    }

    return (
        <li className={`ci-step${isCurrent ? ' is-current' : ''}`} data-status={step.status}>
            <div className="ci-step-head">
                <span className="ci-step-order">Step {step.step_order}</span>
                <span className={statusClass}>{step.status}</span>
                {step.executed_at && (
                    <time className="ci-step-time">
                        {new Date(step.executed_at).toLocaleString(undefined, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </time>
                )}
            </div>
            <p className="ci-step-action">{step.action}</p>
            {step.expected_signal && (
                <p className="ci-step-expect">
                    <span className="ci-eyebrow" style={{ display: 'inline', marginRight: 6 }}>Expect</span>
                    {step.expected_signal}
                </p>
            )}
            {step.notes && (
                <div className="ci-step-notes">{step.notes}</div>
            )}
            {step.status !== 'done' && step.status !== 'skipped' && (
                <div className="ci-step-actions">
                    {noteOpen ? (
                        <>
                            <textarea
                                placeholder="Notes (what you actually did, what you saw…)"
                                value={note}
                                onChange={e => setNote(e.target.value)}
                                className="ci-step-note-input"
                            />
                            <button className="ci-btn ci-btn-primary" onClick={() => act('done')}>Save & Mark done</button>
                            <button className="ci-btn ci-btn-outline" onClick={() => setNoteOpen(false)}>Cancel</button>
                        </>
                    ) : (
                        <>
                            <button className="ci-btn ci-btn-primary" onClick={() => act('done')}>Mark done</button>
                            <button className="ci-btn ci-btn-outline" onClick={() => setNoteOpen(true)}>Add note & done</button>
                            <button className="ci-btn ci-btn-outline" onClick={() => act('skipped')}>Skip</button>
                        </>
                    )}
                </div>
            )}
        </li>
    );
}

export default function PlaybookTab({ steps, onChange }) {
    async function updateStep(id, body) {
        await fetch(`${API}/competitor-intel/playbook-steps/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        onChange?.();
    }

    // Group by persona; within each, find the first non-done/skipped step = current
    const byPersona = new Map();
    for (const s of steps) {
        if (!byPersona.has(s.persona_name)) byPersona.set(s.persona_name, []);
        byPersona.get(s.persona_name).push(s);
    }

    return (
        <div className="ci-playbook">
            {[...byPersona.entries()].map(([personaName, personaSteps]) => {
                const currentId = personaSteps.find(s => s.status !== 'done' && s.status !== 'skipped')?.id;
                return (
                    <section key={personaName} className="ci-playbook-persona">
                        <header className="ci-playbook-persona-head">
                            <span className="ci-eyebrow">Persona</span>
                            <h3>{personaName}</h3>
                            <span className="ci-muted">
                                {personaSteps.filter(s => s.status === 'done').length}/{personaSteps.length} done
                            </span>
                        </header>
                        <ol className="ci-step-list">
                            {personaSteps.map(s => (
                                <StepCard key={s.id} step={s} onAction={updateStep} isCurrent={s.id === currentId} />
                            ))}
                        </ol>
                    </section>
                );
            })}
        </div>
    );
}
