# Email Studio Blocks Panel Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rediseñar el panel de bloques del Email Studio a lista compacta con búsqueda, cambiar el layout a 30/70 y ampliar la previsualización desktop a 800px.

**Architecture:** Tres cambios independientes en dos archivos. EmailBlocksPanel.jsx se reescribe completamente (misma API, misma lógica de drag&drop, nueva UI). index.css recibe los cambios de layout y los nuevos estilos de la lista.

**Tech Stack:** React 19, CSS custom properties, sin dependencias nuevas.

---

## Files

| Acción | Archivo |
|--------|---------|
| Modificar | `apps/dashboard/src/components/EmailBlocksPanel.jsx` |
| Modificar | `apps/dashboard/src/index.css` |
| Modificar | `apps/dashboard/src/i18n/translations.js` |

---

## Task 1: CSS — Layout 30/70 + preview más ancho + estilos de lista

**Files:**
- Modify: `apps/dashboard/src/index.css`

- [ ] **Paso 1: Cambiar el layout del Email Studio a 30/70**

Buscar en `index.css` el bloque:
```css
/* Email Studio — 50/50 */
.email-studio-split {
  display: grid;
  grid-template-columns: 1fr 1fr;
```

Reemplazarlo por:
```css
/* Email Studio — 30/70 */
.email-studio-split {
  display: grid;
  grid-template-columns: 30% 70%;
```

- [ ] **Paso 2: Ampliar preview desktop a 800px**

Buscar en `index.css`:
```css
.email-preview-iframe-wrapper.desktop { width: 600px; }
```

Reemplazarlo por:
```css
.email-preview-iframe-wrapper.desktop { width: min(800px, 95%); }
```

- [ ] **Paso 3: Añadir estilos de la nueva lista de bloques**

Buscar en `index.css` el bloque `.email-blocks-grid {` y reemplazarlo completamente por:

```css
/* Search input */
.email-blocks-search {
  padding: 10px 12px 8px;
  border-bottom: 1px solid var(--border-light);
  flex-shrink: 0;
}

.email-blocks-search-input {
  width: 100%;
  box-sizing: border-box;
  padding: 7px 10px 7px 28px;
  border: 1px solid var(--border-light);
  border-radius: 8px;
  font-size: 0.72rem;
  color: var(--text-main);
  background: var(--bg-secondary) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='11' cy='11' r='8'/%3E%3Cpath d='m21 21-4.35-4.35'/%3E%3C/svg%3E") no-repeat 10px center;
  outline: none;
  transition: border-color 0.12s;
}

.email-blocks-search-input:focus {
  border-color: var(--primary);
}

/* Block list */
.email-blocks-list {
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 8px 10px;
  overflow-y: auto;
  flex: 1;
}

.email-block-row {
  display: flex;
  align-items: center;
  gap: 10px;
  background: var(--bg-card);
  border: 1px solid var(--border-light);
  border-radius: 8px;
  padding: 8px 10px;
  cursor: grab;
  transition: border-color 0.12s, box-shadow 0.12s;
  user-select: none;
  flex-shrink: 0;
}

.email-block-row:hover {
  border-color: var(--primary);
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.email-block-row:active {
  cursor: grabbing;
}

.email-block-row.dragging {
  opacity: 0.45;
}

.email-block-row-thumb {
  flex-shrink: 0;
  width: 60px;
  height: 42px;
  border-radius: 5px;
  background: var(--bg-secondary);
}

.email-block-row-info {
  flex: 1;
  min-width: 0;
}

.email-block-row-name {
  font-size: 0.68rem;
  font-weight: 600;
  color: var(--text-main);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.email-block-row-desc {
  font-size: 0.62rem;
  color: var(--text-muted);
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.email-block-badge {
  flex-shrink: 0;
  padding: 2px 7px;
  border-radius: 10px;
  font-size: 0.6rem;
  font-weight: 600;
  text-transform: lowercase;
  letter-spacing: 0.01em;
}
```

- [ ] **Paso 4: Verificar en browser que el layout se ve 30/70 y preview más ancho**

```bash
# El servidor ya debe estar corriendo. Ir a Email Studio y verificar visualmente.
# No hay tests automatizados para CSS puro.
```

- [ ] **Paso 5: Commit**

```bash
git add apps/dashboard/src/index.css
git commit -m "style(email-studio): layout 30/70, preview 800px, list block styles"
```

---

## Task 2: Añadir clave de traducción `emailBlocks.search`

**Files:**
- Modify: `apps/dashboard/src/i18n/translations.js`

- [ ] **Paso 1: Añadir `search` en el bloque `es.emailBlocks`**

Buscar:
```javascript
    emailBlocks: {
      tabChat: 'Chat',
      tabBlocks: 'Blocks',
      loading: 'Cargando bloques...',
      empty: 'No hay bloques en esta categoría',
```

Reemplazar por:
```javascript
    emailBlocks: {
      tabChat: 'Chat',
      tabBlocks: 'Blocks',
      loading: 'Cargando bloques...',
      empty: 'No hay bloques que coincidan',
      search: 'Buscar bloques...',
```

- [ ] **Paso 2: Añadir `search` en el bloque `en.emailBlocks`**

Buscar:
```javascript
      loading: 'Loading blocks...',
      empty: 'No blocks in this category',
```

Reemplazar por:
```javascript
      loading: 'Loading blocks...',
      empty: 'No blocks match your search',
      search: 'Search blocks...',
```

- [ ] **Paso 3: Commit**

```bash
git add apps/dashboard/src/i18n/translations.js
git commit -m "i18n: add emailBlocks.search key (es + en)"
```

---

## Task 3: Reescribir EmailBlocksPanel.jsx

**Files:**
- Modify: `apps/dashboard/src/components/EmailBlocksPanel.jsx`

- [ ] **Paso 1: Reemplazar el contenido completo del componente**

Reemplazar todo el contenido de `apps/dashboard/src/components/EmailBlocksPanel.jsx` por:

```jsx
import { useState, useEffect } from 'react';
import { useLanguage } from '../i18n/LanguageContext.jsx';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const CATEGORY_GROUP = {
  header: 'header',
  hero: 'hero',
  story: 'story',
  offer: 'offer',
  cta: 'cta',
  'body-copy': 'content',
  'section-title': 'content',
  article: 'content',
  infographic: 'content',
  card: 'content',
  columns: 'content',
  partner: 'content',
  flight: 'content',
  footer: 'footer',
};

const FILTERS = ['all', 'header', 'hero', 'story', 'offer', 'cta', 'content', 'footer'];

const BADGE_COLORS = {
  header:  { bg: '#fef3c7', color: '#92400e' },
  hero:    { bg: '#ede9fe', color: '#5b21b6' },
  story:   { bg: '#e0f2fe', color: '#075985' },
  offer:   { bg: '#fee2e2', color: '#991b1b' },
  cta:     { bg: '#d1fae5', color: '#065f46' },
  content: { bg: '#f3f4f6', color: '#374151' },
  footer:  { bg: '#f3f4f6', color: '#374151' },
};

const THUMB_STYLES = {
  header:  { background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)' },
  hero:    { background: 'linear-gradient(135deg, #c60c30 0%, #9b0000 100%)' },
  story:   { background: '#e0f2fe' },
  offer:   { background: '#f9fafb', border: '1px solid #e5e7eb' },
  cta:     { background: '#f9fafb', border: '1px solid #e5e7eb' },
  content: { background: '#f3f4f6' },
  footer:  { background: '#1a1a2e' },
};

export default function EmailBlocksPanel() {
  const { t } = useLanguage();
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [draggingId, setDraggingId] = useState(null);

  useEffect(() => {
    fetch(`${API_URL}/knowledge/email-blocks`, { credentials: 'include' })
      .then(r => r.json())
      .then(data => setBlocks(
        (data.blocks || []).map(b => ({
          ...b,
          group: CATEGORY_GROUP[b.category] || 'content',
        }))
      ))
      .catch(() => setBlocks([]))
      .finally(() => setLoading(false));
  }, []);

  const q = searchQuery.toLowerCase();
  const filtered = blocks.filter(b => {
    const matchesFilter = filter === 'all' || b.group === filter;
    const matchesSearch = !q
      || b.title.toLowerCase().includes(q)
      || (b.description || '').toLowerCase().includes(q);
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="email-blocks-panel">
      <div className="email-blocks-search">
        <input
          className="email-blocks-search-input"
          type="text"
          placeholder={t('emailBlocks.search') || 'Search blocks...'}
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="email-blocks-filters">
        {FILTERS.map(f => (
          <button
            key={f}
            className={`email-blocks-chip ${filter === f ? 'active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {t(`emailBlocks.cat_${f}`) || f}
          </button>
        ))}
      </div>

      <div className="email-blocks-list">
        {loading && (
          <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', padding: '16px 0' }}>
            {t('emailBlocks.loading')}
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', padding: '16px 0' }}>
            {t('emailBlocks.empty')}
          </div>
        )}

        {!loading && filtered.map(block => {
          const badge = BADGE_COLORS[block.group] || BADGE_COLORS.content;
          const thumb = THUMB_STYLES[block.group] || THUMB_STYLES.content;
          return (
            <div
              key={block.id}
              className={`email-block-row animate-fade-in${draggingId === block.id ? ' dragging' : ''}`}
              draggable
              onDragStart={e => {
                setDraggingId(block.id);
                e.dataTransfer.effectAllowed = 'copy';
                e.dataTransfer.setData('text/html', block.html);
                e.dataTransfer.setData('text/plain', block.title);
              }}
              onDragEnd={() => setDraggingId(null)}
              title={block.description || block.title}
            >
              <div className="email-block-row-thumb" style={thumb} />
              <div className="email-block-row-info">
                <div className="email-block-row-name">{block.title}</div>
                {block.description && (
                  <div className="email-block-row-desc">{block.description}</div>
                )}
              </div>
              <span
                className="email-block-badge"
                style={{ background: badge.bg, color: badge.color }}
              >
                {block.group}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Paso 2: Verificar en browser**

1. Ir a Email Studio → tab Blocks
2. Confirmar: lista compacta, no grid
3. Escribir en el search → filtra en tiempo real
4. Click en chip "Header" → filtra por categoría
5. Combinar search + chip → ambos filtros activos
6. Arrastrar un bloque al preview → funciona igual que antes

- [ ] **Paso 3: Commit**

```bash
git add apps/dashboard/src/components/EmailBlocksPanel.jsx
git commit -m "feat(email-studio): blocks panel — lista compacta con búsqueda y badges"
```

---

## Self-Review

**Spec coverage:**
- ✅ Search input — Task 2 (traducción) + Task 3 (componente)
- ✅ Category chips preservados — Task 3
- ✅ Lista con thumbnail + nombre + descripción + badge — Task 3
- ✅ Hover state rojo — Task 1 CSS `.email-block-row:hover`
- ✅ Drag & drop preservado — Task 3 `draggable`, `onDragStart`, `onDragEnd`
- ✅ Layout 30/70 — Task 1
- ✅ Preview desktop 800px — Task 1
- ✅ Empty state — Task 3

**Placeholders:** Ninguno.

**Type consistency:** Las clases CSS definidas en Task 1 (`.email-block-row`, `.email-block-row-thumb`, `.email-block-row-info`, `.email-block-row-name`, `.email-block-row-desc`, `.email-block-badge`, `.email-blocks-search`, `.email-blocks-search-input`, `.email-blocks-list`) coinciden exactamente con las usadas en Task 3. ✅
