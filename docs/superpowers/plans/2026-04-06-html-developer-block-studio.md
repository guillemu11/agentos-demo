# HTML Developer — Block Studio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir un panel de bloques draggable (Block Studio) al Builder tab del HTML Developer view, con el mismo patrón de subtabs Chat | Blocks que ya usa Email Studio.

**Architecture:** Un solo archivo cambia: `HtmlDeveloperView.jsx`. Se añade estado `leftTab`, un switcher de subtabs, y se renderiza `EmailBlocksPanel` condicionalmente. El drag-to-canvas funciona a través del HTML5 drag API que ya manejan `EmailBlocksPanel` (drag source) y `EmailBuilderPreview` (drop zone vía `onBlockDrop`).

**Tech Stack:** React 19, CSS custom properties existentes (`.email-left-panel-tabs`, `.email-left-tab`), i18n keys existentes (`emailBlocks.tabChat`, `emailBlocks.tabBlocks`).

---

### Task 1: Añadir import + estado leftTab

**Files:**
- Modify: `apps/dashboard/src/components/agent-views/HtmlDeveloperView.jsx:13` (import)
- Modify: `apps/dashboard/src/components/agent-views/HtmlDeveloperView.jsx:54` (estado)

- [ ] **Step 1: Añadir el import de EmailBlocksPanel después de la línea 13**

El archivo actualmente tiene en línea 13:
```javascript
import EmailBuilderPreview from '../EmailBuilderPreview.jsx';
```

Añadir en la línea siguiente:
```javascript
import EmailBlocksPanel from '../EmailBlocksPanel.jsx';
```

- [ ] **Step 2: Añadir el estado leftTab después de la línea 54**

El archivo actualmente tiene en línea 54:
```javascript
const [chatInput, setChatInput] = useState('');
```

Añadir en la línea siguiente:
```javascript
const [leftTab, setLeftTab] = useState('chat'); // 'chat' | 'blocks'
```

- [ ] **Step 3: Verificar que el servidor de desarrollo compila sin errores**

```bash
# En la terminal, verificar que Vite no reporta errores de compilación
# El servidor ya debe estar corriendo en puerto 4000
```

Revisar la consola del servidor. No debe haber errores de `Cannot find module`.

- [ ] **Step 4: Commit**

```bash
git add apps/dashboard/src/components/agent-views/HtmlDeveloperView.jsx
git commit -m "feat(html-dev): import EmailBlocksPanel and add leftTab state"
```

---

### Task 2: Reemplazar el panel izquierdo del Builder tab

**Files:**
- Modify: `apps/dashboard/src/components/agent-views/HtmlDeveloperView.jsx:415-483` (builder tab content)

- [ ] **Step 1: Reemplazar el contenido del builder tab (líneas 415–483)**

Localizar este bloque (comienza en la línea 415):
```jsx
        {activeTab === 'builder' && (
          <div className="email-builder-split">
            <div className="email-builder-chat-panel">
              <AgentChatSwitcher
```

Reemplazar el bloque completo `{activeTab === 'builder' && (...)}` con:
```jsx
        {activeTab === 'builder' && (
          <div className="email-builder-split">
            <div className="email-builder-chat-panel" style={{ display: 'flex', flexDirection: 'column' }}>
              <div className="email-left-panel-tabs">
                <button
                  className={`email-left-tab ${leftTab === 'chat' ? 'active' : ''}`}
                  onClick={() => setLeftTab('chat')}
                >{t('emailBlocks.tabChat')}</button>
                <button
                  className={`email-left-tab ${leftTab === 'blocks' ? 'active' : ''}`}
                  onClick={() => setLeftTab('blocks')}
                >{t('emailBlocks.tabBlocks')}</button>
              </div>
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
                    addBlock(block.title, block.htmlSource, block.insertAfter);
                    setBuilderStatus(`${block.title} añadido`);
                    setTimeout(() => setBuilderStatus(''), 3000);
                  }}
                />
                {builderBlocks.length > 0 && (
                  <div className="email-block-order-panel">
                    <div className="email-block-order-header">
                      <span className="email-block-order-title">Estructura ({builderBlocks.length})</span>
                    </div>
                    {builderBlocks.map((block, i) => (
                      <div
                        key={block.id}
                        className={`email-block-order-item${dragOverIndex === i ? ' drag-over' : ''}`}
                        draggable
                        onDragStart={() => setDragIndex(i)}
                        onDragOver={e => { e.preventDefault(); setDragOverIndex(i); }}
                        onDragLeave={() => setDragOverIndex(null)}
                        onDrop={() => { reorderBlock(dragIndex, i); setDragIndex(null); setDragOverIndex(null); }}
                        onDragEnd={() => { setDragIndex(null); setDragOverIndex(null); }}
                      >
                        <span className="email-block-order-drag">⠿</span>
                        <span className="email-block-order-name" title={block.name}>{block.name}</span>
                        <button className="email-block-order-remove" onClick={() => removeBlock(i)} title="Eliminar">×</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {leftTab === 'blocks' && <EmailBlocksPanel />}
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
              onBlockClick={(blockName) => setChatInput(`[bloque: ${blockName}] `)}
            />
          </div>
        )}
```

- [ ] **Step 2: Verificar compilación sin errores**

Revisar la consola de Vite. No debe haber errores de JSX ni de props desconocidas.

- [ ] **Step 3: Verificación manual end-to-end**

1. Abrir el HTML Developer view de cualquier proyecto
2. Click en tab **Builder**
3. Verificar que aparece el switcher **Chat | Blocks** en el panel izquierdo
4. Click en **Blocks** — debe aparecer el panel de bloques con buscador, filtros y lista de bloques
5. Click en **Chat** — debe volver al AgentChatSwitcher sin perder el contenido del canvas
6. Arrastrar un bloque desde el panel al canvas derecho — el bloque debe aparecer en `EmailBuilderPreview`
7. Verificar que el status bar muestra `"[nombre] añadido"` brevemente
8. Confirmar que la tab top-level **Block Library** sigue funcionando igual (grid con detalle/source viewer)

- [ ] **Step 4: Commit final**

```bash
git add apps/dashboard/src/components/agent-views/HtmlDeveloperView.jsx
git commit -m "feat(html-dev): add Block Studio panel with Chat/Blocks subtabs in Builder"
```
