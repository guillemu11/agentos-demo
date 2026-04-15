import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext.jsx';

export default function ConflictModal({ open, localHtml, remoteHtml, remoteEtag, onKeepLocal, onKeepRemote, onClose }) {
    const { t } = useLanguage();
    if (!open) return null;

    return (
        <div className="us-modal-backdrop" onClick={onClose}>
            <div className="us-modal" onClick={e => e.stopPropagation()}>
                <header className="us-modal-header">
                    <div className="us-modal-title">
                        <AlertTriangle size={18} color="#f59e0b" />
                        <span>{t('unifiedStudio.conflict.title')}</span>
                    </div>
                    <button className="us-icon-btn" onClick={onClose}><X size={14} /></button>
                </header>
                <p className="us-modal-body-text">{t('unifiedStudio.conflict.body')}</p>
                <div className="us-conflict-grid">
                    <div className="us-conflict-col">
                        <div className="us-label">{t('unifiedStudio.conflict.local')}</div>
                        <pre className="us-conflict-pre">{localHtml?.slice(0, 4000) || '—'}</pre>
                    </div>
                    <div className="us-conflict-col">
                        <div className="us-label">{t('unifiedStudio.conflict.remote')}</div>
                        <pre className="us-conflict-pre">{remoteHtml?.slice(0, 4000) || '—'}</pre>
                    </div>
                </div>
                <footer className="us-modal-footer">
                    <button className="us-btn us-btn-secondary" onClick={() => onKeepRemote(remoteHtml, remoteEtag)}>
                        {t('unifiedStudio.conflict.keepRemote')}
                    </button>
                    <button className="us-btn us-btn-primary" onClick={() => onKeepLocal(remoteEtag)}>
                        {t('unifiedStudio.conflict.keepLocal')}
                    </button>
                </footer>
            </div>
        </div>
    );
}
