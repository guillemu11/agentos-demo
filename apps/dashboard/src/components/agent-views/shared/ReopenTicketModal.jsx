import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../../i18n/LanguageContext.jsx';
import { RotateCcw, AlertTriangle } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export default function ReopenTicketModal({ ticket, onClose, onComplete }) {
    const { t } = useLanguage();
    const [downstream, setDownstream] = useState(null);
    const [loading, setLoading] = useState(true);
    const [reopening, setReopening] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        async function fetchDownstream() {
            try {
                const res = await fetch(
                    `${API_URL}/projects/${ticket.project_id}/sessions/${ticket.id}/downstream`,
                    { credentials: 'include' }
                );
                if (!res.ok) throw new Error('Failed to fetch downstream');
                const data = await res.json();
                setDownstream(data.downstream || []);
            } catch (e) {
                setError(e.message);
            } finally {
                setLoading(false);
            }
        }
        fetchDownstream();
    }, [ticket.project_id, ticket.id]);

    const handleReopen = async (strategy) => {
        setReopening(true);
        setError(null);
        try {
            const res = await fetch(
                `${API_URL}/projects/${ticket.project_id}/sessions/${ticket.id}/reopen`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ strategy }),
                }
            );
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Reopen failed');
            }
            onComplete();
        } catch (e) {
            setError(e.message);
            setReopening(false);
        }
    };

    const hasDownstream = downstream && downstream.length > 0;
    const activeDownstream = downstream?.filter(d => ['active', 'awaiting_handoff', 'completed'].includes(d.status)) || [];

    return (
        <div className="handoff-modal-overlay" onClick={onClose}>
            <div className="handoff-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                    <RotateCcw size={20} style={{ color: 'var(--primary)' }} />
                    <h2 style={{ margin: 0 }}>{t('tickets.reopenTitle')}</h2>
                </div>

                <div style={{ padding: '10px 14px', background: 'var(--bg-main)', border: '1px solid var(--border-light)', borderRadius: '10px', marginBottom: '16px', fontSize: '0.85rem' }}>
                    <strong>{ticket.project_name}</strong>
                    <span style={{ color: 'var(--text-muted)', marginLeft: '8px' }}>Stage {ticket.stage_order} · {ticket.stage_name}</span>
                </div>

                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: '0 0 16px' }}>
                    {t('tickets.reopenWarning')}
                </p>

                {loading && (
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', padding: '8px 0' }}>
                        {t('common.loading')}
                    </div>
                )}

                {!loading && hasDownstream && activeDownstream.length > 0 && (
                    <div style={{ marginBottom: '20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            <AlertTriangle size={13} style={{ color: 'var(--accent-yellow)' }} />
                            {t('tickets.reopenDownstreamWarning')}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {activeDownstream.map(d => (
                                <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: 'var(--bg-main)', border: '1px solid var(--border-light)', borderRadius: '8px', fontSize: '0.82rem' }}>
                                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0, background: d.status === 'completed' ? 'var(--accent-green)' : d.status === 'active' ? 'var(--primary)' : 'var(--accent-yellow)' }} />
                                    <span style={{ color: 'var(--text-secondary)' }}>Stage {d.stage_order}</span>
                                    <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>{d.stage_name}</span>
                                    <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: '0.75rem' }}>{d.status}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {error && (
                    <div style={{ color: '#ef4444', fontSize: '0.85rem', margin: '8px 0' }}>{error}</div>
                )}

                {!loading && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {hasDownstream && activeDownstream.length > 0 && (
                            <button
                                className="confirm-btn"
                                style={{ background: '#ef4444', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', padding: '12px 16px', borderRadius: '10px', border: 'none', cursor: reopening ? 'not-allowed' : 'pointer', opacity: reopening ? 0.6 : 1 }}
                                onClick={() => handleReopen('reset')}
                                disabled={reopening}
                            >
                                <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'white' }}>{t('tickets.resetDownstream')}</span>
                                <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.8)', marginTop: '2px' }}>{t('tickets.resetDownstreamDesc')}</span>
                            </button>
                        )}

                        <button
                            className="confirm-btn"
                            style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', padding: '12px 16px', borderRadius: '10px', border: 'none', cursor: reopening ? 'not-allowed' : 'pointer', opacity: reopening ? 0.6 : 1 }}
                            onClick={() => handleReopen('keep')}
                            disabled={reopening}
                        >
                            <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'white' }}>{t('tickets.keepDownstream')}</span>
                            <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.8)', marginTop: '2px' }}>{t('tickets.keepDownstreamDesc')}</span>
                        </button>

                        <button
                            className="cancel-btn"
                            style={{ padding: '10px 16px', borderRadius: '10px' }}
                            onClick={onClose}
                            disabled={reopening}
                        >
                            {t('tickets.reopenCancel')}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
