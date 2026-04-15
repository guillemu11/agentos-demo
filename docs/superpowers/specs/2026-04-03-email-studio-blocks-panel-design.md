# Spec: Email Studio — Blocks Panel Redesign + Layout

**Date:** 2026-04-03  
**Status:** Approved

## Context

El panel de bloques en el Email Studio (EmailBlocksPanel.jsx) se veía agobiante: grid 2 columnas con thumbnails de 64px de alto, texto microscópico y sin posibilidad de buscar entre 30+ bloques. Adicionalmente el layout 50/50 dejaba poco espacio al editor, y la previsualización web (600px fijo) resultaba estrecha en una pantalla moderna.

## Cambios

### 1. EmailBlocksPanel — Lista compacta con búsqueda

**Estructura nueva:**

```
┌─ Search input ─────────────────────────────┐
├─ All · Header · Hero · Story · Offer · CTA ─┤
│ ┌──────────────────────────────────────────┐│
│ │ [thumb] Global Header Title v2   [header]││
│ │         Emirates brand header...         ││
│ ├──────────────────────────────────────────┤│
│ │ [thumb] Hero Image Block          [hero] ││
│ │         Hero a pantalla completa...      ││
│ └──────────────────────────────────────────┘│
│  scroll vertical · drag & drop preservado   │
└────────────────────────────────────────────┘
```

**Detalles:**

- **Search input**: filtro en tiempo real por `block.title` + `block.description` (case-insensitive). Se combina con el chip activo.
- **Category chips**: igual a ahora (All, Header, Hero, Story, Offer, CTA, Content, Footer). Se mantiene la lógica de `CATEGORY_GROUP`.
- **Filas**: `display: flex; align-items: center; gap: 10px` por bloque.
  - Thumbnail: `60×42px`, placeholder de color basado en categoría (no iframe — a este tamaño no aportan legibilidad).
  - Nombre: `font-size: 10.5px; font-weight: 600; color: var(--text-main)` — truncado con ellipsis.
  - Descripción: `font-size: 9px; color: var(--text-muted)` — una línea truncada.
  - Badge de categoría: pill coloreado a la derecha (`8.5px`, colores únicos por categoría).
- **Hover**: `border-color: var(--primary); box-shadow: 0 2px 8px rgba(var(--primary-rgb), 0.12)`.
- **Drag & drop**: se preserva exactamente igual (`draggable`, `onDragStart`, `onDragEnd`).
- **Empty state**: "No hay bloques que coincidan" cuando search + filtro no da resultados.

**Colores de badge por categoría:**

| Categoría | Background | Color texto |
|-----------|-----------|-------------|
| header    | `#fef3c7` | `#92400e`   |
| hero      | `#ede9fe` | `#5b21b6`   |
| story     | `#e0f2fe` | `#075985`   |
| offer     | `#fee2e2` | `#991b1b`   |
| cta       | `#d1fae5` | `#065f46`   |
| content   | `#f3f4f6` | `#374151`   |
| footer    | `#f3f4f6` | `#374151`   |

**Placeholder de thumbnail por categoría:**

| Categoría | Fondo |
|-----------|-------|
| header    | `linear-gradient(135deg, #1a1a2e, #16213e)` con barra roja |
| hero      | `linear-gradient(135deg, #c60c30, #9b0000)` con círculo |
| offer     | `#f9fafb` con 2 columnas grises |
| cta       | `#f9fafb` con botón rojo |
| story     | `#f9fafb` con 3 columnas |
| footer    | `#1a1a2e` con líneas blancas |
| default   | `#f3f4f6` (gris neutro) |

### 2. Layout 30/70

**Archivo:** `apps/dashboard/src/index.css`

```css
/* Email Studio — 30/70 */
.email-studio-split {
  grid-template-columns: 30% 70%;   /* antes: 1fr 1fr */
}
```

### 3. Preview más ancho

**Archivo:** `apps/dashboard/src/index.css`

```css
/* Desktop: ocupa el espacio disponible, máximo 800px */
.email-preview-iframe-wrapper.desktop { width: min(800px, 95%); }  /* antes: 600px */
.email-preview-iframe-wrapper.mobile  { width: 375px; }            /* sin cambio */
```

El `.email-preview-body` ya tiene `justify-content: center` así que el wrapper queda centrado automáticamente.

## Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `apps/dashboard/src/components/EmailBlocksPanel.jsx` | Reemplazar grid+iframe por lista con search |
| `apps/dashboard/src/index.css` | `.email-studio-split` 30/70, `.email-preview-iframe-wrapper.desktop` 800px, clases nuevas de lista |

## Verificación

1. Email Studio → tab Blocks: se ve lista compacta, no grid agobiante
2. Search filtra en tiempo real combinado con chips
3. Drag & drop de bloque al preview funciona igual
4. Layout izquierda más estrecha, preview más ancho
5. Modo desktop muestra el email más ancho (hasta 800px)
6. Modo mobile sigue en 375px
