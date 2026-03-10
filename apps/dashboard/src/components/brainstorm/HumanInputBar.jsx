import React, { useState } from 'react';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import { useVoice } from '../../hooks/useVoice.js';
import { MicButton, TtsToggle } from '../VoiceControls.jsx';
import { Send, Hand, SkipForward, Square } from 'lucide-react';

export default function HumanInputBar({
    onSend,
    onSkipProject,
    onEnd,
    disabled,
    waitingForHuman,
    isRunning,
    ttsEnabled,
    setTtsEnabled,
    ttsSupported,
}) {
    const { t, lang } = useLanguage();
    const [input, setInput] = useState('');

    const { sttSupported, isListening, toggleListening } = useVoice({
        lang,
        onTranscript: (text) => setInput(prev => prev ? prev + ' ' + text : text),
    });

    function handleSend() {
        const trimmed = input.trim();
        if (!trimmed) return;
        onSend(trimmed);
        setInput('');
    }

    function handleKeyDown(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    }

    return (
        <div className="mab-input-bar">
            <div className="mab-input-row">
                <MicButton
                    isListening={isListening}
                    onClick={toggleListening}
                    disabled={disabled && !waitingForHuman}
                    sttSupported={sttSupported}
                />
                <input
                    type="text"
                    className="mab-text-input"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={waitingForHuman
                        ? t('multiBrainstorm.yourTurnPlaceholder')
                        : t('multiBrainstorm.typePlaceholder')}
                    disabled={disabled && !waitingForHuman}
                />
                <button
                    className="mab-send-btn"
                    onClick={handleSend}
                    disabled={(disabled && !waitingForHuman) || !input.trim()}
                    title={t('multiBrainstorm.send')}
                >
                    <Send size={18} />
                </button>
            </div>
            <div className="mab-controls-row">
                <TtsToggle
                    ttsEnabled={ttsEnabled}
                    setTtsEnabled={setTtsEnabled}
                    ttsSupported={ttsSupported}
                />
                {isRunning && (
                    <>
                        <button
                            className="mab-control-btn"
                            onClick={onSkipProject}
                            title={t('multiBrainstorm.skipProject')}
                        >
                            <SkipForward size={14} />
                            <span>{t('multiBrainstorm.skipProject')}</span>
                        </button>
                        <button
                            className="mab-control-btn mab-control-end"
                            onClick={onEnd}
                            title={t('multiBrainstorm.endSession')}
                        >
                            <Square size={14} />
                            <span>{t('multiBrainstorm.endSession')}</span>
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}
