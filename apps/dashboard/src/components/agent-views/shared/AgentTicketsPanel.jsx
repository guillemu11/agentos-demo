import React, { useState } from 'react';
import { useLanguage } from '../../../i18n/LanguageContext.jsx';
import { ChevronRight, ChevronDown, ChevronUp } from 'lucide-react';
import ReopenTicketModal from './ReopenTicketModal.jsx';

const STATUS_ORDER = ['active', 'awaiting_handoff'];

function groupByStatus(tickets) {
    const groups = {};
    for (const status of STATUS_ORDER) {
        const items = tickets.filter(t => t.status === status);
        if (items.length > 0) groups[status] = items;
    }
    return groups;
}

export default function AgentTicketsPanel({ tickets, selectedTicket, onSelectTicket, completedTickets, onReopenComplete }) {
    const { t } = useLanguage();
    const [historyOpen, setHistoryOpen] = useState(false);
    const [reopenTarget, setReopenTarget] = useState(null);

    const hasActive = tickets && tickets.length > 0;
    const hasCompleted = completedTickets && completedTickets.length > 0;

    if (!hasActive && !hasCompleted) {
        return (
            <div className="agent-tickets-panel">
                <div className="empty-state">{t('tickets.noTickets')}</div>
            </div>
        );
    }

    const groups = groupByStatus(tickets || []);

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
                )}
            )}

            {/* Completed history section */}
            {hasCompleted && (
                <div className="ticket-status-group">
                    <button
                        className="ticket-status-header"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left', padding: '0 4px' }}
                        onClick={() => setHistoryOpen(v => !v)}
                    >
                        <span className="ticket-status-dot completed" />
                        <span className="ticket-status-label">{t('tickets.completedHistory')}</span>
                        <span className="ticket-status-count">{completedTickets.length}</span>
                        <span style={{ marginLeft: 'auto', color: 'var(--text-muted)' }}>
                            {historyOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </span>
                    </button>

                    {historyOpen && completedTickets.map(ticket => (
                        <div key={ticket.id} className="ticket-card" style={{ borderLeftColor: 'var(--text-muted)', opacity: 0.85 }}>
                            <div className="ticket-card-body">
                                <h4 className="ticket-card-project">{ticket.project_name}</h4>
                                <div className="ticket-card-stage">
                                    <span className="ticket-card-stage-badge">{ticket.stage_order}</span>
                                    {ticket.stage_name}
                                </div>
                                {ticket.completed_at && (
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                                        {t('tickets.completedAt').replace('{date}', new Date(ticket.completed_at).toLocaleDateString())}
                                    </div>
                                )}
                            </div>
                            <button
                                className="ticket-card-action"
                                style={{ background: 'var(--bg-main)', color: 'var(--text-secondary)', borderColor: 'var(--border-light)' }}
                                onClick={() => setReopenTarget(ticket)}
                            >
                                {t('tickets.reopen')}
                                <ChevronRight size={14} />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {reopenTarget && (
                <ReopenTicketModal
                    ticket={reopenTarget}
                    onClose={() => setReopenTarget(null)}
                    onComplete={() => {
                        setReopenTarget(null);
                        if (onReopenComplete) onReopenComplete();
                    }}
                />
            )}
        </div>
    );
}
