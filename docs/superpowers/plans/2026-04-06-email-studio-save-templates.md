# Email Studio — Save & Templates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar Export HTML con botones Save (+ popover de nombre) y Preview & Test con texto, e implementar la pestaña Templates con cards reales para gestionar múltiples plantillas.

**Architecture:** Backend añade PATCH y DELETE para emails individuales. EmailBuilderPreview recibe un callback `onTemplateSaved` para notificar al padre. EmailStudioPage gestiona el estado de templates y renderiza la pestaña.

**Tech Stack:** React 19, Express 5, PostgreSQL (`email_proposals`), CSS custom properties, lucide-react, i18n context

---

## File Map

| Archivo | Cambio |
|---|---|
| `apps/dashboard/server.js` | +PATCH `/api/emails/:id`, +DELETE `/api/emails/:id` |
| `apps/dashboard/src/i18n/translations.js` | +8 claves nuevas ES+EN |
| `apps/dashboard/src/components/EmailBuilderPreview.jsx` | Toolbar rework + save popover |
| `apps/dashboard/src/pages/EmailStudioPage.jsx` | Templates tab real + estado |
| `apps/dashboard/src/index.css` | Estilos popover + template list |

---

## Task 1: Backend — PATCH y DELETE para emails

**Files:**
- Modify: `apps/dashboard/server.js` (después de la línea 592, donde termina `PATCH /api/emails/:id/status`)

- [ ] **Step 1: Añadir PATCH `/api/emails/:id`** para rename y set-final

Insertar después de la línea del cierre del endpoint `PATCH /api/emails/:id/status` (línea ~592):

```javascript
// PATCH /api/emails/:id — rename or set as final template
app.patch('/api/emails/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { variant_name, set_final, project_id } = req.body;

  try {
    if (set_final && project_id) {
      // Clear approved status from all templates in project, then set this one
      await pool.query(
        `UPDATE email_proposals SET status = 'draft', updated_at = NOW()
         WHERE project_id = $1 AND status = 'approved'`,
        [project_id]
      );
      const result = await pool.query(
        `UPDATE email_proposals SET status = 'approved', updated_at = NOW()
         WHERE id = $1 RETURNING *`,
        [id]
      );
      if (result.rows.length === 0) return res.status(404).json({ error: 'Email not found' });
      return res.json(result.rows[0]);
    }

    if (variant_name !== undefined) {
      const result = await pool.query(
        `UPDATE email_proposals SET variant_name = $1, updated_at = NOW()
         WHERE id = $2 RETURNING *`,
        [variant_name, id]
      );
      if (result.rows.length === 0) return res.status(404).json({ error: 'Email not found' });
      return res.json(result.rows[0]);
    }

    res.status(400).json({ error: 'Nothing to update' });
  } catch (err) {
    console.error('PATCH /api/emails/:id error:', err);
    res.status(500).json({ error: 'Failed to update email' });
  }
});

- [ ] **Step 2: Añadir DELETE `/api/emails/:id`**

Insertar inmediatamente después del PATCH anterior:

```javascript
// DELETE /api/emails/:id — delete a template
app.delete('/api/emails/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `DELETE FROM email_proposals WHERE id = $1 RETURNING id`,
      [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Email not found' });
    res.json({ deleted: true, id: result.rows[0].id });
  } catch (err) {
    console.error('DELETE /api/emails/:id error:', err);
    res.status(500).json({ error: 'Failed to delete email' });
  }
});
```

- [ ] **Step 3: Verificar en terminal que el servidor arranca sin errores**

```bash
cd apps/dashboard && node server.js &
curl -s http://localhost:3001/api/health || echo "check logs"
```

- [ ] **Step 4: Commit**

```bash
git add apps/dashboard/server.js
git commit -m "feat(api): add PATCH and DELETE /api/emails/:id endpoints"
```

---

## Task 2: Translations — nuevas claves

**Files:**
- Modify: `apps/dashboard/src/i18n/translations.js`

Las claves `emailBuilder.saveTemplate` y `emailBuilder.previewTest` ya existen. Hay que añadir las nuevas.

- [ ] **Step 1: Añadir claves en el bloque `emailBuilder` del ES (línea ~1409, después de `sentCount`)**

Buscar `sentCount: '{n} enviado(s)',` en el bloque ES y añadir después:

```javascript
      savePopoverPlaceholder: 'Nombre de la template',
      saveConfirm: 'Guardar',
      savedToast: 'Template guardada ✓',
      waitingVariants: 'Esperando variants de Sofia',
```

- [ ] **Step 2: Añadir claves en el bloque `studio` del ES (línea ~1454, después de `templates`)**

Buscar `templates: 'Plantillas',` en el bloque ES y añadir después:

```javascript
      templateUseThis: 'Usar esta',
      templateFinal: 'final',
      templateDelete: 'Borrar',
      templateDeleteConfirm: '¿Seguro?',
      noTemplates: 'No hay templates guardadas. Pulsa "💾 Save" para guardar la actual.',
```

- [ ] **Step 3: Añadir las mismas claves en el bloque EN**

En el bloque `emailBuilder` EN (buscar `sentCount: '{n} sent'`):

```javascript
      savePopoverPlaceholder: 'Template name',
      saveConfirm: 'Save',
      savedToast: 'Template saved ✓',
      waitingVariants: 'Waiting for Sofia\'s variants',
```

En el bloque `studio` EN (buscar `templates: 'Templates'`):

```javascript
      templateUseThis: 'Use this',
      templateFinal: 'final',
      templateDelete: 'Delete',
      templateDeleteConfirm: 'Sure?',
      noTemplates: 'No templates saved yet. Click "💾 Save" to save the current one.',
```

- [ ] **Step 4: Commit**

```bash
git add apps/dashboard/src/i18n/translations.js
git commit -m "feat(i18n): add save popover and templates tab translation keys"
```

---

## Task 3: EmailBuilderPreview — toolbar + save popover

**Files:**
- Modify: `apps/dashboard/src/components/EmailBuilderPreview.jsx`

- [ ] **Step 1: Actualizar imports** — quitar `Download`, añadir `X`

```javascript
import { Monitor, Smartphone, Mail, Maximize2, Save, ChevronDown, FlaskConical, X } from 'lucide-react';
```

- [ ] **Step 2: Añadir props y estado del popover**

Actualizar la firma del componente para añadir `onTemplateSaved`:

```javascript
export default function EmailBuilderPreview({ html, blocks, templateHtml, onReorderBlocks, onRemoveBlock, patchedBlock, statusMessage, onBlockClick, onBlockDrop, projectId, contentVariants, contentReady, onTemplateSaved }) {
```

Añadir estado del popover después de `const [canvasDragOver, setCanvasDragOver] = useState(null);`:

```javascript
  const [showSavePopover, setShowSavePopover] = useState(false);
  const [saveTemplateName, setSaveTemplateName] = useState('');
  const [saveToast, setSaveToast] = useState(false);
  const savePopoverRef = useRef(null);
```

Añadir `useRef` al import de React si no está (ya está en línea 1).

- [ ] **Step 3: Reemplazar `handleSaveTemplate`** con la versión que usa el popover

Reemplazar la función `handleSaveTemplate` (líneas 85-100) con:

```javascript
  async function handleSaveTemplate() {
    if (!html || !projectId || !saveTemplateName.trim()) return;
    const API_URL = import.meta.env.VITE_API_URL || '/api';
    try {
      await fetch(`${API_URL}/projects/${projectId}/emails`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          market: 'all',
          language: 'all',
          tier: null,
          html_content: html,
          subject_line: saveTemplateName.trim(),
          variant_name: saveTemplateName.trim(),
        }),
      });
      setShowSavePopover(false);
      setSaveTemplateName('');
      setSaveToast(true);
      setTimeout(() => setSaveToast(false), 2500);
      if (onTemplateSaved) onTemplateSaved();
    } catch {}
  }
```

- [ ] **Step 4: Eliminar `handleExport`** (líneas 74-83, la función completa)

- [ ] **Step 5: Reemplazar el bloque de botones en la toolbar** (líneas 276-301)

Reemplazar desde `<button` del viewport toggle hasta el cierre de `</button>` del fullscreen con:

```jsx
        <button
          className={`email-preview-toolbar-btn ${viewMode === 'mobile' ? 'active' : ''}`}
          onClick={() => setViewMode(v => v === 'desktop' ? 'mobile' : 'desktop')}
          title={viewMode === 'desktop' ? t('emailBuilder.toggleMobile') : t('emailBuilder.toggleDesktop')}
        >
          {viewMode === 'desktop' ? <Smartphone size={13} /> : <Monitor size={13} />}
        </button>

        {/* Save con popover */}
        <div style={{ position: 'relative' }} ref={savePopoverRef}>
          <button
            className="email-preview-toolbar-btn email-preview-toolbar-btn--text"
            onClick={() => { if (html && projectId) setShowSavePopover(o => !o); }}
            disabled={!html || !projectId}
          >
            <Save size={13} />
            <span>{t('emailBuilder.saveTemplate')}</span>
          </button>
          {showSavePopover && (
            <div className="email-save-popover">
              <input
                className="email-save-popover-input"
                placeholder={t('emailBuilder.savePopoverPlaceholder')}
                value={saveTemplateName}
                onChange={e => setSaveTemplateName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSaveTemplate(); if (e.key === 'Escape') setShowSavePopover(false); }}
                autoFocus
              />
              <div className="email-save-popover-actions">
                <button
                  className="email-save-popover-confirm"
                  onClick={handleSaveTemplate}
                  disabled={!saveTemplateName.trim()}
                >
                  {t('emailBuilder.saveConfirm')}
                </button>
                <button className="email-save-popover-cancel" onClick={() => setShowSavePopover(false)}>
                  <X size={12} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Preview & Test */}
        <button
          className="email-preview-toolbar-btn email-preview-toolbar-btn--text email-preview-toolbar-btn--purple"
          onClick={() => setShowPreviewModal(true)}
          disabled={!html || !contentReady}
          title={!contentReady ? t('emailBuilder.waitingVariants') : t('emailBuilder.previewTest')}
        >
          <FlaskConical size={13} />
          <span>{t('emailBuilder.previewTest')}</span>
        </button>

        <button
          className="email-preview-toolbar-btn"
          onClick={() => setFullscreen(f => !f)}
          title={t('emailBuilder.fullscreen')}
        >
          <Maximize2 size={13} />
        </button>
```

- [ ] **Step 6: Añadir toast** justo antes del cierre del `return` (antes de `</div>` final):

Añadir justo antes del `{showPreviewModal && ...}`:

```jsx
      {saveToast && (
        <div className="email-save-toast">{t('emailBuilder.savedToast')}</div>
      )}
```

- [ ] **Step 7: Cerrar popover al hacer click fuera** — añadir `useEffect` después de los estados del popover:

```javascript
  useEffect(() => {
    if (!showSavePopover) return;
    function handleClickOutside(e) {
      if (savePopoverRef.current && !savePopoverRef.current.contains(e.target)) {
        setShowSavePopover(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showSavePopover]);
```

- [ ] **Step 8: Commit**

```bash
git add apps/dashboard/src/components/EmailBuilderPreview.jsx
git commit -m "feat(emailBuilder): replace export HTML with save popover and labeled preview/test button"
```

---

## Task 4: EmailStudioPage — Templates tab real

**Files:**
- Modify: `apps/dashboard/src/pages/EmailStudioPage.jsx`

- [ ] **Step 1: Añadir estado de templates** después de `const [contentReady, setContentReady] = useState(false);`:

```javascript
  const [templates, setTemplates] = useState([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [deletingId, setDeletingId] = useState(null); // id pendiente de confirm borrado
```

- [ ] **Step 2: Añadir `fetchTemplates`** después de la función `removeBlock`:

```javascript
  async function fetchTemplates() {
    const projectId = pipeline.selectedTicket?.project_id;
    if (!projectId) return;
    setTemplatesLoading(true);
    try {
      const res = await fetch(`${API_URL}/projects/${projectId}/emails`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setTemplates(data.emails || data || []);
      }
    } catch {}
    setTemplatesLoading(false);
  }
```

- [ ] **Step 3: Llamar `fetchTemplates` cuando cambia el proyecto o se activa la pestaña**

Añadir un `useEffect` después del que carga content variants:

```javascript
  useEffect(() => {
    if (activeTab === 'templates') fetchTemplates();
  }, [activeTab, pipeline.selectedTicket?.project_id]);
```

- [ ] **Step 4: Pasar `onTemplateSaved` a EmailBuilderPreview**

En el componente `<EmailBuilderPreview ...>` (línea ~238), añadir la prop:

```jsx
              onTemplateSaved={fetchTemplates}
```

- [ ] **Step 5: Reemplazar el bloque de `activeTab === 'templates'`**

Reemplazar el bloque actual (en el condicional que cubre `blocks` y `templates`):

```jsx
        {activeTab === 'blocks' && (
          <div className="studio-full-panel" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
            <p style={{ marginBottom: 12 }}>Vuelve al agente para acceder a este panel.</p>
            <button className="studio-back-btn" onClick={() => navigate('/app/workspace/agent/html-developer')}>
              {t('studio.backToAgent')}
            </button>
          </div>
        )}

        {activeTab === 'templates' && (
          <div className="studio-full-panel email-templates-panel">
            {templatesLoading && <p style={{ color: 'var(--text-muted)', padding: 24 }}>Cargando...</p>}
            {!templatesLoading && templates.length === 0 && (
              <p className="email-templates-empty">{t('studio.noTemplates')}</p>
            )}
            {!templatesLoading && templates.length > 0 && (
              <div className="email-template-list">
                {templates.map(tpl => (
                  <TemplateCard
                    key={tpl.id}
                    template={tpl}
                    contentReady={contentReady}
                    contentVariants={contentVariants}
                    projectId={pipeline.selectedTicket?.project_id}
                    deletingId={deletingId}
                    setDeletingId={setDeletingId}
                    onRefresh={fetchTemplates}
                    t={t}
                  />
                ))}
              </div>
            )}
          </div>
        )}
```

- [ ] **Step 6: Añadir el componente `TemplateCard`** antes del `export default function EmailStudioPage()`:

```jsx
import VariantPreviewModal from '../components/VariantPreviewModal.jsx';

function TemplateCard({ template, contentReady, contentVariants, projectId, deletingId, setDeletingId, onRefresh, t }) {
  const API_URL = import.meta.env.VITE_API_URL || '/api';
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(template.variant_name || '');
  const [showModal, setShowModal] = useState(false);
  const isFinal = template.status === 'approved';

  async function saveName() {
    if (!nameValue.trim() || nameValue === template.variant_name) { setEditingName(false); return; }
    await fetch(`${API_URL}/emails/${template.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ variant_name: nameValue.trim() }),
    });
    setEditingName(false);
    onRefresh();
  }

  async function setAsFinal() {
    await fetch(`${API_URL}/emails/${template.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ set_final: true, project_id: projectId }),
    });
    onRefresh();
  }

  async function deleteTemplate() {
    await fetch(`${API_URL}/emails/${template.id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    setDeletingId(null);
    onRefresh();
  }

  const date = new Date(template.created_at).toLocaleDateString();
  const thumbSrc = template.html_content || '';

  return (
    <div className={`email-template-card${isFinal ? ' email-template-card--final' : ''}`}>
      {/* Thumbnail */}
      <div className="email-template-thumb">
        <iframe
          sandbox="allow-same-origin"
          srcDoc={thumbSrc}
          className="email-template-thumb-iframe"
          scrolling="no"
          tabIndex={-1}
        />
      </div>

      {/* Info */}
      <div className="email-template-info">
        <div className="email-template-name-row">
          {editingName ? (
            <input
              className="email-template-name-input"
              value={nameValue}
              onChange={e => setNameValue(e.target.value)}
              onBlur={saveName}
              onKeyDown={e => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setEditingName(false); }}
              autoFocus
            />
          ) : (
            <span className="email-template-name" onClick={() => setEditingName(true)} title="Click para renombrar">
              {template.variant_name || 'Sin nombre'}
            </span>
          )}
          <span className={`email-template-badge${isFinal ? ' email-template-badge--final' : ''}`}>
            {isFinal ? t('studio.templateFinal') : 'draft'}
          </span>
        </div>
        <span className="email-template-date">{date}</span>

        <div className="email-template-actions">
          <button
            className="email-template-btn email-template-btn--test"
            onClick={() => setShowModal(true)}
            disabled={!contentReady}
            title={!contentReady ? t('emailBuilder.waitingVariants') : t('emailBuilder.previewTest')}
          >
            🧪 {t('emailBuilder.previewTest')}
          </button>
          {!isFinal && (
            <button className="email-template-btn email-template-btn--use" onClick={setAsFinal}>
              ⭐ {t('studio.templateUseThis')}
            </button>
          )}
          {isFinal && (
            <span className="email-template-btn email-template-btn--chosen">✓ {t('studio.templateUseThis')}</span>
          )}
          {deletingId === template.id ? (
            <>
              <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{t('studio.templateDeleteConfirm')}</span>
              <button className="email-template-btn email-template-btn--danger" onClick={deleteTemplate}>Sí</button>
              <button className="email-template-btn" onClick={() => setDeletingId(null)}>No</button>
            </>
          ) : (
            <button className="email-template-btn email-template-btn--delete" onClick={() => setDeletingId(template.id)}>
              🗑
            </button>
          )}
        </div>
      </div>

      {showModal && (
        <VariantPreviewModal
          html={template.html_content}
          contentVariants={contentVariants}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
```

El import de `VariantPreviewModal` ya existe en el archivo o se añade al principio del fichero.

- [ ] **Step 7: Commit**

```bash
git add apps/dashboard/src/pages/EmailStudioPage.jsx
git commit -m "feat(templates): implement Templates tab with real template cards"
```

---

## Task 5: CSS — estilos popover y template list

**Files:**
- Modify: `apps/dashboard/src/index.css` (añadir al final del bloque de estilos de email builder)

- [ ] **Step 1: Añadir estilos al final del archivo**

```css
/* ── Email Save Popover ── */
.email-preview-toolbar-btn--text {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 500;
}

.email-preview-toolbar-btn--text span {
  white-space: nowrap;
}

.email-preview-toolbar-btn--purple {
  color: var(--accent-purple, #818cf8);
}

.email-preview-toolbar-btn--purple:not(:disabled):hover {
  background: rgba(129, 140, 248, 0.12);
}

.email-save-popover {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 12px;
  width: 220px;
  z-index: 200;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.email-save-popover-input {
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  padding: 7px 10px;
  color: var(--text-primary);
  font-size: 13px;
  width: 100%;
  outline: none;
}

.email-save-popover-input:focus {
  border-color: var(--accent-green, #22c55e);
}

.email-save-popover-actions {
  display: flex;
  gap: 6px;
  align-items: center;
}

.email-save-popover-confirm {
  flex: 1;
  background: var(--accent-green, #22c55e);
  color: #000;
  border: none;
  border-radius: 5px;
  padding: 6px 10px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.email-save-popover-confirm:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.email-save-popover-cancel {
  background: var(--bg-tertiary, #2a2a3e);
  border: none;
  border-radius: 5px;
  padding: 6px 8px;
  color: var(--text-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
}

.email-save-toast {
  position: absolute;
  bottom: 40px;
  right: 16px;
  background: var(--accent-green, #22c55e);
  color: #000;
  padding: 7px 14px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  z-index: 300;
  animation: fade-in-up 0.2s ease;
}

@keyframes fade-in-up {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* ── Email Templates Panel ── */
.email-templates-panel {
  padding: 24px;
  overflow-y: auto;
}

.email-templates-empty {
  color: var(--text-muted);
  font-size: 14px;
  text-align: center;
  margin-top: 48px;
}

.email-template-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-width: 720px;
}

.email-template-card {
  display: flex;
  gap: 16px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  padding: 14px;
  align-items: flex-start;
  transition: border-color 0.15s;
}

.email-template-card--final {
  border-color: var(--accent-green, #22c55e);
}

.email-template-thumb {
  width: 88px;
  height: 66px;
  flex-shrink: 0;
  background: var(--bg-primary);
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid var(--border-color);
  position: relative;
}

.email-template-thumb-iframe {
  width: 600px;
  height: 440px;
  border: none;
  pointer-events: none;
  transform: scale(0.147);
  transform-origin: top left;
  position: absolute;
  top: 0;
  left: 0;
}

.email-template-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.email-template-name-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.email-template-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.email-template-name:hover {
  text-decoration: underline;
}

.email-template-name-input {
  background: var(--bg-primary);
  border: 1px solid var(--accent-purple, #818cf8);
  border-radius: 5px;
  padding: 4px 8px;
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 600;
  outline: none;
  flex: 1;
}

.email-template-badge {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 2px 7px;
  border-radius: 4px;
  background: rgba(96, 165, 250, 0.15);
  color: #60a5fa;
  flex-shrink: 0;
}

.email-template-badge--final {
  background: rgba(34, 197, 94, 0.15);
  color: var(--accent-green, #22c55e);
}

.email-template-date {
  font-size: 11px;
  color: var(--text-muted);
}

.email-template-actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-top: 4px;
  align-items: center;
}

.email-template-btn {
  font-size: 12px;
  padding: 5px 10px;
  border-radius: 5px;
  border: none;
  cursor: pointer;
  background: var(--bg-tertiary, #2a2a3e);
  color: var(--text-secondary);
  white-space: nowrap;
}

.email-template-btn:hover:not(:disabled) {
  background: var(--bg-hover, #3a3a4e);
}

.email-template-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.email-template-btn--test {
  background: rgba(34, 197, 94, 0.12);
  color: var(--accent-green, #22c55e);
}

.email-template-btn--use {
  background: rgba(99, 102, 241, 0.12);
  color: var(--accent-purple, #818cf8);
}

.email-template-btn--chosen {
  background: rgba(34, 197, 94, 0.12);
  color: var(--accent-green, #22c55e);
  font-size: 12px;
  padding: 5px 10px;
  border-radius: 5px;
}

.email-template-btn--delete {
  margin-left: auto;
  background: transparent;
  color: var(--text-muted);
}

.email-template-btn--delete:hover {
  color: #ef4444;
  background: rgba(239, 68, 68, 0.1);
}

.email-template-btn--danger {
  background: rgba(239, 68, 68, 0.15);
  color: #ef4444;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/dashboard/src/index.css
git commit -m "feat(css): add save popover and email template list styles"
```

---

## Verificación end-to-end

- [ ] `npm start` — servidor y Vite arrancan sin errores
- [ ] En Email Studio con un ticket seleccionado: toolbar muestra "💾 Save" y "🧪 Preview & Test" con texto, sin botón de descarga
- [ ] Click "💾 Save" → popover aparece con input, escribir nombre, Enter → toast "Template guardada ✓"
- [ ] Ir a pestaña Templates → card aparece con nombre correcto, badge "draft", thumbnail del HTML
- [ ] Botón "🧪 Preview & Test" en la card está disabled cuando Sofia no ha terminado
- [ ] Simular `contentReady=true` (o con proyecto donde Sofia ya terminó) → botón se activa, click abre VariantPreviewModal
- [ ] Click "⭐ Usar esta" → badge cambia a "final", borde verde en card
- [ ] Guardar segunda template → ambas aparecen, al marcar una como final la otra vuelve a "draft"
- [ ] Click en nombre de template → input editable, Enter guarda
- [ ] Click 🗑 → "¿Seguro? Sí / No" → Sí borra la card
- [ ] En toolbar: Preview & Test muestra tooltip "Esperando variants de Sofia" cuando está disabled
