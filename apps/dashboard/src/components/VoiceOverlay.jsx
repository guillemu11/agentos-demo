import { useEffect } from 'react';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { useGeminiVoice } from '../hooks/useGeminiVoice.js';
import { Mic, MicOff, Phone, PhoneOff, Wifi, WifiOff } from 'lucide-react';
import { AgentAvatar } from './icons.jsx';

/**
 * Full-screen voice conversation overlay.
 *
 * @param {{ agentId?: string, agentName?: string, agentAvatar?: string, campaignId?: string, onClose: () => void, onMessage?: (role, text) => void }} props
 */
export default function VoiceOverlay({ agentId, agentName, agentAvatar, campaignId, onClose, onMessage }) {
    const { t, lang } = useLanguage();

    const {
        supported, connected, listening, speaking, transcript, aiResponse,
        connect, disconnect, startListening, stopListening,
    } = useGeminiVoice({
        agentId,
        campaignId,
        lang,
        onTranscript: (text) => onMessage?.('user', text),
        onResponse: (text) => onMessage?.('assistant', text),
    });

    // Auto-connect and start listening on mount
    useEffect(() => {
        connect();
        const timer = setTimeout(() => startListening(), 800);
        return () => { clearTimeout(timer); disconnect(); };
    }, []);

    const handleClose = () => {
        stopListening();
        disconnect();
        onClose();
    };

    const toggleMic = () => {
        if (listening) stopListening();
        else startListening();
    };

    const statusText = !supported ? t('voice.notSupported')
        : !connected ? t('voice.connecting')
        : speaking ? t('voice.speaking')
        : listening ? t('voice.listening')
        : t('voice.ready');

    return (
        <div className="voice-overlay">
            <div className="voice-overlay-content">
                {/* Status indicator */}
                <div className="voice-overlay-status">
                    {connected ? <Wifi size={14} /> : <WifiOff size={14} />}
                    <span>{statusText}</span>
                </div>

                {/* Agent avatar */}
                <div className={`voice-overlay-avatar ${speaking ? 'speaking' : ''} ${listening ? 'listening' : ''}`}>
                    <span className="voice-overlay-avatar-text">
                        <AgentAvatar agentId={agentId} size={28} />
                    </span>
                    {speaking && (
                        <div className="voice-overlay-rings">
                            <div className="voice-ring ring-1" />
                            <div className="voice-ring ring-2" />
                            <div className="voice-ring ring-3" />
                        </div>
                    )}
                </div>

                <h3 className="voice-overlay-name">{agentName || 'AI Assistant'}</h3>

                {/* Transcript display */}
                <div className="voice-overlay-transcript">
                    {transcript && (
                        <div className="voice-transcript-user">
                            <span className="voice-transcript-label">You</span>
                            <p>{transcript}</p>
                        </div>
                    )}
                    {aiResponse && (
                        <div className="voice-transcript-ai">
                            <span className="voice-transcript-label">{agentName || 'AI'}</span>
                            <p>{aiResponse}</p>
                        </div>
                    )}
                </div>

                {/* Controls */}
                <div className="voice-overlay-controls">
                    <button
                        className={`voice-ctrl-btn ${listening ? 'active' : 'muted'}`}
                        onClick={toggleMic}
                        title={listening ? 'Mute' : 'Unmute'}
                    >
                        {listening ? <Mic size={20} /> : <MicOff size={20} />}
                    </button>

                    <button
                        className="voice-ctrl-btn end-call"
                        onClick={handleClose}
                        title={t('voice.endCall')}
                    >
                        <PhoneOff size={20} />
                    </button>
                </div>
            </div>
        </div>
    );
}
