# Block Studio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Crear una página full-screen `BlockStudioPage.jsx` accesible desde el HTML Developer agent view con 2 tabs — Builder (chat + canvas) y Blocks (block manager con selección → añadir al canvas o usar como base).

**Architecture:** Nueva página `BlockStudioPage.jsx` que sigue el patrón de `EmailStudioPage.jsx`. Reutiliza `EmailBlocksPanel`, `EmailBuilderPreview`, `AgentChatSwitcher` y utilities de `emailTemplate.js` sin cambios. El Block Manager vive dentro de `BlockStudioPage` como sección condicional — no un componente separado (YAGNI). Se añade tab en `HtmlDeveloperView` y ruta en `main.jsx`.

**Tech Stack:** React 19, CSS custom properties (variables en `index.css`), i18n custom (`translations.js`), HTML5 drag API.

---

## File Map

| Archivo | Acción | Responsabilidad |
|---------|--------|-----------------|
| `apps/dashboard/src/pages/BlockStudioPage.jsx` | Crear | Página completa: estado, tabs Builder + Blocks |
| `apps/dashboard/src/main.jsx` | Modificar | Añadir import + ruta `/workspace/agent/html-developer/block-studio` |
| `apps/dashboard/src/components/agent-views/HtmlDeveloperView.jsx` | Modificar | Añadir tab `⊞ Block Studio` con `isStudio: true` |
| `apps/dashboard/src/i18n/translations.js` | Modificar | Añadir claves `blockStudio.*` en ES y EN |
| `apps/dashboard/src/index.css` | Modificar | Estilos del Block Manager (grid, panel lateral, botones) |

---

### Task 1: i18n + CSS base

**Files:**
- Modify: `apps/dashboard/src/i18n/translations.js`
- Modify: `apps/dashboard/src/index.css`

- [ ] **Step 1: Añadir claves i18n en español**

En `translations.js`, dentro del objeto `es` (busca `studio:` en la sección `es`), añadir el bloque `blockStudio` junto a `studio`:

```javascript
    blockStudio: {
      title: 'Block Studio',
      tabBuilder: 'Builder',
      tabBlocks: 'Blocks',
      addToCanvas: 'Añadir al canvas',
      addToCanvasHint: 'Lo añade como bloque nuevo al final',
      useAsBase: 'Usar como base',
      useAsBaseHint: 'Abre en Builder con chat listo para modificarlo',
      reingest: 'Re-ingest',
      reingestConfirm: '¿Re-indexar todos los bloques? Esto puede tardar unos minutos.',
      reingesting: 'Indexando...',
      reingestDone: 'Bloques indexados correctamente',
      reingestError: 'Error al indexar bloques',
      noBlockSelected: 'Selecciona un bloque para ver opciones',
    },
```

- [ ] **Step 2: Añadir claves i18n en inglés**

En el mismo archivo, dentro del objeto `en`, añadir el bloque `blockStudio` junto a `studio`:

```javascript
    blockStudio: {
      title: 'Block Studio',
      tabBuilder: 'Builder',
      tabBlocks: 'Blocks',
      addToCanvas: 'Add to canvas',
      addToCanvasHint: 'Adds it as a new block at the end',
      useAsBase: 'Use as base',
      useAsBaseHint: 'Opens in Builder with chat ready to modify it',
      reingest: 'Re-ingest',
      reingestConfirm: 'Re-index all blocks? This may take a few minutes.',
      reingesting: 'Indexing...',
      reingestDone: 'Blocks indexed successfully',
      reingestError: 'Error indexing blocks',
      noBlockSelected: 'Select a block to see options',
    },
```

- [ ] **Step 3: Añadir estilos del Block Manager en `index.css`**

Al final del archivo `apps/dashboard/src/index.css`, añadir:

```css
/* ── Block Studio ──────────────────────────────────── */
.block-studio-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--bg-primary);
  color: var(--text-primary);
  overflow: hidden;
}

.block-studio-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* Block Manager (Blocks tab) */
.block-manager-layout {
  flex: 1;
  display: flex;
  min-height: 0;
  overflow: hidden;
}

.block-manager-grid-panel {
  display: flex;
  flex-direction: column;
  width: 55%;
  border-right: 1px solid var(--border-light);
  min-height: 0;
}

.block-manager-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--border-light);
  flex-shrink: 0;
}

.block-manager-search {
  flex: 1;
  background: var(--bg-secondary);
  border: 1px solid var(--border-light);
  border-radius: 8px;
  padding: 6px 10px;
  font-size: 0.85rem;
  color: var(--text-primary);
  outline: none;
}

.block-manager-search:focus {
  border-color: var(--primary);
}

.block-manager-filters {
  display: flex;
  gap: 6px;
  padding: 8px 14px;
  flex-wrap: wrap;
  border-bottom: 1px solid var(--border-light);
  flex-shrink: 0;
}

.block-manager-filter-chip {
  background: var(--bg-secondary);
  border: 1px solid var(--border-light);
  border-radius: 12px;
  padding: 3px 10px;
  font-size: 0.75rem;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s;
}

.block-manager-filter-chip:hover { color: var(--text-primary); }

.block-manager-filter-chip.active {
  background: var(--primary);
  color: #fff;
  border-color: var(--primary);
}

.block-manager-grid {
  flex: 1;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  padding: 12px 14px;
  overflow-y: auto;
  align-content: flex-start;
}

.block-manager-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border-light);
  border-radius: 8px;
  padding: 8px;
  width: 130px;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}

.block-manager-card:hover {
  border-color: var(--primary);
}

.block-manager-card.selected {
  border: 2px solid var(--primary);
  background: var(--bg-hover, rgba(124,58,237,0.08));
}

.block-manager-thumb {
  width: 100%;
  height: 60px;
  background: var(--bg-primary);
  border-radius: 4px;
  margin-bottom: 6px;
  overflow: hidden;
  border: none;
}

.block-manager-card-name {
  font-size: 0.8rem;
  color: var(--text-primary);
  font-weight: 500;
  margin-bottom: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.block-manager-card-cat {
  font-size: 0.7rem;
  color: var(--primary);
}

/* Block Manager — action panel (right side) */
.block-manager-action-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: var(--bg-secondary);
  min-height: 0;
}

.block-manager-preview {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  border-bottom: 1px solid var(--border-light);
  background: var(--bg-primary);
}

.block-manager-preview-iframe {
  width: 100%;
  height: 100%;
  border: none;
}

.block-manager-meta {
  padding: 12px 14px;
  border-bottom: 1px solid var(--border-light);
  flex-shrink: 0;
}

.block-manager-meta-name {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 3px;
}

.block-manager-meta-cat {
  font-size: 0.78rem;
  color: var(--primary);
  margin-bottom: 5px;
}

.block-manager-meta-desc {
  font-size: 0.75rem;
  color: var(--text-secondary);
  line-height: 1.4;
}

.block-manager-actions {
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex-shrink: 0;
}

.block-manager-action-btn {
  background: var(--primary);
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 9px 12px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  text-align: left;
  transition: opacity 0.15s;
}

.block-manager-action-btn:hover { opacity: 0.88; }

.block-manager-action-btn.secondary {
  background: transparent;
  color: var(--primary);
  border: 1px solid var(--primary);
}

.block-manager-action-hint {
  font-size: 0.7rem;
  font-weight: 400;
  opacity: 0.75;
  margin-top: 2px;
}

.block-manager-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  font-size: 0.85rem;
  padding: 20px;
  text-align: center;
}

.block-studio-reingest-btn {
  background: var(--bg-secondary);
  border: 1px solid var(--border-light);
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 0.78rem;
  color: var(--text-secondary);
  cursor: pointer;
  white-space: nowrap;
}

.block-studio-reingest-btn:hover { color: var(--text-primary); border-color: var(--primary); }
.block-studio-reingest-btn:disabled { opacity: 0.5; cursor: not-allowed; }
```

- [ ] **Step 4: Commit**

```bash
git add apps/dashboard/src/i18n/translations.js apps/dashboard/src/index.css
git commit -m "feat(block-studio): add i18n keys and Block Manager CSS"
```

---

### Task 2: Crear BlockStudioPage.jsx

**Files:**
- Create: `apps/dashboard/src/pages/BlockStudioPage.jsx`

- [ ] **Step 1: Crear el archivo con el esqueleto completo**

Crear `apps/dashboard/src/pages/BlockStudioPage.jsx` con el siguiente contenido:

```jsx
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { useAgentPipelineSession } from '../hooks/useAgentPipelineSession.js';
import AgentChatSwitcher from '../components/agent-views/shared/AgentChatSwitcher.jsx';
import EmailBuilderPreview from '../components/EmailBuilderPreview.jsx';
import EmailBlocksPanel from '../components/EmailBlocksPanel.jsx';
import { fetchEmailTemplate, injectIntoSlot, mergeAiHtmlIntoTemplate } from '../utils/emailTemplate.js';

const API_URL = import.meta.env.VITE_API_URL || '/api';
const AGENT_ID = 'html-developer';

const BLOCK_CATEGORIES = ['All', 'Header', 'Hero', 'Content', 'CTA', 'Footer'];

const TYPE_TO_CATEGORY = {
  header: 'Header', preheader: 'Header', 'section-heading': 'Header',
  hero: 'Hero',
  'body-copy': 'Content', 'product-cards': 'Content', 'partner-module': 'Content', 'info-card': 'Content',
  cta: 'CTA',
  footer: 'Footer', terms: 'Footer',
};

export default function BlockStudioPage() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const pipeline = useAgentPipelineSession(AGENT_ID);

  // Page state
  const [agent, setAgent] = useState(null);
  const [activeTab, setActiveTab] = useState('builder'); // 'builder' | 'blocks'

  // Blocks data (shared across tabs)
  const [ragBlocks, setRagBlocks] = useState(null); // null = loading

  // Builder state
  const [builderBlocks, setBuilderBlocks] = useState([]); // [{id, name, html}]
  const [aiHtml, setAiHtml] = useState('');
  const [templateHtml, setTemplateHtml] = useState('');
  const [patchedBlock, setPatchedBlock] = useState(null);
  const [builderStatus, setBuilderStatus] = useState('');
  const [leftTab, setLeftTab] = useState('blocks'); // 'blocks' | 'chat' — blocks by default
  const [chatInput, setChatInput] = useState('');

  // Block Manager state
  const [selectedBlock, setSelectedBlock] = useState(null);
  const [blockFilter, setBlockFilter] = useState('All');
  const [blockSearch, setBlockSearch] = useState('');
  const [reingesting, setReingesting] = useState(false);
  const [reingestMsg, setReingestMsg] = useState('');

  // Load agent
  useEffect(() => {
    fetch(`${API_URL}/agents/${AGENT_ID}`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setAgent(data); })
      .catch(() => {});
  }, []);

  // Load template
  useEffect(() => {
    fetchEmailTemplate().then(html => { if (html) setTemplateHtml(html); });
  }, []);

  // Load blocks from KB
  useEffect(() => {
    fetch(`${API_URL}/knowledge/email-blocks`, { credentials: 'include' })
      .then(r => r.json())
      .then(result => {
        setRagBlocks((result.blocks || []).map(b => ({
          id: b.id,
          name: b.title,
          category: TYPE_TO_CATEGORY[b.category] || 'Content',
          type: b.category,
          description: b.description || '',
          html: b.html,
        })));
      })
      .catch(() => setRagBlocks([]));
  }, []);

  // Computed builder HTML
  const builderHtml = useMemo(() => {
    if (aiHtml) return aiHtml;
    const blocksHtml = builderBlocks.map(b => b.html).join('');
    if (!builderBlocks.length) return templateHtml || '';
    if (!templateHtml) return blocksHtml;
    return injectIntoSlot(templateHtml, blocksHtml);
  }, [builderBlocks, templateHtml, aiHtml]);

  // Block management
  const addBlock = (name, html) => {
    setBuilderBlocks(prev => [...prev, { id: Date.now() + Math.random(), name, html }]);
    setAiHtml('');
  };
  const reorderBlock = (from, to) => {
    if (from === null || from === to) return;
    setBuilderBlocks(prev => {
      const a = [...prev];
      const [item] = a.splice(from, 1);
      a.splice(to, 0, item);
      return a;
    });
  };
  const removeBlock = (i) => setBuilderBlocks(prev => prev.filter((_, idx) => idx !== i));

  // Block Manager: "Añadir al canvas"
  const handleAddToCanvas = (block) => {
    addBlock(block.name, block.html);
    setBuilderStatus(`${block.name} añadido`);
    setTimeout(() => setBuilderStatus(''), 3000);
    setActiveTab('builder');
    setLeftTab('blocks');
  };

  // Block Manager: "Usar como base"
  const handleUseAsBase = (block) => {
    addBlock(block.name, block.html);
    setChatInput(`[base: ${block.name}] `);
    setBuilderStatus(`${block.name} como base`);
    setTimeout(() => setBuilderStatus(''), 3000);
    setActiveTab('builder');
    setLeftTab('chat');
  };

  // Re-ingest blocks
  const handleReingest = async () => {
    if (!window.confirm(t('blockStudio.reingestConfirm'))) return;
    setReingesting(true);
    setReingestMsg('');
    try {
      const res = await fetch(`${API_URL}/knowledge/ingest-email-blocks`, {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        setReingestMsg(t('blockStudio.reingestDone'));
        // Reload blocks after reingest
        const r = await fetch(`${API_URL}/knowledge/email-blocks`, { credentials: 'include' });
        const result = await r.json();
        setRagBlocks((result.blocks || []).map(b => ({
          id: b.id,
          name: b.title,
          category: TYPE_TO_CATEGORY[b.category] || 'Content',
          type: b.category,
          description: b.description || '',
          html: b.html,
        })));
      } else {
        setReingestMsg(t('blockStudio.reingestError'));
      }
    } catch {
      setReingestMsg(t('blockStudio.reingestError'));
    }
    setReingesting(false);
    setTimeout(() => setReingestMsg(''), 4000);
  };

  // Filtered blocks for Block Manager
  const filteredBlocks = useMemo(() => {
    const blocks = ragBlocks || [];
    return blocks.filter(b => {
      const matchCat = blockFilter === 'All' || b.category === blockFilter;
      const matchSearch = !blockSearch || b.name.toLowerCase().includes(blockSearch.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [ragBlocks, blockFilter, blockSearch]);

  if (!agent) return <div className="studio-page studio-loading">Loading...</div>;

  return (
    <div className="block-studio-page">
      {/* Top bar */}
      <div className="studio-topbar">
        <button className="studio-back-btn" onClick={() => navigate('/app/workspace/agent/html-developer')}>
          {t('studio.backToAgent')}
        </button>
        <span className="studio-campaign-badge">{t('blockStudio.title')}</span>
        <div style={{ flex: 1 }} />
      </div>

      {/* Tab strip */}
      <div className="studio-tabs-bar">
        <button
          className={`studio-tab ${activeTab === 'builder' ? 'active' : ''}`}
          onClick={() => setActiveTab('builder')}
        >{t('blockStudio.tabBuilder')}</button>
        <button
          className={`studio-tab ${activeTab === 'blocks' ? 'active' : ''}`}
          onClick={() => setActiveTab('blocks')}
        >
          {t('blockStudio.tabBlocks')}
          {ragBlocks !== null && <span className="studio-tab-count">{ragBlocks.length}</span>}
        </button>
      </div>

      {/* Body */}
      <div className="studio-body">

        {/* ── BUILDER TAB ── */}
        {activeTab === 'builder' && (
          <div className="email-studio-split">
            <div className="email-builder-chat-panel" style={{ display: 'flex', flexDirection: 'column' }}>
              <div className="email-left-panel-tabs">
                <button
                  className={`email-left-tab ${leftTab === 'blocks' ? 'active' : ''}`}
                  onClick={() => setLeftTab('blocks')}
                >{t('emailBlocks.tabBlocks')}</button>
                <button
                  className={`email-left-tab ${leftTab === 'chat' ? 'active' : ''}`}
                  onClick={() => setLeftTab('chat')}
                >{t('emailBlocks.tabChat')}</button>
              </div>
              {leftTab === 'blocks' && <EmailBlocksPanel blocks={ragBlocks} />}
              <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: leftTab === 'chat' ? 'flex' : 'none', flexDirection: 'column' }}>
                <AgentChatSwitcher
                  agent={agent}
                  selectedTicket={pipeline.selectedTicket}
                  pipelineData={pipeline.pipelineData}
                  currentSession={pipeline.currentSession}
                  completedSessions={pipeline.completedSessions}
                  agents={pipeline.agents}
                  onClearTicket={pipeline.clearTicket}
                  onHandoffRequest={pipeline.setHandoffSession}
                  externalInput={chatInput}
                  onExternalInputConsumed={() => setChatInput('')}
                  onHtmlGenerated={(html) => {
                    setAiHtml(mergeAiHtmlIntoTemplate(templateHtml, html));
                    setBuilderBlocks([]);
                    setPatchedBlock(null);
                    setBuilderStatus('Email generado');
                    setTimeout(() => setBuilderStatus(''), 3000);
                  }}
                  onHtmlPatched={(blockName, html) => {
                    setAiHtml(html);
                    setPatchedBlock(blockName);
                    setBuilderStatus(`${blockName} actualizado`);
                    setTimeout(() => { setPatchedBlock(null); setBuilderStatus(''); }, 2000);
                  }}
                  canvasBlocks={builderBlocks}
                  onHtmlBlock={(block) => {
                    addBlock(block.title, block.htmlSource);
                    setBuilderStatus(`${block.title} añadido`);
                    setTimeout(() => setBuilderStatus(''), 3000);
                  }}
                />
              </div>
            </div>
            <EmailBuilderPreview
              html={builderBlocks.length ? null : builderHtml}
              blocks={builderBlocks.length ? builderBlocks : null}
              templateHtml={templateHtml}
              onReorderBlocks={reorderBlock}
              onRemoveBlock={removeBlock}
              onBlockDrop={(block) => {
                addBlock(block.name, block.html);
                setBuilderStatus(`${block.name} añadido`);
                setTimeout(() => setBuilderStatus(''), 3000);
              }}
              patchedBlock={patchedBlock}
              statusMessage={builderStatus}
              onBlockClick={(blockName) => { setChatInput(`[bloque: ${blockName}] `); setLeftTab('chat'); }}
            />
          </div>
        )}

        {/* ── BLOCKS TAB ── */}
        {activeTab === 'blocks' && (
          <div className="block-manager-layout">
            {/* Left: grid */}
            <div className="block-manager-grid-panel">
              <div className="block-manager-toolbar">
                <input
                  className="block-manager-search"
                  type="text"
                  placeholder="🔍 Buscar bloques..."
                  value={blockSearch}
                  onChange={e => setBlockSearch(e.target.value)}
                />
                <button
                  className="block-studio-reingest-btn"
                  onClick={handleReingest}
                  disabled={reingesting}
                >
                  {reingesting ? t('blockStudio.reingesting') : t('blockStudio.reingest')}
                </button>
                {reingestMsg && <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{reingestMsg}</span>}
              </div>
              <div className="block-manager-filters">
                {BLOCK_CATEGORIES.map(cat => (
                  <button
                    key={cat}
                    className={`block-manager-filter-chip ${blockFilter === cat ? 'active' : ''}`}
                    onClick={() => setBlockFilter(cat)}
                  >{cat}</button>
                ))}
              </div>
              <div className="block-manager-grid">
                {ragBlocks === null && <div className="block-manager-empty">Cargando bloques...</div>}
                {ragBlocks !== null && filteredBlocks.length === 0 && (
                  <div className="block-manager-empty">No hay bloques que coincidan</div>
                )}
                {filteredBlocks.map(block => (
                  <div
                    key={block.id}
                    className={`block-manager-card ${selectedBlock?.id === block.id ? 'selected' : ''}`}
                    onClick={() => setSelectedBlock(block)}
                  >
                    {block.html ? (
                      <iframe
                        sandbox="allow-same-origin"
                        srcDoc={block.html}
                        title={block.name}
                        className="block-manager-thumb"
                        tabIndex={-1}
                      />
                    ) : (
                      <div className="block-manager-thumb" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                        {block.type}
                      </div>
                    )}
                    <div className="block-manager-card-name" title={block.name}>{block.name}</div>
                    <div className="block-manager-card-cat">{block.category}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: action panel */}
            <div className="block-manager-action-panel">
              {!selectedBlock ? (
                <div className="block-manager-empty">{t('blockStudio.noBlockSelected')}</div>
              ) : (
                <>
                  <div className="block-manager-preview">
                    {selectedBlock.html ? (
                      <iframe
                        sandbox="allow-same-origin"
                        srcDoc={selectedBlock.html}
                        title={selectedBlock.name}
                        className="block-manager-preview-iframe"
                      />
                    ) : (
                      <div className="block-manager-empty">{selectedBlock.type}</div>
                    )}
                  </div>
                  <div className="block-manager-meta">
                    <div className="block-manager-meta-name">{selectedBlock.name}</div>
                    <div className="block-manager-meta-cat">{selectedBlock.category} · {selectedBlock.type}</div>
                    {selectedBlock.description && (
                      <div className="block-manager-meta-desc">{selectedBlock.description}</div>
                    )}
                  </div>
                  <div className="block-manager-actions">
                    <button
                      className="block-manager-action-btn"
                      onClick={() => handleAddToCanvas(selectedBlock)}
                    >
                      ➕ {t('blockStudio.addToCanvas')}
                      <div className="block-manager-action-hint">{t('blockStudio.addToCanvasHint')}</div>
                    </button>
                    <button
                      className="block-manager-action-btn secondary"
                      onClick={() => handleUseAsBase(selectedBlock)}
                    >
                      ✏️ {t('blockStudio.useAsBase')}
                      <div className="block-manager-action-hint">{t('blockStudio.useAsBaseHint')}</div>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verificar que `EmailBlocksPanel` acepta prop `blocks`**

Leer `apps/dashboard/src/components/EmailBlocksPanel.jsx` y verificar si el componente acepta una prop `blocks` para evitar re-fetch. Si no la acepta (hace fetch interno), eliminar la prop `blocks={ragBlocks}` del JSX y dejarlo sin prop — el panel hará su propio fetch.

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/src/pages/BlockStudioPage.jsx
git commit -m "feat(block-studio): create BlockStudioPage with Builder and Block Manager tabs"
```

---

### Task 3: Registrar ruta en main.jsx

**Files:**
- Modify: `apps/dashboard/src/main.jsx`

- [ ] **Step 1: Añadir import de BlockStudioPage**

En `apps/dashboard/src/main.jsx`, después de la línea:
```javascript
import EmailStudioPage from './pages/EmailStudioPage.jsx';
```

Añadir:
```javascript
import BlockStudioPage from './pages/BlockStudioPage.jsx';
```

- [ ] **Step 2: Añadir la ruta**

En el mismo archivo, después de la línea:
```jsx
<Route path="/workspace/agent/html-developer/studio" element={<EmailStudioPage />} />
```

Añadir:
```jsx
<Route path="/workspace/agent/html-developer/block-studio" element={<BlockStudioPage />} />
```

- [ ] **Step 3: Verificar en browser**

Navegar manualmente a `http://localhost:4000/app/workspace/agent/html-developer/block-studio`. Debe mostrar la página Block Studio sin errores de consola.

- [ ] **Step 4: Commit**

```bash
git add apps/dashboard/src/main.jsx
git commit -m "feat(block-studio): register /block-studio route in main.jsx"
```

---

### Task 4: Añadir tab en HtmlDeveloperView

**Files:**
- Modify: `apps/dashboard/src/components/agent-views/HtmlDeveloperView.jsx`

- [ ] **Step 1: Añadir tab `⊞ Block Studio` en el array `tabs`**

En `HtmlDeveloperView.jsx`, localizar el array `tabs` (línea ~130):

```javascript
  const tabs = [
    { id: 'templates', label: 'Email Templates', icon: AgentTabIcons.templates },
    { id: 'tickets', label: t('tickets.tab'), icon: AgentTabIcons.tickets, count: pipeline.tickets.length, urgent: pipeline.hasUrgentTickets },
    { id: 'blocks', label: 'Block Library', icon: AgentTabIcons.blocks, count: blocksLoading ? null : blocks.length },
    { id: 'builder', label: t('studio.emailStudio'), icon: '✉️', isStudio: true },
    { id: 'chat', label: 'Chat', icon: AgentTabIcons.chat },
    { id: 'activity', label: 'Activity', icon: AgentTabIcons.activity },
    { id: 'settings', label: t('agentSettings.tab'), icon: AgentTabIcons.settings },
  ];
```

Reemplazar con (añade el tab de Block Studio después de Email Studio):

```javascript
  const tabs = [
    { id: 'templates', label: 'Email Templates', icon: AgentTabIcons.templates },
    { id: 'tickets', label: t('tickets.tab'), icon: AgentTabIcons.tickets, count: pipeline.tickets.length, urgent: pipeline.hasUrgentTickets },
    { id: 'blocks', label: 'Block Library', icon: AgentTabIcons.blocks, count: blocksLoading ? null : blocks.length },
    { id: 'builder', label: t('studio.emailStudio'), icon: '✉️', isStudio: true },
    { id: 'block-studio', label: t('blockStudio.title'), icon: '⊞', isStudio: true, studioPath: 'block-studio' },
    { id: 'chat', label: 'Chat', icon: AgentTabIcons.chat },
    { id: 'activity', label: 'Activity', icon: AgentTabIcons.activity },
    { id: 'settings', label: t('agentSettings.tab'), icon: AgentTabIcons.settings },
  ];
```

- [ ] **Step 2: Actualizar el handler del click para soportar `studioPath`**

Localizar el onClick de los tabs (línea ~296):

```javascript
onClick={() => {
  if (tab.isStudio) {
    const ticketId = pipeline.selectedTicket?.id;
    navigate(`/app/workspace/agent/html-developer/studio${ticketId ? `?ticketId=${ticketId}` : ''}`);
  } else {
    setActiveTab(tab.id);
  }
}}
```

Reemplazar con:

```javascript
onClick={() => {
  if (tab.isStudio) {
    const ticketId = pipeline.selectedTicket?.id;
    const path = tab.studioPath || 'studio';
    const query = ticketId && path === 'studio' ? `?ticketId=${ticketId}` : '';
    navigate(`/app/workspace/agent/html-developer/${path}${query}`);
  } else {
    setActiveTab(tab.id);
  }
}}
```

- [ ] **Step 3: Verificar en browser**

1. Ir al HTML Developer agent view
2. Verificar que aparece la tab `⊞ Block Studio` junto a `✉️ Email Studio`
3. Hacer click en `⊞ Block Studio` → debe navegar a `/app/workspace/agent/html-developer/block-studio`
4. Verificar que `✉️ Email Studio` sigue funcionando igual

- [ ] **Step 4: Commit**

```bash
git add apps/dashboard/src/components/agent-views/HtmlDeveloperView.jsx
git commit -m "feat(block-studio): add Block Studio tab to HtmlDeveloperView"
```

---

### Task 5: Verificación end-to-end

**Files:** ninguno (solo verificación manual)

- [ ] **Step 1: Verificar acceso desde agent view**

1. Abrir `http://localhost:4000`
2. Navegar a cualquier proyecto → HTML Developer agent
3. Verificar que aparece la tab `⊞ Block Studio`
4. Hacer click → navega a Block Studio

- [ ] **Step 2: Verificar Builder tab**

1. En Block Studio, verificar que el tab activo por defecto es **Builder**
2. El panel izquierdo muestra subtab **Blocks** activo por defecto con el panel de bloques
3. Hacer click en subtab **Chat** → aparece el AgentChatSwitcher
4. Arrastrar un bloque desde el panel al canvas → bloque aparece en `EmailBuilderPreview`
5. Status bar muestra `"[nombre] añadido"` brevemente

- [ ] **Step 3: Verificar Blocks tab**

1. Hacer click en tab **Blocks** → aparece el grid de thumbnails
2. Filtros (All, Hero, CTA...) funcionan correctamente
3. Búsqueda filtra por nombre
4. Click en un bloque → panel derecho muestra preview + metadata + botones
5. **➕ Añadir al canvas** → navega al Builder tab, bloque aparece en canvas
6. **✏️ Usar como base** → navega al Builder tab, subtab Chat activo, input pre-llenado con `[base: nombre]`
7. **↺ Re-ingest** → muestra confirmación, llama API, muestra mensaje de resultado

- [ ] **Step 4: Verificar que Email Studio sigue funcionando**

Hacer click en `✉️ Email Studio` desde el agent view → navega a la URL correcta con ticketId si hay ticket seleccionado.
