import React from 'react';
import { useLanguage } from '../../../i18n/LanguageContext.jsx';
import { Zap, X } from 'lucide-react';

export default function ActiveTicketIndicator({ selectedTicket, onClear, studioLabel, onOpenStudio }) {
    const { t } = useLanguage();

    if (!selectedTicket) return null;

    return (
        <div className="active-ticket-indicator animate-fade-in">
            <Zap size={14} />
            <span className="active-ticket-indicator-label">{t('tickets.working')}</span>
            <span className="active-ticket-indicator-project">
                {selectedTicket.project_name}
            </span>
            <span className="active-ticket-indicator-stage">
                [{selectedTicket.stage_order}] {selectedTicket.stage_name}
            </span>
            {studioLabel && onOpenStudio && (
                <button className="active-ticket-studio-btn" onClick={onOpenStudio}>
                    {studioLabel}
                </button>
            )}
            <button
                className="active-ticket-indicator-close"
                onClick={onClear}
                title={t('common.close')}
            >
                <X size={14} />
            </button>
        </div>
    );
}
