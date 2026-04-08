import React, { useState, useRef, useEffect } from 'react';
import { Type, Film, Video, Image as ImageIcon, Sparkles, ArrowRight, LayoutGrid, Zap } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import GifPipelinePreview from '../components/studio/GifPipelinePreview.jsx';
import PipelineStepsTimeline from '../components/studio/PipelineStepsTimeline.jsx';
import MediaGalleryModal from '../components/studio/MediaGalleryModal.jsx';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const MODES = ['typographic', 'image', 'slideshow', 'veo'];
const IMPLEMENTED_MODES = ['typographic', 'image'];

const MODE_ICONS = {
  typographic: Type,
  image: ImageIcon,
  slideshow: Film,
  veo: Video,
};

/**
 * Per-mode definition of which step keys complete as each SSE event arrives.
 * Maps event.step → { complete: [stepKeys to mark done], active: stepKey }.
 */
const STEP_TRANSITIONS = {
  typographic: {
    planning:   { complete: [], active: 'planning' },
    plan_ready: { complete: ['planning'], active: 'planReady' },
    rendering:  { complete: ['planning', 'planReady'], active: 'rendering' },
    encoding:   { complete: ['planning', 'planReady', 'rendering'], active: 'encoding' },
    persisting: { complete: ['planning', 'planReady', 'rendering', 'encoding'], active: 'persisting' },
    done:       { complete: ['planning', 'planReady', 'rendering', 'encoding', 'persisting', 'done'], active: null },
  },
  image: {
    planning:   { complete: [], active: 'planning' },
    plan_ready: { complete: ['planning'], active: 'planReady' },
    generating: { complete: ['planning', 'planReady'], active: 'generating' },
    persisting: { complete: ['planning', 'planReady', 'generating'], active: 'persisting' },
    done:       { complete: ['planning', 'planReady', 'generating', 'persisting', 'done'], active: null },
  },
};

const INITIAL_MODE_STATE = {
  chatLog: [],
  previewState: { status: 'idle' },
  timeline: { completedSteps: [], activeStep: null, failedStep: null },
};

/**
 * ImageStudioPage — /app/image-studio
 *
 * Three-column layout inside a full-height studio-style page.
 * Four modes via tabs (Typographic, Image, Slideshow, Veo).
 * Only Typographic and Image are implemented in this phase.
 */
export default function ImageStudioPage() {
  const { t } = useLanguage();
  const [activeMode, setActiveMode] = useState('typographic');
  const [modeStates, setModeStates] = useState(() =>
    MODES.reduce((acc, m) => {
      acc[m] = { ...INITIAL_MODE_STATE };
      return acc;
    }, {})
  );
  const [input, setInput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryRefreshKey, setGalleryRefreshKey] = useState(0);
  const [galleryCount, setGalleryCount] = useState(0);
  const abortRef = useRef(null);
  const chatLogRef = useRef(null);

  const currentState = modeStates[activeMode];

  // Auto-scroll chat log to the bottom as messages arrive
  useEffect(() => {
    if (chatLogRef.current) {
      chatLogRef.current.scrollTop = chatLogRef.current.scrollHeight;
    }
  }, [currentState.chatLog.length]);

  // Initial gallery count fetch (for the button badge)
  useEffect(() => {
    fetch(`${API_URL}/gif-pipeline/gallery`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : { gifs: [] }))
      .then((data) => setGalleryCount((data.gifs || []).length))
      .catch(() => {});
  }, [galleryRefreshKey]);

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

    // Reset the current mode's state + add the user message
    setModeStates((prev) => ({
      ...prev,
      [activeMode]: {
        chatLog: [...prev[activeMode].chatLog, { role: 'user', text: prompt }],
        previewState: { status: 'running', statusText: t('imageStudio.steps.planning') },
        timeline: { completedSteps: [], activeStep: 'planning', failedStep: null },
      },
    }));

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
      let sawDone = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data:')) continue;
          const payload = line.slice(5).trim();
          if (payload === '[DONE]') { sawDone = true; continue; }

          try {
            const event = JSON.parse(payload);
            handleSseEvent(activeMode, event);
            if (event.step === 'done') {
              // Bump gallery refresh so the count + modal update
              setGalleryRefreshKey((k) => k + 1);
            }
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

  const handleSseEvent = (mode, event) => {
    setModeStates((prev) => {
      const state = prev[mode];
      const newChatLog = [...state.chatLog, { role: 'event', event }];
      let newTimeline = state.timeline;
      let newPreview = state.previewState;

      const transitions = STEP_TRANSITIONS[mode] || STEP_TRANSITIONS.typographic;
      const transition = transitions[event.step];

      if (transition) {
        newTimeline = {
          completedSteps: Array.from(new Set([...newTimeline.completedSteps, ...transition.complete])),
          activeStep: transition.active,
          failedStep: null,
        };
      }

      if (event.step === 'done') {
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

  const getPlaceholder = () => {
    if (activeMode === 'image') return t('imageStudio.chat.placeholderImage');
    if (activeMode === 'typographic') return t('imageStudio.chat.placeholderTypographic');
    return t('imageStudio.chat.placeholder');
  };

  return (
    <div className="image-studio-page">
      {/* Top bar */}
      <header className="image-studio-topbar">
        <div className="image-studio-topbar-title">
          <h1>{t('imageStudio.title')}</h1>
          <p className="image-studio-topbar-subtitle">{t('imageStudio.subtitle')}</p>
        </div>
        <div className="image-studio-topbar-spacer" />
        <button
          className="image-studio-gallery-btn"
          onClick={() => setGalleryOpen(true)}
          type="button"
        >
          <LayoutGrid size={14} />
          {t('imageStudio.gallery.title')}
          {galleryCount > 0 && (
            <span className="image-studio-gallery-count">{galleryCount}</span>
          )}
        </button>
      </header>

      {/* Tabs */}
      <div className="image-studio-tabs-bar">
        {MODES.map((mode) => {
          const Icon = MODE_ICONS[mode];
          const isImplemented = IMPLEMENTED_MODES.includes(mode);
          return (
            <button
              key={mode}
              className={`image-studio-tab ${activeMode === mode ? 'active' : ''}`}
              onClick={() => setActiveMode(mode)}
              type="button"
            >
              <span className="image-studio-tab-icon"><Icon size={14} /></span>
              {t(`imageStudio.tabs.${mode}`)}
              {!isImplemented && (
                <span className="image-studio-tab-soon">{t('imageStudio.tabs.soon')}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Main 3-column grid */}
      <div className="image-studio-grid">
        {/* Chat column */}
        <section className="image-studio-panel">
          <div className="image-studio-panel-header">
            <h3>{t('imageStudio.chat.header')}</h3>
          </div>

          <div className="image-studio-chat-log" ref={chatLogRef}>
            {currentState.chatLog.length === 0 && (
              <div className="image-studio-chat-empty">
                <div className="image-studio-chat-empty-icon">
                  <Sparkles size={36} />
                </div>
                {IMPLEMENTED_MODES.includes(activeMode)
                  ? t('imageStudio.chat.empty')
                  : t('imageStudio.modeComingSoon')}
              </div>
            )}
            {currentState.chatLog.map((msg, i) => {
              if (msg.role === 'user') {
                return <div key={i} className="image-studio-chat-msg image-studio-chat-msg-user">{msg.text}</div>;
              }
              if (msg.role === 'error') {
                return <div key={i} className="image-studio-chat-msg image-studio-chat-msg-error">{msg.text}</div>;
              }
              const step = msg.event?.step;
              return (
                <div key={i} className="image-studio-chat-msg image-studio-chat-msg-event">
                  <code>{step}</code>
                  {msg.event.text && <span>{msg.event.text}</span>}
                </div>
              );
            })}
          </div>

          <form onSubmit={handleSubmit} className="image-studio-chat-form">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={getPlaceholder()}
              disabled={isRunning}
            />
            <button type="submit" disabled={isRunning || !input.trim()}>
              {isRunning ? (
                <>
                  <Zap size={14} />
                  {t('imageStudio.chat.sending')}
                </>
              ) : (
                <>
                  {t('imageStudio.chat.send')}
                  <ArrowRight size={14} />
                </>
              )}
            </button>
          </form>
        </section>

        {/* Preview column */}
        <section className="image-studio-panel">
          <div className="image-studio-panel-header">
            <h3>{t('imageStudio.preview.header')}</h3>
            {currentState.previewState.status === 'done' && (
              <span className="image-studio-panel-header-badge">{t('imageStudio.preview.ready')}</span>
            )}
          </div>
          <GifPipelinePreview state={currentState.previewState} />
        </section>

        {/* Timeline column */}
        <section className="image-studio-panel">
          <div className="image-studio-panel-header">
            <h3>{t('imageStudio.timeline.header')}</h3>
          </div>
          <PipelineStepsTimeline
            mode={activeMode}
            completedSteps={currentState.timeline.completedSteps}
            activeStep={currentState.timeline.activeStep}
            failedStep={currentState.timeline.failedStep}
          />
        </section>
      </div>

      <MediaGalleryModal
        open={galleryOpen}
        onClose={() => setGalleryOpen(false)}
        refreshKey={galleryRefreshKey}
      />
    </div>
  );
}
