import React from 'react';
import { Loader2, Check, AlertCircle, Search, FileSearch, Download, Layers } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext.jsx';

const PHASE_ICONS = {
    resolve: Search,
    analyze: FileSearch,
    fetch: Download,
    render: Layers,
};

function fmtMs(ms) {
    if (!ms || ms < 0) return '';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
}

export default function PhaseCard({ phaseKey, status, detail, durationMs }) {
    const { t } = useLanguage();
    const Icon = PHASE_ICONS[phaseKey] || Search;

    const statusClass =
        status === 'active' ? 'phase-card--active' :
        status === 'done' ? 'phase-card--done' :
        status === 'error' ? 'phase-card--error' : '';

    return (
        <div className={`phase-card ${statusClass}`}>
            <div className="phase-card__head">
                <div className="phase-card__icon">
                    {status === 'active' && <Loader2 size={14} className="phase-card__spinner" />}
                    {status === 'done' && <Check size={14} />}
                    {status === 'error' && <AlertCircle size={14} />}
                    {status === 'idle' && <Icon size={14} />}
                </div>
                <div className="phase-card__title">{t(`previewTest.phases.${phaseKey}`)}</div>
                {status === 'done' && durationMs != null && (
                    <div className="phase-card__duration">{fmtMs(durationMs)}</div>
                )}
            </div>
            {(status === 'active' || status === 'done') && detail && (
                <div className="phase-card__detail">{detail}</div>
            )}
        </div>
    );
}
