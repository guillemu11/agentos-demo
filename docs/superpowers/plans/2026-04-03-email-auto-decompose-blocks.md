# Email Auto-Decompose Blocks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cuando el agente genera un email completo, descomponerlo automáticamente en bloques individuales editables en el BlocksCanvas, con naming async por Claude Haiku.

**Architecture:** String-based parser extrae `<table>` de primer nivel del slot del template. Los bloques se inyectan en `blocks[]` con `data-block-name` para que `applyPatch` funcione en patches posteriores. `currentHtml` prop mantiene `currentHtmlRef` de AgentChat en sync con el estado reordenado. Claude Haiku nombra los bloques en background sin bloquear el render.

**Tech Stack:** React 19, Express 5, Anthropic SDK (`claude-haiku-4-5-20251001`), CSS custom properties

---

## File Map

| Archivo | Acción | Responsabilidad |
|---------|--------|-----------------|
| `apps/dashboard/src/utils/emailTemplate.js` | Modificar | Añadir `splitIntoBlocks(html)` |
| `apps/dashboard/src/components/AgentChat.jsx` | Modificar | Añadir prop `currentHtml` + useEffect sync |
| `apps/dashboard/src/components/agent-views/shared/AgentChatSwitcher.jsx` | Modificar | Pasar prop `currentHtml` a AgentChat |
| `apps/dashboard/src/pages/EmailStudioPage.jsx` | Modificar | Reescribir `onHtmlGenerated`, `onHtmlPatched`, eliminar panel estructura |
| `apps/dashboard/server.js` | Modificar | Nuevo endpoint `POST /api/ai/name-email-blocks` |
| `apps/dashboard/src/index.css` | Modificar | Eliminar clases `.email-block-order-*` |

---

## Task 1: `splitIntoBlocks` en emailTemplate.js

**Files:**
- Modify: `apps/dashboard/src/utils/emailTemplate.js`

- [ ] **Step 1: Añadir la función `splitIntoBlocks` al final del archivo**

El archivo actual termina en línea 53. Añadir después de `fetchEmailTemplate`:

```javascript
/**
 * Splits a full Emirates email HTML into individual block objects.
 * Uses string-based parsing (not DOMParser) to preserve MSO conditional
 * comments (<!--[if mso]>...<![endif]-->) required for Outlook rendering.
 *
 * Finds the <div data-type="slot"> content, then extracts each top-level
 * <table> using depth-tracking. Injects data-block-name into each table's
 * opening tag so applyPatch() can target them later.
 *
 * @param {string} html - Full email HTML (with Emirates template wrapper)
 * @returns {{ id: string, name: string, html: string }[]}
 */
export function splitIntoBlocks(html) {
  if (!html) return [];

  // 1. Extract slot content
  const slotMarker = 'data-type="slot"';
  const slotIdx = html.indexOf(slotMarker);
  let content;
  if (slotIdx !== -1) {
    const openEnd = html.indexOf('>', slotIdx) + 1;
    const closeTag = html.indexOf('</div>', openEnd);
    content = closeTag !== -1 ? html.slice(openEnd, closeTag).trim() : '';
  } else {
    // Fallback: use body content
    const bodyStart = html.indexOf('<body');
    if (bodyStart !== -1) {
      const bodyOpen = html.indexOf('>', bodyStart) + 1;
      const bodyEnd = html.indexOf('</body>', bodyOpen);
      content = bodyEnd !== -1 ? html.slice(bodyOpen, bodyEnd).trim() : html;
    } else {
      content = html;
    }
  }

  if (!content) return [];

  // 2. Depth-tracking to find top-level <table> elements
  const blocks = [];
  let depth = 0;
  let blockStart = -1;
  let i = 0;
  const lower = content.toLowerCase();

  while (i < content.length) {
    if (lower.slice(i, i + 6) === '<table') {
      if (depth === 0) blockStart = i;
      depth++;
      i += 6;
    } else if (lower.slice(i, i + 8) === '</table>') {
      depth--;
      if (depth === 0 && blockStart !== -1) {
        const rawHtml = content.slice(blockStart, i + 8);
        const id = `block-${Date.now()}-${blocks.length}`;
        const name = `Block ${blocks.length + 1}`;
        // Inject data-block-name into the opening <table> tag
        const tagEnd = rawHtml.indexOf('>');
        const blockHtml = rawHtml.slice(0, tagEnd) +
          ` data-block-name="${name}"` +
          rawHtml.slice(tagEnd);
        blocks.push({ id, name, html: blockHtml });
        blockStart = -1;
      }
      i += 8;
    } else {
      i++;
    }
  }

  return blocks;
}
```

- [ ] **Step 2: Verificar manualmente en consola del browser**

Abrir DevTools en Email Studio, pegar:
```javascript
import('/src/utils/emailTemplate.js').then(m => {
  const html = '<html><head></head><body><div data-type="slot" data-key="x" data-label="x"><table width="100%"><tr><td>Block A</td></tr></table><table width="100%"><tr><td>Block B</td></tr></table></div></body></html>';
  console.log(m.splitIntoBlocks(html));
});
```
Resultado esperado: array de 2 objetos con `id`, `name: "Block 1"/"Block 2"`, `html` conteniendo `data-block-name`.

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/src/utils/emailTemplate.js
git commit -m "feat(email-studio): add splitIntoBlocks string parser for email decomposition"
```

---

## Task 2: Endpoint `/api/ai/name-email-blocks` en server.js

**Files:**
- Modify: `apps/dashboard/server.js` (añadir después de la línea del endpoint `GET /api/email-template`, ~línea 4415)

- [ ] **Step 1: Añadir el endpoint en server.js**

Buscar el comentario `// GET /api/email-template — Serve Emirates master template shell` (~línea 4404). Añadir el nuevo endpoint DESPUÉS del bloque de ese endpoint (después de la línea con `});` que cierra el handler, ~línea 4414):

```javascript
// POST /api/ai/name-email-blocks — Name auto-decomposed email blocks with Haiku
app.post('/api/ai/name-email-blocks', requireAuth, async (req, res) => {
  try {
    const { blocks } = req.body;
    if (!blocks?.length) return res.json({ named: [] });

    const prompt = blocks.map((b, i) =>
      `Block ${i + 1} (id: ${b.id}):\n${b.html.slice(0, 600)}`
    ).join('\n\n---\n\n');

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      messages: [{
        role: 'user',
        content: `Analyze these email HTML sections and give each a short descriptive name (2-4 words). Common types: Hero, Header, Offer, CTA, Story, Article, Footer, Body Copy, Partner Block, Columns.\n\nReturn ONLY valid JSON array: [{"id":"...","name":"..."}]\n\n${prompt}`,
      }],
    });

    const text = response.content[0].text;
    const jsonMatch = text.match(/\[[\s\S]+\]/);
    if (!jsonMatch) return res.json({ named: [] });
    const named = JSON.parse(jsonMatch[0]);
    res.json({ named });
  } catch (err) {
    console.error('name-email-blocks error:', err.message);
    res.json({ named: [] }); // silently fail — blocks keep generic names
  }
});
```

- [ ] **Step 2: Reiniciar servidor y probar el endpoint**

```bash
# Reiniciar servidor (o usar el proceso ya corriendo si hay hot-reload)
curl -X POST http://localhost:3001/api/ai/name-email-blocks \
  -H "Content-Type: application/json" \
  -b "connect.sid=TU_SESSION_COOKIE" \
  -d '{"blocks":[{"id":"block-1","html":"<table><tr><td><h1>Hero Dubai</h1><img src=\"dubai.jpg\"/></td></tr></table>"},{"id":"block-2","html":"<table><tr><td><p>Unsubscribe | Privacy</p></td></tr></table>"}]}'
```
Resultado esperado: `{"named":[{"id":"block-1","name":"Hero Dubai"},{"id":"block-2","name":"Footer"}]}`

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/server.js
git commit -m "feat(email-studio): add /api/ai/name-email-blocks endpoint with Haiku"
```

---

## Task 3: `AgentChat.jsx` — prop `currentHtml` para sync de ref

**Files:**
- Modify: `apps/dashboard/src/components/AgentChat.jsx:24`

- [ ] **Step 1: Añadir `currentHtml` a la firma del componente y el useEffect de sync**

Línea 24 actual:
```javascript
export default function AgentChat({ agentId, agentName, agentAvatar, externalInput, onExternalInputConsumed, onHtmlGenerated, onHtmlPatched }) {
```

Cambiar a:
```javascript
export default function AgentChat({ agentId, agentName, agentAvatar, externalInput, onExternalInputConsumed, onHtmlGenerated, onHtmlPatched, currentHtml }) {
```

Después de la línea `const currentHtmlRef = useRef('');` (~línea 32), añadir:
```javascript
    // Keep currentHtmlRef in sync with external state (e.g. after block reorder)
    useEffect(() => {
        if (currentHtml) currentHtmlRef.current = currentHtml;
    }, [currentHtml]);
```

- [ ] **Step 2: Verificar que no hay errores de lint/build**

```bash
cd apps/dashboard && npm run build 2>&1 | tail -20
```
Resultado esperado: sin errores.

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/src/components/AgentChat.jsx
git commit -m "feat(email-studio): sync currentHtmlRef with currentHtml prop in AgentChat"
```

---

## Task 4: `AgentChatSwitcher.jsx` — pasar `currentHtml`

**Files:**
- Modify: `apps/dashboard/src/components/agent-views/shared/AgentChatSwitcher.jsx:7`

- [ ] **Step 1: Añadir `currentHtml` a la firma y pasarla a AgentChat**

Línea 7 actual:
```javascript
export default function AgentChatSwitcher({ agent, selectedTicket, pipelineData, currentSession, completedSessions, agents, onClearTicket, onHandoffRequest, externalInput, onExternalInputConsumed, onHtmlGenerated, onHtmlPatched, onHtmlBlock }) {
```

Cambiar a:
```javascript
export default function AgentChatSwitcher({ agent, selectedTicket, pipelineData, currentSession, completedSessions, agents, onClearTicket, onHandoffRequest, externalInput, onExternalInputConsumed, onHtmlGenerated, onHtmlPatched, onHtmlBlock, currentHtml }) {
```

El bloque de return "Normal chat mode" (~líneas 68-78) actualmente:
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
        />
    );
```

Cambiar a:
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
            currentHtml={currentHtml}
        />
    );
```

- [ ] **Step 2: Commit**

```bash
git add apps/dashboard/src/components/agent-views/shared/AgentChatSwitcher.jsx
git commit -m "feat(email-studio): pass currentHtml prop through AgentChatSwitcher"
```

---

## Task 5: `EmailStudioPage.jsx` — rewire completo

**Files:**
- Modify: `apps/dashboard/src/pages/EmailStudioPage.jsx`

- [ ] **Step 1: Añadir import de `splitIntoBlocks`**

Línea 10 actual:
```javascript
import { injectIntoSlot, mergeAiHtmlIntoTemplate, fetchEmailTemplate } from '../utils/emailTemplate.js';
```

Cambiar a:
```javascript
import { injectIntoSlot, mergeAiHtmlIntoTemplate, fetchEmailTemplate, splitIntoBlocks } from '../utils/emailTemplate.js';
```

- [ ] **Step 2: Eliminar estados huérfanos del panel estructura**

Líneas 60-61 actuales:
```javascript
  const [dragIndex, setDragIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
```

Eliminar esas dos líneas completas.

- [ ] **Step 3: Añadir función `nameBlocksAsync` antes del `return`**

Añadir la siguiente función como función local del componente, justo antes de la línea `if (!agent) return ...` (~línea 118):

```javascript
  async function nameBlocksAsync(parsedBlocks) {
    try {
      const res = await fetch(`${API_URL}/ai/name-email-blocks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ blocks: parsedBlocks.map(b => ({ id: b.id, html: b.html })) }),
      });
      if (!res.ok) return;
      const { named } = await res.json();
      setBlocks(prev => prev.map(b => {
        const match = named.find(n => n.id === b.id);
        if (!match) return b;
        const updatedHtml = b.html.replace(
          /data-block-name="[^"]*"/,
          `data-block-name="${match.name}"`
        );
        return { ...b, name: match.name, html: updatedHtml };
      }));
    } catch {}
  }
```

- [ ] **Step 4: Reescribir `onHtmlGenerated` callback**

Líneas 181-187 actuales:
```javascript
                  onHtmlGenerated={(html) => {
                    setAiHtml(mergeAiHtmlIntoTemplate(templateHtml, html));
                    setBlocks([]);
                    setPatchedBlock(null);
                    setBuilderStatus('Email generado');
                    setTimeout(() => setBuilderStatus(''), 3000);
                  }}
```

Cambiar a:
```javascript
                  onHtmlGenerated={(html) => {
                    const merged = mergeAiHtmlIntoTemplate(templateHtml, html);
                    const parsed = splitIntoBlocks(merged);
                    if (parsed.length > 0) {
                      setBlocks(parsed);
                      setAiHtml('');
                      nameBlocksAsync(parsed);
                    } else {
                      setAiHtml(merged);
                      setBlocks([]);
                    }
                    setPatchedBlock(null);
                    setBuilderStatus('Email generado');
                    setTimeout(() => setBuilderStatus(''), 3000);
                  }}
```

- [ ] **Step 5: Reescribir `onHtmlPatched` callback**

Líneas 188-193 actuales:
```javascript
                  onHtmlPatched={(blockName, html) => {
                    setAiHtml(html);
                    setPatchedBlock(blockName);
                    setBuilderStatus(`${blockName} actualizado`);
                    setTimeout(() => { setPatchedBlock(null); setBuilderStatus(''); }, 2000);
                  }}
```

Cambiar a:
```javascript
                  onHtmlPatched={(blockName, fullPatchedHtml) => {
                    setBlocks(prev => {
                      const newBlocks = splitIntoBlocks(fullPatchedHtml);
                      if (newBlocks.length === 0) return prev;
                      return newBlocks.map((nb, i) => {
                        const patchedBlock = prev.find(b =>
                          b.name === blockName &&
                          nb.html.includes(`data-block-name="${blockName}"`)
                        );
                        if (patchedBlock) return { ...patchedBlock, html: nb.html };
                        const byPos = prev[i];
                        return byPos ? { ...byPos, html: nb.html } : nb;
                      });
                    });
                    setPatchedBlock(blockName);
                    setBuilderStatus(`${blockName} actualizado`);
                    setTimeout(() => { setPatchedBlock(null); setBuilderStatus(''); }, 2000);
                  }}
```

- [ ] **Step 6: Añadir prop `currentHtml` al `AgentChatSwitcher`**

En el JSX de `AgentChatSwitcher` (~línea 226), localizar la prop `onHtmlGenerated` y añadir `currentHtml={builderHtml}` justo antes de ella:

```jsx
                currentHtml={builderHtml}
                onHtmlGenerated={(html) => {
```

Solo esta línea nueva — los demás props no cambian.

- [ ] **Step 7: Eliminar el panel estructura del JSX**

Eliminar el bloque completo que empieza en `{blocks.length > 0 && (` y contiene el `email-block-order-panel` (~líneas 202-224):

```jsx
              {blocks.length > 0 && (
                <div className="email-block-order-panel">
                  <div className="email-block-order-header">
                    <span className="email-block-order-title">Estructura ({blocks.length})</span>
                  </div>
                  {blocks.map((block, i) => (
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
```

Eliminar estas ~23 líneas completas.

- [ ] **Step 8: Commit**

```bash
git add apps/dashboard/src/pages/EmailStudioPage.jsx
git commit -m "feat(email-studio): auto-decompose full email into blocks on generation"
```

---

## Task 6: Limpiar CSS huérfano en index.css

**Files:**
- Modify: `apps/dashboard/src/index.css` (~líneas 10400-10476)

- [ ] **Step 1: Eliminar todas las clases `.email-block-order-*`**

Buscar y eliminar el bloque completo desde `.email-block-order-panel {` hasta el cierre de `.email-block-order-remove:hover {` (incluyendo el `}` final). Son ~77 líneas de CSS.

Las clases a eliminar son:
- `.email-block-order-panel`
- `.email-block-order-header`
- `.email-block-order-title`
- `.email-block-order-item`
- `.email-block-order-item:last-child`
- `.email-block-order-item:active`
- `.email-block-order-item.drag-over`
- `.email-block-order-drag`
- `.email-block-order-name`
- `.email-block-order-remove`
- `.email-block-order-item:hover .email-block-order-remove`
- `.email-block-order-remove:hover`

- [ ] **Step 2: Commit**

```bash
git add apps/dashboard/src/index.css
git commit -m "chore(email-studio): remove orphaned email-block-order CSS classes"
```

---

## Task 7: Verificación end-to-end

- [ ] **Step 1: Arrancar el servidor**

```bash
npm start
# Vite en :4000, Express en :3001
```

- [ ] **Step 2: Verificar descomposición automática**

1. Ir a Email Studio → pestaña Chat
2. Escribir: "Crea un email Emirates completo con hero, sección de oferta y footer"
3. Comprobar que el preview muestra los bloques en BlocksCanvas (no single iframe)
4. Los nombres deben cambiar de "Block 1, 2, 3" a nombres descriptivos en ~2-3 segundos

- [ ] **Step 3: Verificar reordenado**

1. Con bloques en el canvas, arrastrar el footer al principio
2. Verificar que el canvas se actualiza visualmente
3. Exportar HTML → abrir en browser → verificar que el footer está primero

- [ ] **Step 4: Verificar patch de bloque**

1. Con el email descompuesto en bloques, escribir en el chat: "Cambia el título del hero"
2. Verificar que solo ese bloque se actualiza (los otros no parpadean)
3. Verificar que el nombre del bloque en el canvas sigue siendo el mismo

- [ ] **Step 5: Verificar drag desde panel de bloques**

1. Con bloques en el canvas, ir al sub-tab "Bloques" en la columna izquierda
2. Arrastrar un bloque nuevo al canvas
3. Verificar que se añade al final sin romper los existentes

- [ ] **Step 6: Verificar que el panel "Estructura" ya no aparece**

Con bloques en el canvas, comprobar que no hay panel de estructura en la columna izquierda.
