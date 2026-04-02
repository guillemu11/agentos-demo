import { useState, useRef, useCallback, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || '/api';

/**
 * Shared SSE streaming chat hook.
 * Extracted from AgentChat SSE pattern to avoid duplication.
 *
 * @param {Object} options
 * @param {string|Function} options.endpoint - URL path (relative to API_URL) or function returning full URL
 * @param {Function} [options.buildBody] - (message) => POST body object. Default: { message }
 * @param {Function} [options.onResponseHeaders] - (headers) => void
 * @param {Function} [options.loadConversation] - async () => messages[]
 * @param {Function} [options.onStreamEvent] - (event) => void for custom SSE events
 */
export function useStreamingChat({ endpoint, buildBody, onResponseHeaders, loadConversation, onStreamEvent }) {
    const [messages, setMessages] = useState([]);
    const [streaming, setStreaming] = useState(false);
    const [ragSources, setRagSources] = useState([]);
    const loadedRef = useRef(false);

    useEffect(() => {
        if (loadConversation && !loadedRef.current) {
            loadedRef.current = true;
            loadConversation().then(msgs => {
                if (msgs && Array.isArray(msgs)) setMessages(msgs);
            }).catch(() => {});
        }
    }, [loadConversation]);

    const sendMessage = useCallback(async (msg) => {
        if (!msg.trim() || streaming) return;

        setMessages(prev => [...prev, { role: 'user', content: msg }]);
        setStreaming(true);

        const url = typeof endpoint === 'function' ? endpoint() : `${API_URL}${endpoint}`;
        const body = buildBody ? buildBody(msg) : { message: msg };

        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(body),
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({ error: 'Request failed' }));
                setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${err.error}` }]);
                setStreaming(false);
                return;
            }

            const ragHeader = res.headers.get('X-RAG-Sources');
            if (ragHeader) {
                try { setRagSources(JSON.parse(ragHeader)); } catch {}
            }
            if (onResponseHeaders) onResponseHeaders(res.headers);

            // Parse inline media (images, PDFs) from response headers — email HTML comes via SSE event below
            let inlineMedia = [];
            const mediaHeader = res.headers.get('X-RAG-Media');
            if (mediaHeader) { try { inlineMedia = JSON.parse(mediaHeader); } catch {} }

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let fullResponse = '';
            let sseBuffer = '';

            setMessages(prev => [...prev, { role: 'assistant', content: '', media: inlineMedia }]);

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                sseBuffer += decoder.decode(value, { stream: true });
                const lines = sseBuffer.split('\n');
                // Keep the last (potentially incomplete) line in the buffer
                sseBuffer = lines.pop() ?? '';

                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    const data = line.slice(6);
                    if (data === '[DONE]') continue;

                    try {
                        const parsed = JSON.parse(data);
                        if (parsed.error) {
                            fullResponse = `Error: ${parsed.error}`;
                            setMessages(prev => {
                                const updated = [...prev];
                                updated[updated.length - 1] = { ...updated[updated.length - 1], content: fullResponse };
                                return updated;
                            });
                        } else if (parsed.html_sources) {
                            const newMedia = parsed.html_sources
                                .filter(s => s.htmlSource)
                                .map(s => ({ mediaType: 'email_html', htmlSource: s.htmlSource, title: s.title }));
                            if (newMedia.length > 0) {
                                setMessages(prev => {
                                    const updated = [...prev];
                                    const last = updated[updated.length - 1];
                                    const existing = last.media || [];
                                    const merged = [...existing, ...newMedia.filter(m => !existing.find(e => e.title === m.title))];
                                    updated[updated.length - 1] = { ...last, media: merged };
                                    return updated;
                                });
                                if (onStreamEvent) onStreamEvent(parsed);
                            }
                        } else if (parsed.text) {
                            fullResponse += parsed.text;
                            setMessages(prev => {
                                const updated = [...prev];
                                updated[updated.length - 1] = { ...updated[updated.length - 1], content: fullResponse };
                                return updated;
                            });
                        }
                        if (parsed.handoff_suggestion && onStreamEvent) {
                            onStreamEvent(parsed);
                        }
                    } catch {}
                }
            }
        } catch (err) {
            if (err.name !== 'AbortError') {
                setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${err.message}` }]);
            }
        } finally {
            setStreaming(false);
        }
    }, [endpoint, buildBody, onResponseHeaders, onStreamEvent, streaming]);

    const triggerInitialize = useCallback(async (initEndpoint) => {
        if (streaming) return;
        setStreaming(true);

        const url = `${API_URL}${initEndpoint}`;

        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: '{}',
            });

            if (!res.ok) {
                setStreaming(false);
                return;
            }

            const ragHeader = res.headers.get('X-RAG-Sources');
            if (ragHeader) {
                try { setRagSources(JSON.parse(ragHeader)); } catch {}
            }
            if (onResponseHeaders) onResponseHeaders(res.headers);

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let fullResponse = '';

            setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    const data = line.slice(6);
                    if (data === '[DONE]') continue;

                    try {
                        const parsed = JSON.parse(data);
                        if (parsed.text) {
                            fullResponse += parsed.text;
                            setMessages(prev => {
                                const updated = [...prev];
                                updated[updated.length - 1] = { role: 'assistant', content: fullResponse };
                                return updated;
                            });
                        }
                    } catch {}
                }
            }
        } catch {
            // Silently fail — user can still type manually
        } finally {
            setStreaming(false);
        }
    }, [onResponseHeaders, streaming]);

    const clearConversation = useCallback(() => {
        setMessages([]);
        setRagSources([]);
    }, []);

    return { messages, setMessages, streaming, sendMessage, triggerInitialize, clearConversation, ragSources };
}
