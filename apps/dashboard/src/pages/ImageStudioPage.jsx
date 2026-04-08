import React, { useState, useRef } from 'react';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import GifPipelinePreview from '../components/studio/GifPipelinePreview.jsx';
import PipelineStepsTimeline from '../components/studio/PipelineStepsTimeline.jsx';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const MODES = ['typographic', 'slideshow', 'veo'];
const IMPLEMENTED_MODES = ['typographic'];

/**
 * ImageStudioPage — /app/image-studio
 *
 * Three-column layout:
 *   - Left: chat panel (prompt input + SSE event log)
 *   - Center: GifPipelinePreview
 *   - Right: PipelineStepsTimeline
 *
 * Tab state is per-mode: each mode keeps its own chat history and preview state
 * so the user can compare modes without losing context.
 */
export default function ImageStudioPage() {
  const { t } = useLanguage();
  const [activeMode, setActiveMode] = useState('typographic');
  // Per-mode state: { chatLog, previewState, timeline }
  const [modeStates, setModeStates] = useState(() =>
    MODES.reduce((acc, m) => {
      acc[m] = {
        chatLog: [],
        previewState: { status: 'idle' },
        timeline: { completedSteps: [], activeStep: null, failedStep: null },
      };
      return acc;
    }, {})
  );
  const [input, setInput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const abortRef = useRef(null);

  const currentState = modeStates[activeMode];

  const updateMode = (mode, patch) => {
    setModeStates((prev) => ({ ...prev, [mode]: { ...prev[mode], ...patch } }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() || isRunning) return;

    if (!IMPLEMENTED_MODES.includes(activeMode)) {
      alert(t('imageStudio.modeComingSoon'));
      return;
    }

    const prompt = input.trim();
    setInput('');
    setIsRunning(true);

    // Reset state for this mode and add user message
    updateMode(activeMode, {
      chatLog: [...currentState.chatLog, { role: 'user', text: prompt }],
      previewState: { status: 'running', statusText: t('imageStudio.steps.planning') },
      timeline: { completedSteps: [], activeStep: 'planning', failedStep: null },
    });

    try {
      const controller = new AbortController();
      abortRef.current = controller;

      const response = await fetch(`${API_URL}/gif-pipeline/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ mode: activeMode, prompt, options: {} }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(err.error || 'Request failed');
      }

      // Parse SSE stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data:')) continue;
          const payload = line.slice(5).trim();
          if (payload === '[DONE]') continue;

          try {
            const event = JSON.parse(payload);
            handleSseEvent(activeMode, event);
          } catch (parseErr) {
            console.warn('[ImageStudio] Failed to parse SSE line:', payload);
          }
        }
      }
    } catch (err) {
      console.error('[ImageStudio] Pipeline error:', err);
      setModeStates((prev) => ({
        ...prev,
        [activeMode]: {
          ...prev[activeMode],
          chatLog: [...prev[activeMode].chatLog, { role: 'error', text: err.message }],
          previewState: { status: 'error' },
          timeline: { ...prev[activeMode].timeline, failedStep: prev[activeMode].timeline.activeStep },
        },
      }));
    } finally {
      setIsRunning(false);
      abortRef.current = null;
    }
  };

  // Map SSE event to state updates for a given mode
  const handleSseEvent = (mode, event) => {
    setModeStates((prev) => {
      const state = prev[mode];
      const newChatLog = [...state.chatLog, { role: 'event', event }];
      let newTimeline = state.timeline;
      let newPreview = state.previewState;

      if (event.step === 'planning') {
        newTimeline = { ...newTimeline, activeStep: 'planning' };
      } else if (event.step === 'plan_ready') {
        newTimeline = {
          completedSteps: [...newTimeline.completedSteps, 'planning'],
          activeStep: 'planReady',
          failedStep: null,
        };
      } else if (event.step === 'rendering') {
        newTimeline = {
          completedSteps: Array.from(new Set([...newTimeline.completedSteps, 'planning', 'planReady'])),
          activeStep: 'rendering',
          failedStep: null,
        };
      } else if (event.step === 'encoding') {
        newTimeline = {
          completedSteps: Array.from(new Set([...newTimeline.completedSteps, 'planning', 'planReady', 'rendering'])),
          activeStep: 'encoding',
          failedStep: null,
        };
      } else if (event.step === 'persisting') {
        newTimeline = {
          completedSteps: Array.from(new Set([...newTimeline.completedSteps, 'planning', 'planReady', 'rendering', 'encoding'])),
          activeStep: 'persisting',
          failedStep: null,
        };
      } else if (event.step === 'done') {
        newTimeline = {
          completedSteps: ['planning', 'planReady', 'rendering', 'encoding', 'persisting', 'done'],
          activeStep: null,
          failedStep: null,
        };
        newPreview = {
          status: 'done',
          gifUrl: event.gif_url,
          thumbnailUrl: event.thumbnail_url,
          meta: event.meta,
        };
      } else if (event.step === 'error') {
        newTimeline = { ...newTimeline, failedStep: newTimeline.activeStep };
        newPreview = { status: 'error' };
      }

      return {
        ...prev,
        [mode]: {
          chatLog: newChatLog,
          timeline: newTimeline,
          previewState: newPreview,
        },
      };
    });
  };

  return (
    <div className="image-studio-page">
      <header className="image-studio-header">
        <div>
          <h1>{t('imageStudio.title')}</h1>
          <p className="image-studio-subtitle">{t('imageStudio.subtitle')}</p>
        </div>
        <div className="image-studio-tabs">
          {MODES.map((mode) => (
            <button
              key={mode}
              className={`image-studio-tab ${activeMode === mode ? 'active' : ''}`}
              onClick={() => setActiveMode(mode)}
            >
              {t(`imageStudio.tabs.${mode}`)}
            </button>
          ))}
        </div>
      </header>

      <div className="image-studio-grid">
        <section className="image-studio-chat">
          <div className="image-studio-chat-log">
            {currentState.chatLog.length === 0 && (
              <div className="image-studio-chat-empty">
                {!IMPLEMENTED_MODES.includes(activeMode) && t('imageStudio.modeComingSoon')}
              </div>
            )}
            {currentState.chatLog.map((msg, i) => {
              if (msg.role === 'user') {
                return <div key={i} className="chat-msg chat-msg-user">{msg.text}</div>;
              }
              if (msg.role === 'error') {
                return <div key={i} className="chat-msg chat-msg-error">{msg.text}</div>;
              }
              // SSE event
              const step = msg.event?.step;
              return (
                <div key={i} className="chat-msg chat-msg-event">
                  <code>{step}</code>
                  {msg.event.text && <span> — {msg.event.text}</span>}
                </div>
              );
            })}
          </div>
          <form onSubmit={handleSubmit} className="image-studio-chat-form">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t('imageStudio.chat.placeholder')}
              disabled={isRunning}
            />
            <button type="submit" disabled={isRunning || !input.trim()}>
              {t('imageStudio.chat.send')}
            </button>
          </form>
        </section>

        <section className="image-studio-preview">
          <GifPipelinePreview state={currentState.previewState} />
        </section>

        <section className="image-studio-timeline">
          <PipelineStepsTimeline
            mode={activeMode}
            completedSteps={currentState.timeline.completedSteps}
            activeStep={currentState.timeline.activeStep}
            failedStep={currentState.timeline.failedStep}
          />
        </section>
      </div>
    </div>
  );
}
