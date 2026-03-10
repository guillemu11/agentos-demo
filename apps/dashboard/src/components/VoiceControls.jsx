import React from 'react';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { Mic, Volume2, VolumeX } from 'lucide-react';

export function MicButton({ isListening, onClick, disabled, sttSupported }) {
    const { t } = useLanguage();
    if (!sttSupported) return null;

    return (
        <button
            className={`voice-mic-btn ${isListening ? 'voice-mic-listening' : ''}`}
            onClick={onClick}
            disabled={disabled}
            title={isListening ? t('voice.stopRecording') : t('voice.startRecording')}
            type="button"
        >
            {isListening ? (
                <span className="voice-mic-indicator">
                    <span className="voice-pulse-dot" />
                </span>
            ) : (
                <span style={{ fontSize: '1.1rem', lineHeight: 1 }}><Mic size={16} /></span>
            )}
        </button>
    );
}

export function SpeakerButton({ onClick, isSpeaking }) {
    const { t } = useLanguage();
    return (
        <button
            className={`voice-speaker-btn ${isSpeaking ? 'voice-speaker-active' : ''}`}
            onClick={onClick}
            title={isSpeaking ? t('voice.stopSpeaking') : t('voice.playSpeech')}
            type="button"
        >
            <span style={{ fontSize: '0.8rem', lineHeight: 1 }}>{isSpeaking ? <VolumeX size={14} /> : <Volume2 size={14} />}</span>
        </button>
    );
}

export function TtsToggle({ ttsEnabled, setTtsEnabled, ttsSupported }) {
    const { t } = useLanguage();
    if (!ttsSupported) return null;

    return (
        <button
            className={`voice-tts-toggle ${ttsEnabled ? 'voice-tts-active' : ''}`}
            onClick={() => setTtsEnabled(!ttsEnabled)}
            title={ttsEnabled ? t('voice.disableAutoRead') : t('voice.enableAutoRead')}
            type="button"
        >
            <span style={{ fontSize: '0.9rem', lineHeight: 1 }}>{ttsEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}</span>
        </button>
    );
}
