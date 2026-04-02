import React, { useState } from 'react';
import { useLanguage } from '../i18n/LanguageContext.jsx';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export default function HandoffModal({ projectId, session, stages, agents, onClose, onComplete }) {
    const { t } = useLanguage();
    const [summary, setSummary] = useState('');
    const [notes, setNotes] = useState('');
    const [loading, setLoading] = useState(false);
    const [phase, setPhase] = useState('confirm');
    const [error, setError] = useState(null);

    const agentMap = {};
    (agents || []).forEach(a => { agentMap[a.id] = a; });

    const currentStage = stages?.find(s => s.stage_order === session?.stage_order);
    const requiresGateApproval = currentStage?.gate_type === 'human_approval';

    // Find stages that directly depend on the current stage
    const nextStageNames = stages?.filter(s =>
        (s.depends_on || []).includes(session?.stage_order)
    ).map(s => s.name) || [];

    const executeHandoff = async () => {
        setLoading(true);
        setError(null);
        setPhase('generating');

        try {
            const body = { session_id: session.id };
            if (summary) body.summary_override = summary;
            if (notes) body.notes = notes;
            if (requiresGateApproval) body.gate_approved = true;

            const res = await fetch(`${API_URL}/projects/${projectId}/pipeline/handoff`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(body),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Handoff failed');
            }

            const result = await res.json();
            if (!summary && result.handoff?.summary) setSummary(result.handoff.summary);

            setPhase('done');
            setTimeout(() => { if (onComplete) onComplete(result); }, 1500);
        } catch (err) {
            setError(err.message);
            setPhase('confirm');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="handoff-modal-overlay" onClick={onClose}>
            <div className="handoff-modal" onClick={e => e.stopPropagation()}>
                {phase === 'done' ? (
                    <div style={{ textAlign: 'center', padding: '20px' }}>
                        <div style={{ fontSize: '48px', marginBottom: '16px' }}>✓</div>
                        <h2>{t('pipeline.handoffSuccess')}</h2>
                    </div>
                ) : (
                    <>
                        <h2>{t('pipeline.confirmHandoff')}</h2>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: '0 0 16px' }}>
                            {currentStage?.name} → {nextStageNames.join(', ') || 'Pipeline completion'}
                        </p>

                        {requiresGateApproval && (
                            <div style={{ padding: '10px 14px', background: '#F59E0B15', border: '1px solid #F59E0B40', borderRadius: '10px', marginBottom: '12px', fontSize: '0.85rem' }}>
                                🔒 {t('pipeline.gateApproval')}
                            </div>
                        )}

                        <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '0.85rem' }}>
                            {t('pipeline.handoffSummary')}
                        </label>
                        <textarea value={summary} onChange={e => setSummary(e.target.value)}
                            placeholder={phase === 'generating' ? t('pipeline.generatingSummary') : t('pipeline.summaryGenerated')} />

                        <label style={{ display: 'block', margin: '12px 0 6px', fontWeight: 600, fontSize: '0.85rem' }}>
                            {t('pipeline.handoffNotes')}
                        </label>
                        <textarea value={notes} onChange={e => setNotes(e.target.value)}
                            placeholder="Optional notes..." style={{ minHeight: '60px' }} />

                        {error && (
                            <div style={{ color: '#ef4444', fontSize: '0.85rem', margin: '8px 0' }}>{error}</div>
                        )}

                        <div className="handoff-modal-actions">
                            <button className="cancel-btn" onClick={onClose} disabled={loading}>
                                {t('pipeline.cancel')}
                            </button>
                            <button className="confirm-btn" onClick={executeHandoff} disabled={loading}>
                                {loading ? t('pipeline.generatingSummary') : t('pipeline.confirmHandoff')}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
