# Block Studio — Design Spec

**Date:** 2026-04-06
**Status:** Approved

## Context

El HTML Developer agent view tiene un botón "✉️ Email Studio" que navega a `EmailStudioPage` (builder AI-first con chat + canvas). Se necesita una segunda página hermana — **Block Studio** — con foco en composición manual desde la librería de bloques, con el chat como herramienta de modificación de bloques individuales (no de generación de emails completos).

## Ruta y acceso

- **Ruta:** `/app/workspace/agent/html-developer/block-studio`
- **Acceso:** Nueva tab `⊞ Block Studio` en `HtmlDeveloperView.jsx` con `isStudio: true`
- **Componente:** `apps/dashboard/src/pages/BlockStudioPage.jsx` (nuevo)
- **Registro:** `apps/dashboard/src/main.jsx` (nueva `<Route>`)

## Tabs

Block Studio tiene **2 tabs** (sin Templates):

| Tab | Función |
|-----|---------|
| `builder` | Chat \| Blocks panel izquierdo + canvas derecho |
| `blocks` | Block Manager — grid, filtros, selección → acción |

## Tab: Builder

Layout split idéntico a Email Studio:

- **Panel izquierdo** con subtabs:
  - `⊞ Blocks` (por defecto) → `EmailBlocksPanel` con drag-to-canvas
  - `💬 Chat` → `AgentChatSwitcher` para parchear bloques individuales
- **Panel derecho** → `EmailBuilderPreview` con canvas de bloques + preview/HTML tabs + botón Guardar

Estado del builder:
```javascript
const [builderBlocks, setBuilderBlocks] = useState([])   // [{id, name, html}]
const [aiHtml, setAiHtml] = useState('')
const [templateHtml, setTemplateHtml] = useState('')     // Emirates master template
const [patchedBlock, setPatchedBlock] = useState(null)
const [builderStatus, setBuilderStatus] = useState('')
const [leftTab, setLeftTab] = useState('blocks')         // 'blocks' | 'chat' (blocks por defecto)
const [chatInput, setChatInput] = useState('')
```

`builderHtml` computado via `useMemo` igual que en `EmailStudioPage` y `HtmlDeveloperView`.

## Tab: Blocks (Block Manager)

Grid de thumbnails de todos los bloques de la KB. Al hacer click en un bloque, aparece un panel lateral derecho con:

- Preview del bloque (iframe)
- Metadata: nombre, categoría, descripción
- Dos botones de acción:
  - **➕ Añadir al canvas** → llama `addBlock(block.name, block.html)`, navega al Builder tab
  - **✏️ Usar como base** → llama `addBlock(block.name, block.html)`, navega al Builder tab con `leftTab = 'chat'` y pre-llena `chatInput` con `[base: ${block.name}] `

Botón **↺ Re-ingest** en el toolbar → `POST /api/knowledge/ingest-email-blocks` (requiere confirmación).

Estado del Block Manager:
```javascript
const [selectedBlock, setSelectedBlock] = useState(null)  // bloque seleccionado
const [blockFilter, setBlockFilter] = useState('All')
const [blockSearch, setBlockSearch] = useState('')
const [reingesting, setReingesting] = useState(false)
```

## Datos compartidos

Los bloques se cargan una sola vez en `BlockStudioPage`:

```javascript
useEffect(() => {
  fetch(`${API_URL}/knowledge/email-blocks`, { credentials: 'include' })
    .then(r => r.json())
    .then(result => setRagBlocks(result.blocks || []))
    .catch(() => setRagBlocks([]))
}, [])
```

`EmailBlocksPanel` en el Builder tab recibe los mismos bloques via prop (evita doble fetch).

## Componentes reutilizados (sin cambios)

- `EmailBlocksPanel` — panel de bloques draggable
- `EmailBuilderPreview` — canvas + preview
- `AgentChatSwitcher` — chat del agente
- `emailTemplate.js` — `fetchEmailTemplate`, `injectIntoSlot`, `mergeAiHtmlIntoTemplate`
- CSS: `.email-builder-split`, `.email-builder-chat-panel`, `.email-left-panel-tabs`, `.email-left-tab`, `.email-blocks-canvas-*`
- i18n: `emailBlocks.tabChat`, `emailBlocks.tabBlocks`

## Archivos a modificar/crear

| Archivo | Cambio |
|---------|--------|
| `apps/dashboard/src/pages/BlockStudioPage.jsx` | Crear — página principal |
| `apps/dashboard/src/main.jsx` | Añadir `<Route path="/workspace/agent/html-developer/block-studio">` |
| `apps/dashboard/src/components/agent-views/HtmlDeveloperView.jsx` | Añadir tab `⊞ Block Studio` con `isStudio: true` navegando a `/block-studio` |
| `apps/dashboard/src/i18n/translations.js` | Añadir claves `blockStudio.*` |
| `apps/dashboard/src/index.css` | Estilos del Block Manager (grid, panel lateral, botones de acción) |

## i18n (nuevas claves)

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
}
```

(Versión EN también en ambos idiomas.)

## Verificación

1. Abrir HTML Developer agent view
2. Verificar que aparece la tab **⊞ Block Studio** junto a ✉️ Email Studio
3. Click → navega a `/app/workspace/agent/html-developer/block-studio`
4. **Builder tab:**
   - Panel izquierdo muestra subtab Blocks activo por defecto con `EmailBlocksPanel`
   - Drag de bloque → aparece en canvas derecho
   - Subtab Chat → muestra AgentChatSwitcher
5. **Blocks tab:**
   - Grid de thumbnails con filtros y búsqueda
   - Click en bloque → panel lateral con preview + metadata + botones
   - **Añadir al canvas** → bloque aparece en Builder, navega a Builder tab
   - **Usar como base** → Builder tab, chat abierto con `[base: nombre]` pre-llenado
   - **Re-ingest** → muestra spinner, llama API, muestra resultado
