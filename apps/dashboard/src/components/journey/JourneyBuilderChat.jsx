import { useState, useRef, useEffect } from 'react';
import { Send } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import ChatPromptChips from '../ai-proposals/ChatPromptChips.jsx';
import { CHAT_PROMPT_CHIPS } from '../../data/aiProposals.js';

const API = import.meta.env.VITE_API_URL || '/api';

export default function JourneyBuilderChat({ journeyId, messages, seedMessage, onSeedConsumed, onJourneyState, onToolStatus, onMessage }) {
  const { t } = useLanguage();
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [liveTool, setLiveTool] = useState(null);
  const [stepCount, setStepCount] = useState(0);
  const bottomRef = useRef(null);
  const seedConsumedRef = useRef(false);

  const TOOL_LABELS = {
    inspect_master_de: 'Reading master data extension…',
    set_entry_source: 'Wiring up the entry audience…',
    add_activity: 'Adding an activity…',
    update_activity: 'Updating an activity…',
    remove_activity: 'Removing an activity…',
    validate_journey: 'Running validation…',
    deploy_journey_draft: 'Deploying as Draft to MC…',
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText]);

  useEffect(() => {
    if (seedMessage && !seedConsumedRef.current && !streaming) {
      seedConsumedRef.current = true;
      sendWith(seedMessage);
      onSeedConsumed?.();
    }
  }, [seedMessage, streaming]);

  const sendWith = async (text) => {
    if (!text?.trim() || streaming) return;
    setStepCount(0);
    const userMsg = { role: 'user', content: text };
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
            if (evt.status === 'running') {
              setLiveTool(evt.tool);
            } else if (evt.status === 'done') {
              setStepCount((c) => c + 1);
            }
            onToolStatus(evt);
          } else if (evt.type === 'done' || evt.type === 'error') {
            if (assistantText) onMessage({ role: 'assistant', content: assistantText });
            setStreaming(false);
            setStreamingText('');
            setLiveTool(null);
            setStepCount(0);
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

  const send = () => {
    if (!input.trim()) return;
    sendWith(input);
    setInput('');
  };

  return (
    <div className="journey-chat__inner">
      <div className="journey-chat__messages">
        {messages.length === 0 && !streaming && (
          <div className="journey-chat__msg journey-chat__msg--assistant">
            <div className="journey-chat__role">assistant</div>
            <div className="journey-chat__body">
              How can I help with this journey? Here are some ideas:
              <ChatPromptChips
                chips={CHAT_PROMPT_CHIPS.journeyBuilder}
                onSelect={(chip) => sendWith(chip)}
              />
            </div>
          </div>
        )}
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
            {liveTool && (
              <div className="journey-chat__tool-status">
                {TOOL_LABELS[liveTool] || liveTool}
                {stepCount > 0 && <span className="journey-chat__step-count">· step {stepCount + 1}</span>}
              </div>
            )}
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
        <ChatPromptChips
          chips={CHAT_PROMPT_CHIPS.journeyBuilder}
          onSelect={(chip) => { setInput(chip); }}
          asButton
        />
        <button onClick={send} disabled={streaming || !input.trim()}>
          <Send size={16} />
        </button>
      </div>
    </div>
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
