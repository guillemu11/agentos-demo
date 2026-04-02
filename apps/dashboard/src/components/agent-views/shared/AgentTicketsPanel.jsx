import React from 'react';
import { useLanguage } from '../../../i18n/LanguageContext.jsx';
import { ChevronRight } from 'lucide-react';

const STATUS_ORDER = ['active', 'awaiting_handoff'];

function groupByStatus(tickets) {
    const groups = {};
    for (const status of STATUS_ORDER) {
        const items = tickets.filter(t => t.status === status);
        if (items.length > 0) groups[status] = items;
    }
    return groups;
}

export default function AgentTicketsPanel({ tickets, selectedTicket, onSelectTicket }) {
    const { t } = useLanguage();

    if (!tickets || tickets.length === 0) {
        return (
            <div className="agent-tickets-panel">
                <div className="empty-state">{t('tickets.noTickets')}</div>
            </div>
        );
    }

    const groups = groupByStatus(tickets);

    return (
        <div className="agent-tickets-panel">
            {STATUS_ORDER.map(status => {
                const items = groups[status];
                if (!items) return null;

                return (
                    <div key={status} className="ticket-status-group">
                        <div className="ticket-status-header">
                            <span className={`ticket-status-dot ${status}`} />
                            <span className="ticket-status-label">
                                {t(`tickets.${status === 'awaiting_handoff' ? 'awaitingHandoff' : status}`)}
                            </span>
                            <span className="ticket-status-count">{items.length}</span>
                        </div>

                        {items.map(ticket => {
                            const isSelected = selectedTicket?.id === ticket.id;
                            return (
                                <div
                                    key={ticket.id}
                                    className={`ticket-card${isSelected ? ' selected' : ''}`}
                                >
                                    <div className="ticket-card-body">
                                        <h4 className="ticket-card-project">{ticket.project_name}</h4>
                                        <div className="ticket-card-stage">
                                            <span className="ticket-card-stage-badge">{ticket.stage_order}</span>
                                            {ticket.stage_name}
                                        </div>
                                        {ticket.stage_description && (
                                            <p className="ticket-card-desc">
                                                {ticket.stage_description.length > 120
                                                    ? ticket.stage_description.substring(0, 120) + '...'
                                                    : ticket.stage_description}
                                            </p>
                                        )}
                                        <div className="ticket-card-meta">
                                            {ticket.gate_type === 'human_approval' && (
                                                <span className="ticket-card-gate" title={t('pipeline.gateApproval')}>
                                                    <span className="ticket-gate-icon" />
                                                    {t('pipeline.gateApproval')}
                                                </span>
                                            )}
                                            {ticket.message_count > 0 && (
                                                <span className="ticket-card-messages">
                                                    {t('pipeline.messagesCount').replace('{count}', ticket.message_count)}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <button
                                        className="ticket-card-action"
                                        onClick={() => onSelectTicket(ticket)}
                                    >
                                        {isSelected ? t('tickets.working') : t('tickets.workOn')}
                                        <ChevronRight size={14} />
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                );
            })}
        </div>
    );
}
