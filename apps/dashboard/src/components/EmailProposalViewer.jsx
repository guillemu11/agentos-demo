import { useState, useEffect } from 'react';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { Copy, Check, ThumbsUp, ThumbsDown, Monitor, Smartphone, X, ArrowLeftRight } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export default function EmailProposalViewer({ campaignId, proposalId, onClose, proposals = [] }) {
    const { t } = useLanguage();
    const [proposal, setProposal] = useState(null);
    const [viewport, setViewport] = useState('desktop'); // desktop | mobile
    const [copied, setCopied] = useState(null);
    const [diffWith, setDiffWith] = useState(null);
    const [diffData, setDiffData] = useState(null);

    useEffect(() => {
        if (!proposalId) return;
        (async () => {
            try {
                const res = await fetch(`${API_URL}/campaigns/${campaignId}/emails/${proposalId}`, { credentials: 'include' });
                if (res.ok) setProposal(await res.json());
            } catch { /* ignore */ }
        })();
    }, [proposalId, campaignId]);

    async function handleCopy(text, key) {
        await navigator.clipboard.writeText(text);
        setCopied(key);
        setTimeout(() => setCopied(null), 1500);
    }

    async function handleStatusChange(status) {
        try {
            await fetch(`${API_URL}/campaigns/${campaignId}/emails/${proposalId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ status }),
            });
            setProposal(prev => ({ ...prev, status }));
        } catch { /* ignore */ }
    }

    async function loadDiff(otherId) {
        try {
            const res = await fetch(`${API_URL}/campaigns/${campaignId}/emails/${proposalId}/diff/${otherId}`, { credentials: 'include' });
            if (res.ok) {
                setDiffData(await res.json());
                setDiffWith(otherId);
            }
        } catch { /* ignore */ }
    }

    if (!proposal) return null;

    const copyBlocks = proposal.copy_blocks || {};
    const otherProposals = proposals.filter(p => p.id !== proposalId);

    return (
        <div className="email-viewer-overlay">
            <div className="email-viewer">
                {/* Header */}
                <div className="email-viewer-header">
                    <div>
                        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>{proposal.variant_name}</h3>
                        <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                            <span className="kb-namespace-tag">{proposal.market}</span>
                            <span className="kb-namespace-tag">{proposal.language.toUpperCase()}</span>
                            {proposal.tier && <span className="kb-namespace-tag">{proposal.tier}</span>}
                            <span className={`kb-status-badge ${proposal.status}`}>{proposal.status}</span>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <button className={`email-vp-btn ${viewport === 'desktop' ? 'active' : ''}`} onClick={() => setViewport('desktop')} title="Desktop">
                            <Monitor size={14} />
                        </button>
                        <button className={`email-vp-btn ${viewport === 'mobile' ? 'active' : ''}`} onClick={() => setViewport('mobile')} title="Mobile">
                            <Smartphone size={14} />
                        </button>
                        <button className="kb-icon-btn" onClick={onClose}><X size={16} /></button>
                    </div>
                </div>

                <div className="email-viewer-body">
                    {/* Preview iframe */}
                    <div className={`email-preview-frame ${viewport}`}>
                        {proposal.html_content ? (
                            <iframe
                                srcDoc={proposal.html_content}
                                title="Email preview"
                                sandbox="allow-same-origin"
                                style={{ width: '100%', height: '100%', border: 'none' }}
                            />
                        ) : (
                            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>{t('emails.noHtml')}</div>
                        )}
                    </div>

                    {/* Sidebar */}
                    <div className="email-viewer-sidebar">
                        {/* Copy blocks */}
                        <div className="email-copy-section">
                            <h4 className="kb-section-title">{t('emails.subject')}</h4>
                            <div className="email-copy-block">
                                <span>{proposal.subject_line || '—'}</span>
                                <button className="kb-icon-btn" onClick={() => handleCopy(proposal.subject_line || '', 'subject')}>
                                    {copied === 'subject' ? <Check size={12} /> : <Copy size={12} />}
                                </button>
                            </div>
                        </div>

                        <div className="email-copy-section">
                            <h4 className="kb-section-title">{t('emails.previewText')}</h4>
                            <div className="email-copy-block">
                                <span>{proposal.preview_text || '—'}</span>
                                <button className="kb-icon-btn" onClick={() => handleCopy(proposal.preview_text || '', 'preview')}>
                                    {copied === 'preview' ? <Check size={12} /> : <Copy size={12} />}
                                </button>
                            </div>
                        </div>

                        {Object.entries(copyBlocks).map(([key, value]) => (
                            <div key={key} className="email-copy-section">
                                <h4 className="kb-section-title">{key.replace(/_/g, ' ')}</h4>
                                <div className="email-copy-block">
                                    <span>{value}</span>
                                    <button className="kb-icon-btn" onClick={() => handleCopy(value, key)}>
                                        {copied === key ? <Check size={12} /> : <Copy size={12} />}
                                    </button>
                                </div>
                            </div>
                        ))}

                        {/* Copy full HTML */}
                        <button
                            className="kb-action-btn"
                            style={{ width: '100%', justifyContent: 'center', marginTop: 12 }}
                            onClick={() => handleCopy(proposal.html_content || '', 'html')}
                        >
                            {copied === 'html' ? <Check size={14} /> : <Copy size={14} />}
                            {copied === 'html' ? t('knowledge.copied') : t('emails.copyHtml')}
                        </button>

                        {/* Diff */}
                        {otherProposals.length > 0 && (
                            <div className="email-copy-section" style={{ marginTop: 16 }}>
                                <h4 className="kb-section-title"><ArrowLeftRight size={12} /> {t('emails.compareWith')}</h4>
                                <select
                                    className="kb-filter-select"
                                    style={{ width: '100%' }}
                                    value={diffWith || ''}
                                    onChange={e => e.target.value ? loadDiff(e.target.value) : setDiffData(null)}
                                >
                                    <option value="">{t('emails.selectVariant')}</option>
                                    {otherProposals.map(p => (
                                        <option key={p.id} value={p.id}>{p.variant_name}</option>
                                    ))}
                                </select>

                                {diffData && (
                                    <div className="email-diff-results">
                                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                            {diffData.total_diffs} {t('emails.differences')}
                                        </span>
                                        {diffData.subject_diff && (
                                            <div className="email-diff-item">
                                                <span className="email-diff-label">Subject</span>
                                                <div className="email-diff-a">{diffData.subject_diff.a}</div>
                                                <div className="email-diff-b">{diffData.subject_diff.b}</div>
                                            </div>
                                        )}
                                        {Object.entries(diffData.copy_diffs || {}).map(([key, val]) => (
                                            <div key={key} className="email-diff-item">
                                                <span className="email-diff-label">{key.replace(/_/g, ' ')}</span>
                                                <div className="email-diff-a">{val.a}</div>
                                                <div className="email-diff-b">{val.b}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Actions */}
                        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                            <button className="kb-action-btn" style={{ flex: 1, justifyContent: 'center' }} onClick={() => handleStatusChange('approved')}>
                                <ThumbsUp size={14} /> {t('emails.approve')}
                            </button>
                            <button className="kb-action-btn secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => handleStatusChange('rejected')}>
                                <ThumbsDown size={14} /> {t('emails.reject')}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
