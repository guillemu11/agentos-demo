/**
 * useGeminiVoice — WebSocket-based voice hook for real-time conversation
 *
 * Connects to /ws/voice, captures audio via Web Speech API (STT),
 * sends transcripts to server, receives AI text responses,
 * and plays them via Web Speech API (TTS).
 *
 * Falls back to native useVoice if WebSocket unavailable.
 */

import { useState, useRef, useCallback, useEffect } from 'react';

const SpeechRecognition = typeof window !== 'undefined'
    ? (window.SpeechRecognition || window.webkitSpeechRecognition)
    : null;

const synthesis = typeof window !== 'undefined' ? window.speechSynthesis : null;

export function useGeminiVoice({ agentId, campaignId, lang = 'en', onTranscript, onResponse }) {
    const [connected, setConnected] = useState(false);
    const [listening, setListening] = useState(false);
    const [speaking, setSpeaking] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [aiResponse, setAiResponse] = useState('');

    const wsRef = useRef(null);
    const recognitionRef = useRef(null);
    const onTranscriptRef = useRef(onTranscript);
    const onResponseRef = useRef(onResponse);

    useEffect(() => { onTranscriptRef.current = onTranscript; }, [onTranscript]);
    useEffect(() => { onResponseRef.current = onResponse; }, [onResponse]);

    const connect = useCallback(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) return;

        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const apiUrl = import.meta.env.VITE_API_URL || '';
        let wsUrl;

        if (apiUrl.startsWith('http')) {
            wsUrl = apiUrl.replace(/^http/, 'ws') + '/ws/voice';
        } else {
            wsUrl = `${wsProtocol}//${window.location.host}/ws/voice`;
        }

        const params = new URLSearchParams();
        if (agentId) params.set('agentId', agentId);
        if (campaignId) params.set('campaignId', campaignId);
        if (params.toString()) wsUrl += '?' + params.toString();

        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => setConnected(true);

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);

                if (data.type === 'ready') {
                    setConnected(true);
                }

                if (data.type === 'response') {
                    setAiResponse(data.text);
                    onResponseRef.current?.(data.text);

                    // Speak the response via TTS
                    if (synthesis && data.text) {
                        const utterance = new SpeechSynthesisUtterance(data.text);
                        utterance.lang = lang === 'es' ? 'es-ES' : 'en-US';
                        utterance.onstart = () => setSpeaking(true);
                        utterance.onend = () => setSpeaking(false);
                        utterance.onerror = () => setSpeaking(false);
                        synthesis.speak(utterance);
                    }
                }

                if (data.type === 'error') {
                    console.warn('[GeminiVoice] Server error:', data.message);
                }
            } catch { /* ignore */ }
        };

        ws.onclose = () => {
            setConnected(false);
            setListening(false);
        };

        ws.onerror = () => {
            setConnected(false);
        };
    }, [agentId, campaignId, lang]);

    const disconnect = useCallback(() => {
        if (recognitionRef.current) {
            recognitionRef.current.stop();
            recognitionRef.current = null;
        }
        if (synthesis) synthesis.cancel();
        if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
        }
        setConnected(false);
        setListening(false);
        setSpeaking(false);
    }, []);

    const startListening = useCallback(() => {
        if (!SpeechRecognition) return;
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
            connect();
            // Retry after connection
            setTimeout(() => startListening(), 500);
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.lang = lang === 'es' ? 'es-ES' : 'en-US';
        recognition.continuous = true;
        recognition.interimResults = true;

        recognition.onresult = (event) => {
            let finalTranscript = '';
            let interimTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; i++) {
                const result = event.results[i];
                if (result.isFinal) {
                    finalTranscript += result[0].transcript;
                } else {
                    interimTranscript += result[0].transcript;
                }
            }

            setTranscript(interimTranscript || finalTranscript);

            if (finalTranscript) {
                // Send final transcript to server
                onTranscriptRef.current?.(finalTranscript);

                if (wsRef.current?.readyState === WebSocket.OPEN) {
                    wsRef.current.send(JSON.stringify({ type: 'transcript', text: finalTranscript }));
                }
            }
        };

        recognition.onend = () => {
            // Restart if still in listening mode
            if (listening && recognitionRef.current) {
                try { recognition.start(); } catch { /* ignore */ }
            }
        };

        recognition.onerror = (e) => {
            if (e.error !== 'no-speech' && e.error !== 'aborted') {
                console.warn('[GeminiVoice] Recognition error:', e.error);
            }
        };

        recognitionRef.current = recognition;
        recognition.start();
        setListening(true);
    }, [lang, connect, listening]);

    const stopListening = useCallback(() => {
        if (recognitionRef.current) {
            recognitionRef.current.stop();
            recognitionRef.current = null;
        }
        setListening(false);
        setTranscript('');
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => disconnect();
    }, [disconnect]);

    return {
        supported: !!SpeechRecognition,
        connected,
        listening,
        speaking,
        transcript,
        aiResponse,
        connect,
        disconnect,
        startListening,
        stopListening,
    };
}
