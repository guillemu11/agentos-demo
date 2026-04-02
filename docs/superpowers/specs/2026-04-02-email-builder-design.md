# Email Builder — Design Spec
**Fecha:** 2026-04-02  
**Scope:** HtmlDeveloperView chat + PipelineBoard project detail tab "Emails"

---

## Contexto

El HTML Developer agent necesita una interfaz para crear emails desde cero via chat. La propuesta es un split view: chat a la izquierda, preview del email a la derecha que se actualiza en tiempo real. Adicionalmente, cuando un email se aprueba en el pipeline de un proyecto, aparece en un nuevo tab "Emails" dentro del detalle del proyecto donde se pueden navegar todas las versiones por mercado, idioma y tier.

---

## 1. Email Builder — HtmlDeveloperView

### Layout general
Split 50/50 horizontal: **Chat** (izquierda) | **Preview + Toolbar** (derecha).

### Panel izquierdo — Chat
- Chat conversacional estándar con el HTML Developer agent (mismo patrón que `AgentChat.jsx`)
- El usuario describe el email que quiere construir en lenguaje natural
- El agente responde con texto explicando qué está haciendo, y genera el HTML en background
- Click en cualquier bloque del preview **inyecta una mención del bloque en el input del chat** (e.g. `[bloque: CTA]`) y el agente pregunta qué cambiar — todo sigue siendo conversacional, sin editores inline

### Panel derecho — Preview
**Tabs en la toolbar superior:**
- `Preview` (activo por defecto) — iframe sandboxed con el email renderizado
- `HTML` — código fuente copiable
- `Versiones` — historial de iteraciones del email

**Toolbar superior del preview:**
| Botón | Acción |
|-------|--------|
| 📱 / 🖥 | Toggle entre vista móvil (375px) y desktop (600px) |
| `</>` | Cambia al tab HTML |
| 🕐 | Cambia al tab Versiones |
| ⬇ | Descarga el HTML final |
| ✉ | Envía email de prueba a la dirección del usuario |
| ⛶ | Expande el preview a fullscreen (overlay) |

**Barra de estado inferior del preview:**
- Indicador live: qué bloque está siendo generado/actualizado
- Color: verde (estable) / amarillo (actualizando) / gris (inactivo)

### Comportamiento del preview — Patch inteligente
- El email completo siempre visible desde que existe una versión base
- Cuando el agente modifica un bloque, **solo ese bloque** se re-renderiza con un highlight temporal (glow de color acento ~1.5s) y luego se estabiliza
- Los demás bloques permanecen estables durante la edición
- El agente comunica por chat qué cambió: `"CTA actualizado — color cambiado a verde"`

### Interacción con bloques
- Hover sobre un bloque: outline sutil + cursor pointer
- Click en un bloque: inyecta `[bloque: NombreBloque]` en el input del chat y pone el foco en el input
- El agente detecta la mención y pregunta qué cambiar en ese bloque específico
- No hay editores de propiedades inline — toda edición pasa por conversación

---

## 2. Tab "Emails" en el detalle del proyecto (PipelineBoard)

### Cuándo aparece
Cuando un email generado por el HTML Developer agent es **aprobado** en el ticket de un proyecto, se añade automáticamente el tab "Emails" al detalle del proyecto (junto a Details, Pipeline, Worklog).

### Estructura del tab
```
[Details] [Pipeline] [Worklog] [Emails ●]
```

### Filtros dependientes (Mercado → Idioma → Tier)
Barra de filtros siempre visible con 3 secciones separadas por divisores verticales:

**Mercado** | **Idioma** | **Tier**

Comportamiento de los filtros:
- Las opciones **válidas** para la selección actual se muestran como pills activos/inactivos normales
- Las opciones **inválidas** (combinación no existente) se muestran en gris tachado con un aviso inline: `⚠ ES, FR, DE no disponibles para QR`
- Al cambiar mercado, idioma y tier se recalculan sus opciones válidas/inválidas en cascada
- Nunca se puede seleccionar una combinación inválida — el sistema previene el error visualmente antes de que ocurra

### Vista resultante
Debajo de los filtros: preview del email correspondiente a la selección activa + panel de metadata lateral.

**Preview:**
- Mismo iframe sandboxed que el builder
- Tabs: Preview / HTML / Historial
- Toggle 📱 / 🖥

**Metadata lateral:**
- Versión activa (ej: v3)
- Estado: Aprobada / En review / Draft
- Creada: timestamp + agente que la generó
- Resumen: "QR·EN·Business (esta) + 5 versiones más"
- Botones: `Abrir editor` → abre el Email Builder con este email cargado | `Exportar`

**Navegación entre versiones:**
- Botones `‹ anterior` / `siguiente ›` para iterar por versiones del mismo mercado·idioma·tier
- La barra de estado indica: `QR · EN · Business — versión v3 · Aprobada`

---

## 3. Modelo de datos — Email version

```js
{
  id: uuid,
  project_id: uuid,
  market: "QR",          // código de mercado
  language: "EN",        // código ISO
  tier: "Business",      // Business | Economy | First | ...
  version: 3,            // número incremental por combinación
  status: "approved",    // draft | review | approved | rejected
  html: "<html>...",     // HTML completo del email
  created_at: timestamp,
  created_by: "html-developer-agent",
  conversation_id: uuid  // referencia a la conversación que lo generó
}
```

La combinación `(project_id, market, language, tier)` tiene múltiples versiones numeradas. La versión con status `approved` más reciente es la activa.

Las combinaciones válidas por mercado se definen en la configuración del proyecto (o se infieren de las versiones existentes).

---

## 4. Integración con el pipeline existente

- El HTML Developer agent, al terminar un email, puede crear una tarjeta en el PipelineBoard con tipo `Email Proposal`
- Cuando esa tarjeta pasa a estado `Approved`, se dispara la creación del registro en la tabla de emails y aparece el tab "Emails" en el proyecto
- El botón `Abrir editor` en el tab Emails navega al HtmlDeveloperView con el email cargado y la conversación de contexto

---

## 5. Verificación

- [ ] Abrir HtmlDeveloperView → tab Chat → el split se renderiza correctamente
- [ ] Enviar mensaje al agente → el preview aparece con el email generado
- [ ] Click en un bloque del preview → el input del chat recibe la mención del bloque
- [ ] El agente modifica un bloque → solo ese bloque hace highlight, el resto permanece estable
- [ ] Toolbar: toggle 📱/🖥 cambia el ancho del iframe
- [ ] Toolbar: exportar descarga el HTML
- [ ] En PipelineBoard → abrir proyecto con emails aprobados → tab "Emails" aparece
- [ ] Filtros: seleccionar mercado QR → idiomas inválidos aparecen tachados con aviso
- [ ] No se puede seleccionar una combinación inválida
- [ ] Navegación ‹ › itera por versiones del mismo mercado·idioma·tier
