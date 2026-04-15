# Email Studio — Save & Templates

**Date:** 2026-04-06
**Branch:** feat/whatsapp-autoresearch-lab

## Context

El usuario construye plantillas HTML en Email Studio antes de que el Content Agent (Sofia) genere las variantes de contenido. Necesita guardar múltiples versiones de la plantilla para compararlas y elegir una final. El Preview & Test solo tiene sentido cuando Sofia ha terminado y los variants están disponibles (`contentReady = true`).

Problemas actuales:
- El botón Export HTML (Download) no tiene utilidad real en el flujo
- El botón Save no da ningún feedback visual al guardar
- El botón Preview & Test está deshabilitado sin explicación cuando Sofia no ha terminado
- La pestaña Templates muestra un placeholder inútil en lugar de las templates guardadas

## Cambios

### 1. Toolbar — `EmailBuilderPreview.jsx`

**Quitar:** botón Download (Export HTML — `handleExport`)

**Modificar:**
- Botón Save: icono + texto "💾 Save", color verde, click abre popover de nombre
- Botón FlaskConical: icono + texto "🧪 Preview & Test", color morado
  - `disabled` cuando `!contentReady`, con `title="Esperando variants de Sofia"`
  - Enabled cuando `contentReady = true`

**Orden final de botones:** `[Preview|HTML tabs] [variant selector] [viewport toggle] [💾 Save] [🧪 Preview & Test] [fullscreen]`

### 2. Popover de Save

Componente inline en `EmailBuilderPreview.jsx` (no modal separado):
- Se abre debajo del botón Save (`position: absolute`)
- Input de texto con placeholder "Nombre de la template"
- Botón "Guardar" → POST `/api/projects/:id/emails` con `{ variant_name: nombre, html_content: html, market: 'all', language: 'all', status: 'draft' }`
- Toast de confirmación: "Template guardada ✓"
- Cierra con Escape o click fuera (`onBlur` / overlay transparente)
- Estado: `showSavePopover` (boolean), `saveTemplateName` (string)

### 3. Pestaña Templates — `EmailStudioPage.jsx`

Reemplazar el placeholder actual por una lista real de templates.

**Carga:** `GET /api/projects/:id/emails` al montar (cuando `activeTab === 'templates'` o al guardar)

**Cada card (layout lista vertical):**
```
[mini-preview HTML] | [nombre editable] [fecha] [badge status]
                    | [🧪 Preview & Test] [⭐ Usar esta] [🗑]
```

- **Mini-preview:** `<iframe>` con el HTML escalado via `transform: scale(0.15)` dentro de un contenedor `80×60px`
- **Nombre editable:** click en el nombre → input inline → Enter/blur guarda via `PATCH /api/emails/:id`
- **Badge status:** `draft` (azul) o `final` (verde)
- **🧪 Preview & Test:** disabled con tooltip "Esperando a Sofia" si `!contentReady`. Enabled abre `VariantPreviewModal` con el `html_content` de esa template
- **⭐ Usar esta:** marca la template como `approved` (= final) via `PATCH /api/emails/:id`. Las demás templates del proyecto se quedan en `draft`. Solo una puede ser `approved` a la vez. La UI muestra "final" aunque el valor en DB sea `approved`
- **🗑 Borrar:** `DELETE /api/emails/:id` con confirmación inline ("¿Seguro? Sí / No")

### 4. Backend — `server.js`

**Nuevo:** `PATCH /api/emails/:id` — editar nombre/status de una template
```js
// Body: { variant_name?, status? }
// Si status === 'approved': UPDATE email_proposals SET status='draft' WHERE project_id = X AND status='approved'
//                          UPDATE email_proposals SET status='approved' WHERE id = X
// Si solo variant_name: UPDATE email_proposals SET variant_name=$1 WHERE id=$2
```

**Nuevo:** `DELETE /api/emails/:id`
```js
// DELETE FROM email_proposals WHERE id=$1
```

Los endpoints `GET /api/projects/:id/emails` y `POST /api/projects/:id/emails` ya existen y no se modifican.

### 5. Translations — `translations.js`

Claves nuevas (ES + EN):
- `emailBuilder.saveTemplate` — "💾 Save" / "💾 Save"
- `emailBuilder.previewTest` — "🧪 Preview & Test"
- `emailBuilder.savePopoverPlaceholder` — "Nombre de la template" / "Template name"
- `emailBuilder.savePopoverConfirm` — "Guardar" / "Save"
- `emailBuilder.savedToast` — "Template guardada ✓" / "Template saved ✓"
- `emailBuilder.waitingVariants` — "Esperando variants de Sofia" / "Waiting for Sofia's variants"
- `studio.templateFinal` — "final" / "final" (badge UI para status=approved)
- `studio.templateDraft` — "draft"
- `studio.useThis` — "Usar esta" / "Use this"
- `studio.deleteConfirm` — "¿Seguro?" / "Sure?"

### 6. CSS — `index.css`

- `.email-save-popover` — posición absoluta, z-index alto, shadow, borde sutil
- `.email-template-list` — lista vertical, gap entre cards
- `.email-template-card` — layout flex con thumbnail + contenido
- `.email-template-thumb` — contenedor `80×60px` con overflow hidden para iframe escalado
- `.email-template-name-input` — input inline transparente, borde solo en focus
- `.email-template-badge` — badge colored (draft=azul, final=verde)

## Flujo end-to-end

```
[Sofia en progreso]
Usuario construye HTML → click "💾 Save" → popover → escribe nombre → confirma
→ template aparece en pestaña Templates con badge "draft" y botón "🧪 Preview & Test" deshabilitado

[Sofia termina → handoff → contentReady = true]
→ botón "🧪 Preview & Test" se habilita en todas las cards
→ usuario abre modal, previsualiza con variants reales, envía test emails
→ elige la mejor template → click "⭐ Usar esta" → badge cambia a "final" (status=approved en DB)
```

## Archivos a modificar

| Archivo | Cambio |
|---|---|
| `apps/dashboard/src/components/EmailBuilderPreview.jsx` | Toolbar + popover save |
| `apps/dashboard/src/pages/EmailStudioPage.jsx` | Templates tab real |
| `apps/dashboard/server.js` | PATCH + DELETE `/api/emails/:id` |
| `apps/dashboard/src/i18n/translations.js` | 10 claves nuevas |
| `apps/dashboard/src/index.css` | Estilos popover + template list |

## Verificación

1. Click "💾 Save" → popover aparece, escribo nombre, confirmo → toast "Template guardada ✓"
2. Voy a pestaña Templates → card aparece con nombre correcto, badge "draft", botón Preview & Test disabled
3. Simular `contentReady = true` en estado → botón Preview & Test se activa
4. Click Preview & Test en la card → VariantPreviewModal abre con el HTML de esa template
5. Click "⭐ Usar esta" en una card → badge cambia a "final", las demás vuelven a "draft"
6. Renombrar template inline → Enter → nombre actualizado en DB
7. Borrar template → confirmación inline → desaparece de la lista
8. Crear 3 templates → lista muestra las 3, solo una puede ser "final"
