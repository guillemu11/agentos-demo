import React, { useState } from 'react';

const defaultForm = {
    agent_id: '',
    mood: 'neutral',
    completed_tasks: '',
    in_progress_tasks: '',
    blockers: [],
    insights: '',
    plan_tomorrow: '',
};

export default function DailyEodModal({ show, onClose, onSubmit, agents, isSubmitting, t, moodConfig }) {
    const [formData, setFormData] = useState(defaultForm);
    const [newBlocker, setNewBlocker] = useState('');
    const [newBlockerSeverity, setNewBlockerSeverity] = useState('medium');

    if (!show) return null;

    const handleAddBlocker = () => {
        if (!newBlocker.trim()) return;
        setFormData({
            ...formData,
            blockers: [...formData.blockers, { desc: newBlocker.trim(), severity: newBlockerSeverity }],
        });
        setNewBlocker('');
        setNewBlockerSeverity('medium');
    };

    const handleRemoveBlocker = (index) => {
        setFormData({
            ...formData,
            blockers: formData.blockers.filter((_, i) => i !== index),
        });
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleAddBlocker();
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        const body = {
            agent_id: formData.agent_id,
            mood: formData.mood,
            completed_tasks: formData.completed_tasks.split('\n').filter(l => l.trim()).map(l => ({ desc: l.trim() })),
            in_progress_tasks: formData.in_progress_tasks.split('\n').filter(l => l.trim()).map(l => {
                const match = l.match(/^(.*?)(?:\s*[—-]\s*(\d+)%)?$/);
                return { desc: (match[1] || l).trim(), pct: match[2] ? parseInt(match[2]) : 50 };
            }),
            blockers: formData.blockers,
            insights: formData.insights.split('\n').filter(l => l.trim()),
            plan_tomorrow: formData.plan_tomorrow.split('\n').filter(l => l.trim()),
        };
        onSubmit(body);
        setFormData(defaultForm);
    };

    const handleClose = () => {
        setFormData(defaultForm);
        onClose();
    };

    const severityColors = {
        low: { bg: '#f1f5f9', color: '#94a3b8' },
        medium: { bg: '#fffbeb', color: '#f59e0b' },
        high: { bg: '#fef2f2', color: '#ef4444' },
    };

    const labelStyle = { display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' };

    return (
        <div className="modal-overlay">
            <div className="card modal-card--lg" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
                <h2 style={{ marginBottom: '20px' }}>{t('daily.newEodReportTitle')}</h2>
                <form onSubmit={handleSubmit}>
                    {/* Agent + Mood row */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                        <div>
                            <label style={labelStyle}>{t('daily.agentLabel')}</label>
                            <select
                                className="edit-input-inline"
                                value={formData.agent_id}
                                onChange={(e) => setFormData({ ...formData, agent_id: e.target.value })}
                                required
                            >
                                <option value="">{t('daily.selectAgent')}</option>
                                {agents.map(a => (
                                    <option key={a.id} value={a.id}>{a.name} ({a.role})</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label style={labelStyle}>{t('daily.moodLabel')}</label>
                            <select
                                className="edit-input-inline"
                                value={formData.mood}
                                onChange={(e) => setFormData({ ...formData, mood: e.target.value })}
                                required
                            >
                                {Object.entries(moodConfig).map(([key, val]) => (
                                    <option key={key} value={key}>{val.emoji} {val.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Completed Tasks */}
                    <div style={{ marginBottom: '16px' }}>
                        <label style={labelStyle}>{t('daily.completedTasks')}</label>
                        <textarea
                            className="edit-textarea"
                            rows="3"
                            value={formData.completed_tasks}
                            onChange={(e) => setFormData({ ...formData, completed_tasks: e.target.value })}
                            placeholder="Task completed..."
                        />
                    </div>

                    {/* In Progress Tasks */}
                    <div style={{ marginBottom: '16px' }}>
                        <label style={labelStyle}>{t('daily.inProgressTasksLabel')}</label>
                        <textarea
                            className="edit-textarea"
                            rows="2"
                            value={formData.in_progress_tasks}
                            onChange={(e) => setFormData({ ...formData, in_progress_tasks: e.target.value })}
                            placeholder="Limpieza de datos — 60%"
                        />
                    </div>

                    {/* Blockers with severity */}
                    <div style={{ marginBottom: '16px' }}>
                        <label style={labelStyle}>{t('daily.blockersHint')}</label>
                        {formData.blockers.length > 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '10px' }}>
                                {formData.blockers.map((b, i) => (
                                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: 'var(--bg-main)', borderRadius: '8px' }}>
                                        <span style={{ flex: 1, fontSize: '0.85rem' }}>{b.desc}</span>
                                        <span className="standup-severity" style={{ background: severityColors[b.severity]?.bg, color: severityColors[b.severity]?.color, fontSize: '0.7rem', padding: '2px 8px', borderRadius: '6px', fontWeight: 700 }}>
                                            {b.severity}
                                        </span>
                                        <button type="button" onClick={() => handleRemoveBlocker(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: '0.75rem', fontWeight: 700 }}>
                                            {t('daily.removeBlocker')}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <input
                                type="text"
                                className="edit-input-inline"
                                style={{ flex: 1 }}
                                value={newBlocker}
                                onChange={(e) => setNewBlocker(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Captcha bloqueando IPs..."
                            />
                            <select
                                className="edit-input-inline"
                                style={{ width: '100px' }}
                                value={newBlockerSeverity}
                                onChange={(e) => setNewBlockerSeverity(e.target.value)}
                            >
                                <option value="low">Low</option>
                                <option value="medium">Medium</option>
                                <option value="high">High</option>
                            </select>
                            <button type="button" onClick={handleAddBlocker} style={{ background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 12px', cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                                {t('daily.addBlocker')}
                            </button>
                        </div>
                    </div>

                    {/* Insights */}
                    <div style={{ marginBottom: '16px' }}>
                        <label style={labelStyle}>{t('daily.insightsLabel')}</label>
                        <textarea
                            className="edit-textarea"
                            rows="2"
                            value={formData.insights}
                            onChange={(e) => setFormData({ ...formData, insights: e.target.value })}
                            placeholder="Key insights discovered today..."
                        />
                    </div>

                    {/* Plan Tomorrow */}
                    <div style={{ marginBottom: '24px' }}>
                        <label style={labelStyle}>{t('daily.planTomorrowLabel')}</label>
                        <textarea
                            className="edit-textarea"
                            rows="2"
                            value={formData.plan_tomorrow}
                            onChange={(e) => setFormData({ ...formData, plan_tomorrow: e.target.value })}
                            placeholder="Completar scraping de Bayut..."
                        />
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <button type="button" className="back-button" style={{ flex: 1, margin: 0 }} onClick={handleClose}>
                            {t('daily.cancelBtn')}
                        </button>
                        <button
                            type="submit"
                            className="back-button"
                            style={{ flex: 1, margin: 0, background: 'var(--primary)', color: 'white' }}
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? t('daily.savingReport') : t('daily.saveReport')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
