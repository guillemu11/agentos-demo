import { useState, useRef, useEffect } from 'react';
import { useLanguage } from '../i18n/LanguageContext.jsx';

export default function EmailPreview({ html, title }) {
    const { t } = useLanguage();
    const [showCode, setShowCode] = useState(false);
    const iframeRef = useRef(null);

    useEffect(() => {
        if (iframeRef.current) {
            const doc = iframeRef.current.contentDocument;
            doc.open();
            doc.write(html);
            doc.close();
        }
    }, [html]);

    return (
        <div className="kb-email-preview">
            <div className="kb-email-preview-header">
                <span>{t('knowledge.chat.emailPreview')}: {title}</span>
                <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => setShowCode(!showCode)}>
                        {showCode ? t('knowledge.chat.hideCode') : t('knowledge.chat.viewCode')}
                    </button>
                    <button onClick={() => navigator.clipboard.writeText(html)}>
                        {t('knowledge.chat.copyHtml')}
                    </button>
                </div>
            </div>
            <iframe ref={iframeRef} sandbox="allow-same-origin" title={title} />
            {showCode && <div className="kb-email-code">{html}</div>}
        </div>
    );
}
