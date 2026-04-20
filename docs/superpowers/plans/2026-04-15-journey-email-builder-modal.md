# Journey Email Builder Modal — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add click-to-build email creation to Journey Builder canvas — clicking an `EmailSendNode` opens a modal with a brief form + iterative chat that generates an email preview and, on confirm, creates an MC shell and updates the journey node.

**Architecture:** `EmailBuilderModal` is a new standalone component, state-managed locally in `JourneyBuilderPage`. The backend adds three endpoints to server.js that reuse existing helpers (`getEmailBuilderMCClient`, `getEmailBuilderShell`, `buildCampaignEmails`, `duplicateEmail`). The confirm step creates an MC shell and patches the journey DSL directly in the DB.

**Tech Stack:** React 19, ReactFlow (onNodeClick), Anthropic SDK (claude-sonnet-4-6), SSE streaming, MC REST API (asset duplication), existing `buildCampaignEmails` pipeline, existing `duplicateEmail` from campaign-builder.

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `apps/dashboard/src/components/journey/EmailBuilderModal.jsx` | Full modal: Phase 1 form + Phase 2 preview+chat |
| Modify | `apps/dashboard/src/pages/JourneyBuilderPage.jsx` | `emailBuilderNode` state, render modal, handle confirm callback |
| Modify | `apps/dashboard/src/components/journey/JourneyCanvas.jsx` | Accept `onNodeClick` prop, pass to ReactFlow |
| Modify | `apps/dashboard/src/components/journey/nodes/EmailSendNode.jsx` | Add `cursor: pointer` class when no mc_email_id |
| Modify | `apps/dashboard/server.js` | Three new endpoints (build SSE, refine SSE, confirm PATCH) |
| Modify | `apps/dashboard/src/i18n/translations.js` | Add `journeys.emailBuilder.*` strings (ES + EN) |
| Modify | `apps/dashboard/src/index.css` | Add `.ebm` modal styles |

---

## Task 1: Add i18n strings

**Files:**
- Modify: `apps/dashboard/src/i18n/translations.js`

- [ ] **Step 1: Add ES strings inside the `journeys` key (after `nodeTypes` block, before the closing `},`)**

In `translations.js` ES section, find `nodeTypes: {` inside `journeys:` (~line 2056). Add after the `nodeTypes` closing `},`:

```js
emailBuilder: {
  title: 'Crear email',
  phase1Title: 'Configurar email',
  campaignTypeLabel: 'Tipo de campana',
  marketLabel: 'Mercado',
  languageLabel: 'Idioma',
  briefLabel: 'Brief',
  briefPlaceholder: 'Describe el email: objetivo, tono, oferta principal, cualquier restriccion de copy...',
  generateBtn: 'Generar email',
  generating: 'Generando...',
  phase2Title: 'Vista previa',
  chatPlaceholder: 'Pide un ajuste, ej. "el titular mas corto"...',
  refining: 'Ajustando...',
  confirmBtn: 'Usar este email',
  confirming: 'Guardando en MC...',
  cancelConfirm: 'Si cancelas ahora perderaas la vista previa generada. Continuar?',
  close: 'Cerrar',
  errorMCNotConfigured: 'Marketing Cloud no configurado',
  errorBuild: 'Error al generar el email',
  errorConfirm: 'Error al guardar en Marketing Cloud',
},
```

- [ ] **Step 2: Add EN strings — same location in the `en.journeys` block (~line 4087 after `nodeTypes`)**

```js
emailBuilder: {
  title: 'Build email',
  phase1Title: 'Configure email',
  campaignTypeLabel: 'Campaign type',
  marketLabel: 'Market',
  languageLabel: 'Language',
  briefLabel: 'Brief',
  briefPlaceholder: 'Describe the email: goal, tone, main offer, any copy constraints...',
  generateBtn: 'Generate email',
  generating: 'Generating...',
  phase2Title: 'Preview',
  chatPlaceholder: 'Ask for a tweak, e.g. "shorter headline"...',
  refining: 'Refining...',
  confirmBtn: 'Use this email',
  confirming: 'Saving to MC...',
  cancelConfirm: 'If you cancel now the generated preview will be lost. Continue?',
  close: 'Close',
  errorMCNotConfigured: 'Marketing Cloud not configured',
  errorBuild: 'Failed to generate email',
  errorConfirm: 'Failed to save to Marketing Cloud',
},
```

- [ ] **Step 3: Verify — start the dev server and confirm no syntax error**

```bash
cd apps/dashboard && node --input-type=module <<'EOF'
import { translations } from './src/i18n/translations.js';
console.log(translations.es.journeys.emailBuilder.title);
console.log(translations.en.journeys.emailBuilder.title);
EOF
```
Expected output:
```
Crear email
Build email
```

- [ ] **Step 4: Commit**

```bash
git add apps/dashboard/src/i18n/translations.js
git commit -m "feat(journeys): add emailBuilder i18n strings (ES + EN)"
```

---

## Task 2: Add CSS for EmailBuilderModal

**Files:**
- Modify: `apps/dashboard/src/index.css`

- [ ] **Step 1: Append `.ebm` styles at the end of `index.css`, before the final closing line**

Add after the last `.jm` block (search for `.jm__tpl--active` to find the end of journey modal CSS):

```css
/* ─── Email Builder Modal (.ebm) ──────────────────────────────────── */
.ebm {
  position: fixed;
  inset: 0;
  z-index: 600;
  display: flex;
  align-items: center;
  justify-content: center;
}

.ebm__scrim {
  position: absolute;
  inset: 0;
  background: rgba(0,0,0,0.6);
  border: none;
  cursor: pointer;
}

.ebm__panel {
  position: relative;
  z-index: 1;
  width: min(80vw, 1100px);
  height: min(85vh, 800px);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.ebm__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.ebm__title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.ebm__close {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 4px;
  border-radius: 6px;
  display: flex;
  align-items: center;
}
.ebm__close:hover { color: var(--text); background: var(--surface-hover); }

/* Phase 1 — brief form */
.ebm__phase1 {
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  flex: 1;
  overflow-y: auto;
}

.ebm__row {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 12px;
}

.ebm__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.ebm__label {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.ebm__select,
.ebm__textarea {
  background: var(--surface-raised);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text);
  font-size: 13px;
  padding: 8px 12px;
  font-family: inherit;
}
.ebm__select:focus,
.ebm__textarea:focus {
  outline: none;
  border-color: var(--accent);
}

.ebm__textarea {
  resize: vertical;
  min-height: 100px;
}

.ebm__footer-phase1 {
  padding: 16px 24px;
  border-top: 1px solid var(--border);
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  flex-shrink: 0;
}

/* Phase 2 — preview + chat */
.ebm__phase2 {
  display: flex;
  flex: 1;
  min-height: 0;
}

.ebm__preview-pane {
  flex: 1;
  border-right: 1px solid var(--border);
  overflow: hidden;
}

.ebm__preview-pane iframe {
  width: 100%;
  height: 100%;
  border: none;
  display: block;
}

.ebm__preview-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--text-muted);
  font-size: 13px;
  gap: 8px;
}

.ebm__chat-pane {
  width: 300px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
}

.ebm__chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ebm__chat-bubble {
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 12px;
  line-height: 1.5;
  max-width: 260px;
}
.ebm__chat-bubble--user {
  background: var(--accent);
  color: #fff;
  align-self: flex-end;
}
.ebm__chat-bubble--agent {
  background: var(--surface-raised);
  color: var(--text);
  align-self: flex-start;
}

.ebm__chat-input-row {
  display: flex;
  gap: 8px;
  padding: 12px;
  border-top: 1px solid var(--border);
}

.ebm__chat-input {
  flex: 1;
  background: var(--surface-raised);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text);
  font-size: 12px;
  padding: 7px 10px;
  font-family: inherit;
}
.ebm__chat-input:focus { outline: none; border-color: var(--accent); }

.ebm__footer-phase2 {
  padding: 12px 16px;
  border-top: 1px solid var(--border);
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  flex-shrink: 0;
}

.ebm__btn {
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid var(--border);
  font-family: inherit;
  display: flex;
  align-items: center;
  gap: 6px;
}
.ebm__btn--ghost {
  background: transparent;
  color: var(--text-muted);
}
.ebm__btn--ghost:hover { color: var(--text); background: var(--surface-hover); }
.ebm__btn--primary {
  background: var(--accent);
  color: #fff;
  border-color: var(--accent);
}
.ebm__btn--primary:hover { opacity: 0.9; }
.ebm__btn--primary:disabled { opacity: 0.5; cursor: not-allowed; }
.ebm__btn--send {
  background: var(--accent);
  color: #fff;
  border-color: var(--accent);
  padding: 7px 10px;
}
.ebm__btn--send:disabled { opacity: 0.5; cursor: not-allowed; }

.ebm__error {
  color: var(--error, #e53e3e);
  font-size: 12px;
  padding: 8px 12px;
  background: rgba(229,62,62,0.1);
  border-radius: 6px;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/dashboard/src/index.css
git commit -m "feat(journeys): add .ebm modal CSS for email builder"
```

---

## Task 3: Backend — PATCH /api/journeys/:id/activities/:actId

**Files:**
- Modify: `apps/dashboard/server.js`

This endpoint patches a single activity in the journey DSL and saves to DB. Called by the frontend's "Use this email" confirm step.

- [ ] **Step 1: Add endpoint in server.js right after the `DELETE /api/journeys/:id` handler (~line 8545)**

Find this line in server.js:
```js
// Human-triggered deploy. Never called by the agent — only by the toolbar button.
app.post('/api/journeys/:id/deploy', requireAuth, async (req, res) => {
```

Insert BEFORE it:

```js
// Patch a single DSL activity — used by email builder modal to write back mc_email_id
app.patch('/api/journeys/:id/activities/:actId', requireAuth, async (req, res) => {
    const { id: journeyId, actId } = req.params;
    const { mc_email_id, email_shell_name } = req.body || {};
    if (!mc_email_id || !email_shell_name) return res.status(400).json({ error: 'mc_email_id and email_shell_name required' });

    const { rows } = await pool.query(
        `SELECT dsl_json FROM journeys WHERE id = $1 AND user_id = $2`,
        [journeyId, req.session.userId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'not found' });

    const dsl = rows[0].dsl_json;
    const actIdx = dsl.activities.findIndex((a) => a.id === actId);
    if (actIdx === -1) return res.status(404).json({ error: `activity ${actId} not found` });
    if (dsl.activities[actIdx].type !== 'email_send') return res.status(400).json({ error: 'activity is not email_send' });

    const updatedActivities = [...dsl.activities];
    updatedActivities[actIdx] = { ...updatedActivities[actIdx], mc_email_id, email_shell_name };
    const updatedDsl = { ...dsl, activities: updatedActivities };

    await pool.query(
        `UPDATE journeys SET dsl_json = $1 WHERE id = $2 AND user_id = $3`,
        [JSON.stringify(updatedDsl), journeyId, req.session.userId]
    );
    res.json({ ok: true, dsl: updatedDsl });
});
```

- [ ] **Step 2: Test endpoint manually**

Start server (`npm start`) and run:

```bash
# Substitute a real journeyId, actId, and valid session cookie
curl -s -X PATCH http://localhost:3002/api/journeys/TEST_ID/activities/TEST_ACT \
  -H "Content-Type: application/json" \
  -H "Cookie: connect.sid=YOUR_SESSION" \
  -d '{"mc_email_id": 99999, "email_shell_name": "Test_Shell"}' | jq .
```
Expected: `{ "ok": true, "dsl": { ... } }` with updated activity.

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/server.js
git commit -m "feat(journeys): add PATCH /api/journeys/:id/activities/:actId endpoint"
```

---

## Task 4: Backend — POST /api/journeys/:id/activities/:actId/email/build (SSE)

**Files:**
- Modify: `apps/dashboard/server.js`

This endpoint generates an email HTML preview via the existing `buildCampaignEmails` pipeline. Streams progress events then returns `{ type: 'result', html, emailName }`. It does NOT create an MC shell (that happens at confirm time in Task 5).

- [ ] **Step 1: Add endpoint right after the PATCH /activities/:actId endpoint from Task 3**

```js
// Email builder — generate HTML preview for a journey email_send activity
app.post('/api/journeys/:id/activities/:actId/email/build', requireAuth, async (req, res) => {
    const { id: journeyId, actId } = req.params;
    const { language = 'en', brief = '' } = req.body || {};

    // Verify ownership + load activity
    const { rows } = await pool.query(
        `SELECT dsl_json FROM journeys WHERE id = $1 AND user_id = $2`,
        [journeyId, req.session.userId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'not found' });
    const dsl = rows[0].dsl_json;
    const activity = (dsl.activities || []).find((a) => a.id === actId);
    if (!activity || activity.type !== 'email_send') return res.status(400).json({ error: 'activity not found or not email_send' });

    // Resolve assetId from CAMPAIGN_TYPES
    const { CAMPAIGN_TYPES } = await import('../../packages/core/campaign-builder/index.js');
    const typeDef = CAMPAIGN_TYPES[activity.campaign_type];
    if (!typeDef) return res.status(400).json({ error: `Unknown campaign_type: ${activity.campaign_type}` });
    const assetId = typeDef.templates.noCugoCode;

    // SSE setup
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const mc = await getEmailBuilderMCClient();
    if (!mc) {
        sseSend(res, { type: 'error', message: 'Marketing Cloud not configured' });
        return res.end();
    }

    const templateShell = getEmailBuilderShell();

    try {
        const { buildCampaignEmails } = await import('../../packages/core/email-builder/index.js');
        const result = await buildCampaignEmails({
            assetId,
            mcClient: mc,
            templateShell,
            campaignHint: brief || activity.email_shell_name,
            options: {
                language,
                onProgress: (phase, detail) => sseSend(res, { type: 'status', phase, message: String(detail || '') }),
            },
        });

        // Pick the first (and usually only) variant
        const variantHtml = Object.values(result.variants || {})[0] || '';
        sseSend(res, { type: 'result', html: variantHtml, emailName: result.emailName || activity.email_shell_name });
    } catch (e) {
        sseSend(res, { type: 'error', message: e.message });
    }

    res.end();
});
```

- [ ] **Step 2: Commit**

```bash
git add apps/dashboard/server.js
git commit -m "feat(journeys): add POST /api/journeys/:id/activities/:actId/email/build SSE endpoint"
```

---

## Task 5: Backend — POST /api/journeys/:id/activities/:actId/email/refine (SSE)

**Files:**
- Modify: `apps/dashboard/server.js`

Refine takes `{ message, currentHtml }`, asks Claude to apply the modification, and streams back the updated HTML. No MC calls. Single Claude API call, streams the response.

- [ ] **Step 1: Add endpoint right after the build endpoint**

```js
// Email builder — iterative refinement via Claude
app.post('/api/journeys/:id/activities/:actId/email/refine', requireAuth, async (req, res) => {
    const { id: journeyId, actId } = req.params;
    const { message, currentHtml } = req.body || {};
    if (!message || !currentHtml) return res.status(400).json({ error: 'message and currentHtml required' });

    // Verify ownership
    const { rows } = await pool.query(
        `SELECT id FROM journeys WHERE id = $1 AND user_id = $2`,
        [journeyId, req.session.userId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'not found' });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    sseSend(res, { type: 'status', message: 'Applying changes...' });

    try {
        const msg = await anthropic.messages.create({
            model: 'claude-sonnet-4-6',
            max_tokens: 8192,
            messages: [{
                role: 'user',
                content: `You are an email HTML editor. Apply the requested modification to the email HTML below.\n\nModification: ${message}\n\nReturn ONLY the complete modified HTML. No explanation, no markdown, no code fences — just the raw HTML.\n\n${currentHtml}`,
            }],
        });

        const html = msg.content[0]?.text || currentHtml;
        sseSend(res, { type: 'result', html });
    } catch (e) {
        sseSend(res, { type: 'error', message: e.message });
    }

    res.end();
});
```

- [ ] **Step 2: Add MC shell creation endpoint (confirm step)**

Right after the refine endpoint, add:

```js
// Email builder — confirm: create MC shell and return mc_email_id
app.post('/api/journeys/:id/activities/:actId/email/confirm', requireAuth, async (req, res) => {
    const { id: journeyId, actId } = req.params;
    const { campaign_type, emailName } = req.body || {};
    if (!campaign_type) return res.status(400).json({ error: 'campaign_type required' });

    const { rows } = await pool.query(
        `SELECT dsl_json FROM journeys WHERE id = $1 AND user_id = $2`,
        [journeyId, req.session.userId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'not found' });

    const { CAMPAIGN_TYPES, duplicateEmail } = await import('../../packages/core/campaign-builder/index.js');
    const typeDef = CAMPAIGN_TYPES[campaign_type];
    if (!typeDef) return res.status(400).json({ error: `Unknown campaign_type: ${campaign_type}` });

    const mc = await getEmailBuilderMCClient();
    if (!mc) return res.status(503).json({ error: 'Marketing Cloud not configured' });

    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const stamp = `${pad(now.getDate())}${pad(now.getMonth()+1)}${String(now.getFullYear()).slice(2)}_${pad(now.getHours())}${pad(now.getMinutes())}`;
    const shellName = `${emailName || actId}_${stamp}`;

    const { assetId: mc_email_id } = await duplicateEmail(mc, {
        sourceAssetId: typeDef.templates.noCugoCode,
        newName: shellName,
        attributes: { attr3: shellName, attr4: 'xx' },
    });

    res.json({ ok: true, mc_email_id, email_shell_name: shellName });
});
```

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/server.js
git commit -m "feat(journeys): add email/refine and email/confirm endpoints for journey builder"
```

---

## Task 6: EmailBuilderModal component

**Files:**
- Create: `apps/dashboard/src/components/journey/EmailBuilderModal.jsx`

- [ ] **Step 1: Create the file**

```jsx
import { useEffect, useRef, useState } from 'react';
import { X, Mail, Send } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext.jsx';

const API = import.meta.env.VITE_API_URL || '/api';

const MARKETS = ['UAE', 'UK', 'KSA', 'India', 'Australia', 'Germany', 'France', 'USA'];
const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'ar', label: 'Arabic' },
  { code: 'de', label: 'German' },
  { code: 'fr', label: 'French' },
];

// Parse SSE lines from a ReadableStream
async function* readSSE(stream) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop();
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try { yield JSON.parse(line.slice(6)); } catch {}
      }
    }
  }
}

export default function EmailBuilderModal({ open, journeyId, activity, onClose, onConfirmed }) {
  const { t } = useLanguage();
  const [phase, setPhase] = useState(1);
  const [market, setMarket] = useState('UAE');
  const [language, setLanguage] = useState('en');
  const [brief, setBrief] = useState('');
  const [generating, setGenerating] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [html, setHtml] = useState('');
  const [emailName, setEmailName] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const [refining, setRefining] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState(null);
  const iframeRef = useRef(null);
  const chatEndRef = useRef(null);

  useEffect(() => {
    if (open) {
      setPhase(1);
      setBrief('');
      setHtml('');
      setEmailName('');
      setChatMessages([]);
      setError(null);
      setStatusMsg('');
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (phase === 2 && html) {
        if (window.confirm(t('journeys.emailBuilder.cancelConfirm'))) onClose();
      } else {
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, phase, html, onClose]);

  useEffect(() => {
    if (html && iframeRef.current) {
      const doc = iframeRef.current.contentDocument || iframeRef.current.contentWindow?.document;
      if (doc) { doc.open(); doc.write(html); doc.close(); }
    }
  }, [html]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatMessages]);

  const handleGenerate = async (e) => {
    e.preventDefault();
    if (!brief.trim()) return;
    setGenerating(true);
    setError(null);
    setStatusMsg(t('journeys.emailBuilder.generating'));
    setPhase(2);

    try {
      const resp = await fetch(`${API}/journeys/${journeyId}/activities/${activity.id}/email/build`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language, market, brief }),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

      for await (const event of readSSE(resp.body)) {
        if (event.type === 'status') setStatusMsg(event.message || event.phase);
        if (event.type === 'result') {
          setHtml(event.html);
          setEmailName(event.emailName || activity.email_shell_name);
          setStatusMsg('');
        }
        if (event.type === 'error') throw new Error(event.message);
      }
    } catch (err) {
      setError(t('journeys.emailBuilder.errorBuild') + ': ' + err.message);
      setPhase(1);
    } finally {
      setGenerating(false);
    }
  };

  const handleRefine = async () => {
    const msg = chatInput.trim();
    if (!msg || refining) return;
    setChatInput('');
    setChatMessages((prev) => [...prev, { role: 'user', text: msg }]);
    setRefining(true);

    try {
      const resp = await fetch(`${API}/journeys/${journeyId}/activities/${activity.id}/email/refine`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, currentHtml: html }),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

      for await (const event of readSSE(resp.body)) {
        if (event.type === 'result') {
          setHtml(event.html);
          setChatMessages((prev) => [...prev, { role: 'agent', text: 'Done — preview updated.' }]);
        }
        if (event.type === 'error') throw new Error(event.message);
      }
    } catch (err) {
      setChatMessages((prev) => [...prev, { role: 'agent', text: `Error: ${err.message}` }]);
    } finally {
      setRefining(false);
    }
  };

  const handleConfirm = async () => {
    setConfirming(true);
    setError(null);
    try {
      // Step 1: create MC shell
      const confirmResp = await fetch(`${API}/journeys/${journeyId}/activities/${activity.id}/email/confirm`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaign_type: activity.campaign_type, emailName }),
      });
      if (!confirmResp.ok) throw new Error(`HTTP ${confirmResp.status}`);
      const { mc_email_id, email_shell_name } = await confirmResp.json();

      // Step 2: patch activity in DSL
      const patchResp = await fetch(`${API}/journeys/${journeyId}/activities/${activity.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mc_email_id, email_shell_name }),
      });
      if (!patchResp.ok) throw new Error(`HTTP ${patchResp.status}`);
      const { dsl } = await patchResp.json();

      onConfirmed(dsl);
    } catch (err) {
      setError(t('journeys.emailBuilder.errorConfirm') + ': ' + err.message);
    } finally {
      setConfirming(false);
    }
  };

  if (!open || !activity) return null;

  return (
    <div className="ebm" role="dialog" aria-modal="true" aria-labelledby="ebm-title">
      <button className="ebm__scrim" onClick={() => {
        if (phase === 2 && html) {
          if (window.confirm(t('journeys.emailBuilder.cancelConfirm'))) onClose();
        } else {
          onClose();
        }
      }} aria-label={t('journeys.emailBuilder.close')} />

      <div className="ebm__panel">
        <div className="ebm__header">
          <h2 id="ebm-title" className="ebm__title">
            <Mail size={15} strokeWidth={2} />
            {t('journeys.emailBuilder.title')} — {activity.email_shell_name}
          </h2>
          <button className="ebm__close" onClick={() => {
            if (phase === 2 && html) {
              if (window.confirm(t('journeys.emailBuilder.cancelConfirm'))) onClose();
            } else {
              onClose();
            }
          }} aria-label={t('journeys.emailBuilder.close')}>
            <X size={18} strokeWidth={2} />
          </button>
        </div>

        {phase === 1 && (
          <form onSubmit={handleGenerate} style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
            <div className="ebm__phase1">
              <div className="ebm__row">
                <label className="ebm__field">
                  <span className="ebm__label">{t('journeys.emailBuilder.marketLabel')}</span>
                  <select className="ebm__select" value={market} onChange={(e) => setMarket(e.target.value)}>
                    {MARKETS.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </label>
                <label className="ebm__field">
                  <span className="ebm__label">{t('journeys.emailBuilder.languageLabel')}</span>
                  <select className="ebm__select" value={language} onChange={(e) => setLanguage(e.target.value)}>
                    {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
                  </select>
                </label>
                <label className="ebm__field">
                  <span className="ebm__label">{t('journeys.emailBuilder.campaignTypeLabel')}</span>
                  <select className="ebm__select" disabled value={activity.campaign_type}>
                    <option value={activity.campaign_type}>{activity.campaign_type}</option>
                  </select>
                </label>
              </div>
              <label className="ebm__field">
                <span className="ebm__label">{t('journeys.emailBuilder.briefLabel')}</span>
                <textarea
                  className="ebm__textarea"
                  value={brief}
                  onChange={(e) => setBrief(e.target.value)}
                  placeholder={t('journeys.emailBuilder.briefPlaceholder')}
                  required
                />
              </label>
              {error && <div className="ebm__error">{error}</div>}
            </div>
            <div className="ebm__footer-phase1">
              <button type="button" className="ebm__btn ebm__btn--ghost" onClick={onClose}>
                {t('journeys.emailBuilder.close')}
              </button>
              <button type="submit" className="ebm__btn ebm__btn--primary" disabled={!brief.trim()}>
                {t('journeys.emailBuilder.generateBtn')}
              </button>
            </div>
          </form>
        )}

        {phase === 2 && (
          <>
            <div className="ebm__phase2">
              <div className="ebm__preview-pane">
                {(generating || !html) ? (
                  <div className="ebm__preview-loading">
                    <span>{statusMsg || t('journeys.emailBuilder.generating')}</span>
                  </div>
                ) : (
                  <iframe
                    ref={iframeRef}
                    sandbox="allow-same-origin"
                    title="Email preview"
                  />
                )}
              </div>
              <div className="ebm__chat-pane">
                <div className="ebm__chat-messages">
                  {chatMessages.map((m, i) => (
                    <div key={i} className={`ebm__chat-bubble ebm__chat-bubble--${m.role}`}>
                      {m.text}
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>
                <div className="ebm__chat-input-row">
                  <input
                    className="ebm__chat-input"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder={t('journeys.emailBuilder.chatPlaceholder')}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleRefine(); } }}
                    disabled={refining || !html}
                  />
                  <button
                    className="ebm__btn ebm__btn--send"
                    onClick={handleRefine}
                    disabled={refining || !chatInput.trim() || !html}
                    aria-label="Send"
                  >
                    <Send size={13} strokeWidth={2} />
                  </button>
                </div>
              </div>
            </div>
            <div className="ebm__footer-phase2">
              {error && <div className="ebm__error" style={{ flex: 1 }}>{error}</div>}
              <button className="ebm__btn ebm__btn--ghost" onClick={onClose} disabled={confirming}>
                {t('journeys.emailBuilder.close')}
              </button>
              <button
                className="ebm__btn ebm__btn--primary"
                onClick={handleConfirm}
                disabled={confirming || !html || generating}
              >
                {confirming ? t('journeys.emailBuilder.confirming') : t('journeys.emailBuilder.confirmBtn')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/dashboard/src/components/journey/EmailBuilderModal.jsx
git commit -m "feat(journeys): add EmailBuilderModal component (Phase 1 + Phase 2)"
```

---

## Task 7: Wire JourneyCanvas onNodeClick

**Files:**
- Modify: `apps/dashboard/src/components/journey/JourneyCanvas.jsx`
- Modify: `apps/dashboard/src/components/journey/nodes/EmailSendNode.jsx`

- [ ] **Step 1: Add `onNodeClick` and `highlightActivityId` props to JourneyCanvas**

In `JourneyCanvas.jsx`, change the component signature:

Old:
```jsx
export default function JourneyCanvas({ dsl, toolStatus }) {
```
New:
```jsx
export default function JourneyCanvas({ dsl, toolStatus, onNodeClick, highlightActivityId }) {
```

In the `decoratedNodes` map, add `highlightActivityId` to the `isNewlyAdded` check:
```jsx
const decoratedNodes = nodes.map((n) => ({
  ...n,
  data: {
    ...n.data,
    isNewlyAdded: n.id === lastAddedId || n.id === highlightActivityId,
    toolRunning: toolStatus?.status === 'running',
  },
}));
```

Inside `<ReactFlow ... >`, add `onNodeClick`:
```jsx
onNodeClick={onNodeClick ? (_, node) => onNodeClick(node) : undefined}
```

- [ ] **Step 2: Add click cursor to EmailSendNode when no mc_email_id**

In `EmailSendNode.jsx`, change the outer div className:
```jsx
<div className={`journey-node journey-node--send ${data.isNewlyAdded ? 'journey-node--newly-added' : ''} ${!a.mc_email_id ? 'journey-node--clickable' : ''}`}>
```

Add to `index.css` (inside the journey node section):
```css
.journey-node--clickable { cursor: pointer; }
.journey-node--clickable:hover { border-color: var(--accent); }
```

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/src/components/journey/JourneyCanvas.jsx \
        apps/dashboard/src/components/journey/nodes/EmailSendNode.jsx \
        apps/dashboard/src/index.css
git commit -m "feat(journeys): add onNodeClick prop to JourneyCanvas + clickable EmailSendNode style"
```

---

## Task 8: Wire JourneyBuilderPage — state + render modal

**Files:**
- Modify: `apps/dashboard/src/pages/JourneyBuilderPage.jsx`

- [ ] **Step 1: Add import and state**

Add import at top:
```jsx
import EmailBuilderModal from '../components/journey/EmailBuilderModal.jsx';
```

Add state after existing state declarations:
```jsx
const [emailBuilderActivity, setEmailBuilderActivity] = useState(null);
const [highlightActivityId, setHighlightActivityId] = useState(null);
```

- [ ] **Step 2: Add `handleNodeClick` handler**

After the `useEffect` for fetching journey, add:
```jsx
const handleNodeClick = (node) => {
  if (node.data?.activity?.type === 'email_send' && !node.data.activity.mc_email_id) {
    setEmailBuilderActivity(node.data.activity);
  }
};
```

- [ ] **Step 3: Pass `onNodeClick` to JourneyCanvas and render modal**

Change:
```jsx
<JourneyCanvas dsl={dsl} toolStatus={toolStatus} />
```
To:
```jsx
<JourneyCanvas
  dsl={dsl}
  toolStatus={toolStatus}
  onNodeClick={handleNodeClick}
  highlightActivityId={highlightActivityId}
/>
```

Add modal right before the closing `</div>` of the page:
```jsx
<EmailBuilderModal
  open={!!emailBuilderActivity}
  journeyId={id}
  activity={emailBuilderActivity}
  onClose={() => setEmailBuilderActivity(null)}
  onConfirmed={(updatedDsl) => {
    setDsl(updatedDsl);
    setEmailBuilderActivity(null);
    // Trigger highlight on the confirmed activity (clears after 900ms)
    if (emailBuilderActivity) {
      setHighlightActivityId(emailBuilderActivity.id);
      setTimeout(() => setHighlightActivityId(null), 900);
    }
  }}
/>
```

- [ ] **Step 4: Verify full flow in browser**

1. `npm start`
2. Open a journey that has an `email_send` node without `mc_email_id`
3. Click the node — modal opens with the activity name in header
4. Fill market, language, and brief → click "Generate email"
5. Modal transitions to Phase 2 — status messages stream, then iframe preview loads
6. Type a refinement in chat → preview updates
7. Click "Use this email" → modal closes, canvas node shows highlight animation

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/src/pages/JourneyBuilderPage.jsx
git commit -m "feat(journeys): wire EmailBuilderModal into JourneyBuilderPage"
```

---

## Verification Checklist

- [ ] Clicking `EmailSendNode` (no mc_email_id) opens modal
- [ ] Brief form validates — "Generate email" disabled until brief has text
- [ ] SSE status messages visible while generating
- [ ] Email preview renders in iframe after generation completes
- [ ] Chat refinement sends message → preview updates
- [ ] "Use this email" creates MC shell + patches DSL + closes modal
- [ ] Node in canvas highlights (animate-fade-in) after confirm
- [ ] Clicking node with existing `mc_email_id` does NOT open modal
- [ ] Escape key works: Phase 1 closes immediately, Phase 2 shows confirm dialog
- [ ] Journey chat (JourneyBuilderChat) unaffected — still works normally
- [ ] Journey validate/deploy still works after email builder modal assigns mc_email_id
- [ ] No console errors in browser
