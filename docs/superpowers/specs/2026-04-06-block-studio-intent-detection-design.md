# Block Studio: Intent Detection por Selección de Canvas

**Fecha:** 2026-04-06  
**Estado:** Aprobado

## Problema

El AI no puede distinguir entre "modifica el bloque actual" y "crea un bloque nuevo" cuando el usuario escribe en lenguaje natural. Actualmente solo entra en PATCH mode cuando el mensaje contiene prefijos de texto como `[bloque: X]`, lo que obliga fricción al usuario o produce comportamientos incorrectos (crear duplicados en vez de patchear).

## Solución

Usar la **selección en canvas** como señal de intención. Si hay un bloque seleccionado → PATCH. Si no hay nada seleccionado → NEW_BLOCK. El estado de selección se pasa al servidor como `activeBlock` en el body del POST.

---

## Regla de oro

```
selectedCanvasBlock !== null  →  PATCH mode (modificar bloque activo)
selectedCanvasBlock === null  →  NEW_BLOCK mode (crear bloque nuevo)
```

---

## Estado: `selectedCanvasBlock`

- Añadir a `BlockStudioPage`: `const [selectedCanvasBlock, setSelectedCanvasBlock] = useState(null)`
- Tipo: `{ id, name, html }` | `null`
- Reemplaza el sistema de prefijos `[bloque: X]` en el chatInput

---

## Interacciones de selección

| Evento | Acción |
|--------|--------|
| Click en bloque del canvas | `setSelectedCanvasBlock(block)` |
| Click en área vacía del canvas | `setSelectedCanvasBlock(null)` |
| AI crea NEW_BLOCK | Auto-select: `setSelectedCanvasBlock(nuevoBloque)` |
| AI aplica PATCH exitoso | El bloque sigue seleccionado (sin cambio) |
| Usuario elimina bloque seleccionado | `setSelectedCanvasBlock(null)` |
| Usuario elimina bloque no seleccionado | Sin cambio en selección |

---

## Flujo de datos al AI

`AgentChat` recibe `activeBlock` (string | null) como prop adicional e incluye en el POST body:

```js
body: JSON.stringify({
  message: msg,
  activeBlock: activeBlock || null,
  ...(canvasBlocks?.length > 0 && { canvasBlocks: canvasBlocks.map(b => b.name) }),
})
```

### System prompt en server.js

Reemplazar la detección por prefijo de texto con inyección basada en `activeBlock`:

```
// Si req.body.activeBlock está presente:
"## Bloque activo: [activeBlock]
El usuario está trabajando sobre este bloque. Usa PATCH:
<!--PATCH:[activeBlock]-->[HTML completo del bloque modificado]
No crees bloques nuevos. Solo modifica el bloque indicado."

// Si NO hay activeBlock:
"## Sin bloque seleccionado
Si el usuario pide crear algo nuevo, usa NEW_BLOCK:
<!--NEW_BLOCK:NombreBloque-->[HTML del bloque]"
```

---

## Visual en canvas

- Bloque seleccionado: `box-shadow: 0 0 0 2px var(--primary)` + cursor pointer
- Estado neutro sin selección: comportamiento actual
- Click en área vacía del canvas wrapper → deselect
- El indicador de selección es **persistente** (no desaparece como el highlight de patch)

---

## Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `apps/dashboard/src/pages/BlockStudioPage.jsx` | Añadir `selectedCanvasBlock` state; pasar `activeBlock` y callbacks a componentes |
| `apps/dashboard/src/components/EmailBuilderPreview.jsx` | Click en bloque → `onBlockSelect(block)`; click en área vacía → `onBlockDeselect()`; estilos de selección |
| `apps/dashboard/src/components/agent-views/shared/AgentChatSwitcher.jsx` | Pasar `activeBlock` prop a `AgentChat` |
| `apps/dashboard/src/components/AgentChat.jsx` | Aceptar `activeBlock` prop; incluirlo en POST body; eliminar lógica de prefijo `[bloque: X]` |
| `apps/dashboard/server.js` | Leer `req.body.activeBlock`; inyectar instrucción PATCH/NEW_BLOCK en system prompt basado en este campo |

---

## Escenario de prueba

1. Canvas vacío → "create a survey block" → AI crea NEW_BLOCK → bloque aparece en canvas **seleccionado**
2. Con survey seleccionado → "add some color" → AI hace PATCH → bloque actualizado, sigue seleccionado
3. Click en área vacía → deseleccionado
4. "create a hero block" → AI crea NEW_BLOCK (no hay bloque activo) → hero aparece seleccionado
5. Click en survey block → seleccionado → "make the button bigger" → AI patchea survey

---

## Lo que se elimina

- Prefijo `[bloque: X]` en `onBlockClick` de `BlockStudioPage` (reemplazado por `setSelectedCanvasBlock`)
- Dependencia de texto en el mensaje para detectar PATCH vs NEW_BLOCK en el server prompt
