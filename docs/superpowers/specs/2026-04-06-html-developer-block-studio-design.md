# HTML Developer — Block Studio Design

**Date:** 2026-04-06  
**Status:** Approved

## Context

El HTML Developer view (`HtmlDeveloperView.jsx`) ya tiene un Builder tab con su propio estado de bloques (`builderBlocks`, `addBlock`, `reorderBlock`, `removeBlock`) y usa `EmailBuilderPreview` para el canvas. Sin embargo, no tiene forma de arrastrar bloques desde la librería al canvas dentro del Builder — el usuario tenía que usar la tab top-level "Blocks" para explorar bloques, pero no podía componerlos visualmente.

El objetivo es añadir el mismo panel de bloques draggable que ya tiene Email Studio, pero dentro del Builder del HTML Developer. Son builders completamente independientes — comparten componentes pero tienen estado y contexto propios.

## Diseño

### Layout

En el Builder tab de `HtmlDeveloperView`, el panel izquierdo pasa a tener un switcher de subtabs:

```
Builder tab
├── Panel izquierdo
│   ├── [Chat] [Blocks]  ← subtab switcher (nuevo)
│   ├── Chat subtab → AgentChatSwitcher (existente, sin cambios)
│   └── Blocks subtab → EmailBlocksPanel (reutilizado, sin cambios)
└── Panel derecho
    └── EmailBuilderPreview (existente, se añade onBlockDrop)
```

La tab top-level "Blocks" del HTML Developer view se mantiene sin cambios — sirve para explorar bloques con detalle (source viewer, metadata). El panel del Builder sirve para componer arrastrando al canvas.

### Estado nuevo

```javascript
// En HtmlDeveloperView.jsx
const [leftTab, setLeftTab] = useState('chat'); // 'chat' | 'blocks'
```

### Conexión drag-to-canvas

`EmailBlocksPanel` ya emite drag events con `text/html` y `text/plain` en dataTransfer. `EmailBuilderPreview` ya tiene un drop zone (`onBlockDrop` prop). Solo hay que pasar el handler:

```javascript
// En HtmlDeveloperView, dentro del Builder tab:
<EmailBuilderPreview
  // ...props existentes...
  onBlockDrop={(block) => {
    addBlock(block.name, block.html);
    setBuilderStatus(`${block.name} añadido`);
    setTimeout(() => setBuilderStatus(''), 3000);
  }}
/>
```

## Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `apps/dashboard/src/components/agent-views/HtmlDeveloperView.jsx` | Import EmailBlocksPanel, añadir `leftTab` state, subtab switcher UI, render condicional, pasar `onBlockDrop` |

## Archivos sin cambios

- `EmailBlocksPanel.jsx` — se reutiliza tal cual
- `EmailBuilderPreview.jsx` — se reutiliza tal cual (ya tiene `onBlockDrop`)
- `server.js` — sin cambios (el endpoint `/api/knowledge/email-blocks` ya existe)
- `EmailStudioPage.jsx` — sin cambios

## i18n

Añadir en `translations.js`:
- `blockStudio` → "Block Studio" / "Block Studio"
- `chatTab` → ya existe o usar clave existente

## Verificación

1. Abrir HTML Developer view de un proyecto con bloques ingresados
2. Ir al Builder tab
3. Click en subtab "Blocks" — debe mostrar el panel con búsqueda, filtros y lista de bloques
4. Arrastrar un bloque al canvas derecho — debe aparecer en `EmailBuilderPreview`
5. Click en subtab "Chat" — debe volver al AgentChatSwitcher sin perder los bloques del canvas
6. Tab top-level "Blocks" sigue funcionando igual (exploración, source viewer)
