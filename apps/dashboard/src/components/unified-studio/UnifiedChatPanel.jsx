import React, { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, Wrench, Check, AlertTriangle } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import ChatPromptChips from '../ai-proposals/ChatPromptChips.jsx';
import AIIdeasTab from '../ai-proposals/AIIdeasTab.jsx';
import { CHAT_PROMPT_CHIPS, AI_PROPOSALS } from '../../data/aiProposals.js';

const API_URL = import.meta.env.VITE_API_URL || '';

const TOOL_LABELS = {
    search_emirates_blocks: 'Buscar Emirates',
    import_emirates_block: 'Importar Emirates',
    add_block: 'Añadir bloque',
    update_block: 'Actualizar bloque',
    remove_block: 'Eliminar bloque',
    set_subject: 'Set subject',
    set_preheader: 'Set preheader',
    search_mc_blocks: 'Buscar en MC',
    import_mc_asset: 'Importar de MC',
};

export default function UnifiedChatPanel({ activeVariant, onApplyPatch }) {
    const { t } = useLanguage();
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [streaming, setStreaming] = useState(false);
    const [panelTab, setPanelTab] = useState('chat');
    const scrollRef = useRef(null);

    const highPriorityCount = AI_PROPOSALS.studio.proposals.filter(p => p.priority === 'urgent' || p.priority === 'high').length;

    useEffect(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
    }, [messages]);

    const appendAssistantText = (chunk) => {
        setMessages(prev => {
            const copy = prev.slice();
            const last = copy[copy.length - 1];
            if (last?.role === 'assistant' && last.kind === 'text') {
                copy[copy.length - 1] = { ...last, content: last.content + chunk };
            } else {
                copy.push({ role: 'assistant', kind: 'text', content: chunk });
            }
            return copy;
        });
    };

    const appendEvent = (event) => {
        setMessages(prev => [...prev, { role: 'assistant', kind: 'event', event }]);
    };

    const send = async () => {
        if (!input.trim() || streaming) return;
        const userContent = input.trim();
        setMessages(prev => [...prev, { role: 'user', kind: 'text', content: userContent }]);
        setInput('');
        setStreaming(true);

        try {
            const history = messages
                .filter(m => m.kind === 'text')
                .map(m => ({ role: m.role, content: m.content }));
            const r = await fetch(`${API_URL}/api/chat/unified-studio`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: userContent,
                    history,
                    activeVariant: activeVariant ? {
                        id: activeVariant.id,
                        label: activeVariant.label,
                        market: activeVariant.market,
                        tier: activeVariant.tier,
                        copy: { subject: activeVariant.copy?.subject, preheader: activeVariant.copy?.preheader },
                        html: { blockHtmlMap: activeVariant.html?.blockHtmlMap },
                        mcLink: activeVariant.mcLink,
                    } : null,
                }),
            });
            if (!r.ok || !r.body) throw new Error(`HTTP ${r.status}`);
            const reader = r.body.getReader();
            const dec = new TextDecoder();
            let buf = '';
            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                buf += dec.decode(value, { stream: true });
                const lines = buf.split('\n\n');
                buf = lines.pop() || '';
                for (const line of lines) {
                    if (!line.startsWith('data:')) continue;
                    const payload = line.slice(5).trim();
                    if (payload === '[DONE]') continue;
                    let evt;
                    try { evt = JSON.parse(payload); } catch { continue; }
                    if (evt.type === 'text') {
                        appendAssistantText(evt.text);
                    } else if (evt.type === 'tool_start') {
                        appendEvent({ kind: 'tool_start', name: evt.name, input: evt.input });
                    } else if (evt.type === 'patch') {
                        onApplyPatch?.(evt);
                        appendEvent({ kind: 'patch_applied', op: evt.op, args: evt.args });
                    } else if (evt.type === 'tool_end') {
                        // reserved for UI if needed
                    } else if (evt.type === 'error') {
                        appendEvent({ kind: 'error', message: evt.message });
                    }
                }
            }
        } catch (e) {
            appendEvent({ kind: 'error', message: e.message });
        } finally {
            setStreaming(false);
        }
    };

    return (
        <aside className="us-chat">
            <header className="us-chat-header" style={{ gap: 0, padding: 0 }}>
                <button
                    className={`journey-sidebar-tab${panelTab === 'chat' ? ' active' : ''}`}
                    onClick={() => setPanelTab('chat')}
                    type="button"
                    style={{ flex: 1, padding: '10px 8px' }}
                >
                    <Sparkles size={12} />
                    Chat
                </button>
                <button
                    className={`journey-sidebar-tab${panelTab === 'ai-ideas' ? ' active' : ''}`}
                    onClick={() => setPanelTab('ai-ideas')}
                    type="button"
                    style={{ flex: 1, padding: '10px 8px' }}
                >
                    ✦ AI Ideas
                    {highPriorityCount > 0 && <span className="ai-tab-badge">{highPriorityCount}</span>}
                </button>
            </header>
            {panelTab === 'ai-ideas' ? (
                <AIIdeasTab
                    proposals={AI_PROPOSALS.studio.proposals}
                    onDemand
                    metaText="Analysis of active variant · now"
                />
            ) : (
            <>
            <div className="us-chat-messages" ref={scrollRef}>
                {messages.length === 0 && (
                    <div className="us-chat-empty">
                        <div style={{ marginBottom: 8 }}>{t('unifiedStudio.chat.empty')}</div>
                        <ChatPromptChips
                            chips={CHAT_PROMPT_CHIPS.studio}
                            onSelect={(chip) => { setInput(chip); }}
                        />
                    </div>
                )}
                {messages.map((m, i) => {
                    if (m.kind === 'text') {
                        return (
                            <div key={i} className={`us-chat-msg us-chat-msg-${m.role}`}>
                                {m.content || <em style={{ opacity: 0.5 }}>…</em>}
                            </div>
                        );
                    }
                    if (m.kind === 'event') {
                        const e = m.event;
                        if (e.kind === 'tool_start') {
                            return (
                                <div key={i} className="us-chat-event">
                                    <Wrench size={12} />
                                    <span>{TOOL_LABELS[e.name] || e.name}</span>
                                    {e.input?.query && <code>"{e.input.query}"</code>}
                                    {e.input?.type && <code>{e.input.type}</code>}
                                    {e.input?.assetId && <code>#{e.input.assetId}</code>}
                                </div>
                            );
                        }
                        if (e.kind === 'patch_applied') {
                            const summary =
                                e.op === 'set_subject' ? `"${e.args.text}"` :
                                e.op === 'set_preheader' ? `"${e.args.text?.slice(0, 40)}..."` :
                                e.op === 'add_block' ? `${e.args.type}${e.args.label ? ' — ' + e.args.label : ''}` :
                                e.op === 'import_emirates_block' ? `${e.args.label || e.args.blockId}` :
                                e.op === 'import_mc_asset' ? `${e.args.name || '#' + e.args.assetId}` :
                                e.op === 'remove_block' ? `${e.args.blockId}` :
                                '';
                            return (
                                <div key={i} className="us-chat-event us-chat-event-applied">
                                    <Check size={12} />
                                    <span>{TOOL_LABELS[e.op] || e.op}</span>
                                    {summary && <code>{summary}</code>}
                                </div>
                            );
                        }
                        if (e.kind === 'error') {
                            return (
                                <div key={i} className="us-chat-event us-chat-event-error">
                                    <AlertTriangle size={12} />
                                    <span>{e.message}</span>
                                </div>
                            );
                        }
                    }
                    return null;
                })}
            </div>
            <div className="us-chat-input">
                <textarea
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            send();
                        }
                    }}
                    placeholder={t('unifiedStudio.chat.placeholder')}
                    rows={2}
                    disabled={streaming}
                />
                <ChatPromptChips
                    chips={CHAT_PROMPT_CHIPS.studio}
                    onSelect={(chip) => setInput(chip)}
                    asButton
                />
                <button className="us-btn us-btn-primary" onClick={send} disabled={streaming || !input.trim()}>
                    <Send size={14} />
                </button>
            </div>
            </>
            )}
        </aside>
    );
}
