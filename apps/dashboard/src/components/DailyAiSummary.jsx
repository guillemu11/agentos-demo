import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export default function DailyAiSummary({ department, date, t }) {
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(false);
    const [generatedAt, setGeneratedAt] = useState(null);

    const handleGenerate = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/eod-reports/summarize`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ department, date }),
            });
            if (!res.ok) throw new Error('Error generating summary');
            const data = await res.json();
            setSummary(data.summary);
            setGeneratedAt(new Date().toLocaleTimeString());
        } catch (err) {
            setSummary(`Error: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    if (!summary && !loading) {
        return (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <button
                    className="back-button"
                    style={{ background: 'var(--primary)', color: 'white', margin: 0 }}
                    onClick={handleGenerate}
                >
                    {t('daily.generateSummary')}
                </button>
            </div>
        );
    }

    return (
        <div className="daily-ai-summary-panel animate-fade-in">
            <div className="daily-ai-summary-header">
                <span className="daily-ai-summary-title">{t('daily.aiSummaryTitle')}</span>
                <button
                    className="back-button"
                    style={{ margin: 0, fontSize: '0.75rem', padding: '4px 12px' }}
                    onClick={handleGenerate}
                    disabled={loading}
                >
                    {loading ? t('daily.generatingSummary') : t('daily.regenerateSummary')}
                </button>
            </div>
            {loading ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '20px 0' }}>
                    <span style={{ animation: 'spin 1s linear infinite' }}>⏳</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{t('daily.generatingSummary')}</span>
                </div>
            ) : (
                <>
                    <div className="daily-ai-summary-body">{summary}</div>
                    {generatedAt && (
                        <div className="daily-ai-summary-meta">
                            {t('daily.summaryGeneratedAt')} {generatedAt}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
