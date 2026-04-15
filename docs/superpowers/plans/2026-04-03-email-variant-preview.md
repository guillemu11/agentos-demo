# Email Studio — Variant Preview & Test Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Conectar Email Studio con el contenido aprobado del Content Agent para previsualizar la template con cada variante (market:tier) y enviar emails de prueba.

**Architecture:** Las variantes del Content Agent se persisten en `project_agent_sessions.deliverables` durante el handoff. El Email Studio las recupera via nuevo endpoint y sustituye las variables SFMC (`%%=v(@...)=%%`) en cliente antes de renderizar el iframe. Un nuevo modal gestiona preview por variante y envío de tests.

**Tech Stack:** React 19, Express 5, PostgreSQL, nodemailer (nuevo), CSS custom properties, lucide-react

---

## File Map

| Acción | Archivo |
|---|---|
| CREAR | `apps/dashboard/src/utils/emailVariants.js` |
| CREAR | `apps/dashboard/src/components/VariantPreviewModal.jsx` |
| MODIFICAR | `apps/dashboard/src/components/EmailBuilderPreview.jsx` |
| MODIFICAR | `apps/dashboard/src/components/HandoffModal.jsx` |
| MODIFICAR | `apps/dashboard/src/pages/EmailStudioPage.jsx` |
| MODIFICAR | `apps/dashboard/src/i18n/translations.js` |
| MODIFICAR | `apps/dashboard/server.js` |
| MODIFICAR | `apps/dashboard/package.json` (añadir nodemailer) |

---

## Task 1: Utility emailVariants.js

**Files:**
- Create: `apps/dashboard/src/utils/emailVariants.js`

**Fixed mapping** de campos Content Studio → nombres de variables SFMC:

```
heroHeadline  →  @main_header
preheader     →  @preheader
cta           →  @main_cta
bodyCopy      →  @body_copy
```

- [ ] **Step 1: Crear el archivo**

```js
// apps/dashboard/src/utils/emailVariants.js

/**
 * Sustituye variables SFMC (%%=v(@var)=%%) con valores reales de una variante.
 * @param {string} html  - HTML de la template con variables SFMC
 * @param {object} variant - objeto { heroHeadline, preheader, cta, bodyCopy } con shape { status, value }
 * @returns {string} HTML con variables sustituidas
 */
export function substituteVariants(html, variant) {
  if (!html || !variant) return html || '';
  return html
    .replace(/%%=v\(@main_header\)=%%/g,  variant.heroHeadline?.value ?? '[[main_header]]')
    .replace(/%%=v\(@preheader\)=%%/g,    variant.preheader?.value    ?? '[[preheader]]')
    .replace(/%%=v\(@main_cta\)=%%/g,     variant.cta?.value          ?? '[[main_cta]]')
    .replace(/%%=v\(@body_copy\)=%%/g,    variant.bodyCopy?.value     ?? '[[body_copy]]');
}

/**
 * Cuenta cuántos campos de una variante están aprobados.
 */
export function countApproved(variant) {
  if (!variant) return 0;
  return Object.values(variant).filter(f => f?.status === 'approved').length;
}

/** Total de campos por variante */
export const FIELDS_PER_VARIANT = 5;
```

- [ ] **Step 2: Verificar manualmente**

Abrir DevTools console en el browser y ejecutar:
```js
import('/src/utils/emailVariants.js').then(m => {
  const html = '<h1>%%=v(@main_header)=%%</h1><a>%%=v(@main_cta)=%%</a>';
  const variant = { heroHeadline: { value: 'Vuela a Dubai' }, cta: { value: 'Reservar' } };
  console.log(m.substituteVariants(html, variant));
  // Expected: <h1>Vuela a Dubai</h1><a>Reservar</a>
});
```

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/src/utils/emailVariants.js
git commit -m "feat: add emailVariants utility for SFMC variable substitution"
```

---

## Task 2: Añadir traducciones i18n

**Files:**
- Modify: `apps/dashboard/src/i18n/translations.js`

Localizar la sección `emailBuilder:` en ambos idiomas (ES en línea ~1361, EN en línea ~2785) y añadir las claves nuevas al final del objeto.

- [ ] **Step 1: Añadir claves en español** (después de la última clave existente en el bloque `emailBuilder` español)

```js
// Añadir al objeto emailBuilder en ES (después de la última clave actual):
variantSelector: 'Variante',
variantWaiting: 'Esperando contenido…',
variantContentPending: 'Content Agent en progreso',
variantReady: 'bloques aprobados',
saveTemplate: 'Guardar template',
previewTest: 'Preview & Test',
variantPreviewing: 'Previsualizando',
variantInQueue: 'En cola de envío',
sendTestVariants: 'Enviar {n} test(s)',
testEmailPlaceholder: 'test@email.com',
allVariants: 'Todas las variantes',
noVariantsReady: 'Sin variantes disponibles',
```

- [ ] **Step 2: Añadir claves en inglés** (en el bloque `emailBuilder` EN):

```js
variantSelector: 'Variant',
variantWaiting: 'Waiting for content…',
variantContentPending: 'Content Agent in progress',
variantReady: 'blocks approved',
saveTemplate: 'Save template',
previewTest: 'Preview & Test',
variantPreviewing: 'Previewing',
variantInQueue: 'In send queue',
sendTestVariants: 'Send {n} test(s)',
testEmailPlaceholder: 'test@email.com',
allVariants: 'All variants',
noVariantsReady: 'No variants available',
```

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/src/i18n/translations.js
git commit -m "feat: add i18n keys for email variant preview"
```

---

## Task 3: Persistir variantes en el handoff

**Files:**
- Modify: `apps/dashboard/src/components/HandoffModal.jsx`
- Modify: `apps/dashboard/server.js` (aceptar y guardar variants en deliverables)

`ContentStudioPage` ya pasa `session={pipeline.handoffSession}` al HandoffModal, y ese objeto ya contiene `variants` (se añade en `handleContentHandoff` línea ~85). Solo hay que leerlo y enviarlo.

- [ ] **Step 1: Modificar HandoffModal para enviar session.variants en el body**

En `apps/dashboard/src/components/HandoffModal.jsx`, en la función `executeHandoff`, añadir después de la línea `if (requiresGateApproval) body.gate_approved = true;` (línea ~34):

```js
// session.variants viene de ContentStudioPage → handleContentHandoff
if (session?.variants && Object.keys(session.variants).length > 0) {
  body.variants = session.variants;
}
```
```

- [ ] **Step 3: Modificar el endpoint POST /api/projects/:id/pipeline/handoff en server.js**

Localizar la línea donde se hace `UPDATE project_agent_sessions SET status = 'completed', summary = $1, deliverables = $2` (línea ~5593).

El `handoffData` se construye antes de esa línea. Añadir las variantes al objeto antes del UPDATE:

```js
// Justo antes del UPDATE (después de que handoffData esté definido, ~línea 5576):
if (req.body.variants && typeof req.body.variants === 'object') {
    handoffData.content_variants = req.body.variants;
}
```

El UPDATE ya usa `JSON.stringify(handoffData)` así que las variantes quedan automáticamente en `deliverables`.

- [ ] **Step 4: Verificar**

Hacer un handoff desde ContentStudio con variantes en estado `approved`. En Adminer (http://localhost:8080), ejecutar:
```sql
SELECT deliverables->>'content_variants' 
FROM project_agent_sessions 
WHERE agent_id = 'lucia' AND status = 'completed' 
ORDER BY completed_at DESC LIMIT 1;
```
Debe mostrar el JSON con las variantes.

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/src/components/HandoffModal.jsx \
        apps/dashboard/server.js
git commit -m "feat: persist content variants in pipeline session deliverables on handoff"
```

---

## Task 4: Nuevo endpoint GET /api/projects/:id/content-variants

**Files:**
- Modify: `apps/dashboard/server.js`

- [ ] **Step 1: Añadir endpoint en server.js**

Localizar la sección de endpoints de emails/pipeline (alrededor de línea 485-540, cerca de `GET /api/projects/:id/emails`). Añadir el nuevo endpoint inmediatamente después:

```js
// GET /api/projects/:id/content-variants — Get approved content variants from Content Agent session
app.get('/api/projects/:id/content-variants', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(
            `SELECT deliverables
             FROM project_agent_sessions
             WHERE project_id = $1
               AND agent_id = 'lucia'
               AND status = 'completed'
             ORDER BY completed_at DESC
             LIMIT 1`,
            [id]
        );
        if (result.rows.length === 0) {
            return res.json({ ready: false, variants: {}, approvedCount: 0, totalCount: 0 });
        }
        const deliverables = result.rows[0].deliverables || {};
        const variants = deliverables.content_variants || {};
        const variantKeys = Object.keys(variants);
        if (variantKeys.length === 0) {
            return res.json({ ready: false, variants: {}, approvedCount: 0, totalCount: 0 });
        }
        const FIELDS = ['subject', 'preheader', 'heroHeadline', 'bodyCopy', 'cta'];
        let approvedCount = 0;
        let totalCount = 0;
        for (const key of variantKeys) {
            for (const field of FIELDS) {
                totalCount++;
                if (variants[key]?.[field]?.status === 'approved') approvedCount++;
            }
        }
        const ready = approvedCount > 0;
        res.json({ ready, variants, approvedCount, totalCount });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
```

- [ ] **Step 2: Verificar**

```bash
curl -s http://localhost:3001/api/projects/1/content-variants \
  -H "Cookie: <session-cookie>"
# Expected: { ready: true, variants: {...}, approvedCount: 10, totalCount: 10 }
# o { ready: false, variants: {}, approvedCount: 0, totalCount: 0 }
```

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/server.js
git commit -m "feat: add GET /api/projects/:id/content-variants endpoint"
```

---

## Task 5: Endpoint POST /api/emails/send-test + nodemailer

**Files:**
- Modify: `apps/dashboard/package.json`
- Modify: `apps/dashboard/server.js`

El endpoint `/api/emails/send-test` ya es llamado desde `EmailBuilderPreview` pero no existe en server.js.

- [ ] **Step 1: Instalar nodemailer**

```bash
cd apps/dashboard && npm install nodemailer
```

- [ ] **Step 2: Añadir en server.js el require de nodemailer**

Al inicio de server.js, junto a los otros requires:

```js
const nodemailer = require('nodemailer');
```

- [ ] **Step 3: Añadir el endpoint POST /api/emails/send-test**

Añadir cerca de los otros endpoints de emails (alrededor de línea 540):

```js
// POST /api/emails/send-test — Send HTML email to a test address
app.post('/api/emails/send-test', requireAuth, async (req, res) => {
    try {
        const { to, html, subject = 'Test Email Preview', variantLabel } = req.body;
        if (!to || !html) return res.status(400).json({ error: 'Missing to or html' });

        const smtpHost = process.env.SMTP_HOST;
        if (!smtpHost) {
            // No SMTP configured — log and return success for dev
            console.log(`[send-test] SMTP not configured. Would send to: ${to}`);
            return res.json({ sent: true, to, note: 'SMTP not configured, email not actually sent' });
        }

        const transporter = nodemailer.createTransport({
            host: smtpHost,
            port: parseInt(process.env.SMTP_PORT || '587'),
            secure: process.env.SMTP_SECURE === 'true',
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
        });

        await transporter.sendMail({
            from: process.env.SMTP_FROM || process.env.SMTP_USER,
            to,
            subject: variantLabel ? `[TEST] ${subject} — ${variantLabel}` : `[TEST] ${subject}`,
            html,
        });

        res.json({ sent: true, to });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
```

- [ ] **Step 4: Reiniciar servidor y verificar**

```bash
npm start
# En otra terminal:
curl -s -X POST http://localhost:3001/api/emails/send-test \
  -H "Content-Type: application/json" \
  -H "Cookie: <session-cookie>" \
  -d '{"to":"test@example.com","html":"<h1>Test</h1>"}'
# Expected: {"sent":true,"to":"test@example.com","note":"SMTP not configured..."}
```

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/package.json apps/dashboard/package-lock.json apps/dashboard/server.js
git commit -m "feat: add POST /api/emails/send-test endpoint with nodemailer"
```

---

## Task 6: Modificar EmailStudioPage para cargar content-variants

**Files:**
- Modify: `apps/dashboard/src/pages/EmailStudioPage.jsx`

- [ ] **Step 1: Añadir estado y fetch de variantes**

En `EmailStudioPage.jsx`, después de la declaración de `builderStatus` (línea ~28):

```js
const [contentVariants, setContentVariants] = useState({});
const [contentReady, setContentReady] = useState(false);
```

Añadir un `useEffect` para fetchear variantes cuando hay un proyecto seleccionado (después del useEffect de carga del agente, línea ~38):

```js
useEffect(() => {
  const projectId = pipeline.selectedTicket?.project_id;
  if (!projectId) return;
  fetch(`${API_URL}/projects/${projectId}/content-variants`, { credentials: 'include' })
    .then(r => r.ok ? r.json() : null)
    .then(data => {
      if (data) {
        setContentVariants(data.variants || {});
        setContentReady(data.ready || false);
      }
    })
    .catch(() => {});
}, [pipeline.selectedTicket?.project_id]);
```

- [ ] **Step 2: Pasar las nuevas props a EmailBuilderPreview**

Localizar `<EmailBuilderPreview` (línea ~149) y añadir las props nuevas:

```jsx
<EmailBuilderPreview
  html={builderHtml}
  patchedBlock={patchedBlock}
  statusMessage={builderStatus}
  projectId={pipeline.selectedTicket?.project_id}
  contentVariants={contentVariants}
  contentReady={contentReady}
  onBlockClick={(blockName) => setChatInput(`[bloque: ${blockName}] `)}
  onBlockDrop={(block) => {
    setBuilderHtml(prev => prev + block.html);
    setBuilderStatus(t('emailBlocks.added').replace('{name}', block.name));
    setTimeout(() => setBuilderStatus(''), 3000);
  }}
/>
```

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/src/pages/EmailStudioPage.jsx
git commit -m "feat: fetch content variants in EmailStudioPage and pass to preview"
```

---

## Task 7: Modificar EmailBuilderPreview — variant selector toolbar

**Files:**
- Modify: `apps/dashboard/src/components/EmailBuilderPreview.jsx`

- [ ] **Step 1: Añadir imports y nuevas props**

```js
// Añadir al import existente de lucide-react:
import { Monitor, Smartphone, Download, Mail, Maximize2, Save, ChevronDown, FlaskConical } from 'lucide-react';

// Añadir import de utilidad:
import { substituteVariants, countApproved, FIELDS_PER_VARIANT } from '../utils/emailVariants.js';
```

Cambiar la firma del componente (línea 5):
```js
export default function EmailBuilderPreview({
  html, patchedBlock, statusMessage, onBlockClick, onBlockDrop,
  projectId, contentVariants, contentReady
}) {
```

- [ ] **Step 2: Añadir estado para variante activa en preview**

Después de la declaración de `isDragOver` (línea ~10):

```js
const [activeVariant, setActiveVariant] = useState(null);
const [variantDropdownOpen, setVariantDropdownOpen] = useState(false);
const [showPreviewModal, setShowPreviewModal] = useState(false);
```

- [ ] **Step 3: Calcular HTML con variantes sustituidas para el preview**

Después de los estados, añadir:

```js
const variantKeys = Object.keys(contentVariants || {});
// HTML que se muestra en el iframe: sustituido si hay variante activa, original si no
const previewHtml = (activeVariant && contentVariants?.[activeVariant])
  ? substituteVariants(html, contentVariants[activeVariant])
  : html;

// Totales para el badge de estado
const totalApproved = variantKeys.reduce((sum, k) =>
  sum + countApproved(contentVariants[k]), 0);
const totalFields = variantKeys.length * FIELDS_PER_VARIANT;
```

- [ ] **Step 4: Añadir función handleSaveTemplate**

Después de `handleSendTest` (línea ~46):

```js
function handleSaveTemplate() {
  if (!html || !projectId) return;
  fetch(`${import.meta.env.VITE_API_URL || '/api'}/projects/${projectId}/emails`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      market: 'all',
      language: 'all',
      tier: null,
      html_content: html,
      subject_line: 'Template Draft',
      variant_name: `Template Draft ${new Date().toLocaleDateString()}`,
    }),
  }).catch(() => {});
}
```

- [ ] **Step 5: Reemplazar la toolbar actual con la nueva (dos estados)**

Reemplazar el bloque `{/* Toolbar */}` completo (líneas 106-137) con:

```jsx
{/* Toolbar */}
<div className="email-preview-toolbar">
  {tabs.map(tab => (
    <button
      key={tab.id}
      className={`email-preview-tab ${activeTab === tab.id ? 'active' : ''}`}
      onClick={() => setActiveTab(tab.id)}
    >
      {tab.label}
    </button>
  ))}
  <div className="email-preview-toolbar-spacer" />

  {/* Variant selector — Estado A (waiting) o Estado B (ready) */}
  <div className="email-preview-variant-selector">
    <span className="email-preview-variant-label">{t('emailBuilder.variantSelector')}</span>
    {contentReady && variantKeys.length > 0 ? (
      <div style={{ position: 'relative' }}>
        <button
          className="email-preview-variant-btn active"
          onClick={() => setVariantDropdownOpen(o => !o)}
        >
          <span className="variant-status-dot ready" />
          {activeVariant
            ? activeVariant.replace(':', ' · ').toUpperCase()
            : t('emailBuilder.allVariants')}
          <ChevronDown size={11} />
        </button>
        {variantDropdownOpen && (
          <div className="email-preview-variant-dropdown">
            <div
              className={`email-preview-variant-option ${!activeVariant ? 'active' : ''}`}
              onClick={() => { setActiveVariant(null); setVariantDropdownOpen(false); }}
            >
              {t('emailBuilder.allVariants')}
            </div>
            {variantKeys.map(k => (
              <div
                key={k}
                className={`email-preview-variant-option ${activeVariant === k ? 'active' : ''}`}
                onClick={() => { setActiveVariant(k); setVariantDropdownOpen(false); }}
              >
                {k.replace(':', ' · ').toUpperCase()}
              </div>
            ))}
          </div>
        )}
      </div>
    ) : (
      <span className="email-preview-variant-badge waiting">
        <span className="variant-status-dot waiting" />
        {t('emailBuilder.variantWaiting')}
      </span>
    )}
    {contentReady && (
      <span className="email-preview-variant-badge ready">
        {totalApproved}/{totalFields} {t('emailBuilder.variantReady')}
      </span>
    )}
  </div>

  <div className="email-preview-toolbar-spacer" />

  <button
    className={`email-preview-toolbar-btn ${viewMode === 'mobile' ? 'active' : ''}`}
    onClick={() => setViewMode(v => v === 'desktop' ? 'mobile' : 'desktop')}
    title={viewMode === 'desktop' ? t('emailBuilder.toggleMobile') : t('emailBuilder.toggleDesktop')}
  >
    {viewMode === 'desktop' ? <Smartphone size={13} /> : <Monitor size={13} />}
  </button>
  <button
    className="email-preview-toolbar-btn"
    onClick={handleSaveTemplate}
    disabled={!html || !projectId}
    title={t('emailBuilder.saveTemplate')}
  >
    <Save size={13} />
  </button>
  <button className="email-preview-toolbar-btn" onClick={handleExport} title={t('emailBuilder.exportHtml')}>
    <Download size={13} />
  </button>
  <button
    className="email-preview-toolbar-btn variant-test-btn"
    onClick={() => setShowPreviewModal(true)}
    disabled={!html || !contentReady}
    title={t('emailBuilder.previewTest')}
  >
    <FlaskConical size={13} />
  </button>
  <button
    className="email-preview-toolbar-btn"
    onClick={() => setFullscreen(f => !f)}
    title={t('emailBuilder.fullscreen')}
  >
    <Maximize2 size={13} />
  </button>
</div>
```

- [ ] **Step 6: Cambiar srcDoc del iframe para usar previewHtml**

Localizar la línea con `srcDoc={html}` (línea ~87) y cambiar a:

```jsx
srcDoc={previewHtml}
```

- [ ] **Step 7: Añadir VariantPreviewModal al final del return**

Antes del cierre `</div>` final del componente, añadir (después del bloque `{/* Status bar */}`):

```jsx
{/* Variant Preview Modal */}
{showPreviewModal && (
  <VariantPreviewModal
    html={html}
    contentVariants={contentVariants}
    onClose={() => setShowPreviewModal(false)}
  />
)}
```

Y añadir el import al principio del archivo:
```js
import VariantPreviewModal from './VariantPreviewModal.jsx';
```

- [ ] **Step 8: Añadir CSS para los nuevos elementos en index.css**

Localizar las clases `.email-preview-toolbar` en `apps/dashboard/src/index.css` y añadir después:

```css
.email-preview-variant-selector {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
.email-preview-variant-label {
  font-size: 10px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.email-preview-variant-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 6px;
  border: 1px solid var(--border-color);
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-size: 12px;
  cursor: pointer;
}
.email-preview-variant-btn.active {
  border-color: var(--accent-blue, #3b82f6);
}
.email-preview-variant-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  min-width: 160px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  z-index: 100;
  overflow: hidden;
}
.email-preview-variant-option {
  padding: 7px 14px;
  font-size: 12px;
  color: var(--text-secondary);
  cursor: pointer;
}
.email-preview-variant-option:hover,
.email-preview-variant-option.active {
  background: var(--bg-hover, rgba(255,255,255,0.05));
  color: var(--text-primary);
}
.email-preview-variant-badge {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  padding: 3px 8px;
  border-radius: 4px;
}
.email-preview-variant-badge.waiting {
  color: var(--accent-amber, #f59e0b);
  background: rgba(245,158,11,0.1);
}
.email-preview-variant-badge.ready {
  color: var(--accent-green, #22c55e);
  background: rgba(34,197,94,0.1);
}
.variant-status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  display: inline-block;
  flex-shrink: 0;
}
.variant-status-dot.waiting { background: var(--accent-amber, #f59e0b); }
.variant-status-dot.ready   { background: var(--accent-green, #22c55e); }
```

- [ ] **Step 9: Commit**

```bash
git add apps/dashboard/src/components/EmailBuilderPreview.jsx \
        apps/dashboard/src/index.css
git commit -m "feat: add variant selector toolbar to EmailBuilderPreview"
```

---

## Task 8: Crear VariantPreviewModal.jsx

**Files:**
- Create: `apps/dashboard/src/components/VariantPreviewModal.jsx`

- [ ] **Step 1: Crear el componente**

```jsx
// apps/dashboard/src/components/VariantPreviewModal.jsx
import { useState } from 'react';
import { X } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { substituteVariants } from '../utils/emailVariants.js';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export default function VariantPreviewModal({ html, contentVariants, onClose }) {
  const { t } = useLanguage();
  const variantKeys = Object.keys(contentVariants || {});

  // Which variant is being previewed (click)
  const [previewKey, setPreviewKey] = useState(variantKeys[0] || null);
  // Which variants are in the send queue (checkbox)
  const [sendQueue, setSendQueue] = useState(new Set());
  const [testEmail, setTestEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sentCount, setSentCount] = useState(0);

  const previewHtml = previewKey && contentVariants[previewKey]
    ? substituteVariants(html, contentVariants[previewKey])
    : html;

  function toggleSendQueue(key) {
    setSendQueue(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function handleSendTests() {
    if (!testEmail || sendQueue.size === 0) return;
    setSending(true);
    let count = 0;
    for (const key of sendQueue) {
      const populated = substituteVariants(html, contentVariants[key]);
      try {
        const res = await fetch(`${API_URL}/emails/send-test`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            to: testEmail,
            html: populated,
            variantLabel: key.replace(':', ' · ').toUpperCase(),
          }),
        });
        if (res.ok) count++;
      } catch { /* silent */ }
    }
    setSentCount(count);
    setSending(false);
  }

  return (
    <div className="variant-modal-overlay" onClick={onClose}>
      <div className="variant-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="variant-modal-header">
          <h3>{t('emailBuilder.previewTest')}</h3>
          <button className="variant-modal-close" onClick={onClose}><X size={16} /></button>
        </div>

        {/* Body: two columns */}
        <div className="variant-modal-body">
          {/* Left: variant list */}
          <div className="variant-modal-list">
            <div className="variant-modal-list-label">{t('emailBuilder.variantSelector')}</div>
            {variantKeys.length === 0 && (
              <div className="variant-modal-empty">{t('emailBuilder.noVariantsReady')}</div>
            )}
            {variantKeys.map(key => {
              const isPreviewing = previewKey === key;
              const isQueued = sendQueue.has(key);
              return (
                <div
                  key={key}
                  className={`variant-card ${isPreviewing ? 'previewing' : ''} ${isQueued ? 'queued' : ''}`}
                  onClick={() => setPreviewKey(key)}
                >
                  <div className="variant-card-name">
                    {key.replace(':', ' · ').toUpperCase()}
                  </div>
                  <div className="variant-card-meta">
                    {isPreviewing && (
                      <span className="variant-badge previewing">{t('emailBuilder.variantPreviewing')}</span>
                    )}
                    {isQueued && (
                      <span className="variant-badge queued">{t('emailBuilder.variantInQueue')}</span>
                    )}
                  </div>
                  {/* Checkbox for send queue — stops click propagation */}
                  <div
                    className={`variant-card-checkbox ${isQueued ? 'checked' : ''}`}
                    onClick={e => { e.stopPropagation(); toggleSendQueue(key); }}
                  >
                    {isQueued ? '✓' : ''}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right: live preview */}
          <div className="variant-modal-preview">
            {previewHtml ? (
              <iframe
                sandbox="allow-same-origin"
                srcDoc={previewHtml}
                title="Variant Preview"
                className="variant-modal-iframe"
              />
            ) : (
              <div className="variant-modal-no-preview">{t('emailBuilder.noEmailYet')}</div>
            )}
          </div>
        </div>

        {/* Footer: send tests */}
        <div className="variant-modal-footer">
          {sentCount > 0 && (
            <span className="variant-modal-sent">✓ {sentCount} enviado(s)</span>
          )}
          <input
            className="variant-modal-email-input"
            type="email"
            placeholder={t('emailBuilder.testEmailPlaceholder')}
            value={testEmail}
            onChange={e => setTestEmail(e.target.value)}
          />
          <button
            className="variant-modal-send-btn"
            onClick={handleSendTests}
            disabled={!testEmail || sendQueue.size === 0 || sending}
          >
            {sending
              ? '...'
              : t('emailBuilder.sendTestVariants').replace('{n}', sendQueue.size)}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Añadir CSS para el modal en index.css**

```css
/* ── Variant Preview Modal ── */
.variant-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  z-index: 1100;
  display: flex;
  align-items: center;
  justify-content: center;
}
.variant-modal {
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  width: 90vw;
  max-width: 1200px;
  height: 85vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.variant-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px;
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}
.variant-modal-header h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
}
.variant-modal-close {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
}
.variant-modal-body {
  display: flex;
  flex: 1;
  min-height: 0;
}
.variant-modal-list {
  width: 240px;
  flex-shrink: 0;
  border-right: 1px solid var(--border-color);
  padding: 12px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.variant-modal-list-label {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-muted);
  margin-bottom: 4px;
}
.variant-modal-empty {
  font-size: 12px;
  color: var(--text-muted);
  padding: 8px;
}
.variant-card {
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 10px 12px;
  cursor: pointer;
  position: relative;
  transition: border-color 0.15s;
}
.variant-card:hover { border-color: var(--text-muted); }
.variant-card.previewing { border-color: var(--accent-blue, #3b82f6); background: rgba(59,130,246,0.06); }
.variant-card.queued { border-color: var(--accent-purple, #7c3aed); }
.variant-card.previewing.queued { border-color: var(--accent-purple, #7c3aed); }
.variant-card-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
}
.variant-card-meta {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  margin-top: 4px;
}
.variant-badge {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 3px;
}
.variant-badge.previewing {
  background: rgba(59,130,246,0.15);
  color: var(--accent-blue, #3b82f6);
}
.variant-badge.queued {
  background: rgba(124,58,237,0.15);
  color: var(--accent-purple, #7c3aed);
}
.variant-card-checkbox {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 18px;
  height: 18px;
  border: 2px solid var(--border-color);
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  cursor: pointer;
  background: transparent;
  transition: border-color 0.15s, background 0.15s;
}
.variant-card-checkbox.checked {
  border-color: var(--accent-purple, #7c3aed);
  background: var(--accent-purple, #7c3aed);
  color: white;
}
.variant-modal-preview {
  flex: 1;
  background: #f5f5f5;
  overflow-y: auto;
}
.variant-modal-iframe {
  width: 100%;
  height: 100%;
  border: none;
  display: block;
}
.variant-modal-no-preview {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--text-muted);
  font-size: 14px;
}
.variant-modal-footer {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 20px;
  border-top: 1px solid var(--border-color);
  flex-shrink: 0;
}
.variant-modal-sent {
  font-size: 12px;
  color: var(--accent-green, #22c55e);
  margin-right: auto;
}
.variant-modal-email-input {
  flex: 1;
  max-width: 300px;
  padding: 7px 12px;
  border-radius: 6px;
  border: 1px solid var(--border-color);
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-size: 13px;
}
.variant-modal-send-btn {
  padding: 7px 16px;
  border-radius: 6px;
  border: none;
  background: var(--accent-purple, #7c3aed);
  color: white;
  font-size: 13px;
  cursor: pointer;
  font-weight: 500;
}
.variant-modal-send-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/src/components/VariantPreviewModal.jsx \
        apps/dashboard/src/index.css
git commit -m "feat: add VariantPreviewModal component with click-preview and checkbox-send UX"
```

---

## Verificación end-to-end

- [ ] **1.** Completar el Content Agent con variantes aprobadas en un proyecto → hacer handoff
- [ ] **2.** En Adminer, verificar que `project_agent_sessions.deliverables` contiene `content_variants`
- [ ] **3.** Abrir Email Studio para ese proyecto → la toolbar debe mostrar el badge verde y el dropdown activo
- [ ] **4.** Seleccionar una variante en el dropdown → el iframe debe mostrar el contenido real (no `%%=v(@...)=%%`)
- [ ] **5.** Abrir el modal "Preview & Test" → hacer click en una variante = cambia el iframe derecho; checkbox en otra = aparece badge morado
- [ ] **6.** Enviar test con 1 variante → consola del servidor debe loggear `[send-test] SMTP not configured. Would send to: ...`
- [ ] **7.** Abrir Email Studio sin Content Agent completado → toolbar debe mostrar el badge amarillo "Esperando contenido…" y el botón "Preview & Test" deshabilitado
- [ ] **8.** Click en "Guardar template" con HTML generado → verificar en Adminer que aparece una fila en `email_proposals` con `status = 'draft'`
