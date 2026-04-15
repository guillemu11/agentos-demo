# Block Studio: Intent Detection por Selección Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Usar la selección en canvas como señal de intención (bloque seleccionado → PATCH, nada seleccionado → NEW_BLOCK), reemplazando el sistema frágil de prefijos de texto.

**Architecture:** `selectedCanvasBlock` state en `BlockStudioPage` se pasa como `activeBlock` string al POST body del AI endpoint. El servidor inyecta instrucción PATCH/NEW_BLOCK en el system prompt basado en ese campo. `EmailBuilderPreview` gestiona click-to-select y click-en-vacío-para-deselect.

**Tech Stack:** React 19, Express 5, Anthropic SDK, CSS custom properties

---

## File Map

| Archivo | Cambio |
|---------|--------|
| `apps/dashboard/server.js` | Leer `req.body.activeBlock`; reemplazar detección por texto con instrucción basada en estado |
| `apps/dashboard/src/components/AgentChat.jsx` | Aceptar prop `activeBlock`; incluirlo en POST body |
| `apps/dashboard/src/components/agent-views/shared/AgentChatSwitcher.jsx` | Pasar `activeBlock` a `AgentChat` |
| `apps/dashboard/src/pages/BlockStudioPage.jsx` | Añadir `selectedCanvasBlock` state; auto-select en NEW_BLOCK; callbacks select/deselect |
| `apps/dashboard/src/components/EmailBuilderPreview.jsx` | Click en bloque → select; click en área vacía → deselect; visual selection |
| `apps/dashboard/src/index.css` | Estilos `.email-block-canvas-row.selected` |

---

### Task 1: server.js — activeBlock-based intent detection

**Files:**
- Modify: `apps/dashboard/server.js` (línea ~3007-3009)

- [ ] **Step 1: Localizar y reemplazar el Patch protocol en el system prompt**

Buscar esta sección (~línea 3007):
```js
**Patch protocol — when asked to MODIFY an existing block (message contains [bloque: X] or [block: X]):**
Output ONLY the updated block prefixed with the patch marker:
<!--PATCH:block-name-->[complete updated block HTML]` : '');
```

Reemplazar con:
```js
` : '')
            + (isEmailBuilder && req.body.activeBlock ? `

## Active Block: "${req.body.activeBlock}"
The user is working on this block. PATCH it with their request:
<!--PATCH:${req.body.activeBlock}-->[complete updated block HTML with data-block-name="${req.body.activeBlock}"]
Output ONLY the PATCH marker + HTML. No explanation, no other blocks.` : '')
            + (isEmailBuilder && !req.body.activeBlock ? `

## No active block selected
If the user asks to create or add a block, output ONLY:
<!--NEW_BLOCK:BlockName-->[complete block HTML starting with <table...>]
No explanation before or after.` : '');
```

**Nota:** La concatenación final cambia de `'' : '');` a `'' : '')` porque ahora hay dos condiciones adicionales que se concatenan al string. Asegúrate de que el resultado sea sintácticamente correcto — el `isEmailBuilder` block principal termina en `'' : '')` y las dos nuevas condiciones se añaden después con `+`.

- [ ] **Step 2: Verificar sintaxis del server.js**

```bash
node --check apps/dashboard/server.js
```
Expected: sin output (sin errores)

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/server.js
git commit -m "feat(block-studio): activeBlock param drives PATCH vs NEW_BLOCK intent in system prompt"
```

---

### Task 2: AgentChat.jsx — aceptar y enviar activeBlock

**Files:**
- Modify: `apps/dashboard/src/components/AgentChat.jsx`

- [ ] **Step 1: Añadir `activeBlock` a la destructuración de props**

En la línea 13, cambiar:
```js
export default function AgentChat({ agentId, agentName, agentAvatar, externalInput, onExternalInputConsumed, onHtmlGenerated, onHtmlPatched, onHtmlBlock, currentHtml, canvasBlocks }) {
```
Por:
```js
export default function AgentChat({ agentId, agentName, agentAvatar, externalInput, onExternalInputConsumed, onHtmlGenerated, onHtmlPatched, onHtmlBlock, currentHtml, canvasBlocks, activeBlock }) {
```

- [ ] **Step 2: Incluir `activeBlock` en el POST body**

En `sendMessage()`, localizar el `JSON.stringify` del fetch (~línea 110-114):
```js
body: JSON.stringify({
    message: msg,
    ...(canvasBlocks?.length > 0 && { canvasBlocks: canvasBlocks.map(b => b.name) }),
}),
```
Cambiar por:
```js
body: JSON.stringify({
    message: msg,
    ...(activeBlock && { activeBlock }),
    ...(canvasBlocks?.length > 0 && { canvasBlocks: canvasBlocks.map(b => b.name) }),
}),
```

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/src/components/AgentChat.jsx
git commit -m "feat(block-studio): pass activeBlock in POST body for intent detection"
```

---

### Task 3: AgentChatSwitcher.jsx — pasar activeBlock a AgentChat

**Files:**
- Modify: `apps/dashboard/src/components/agent-views/shared/AgentChatSwitcher.jsx`

- [ ] **Step 1: Añadir `activeBlock` a la destructuración de props del componente**

En la línea 7, cambiar:
```js
export default function AgentChatSwitcher({ agent, selectedTicket, pipelineData, currentSession, completedSessions, agents, onClearTicket, onHandoffRequest, externalInput, onExternalInputConsumed, onHtmlGenerated, onHtmlPatched, onHtmlBlock, currentHtml, canvasBlocks }) {
```
Por:
```js
export default function AgentChatSwitcher({ agent, selectedTicket, pipelineData, currentSession, completedSessions, agents, onClearTicket, onHandoffRequest, externalInput, onExternalInputConsumed, onHtmlGenerated, onHtmlPatched, onHtmlBlock, currentHtml, canvasBlocks, activeBlock }) {
```

- [ ] **Step 2: Pasar `activeBlock` al `<AgentChat>` en modo normal**

Localizar el return del modo normal (~línea 72-83) y añadir `activeBlock`:
```jsx
return (
    <AgentChat
        agentId={agent.id}
        agentName={agent.name}
        agentAvatar={agent.avatar}
        externalInput={externalInput}
        onExternalInputConsumed={onExternalInputConsumed}
        onHtmlGenerated={onHtmlGenerated}
        onHtmlPatched={onHtmlPatched}
        onHtmlBlock={onHtmlBlock}
        currentHtml={currentHtml}
        canvasBlocks={canvasBlocks}
        activeBlock={activeBlock}
    />
);
```

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/src/components/agent-views/shared/AgentChatSwitcher.jsx
git commit -m "feat(block-studio): thread activeBlock prop through AgentChatSwitcher"
```

---

### Task 4: BlockStudioPage.jsx — selectedCanvasBlock state

**Files:**
- Modify: `apps/dashboard/src/pages/BlockStudioPage.jsx`

- [ ] **Step 1: Añadir `selectedCanvasBlock` al estado**

Después de la línea `const [chatInput, setChatInput] = useState('');` (~línea 42), añadir:
```js
const [selectedCanvasBlock, setSelectedCanvasBlock] = useState(null); // { id, name, html } | null
```

- [ ] **Step 2: Auto-seleccionar tras NEW_BLOCK en `onHtmlBlock`**

Localizar el callback `onHtmlBlock` en el `<AgentChatSwitcher>` (~línea 239-243):
```jsx
onHtmlBlock={(block) => {
    addBlock(block.title, block.htmlSource);
    setBuilderStatus(`${block.title} añadido`);
    setTimeout(() => setBuilderStatus(''), 3000);
}}
```
Reemplazar con:
```jsx
onHtmlBlock={(block) => {
    const id = Date.now() + Math.random();
    setBuilderBlocks(prev => [...prev, { id, name: block.title, html: block.htmlSource }]);
    setAiHtml('');
    setSelectedCanvasBlock({ id, name: block.title, html: block.htmlSource });
    setBuilderStatus(`${block.title} añadido`);
    setTimeout(() => setBuilderStatus(''), 3000);
}}
```
**Nota:** Duplicamos la lógica de `addBlock` para capturar el `id` y poder auto-seleccionar. La función `addBlock` existente no retorna el id.

- [ ] **Step 3: Deseleccionar si el bloque seleccionado se elimina**

Localizar la función `removeBlock` (~línea 104):
```js
const removeBlock = (i) => setBuilderBlocks(prev => prev.filter((_, idx) => idx !== i));
```
Reemplazar con:
```js
const removeBlock = (i) => {
    setBuilderBlocks(prev => {
        const block = prev[i];
        if (block && selectedCanvasBlock?.id === block.id) setSelectedCanvasBlock(null);
        return prev.filter((_, idx) => idx !== i);
    });
};
```

- [ ] **Step 4: Pasar `selectedCanvasBlock`, callbacks y `activeBlock` al canvas y al chat**

En el `<EmailBuilderPreview>` (~línea 247-261), añadir props de selección:
```jsx
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
    onBlockClick={(blockName) => { setLeftTab('chat'); }}
    onBlockSelect={(block) => { setSelectedCanvasBlock(block); setLeftTab('chat'); }}
    onBlockDeselect={() => setSelectedCanvasBlock(null)}
    selectedCanvasBlock={selectedCanvasBlock}
/>
```

En el `<AgentChatSwitcher>` (~línea 214), añadir `activeBlock`:
```jsx
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
    currentHtml={builderHtml}
    activeBlock={selectedCanvasBlock?.name || null}
    onHtmlGenerated={(html) => {
        setAiHtml(mergeAiHtmlIntoTemplate(templateHtml, html));
        setBuilderBlocks([]);
        setPatchedBlock(null);
        setSelectedCanvasBlock(null);
        setBuilderStatus('Email generado');
        setTimeout(() => setBuilderStatus(''), 3000);
    }}
    onHtmlPatched={(blockName, html) => {
        setBuilderBlocks([]);
        setAiHtml(html);
        setPatchedBlock(blockName);
        setBuilderStatus(`${blockName} actualizado`);
        setTimeout(() => { setPatchedBlock(null); setBuilderStatus(''); }, 2000);
    }}
    canvasBlocks={builderBlocks}
    onHtmlBlock={(block) => {
        const id = Date.now() + Math.random();
        setBuilderBlocks(prev => [...prev, { id, name: block.title, html: block.htmlSource }]);
        setAiHtml('');
        setSelectedCanvasBlock({ id, name: block.title, html: block.htmlSource });
        setBuilderStatus(`${block.title} añadido`);
        setTimeout(() => setBuilderStatus(''), 3000);
    }}
/>
```

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/src/pages/BlockStudioPage.jsx
git commit -m "feat(block-studio): selectedCanvasBlock state drives activeBlock for AI intent"
```

---

### Task 5: EmailBuilderPreview.jsx — click-to-select y visual

**Files:**
- Modify: `apps/dashboard/src/components/EmailBuilderPreview.jsx`

- [ ] **Step 1: Añadir `onBlockSelect`, `onBlockDeselect`, `selectedCanvasBlock` a los props**

En la línea 35, cambiar:
```js
export default function EmailBuilderPreview({ html, saveHtml, blocks, templateHtml, onReorderBlocks, onRemoveBlock, patchedBlock, statusMessage, onBlockClick, onBlockDrop, projectId, contentVariants, contentReady, onTemplateSaved, editingTemplate }) {
```
Por:
```js
export default function EmailBuilderPreview({ html, saveHtml, blocks, templateHtml, onReorderBlocks, onRemoveBlock, patchedBlock, statusMessage, onBlockClick, onBlockDrop, projectId, contentVariants, contentReady, onTemplateSaved, editingTemplate, onBlockSelect, onBlockDeselect, selectedCanvasBlock }) {
```

- [ ] **Step 2: Añadir click-to-select en cada bloque del canvas y click-en-vacío para deselect**

Localizar el `BlocksCanvas` (~línea 183). En el wrapper `<div className="email-blocks-canvas">`, añadir el handler de click-en-vacío en el wrapper exterior. En cada `email-block-canvas-row`, añadir click que llama `onBlockSelect`.

Reemplazar la definición de `BlocksCanvas` completa:
```jsx
const BlocksCanvas = blocks && blocks.length > 0 ? (
    <div className="email-preview-body email-blocks-canvas-body"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={e => {
        const blockHtml = e.dataTransfer.getData('text/html');
        const blockName = e.dataTransfer.getData('text/plain');
        if (blockHtml && onBlockDrop && !canvasDragIndex) onBlockDrop({ name: blockName, html: blockHtml });
        setIsDragOver(false);
      }}
      onClick={(e) => {
        // Click on empty canvas area → deselect
        if (e.target === e.currentTarget && onBlockDeselect) onBlockDeselect();
      }}
    >
      {isDragOver && canvasDragIndex === null && (
        <div className="email-preview-drop-overlay">{t('emailBlocks.dropHere')}</div>
      )}
      <div className={`email-preview-iframe-wrapper ${viewMode}`}>
      <div
        className="email-blocks-canvas"
        onClick={(e) => {
          // Click on canvas background (not a block row) → deselect
          if (e.target === e.currentTarget && onBlockDeselect) onBlockDeselect();
        }}
      >
        {blocks.map((block, i) => (
          <div
            key={block.id}
            className={`email-block-canvas-row${canvasDragOver === i ? ' canvas-drag-over' : ''}${canvasDragIndex === i ? ' canvas-dragging' : ''}${selectedCanvasBlock?.id === block.id ? ' selected' : ''}`}
            draggable
            onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; setCanvasDragIndex(i); }}
            onDragOver={e => { e.preventDefault(); e.stopPropagation(); setCanvasDragOver(i); }}
            onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setCanvasDragOver(null); }}
            onDrop={e => {
              e.preventDefault(); e.stopPropagation();
              if (canvasDragIndex !== null && onReorderBlocks) onReorderBlocks(canvasDragIndex, i);
              setCanvasDragIndex(null); setCanvasDragOver(null);
            }}
            onDragEnd={() => { setCanvasDragIndex(null); setCanvasDragOver(null); }}
            onClick={(e) => {
              e.stopPropagation();
              if (onBlockSelect) onBlockSelect(block);
              if (onBlockClick) onBlockClick(block.name);
            }}
          >
            <BlockIframe html={block.html} blockName={block.name || ''} templateHead={templateHead} />
            <div className="email-block-canvas-overlay">
              <span className="email-block-canvas-drag-hint">⠿ {block.name}</span>
              {onRemoveBlock && (
                <button className="email-block-canvas-remove" onClick={(e) => { e.stopPropagation(); onRemoveBlock(i); }} title="Eliminar bloque">×</button>
              )}
            </div>
          </div>
        ))}
      </div>
      </div>
    </div>
  ) : null;
```

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/src/components/EmailBuilderPreview.jsx
git commit -m "feat(block-studio): click-to-select block, click empty area to deselect"
```

---

### Task 6: index.css — estilos de bloque seleccionado

**Files:**
- Modify: `apps/dashboard/src/index.css`

- [ ] **Step 1: Añadir estilos de selección**

Buscar la clase `.email-block-canvas-row` en index.css y añadir después:
```css
.email-block-canvas-row.selected {
  box-shadow: 0 0 0 2px var(--primary);
  border-radius: 2px;
}

.email-block-canvas-row.selected .email-block-canvas-overlay {
  border-color: var(--primary);
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/dashboard/src/index.css
git commit -m "feat(block-studio): visual selection indicator for active block"
```

---

## Verificación end-to-end

1. Abrir Block Studio (Builder tab, Chat subtab)
2. Escribir "create a survey block with NPS 0-10" → AI crea NEW_BLOCK → bloque aparece en canvas **con borde azul (seleccionado)**
3. Escribir "add some color to the numbers" → AI hace PATCH del survey block (no crea uno nuevo)
4. Click en área vacía del canvas → borde azul desaparece
5. Escribir "create a hero block" → AI crea NEW_BLOCK (sin bloque activo)
6. Click en el survey block → se selecciona (borde azul)
7. Escribir "make the text bigger" → AI patchea el survey block
