# Spec: Auto-decomposición de email en bloques editables

**Fecha:** 2026-04-03  
**Estado:** Aprobado

## Problema

El Email Studio tiene dos modos de trabajo incompatibles:
- **Modo aiHtml** — el agente genera el email completo, se renderiza en un único iframe, no se puede manipular por bloques
- **Modo blocks[]** — bloques añadidos uno a uno desde el panel, se renderizan en BlocksCanvas, se pueden reordenar y eliminar

No hay puente entre ellos. Si el usuario pide un email completo al chat, no puede luego mover secciones ni añadir bloques extra.

## Solución

Cuando el agente genera un email completo, descomponerlo automáticamente en bloques individuales y meterlos en `blocks[]`. El canvas de bloques se muestra inmediatamente con nombres temporales. En paralelo, Claude Haiku nombra cada bloque de forma descriptiva y actualiza el canvas sin rerenderizar.

Además, eliminar el panel "Estructura" de la columna izquierda (redundante con el canvas visual).

## Flujo de usuario

```
Usuario: "Crea un email Emirates con hero Dubai, oferta de vuelo y footer"
  → Agente genera HTML completo
  → splitIntoBlocks() extrae 4 bloques, añade data-block-name a cada table
  → BlocksCanvas muestra "Block 1", "Block 2"... al instante
  → Claude Haiku nombra async: "Hero Dubai", "Oferta BCN-DXB", "CTA vuelos", "Footer"
  → Canvas actualiza nombres sin parpadeo

Usuario reordena bloques arrastrando
  → blocks[] reordenado
  → builderHtml recalculado (injectIntoSlot de los nuevos bloques en orden)
  → currentHtmlRef en AgentChat actualizado vía prop currentHtml

Usuario: "Cambia el título del hero a 'Descubre Abu Dhabi'"
  → Agente emite <!--PATCH:Hero Dubai-->...html del bloque actualizado...
  → applyPatch() busca data-block-name="Hero Dubai" en currentHtmlRef → reemplaza
  → onHtmlPatched("Hero Dubai", fullPatchedHtml) → re-split + preserve names → update blocks[]
```

## Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `apps/dashboard/src/utils/emailTemplate.js` | Nueva función `splitIntoBlocks(html)` |
| `apps/dashboard/src/pages/EmailStudioPage.jsx` | `onHtmlGenerated`, `onHtmlPatched`, pasar `currentHtml`, eliminar panel estructura |
| `apps/dashboard/src/components/AgentChat.jsx` | Nueva prop `currentHtml`, sincronizar `currentHtmlRef` |
| `apps/dashboard/src/components/agent-views/shared/AgentChatSwitcher.jsx` | Pasar prop `currentHtml` |
| `apps/dashboard/server.js` | Nuevo endpoint `POST /api/ai/name-email-blocks` |

`EmailBuilderPreview.jsx` y `EmailBlocksPanel.jsx` no requieren cambios.

---

## Implementación detallada

### 1. `splitIntoBlocks(html)` — `emailTemplate.js`

**Entrada:** HTML completo del email (con wrapper Emirates)  
**Salida:** `[{ id: string, name: string, html: string }]`

Cada bloque tiene `data-block-name` inyectado en la etiqueta `<table>` de primer nivel — necesario para que `applyPatch()` pueda encontrarlos después.

**Algoritmo (string-based, no DOMParser — preserva comentarios MSO de Outlook):**

```javascript
export function splitIntoBlocks(html) {
  // 1. Encontrar contenido del slot
  const slotMarker = 'data-type="slot"';
  const slotIdx = html.indexOf(slotMarker);
  let content;
  if (slotIdx !== -1) {
    const openEnd = html.indexOf('>', slotIdx) + 1;
    const closeTag = html.indexOf('</div>', openEnd);
    content = html.slice(openEnd, closeTag).trim();
  } else {
    // Fallback: extraer body
    const bodyStart = html.indexOf('<body');
    const bodyOpen = html.indexOf('>', bodyStart) + 1;
    const bodyEnd = html.indexOf('</body>', bodyOpen);
    content = bodyStart !== -1 ? html.slice(bodyOpen, bodyEnd).trim() : html;
  }

  // 2. Depth-tracking para extraer <table> de primer nivel
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
        // Inyectar data-block-name en la apertura del <table>
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

---

### 2. `AgentChat.jsx` — nueva prop `currentHtml`

**Problema:** `currentHtmlRef` guarda el HTML cuando se genera el email, pero si el usuario reordena bloques, el ref queda desactualizado. `applyPatch` usaría un HTML con el orden antiguo.

**Fix:** aceptar prop `currentHtml` y sincronizarla con `currentHtmlRef`:

```javascript
// Añadir a la firma del componente:
export default function AgentChat({ ..., currentHtml, onHtmlPatched }) {
  // ...
  useEffect(() => {
    if (currentHtml) currentHtmlRef.current = currentHtml;
  }, [currentHtml]);
  // resto sin cambios
}
```

---

### 3. `AgentChatSwitcher.jsx` — pasar `currentHtml`

```javascript
// Añadir prop currentHtml y pasarla a AgentChat:
export default function AgentChatSwitcher({ ..., currentHtml, onHtmlPatched }) {
  // ...
  // En el return donde se renderiza AgentChat:
  <AgentChat
    ...
    currentHtml={currentHtml}
    onHtmlPatched={onHtmlPatched}
  />
}
```

---

### 4. `EmailStudioPage.jsx`

**`onHtmlGenerated` — nuevo comportamiento:**
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

**`nameBlocksAsync` — función local:**
```javascript
async function nameBlocksAsync(blocks) {
  try {
    const res = await fetch(`${API_URL}/ai/name-email-blocks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ blocks: blocks.map(b => ({ id: b.id, html: b.html })) }),
    });
    if (!res.ok) return;
    const { named } = await res.json();
    // Actualizar nombre en block.name Y en el atributo data-block-name del HTML
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

**`onHtmlPatched` — nuevo comportamiento:**

`applyPatch` en `AgentChat` ya hace el replace y devuelve el HTML completo parchado. Necesitamos re-split y preservar nombres:

```javascript
onHtmlPatched={(blockName, fullPatchedHtml) => {
  setBlocks(prev => {
    const newBlocks = splitIntoBlocks(fullPatchedHtml);
    if (newBlocks.length === 0) return prev;
    // Preservar nombres existentes por data-block-name o por posición
    return newBlocks.map((nb, i) => {
      const existingByName = prev.find(b => b.name === blockName &&
        nb.html.includes(`data-block-name="${blockName}"`));
      if (existingByName) return { ...existingByName, html: nb.html };
      const existingByPos = prev[i];
      return existingByPos ? { ...existingByPos, html: nb.html } : nb;
    });
  });
  setPatchedBlock(blockName);
  setBuilderStatus(`${blockName} actualizado`);
  setTimeout(() => { setPatchedBlock(null); setBuilderStatus(''); }, 2000);
}}
```

**`currentHtml` pasado a `AgentChatSwitcher`:**
```jsx
<AgentChatSwitcher
  ...
  currentHtml={builderHtml}
  onHtmlPatched={...}
/>
```

**Eliminar panel estructura:** borrar el bloque JSX `email-block-order-panel` completo (y sus estados `dragIndex`, `dragOverIndex` que quedan huérfanos).

---

### 5. Endpoint `POST /api/ai/name-email-blocks` — `server.js`

```javascript
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
        content: `Analyze these email HTML sections and give each a short descriptive name (2-4 words). Types: Hero, Header, Offer, CTA, Story, Article, Footer, Body Copy, Partner Block, Columns.\n\nReturn ONLY valid JSON array: [{"id":"...","name":"..."}]\n\n${prompt}`,
      }],
    });

    const text = response.content[0].text;
    const match = text.match(/\[[\s\S]+\]/);
    if (!match) return res.json({ named: [] });
    const named = JSON.parse(match[0]);
    res.json({ named });
  } catch (err) {
    console.error('name-email-blocks error:', err.message);
    res.json({ named: [] }); // silently fail — blocks keep generic names
  }
});
```

---

### 6. CSS a eliminar — `index.css`

Borrar las clases del panel estructura que quedan huérfanas:
- `.email-block-order-panel`
- `.email-block-order-header`
- `.email-block-order-title`
- `.email-block-order-item`
- `.email-block-order-drag`
- `.email-block-order-name`
- `.email-block-order-remove`

---

## Verificación

1. Pedir al chat "Crea un email Emirates completo con hero y footer" → preview muestra bloques en BlocksCanvas (no single iframe)
2. Nombres cambian de "Block 1, 2..." a nombres descriptivos en ~2s sin parpadeo ni rerenderizado de iframes
3. Reordenar bloques con drag → `builderHtml` recalculado correctamente
4. Pedir "Cambia el título del hero" → solo ese bloque actualiza, los demás intactos
5. Arrastrar bloque desde panel izquierdo → se añade al canvas sin romper existentes
6. Panel "Estructura" no aparece en la columna izquierda
7. Exportar HTML → resultado es un email Emirates válido con todos los bloques en el orden visual
