import React from 'react';
import { useEmailBuilderStream } from './useEmailBuilderStream.js';
import EmailBuilderChat from './EmailBuilderChat.jsx';
import PreviewCanvas from './PreviewCanvas.jsx';
import { useLanguage } from '../../i18n/LanguageContext.jsx';

export default function PreviewTestLayout() {
    const { t } = useLanguage();
    const stream = useEmailBuilderStream();

    return (
        <div className="preview-test-layout">
            <div className="preview-test-layout__header">
                <div className="preview-test-layout__title">{t('previewTest.title')}</div>
                <div className="preview-test-layout__subtitle">{t('previewTest.subtitle')}</div>
            </div>

            <div className="preview-test-layout__body">
                <aside className="preview-test-layout__chat">
                    <EmailBuilderChat
                        status={stream.status}
                        messages={stream.messages}
                        phases={stream.phases}
                        confirmOptions={stream.confirmOptions}
                        error={stream.error}
                        onSubmit={stream.start}
                        onSelectOption={stream.selectConfirmOption}
                        onStop={stream.stop}
                    />
                </aside>

                <main className="preview-test-layout__preview">
                    <PreviewCanvas
                        variants={stream.variants}
                        variantOrder={stream.variantOrder}
                        currentKey={stream.currentVariantKey}
                        onSelectVariant={stream.selectVariant}
                        emailName={stream.emailName}
                        status={stream.status}
                        phases={stream.phases}
                    />
                </main>
            </div>
        </div>
    );
}
