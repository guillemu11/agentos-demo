# Content Studio Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite ContentStudioPage with resizable panels, unified variants+images panel, live preview connected to chat, and modern dark UI.

**Architecture:** ContentStudioPage becomes a thin orchestrator (~150 lines) holding all shared state. Eight focused subcomponents in `src/components/studio/` handle rendering. Chat↔email connection is made explicit: approving a BRIEF_UPDATE immediately updates `ampVarValues` which triggers the live preview iframe.

**Tech Stack:** React 19, CSS custom properties, react-resizable-panels 2.x, existing SSE endpoints (no backend changes)

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `apps/dashboard/src/components/studio/StudioTopBar.jsx` | Ticket pill, progress stepper, action buttons |
| Create | `apps/dashboard/src/components/studio/StudioChatPanel.jsx` | Chat with Lucia, brief-cards, image-gen cards with slot assignment |
| Create | `apps/dashboard/src/components/studio/StudioVariantsPanel.jsx` | Tabs: Contenido / Imágenes / AMPscript |
| Create | `apps/dashboard/src/components/studio/MarketSelector.jsx` | Market chips with done/active/pending states |
| Create | `apps/dashboard/src/components/studio/VariantFieldsGrid.jsx` | 5-field grid with pending/generating/approved states |
| Create | `apps/dashboard/src/components/studio/ImageSlotsManager.jsx` | Image slots with generate/regenerate/remove |
| Create | `apps/dashboard/src/components/studio/StudioLivePreview.jsx` | Live iframe + market tabs + mobile toggle |
| Create | `apps/dashboard/src/components/studio/VariantPreviewModal.jsx` | Full-screen modal, tabs per market |
| Rewrite | `apps/dashboard/src/pages/ContentStudioPage.jsx` | Orchestrator with unified state |
| Modify | `apps/dashboard/src/index.css` | Add `--studio-*` CSS custom properties + studio layout classes |
| Modify | `apps/dashboard/src/i18n/translations.js` | Add studio.* translation keys |
| Install | `apps/dashboard/package.json` | Add `react-resizable-panels` |

---

## Task 1: Install react-resizable-panels and add CSS variables

**Files:**
- Modify: `apps/dashboard/package.json`
- Modify: `apps/dashboard/src/index.css`

- [ ] **Step 1: Install the package**

```bash
cd apps/dashboard && npm install react-resizable-panels@^2.1.7
```

Expected: package added to `node_modules`, `package.json` updated with `"react-resizable-panels": "^2.1.7"`.

- [ ] **Step 2: Add studio CSS variables and layout classes to index.css**

Open `apps/dashboard/src/index.css`. After the last `:root` variable (around line 57, after `--research-purple-dim`), add:

```css
  /* Content Studio */
  --studio-bg:            #0a0e1a;
  --studio-surface:       #0d1220;
  --studio-surface-2:     #0b1018;
  --studio-border:        rgba(255,255,255,0.06);
  --studio-border-accent: rgba(99,102,241,0.2);
  --studio-indigo:        #6366f1;
  --studio-indigo-soft:   rgba(99,102,241,0.15);
  --studio-green:         #34d399;
  --studio-green-soft:    rgba(16,185,129,0.12);
  --studio-amber:         #fbbf24;
  --studio-amber-soft:    rgba(245,158,11,0.12);
  --studio-text:          #e2e8f0;
  --studio-text-muted:    #64748b;
  --studio-text-subtle:   #334155;
  --studio-panel-resize-handle: rgba(99,102,241,0.3);
```

Then append at the bottom of `index.css`:

```css
/* ═══════════════════════════════════════════
   CONTENT STUDIO — Layout & shared styles
═══════════════════════════════════════════ */
.content-studio-page {
  display: grid;
  grid-template-rows: 48px 1fr;
  height: 100vh;
  overflow: hidden;
  background: var(--studio-bg);
  color: var(--studio-text);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

/* react-resizable-panels resize handle */
.studio-resize-handle {
  width: 4px;
  background: transparent;
  transition: background 0.15s;
  cursor: col-resize;
  flex-shrink: 0;
}
.studio-resize-handle:hover,
.studio-resize-handle[data-resize-handle-active] {
  background: var(--studio-panel-resize-handle);
}
.studio-resize-handle-vertical {
  height: 4px;
  width: 100%;
  background: transparent;
  transition: background 0.15s;
  cursor: row-resize;
  flex-shrink: 0;
}
.studio-resize-handle-vertical:hover,
.studio-resize-handle-vertical[data-resize-handle-active] {
  background: var(--studio-panel-resize-handle);
}

/* Panel base */
.studio-panel {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--studio-surface);
  border-right: 1px solid var(--studio-border);
}
.studio-panel-header {
  padding: 10px 16px;
  border-bottom: 1px solid var(--studio-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
}
.studio-panel-title {
  font-size: 10px;
  font-weight: 700;
  color: var(--studio-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.8px;
}

/* Top bar */
.studio-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  background: #0f1629;
  border-bottom: 1px solid var(--studio-border-accent);
  flex-shrink: 0;
  gap: 12px;
}
.studio-topbar-left  { display: flex; align-items: center; gap: 10px; }
.studio-topbar-center { display: flex; align-items: center; gap: 4px; }
.studio-topbar-right  { display: flex; align-items: center; gap: 8px; }

.studio-logo {
  font-size: 11px;
  font-weight: 700;
  color: var(--studio-indigo);
  letter-spacing: 1px;
  text-transform: uppercase;
}
.studio-topbar-sep {
  width: 1px;
  height: 16px;
  background: rgba(255,255,255,0.1);
}
.studio-ticket-pill {
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--studio-indigo-soft);
  border: 1px solid var(--studio-border-accent);
  padding: 3px 10px 3px 6px;
  border-radius: 20px;
  font-size: 11px;
  color: #a5b4fc;
  max-width: 260px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.studio-ticket-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--studio-indigo);
  animation: studio-glow 2s ease-in-out infinite;
  flex-shrink: 0;
}
@keyframes studio-glow {
  0%, 100% { box-shadow: 0 0 4px var(--studio-indigo); }
  50%       { box-shadow: 0 0 10px var(--studio-indigo); }
}

/* Stepper */
.studio-step {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 3px 10px;
  border-radius: 20px;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.3px;
  white-space: nowrap;
}
.studio-step.done    { background: var(--studio-green-soft); color: var(--studio-green); }
.studio-step.active  { background: var(--studio-indigo-soft); color: #818cf8; border: 1px solid var(--studio-border-accent); }
.studio-step.pending { color: var(--studio-text-subtle); }
.studio-step-conn    { color: #1e293b; font-size: 10px; padding: 0 2px; }

/* Buttons */
.studio-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 5px 14px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  border: none;
  white-space: nowrap;
  transition: opacity 0.15s;
}
.studio-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.studio-btn-ghost   { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: var(--studio-text-muted); }
.studio-btn-outline { background: transparent; border: 1px solid var(--studio-border-accent); color: #818cf8; }
.studio-btn-primary { background: linear-gradient(135deg, var(--studio-indigo), #8b5cf6); color: white; }

/* Progress counter badge */
.studio-progress-badge {
  font-size: 10px;
  color: var(--studio-text-muted);
  white-space: nowrap;
}

/* Agent badge (in chat header) */
.studio-agent-badge {
  display: flex;
  align-items: center;
  gap: 5px;
  background: rgba(139,92,246,0.12);
  padding: 3px 10px;
  border-radius: 20px;
  font-size: 10px;
  color: #a78bfa;
  font-weight: 600;
}
.studio-agent-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #a78bfa;
  box-shadow: 0 0 6px #a78bfa;
}

/* Chat messages */
.studio-chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.studio-msg { max-width: 88%; }
.studio-msg.user   { align-self: flex-end; }
.studio-msg.agent  { align-self: flex-start; }
.studio-bubble {
  padding: 9px 13px;
  border-radius: 10px;
  line-height: 1.55;
  font-size: 12.5px;
}
.studio-bubble.user  { background: var(--studio-indigo-soft); color: #c7d2fe; border-radius: 10px 10px 2px 10px; }
.studio-bubble.agent { background: rgba(255,255,255,0.04); color: #cbd5e1; border-radius: 10px 10px 10px 2px; }

/* Brief cards in chat */
.studio-brief-card {
  background: var(--studio-green-soft);
  border: 1px solid rgba(16,185,129,0.2);
  border-radius: 8px;
  padding: 9px 11px;
  margin-top: 6px;
}
.studio-brief-card-label {
  font-size: 9px;
  color: var(--studio-green);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 4px;
  display: flex;
  justify-content: space-between;
}
.studio-brief-card-value {
  font-size: 12px;
  color: #94a3b8;
  line-height: 1.4;
}
.studio-brief-card-actions {
  display: flex;
  gap: 4px;
  margin-top: 6px;
}
.studio-brief-action {
  font-size: 9px;
  padding: 2px 8px;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 600;
  border: none;
}
.studio-brief-action.approve  { background: rgba(16,185,129,0.15); color: var(--studio-green); }
.studio-brief-action.regen    { background: var(--studio-indigo-soft); color: #818cf8; }

/* Image gen card in chat */
.studio-image-card {
  margin-top: 8px;
  border-radius: 8px;
  overflow: hidden;
}
.studio-image-card img {
  width: 100%;
  border-radius: 8px;
  display: block;
}
.studio-image-card-prompt {
  font-size: 10px;
  color: var(--studio-text-muted);
  font-style: italic;
  margin-top: 4px;
}
.studio-image-card-actions {
  display: flex;
  gap: 6px;
  margin-top: 6px;
  flex-wrap: wrap;
}
.studio-image-slot-btn {
  font-size: 10px;
  padding: 3px 10px;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 600;
  border: none;
  background: var(--studio-indigo-soft);
  color: #818cf8;
}
.studio-image-slot-btn.discard {
  background: rgba(239,68,68,0.1);
  color: #f87171;
}
.studio-image-skeleton {
  width: 100%;
  height: 90px;
  background: linear-gradient(135deg, rgba(99,102,241,0.2), rgba(139,92,246,0.1));
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 11px;
  color: #818cf8;
  font-weight: 600;
  animation: studio-pulse 1.5s ease-in-out infinite;
}
@keyframes studio-pulse {
  0%, 100% { opacity: 0.6; }
  50%       { opacity: 1; }
}

/* Typing indicator */
.studio-typing {
  display: flex;
  gap: 4px;
  align-items: center;
  padding: 8px 12px;
  align-self: flex-start;
}
.studio-typing span {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--studio-text-muted);
  animation: studio-bounce 1.2s infinite;
}
.studio-typing span:nth-child(2) { animation-delay: 0.2s; }
.studio-typing span:nth-child(3) { animation-delay: 0.4s; }
@keyframes studio-bounce {
  0%, 60%, 100% { transform: translateY(0); }
  30%           { transform: translateY(-4px); }
}

/* Chat input */
.studio-chat-input-row {
  padding: 12px;
  border-top: 1px solid var(--studio-border);
  display: flex;
  gap: 8px;
  align-items: flex-end;
  flex-shrink: 0;
}
.studio-chat-textarea {
  flex: 1;
  background: rgba(255,255,255,0.04);
  border: 1px solid var(--studio-border);
  color: var(--studio-text);
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 12.5px;
  resize: none;
  outline: none;
  height: 36px;
  font-family: inherit;
  transition: border-color 0.15s;
}
.studio-chat-textarea:focus { border-color: var(--studio-border-accent); }
.studio-chat-send-btn {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: rgba(99,102,241,0.8);
  border: none;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 15px;
  flex-shrink: 0;
}
.studio-chat-send-btn:disabled { opacity: 0.4; cursor: not-allowed; }

/* Variants panel tabs */
.studio-tabs {
  display: flex;
  border-bottom: 1px solid var(--studio-border);
  background: var(--studio-surface-2);
  flex-shrink: 0;
}
.studio-tab {
  padding: 10px 16px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  color: var(--studio-text-subtle);
  border-bottom: 2px solid transparent;
  background: none;
  border-left: none;
  border-right: none;
  border-top: none;
  white-space: nowrap;
  transition: color 0.15s;
}
.studio-tab.active { color: #818cf8; border-bottom-color: var(--studio-indigo); }
.studio-tab:hover:not(.active) { color: var(--studio-text-muted); }

/* Market selector */
.studio-market-tabs { display: flex; gap: 6px; flex-wrap: wrap; }
.studio-market-tab {
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 10px;
  font-weight: 700;
  cursor: pointer;
  border: 1px solid var(--studio-border);
  color: var(--studio-text-muted);
  display: flex;
  align-items: center;
  gap: 4px;
  background: none;
  transition: all 0.15s;
}
.studio-market-tab.active { background: var(--studio-indigo-soft); border-color: var(--studio-border-accent); color: #a5b4fc; }
.studio-market-tab.done   { border-color: rgba(16,185,129,0.3); color: var(--studio-green); background: var(--studio-green-soft); }
.studio-market-tab .dot   { width: 5px; height: 5px; border-radius: 50%; }

/* Variant fields grid */
.studio-fields-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.studio-field {
  background: rgba(255,255,255,0.03);
  border: 1px solid var(--studio-border);
  border-radius: 8px;
  padding: 9px 11px;
  transition: border-color 0.2s, background 0.2s;
}
.studio-field.filled    { border-color: rgba(16,185,129,0.2); background: rgba(16,185,129,0.04); }
.studio-field.generating{ border-color: rgba(245,158,11,0.2); background: rgba(245,158,11,0.03); }
.studio-field-label {
  font-size: 9px;
  font-weight: 700;
  color: var(--studio-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.4px;
  margin-bottom: 4px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.studio-field-status {
  font-size: 8px;
  padding: 1px 5px;
  border-radius: 8px;
}
.studio-field-status.ok   { background: rgba(16,185,129,0.15); color: var(--studio-green); }
.studio-field-status.gen  { background: rgba(245,158,11,0.15); color: var(--studio-amber); animation: studio-pulse 1.5s infinite; }
.studio-field-status.pend { color: var(--studio-text-subtle); }
.studio-field-value { font-size: 11.5px; color: #94a3b8; line-height: 1.45; }
.studio-field-value.empty { color: var(--studio-text-subtle); font-style: italic; font-size: 11px; }

/* Image slots */
.studio-image-slots { display: flex; flex-direction: column; gap: 8px; }
.studio-image-slot {
  display: flex;
  gap: 10px;
  align-items: center;
  background: rgba(255,255,255,0.03);
  border: 1px solid var(--studio-border);
  border-radius: 8px;
  padding: 8px 10px;
  transition: border-color 0.2s;
}
.studio-image-slot.has-image { border-color: var(--studio-border-accent); }
.studio-image-slot-thumb {
  width: 48px;
  height: 32px;
  border-radius: 4px;
  overflow: hidden;
  flex-shrink: 0;
  background: rgba(255,255,255,0.04);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
}
.studio-image-slot-thumb img { width: 100%; height: 100%; object-fit: cover; }
.studio-image-slot-info { flex: 1; min-width: 0; }
.studio-image-slot-name  { font-size: 11px; color: var(--studio-text-muted); font-weight: 600; }
.studio-image-slot-prompt { font-size: 10px; color: var(--studio-text-subtle); font-style: italic; margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.studio-image-slot-actions { display: flex; gap: 4px; flex-shrink: 0; }
.studio-image-slot-action {
  font-size: 9px;
  padding: 2px 7px;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 600;
  border: none;
}
.studio-image-slot-action.gen    { background: var(--studio-indigo-soft); color: #818cf8; }
.studio-image-slot-action.regen  { background: rgba(245,158,11,0.15); color: var(--studio-amber); }
.studio-image-slot-action.remove { background: rgba(239,68,68,0.12); color: #f87171; }
.studio-image-gen-input {
  display: flex;
  gap: 6px;
  margin-top: 6px;
}
.studio-image-gen-input input {
  flex: 1;
  background: rgba(255,255,255,0.04);
  border: 1px solid var(--studio-border);
  color: var(--studio-text);
  border-radius: 6px;
  padding: 5px 10px;
  font-size: 11px;
  outline: none;
}
.studio-image-gen-input input:focus { border-color: var(--studio-border-accent); }

/* Live preview panel */
.studio-live-preview {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--studio-surface-2);
}
.studio-preview-header {
  padding: 8px 16px;
  border-bottom: 1px solid var(--studio-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
}
.studio-preview-market-tabs { display: flex; gap: 2px; }
.studio-preview-market-tab {
  padding: 3px 9px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 600;
  cursor: pointer;
  color: var(--studio-text-subtle);
  background: none;
  border: none;
}
.studio-preview-market-tab.active { background: var(--studio-indigo-soft); color: #818cf8; }
.studio-live-badge {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 9px;
  color: var(--studio-green);
  font-weight: 700;
}
.studio-live-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--studio-green);
  animation: studio-glow 2s infinite;
}
.studio-preview-body { flex: 1; display: flex; flex-direction: column; overflow: hidden; padding: 8px; gap: 8px; }
.studio-email-frame {
  flex: 1;
  background: white;
  border-radius: 8px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.studio-email-chrome {
  background: #f1f5f9;
  padding: 5px 10px;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  gap: 5px;
  align-items: center;
  flex-shrink: 0;
}
.studio-chrome-dot { width: 7px; height: 7px; border-radius: 50%; }
.studio-email-iframe { flex: 1; border: none; width: 100%; }
.studio-preview-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}
.studio-preview-action {
  flex: 1;
  padding: 6px;
  border-radius: 6px;
  font-size: 10px;
  font-weight: 600;
  cursor: pointer;
  text-align: center;
  border: 1px solid;
}
.studio-preview-action.sec { background: transparent; border-color: var(--studio-border); color: var(--studio-text-muted); }
.studio-preview-action.pri { background: var(--studio-indigo-soft); border-color: var(--studio-border-accent); color: #818cf8; }

/* Variant preview modal */
.studio-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.8);
  display: flex;
  flex-direction: column;
  z-index: 1000;
}
.studio-modal {
  display: flex;
  flex-direction: column;
  flex: 1;
  margin: 24px;
  background: var(--studio-surface);
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid var(--studio-border-accent);
}
.studio-modal-header {
  padding: 14px 20px;
  border-bottom: 1px solid var(--studio-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
}
.studio-modal-title { font-size: 14px; font-weight: 700; color: var(--studio-text); }
.studio-modal-close {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  background: rgba(255,255,255,0.05);
  border: 1px solid var(--studio-border);
  color: var(--studio-text-muted);
  cursor: pointer;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.studio-modal-tabs {
  display: flex;
  border-bottom: 1px solid var(--studio-border);
  background: var(--studio-surface-2);
  flex-shrink: 0;
}
.studio-modal-tab {
  padding: 10px 20px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  color: var(--studio-text-subtle);
  border-bottom: 2px solid transparent;
  background: none;
  border-left: none;
  border-right: none;
  border-top: none;
}
.studio-modal-tab.active { color: #818cf8; border-bottom-color: var(--studio-indigo); }
.studio-modal-body { flex: 1; overflow: hidden; display: flex; flex-direction: column; padding: 16px; }
.studio-modal-iframe { flex: 1; border: none; width: 100%; border-radius: 8px; }
.studio-modal-footer {
  padding: 12px 20px;
  border-top: 1px solid var(--studio-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
}
.studio-modal-footer-info { font-size: 12px; color: var(--studio-text-muted); }

/* Variants panel body scrollable area */
.studio-variants-body {
  flex: 1;
  overflow-y: auto;
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* AMPscript tab — reuse existing vars */
.studio-ampscript-wrap { flex: 1; overflow-y: auto; }

/* No ticket empty state */
.studio-empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 12px;
  color: var(--studio-text-muted);
  font-size: 13px;
  padding: 32px;
  text-align: center;
}
.studio-empty-state .icon { font-size: 2rem; }
```

- [ ] **Step 3: Verify Vite still starts (no CSS parse errors)**

```bash
cd apps/dashboard && npm run dev &
sleep 5 && curl -s http://localhost:4000 | head -5
```

Expected: HTML response with `<!DOCTYPE html>` — no CSS parse errors in terminal.

- [ ] **Step 4: Commit**

```bash
cd apps/dashboard
git add package.json src/index.css
git commit -m "feat(content-studio): add react-resizable-panels + studio CSS variables"
```

---

## Task 2: StudioTopBar component

**Files:**
- Create: `apps/dashboard/src/components/studio/StudioTopBar.jsx`

- [ ] **Step 1: Create the directory**

```bash
mkdir -p apps/dashboard/src/components/studio
```

- [ ] **Step 2: Write StudioTopBar.jsx**

```jsx
// apps/dashboard/src/components/studio/StudioTopBar.jsx
import React from 'react';

const STEP_THRESHOLDS = {
  brief: 0,
  content: 1,
  images: 5,
  preview: 10,
  handoff: 15,
};

function getCurrentStep(approvedCount) {
  if (approvedCount >= STEP_THRESHOLDS.handoff) return 'handoff';
  if (approvedCount >= STEP_THRESHOLDS.preview) return 'preview';
  if (approvedCount >= STEP_THRESHOLDS.images) return 'images';
  if (approvedCount >= STEP_THRESHOLDS.content) return 'content';
  return 'brief';
}

const STEPS = ['brief', 'content', 'images', 'preview', 'handoff'];
const STEP_LABELS = {
  brief:   'Brief',
  content: 'Contenido',
  images:  'Imágenes',
  preview: 'Preview',
  handoff: 'Handoff',
};

export default function StudioTopBar({ ticket, progressStats, onShowPreviewModal, onHandoff, canHandoff }) {
  const { approved = 0, total = 0 } = progressStats || {};
  const currentStep = getCurrentStep(approved);
  const currentIdx = STEPS.indexOf(currentStep);

  return (
    <div className="studio-topbar">
      <div className="studio-topbar-left">
        <div className="studio-logo">Content Studio</div>
        <div className="studio-topbar-sep" />
        {ticket ? (
          <div className="studio-ticket-pill" title={ticket.project_name}>
            <div className="studio-ticket-dot" />
            #{ticket.id} — {ticket.project_name}
          </div>
        ) : (
          <div className="studio-ticket-pill" style={{ opacity: 0.5 }}>
            <div className="studio-ticket-dot" />
            Sin ticket activo
          </div>
        )}
      </div>

      <div className="studio-topbar-center">
        {STEPS.map((step, i) => {
          const isDone = i < currentIdx;
          const isActive = i === currentIdx;
          return (
            <React.Fragment key={step}>
              {i > 0 && <div className="studio-step-conn">›</div>}
              <div className={`studio-step ${isDone ? 'done' : isActive ? 'active' : 'pending'}`}>
                {isDone ? '✓ ' : isActive ? '◉ ' : '○ '}{STEP_LABELS[step]}
              </div>
            </React.Fragment>
          );
        })}
      </div>

      <div className="studio-topbar-right">
        <span className="studio-progress-badge">{approved} / {total} campos aprobados</span>
        <button className="studio-btn studio-btn-ghost" onClick={onShowPreviewModal} disabled={!ticket}>
          ⊞ Todas las variantes
        </button>
        <button
          className="studio-btn studio-btn-primary"
          onClick={onHandoff}
          disabled={!canHandoff}
          title={canHandoff ? 'Enviar contenido al HTML Developer' : 'Necesitas aprobar al menos una variante completa'}
        >
          → Enviar a HTML Dev
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/src/components/studio/StudioTopBar.jsx
git commit -m "feat(content-studio): add StudioTopBar with progress stepper"
```

---

## Task 3: MarketSelector and VariantFieldsGrid components

**Files:**
- Create: `apps/dashboard/src/components/studio/MarketSelector.jsx`
- Create: `apps/dashboard/src/components/studio/VariantFieldsGrid.jsx`

- [ ] **Step 1: Write MarketSelector.jsx**

```jsx
// apps/dashboard/src/components/studio/MarketSelector.jsx
import React from 'react';

const MARKET_FLAGS = { en: '🇬🇧', es: '🇪🇸', ar: '🇦🇪', ru: '🇷🇺' };

function marketStatus(marketKey, variants) {
  const FIELDS = ['subject', 'preheader', 'heroHeadline', 'bodyCopy', 'cta'];
  // Check all tiers for this market — if any tier is complete, mark done
  const keys = Object.keys(variants).filter(k => k.startsWith(marketKey + ':'));
  if (keys.length === 0) return 'pending';
  const anyDone = keys.some(k =>
    FIELDS.every(f => variants[k]?.[f]?.status === 'approved')
  );
  if (anyDone) return 'done';
  const anyProgress = keys.some(k =>
    FIELDS.some(f => variants[k]?.[f]?.status === 'generating' || variants[k]?.[f]?.value != null)
  );
  return anyProgress ? 'in-progress' : 'pending';
}

export default function MarketSelector({ markets, activeMarket, variants, onSelect }) {
  return (
    <div className="studio-market-tabs">
      {markets.map(market => {
        const status = marketStatus(market, variants);
        const isActive = activeMarket === market;
        return (
          <button
            key={market}
            className={`studio-market-tab ${isActive ? 'active' : ''} ${status === 'done' ? 'done' : ''}`}
            onClick={() => onSelect(market)}
          >
            <div
              className="dot"
              style={{
                background: status === 'done' ? 'var(--studio-green)'
                  : status === 'in-progress' ? 'var(--studio-indigo)'
                  : 'var(--studio-text-subtle)',
              }}
            />
            {MARKET_FLAGS[market] || '🌐'} {market.toUpperCase()}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Write VariantFieldsGrid.jsx**

```jsx
// apps/dashboard/src/components/studio/VariantFieldsGrid.jsx
import React from 'react';

const FIELDS = [
  { key: 'subject',      label: 'Subject' },
  { key: 'preheader',    label: 'Preheader' },
  { key: 'heroHeadline', label: 'Hero Headline' },
  { key: 'cta',          label: 'CTA' },
  { key: 'bodyCopy',     label: 'Body Copy' },
];

export default function VariantFieldsGrid({ variantData }) {
  if (!variantData) {
    return (
      <div className="studio-fields-grid">
        {FIELDS.map(f => (
          <div key={f.key} className={`studio-field${f.key === 'bodyCopy' ? ' full-width' : ''}`} style={f.key === 'bodyCopy' ? { gridColumn: '1/-1' } : {}}>
            <div className="studio-field-label">
              {f.label}
              <span className="studio-field-status pend">pendiente</span>
            </div>
            <div className="studio-field-value empty">Esperando generación…</div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="studio-fields-grid">
      {FIELDS.map(f => {
        const field = variantData[f.key] || { status: 'pending', value: null };
        const cls = field.status === 'approved' ? 'filled' : field.status === 'generating' ? 'generating' : '';
        return (
          <div
            key={f.key}
            className={`studio-field ${cls}`}
            style={f.key === 'bodyCopy' ? { gridColumn: '1/-1' } : {}}
          >
            <div className="studio-field-label">
              {f.label}
              {field.status === 'approved' && <span className="studio-field-status ok">✓</span>}
              {field.status === 'generating' && <span className="studio-field-status gen">generando…</span>}
              {field.status === 'pending' && <span className="studio-field-status pend">pendiente</span>}
            </div>
            <div className={`studio-field-value ${!field.value ? 'empty' : ''}`}>
              {field.value || 'Esperando…'}
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/src/components/studio/MarketSelector.jsx apps/dashboard/src/components/studio/VariantFieldsGrid.jsx
git commit -m "feat(content-studio): add MarketSelector and VariantFieldsGrid"
```

---

## Task 4: ImageSlotsManager component

**Files:**
- Create: `apps/dashboard/src/components/studio/ImageSlotsManager.jsx`

- [ ] **Step 1: Write ImageSlotsManager.jsx**

```jsx
// apps/dashboard/src/components/studio/ImageSlotsManager.jsx
import React, { useState } from 'react';

const API_URL = import.meta.env.VITE_API_URL || '/api';

// Known image variable names that map to slots
const IMAGE_VAR_NAMES = ['hero_image', 'story1_image', 'story2_image', 'story3_image', 'article_image', 'destination_image', 'banner_image'];

export default function ImageSlotsManager({ slots, marketKey, onSlotsChange }) {
  // slots: { slotName: { url, prompt, status } }
  const [promptInputs, setPromptInputs] = useState({});
  const [showPromptFor, setShowPromptFor] = useState(null);

  const slotNames = IMAGE_VAR_NAMES.filter(name => {
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
```

- [ ] **Step 2: Commit**

```bash
git add apps/dashboard/src/components/studio/ImageSlotsManager.jsx
git commit -m "feat(content-studio): add ImageSlotsManager with generate/regen/remove"
```

---

## Task 5: StudioVariantsPanel component

**Files:**
- Create: `apps/dashboard/src/components/studio/StudioVariantsPanel.jsx`

- [ ] **Step 1: Write StudioVariantsPanel.jsx**

```jsx
// apps/dashboard/src/components/studio/StudioVariantsPanel.jsx
import React, { useState } from 'react';
import MarketSelector from './MarketSelector.jsx';
import VariantFieldsGrid from './VariantFieldsGrid.jsx';
import ImageSlotsManager from './ImageSlotsManager.jsx';

const AVAILABLE_TIERS = ['economy', 'economy_premium', 'business', 'first_class'];
const TIER_LABELS = { economy: 'Economy', economy_premium: 'Eco Premium', business: 'Business', first_class: 'First Class' };

export default function StudioVariantsPanel({
  markets,
  variants,
  activeMarket,
  activeTier,
  onMarketSelect,
  onTierSelect,
  imageSlots,
  onSlotsChange,
  blockVarMap,
  ampVarValues,
  onVarChange,
}) {
  const [activeTab, setActiveTab] = useState('content');

  const variantKey = `${activeMarket}:${activeTier}`;
  const variantData = variants[variantKey] || null;

  const hasAmpscript = Object.keys(blockVarMap || {}).length > 0;
  const marketSlots = imageSlots?.[activeMarket] || {};

  return (
    <div className="studio-panel" style={{ borderRight: 'none', borderBottom: '1px solid var(--studio-border)' }}>
      {/* Tabs */}
      <div className="studio-tabs">
        <button className={`studio-tab ${activeTab === 'content' ? 'active' : ''}`} onClick={() => setActiveTab('content')}>Contenido</button>
        <button className={`studio-tab ${activeTab === 'images' ? 'active' : ''}`} onClick={() => setActiveTab('images')}>Imágenes</button>
        {hasAmpscript && (
          <button className={`studio-tab ${activeTab === 'ampscript' ? 'active' : ''}`} onClick={() => setActiveTab('ampscript')}>AMPscript</button>
        )}
      </div>

      {/* Body */}
      <div className="studio-variants-body">
        {activeTab === 'content' && (
          <>
            <MarketSelector
              markets={markets}
              activeMarket={activeMarket}
              variants={variants}
              onSelect={onMarketSelect}
            />
            {markets.length > 1 && (
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {AVAILABLE_TIERS.map(tier => (
                  <button
                    key={tier}
                    className={`studio-market-tab ${activeTier === tier ? 'active' : ''}`}
                    onClick={() => onTierSelect(tier)}
                    style={{ fontSize: 9 }}
                  >
                    {TIER_LABELS[tier]}
                  </button>
                ))}
              </div>
            )}
            <VariantFieldsGrid variantData={variantData} />
          </>
        )}

        {activeTab === 'images' && (
          <>
            <MarketSelector
              markets={markets}
              activeMarket={activeMarket}
              variants={variants}
              onSelect={onMarketSelect}
            />
            <ImageSlotsManager
              slots={marketSlots}
              marketKey={activeMarket}
              onSlotsChange={onSlotsChange}
            />
          </>
        )}

        {activeTab === 'ampscript' && hasAmpscript && (
          <div className="studio-ampscript-wrap">
            {Object.entries(blockVarMap).map(([blockName, vars]) => (
              <div key={blockName} style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--studio-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>
                  {blockName}
                </div>
                {vars.map(varName => (
                  <div key={varName} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
                    <div style={{ fontSize: 11, color: 'var(--studio-indigo)', fontFamily: 'monospace', minWidth: 120, flexShrink: 0 }}>@{varName}</div>
                    <input
                      style={{ flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid var(--studio-border)', color: 'var(--studio-text)', borderRadius: 6, padding: '4px 8px', fontSize: 11, outline: 'none' }}
                      value={ampVarValues?.[`@${varName}`] || ''}
                      onChange={e => onVarChange(`@${varName}`, e.target.value)}
                      placeholder={`@${varName}`}
                    />
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/dashboard/src/components/studio/StudioVariantsPanel.jsx
git commit -m "feat(content-studio): add StudioVariantsPanel with content/images/ampscript tabs"
```

---

## Task 6: StudioLivePreview component

**Files:**
- Create: `apps/dashboard/src/components/studio/StudioLivePreview.jsx`

- [ ] **Step 1: Write StudioLivePreview.jsx**

```jsx
// apps/dashboard/src/components/studio/StudioLivePreview.jsx
import React, { useState } from 'react';
import { substituteForPreview } from '../../utils/emailMockSubstitute.js';

export default function StudioLivePreview({ liveHtml, baseHtml, markets, previewMarket, onMarketSelect, onShowModal }) {
  const [isMobile, setIsMobile] = useState(false);

  const srcDoc = liveHtml || (baseHtml ? substituteForPreview(baseHtml) : '');

  return (
    <div className="studio-live-preview">
      <div className="studio-preview-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="studio-panel-title">Preview</div>
          <div className="studio-preview-market-tabs">
            {markets.map(m => (
              <button
                key={m}
                className={`studio-preview-market-tab ${previewMarket === m ? 'active' : ''}`}
                onClick={() => onMarketSelect(m)}
              >
                {m.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className="studio-live-badge">
            <div className="studio-live-dot" />
            live
          </div>
          <button
            className="studio-btn studio-btn-ghost"
            style={{ padding: '2px 8px', fontSize: 10 }}
            onClick={() => setIsMobile(m => !m)}
          >
            {isMobile ? '🖥 Desktop' : '📱 Mobile'}
          </button>
        </div>
      </div>

      <div className="studio-preview-body">
        <div className="studio-email-frame">
          <div className="studio-email-chrome">
            <div className="studio-chrome-dot" style={{ background: '#ef4444' }} />
            <div className="studio-chrome-dot" style={{ background: '#f59e0b' }} />
            <div className="studio-chrome-dot" style={{ background: '#10b981' }} />
          </div>
          {srcDoc ? (
            <iframe
              className="studio-email-iframe"
              srcDoc={srcDoc}
              sandbox="allow-same-origin"
              title="Email preview"
              style={{ width: isMobile ? 375 : '100%', maxWidth: '100%', margin: '0 auto', display: 'block' }}
            />
          ) : (
            <div className="studio-empty-state" style={{ background: 'white', color: '#64748b' }}>
              <div className="icon">📧</div>
              <div>Sin template disponible</div>
              <div style={{ fontSize: 11 }}>El HTML Developer debe guardar un template primero</div>
            </div>
          )}
        </div>

        <div className="studio-preview-actions">
          <button className="studio-preview-action sec" onClick={() => setIsMobile(m => !m)}>
            {isMobile ? '🖥' : '📱'} {isMobile ? 'Desktop' : 'Mobile'}
          </button>
          <button className="studio-preview-action pri" onClick={onShowModal}>
            ⊞ Todas las variantes
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/dashboard/src/components/studio/StudioLivePreview.jsx
git commit -m "feat(content-studio): add StudioLivePreview with live iframe and mobile toggle"
```

---

## Task 7: VariantPreviewModal component

**Files:**
- Create: `apps/dashboard/src/components/studio/VariantPreviewModal.jsx`

- [ ] **Step 1: Write VariantPreviewModal.jsx**

```jsx
// apps/dashboard/src/components/studio/VariantPreviewModal.jsx
import React, { useState } from 'react';
import { substituteForPreview } from '../../utils/emailMockSubstitute.js';

const MARKET_FLAGS = { en: '🇬🇧', es: '🇪🇸', ar: '🇦🇪', ru: '🇷🇺' };

function buildPreviewHtml(baseHtml, market, tier, variants, imageSlots, ampVarValues) {
  if (!baseHtml) return '';
  const variantKey = `${market}:${tier}`;
  const variantData = variants[variantKey];
  const slots = imageSlots?.[market] || {};

  // Start with amp var substitution
  let html = baseHtml;
  const merged = { ...(ampVarValues || {}) };

  // Override with variant field values
  const FIELD_TO_VAR = {
    subject:      '@subject',
    preheader:    '@preheader',
    heroHeadline: '@hero_title',
    bodyCopy:     '@body_copy',
    cta:          '@cta_text',
  };
  if (variantData) {
    Object.entries(FIELD_TO_VAR).forEach(([field, varName]) => {
      if (variantData[field]?.value) merged[varName] = variantData[field].value;
    });
  }

  // Apply image slots
  Object.entries(slots).forEach(([slotName, slot]) => {
    if (slot?.url) merged[`@${slotName}`] = slot.url;
  });

  // Substitute
  for (const [key, value] of Object.entries(merged)) {
    const varName = key.startsWith('@') ? key.slice(1) : key;
    const safe = varName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    html = html.replace(new RegExp(`%%=v\\(@${safe}\\)=%%`, 'g'), value);
  }

  // Fallback: mock-substitute any remaining vars
  return substituteForPreview(html);
}

export default function VariantPreviewModal({ ticket, markets, activeTier, variants, imageSlots, ampVarValues, baseHtml, progressStats, onHandoff, onClose }) {
  const [activeMarket, setActiveMarket] = useState(markets[0] || 'en');
  const { approved = 0, total = 0 } = progressStats || {};

  const previewHtml = buildPreviewHtml(baseHtml, activeMarket, activeTier, variants, imageSlots, ampVarValues);

  return (
    <div className="studio-modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="studio-modal">
        <div className="studio-modal-header">
          <div className="studio-modal-title">
            Preview — {ticket?.project_name || 'Campaña'}
          </div>
          <button className="studio-modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="studio-modal-tabs">
          {markets.map(market => (
            <button
              key={market}
              className={`studio-modal-tab ${activeMarket === market ? 'active' : ''}`}
              onClick={() => setActiveMarket(market)}
            >
              {MARKET_FLAGS[market] || '🌐'} {market.toUpperCase()}
            </button>
          ))}
        </div>

        <div className="studio-modal-body">
          {previewHtml ? (
            <iframe
              className="studio-modal-iframe"
              srcDoc={previewHtml}
              sandbox="allow-same-origin"
              title={`Preview ${activeMarket}`}
            />
          ) : (
            <div className="studio-empty-state" style={{ background: 'white', color: '#64748b', borderRadius: 8 }}>
              <div className="icon">📧</div>
              <div>Sin template disponible</div>
            </div>
          )}
        </div>

        <div className="studio-modal-footer">
          <div className="studio-modal-footer-info">
            {approved} / {total} campos aprobados · {markets.length} markets
          </div>
          <button
            className="studio-btn studio-btn-primary"
            onClick={onHandoff}
            disabled={approved === 0}
            title={approved === 0 ? 'Aprueba al menos un campo antes de hacer handoff' : ''}
          >
            → Hacer Handoff a HTML Dev
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/dashboard/src/components/studio/VariantPreviewModal.jsx
git commit -m "feat(content-studio): add VariantPreviewModal with per-market tabs"
```

---

## Task 8: StudioChatPanel component

**Files:**
- Create: `apps/dashboard/src/components/studio/StudioChatPanel.jsx`

- [ ] **Step 1: Write StudioChatPanel.jsx**

This replaces ContentChatPanel for the studio context — same SSE logic but with image-to-slot assignment and the new dark UI.

```jsx
// apps/dashboard/src/components/studio/StudioChatPanel.jsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send } from 'lucide-react';
import renderMarkdown from '../../utils/renderMarkdown.js';

const API_URL = import.meta.env.VITE_API_URL || '/api';
const BRIEF_UPDATE_RE = /\[BRIEF_UPDATE:(\{[^}]+\})\]/g;
const IMAGE_REQUEST_RE = /\b(imagen?|image|foto|photo|banner|hero|visual|picture|ilustra|generat|crea(?:r)?|diseña|design|make)\b.{0,80}\b(imagen?|image|foto|photo|banner|hero|avion|plane|aircraft|logo|background|fondo)\b/i;
const MARKET_FLAGS = { en: '🇬🇧', es: '🇪🇸', ar: '🇦🇪', ru: '🇷🇺' };

// Known image slot names — used for auto-assign detection
const IMAGE_SLOT_NAMES = ['hero_image', 'story1_image', 'story2_image', 'destination_image', 'banner_image', 'article_image'];

function parseBriefUpdates(chunk) {
  const briefUpdates = [];
  BRIEF_UPDATE_RE.lastIndex = 0;
  let match;
  while ((match = BRIEF_UPDATE_RE.exec(chunk)) !== null) {
    try { briefUpdates.push(JSON.parse(match[1])); } catch (_) {}
  }
  return { textChunk: chunk.replace(BRIEF_UPDATE_RE, '').trim(), briefUpdates };
}

function detectSlotFromPrompt(prompt) {
  if (!prompt) return null;
  const lower = prompt.toLowerCase();
  return IMAGE_SLOT_NAMES.find(name => lower.includes(name.replace('_', ' ')) || lower.includes(name)) || null;
}

export default function StudioChatPanel({
  agent,
  ticket,
  activeMarket,
  onBriefUpdate,
  onImageAssigned,
  externalInput,
  onExternalInputConsumed,
}) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!externalInput) return;
    setInput(externalInput);
    onExternalInputConsumed?.();
    inputRef.current?.focus();
  }, [externalInput, onExternalInputConsumed]);

  // Load or initialize session messages
  useEffect(() => {
    let cancelled = false;
    if (!ticket) { setMessages([]); return; }
    (async () => {
      try {
        const msgsRes = await fetch(
          `${API_URL}/projects/${ticket.project_id}/sessions/${ticket.id}/messages`,
          { credentials: 'include' }
        );
        if (cancelled) return;
        let loaded = [];
        if (msgsRes.ok) {
          const data = await msgsRes.json();
          const arr = data?.messages ?? data;
          loaded = Array.isArray(arr) ? arr : [];
        }
        if (loaded.length > 0) {
          if (!cancelled) {
            const parsed = loaded.map(m => {
              if (m.role !== 'assistant') return { role: m.role, content: m.content };
              const { textChunk, briefUpdates } = parseBriefUpdates(m.content || '');
              briefUpdates.forEach(u => onBriefUpdate(u));
              return { role: m.role, content: textChunk };
            });
            setMessages(parsed);
          }
          return;
        }
        if (!cancelled) setStreaming(true);
        if (!cancelled) setMessages([{ role: 'assistant', content: '', _loading: true }]);
        const initRes = await fetch(
          `${API_URL}/projects/${ticket.project_id}/sessions/${ticket.id}/initialize`,
          { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' } }
        );
        if (cancelled || !initRes.ok) {
          if (!cancelled) setMessages([{ role: 'assistant', content: `¡Hola! Lista para trabajar en **${ticket.project_name}**.` }]);
          return;
        }
        const reader = initRes.body.getReader();
        const decoder = new TextDecoder();
        let fullText = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done || cancelled) break;
          for (const line of decoder.decode(value, { stream: true }).split('\n')) {
            if (!line.startsWith('data: ')) continue;
            const data = line.slice(6).trim();
            if (data === '[DONE]') break;
            try {
              const p = JSON.parse(data);
              if (p.text) { fullText += p.text; if (!cancelled) setMessages([{ role: 'assistant', content: fullText }]); }
            } catch (_) {}
          }
        }
      } catch (_) {
        if (!cancelled) setMessages([{ role: 'assistant', content: `¡Hola! Lista para trabajar en **${ticket?.project_name || 'este proyecto'}**.` }]);
      } finally {
        if (!cancelled) setStreaming(false);
      }
    })();
    return () => { cancelled = true; };
  }, [agent?.id, ticket?.id, onBriefUpdate]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || streaming) return;
    setInput('');
    setStreaming(true);
    const looksLikeImage = IMAGE_REQUEST_RE.test(text);
    setMessages(prev => looksLikeImage
      ? [...prev, { role: 'user', content: text }, { role: 'assistant', isImageSkeleton: true }]
      : [...prev, { role: 'user', content: text }]
    );
    const variantContext = activeMarket ? ` — Active Market: ${activeMarket}` : '';
    const contextPrefix = ticket ? `[Campaign: ${ticket.project_name} — Stage: ${ticket.stage_name}${variantContext}]\n\n` : '';
    try {
      const endpoint = ticket
        ? `${API_URL}/projects/${ticket.project_id}/sessions/${ticket.id}/chat`
        : `${API_URL}/chat/agent/${agent.id}`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ message: ticket ? text : contextPrefix + text }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let assistantText = '';
      let textAdded = false;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const line of decoder.decode(value, { stream: true }).split('\n')) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') break;
          try {
            const parsed = JSON.parse(data);
            if (parsed.image_error) {
              setMessages(prev => {
                const idx = prev.findLastIndex(m => m.isImageSkeleton);
                const err = { role: 'assistant', content: `⚠️ ${parsed.image_error}` };
                if (idx !== -1) { const n = [...prev]; n[idx] = err; return n; }
                return [...prev, err];
              });
            }
            if (parsed.image_url) {
              const detectedSlot = detectSlotFromPrompt(parsed.image_prompt);
              const imageMsg = {
                role: 'assistant', content: '',
                image_url: parsed.image_url,
                image_prompt: parsed.image_prompt,
                detectedSlot,
                activeMarket,
              };
              setMessages(prev => {
                const idx = prev.findLastIndex(m => m.isImageSkeleton);
                if (idx !== -1) { const n = [...prev]; n[idx] = imageMsg; return n; }
                return [...prev, imageMsg];
              });
              // Auto-assign if slot detected
              if (detectedSlot && onImageAssigned) {
                onImageAssigned(activeMarket, detectedSlot, parsed.image_url, parsed.image_prompt);
              }
            }
            if (parsed.text) {
              const { textChunk, briefUpdates } = parseBriefUpdates(parsed.text);
              assistantText += textChunk;
              briefUpdates.forEach(u => onBriefUpdate(u));
              if (!textAdded) {
                textAdded = true;
                setMessages(prev => [...prev, { role: 'assistant', content: assistantText, briefUpdates }]);
              } else {
                setMessages(prev => {
                  const n = [...prev];
                  for (let i = n.length - 1; i >= 0; i--) {
                    if (n[i].role === 'assistant' && !n[i].image_url) {
                      n[i] = { ...n[i], content: assistantText, briefUpdates: [...(n[i].briefUpdates || []), ...briefUpdates] };
                      break;
                    }
                  }
                  return n;
                });
              }
            }
          } catch (_) {}
        }
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${err.message}` }]);
    } finally {
      setStreaming(false);
      inputRef.current?.focus();
    }
  }, [input, streaming, agent?.id, ticket, activeMarket, onBriefUpdate, onImageAssigned]);

  if (!ticket) {
    return (
      <div className="studio-panel" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div className="studio-empty-state">
          <div className="icon">📋</div>
          <div style={{ fontWeight: 600 }}>Sin ticket activo</div>
          <div style={{ fontSize: 11, lineHeight: 1.6 }}>Selecciona un ticket para empezar con Lucia</div>
        </div>
      </div>
    );
  }

  return (
    <div className="studio-panel">
      <div className="studio-panel-header">
        <div className="studio-panel-title">Chat</div>
        <div className="studio-agent-badge">
          <div className="studio-agent-dot" />
          Lucia · activa
        </div>
      </div>

      <div className="studio-chat-messages">
        {messages.map((msg, i) => (
          <div key={i} className={`studio-msg ${msg.role}`}>
            {msg.isImageSkeleton ? (
              <div className="studio-image-skeleton">⟳ Generando imagen…</div>
            ) : msg.image_url ? (
              <div>
                <div className="studio-image-card">
                  <img src={msg.image_url} alt={msg.image_prompt || 'Generated'} />
                  {msg.image_prompt && <div className="studio-image-card-prompt">{msg.image_prompt}</div>}
                </div>
                <div className="studio-image-card-actions">
                  {IMAGE_SLOT_NAMES.map(slotName => (
                    <button
                      key={slotName}
                      className="studio-image-slot-btn"
                      onClick={() => onImageAssigned?.(msg.activeMarket || activeMarket, slotName, msg.image_url, msg.image_prompt)}
                    >
                      Usar como {slotName}
                    </button>
                  ))}
                  <button className="studio-image-slot-btn discard" onClick={() => setMessages(prev => prev.filter((_, j) => j !== i))}>
                    Descartar
                  </button>
                </div>
              </div>
            ) : (
              <div className={`studio-bubble ${msg.role}`}>
                {msg.role === 'assistant'
                  ? <div dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content || '…') }} />
                  : msg.content}
                {msg.briefUpdates?.map((u, j) => (
                  <div key={j} className="studio-brief-card">
                    <div className="studio-brief-card-label">
                      {u.block} · {MARKET_FLAGS[u.variant?.split(':')[0]] || '🌐'} {u.variant?.toUpperCase().replace(':', ' / ')}
                    </div>
                    <div className="studio-brief-card-value">{u.status === 'generating' ? '…' : u.value}</div>
                    {u.status === 'approved' && (
                      <div className="studio-brief-card-actions">
                        <button className="studio-brief-action approve" onClick={() => onBriefUpdate({ ...u, status: 'approved' })}>✓ Aprobar</button>
                        <button className="studio-brief-action regen" onClick={() => { setInput(`Regenera el ${u.block} para la variante ${u.variant}`); inputRef.current?.focus(); }}>↺ Regenerar</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        {streaming && (
          <div className="studio-typing">
            <span /><span /><span />
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="studio-chat-input-row">
        <textarea
          ref={inputRef}
          className="studio-chat-textarea"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
          placeholder={streaming ? '…' : 'Pide copies, imágenes, variantes por mercado…'}
          disabled={streaming}
          rows={1}
        />
        <button className="studio-chat-send-btn" onClick={sendMessage} disabled={!input.trim() || streaming}>
          <Send size={14} />
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/dashboard/src/components/studio/StudioChatPanel.jsx
git commit -m "feat(content-studio): add StudioChatPanel with image-to-slot assignment and typing indicator"
```

---

## Task 9: Rewrite ContentStudioPage as orchestrator

**Files:**
- Rewrite: `apps/dashboard/src/pages/ContentStudioPage.jsx`

- [ ] **Step 1: Rewrite ContentStudioPage.jsx**

```jsx
// apps/dashboard/src/pages/ContentStudioPage.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels';
import { useAgentPipelineSession } from '../hooks/useAgentPipelineSession.js';
import HandoffModal from '../components/HandoffModal.jsx';
import StudioTopBar from '../components/studio/StudioTopBar.jsx';
import StudioChatPanel from '../components/studio/StudioChatPanel.jsx';
import StudioVariantsPanel from '../components/studio/StudioVariantsPanel.jsx';
import StudioLivePreview from '../components/studio/StudioLivePreview.jsx';
import VariantPreviewModal from '../components/studio/VariantPreviewModal.jsx';
import { substituteForPreview } from '../utils/emailMockSubstitute.js';

const API_URL = import.meta.env.VITE_API_URL || '/api';
const AGENT_ID = 'lucia';
const ALL_MARKETS = ['en', 'es', 'ar', 'ru'];
const DEFAULT_TIER = 'economy';
const FIELD_TO_VAR = {
  subject:      '@subject',
  preheader:    '@preheader',
  heroHeadline: '@hero_title',
  bodyCopy:     '@body_copy',
  cta:          '@cta_text',
};
const ALL_VARIANT_FIELDS = Object.keys(FIELD_TO_VAR);
// Handoff requires at least one complete variant (all 5 fields approved)
const MIN_APPROVED_FOR_HANDOFF = 5;

function emptyVariant() {
  return {
    subject:      { status: 'pending', value: null },
    preheader:    { status: 'pending', value: null },
    heroHeadline: { status: 'pending', value: null },
    bodyCopy:     { status: 'pending', value: null },
    cta:          { status: 'pending', value: null },
  };
}

export default function ContentStudioPage() {
  const [searchParams] = useSearchParams();
  const ticketId = searchParams.get('ticketId');

  const [agent, setAgent] = useState(null);
  const [projectEmails, setProjectEmails] = useState([]);
  const [variants, setVariants] = useState({});
  const [imageSlots, setImageSlots] = useState({});
  const [ampVarValues, setAmpVarValues] = useState({});
  const [blockVarMap, setBlockVarMap] = useState({});
  const [availableMarkets, setAvailableMarkets] = useState(ALL_MARKETS);
  const [activeMarket, setActiveMarket] = useState('en');
  const [activeTier, setActiveTier] = useState(DEFAULT_TIER);
  const [previewMarket, setPreviewMarket] = useState('en');
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [chatPreload, setChatPreload] = useState('');

  const pipeline = useAgentPipelineSession(AGENT_ID);

  // Load agent
  useEffect(() => {
    fetch(`${API_URL}/agents/${AGENT_ID}`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setAgent(data); })
      .catch(() => {});
  }, []);

  // Auto-select ticket from URL
  useEffect(() => {
    if (!ticketId || !pipeline.tickets.length || pipeline.selectedTicket) return;
    const t = pipeline.tickets.find(t => String(t.id) === ticketId);
    if (t) pipeline.selectTicket(t);
  }, [ticketId, pipeline.tickets, pipeline.selectedTicket]);

  // Load emails + variables when ticket changes
  useEffect(() => {
    const projectId = pipeline.selectedTicket?.project_id;
    if (!projectId) { setProjectEmails([]); setBlockVarMap({}); setAmpVarValues({}); return; }

    Promise.all([
      fetch(`${API_URL}/projects/${projectId}/emails`, { credentials: 'include' }).then(r => r.ok ? r.json() : []),
      fetch(`${API_URL}/projects/${projectId}/email-variables`, { credentials: 'include' }).then(r => r.ok ? r.json() : { variables: {} }),
    ]).then(([emailsData, varsData]) => {
      const emails = Array.isArray(emailsData) ? emailsData : [];
      setProjectEmails(emails);
      const html = (emails.find(e => e.status === 'approved') || emails[0])?.html_content || '';
      if (html) {
        const map = {};
        html.split(/(?=data-block-name="/)/).slice(1).forEach(part => {
          const nm = part.match(/data-block-name="([^"]+)"/);
          if (!nm) return;
          const vars = [...part.substring(0, 3000).matchAll(/%%=v\(@(\w+)\)=%%/g)].map(m => m[1]);
          if (vars.length) map[nm[1]] = [...new Set(vars)];
        });
        setBlockVarMap(map);
      }
      setAmpVarValues(varsData.variables || {});
    }).catch(() => {});
  }, [pipeline.selectedTicket?.project_id]);

  // Reset state on ticket change
  useEffect(() => {
    const raw = pipeline.selectedTicket?.project_markets || pipeline.selectedTicket?.metadata?.markets || ALL_MARKETS;
    const resolved = Array.isArray(raw) && raw.every(m => ALL_MARKETS.includes(m)) ? raw : ALL_MARKETS;
    setAvailableMarkets(resolved);
    setActiveMarket(resolved[0] || 'en');
    setPreviewMarket(resolved[0] || 'en');
    setVariants({});
    setImageSlots({});
  }, [pipeline.selectedTicket?.id]);

  // Computed: live HTML for preview
  const baseHtml = useMemo(() => {
    const email = projectEmails.find(e => e.status === 'approved') || projectEmails[0];
    return email?.html_content || '';
  }, [projectEmails]);

  const liveHtml = useMemo(() => {
    if (!baseHtml) return '';
    const merged = { ...ampVarValues };
    // Inject active preview market's variants
    const variantKey = `${previewMarket}:${activeTier}`;
    const variantData = variants[variantKey];
    if (variantData) {
      Object.entries(FIELD_TO_VAR).forEach(([field, varName]) => {
        if (variantData[field]?.value) merged[varName] = variantData[field].value;
      });
    }
    // Inject image slots for preview market
    const slots = imageSlots[previewMarket] || {};
    Object.entries(slots).forEach(([slotName, slot]) => {
      if (slot?.url) merged[`@${slotName}`] = slot.url;
    });
    let html = baseHtml;
    for (const [key, value] of Object.entries(merged)) {
      const varName = key.startsWith('@') ? key.slice(1) : key;
      const safe = varName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      html = html.replace(new RegExp(`%%=v\\(@${safe}\\)=%%`, 'g'), value);
    }
    return html;
  }, [baseHtml, ampVarValues, variants, imageSlots, previewMarket, activeTier]);

  // Computed: progress stats
  const progressStats = useMemo(() => {
    let approved = 0;
    let total = 0;
    availableMarkets.forEach(market => {
      const key = `${market}:${activeTier}`;
      const vd = variants[key];
      ALL_VARIANT_FIELDS.forEach(field => {
        total++;
        if (vd?.[field]?.status === 'approved') approved++;
      });
    });
    return { approved, total };
  }, [variants, availableMarkets, activeTier]);

  const canHandoff = progressStats.approved >= MIN_APPROVED_FOR_HANDOFF;

  // Handlers
  const handleBriefUpdate = useCallback(({ variant, block, status, value }) => {
    setVariants(prev => ({
      ...prev,
      [variant]: { ...(prev[variant] || emptyVariant()), [block]: { status, value } },
    }));
    // If approved, also update ampVarValues for live preview
    if (status === 'approved' && value != null) {
      const varName = FIELD_TO_VAR[block];
      if (varName) setAmpVarValues(prev => ({ ...prev, [varName]: value }));
    }
  }, []);

  const handleImageAssigned = useCallback((market, slotName, url, prompt) => {
    setImageSlots(prev => ({
      ...prev,
      [market]: { ...(prev[market] || {}), [slotName]: { url, prompt, status: 'ready' } },
    }));
    // Also update ampVarValues so live preview shows the image
    setAmpVarValues(prev => ({ ...prev, [`@${slotName}`]: url }));
  }, []);

  const handleVarChange = useCallback((varName, value) => {
    setAmpVarValues(prev => ({ ...prev, [varName]: value }));
  }, []);

  const handleHandoff = useCallback(() => {
    pipeline.setHandoffSession({
      id: pipeline.selectedTicket?.id || 'content-brief',
      stage_order: pipeline.currentSession?.stage_order,
      variants,
      activeVariant: `${activeMarket}:${activeTier}`,
    });
    setShowPreviewModal(false);
  }, [pipeline, variants, activeMarket, activeTier]);

  if (!agent) return <div style={{ color: 'var(--studio-text)', padding: 32 }}>Cargando…</div>;

  return (
    <div className="content-studio-page">
      <StudioTopBar
        ticket={pipeline.selectedTicket}
        progressStats={progressStats}
        onShowPreviewModal={() => setShowPreviewModal(true)}
        onHandoff={handleHandoff}
        canHandoff={canHandoff}
      />

      <PanelGroup direction="horizontal" style={{ height: '100%' }}>
        {/* LEFT: Chat */}
        <Panel defaultSize={38} minSize={25} maxSize={55}>
          <StudioChatPanel
            agent={agent}
            ticket={pipeline.selectedTicket}
            activeMarket={activeMarket}
            onBriefUpdate={handleBriefUpdate}
            onImageAssigned={handleImageAssigned}
            externalInput={chatPreload}
            onExternalInputConsumed={() => setChatPreload('')}
          />
        </Panel>

        <PanelResizeHandle className="studio-resize-handle" />

        {/* RIGHT: Variants + Preview */}
        <Panel minSize={35}>
          <PanelGroup direction="vertical" style={{ height: '100%' }}>
            <Panel defaultSize={50} minSize={30}>
              <StudioVariantsPanel
                markets={availableMarkets}
                variants={variants}
                activeMarket={activeMarket}
                activeTier={activeTier}
                onMarketSelect={setActiveMarket}
                onTierSelect={setActiveTier}
                imageSlots={imageSlots}
                onSlotsChange={setImageSlots}
                blockVarMap={blockVarMap}
                ampVarValues={ampVarValues}
                onVarChange={handleVarChange}
              />
            </Panel>

            <PanelResizeHandle className="studio-resize-handle-vertical" />

            <Panel minSize={25}>
              <StudioLivePreview
                liveHtml={liveHtml}
                baseHtml={baseHtml}
                markets={availableMarkets}
                previewMarket={previewMarket}
                onMarketSelect={setPreviewMarket}
                onShowModal={() => setShowPreviewModal(true)}
              />
            </Panel>
          </PanelGroup>
        </Panel>
      </PanelGroup>

      {showPreviewModal && (
        <VariantPreviewModal
          ticket={pipeline.selectedTicket}
          markets={availableMarkets}
          activeTier={activeTier}
          variants={variants}
          imageSlots={imageSlots}
          ampVarValues={ampVarValues}
          baseHtml={baseHtml}
          progressStats={progressStats}
          onHandoff={handleHandoff}
          onClose={() => setShowPreviewModal(false)}
        />
      )}

      {pipeline.handoffSession && (
        <HandoffModal
          projectId={pipeline.selectedTicket?.project_id}
          session={pipeline.handoffSession}
          stages={pipeline.stages}
          agents={pipeline.agents}
          onClose={() => pipeline.setHandoffSession(null)}
          onComplete={pipeline.onHandoffComplete}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify the page loads without errors**

Navigate to `http://localhost:4000/app/workspace/agent/content-agent/studio?ticketId=60` and check:
- No red errors in browser console
- Top bar renders with "Content Studio" logo and stepper
- Three panels are visible (chat, variants, preview)
- Resize handles are draggable between panels

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/src/pages/ContentStudioPage.jsx
git commit -m "feat(content-studio): rewrite ContentStudioPage as orchestrator with resizable panels"
```

---

## Task 10: Add i18n translations for new keys

**Files:**
- Modify: `apps/dashboard/src/i18n/translations.js`

- [ ] **Step 1: Add translation keys**

Open `apps/dashboard/src/i18n/translations.js`. Find the `studio` section and add/merge the following keys in both `es` and `en` objects:

In the `es` translations object, find the `studio:` section and add:
```javascript
'studio.contentTab': 'Contenido',
'studio.imagesTab': 'Imágenes',
'studio.ampscriptTab': 'AMPscript',
'studio.allVariants': '⊞ Todas las variantes',
'studio.sendToHtmlDev': '→ Enviar a HTML Dev',
'studio.fieldsApproved': '{approved} / {total} campos aprobados',
'studio.noTicket': 'Sin ticket activo',
'studio.selectTicketHint': 'Selecciona un ticket para empezar con Lucia',
'studio.livePreview': 'Preview',
'studio.generatingImage': 'Generando imagen…',
'studio.useAsSlot': 'Usar como {slot}',
'studio.discardImage': 'Descartar',
```

In the `en` translations object, add:
```javascript
'studio.contentTab': 'Content',
'studio.imagesTab': 'Images',
'studio.ampscriptTab': 'AMPscript',
'studio.allVariants': '⊞ All variants',
'studio.sendToHtmlDev': '→ Send to HTML Dev',
'studio.fieldsApproved': '{approved} / {total} fields approved',
'studio.noTicket': 'No active ticket',
'studio.selectTicketHint': 'Select a ticket to start working with Lucia',
'studio.livePreview': 'Preview',
'studio.generatingImage': 'Generating image…',
'studio.useAsSlot': 'Use as {slot}',
'studio.discardImage': 'Discard',
```

- [ ] **Step 2: Commit**

```bash
git add apps/dashboard/src/i18n/translations.js
git commit -m "feat(content-studio): add i18n translations for studio keys"
```

---

## Task 11: End-to-end verification

- [ ] **Step 1: Start the app**

```bash
cd /c/Users/gmunoz02/Desktop/agentOS && npm start
```

- [ ] **Step 2: Verify ticket auto-load**

Navigate to `http://localhost:4000/app/workspace/agent/content-agent/studio?ticketId=60`

Expected:
- Ticket pill shows "#60 — [project name]" in top bar
- Three panels visible: Chat (left), Variants (top-right), Preview (bottom-right)
- Stepper shows "Brief ✓ → Contenido (active) → …"

- [ ] **Step 3: Verify chat sends and BRIEF_UPDATE updates variants panel**

Type "genera el subject para variante en:economy" in chat and press Enter.

Expected:
- Typing indicator (3 dots) appears while Lucia responds
- Brief-card appears in chat with market flag "🇬🇧 EN / ECONOMY"
- VariantFieldsGrid shows "subject" field with generating → approved state

- [ ] **Step 4: Verify live preview updates on approval**

Click "✓ Aprobar" on the brief-card in chat.

Expected:
- Subject field in VariantFieldsGrid shows green border + "✓" badge
- Preview iframe refreshes with the new subject text substituted in the email

- [ ] **Step 5: Verify image generation and slot assignment**

Type "genera una imagen de hero con un avión sobre Dubai" in chat.

Expected:
- Image skeleton ("⟳ Generando imagen…") appears immediately
- After generation: image rendered in chat with "Usar como hero_image" buttons
- Click "Usar como hero_image" → image appears in ImageSlotsManager (Imágenes tab)
- Preview iframe shows the actual image in the hero slot

- [ ] **Step 6: Verify resizable panels**

Drag the vertical handle between Chat and the right panels → chat widens/narrows.
Drag the horizontal handle between Variants and Preview → preview grows/shrinks.

Expected: Both handles respond to drag. Panels respect minSize constraints (chat never < 25%, preview never < 25% height).

- [ ] **Step 7: Verify "Todas las variantes" modal**

Click "⊞ Todas las variantes" in top bar.

Expected:
- Modal opens full-screen
- Tabs show each active market (EN, ES, AR…)
- Clicking each tab shows the email preview for that market with its content substituted

- [ ] **Step 8: Final commit if all checks pass**

```bash
git add -A
git commit -m "feat(content-studio): complete redesign with variants, image slots, live preview, resizable panels"
```

---

## Self-Review Notes

**Spec coverage check:**
- ✅ Resizable panels → Task 1 (install) + Task 9 (PanelGroup/PanelResizeHandle)
- ✅ Unified variants panel (no more AmpscriptSidebar vs ContentBriefSidebar split) → Task 5
- ✅ Live preview updates on BRIEF_UPDATE approval → Task 9 `handleBriefUpdate` sets `ampVarValues`
- ✅ Image-to-slot assignment → Task 8 `detectSlotFromPrompt` + auto-assign + manual buttons
- ✅ ImageSlotsManager with generate/regen/remove → Task 4
- ✅ Progress bar + canHandoff → Task 2 + Task 9 `progressStats`
- ✅ VariantPreviewModal with tabs per market → Task 7
- ✅ Typing indicator → Task 8 (`.studio-typing` div)
- ✅ CSS variables `--studio-*` → Task 1
- ✅ i18n keys → Task 10
- ✅ No backend changes → confirmed, all endpoints reused as-is

**Type consistency:**
- `onBriefUpdate(u)` called with object `{ variant, block, status, value }` — consistent across StudioChatPanel (Task 8) and ContentStudioPage handler (Task 9)
- `onImageAssigned(market, slotName, url, prompt)` — consistent between StudioChatPanel and ContentStudioPage
- `onSlotsChange` is the full `setImageSlots` setter — ImageSlotsManager calls `prev => ({...prev, [marketKey]: ...})` which matches
- `progressStats: { approved, total }` — consistent between StudioTopBar props and VariantPreviewModal props

**Placeholder scan:** None found — all steps contain complete code.
