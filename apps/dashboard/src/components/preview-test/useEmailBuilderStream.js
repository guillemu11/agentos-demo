import { useState, useRef, useCallback } from 'react';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const PHASE_ORDER = ['resolve', 'detect', 'analyze', 'fetch', 'render'];

function emptyPhases() {
    return {
        resolve: { status: 'idle', detail: '', durationMs: null },
        analyze: { status: 'idle', detail: '', durationMs: null },
        fetch: { status: 'idle', detail: '', durationMs: null },
        render: { status: 'idle', detail: '', durationMs: null },
    };
}

/**
 * SSE client for /api/email-builder/stream.
 * Parses events (type: session|phase|progress|tool_use|tool_result|text|confirm|variant_ready|error|done)
 * and exposes UI-ready state.
 */
export function useEmailBuilderStream() {
    const [status, setStatus] = useState('idle'); // idle|streaming|awaiting-confirm|done|error
    const [messages, setMessages] = useState([]); // chat messages (user/assistant)
    const [phases, setPhases] = useState(emptyPhases());
    const [confirmOptions, setConfirmOptions] = useState(null);
    const [variants, setVariants] = useState({}); // key → { filename, url, sizeKb }
    const [variantOrder, setVariantOrder] = useState([]);
    const [currentVariantKey, setCurrentVariantKey] = useState(null);
    const [cacheKey, setCacheKey] = useState(null);
    const [error, setError] = useState(null);
    const [emailName, setEmailName] = useState(null);

    const abortRef = useRef(null);
    const cacheKeyRef = useRef(null);
    const assistantMsgIdxRef = useRef(null);

    const reset = useCallback(() => {
        setStatus('idle');
        setMessages([]);
        setPhases(emptyPhases());
        setConfirmOptions(null);
        setVariants({});
        setVariantOrder([]);
        setCurrentVariantKey(null);
        setCacheKey(null);
        setError(null);
        setEmailName(null);
        cacheKeyRef.current = null;
        assistantMsgIdxRef.current = null;
    }, []);

    const handleEvent = useCallback((evt) => {
        switch (evt.type) {
            case 'session':
                setCacheKey(evt.cacheKey);
                cacheKeyRef.current = evt.cacheKey;
                break;

            case 'phase': {
                setPhases(prev => {
                    const next = { ...prev };
                    if (!next[evt.phase]) return prev; // ignore 'detect' etc not shown
                    next[evt.phase] = {
                        ...next[evt.phase],
                        status: evt.status === 'done' ? 'done' : 'active',
                        durationMs: evt.durationMs ?? next[evt.phase].durationMs,
                    };
                    return next;
                });
                break;
            }

            case 'progress': {
                setPhases(prev => {
                    if (!prev[evt.phase]) return prev;
                    return { ...prev, [evt.phase]: { ...prev[evt.phase], detail: evt.detail || '' } };
                });
                // Try to parse "N/M" counters from detail
                break;
            }

            case 'tool_use':
                setMessages(prev => [...prev, { role: 'tool', kind: 'use', name: evt.name, input: evt.input, id: evt.id }]);
                break;

            case 'tool_result':
                setMessages(prev => prev.map(m => m.id === evt.id ? { ...m, kind: 'result', ok: evt.ok, summary: evt.summary } : m));
                break;

            case 'text': {
                const delta = evt.delta || '';
                if (!delta) break;
                setMessages(prev => {
                    const copy = [...prev];
                    const last = copy[copy.length - 1];
                    if (last && last.role === 'assistant' && last._streaming) {
                        copy[copy.length - 1] = { ...last, content: (last.content || '') + delta };
                    } else {
                        copy.push({ role: 'assistant', content: delta, _streaming: true });
                    }
                    return copy;
                });
                break;
            }

            case 'confirm':
                setConfirmOptions(evt.options || []);
                setStatus('awaiting-confirm');
                break;

            case 'variant_ready':
                setVariants(prev => {
                    if (prev[evt.key]) return prev;
                    return { ...prev, [evt.key]: { filename: evt.filename, url: evt.url, sizeKb: evt.sizeKb } };
                });
                setVariantOrder(prev => prev.includes(evt.key) ? prev : [...prev, evt.key]);
                setCurrentVariantKey(prev => prev || evt.key);
                break;

            case 'error':
                setError({ message: evt.message, phase: evt.phase });
                break;

            case 'done':
                // Close out any streaming assistant message
                setMessages(prev => prev.map(m => m._streaming ? { ...m, _streaming: false } : m));
                setStatus(prev => prev === 'awaiting-confirm' ? prev : 'done');
                break;

            default:
                break;
        }
    }, []);

    const runStream = useCallback(async (body) => {
        setError(null);
        setStatus('streaming');

        const controller = new AbortController();
        abortRef.current = controller;

        try {
            const res = await fetch(`${API_URL}/email-builder/stream`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                signal: controller.signal,
                body: JSON.stringify(body),
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
                setError({ message: err.error || 'Request failed' });
                setStatus('error');
                return;
            }

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() ?? '';
                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    const data = line.slice(6);
                    if (data === '[DONE]') continue;
                    try {
                        const evt = JSON.parse(data);
                        handleEvent(evt);
                    } catch {}
                }
            }
        } catch (err) {
            if (err.name !== 'AbortError') {
                setError({ message: err.message });
                setStatus('error');
            }
        } finally {
            abortRef.current = null;
            setStatus(prev => prev === 'streaming' ? 'done' : prev);
        }
    }, [handleEvent]);

    const start = useCallback((input, language = 'en') => {
        if (status === 'streaming') return;
        reset();
        setMessages([{ role: 'user', content: input }]);
        runStream({ input, language });
    }, [status, reset, runStream]);

    const selectConfirmOption = useCallback((assetId, language = 'en') => {
        setConfirmOptions(null);
        setStatus('streaming');
        setMessages(prev => [...prev, { role: 'user', content: `#${assetId}`, _confirm: true }]);
        runStream({ assetId, language, cacheKey: cacheKeyRef.current });
    }, [runStream]);

    const stop = useCallback(() => {
        abortRef.current?.abort();
        setStatus('idle');
    }, []);

    const selectVariant = useCallback((key) => {
        if (variants[key]) setCurrentVariantKey(key);
    }, [variants]);

    return {
        status,
        messages,
        phases,
        confirmOptions,
        variants,
        variantOrder,
        currentVariantKey,
        cacheKey,
        error,
        emailName,
        start,
        selectConfirmOption,
        selectVariant,
        stop,
        reset,
    };
}

export { PHASE_ORDER };
