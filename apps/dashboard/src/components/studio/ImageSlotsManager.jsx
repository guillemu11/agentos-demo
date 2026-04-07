// apps/dashboard/src/components/studio/ImageSlotsManager.jsx
import React, { useState } from 'react';
import { IMAGE_SLOT_NAMES } from './studioConstants.js';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export default function ImageSlotsManager({ slots, marketKey, onSlotsChange }) {
  // slots: { slotName: { url, prompt, status } }
  const [promptInputs, setPromptInputs] = useState({});
  const [showPromptFor, setShowPromptFor] = useState(null);

  const slotNames = IMAGE_SLOT_NAMES.filter(name => {
    // Only show slots that have an image OR slots found via blockVarMap
    return slots?.[name] !== undefined || name === 'hero_image';
  });

  async function generateImage(slotName, prompt) {
    if (!prompt?.trim()) return;
    onSlotsChange(prev => ({
      ...prev,
      [marketKey]: { ...(prev[marketKey] || {}), [slotName]: { url: null, prompt, status: 'generating' } },
    }));
    setShowPromptFor(null);
    setPromptInputs(p => ({ ...p, [slotName]: '' }));
    try {
      const res = await fetch(`${API_URL}/agents/generate-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ prompt, size: '1200x628' }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      onSlotsChange(prev => ({
        ...prev,
        [marketKey]: { ...(prev[marketKey] || {}), [slotName]: { url: data.url, prompt, status: 'ready' } },
      }));
    } catch (_) {
      onSlotsChange(prev => ({
        ...prev,
        [marketKey]: { ...(prev[marketKey] || {}), [slotName]: { url: null, prompt, status: 'empty' } },
      }));
    }
  }

  function removeSlot(slotName) {
    onSlotsChange(prev => {
      const next = { ...prev };
      if (next[marketKey]) {
        const market = { ...next[marketKey] };
        delete market[slotName];
        next[marketKey] = market;
      }
      return next;
    });
  }

  return (
    <div className="studio-image-slots">
      {slotNames.map(slotName => {
        const slot = slots?.[slotName];
        const hasImage = slot?.status === 'ready' && slot?.url;
        const isGenerating = slot?.status === 'generating';
        const isShowingPrompt = showPromptFor === slotName;

        return (
          <div key={slotName} className={`studio-image-slot ${hasImage ? 'has-image' : ''}`}>
            <div className="studio-image-slot-thumb">
              {hasImage ? (
                <img src={slot.url} alt={slotName} />
              ) : isGenerating ? (
                <span style={{ animation: 'studio-pulse 1.5s infinite', fontSize: 14 }}>⟳</span>
              ) : (
                <span style={{ color: 'var(--studio-text-subtle)', fontSize: 12 }}>+</span>
              )}
            </div>
            <div className="studio-image-slot-info">
              <div className="studio-image-slot-name">{slotName}</div>
              {slot?.prompt && (
                <div className="studio-image-slot-prompt">{slot.prompt}</div>
              )}
              {isShowingPrompt && (
                <div className="studio-image-gen-input">
                  <input
                    autoFocus
                    placeholder="Describe la imagen…"
                    value={promptInputs[slotName] || ''}
                    onChange={e => setPromptInputs(p => ({ ...p, [slotName]: e.target.value }))}
                    onKeyDown={e => { if (e.key === 'Enter') generateImage(slotName, promptInputs[slotName]); if (e.key === 'Escape') setShowPromptFor(null); }}
                  />
                  <button
                    className="studio-image-slot-action gen"
                    onClick={() => generateImage(slotName, promptInputs[slotName])}
                  >✓</button>
                </div>
              )}
            </div>
            <div className="studio-image-slot-actions">
              {!hasImage && !isGenerating && (
                <button className="studio-image-slot-action gen" onClick={() => setShowPromptFor(isShowingPrompt ? null : slotName)}>
                  ✦ Gen
                </button>
              )}
              {hasImage && (
                <button className="studio-image-slot-action regen" onClick={() => setShowPromptFor(isShowingPrompt ? null : slotName)}>
                  ↺
                </button>
              )}
              {(hasImage || slot?.url) && (
                <button className="studio-image-slot-action remove" onClick={() => removeSlot(slotName)}>✕</button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
