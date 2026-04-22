import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Send, Mic, ArrowLeft } from 'lucide-react';
import BriefLivePanel from './components/BriefLivePanel.jsx';
import { briefsApi } from './lib/briefsApi.js';
import { useVoice } from '../../hooks/useVoice.js';

export default function SetupChatView({ briefId }) {
  const navigate = useNavigate();
  const [brief, setBrief] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const bottomRef = useRef(null);

  const voice = useVoice({
    lang: 'es',
    onTranscript: (text) => setInput(prev => (prev ? `${prev} ${text}` : text)),
  });

  useEffect(() => {
    let cancelled = false;
    briefsApi.list()
      .then(({ briefs }) => {
        if (cancelled) return;
        const b = briefs.find(x => x.id === briefId);
        if (!b) setLoadError('Brief not found');
        else {
          setBrief(b);
          setMessages(Array.isArray(b.chat_transcript) ? b.chat_transcript : []);
        }
      })
      .catch(err => { if (!cancelled) setLoadError(err.message); });
    return () => { cancelled = true; };
  }, [briefId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function send() {
    const msg = input.trim();
    if (!msg || sending) return;
    setInput('');
    setSending(true);
    setMessages(prev => [...prev, { role: 'user', content: msg }]);
    try {
      const { brief: updated, assistantMessage, isComplete } =
        await briefsApi.chatTurn(briefId, msg);
      setBrief(updated);
      setMessages(prev => [...prev, { role: 'assistant', content: assistantMessage }]);
      if (isComplete) {
        setTimeout(
          () => navigate(`/app/campaign-creation-v2?briefId=${briefId}&mode=options`),
          900,
        );
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: `⚠️ ${err.message}` }]);
    } finally {
      setSending(false);
    }
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  if (loadError) {
    return (
      <div className="cc2-chat-view">
        <div className="cc2-empty">Error: {loadError}</div>
      </div>
    );
  }

  if (!brief) {
    return (
      <div className="cc2-chat-view">
        <div className="cc2-empty">Loading…</div>
      </div>
    );
  }

  return (
    <div className="cc2-chat-view">
      <header className="cc2-chat-view__header">
        <button
          className="cc2-btn"
          onClick={() => navigate('/app/campaign-creation-v2')}
          type="button"
        >
          <ArrowLeft size={14} /> Back to briefs
        </button>
        <h2>Setup · {brief.name || '(unnamed)'}</h2>
      </header>

      <div className="cc2-chat-view__body">
        <section className="cc2-chat">
          <div className="cc2-chat__messages">
            {messages.length === 0 && (
              <div className="cc2-bubble assistant">
                Hi. What campaign would you like to launch? Tell me in one sentence.
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`cc2-bubble ${m.role}`}>{m.content}</div>
            ))}
            <div ref={bottomRef} />
          </div>

          <form
            className="cc2-chat__input"
            onSubmit={e => { e.preventDefault(); send(); }}
          >
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Type your answer…"
              disabled={sending}
              rows={1}
            />
            <button
              type="button"
              className="cc2-btn"
              onClick={voice.toggleListening}
              title={voice.listening ? 'Stop voice' : 'Start voice'}
              aria-pressed={voice.listening}
            >
              <Mic size={14} color={voice.listening ? 'var(--color-ai)' : undefined} />
            </button>
            <button
              type="submit"
              className="cc2-btn primary"
              disabled={sending || !input.trim()}
            >
              <Send size={14} />
            </button>
          </form>
        </section>

        <BriefLivePanel brief={brief} />
      </div>
    </div>
  );
}
