# Content Studio — Variables Dinámicas + Preview Fix

**Fecha:** 2026-04-07  
**Ticket:** Content Studio ID 60  
**Estado:** Aprobado para implementación

---

## Contexto

El Content Studio permite a Lucía (agente de contenido) generar variables para templates de email AMPscript. El problema: Lucía genera contenido en el chat correctamente pero (1) el preview no se actualiza con los valores, (2) el tab Content solo muestra 5 campos hardcodeados ignorando las ~25 variables reales del template, y (3) las variables de imagen y personalización no están diferenciadas por categoría.

**Causa raíz:** El formato de salida que Lucía usa no coincide con lo que los parsers esperan, y la arquitectura de cards es estática en lugar de data-driven desde el template HTML.

**Decisión de diseño:** Unificar todo por el mecanismo `[BRIEF_UPDATE]` — que ya funciona — en lugar de mantener `[EMAIL_VARIABLES]` roto. Esto porta información de variante (idioma+clase), permite Approve/Regenerate por card, y alimenta el preview en vivo.

---

## Cambios por archivo

### 1. `apps/dashboard/server.js` — System prompt de Lucía (~línea 6535)

**Reemplazar** la instrucción `[EMAIL_VARIABLES]` por `[BRIEF_UPDATE]`:

```
When providing content for variables, emit one tag per variable:
[BRIEF_UPDATE:{"variant":"en:economy","block":"story1_header","status":"approved","value":"Dive into Entertainment"}]

Rules:
- The variant is always the active market:tier from the session context (injected as [Campaign: ... — Active Market: en])
- Emit ALL text variables from the template (not just subject/preheader)
- Do NOT emit image variables, link aliases, or footer variables
- Emit after generating, not before
```

**Eliminar:**
- Función `parseEmailVariables()` (~línea 356)
- Función `parseContentByBlock()` (~línea 374)
- Bloque `isLuciaResponse` que emite `var_update` SSE events (~línea 7007-7049)
- El modo `[CONTENT_BY_BLOCK]` del fallback sin HTML (~línea 6546-6558)

### 2. `apps/dashboard/src/components/studio/studioConstants.js`

**Añadir** función de categorización de variables:

```js
export const IMAGE_VAR_PATTERN = /image|img|logo|banner|photo|pic/i;

export const PERSONALIZATION_VARS = [
  'firstname', 'lastname', 'loyalty_tier', 'miles_balance',
  'booking_ref', 'departure', 'arrival', 'travel_date',
  'tier_name', 'account_number', 'expiry_date',
];

export const LINK_VAR_PATTERN = /(_alias|_link|_url)$/i;
export const FOOTER_VAR_PATTERN = /^(unsub|contactus|privacy|vawp|join_skw)/i;

export function categorizeVar(varName) {
  if (IMAGE_VAR_PATTERN.test(varName)) return 'image';
  if (PERSONALIZATION_VARS.includes(varName)) return 'personalization';
  if (LINK_VAR_PATTERN.test(varName)) return 'link';
  if (FOOTER_VAR_PATTERN.test(varName)) return 'footer';
  return 'content';
}
```

**Eliminar:** `FIELD_TO_VAR` y `ALL_VARIANT_FIELDS` (reemplazados por categorización dinámica).  
**Mantener:** `IMAGE_SLOT_NAMES`, `MIN_APPROVED_FOR_HANDOFF`.

### 3. `apps/dashboard/src/components/studio/VariantFieldsGrid.jsx`

**Reescribir** para ser data-driven. Props nuevas:

```
Props:
  variantData: object     — variants[market:tier], puede ser null
  allVarNames: string[]   — variables de tipo "content" del template
  onApprove: (block, value) => void
  onRegenerate: (block) => void
```

Cada card:
- Nombre de variable legible (`story1_header` → `Story 1 Header`)
- Status badge (pending / generating / ✓)
- Valor actual editable inline (textarea)
- Botones: ✓ Approve | ↺ Regenerate

Si `allVarNames` está vacío → fallback a las 5 variables base para compatibilidad.

### 4. `apps/dashboard/src/components/studio/StudioVariantsPanel.jsx`

**Mover** selector Market + Tier fuera de `{activeTab === 'content'}` — compartido entre los 3 tabs.

**Tab Content:** `<VariantFieldsGrid>` con `allVarNames` derivado de `blockVarMap` filtrado a categoría `content`.

**Tab Images:** `<ImageSlotsManager>` sin cambios, ahora también tiene selector de variante visible.

**Tab AMPscript:** Lista readonly de variables de personalización con botón Copy. Formato: `%%=v(@firstname)=%%`. Con selector de variante para contexto visual.

### 5. `apps/dashboard/src/pages/ContentStudioPage.jsx`

**En `liveHtml` useMemo:** Loop sobre todos los campos de `variantData` en lugar de solo `FIELD_TO_VAR`:

```js
// Antes:
Object.entries(FIELD_TO_VAR).forEach(([field, varName]) => {
  if (variantData[field]?.value) merged[varName] = variantData[field].value;
});

// Después:
Object.entries(variantData).forEach(([field, fieldData]) => {
  if (fieldData?.value) merged[`@${field}`] = fieldData.value;
});
```

**Eliminar:** `handleVarChange`, prop `onVarUpdate` al `<StudioChatPanel>`.

**En `progressStats`:** Contar sobre variables dinámicas de `blockVarMap` (categoría `content`) en lugar de `ALL_VARIANT_FIELDS`.

### 6. `apps/dashboard/src/components/studio/StudioChatPanel.jsx`

**Eliminar:** prop `onVarUpdate` y el handler `if (parsed.var_update)`.

---

## Flujo de datos final

```
Lucía → [BRIEF_UPDATE:{"variant":"en:economy","block":"story1_header","status":"approved","value":"..."}]
→ parseBriefUpdates() [StudioChatPanel.jsx — sin cambios]
→ onBriefUpdate() [ContentStudioPage.jsx — sin cambios]
→ variants["en:economy"]["story1_header"] = { status: "approved", value: "..." }
→ liveHtml useMemo [ACTUALIZADO] → %%=v(@story1_header)=%% sustituido en iframe
→ VariantFieldsGrid [NUEVO] → card story1_header muestra valor con ✓
```

---

## Categorización de variables (ejemplo Emirates template)

| Variable | Categoría | Tab destino |
|----------|-----------|-------------|
| `hero_image`, `story1_image`, `header_logo` | image | Images |
| `subject`, `preheader`, `main_header`, `story1_header`, `offer_block_body` | content | Content |
| `hero_image_link_alias`, `body_link_alias` | link | oculto |
| `unsub_text`, `contactus_text`, `privacy_text` | footer | oculto |
| `firstname`, `loyalty_tier`, `miles_balance` | personalization | AMPscript |

---

## Verificación

1. Abrir Content Studio → Ticket ID 60
2. Pedir a Lucía: "Fill all variables for EN Economy"
3. Verificar: cards del tab Content se llenan con los valores generados
4. Verificar: preview en vivo sustituye `%%=v(@story1_header)=%%` con el valor generado
5. Verificar: tab Images tiene selector de variante visible
6. Verificar: tab AMPscript muestra solo variables de personalización en formato `%%=v(@firstname)=%%`
7. Cambiar a ES Economy → cards muestran estado pending (variante diferente, sin valores aún)
