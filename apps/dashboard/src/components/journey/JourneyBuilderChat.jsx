import { useState, useRef, useEffect } from 'react';
import { Send } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext.jsx';

const API = import.meta.env.VITE_API_URL || '/api';

export default function JourneyBuilderChat({ journeyId, messages, onJourneyState, onToolStatus, onMessage }) {
  const { t } = useLanguage();
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [liveTool, setLiveTool] = useState(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText]);

  const send = async () => {
    if (!input.trim() || streaming) return;
    const userMsg = { role: 'user', content: input };
    onMessage(userMsg);
    setInput('');
    setStreaming(true);
    setStreamingText('');

    let assistantText = '';
    try {
      const res = await fetch(`${API}/chat/journey-builder/${journeyId}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg.content }),
      });
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop();
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          let evt;
          try { evt = JSON.parse(line.slice(6)); } catch { continue; }
          if (evt.type === 'text') {
            assistantText += evt.chunk;
            setStreamingText(assistantText);
          } else if (evt.type === 'journey_state') {
            onJourneyState(evt.dsl);
          } else if (evt.type === 'tool_status') {
            setLiveTool(evt.status === 'running' ? evt.tool : null);
            onToolStatus(evt);
          } else if (evt.type === 'done' || evt.type === 'error') {
            if (assistantText) onMessage({ role: 'assistant', content: assistantText });
            setStreaming(false);
            setStreamingText('');
            setLiveTool(null);
            onToolStatus(null);
          }
        }
      }
    } catch (err) {
      console.error('[journey chat] error', err);
      if (assistantText) onMessage({ role: 'assistant', content: assistantText });
      setStreaming(false);
      setStreamingText('');
      setLiveTool(null);
      onToolStatus(null);
    }
  };

  return (
    <aside className="journey-chat">
      <div className="journey-chat__messages">
        {messages.map((m, i) => (
          <div key={i} className={`journey-chat__msg journey-chat__msg--${m.role}`}>
            <div className="journey-chat__role">{m.role}</div>
            <div className="journey-chat__body">{renderContent(m.content)}</div>
          </div>
        ))}
        {streaming && (
          <div className="journey-chat__msg journey-chat__msg--assistant">
            <div className="journey-chat__role">assistant</div>
            <div className="journey-chat__body">
              {streamingText || <span className="journey-chat__thinking">{t('journeys.thinking')}</span>}
            </div>
            {liveTool && <div className="journey-chat__tool-status">⚙ {liveTool}</div>}
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <div className="journey-chat__composer">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t('journeys.chatPlaceholder')}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          disabled={streaming}
        />
        <button onClick={send} disabled={streaming || !input.trim()}>
          <Send size={16} />
        </button>
      </div>
    </aside>
  );
}

function renderContent(c) {
  if (typeof c === 'string') return c;
  if (Array.isArray(c)) {
    return c.map((b, i) => {
      if (b.type === 'text') return <span key={i}>{b.text}</span>;
      if (b.type === 'tool_use') return <span key={i} className="journey-node__chip">⚙ {b.name}</span>;
      return null;
    });
  }
  return '…';
}
