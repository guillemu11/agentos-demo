# Lucía AMPscript Fill Flow — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cuando Lucía dice "rellena la variante Economy English", el agente genera los valores de todas las variables AMPscript del email y el preview se actualiza en tiempo real variable por variable.

**Architecture:** El backend ya parsea `[EMAIL_VARIABLES]` y los guarda. Lo que falta es: (1) el backend emite cada variable vía SSE a medida que las genera (streaming incremental), (2) el frontend captura esos eventos y sustituye las variables en el HTML del preview en tiempo real, (3) la sidebar AMPscript reemplaza la sidebar genérica en el Content Studio de Lucía, (4) al hacer click en un bloque de la lista, el chat se pre-carga con el prompt correcto.

**Tech Stack:** React 19, Express 5 SSE, AMPscript `%%=v(@var)=%%` substitution client-side, CSS custom properties, i18n ES+EN.

---

## Mapa de archivos

| Archivo | Qué cambia |
|---------|-----------|
| `apps/dashboard/server.js` | Emitir `VAR_UPDATE` SSE por variable a medida que Lucía las genera; endpoint `GET /api/projects/:id/email-variables` para leer variables guardadas |
| `apps/dashboard/src/pages/ContentStudioPage.jsx` | Pasar `ampVars` + `liveHtml` a sidebar y preview; conectar click de bloque → chat input |
| `apps/dashboard/src/components/agent-views/ContentChatPanel.jsx` | Parsear `VAR_UPDATE` SSE → callback `onVarUpdate`; aceptar `externalInput` prop |
| `apps/dashboard/src/components/agent-views/AmpscriptSidebar.jsx` | **NUEVO** — sidebar con variables AMPscript, valores actuales, estado por variante |
| `apps/dashboard/src/i18n/translations.js` | Claves nuevas para AmpscriptSidebar |
| `apps/dashboard/src/index.css` | Estilos para AmpscriptSidebar |

---

## Task 1: Endpoint GET variables guardadas + emisión VAR_UPDATE en SSE

**Files:**
- Modify: `apps/dashboard/server.js` (sección post sessions/chat, línea ~6986 y zona de helpers ~6650)

- [ ] **Step 1: Añadir endpoint GET /api/projects/:id/email-variables**

En `server.js`, después de la línea `// POST /api/projects/:id/sessions/:sessionId/chat` (~línea 6650), añadir:

```javascript
// GET /api/projects/:id/email-variables — Return saved variable_values from Lucia's deliverables
app.get('/api/projects/:id/email-variables', requireAuth, async (req, res) => {
    try {
        const projectId = parseInt(req.params.id);
        // Latest active or completed Lucia session for this project
        const sessionRes = await pool.query(
            `SELECT pas.deliverables
             FROM project_agent_sessions pas
             JOIN agents a ON a.id = pas.agent_id
             WHERE pas.project_id = $1
               AND (a.id = 'lucia' OR a.role ILIKE '%content agent%' OR a.role ILIKE '%content strategist%')
             ORDER BY pas.updated_at DESC LIMIT 1`,
            [projectId]
        );
        const deliverables = sessionRes.rows[0]?.deliverables || {};
        res.json({ variables: deliverables.variable_values || {} });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
```

- [ ] **Step 2: Emitir VAR_UPDATE por variable durante el streaming de Lucía**

En `server.js`, en el bloque `if (isLuciaResponse)` (~línea 6991), reemplazar el bloque completo por:

```javascript
if (isLuciaResponse) {
    const emailVars = parseEmailVariables(fullResponse);
    const contentByBlock = !emailVars ? parseContentByBlock(fullResponse) : null;

    if (emailVars || contentByBlock) {
        const currentSpec = (await pool.query('SELECT email_spec FROM projects WHERE id = $1', [projectId])).rows[0]?.email_spec || {};
        const deliverableUpdate = {};

        // Flatten vars (both formats → flat object)
        let flatVars = {};
        if (emailVars) {
            flatVars = emailVars;
            deliverableUpdate.variable_values = emailVars;
            deliverableUpdate.preview_version = currentSpec.html_version || 0;
        }
        if (contentByBlock) {
            deliverableUpdate.content_by_block = contentByBlock;
            for (const blockVars of Object.values(contentByBlock)) {
                Object.assign(flatVars, blockVars);
            }
            deliverableUpdate.variable_values = flatVars;
            deliverableUpdate.preview_version = currentSpec.html_version || 0;
        }

        await pool.query(
            `UPDATE project_agent_sessions
             SET deliverables = COALESCE(deliverables, '{}'::jsonb) || $1::jsonb
             WHERE id = $2`,
            [JSON.stringify(deliverableUpdate), sessionId]
        );

        // Emit each variable as a VAR_UPDATE SSE event so the frontend can update the preview live
        for (const [varName, varValue] of Object.entries(flatVars)) {
            res.write(`data: ${JSON.stringify({ var_update: { name: varName, value: varValue } })}\n\n`);
        }
        res.write(`data: ${JSON.stringify({ email_variables_saved: true, count: Object.keys(flatVars).length })}\n\n`);
    }
}
```

- [ ] **Step 3: Verificar que el servidor arranca sin errores**

```bash
npm start
```
Esperado: servidor en puerto 3001 sin errores de sintaxis.

- [ ] **Step 4: Commit**

```bash
git add apps/dashboard/server.js
git commit -m "feat(lucia): emit VAR_UPDATE SSE per variable + GET email-variables endpoint"
```

---

## Task 2: ContentChatPanel — parsear VAR_UPDATE + prop externalInput

**Files:**
- Modify: `apps/dashboard/src/components/agent-views/ContentChatPanel.jsx`

- [ ] **Step 1: Añadir callback onVarUpdate y parseo de var_update en el stream**

En `ContentChatPanel.jsx`, cambiar la firma del componente:

```javascript
export default function ContentChatPanel({ agent, ticket, completedSessions, activeVariant, onBriefUpdate, onImageGenerated, onVarUpdate, externalInput, onExternalInputConsumed }) {
```

- [ ] **Step 2: Consumir externalInput (para pre-cargar desde click de bloque)**

Después de la declaración `const [input, setInput] = useState('');`, añadir:

```javascript
// Pre-load chat input from parent (e.g. block click)
useEffect(() => {
    if (!externalInput) return;
    setInput(externalInput);
    onExternalInputConsumed?.();
    inputRef.current?.focus();
}, [externalInput, onExternalInputConsumed]);
```

- [ ] **Step 3: Parsear var_update en el stream dentro de sendMessage**

Dentro del bucle SSE en `sendMessage`, después del bloque que maneja `parsed.image_url`, añadir:

```javascript
if (parsed.var_update) {
    onVarUpdate?.(parsed.var_update.name, parsed.var_update.value);
}
if (parsed.email_variables_saved) {
    // noop — vars already emitted individually via var_update
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/dashboard/src/components/agent-views/ContentChatPanel.jsx
git commit -m "feat(lucia): ContentChatPanel accepts externalInput + onVarUpdate callback"
```

---

## Task 3: AmpscriptSidebar — nuevo componente

**Files:**
- Create: `apps/dashboard/src/components/agent-views/AmpscriptSidebar.jsx`

El sidebar muestra las variables AMPscript del email agrupadas por bloque, con su estado (vacío/rellenado) y valor actual. Al hacer click en un bloque → emite `onBlockClick(blockName, vars)` para pre-cargar el chat.

- [ ] **Step 1: Crear AmpscriptSidebar.jsx**

```jsx
import React, { useState } from 'react';
import { useLanguage } from '../../i18n/LanguageContext.jsx';

// Variables que son imágenes (no texto)
const IMAGE_VARS = new Set(['hero_image', 'story1_image', 'story2_image', 'story3_image', 'article_image', 'logo_image', 'header_logo']);
// Variables que son links (ignorar en la UI principal)
const LINK_VARS = new Set(['hero_image_link_alias', 'body_link_alias', 'story1_alias', 'story2_alias', 'story3_alias', 'article_link_alias', 'unsub_link_alias', 'contactus_link_alias', 'privacy_link_alias', 'logo_link_alias', 'header_logo_alias', 'join_skw_alias']);
// Footer/legal vars (siempre auto-rellenados)
const FOOTER_VARS = new Set(['unsub_text', 'contactus_text', 'privacy_text']);

function varType(varName) {
    if (IMAGE_VARS.has(varName)) return 'image';
    if (LINK_VARS.has(varName)) return 'link';
    if (FOOTER_VARS.has(varName)) return 'footer';
    return 'text';
}

export default function AmpscriptSidebar({
    blockVarMap,      // { "Block 2": ["header_logo", ...], "Block 3": [...], ... }
    varValues,        // { "@main_header": "Welcome back...", ... }
    onBlockClick,     // (blockName, vars) => void — pre-loads chat
    onHandoff,        // () => void
    canHandoff,       // boolean
    selectedVariant,  // "en:economy" | null
    onVariantChange,  // (market, tier) => void
    availableMarkets,
    availableTiers,
}) {
    const { t } = useLanguage();
    const [newMarket, setNewMarket] = useState('');
    const [newTier, setNewTier] = useState('');

    const MARKET_FLAGS = { en: '🇬🇧', es: '🇪🇸', ar: '🇦🇪', ru: '🇷🇺' };
    const MARKET_LABELS = { en: 'EN', es: 'ES', ar: 'AR', ru: 'RU' };
    const TIER_LABELS = { economy: 'Economy', economy_premium: 'Eco Premium', business: 'Business', first_class: 'First' };

    const allBlocks = Object.entries(blockVarMap || {});
    // Count filled vars (ignore link and footer vars)
    const fillableVars = allBlocks.flatMap(([, vars]) => vars.filter(v => varType(v) !== 'link' && varType(v) !== 'footer'));
    const filledVars = fillableVars.filter(v => varValues?.[`@${v}`]);
    const progress = fillableVars.length > 0 ? Math.round((filledVars.length / fillableVars.length) * 100) : 0;

    return (
        <aside className="ampscript-sidebar">
            {/* Header */}
            <div className="ampscript-sidebar-header">
                <div className="ampscript-sidebar-title">
                    {t('ampscript.sidebarTitle') || 'Variables del Email'}
                </div>
                <div className="ampscript-sidebar-progress-row">
                    <div className="ampscript-sidebar-progress-track">
                        <div className="ampscript-sidebar-progress-fill" style={{ width: `${progress}%` }} />
                    </div>
                    <span className="ampscript-sidebar-progress-pct">{progress}%</span>
                </div>
            </div>

            {/* Variant selector */}
            <div className="ampscript-variant-selector">
                <select
                    className="ampscript-variant-select"
                    value={newMarket}
                    onChange={e => setNewMarket(e.target.value)}
                >
                    <option value="">{t('contentAgent.selectMarket') || 'Market'}</option>
                    {(availableMarkets || []).map(m => (
                        <option key={m} value={m}>{MARKET_FLAGS[m] || '🌐'} {MARKET_LABELS[m] || m.toUpperCase()}</option>
                    ))}
                </select>
                <select
                    className="ampscript-variant-select"
                    value={newTier}
                    onChange={e => setNewTier(e.target.value)}
                >
                    <option value="">{t('contentAgent.selectTier') || 'Tier'}</option>
                    {(availableTiers || []).map(tier => (
                        <option key={tier} value={tier}>{TIER_LABELS[tier] || tier}</option>
                    ))}
                </select>
                <button
                    className="ampscript-fill-btn"
                    disabled={!newMarket || !newTier}
                    onClick={() => {
                        if (!newMarket || !newTier) return;
                        onVariantChange?.(newMarket, newTier);
                        // Auto-trigger fill message via onBlockClick with special "all" signal
                        onBlockClick?.('__fill_all__', { market: newMarket, tier: newTier });
                        setNewMarket(''); setNewTier('');
                    }}
                >
                    {t('ampscript.fillBtn') || 'Rellenar →'}
                </button>
            </div>

            {/* Block list */}
            <div className="ampscript-block-list">
                {allBlocks.map(([blockName, vars]) => {
                    const fillable = vars.filter(v => varType(v) !== 'link' && varType(v) !== 'footer');
                    const filled = fillable.filter(v => varValues?.[`@${v}`]);
                    const done = fillable.length > 0 && filled.length === fillable.length;
                    if (fillable.length === 0) return null;
                    return (
                        <div
                            key={blockName}
                            className={`ampscript-block-item${done ? ' done' : ''}`}
                            onClick={() => onBlockClick?.(blockName, vars)}
                        >
                            <div className="ampscript-block-item-header">
                                <span className="ampscript-block-item-name">{blockName}</span>
                                <span className={`ampscript-block-item-status ${done ? 'done' : 'pending'}`}>
                                    {done ? '✓' : `${filled.length}/${fillable.length}`}
                                </span>
                            </div>
                            <div className="ampscript-var-list">
                                {fillable.map(varName => {
                                    const value = varValues?.[`@${varName}`];
                                    const type = varType(varName);
                                    return (
                                        <div key={varName} className={`ampscript-var-row ${value ? 'filled' : 'empty'}`}>
                                            <span className="ampscript-var-type-icon">
                                                {type === 'image' ? '🖼️' : '✍️'}
                                            </span>
                                            <span className="ampscript-var-name">@{varName}</span>
                                            {value && (
                                                <span className="ampscript-var-value" title={value}>
                                                    {type === 'image'
                                                        ? '(imagen guardada)'
                                                        : value.length > 40 ? value.substring(0, 40) + '…' : value}
                                                </span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Footer */}
            <div className="ampscript-sidebar-footer">
                <button
                    className="brief-handoff-btn"
                    disabled={!canHandoff}
                    onClick={canHandoff ? onHandoff : undefined}
                >
                    {t('contentAgent.handoffButton') || 'Pasar a HTML Developer'} →
                </button>
                {!canHandoff && (
                    <div className="brief-handoff-hint">
                        {fillableVars.length === 0
                            ? (t('ampscript.noVarsYet') || 'Carga el template primero')
                            : (t('ampscript.incompleteVars') || `Faltan ${fillableVars.length - filledVars.length} variables`)}
                    </div>
                )}
            </div>
        </aside>
    );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/dashboard/src/components/agent-views/AmpscriptSidebar.jsx
git commit -m "feat(lucia): AmpscriptSidebar component with block→var mapping and progress"
```

---

## Task 4: ContentStudioPage — conectar todo

**Files:**
- Modify: `apps/dashboard/src/pages/ContentStudioPage.jsx`

- [ ] **Step 1: Añadir imports y estado**

Al inicio de `ContentStudioPage.jsx`, añadir el import:
```javascript
import AmpscriptSidebar from '../components/agent-views/AmpscriptSidebar.jsx';
```

Añadir estados nuevos tras `const [chatImages, setChatImages] = useState([]);`:
```javascript
const [ampVarValues, setAmpVarValues] = useState({});   // { "@main_header": "...", ... }
const [blockVarMap, setBlockVarMap] = useState({});      // { "Block 3": ["main_header", ...] }
const [chatPreload, setChatPreload] = useState('');       // texto pre-cargado al chat
const [selectedVariant, setSelectedVariant] = useState(null); // "en:economy"
```

- [ ] **Step 2: Parsear blockVarMap desde el HTML del email y cargar vars guardadas**

Reemplazar el `useEffect` de `projectEmails` completo por:

```javascript
useEffect(() => {
    const projectId = pipeline.selectedTicket?.project_id;
    if (!projectId) { setProjectEmails([]); setBlockVarMap({}); setAmpVarValues({}); return; }
    setEmailsLoading(true);

    Promise.all([
        fetch(`${API_URL}/projects/${projectId}/emails`, { credentials: 'include' })
            .then(r => r.ok ? r.json() : []),
        fetch(`${API_URL}/projects/${projectId}/email-variables`, { credentials: 'include' })
            .then(r => r.ok ? r.json() : { variables: {} }),
    ]).then(([emailsData, varsData]) => {
        const emails = Array.isArray(emailsData) ? emailsData : [];
        setProjectEmails(emails);

        // Parse block→var map from HTML
        const html = (emails.find(e => e.status === 'approved') || emails[0])?.html_content || '';
        if (html) {
            const map = {};
            const parts = html.split(/(?=data-block-name=")/);
            parts.slice(1).forEach(part => {
                const nameMatch = part.match(/data-block-name="([^"]+)"/);
                if (!nameMatch) return;
                const blockName = nameMatch[1];
                const chunk = part.substring(0, 3000);
                const vars = [...chunk.matchAll(/%%=v\(@(\w+)\)=%%/g)].map(m => m[1]);
                if (vars.length) map[blockName] = [...new Set(vars)];
            });
            setBlockVarMap(map);
        }

        // Load saved variable values
        setAmpVarValues(varsData.variables || {});

        if (emails.length > 0) setActiveTab('template');
    }).catch(() => {}).finally(() => setEmailsLoading(false));
}, [pipeline.selectedTicket?.project_id]);
```

- [ ] **Step 3: Computar liveHtml — HTML con variables sustituidas**

Añadir después del `useMemo` de `emailBlocks`:

```javascript
const liveHtml = useMemo(() => {
    const base = (projectEmails.find(e => e.status === 'approved') || projectEmails[0])?.html_content || '';
    if (!base || Object.keys(ampVarValues).length === 0) return base;
    let result = base;
    for (const [key, value] of Object.entries(ampVarValues)) {
        // key is "@main_header", pattern in html is %%=v(@main_header)=%%
        const varName = key.startsWith('@') ? key.slice(1) : key;
        const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        result = result.replace(
            new RegExp(`%%=v\\(@${varName}\\)=%%`, 'g'),
            value
        );
    }
    return result;
}, [projectEmails, ampVarValues]);
```

- [ ] **Step 4: Handler onVarUpdate — actualizar ampVarValues desde SSE**

Añadir callback tras `handleChatImage`:
```javascript
const handleVarUpdate = useCallback((varName, varValue) => {
    // varName comes as "@main_header" from server
    setAmpVarValues(prev => ({ ...prev, [varName]: varValue }));
}, []);
```

- [ ] **Step 5: Handler onBlockClick — pre-cargar chat con prompt del bloque**

```javascript
const handleBlockClick = useCallback((blockName, vars) => {
    if (blockName === '__fill_all__') {
        // vars es { market, tier }
        const marketLabel = { en: 'English', es: 'Spanish', ar: 'Arabic', ru: 'Russian' }[vars.market] || vars.market;
        const tierLabel = { economy: 'Economy', economy_premium: 'Premium Economy', business: 'Business', first_class: 'First Class' }[vars.tier] || vars.tier;
        setChatPreload(`Fill all email variables for the ${tierLabel} ${marketLabel} variant. Use the campaign context from previous agents and the "welcome back" reactivation tone.`);
        setSelectedVariant(`${vars.market}:${vars.tier}`);
    } else {
        // Click on a specific block
        const varList = Array.isArray(vars) ? vars : [];
        const fillable = varList.filter(v => !['hero_image_link_alias','body_link_alias','story1_alias','story2_alias','story3_alias','article_link_alias','unsub_link_alias','contactus_link_alias','privacy_link_alias','logo_link_alias','header_logo_alias','join_skw_alias'].includes(v));
        if (!fillable.length) return;
        setChatPreload(`Generate content for ${blockName}: ${fillable.map(v => '@' + v).join(', ')}`);
    }
    setActiveTab('chat');
}, []);
```

- [ ] **Step 6: Actualizar render del tab template — usar liveHtml en lugar de substituteForPreview**

En el JSX del tab `template`, cambiar el `srcDoc` del iframe:
```jsx
// Antes:
srcDoc={substituteForPreview(emailForPreview.html_content || '')}

// Después:
srcDoc={liveHtml || substituteForPreview(emailForPreview.html_content || '')}
```

- [ ] **Step 7: Reemplazar ContentBriefSidebar por AmpscriptSidebar en el tab chat**

En el JSX del tab `chat`, reemplazar la sección completa:
```jsx
{activeTab === 'chat' && (
  <div className="content-studio-split">
    <ContentChatPanel
      agent={agent}
      ticket={pipeline.selectedTicket}
      completedSessions={pipeline.completedSessions}
      activeVariant={activeVariant}
      onBriefUpdate={handleBriefUpdate}
      onImageGenerated={handleChatImage}
      onVarUpdate={handleVarUpdate}
      externalInput={chatPreload}
      onExternalInputConsumed={() => setChatPreload('')}
    />
    {Object.keys(blockVarMap).length > 0 ? (
      <AmpscriptSidebar
        blockVarMap={blockVarMap}
        varValues={ampVarValues}
        onBlockClick={handleBlockClick}
        onHandoff={handleContentHandoff}
        canHandoff={Object.keys(ampVarValues).length > 0}
        selectedVariant={selectedVariant}
        onVariantChange={(m, t) => setSelectedVariant(`${m}:${t}`)}
        availableMarkets={availableMarkets}
        availableTiers={AVAILABLE_TIERS}
      />
    ) : (
      <ContentBriefSidebar
        variants={variants}
        activeVariant={activeVariant}
        availableMarkets={availableMarkets}
        availableTiers={AVAILABLE_TIERS}
        onAddVariant={addVariant}
        onSelectVariant={setActiveVariant}
        onBriefUpdate={handleBriefUpdate}
        onHandoff={handleContentHandoff}
        chatImages={chatImages}
      />
    )}
  </div>
)}
```

- [ ] **Step 8: Añadir click en bloques de la checklist (tab template) para ir al chat**

En el bloque `content-template-block-item` dentro del tab template, añadir `onClick`:
```jsx
<div
  key={i}
  className="content-template-block-item"
  style={{ cursor: 'pointer' }}
  onClick={() => handleBlockClick(emailBlocks[i] || blockName, Object.values(blockVarMap)[i] || [])}
>
```

Simplificar: en la lista `emailBlocks.map((blockName, i)`, añadir:
```jsx
onClick={() => {
  const vars = blockVarMap[blockName] || [];
  handleBlockClick(blockName, vars);
}}
```

- [ ] **Step 9: Commit**

```bash
git add apps/dashboard/src/pages/ContentStudioPage.jsx
git commit -m "feat(lucia): wire AmpscriptSidebar, liveHtml preview, block click → chat preload"
```

---

## Task 5: CSS para AmpscriptSidebar

**Files:**
- Modify: `apps/dashboard/src/index.css`

- [ ] **Step 1: Añadir estilos al final de la sección de `.content-template-*`**

Después del bloque `.content-template-checklist-footer` en `index.css`:

```css
/* ── AmpscriptSidebar ───────────────────────────────────────────────── */
.ampscript-sidebar {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--bg-card);
  border-left: 1px solid var(--border-light);
  min-width: 280px;
  max-width: 320px;
}
.ampscript-sidebar-header {
  padding: 14px 16px 10px;
  border-bottom: 1px solid var(--border-light);
  flex-shrink: 0;
}
.ampscript-sidebar-title {
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--text-main);
  margin-bottom: 8px;
}
.ampscript-sidebar-progress-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.ampscript-sidebar-progress-track {
  flex: 1;
  height: 4px;
  border-radius: 2px;
  background: var(--bg-elevated);
  overflow: hidden;
}
.ampscript-sidebar-progress-fill {
  height: 100%;
  border-radius: 2px;
  background: #10b981;
  transition: width 0.4s ease;
}
.ampscript-sidebar-progress-pct {
  font-size: 0.72rem;
  font-weight: 700;
  color: #10b981;
  min-width: 32px;
  text-align: right;
}

/* Variant selector */
.ampscript-variant-selector {
  display: flex;
  gap: 6px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--border-light);
  flex-shrink: 0;
  flex-wrap: wrap;
}
.ampscript-variant-select {
  flex: 1;
  min-width: 80px;
  padding: 5px 8px;
  border-radius: 6px;
  border: 1px solid var(--border-light);
  background: var(--bg-main);
  color: var(--text-main);
  font-size: 0.78rem;
  cursor: pointer;
}
.ampscript-fill-btn {
  padding: 5px 12px;
  border-radius: 6px;
  border: none;
  background: var(--primary);
  color: #fff;
  font-size: 0.78rem;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
  transition: opacity 0.15s;
}
.ampscript-fill-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* Block list */
.ampscript-block-list {
  flex: 1;
  overflow-y: auto;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.ampscript-block-item {
  border: 1px solid var(--border-light);
  border-radius: 8px;
  background: var(--bg-main);
  cursor: pointer;
  transition: border-color 0.15s, box-shadow 0.15s;
  overflow: hidden;
}
.ampscript-block-item:hover {
  border-color: var(--primary);
  box-shadow: 0 0 0 2px rgba(215,25,32,0.08);
}
.ampscript-block-item.done {
  border-color: #10b981;
  background: rgba(16,185,129,0.04);
}
.ampscript-block-item-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px 6px;
}
.ampscript-block-item-name {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-main);
}
.ampscript-block-item-status {
  font-size: 0.7rem;
  font-weight: 700;
  padding: 1px 7px;
  border-radius: 10px;
}
.ampscript-block-item-status.done {
  background: rgba(16,185,129,0.12);
  color: #10b981;
}
.ampscript-block-item-status.pending {
  background: rgba(148,163,184,0.12);
  color: var(--text-muted);
}

/* Var rows inside each block */
.ampscript-var-list {
  padding: 0 10px 8px;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.ampscript-var-row {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 0.72rem;
  padding: 2px 0;
}
.ampscript-var-row.empty .ampscript-var-name { color: var(--text-muted); }
.ampscript-var-row.filled .ampscript-var-name { color: var(--text-secondary); }
.ampscript-var-type-icon { font-size: 0.65rem; flex-shrink: 0; }
.ampscript-var-name { font-family: monospace; font-size: 0.7rem; flex-shrink: 0; }
.ampscript-var-value {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #10b981;
  font-size: 0.7rem;
}

/* Footer */
.ampscript-sidebar-footer {
  padding: 12px;
  border-top: 1px solid var(--border-light);
  flex-shrink: 0;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/dashboard/src/index.css
git commit -m "feat(lucia): AmpscriptSidebar CSS"
```

---

## Task 6: i18n — claves nuevas

**Files:**
- Modify: `apps/dashboard/src/i18n/translations.js`

- [ ] **Step 1: Añadir sección ampscript en ES**

En `translations.js`, en el objeto `es`, después del bloque `studio:`, añadir:

```javascript
ampscript: {
  sidebarTitle: 'Variables del Email',
  fillBtn: 'Rellenar →',
  noVarsYet: 'Carga el template primero',
  incompleteVars: 'Faltan {n} variables',
},
```

- [ ] **Step 2: Añadir sección ampscript en EN**

En el objeto `en`, después del bloque `studio:`, añadir:

```javascript
ampscript: {
  sidebarTitle: 'Email Variables',
  fillBtn: 'Fill in →',
  noVarsYet: 'Load the template first',
  incompleteVars: '{n} variables remaining',
},
```

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/src/i18n/translations.js
git commit -m "feat(lucia): i18n keys for AmpscriptSidebar"
```

---

## Task 7: Smoke test manual del flujo completo

- [ ] **Step 1: Reiniciar servidor**

```bash
npm start
```

- [ ] **Step 2: Flujo completo**

1. Ir a `/app/workspace/agent/lucia`
2. Tab "Tickets" → click "Working on" en el ticket de Preflight Experience Reactivation
3. Verificar: se abre Content Studio → auto-navega a tab "Email Template"
4. Verificar: preview del email visible en el iframe izquierdo
5. Verificar: lista de bloques en el panel derecho (Block 2, Block 3, Block 4...)
6. Click en cualquier bloque → debe ir al tab "Chat" con el input pre-cargado
7. En el selector de variante: seleccionar "EN" + "Economy" → click "Rellenar →"
8. Verificar: el chat se pre-carga con "Fill all email variables for the Economy English variant..."
9. Enviar el mensaje → Lucía genera variables una a una
10. Verificar: en la sidebar derecha, cada variable aparece verde conforme se genera
11. Verificar: volver al tab "Template" → el iframe muestra el texto ya sustituido en el HTML

- [ ] **Step 3: Verificar que el servidor guardó las variables**

```bash
node -e "
const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://agentos:agentos2024secure@yamanote.proxy.rlwy.net:42145/agentos' });
pool.query(\"SELECT deliverables->>'variable_values' as vars FROM project_agent_sessions WHERE agent_id='lucia' ORDER BY updated_at DESC LIMIT 1\").then(r => {
  console.log(r.rows[0]?.vars);
  pool.end();
});
"
```
Esperado: JSON con las variables generadas por Lucía.

---

## Notas de implementación

- El `blockVarMap` se parsea client-side del HTML — no requiere nuevo endpoint de parseo
- `liveHtml` se recalcula via `useMemo` cada vez que llega un `VAR_UPDATE` — sin renders innecesarios
- Si `blockVarMap` está vacío (email sin `data-block-name`), se muestra `ContentBriefSidebar` como fallback
- El prompt auto-generado en `handleBlockClick('__fill_all__', {market, tier})` funciona con el sistema prompt que el backend ya inyecta en el chat de Lucía (vars AMPscript + contexto acumulado del pipeline)
