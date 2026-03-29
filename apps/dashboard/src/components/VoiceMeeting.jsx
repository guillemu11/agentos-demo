import { useState, useEffect, useRef, useCallback } from 'react';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { Mic, MicOff, PhoneOff, SkipForward, Hand, Wifi, WifiOff, Mail, Search, FlaskConical, FolderKanban } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const SpeechRecognition = typeof window !== 'undefined'
    ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;
const synthesis = typeof window !== 'undefined' ? window.speechSynthesis : null;

const TYPE_ICONS = { project: FolderKanban, email_proposal: Mail, research_session: Search, experiment: FlaskConical };
const TYPE_COLORS = { project: '#a855f7', email_proposal: '#10b981', research_session: '#3b82f6', experiment: '#f59e0b' };

export default function VoiceMeeting({ department, onClose, onSummary }) {
    const { t, lang } = useLanguage();
    const [connected, setConnected] = useState(false);
    const [agenda, setAgenda] = useState([]);
    const [currentItem, setCurrentItem] = useState(0);
    const [transcript, setTranscript] = useState([]);
    const [listening, setListening] = useState(false);
    const [speaking, setSpeaking] = useState(false);
    const [meetingId, setMeetingId] = useState(null);
    const [summary, setSummary] = useState(null);
    const [decisions, setDecisions] = useState([]);

    const wsRef = useRef(null);
    const recognitionRef = useRef(null);

    // Connect WebSocket
    useEffect(() => {
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const apiUrl = import.meta.env.VITE_API_URL || '';
        let wsUrl = apiUrl.startsWith('http')
            ? apiUrl.replace(/^http/, 'ws') + '/ws/voice-meeting'
            : `${wsProtocol}//${window.location.host}/ws/voice-meeting`;

        wsUrl += `?department=${encodeURIComponent(department)}`;

        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => setConnected(true);
        ws.onclose = () => setConnected(false);
        ws.onerror = () => setConnected(false);

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);

                if (data.type === 'meeting-ready') {
                    setMeetingId(data.meetingId);
                    setAgenda(data.agenda || []);
                    setCurrentItem(0);
                    // Auto-present first item
                    setTimeout(() => ws.send(JSON.stringify({ type: 'present-item' })), 500);
                }

                if (data.type === 'agent-presentation' || data.type === 'agent-response') {
                    setTranscript(prev => [...prev, { speaker: data.agent, text: data.text, isAgent: true }]);
                    // TTS
                    if (synthesis && data.text) {
                        const u = new SpeechSynthesisUtterance(data.text);
                        u.lang = lang === 'es' ? 'es-ES' : 'en-US';
                        u.onstart = () => setSpeaking(true);
                        u.onend = () => setSpeaking(false);
                        synthesis.speak(u);
                    }
                }

                if (data.type === 'decision') {
                    setDecisions(prev => [...prev, { item: data.item, decision: data.decision }]);
                }

                if (data.type === 'next-item') {
                    setCurrentItem(data.itemIndex);
                    // Auto-present new item
                    setTimeout(() => ws.send(JSON.stringify({ type: 'present-item' })), 300);
                }

                if (data.type === 'meeting-summary') {
                    setSummary(data.summary);
                    onSummary?.(data.summary, data.decisions);
                }

                if (data.type === 'meeting-complete') {
                    ws.send(JSON.stringify({ type: 'end-meeting' }));
                }
            } catch { /* ignore */ }
        };

        return () => { ws.close(); };
    }, [department, lang]);

    // Speech recognition
    const startListening = useCallback(() => {
        if (!SpeechRecognition || !wsRef.current) return;

        const recognition = new SpeechRecognition();
        recognition.lang = lang === 'es' ? 'es-ES' : 'en-US';
        recognition.continuous = true;
        recognition.interimResults = false;

        recognition.onresult = (event) => {
            for (let i = event.resultIndex; i < event.results.length; i++) {
                if (event.results[i].isFinal) {
                    const text = event.results[i][0].transcript;
                    setTranscript(prev => [...prev, { speaker: 'You', text, isAgent: false }]);
                    if (wsRef.current?.readyState === WebSocket.OPEN) {
                        wsRef.current.send(JSON.stringify({ type: 'transcript', text }));
                    }
                }
            }
        };

        recognition.onend = () => {
            if (listening && recognitionRef.current) {
                try { recognition.start(); } catch { /* ignore */ }
            }
        };

        recognitionRef.current = recognition;
        recognition.start();
        setListening(true);
    }, [lang, listening]);

    const stopListening = useCallback(() => {
        if (recognitionRef.current) { recognitionRef.current.stop(); recognitionRef.current = null; }
        setListening(false);
    }, []);

    const handleNextItem = () => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'next-item' }));
        }
    };

    const handleEndMeeting = () => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'end-meeting' }));
        }
    };

    const handleClose = () => {
        stopListening();
        if (synthesis) synthesis.cancel();
        if (wsRef.current) wsRef.current.close();
        onClose();
    };

    const currentAgendaItem = agenda[currentItem];

    return (
        <div className="voice-overlay" style={{ background: 'rgba(0,0,0,0.92)' }}>
            <div className="meeting-layout">
                {/* Agenda sidebar */}
                <div className="meeting-agenda">
                    <h3 className="meeting-agenda-title">{t('meeting.agenda')}</h3>
                    <div className="meeting-agenda-progress">
                        {currentItem + 1} / {agenda.length} items
                    </div>
                    <div className="meeting-agenda-list">
                        {agenda.map((item, i) => {
                            const Icon = TYPE_ICONS[item.type] || FolderKanban;
                            const decision = decisions.find(d => d.item === item.name);
                            return (
                                <div key={i} className={`meeting-agenda-item ${i === currentItem ? 'active' : ''} ${decision ? 'decided' : ''}`}>
                                    <Icon size={12} style={{ color: TYPE_COLORS[item.type], flexShrink: 0 }} />
                                    <span className="meeting-agenda-item-name">{item.name?.slice(0, 40)}{item.name?.length > 40 ? '...' : ''}</span>
                                    {decision && <span className={`meeting-decision-badge ${decision.decision}`}>{decision.decision}</span>}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Main view */}
                <div className="meeting-main">
                    {/* Status bar */}
                    <div className="meeting-status-bar">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            {connected ? <Wifi size={14} style={{ color: '#10b981' }} /> : <WifiOff size={14} style={{ color: '#ef4444' }} />}
                            <span>{speaking ? t('meeting.agentSpeaking') : listening ? t('meeting.listening') : t('meeting.ready')}</span>
                        </div>
                        <span style={{ fontSize: '0.75rem' }}>{currentAgendaItem?.name}</span>
                    </div>

                    {/* Transcript */}
                    <div className="meeting-transcript">
                        {summary ? (
                            <div className="meeting-summary-view">
                                <h3>{t('meeting.summaryTitle')}</h3>
                                <div dangerouslySetInnerHTML={{ __html: summary.replace(/\n/g, '<br/>').replace(/## /g, '<h4>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
                            </div>
                        ) : (
                            transcript.map((t, i) => (
                                <div key={i} className={`meeting-msg ${t.isAgent ? 'agent' : 'human'}`}>
                                    <span className="meeting-msg-speaker">{t.speaker}</span>
                                    <p>{t.text}</p>
                                </div>
                            ))
                        )}
                        {transcript.length === 0 && !summary && (
                            <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)', padding: 40 }}>
                                {t('meeting.waitingStart')}
                            </div>
                        )}
                    </div>

                    {/* Controls */}
                    <div className="meeting-controls">
                        <button className={`voice-ctrl-btn ${listening ? 'active' : 'muted'}`} onClick={listening ? stopListening : startListening}>
                            {listening ? <Mic size={20} /> : <MicOff size={20} />}
                        </button>
                        <button className="voice-ctrl-btn muted" onClick={handleNextItem} title={t('meeting.nextItem')}>
                            <SkipForward size={20} />
                        </button>
                        <button className="voice-ctrl-btn end-call" onClick={summary ? handleClose : handleEndMeeting} title={summary ? t('meeting.close') : t('meeting.endMeeting')}>
                            <PhoneOff size={20} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
