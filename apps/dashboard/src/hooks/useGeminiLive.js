/**
 * useGeminiLive — Real-time speech-to-speech via Gemini Live API
 *
 * Captures audio from microphone (PCM 16kHz), sends via WebSocket to
 * server proxy (/ws/voice-kb), receives audio responses and plays them
 * via Web Audio API. Supports RAG function calling for KB grounding.
 */

import { useState, useRef, useCallback, useEffect } from 'react';

// AudioWorklet processor code (inline to avoid separate file)
const WORKLET_CODE = `
class PCMProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this._buffer = [];
        this._chunkSize = 2400; // ~150ms at 16kHz
    }
    process(inputs) {
        const input = inputs[0];
        if (input.length > 0) {
            const samples = input[0];
            for (let i = 0; i < samples.length; i++) {
                this._buffer.push(samples[i]);
            }
            while (this._buffer.length >= this._chunkSize) {
                const chunk = this._buffer.splice(0, this._chunkSize);
                this.port.postMessage(new Float32Array(chunk));
            }
        }
        return true;
    }
}
registerProcessor('pcm-processor', PCMProcessor);
`;

function float32ToInt16Base64(float32Array) {
    const int16 = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
        const s = Math.max(-1, Math.min(1, float32Array[i]));
        int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    const bytes = new Uint8Array(int16.buffer);
    return btoa(String.fromCharCode.apply(null, bytes));
}

function base64ToFloat32(base64, inputSampleRate, outputSampleRate) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const int16 = new Int16Array(bytes.buffer);
    let float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
        float32[i] = int16[i] / (int16[i] < 0 ? 0x8000 : 0x7FFF);
    }
    // Resample if needed
    if (inputSampleRate && outputSampleRate && inputSampleRate !== outputSampleRate) {
        const ratio = outputSampleRate / inputSampleRate;
        const newLength = Math.round(float32.length * ratio);
        const resampled = new Float32Array(newLength);
        for (let i = 0; i < newLength; i++) {
            const srcIdx = i / ratio;
            const lo = Math.floor(srcIdx);
            const hi = Math.min(lo + 1, float32.length - 1);
            const frac = srcIdx - lo;
            resampled[i] = float32[lo] * (1 - frac) + float32[hi] * frac;
        }
        float32 = resampled;
    }
    return float32;
}

export function useGeminiLive({ namespace, lang = 'es', onSources }) {
    const [status, setStatus] = useState('idle'); // idle|connecting|connected|listening|speaking|searching|error
    const [inputTranscript, setInputTranscript] = useState('');
    const [outputTranscript, setOutputTranscript] = useState('');
    const [sources, setSources] = useState([]);
    const [mediaResults, setMediaResults] = useState([]);
    const [error, setError] = useState(null);
    const [isMuted, setIsMuted] = useState(false);

    const wsRef = useRef(null);
    const streamRef = useRef(null);
    const captureCtxRef = useRef(null);
    const workletNodeRef = useRef(null);
    const playbackCtxRef = useRef(null);
    const audioQueueRef = useRef([]);
    const isPlayingRef = useRef(false);
    const currentSourceRef = useRef(null);
    const gainNodeRef = useRef(null);
    const onSourcesRef = useRef(onSources);
    const turnCompleteRef = useRef(false);
    // Refs to avoid stale closures in audio callbacks
    const isMutedRef = useRef(false);
    const statusRef = useRef('idle');
    const fallbackBufferRef = useRef([]);

    useEffect(() => { onSourcesRef.current = onSources; }, [onSources]);
    useEffect(() => { isMutedRef.current = isMuted; }, [isMuted]);
    useEffect(() => { statusRef.current = status; }, [status]);

    // Play queued audio buffers sequentially
    const playNext = useCallback(() => {
        const ctx = playbackCtxRef.current;
        if (!ctx || audioQueueRef.current.length === 0) {
            isPlayingRef.current = false;
            currentSourceRef.current = null;
            if (turnCompleteRef.current) {
                setInputTranscript('');
                setOutputTranscript('');
                turnCompleteRef.current = false;
                // Delay before reopening mic to let residual speaker audio dissipate
                setTimeout(() => {
                    statusRef.current = 'listening';
                    setStatus('listening');
                }, 400);
            }
            return;
        }

        isPlayingRef.current = true;
        const float32 = audioQueueRef.current.shift();
        const buffer = ctx.createBuffer(1, float32.length, ctx.sampleRate);
        buffer.getChannelData(0).set(float32);

        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(gainNodeRef.current || ctx.destination);
        source.onended = playNext;
        source.start();
        currentSourceRef.current = source;
    }, []);

    const stopPlayback = useCallback(() => {
        audioQueueRef.current = [];
        const gain = gainNodeRef.current;
        if (currentSourceRef.current && gain) {
            // 50ms fade-out to avoid audio pop
            const now = gain.context.currentTime;
            gain.gain.setValueAtTime(gain.gain.value, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.05);
            const srcToStop = currentSourceRef.current;
            currentSourceRef.current = null;
            setTimeout(() => {
                try { srcToStop.stop(); } catch { /* ignore */ }
                gain.gain.setValueAtTime(1, gain.context.currentTime);
            }, 60);
        } else if (currentSourceRef.current) {
            try { currentSourceRef.current.stop(); } catch { /* ignore */ }
            currentSourceRef.current = null;
        }
        isPlayingRef.current = false;
    }, []);

    // Cleanup all audio resources (reusable for error/close paths)
    const cleanupAudio = useCallback(() => {
        streamRef.current?.getTracks().forEach(t => t.stop());
        streamRef.current = null;
        workletNodeRef.current?.disconnect();
        workletNodeRef.current = null;
        captureCtxRef.current?.close().catch(() => {});
        captureCtxRef.current = null;
        stopPlayback();
        gainNodeRef.current = null;
        playbackCtxRef.current?.close().catch(() => {});
        playbackCtxRef.current = null;
        fallbackBufferRef.current = [];
    }, [stopPlayback]);

    const connect = useCallback(async () => {
        if (wsRef.current?.readyState === WebSocket.OPEN || wsRef.current?.readyState === WebSocket.CONNECTING) return;

        setStatus('connecting');
        setError(null);
        setInputTranscript('');
        setOutputTranscript('');
        setSources([]);
        setMediaResults([]);

        // Build WebSocket URL
        const apiUrl = import.meta.env.VITE_API_URL || '';
        let wsUrl;
        if (apiUrl.startsWith('http')) {
            wsUrl = apiUrl.replace(/^http/, 'ws') + '/ws/voice-kb';
        } else {
            const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            wsUrl = `${wsProtocol}//${window.location.host}/ws/voice-kb`;
        }
        const params = new URLSearchParams();
        if (namespace) params.set('namespace', namespace);
        if (lang) params.set('lang', lang);
        if (params.toString()) wsUrl += '?' + params.toString();

        // Request microphone
        let stream;
        try {
            stream = await navigator.mediaDevices.getUserMedia({
                audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true, noiseSuppression: true },
            });
        } catch (err) {
            setError(err.name === 'NotAllowedError' ? 'mic-permission' : err.message);
            setStatus('error');
            return;
        }
        streamRef.current = stream;

        // Setup audio capture
        const captureCtx = new AudioContext({ sampleRate: 16000 });
        captureCtxRef.current = captureCtx;
        await captureCtx.resume();
        const source = captureCtx.createMediaStreamSource(stream);

        // Setup playback context with gain node for smooth fade-outs
        const playbackCtx = new AudioContext();
        playbackCtxRef.current = playbackCtx;
        await playbackCtx.resume();
        const gainNode = playbackCtx.createGain();
        gainNode.connect(playbackCtx.destination);
        gainNodeRef.current = gainNode;

        // Connect WebSocket
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        // Guard: should we send audio? (not muted AND not speaking/searching to prevent echo)
        const shouldSendAudio = () => {
            return !isMutedRef.current && statusRef.current !== 'speaking' && statusRef.current !== 'searching';
        };

        ws.onopen = async () => {
            setStatus('connected');

            // Setup AudioWorklet for mic capture
            try {
                const blob = new Blob([WORKLET_CODE], { type: 'application/javascript' });
                const workletUrl = URL.createObjectURL(blob);
                await captureCtx.audioWorklet.addModule(workletUrl);
                URL.revokeObjectURL(workletUrl);

                const workletNode = new AudioWorkletNode(captureCtx, 'pcm-processor');
                workletNodeRef.current = workletNode;

                workletNode.port.onmessage = (e) => {
                    if (ws.readyState === WebSocket.OPEN && shouldSendAudio()) {
                        const base64 = float32ToInt16Base64(e.data);
                        ws.send(JSON.stringify({
                            type: 'audio',
                            data: base64,
                            mimeType: 'audio/pcm;rate=16000',
                        }));
                    }
                };

                source.connect(workletNode);
                workletNode.connect(captureCtx.destination);
                setStatus('listening');
            } catch {
                // Fallback: ScriptProcessorNode (deprecated but wide support)
                const processor = captureCtx.createScriptProcessor(4096, 1, 1);
                fallbackBufferRef.current = [];
                processor.onaudioprocess = (e) => {
                    const samples = e.inputBuffer.getChannelData(0);
                    fallbackBufferRef.current.push(...samples);
                    while (fallbackBufferRef.current.length >= 2400) {
                        const chunk = new Float32Array(fallbackBufferRef.current.splice(0, 2400));
                        if (ws.readyState === WebSocket.OPEN && shouldSendAudio()) {
                            const base64 = float32ToInt16Base64(chunk);
                            ws.send(JSON.stringify({
                                type: 'audio',
                                data: base64,
                                mimeType: 'audio/pcm;rate=16000',
                            }));
                        }
                    }
                };
                source.connect(processor);
                processor.connect(captureCtx.destination);
                workletNodeRef.current = processor;
                setStatus('listening');
            }
        };

        ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);

                switch (msg.type) {
                    case 'ready':
                        break;

                    case 'audio': {
                        statusRef.current = 'speaking'; // Sync ref — blocks mic immediately
                        setStatus('speaking');
                        const inputRate = 24000;
                        const outputRate = playbackCtx.sampleRate;
                        const float32 = base64ToFloat32(msg.data, inputRate, outputRate);
                        // Cap queue to prevent unbounded growth during RAG delays
                        const MAX_QUEUE = 20;
                        if (audioQueueRef.current.length >= MAX_QUEUE) {
                            audioQueueRef.current.splice(0, audioQueueRef.current.length - MAX_QUEUE + 1);
                        }
                        audioQueueRef.current.push(float32);
                        if (!isPlayingRef.current) playNext();
                        break;
                    }

                    case 'input-transcript':
                        setInputTranscript(msg.text);
                        break;

                    case 'output-transcript':
                        setOutputTranscript(prev => prev + msg.text);
                        break;

                    case 'turn-complete':
                        turnCompleteRef.current = true;
                        // Don't clear transcripts here — wait for audio queue to drain in playNext()
                        if (!isPlayingRef.current) {
                            setInputTranscript('');
                            setOutputTranscript('');
                            turnCompleteRef.current = false;
                            // Delay before reopening mic to let residual speaker audio dissipate
                            setTimeout(() => {
                                statusRef.current = 'listening';
                                setStatus('listening');
                            }, 400);
                        }
                        break;

                    case 'interrupted':
                        stopPlayback();
                        statusRef.current = 'listening';
                        setStatus('listening');
                        break;

                    case 'searching':
                        statusRef.current = 'searching'; // Sync ref — blocks mic immediately
                        setStatus('searching');
                        break;

                    case 'rag-sources':
                        setSources(msg.sources || []);
                        onSourcesRef.current?.(msg.sources || []);
                        break;

                    case 'rag-media':
                        setMediaResults(msg.media || []);
                        break;

                    case 'error':
                        setError(msg.message);
                        setStatus('error');
                        cleanupAudio();
                        break;

                    case 'session-closed':
                        setStatus('idle');
                        cleanupAudio();
                        break;

                    case 'warning':
                        console.warn('[Voice KB] Session warning:', msg.message, msg.timeLeft);
                        break;

                    case 'pong':
                        break;
                }
            } catch { /* ignore parse errors */ }
        };

        ws.onerror = () => {
            setError('WebSocket connection error');
            setStatus('error');
            cleanupAudio();
        };

        ws.onclose = () => {
            if (statusRef.current !== 'idle') {
                setStatus('idle');
            }
            cleanupAudio();
        };
    }, [namespace, lang, playNext, stopPlayback, cleanupAudio]);

    const disconnect = useCallback(() => {
        // Close WebSocket first
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.close();
        }
        wsRef.current = null;

        // Cleanup audio resources
        cleanupAudio();

        // Reset state
        setStatus('idle');
        setInputTranscript('');
        setOutputTranscript('');
        setSources([]);
        setMediaResults([]);
        setError(null);
        turnCompleteRef.current = false;
    }, [cleanupAudio]);

    const toggleMute = useCallback(() => {
        const stream = streamRef.current;
        if (stream) {
            const track = stream.getAudioTracks()[0];
            if (track) {
                track.enabled = !track.enabled;
                setIsMuted(!track.enabled);
            }
        }
    }, []);

    const sendText = useCallback((text) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'text', text }));
        }
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.close();
            streamRef.current?.getTracks().forEach(t => t.stop());
            workletNodeRef.current?.disconnect();
            captureCtxRef.current?.close().catch(() => {});
            stopPlayback();
            playbackCtxRef.current?.close().catch(() => {});
            fallbackBufferRef.current = [];
        };
    }, [stopPlayback]);

    return {
        status,
        inputTranscript,
        outputTranscript,
        sources,
        mediaResults,
        error,
        isMuted,
        connect,
        disconnect,
        toggleMute,
        sendText,
    };
}
