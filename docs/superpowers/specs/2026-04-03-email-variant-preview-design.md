# Email Studio — Variant Preview & Test

**Date:** 2026-04-03  
**Status:** Approved for implementation

---

## Context

El Email Studio permite diseñar templates HTML con variables SFMC (`%%=v(@main_header)=%%`). El Content Agent genera el copy real por variante (`market:tier`: EN·Economy, ES·Business, etc.). Hasta ahora no existe ningún mecanismo para ver la template con el contenido real antes de exportar, ni para enviar tests por variante.

El problema: el diseño del email puede terminar antes que el contenido. Necesitamos que el diseñador pueda guardar la template, esperar a que el Content Agent finalice, y luego previsualizar y testear cada variante con contenido real.

---

## Decisiones de diseño

| Decisión | Elección | Razón |
|---|---|---|
| ¿Dónde merge template+contenido? | Dentro del Email Studio | Todo en un lugar, feedback inmediato |
| Mapeo de variables | Fixed mapping hardcoded | Simple, sin fricción para el usuario |
| Interaction preview vs. envío | Click=preview · Checkbox=cola de envío | Un clic por acción, diferenciado por color |

---

## Variable Mapping (fijo)

```js
const CONTENT_TO_SFMC = {
  heroHeadline: '@main_header',
  preheader:    '@preheader',
  cta:          '@main_cta',
  bodyCopy:     '@body_copy',
  subject:      null, // metadata, no es var HTML
};
```

La sustitución: `%%=v(@main_header)=%%` → valor de `heroHeadline` de la variante activa.

---

## Arquitectura

### 1. EmailBuilderPreview.jsx — toolbar con dos estados

**Estado A: Content Agent aún trabajando**
- Selector de variante deshabilitado con badge amarillo "Content Agent en progreso — X/10 bloques aprobados"
- Botón "Preview & Test" deshabilitado (gris)
- Botón "Guardar template" activo (azul) — guarda el HTML actual como draft en `email_proposals`
- Preview sigue mostrando las variables SFMC como placeholders

**Estado B: Contenido aprobado**
- Selector de variante habilitado (dropdown) con badge verde "10/10 bloques aprobados"
- Muestra `market · tier` (ej. "EN · Economy")
- Al cambiar variante: sustituye variables SFMC en el HTML y re-renderiza el iframe
- Botón "Preview & Test" activo (morado) → abre `VariantPreviewModal`
- Botón "Exportar HTML" activo (azul)

**Detección de contenido disponible:**
- Al cargar `EmailStudioPage`, hace GET `/api/projects/:id/content-variants`
- Si hay variantes con todos los campos `approved` → estado B
- Si no → estado A
- `projectId` viene del pipeline context ya disponible en el componente

### 2. Utilidad: substituteVariants(html, variant)

```js
// utils/emailVariants.js
export function substituteVariants(html, variant) {
  return html
    .replace(/%%=v\(@main_header\)=%%/g, variant.heroHeadline?.value ?? '')
    .replace(/%%=v\(@preheader\)=%%/g,   variant.preheader?.value ?? '')
    .replace(/%%=v\(@main_cta\)=%%/g,    variant.cta?.value ?? '')
    .replace(/%%=v\(@body_copy\)=%%/g,   variant.bodyCopy?.value ?? '');
}
```

Se ejecuta en cliente, sin llamada al servidor. Resultado va al `srcDoc` del iframe.

### 3. VariantPreviewModal.jsx — nuevo componente

**Layout:** modal full-screen, dos columnas.

**Columna izquierda — lista de variantes:**
- Una card por variante disponible (`market:tier`)
- Click en card → selecciona para preview (borde azul + badge "👁 Previewing")
- Checkbox en esquina superior derecha → añade a cola de envío (borde morado + badge "📤 En cola")
- Ambas acciones son independientes (puedes tener una variante en preview sin añadirla al envío y viceversa)

**Columna derecha — live preview:**
- Iframe con `srcDoc` = `substituteVariants(html, selectedVariant)`
- Se actualiza instantáneamente al cambiar la variante activa en preview

**Footer del modal:**
- Input email de destino
- Botón "Enviar N tests" donde N = número de variantes con checkbox activo
- Llama `POST /api/emails/send-test` N veces (una por variante) con el HTML sustituido

### 4. API: GET /api/projects/:id/content-variants

Nuevo endpoint en `server.js`. Consulta las `pipeline_agent_sessions` del proyecto donde el agente es Content Agent, extrae el campo `variants` del context JSON, y devuelve las variantes aprobadas.

```sql
SELECT context 
FROM project_agent_sessions 
WHERE project_id = $1 
  AND agent_id = 'lucia'
  AND status = 'completed'
ORDER BY created_at DESC 
LIMIT 1;
```

Respuesta:
```json
{
  "ready": true,
  "variants": {
    "en:economy": { "heroHeadline": { "status": "approved", "value": "Fly to Dubai" }, ... },
    "es:economy": { ... }
  },
  "approvedCount": 10,
  "totalCount": 10
}
```

### 5. Guardar template — tabla email_proposals

El botón "Guardar template" hace `POST /api/projects/:id/emails` con el HTML actual y `status: 'draft'`. Endpoint ya existe. No hay cambios en el backend.

---

## Data flow completo

```
ContentStudioPage (Lucia) → pipeline_agent_sessions.context.variants
                                        ↓
EmailStudioPage carga → GET /api/projects/:id/content-variants
                                        ↓
         ¿variants aprobadas?
              ↙              ↘
           No                 Sí
   Estado A: waiting      Estado B: selector activo
   "Guardar template"     substituteVariants(html, variant)
                                        ↓
                          VariantPreviewModal
                          click=preview | checkbox=send queue
                                        ↓
                          POST /api/emails/send-test × N variantes
```

---

## Archivos a modificar / crear

| Archivo | Acción |
|---|---|
| `apps/dashboard/src/components/EmailBuilderPreview.jsx` | Añadir toolbar estados A/B + variant selector |
| `apps/dashboard/src/components/VariantPreviewModal.jsx` | Nuevo componente |
| `apps/dashboard/src/utils/emailVariants.js` | Nuevo — función substituteVariants |
| `apps/dashboard/server.js` | Añadir `GET /api/projects/:id/content-variants` |
| `apps/dashboard/src/i18n/translations.js` | Añadir textos nuevos ES+EN |

---

## Verificación

1. Crear proyecto con Content Agent completado (variantes aprobadas en DB)
2. Abrir Email Studio para ese proyecto → toolbar debe mostrar Estado B con dropdown
3. Cambiar variante en dropdown → iframe debe re-renderizar con contenido real
4. Abrir VariantPreviewModal → click en variante cambia preview; checkbox marca para envío
5. Enviar test con 2 variantes → recibir 2 emails distintos en inbox
6. Repetir con proyecto sin Content Agent completado → debe mostrar Estado A (bloqueado)
