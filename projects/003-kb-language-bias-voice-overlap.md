# Proyecto 003: Fix KB Chat — Language Bias + Voice Overlap

## Context

Dos bugs en el chat de Knowledge Base:
1. **Idioma**: El usuario habla/escribe en inglés pero el asistente KB responde en español
2. **Solapamiento de voces**: Las voces se solapan durante sesiones de voz, haciendo las respuestas difíciles de escuchar

## Root Causes

### Language bias
- El contexto RAG en `retrieval.js` usa etiquetas en español (`CONOCIMIENTO RELEVANTE`, `Fuente:`, `Página`, etc.) que sesgan al LLM a responder en español
- El handler de voz (`server.js:4298`) captura el parámetro `lang` del frontend pero **nunca lo usa** en el system prompt
- El chat de texto no recibe `lang` del frontend

### Voice overlap
- `statusRef.current` se actualiza via `useEffect` (async, después del render de React), pero `shouldSendAudio()` lo chequea sincrónicamente
- Cuando llega audio: se llama `setStatus('speaking')` pero `statusRef.current` sigue en `'listening'` hasta el siguiente render → el mic sigue enviando → Gemini escucha su propia salida → eco/solapamiento
- No hay cooldown entre "terminó de hablar" y "mic se reanuda" → el audio residual del speaker es capturado

## Plan de implementación

### Issue 1: Language (4 archivos)

**Step 1 — `packages/core/knowledge/retrieval.js`**: Cambiar etiquetas RAG de español a inglés
- Línea 210: `[CONOCIMIENTO RELEVANTE - Base de Datos Interna]` → `[RELEVANT KNOWLEDGE - Internal Database]`
- Línea 221: `Fuente:` → `Source:`, `[IMAGEN:` → `[IMAGE:`
- Línea 230: `Fuente:` → `Source:`, `Página` → `Page`
- Línea 237: `[PÁGINA VISUAL:` → `[VISUAL PAGE:`
- Línea 241: `Fuente:` → `Source:`
- Línea 257: `[FIN CONOCIMIENTO RELEVANTE]` → `[END RELEVANT KNOWLEDGE]`

**Step 2 — `apps/dashboard/server.js` (text chat)**: Actualizar referencias de etiquetas en visual instruction
- Línea 3865: `[PÁGINA VISUAL: url]` → `[VISUAL PAGE: url]`, `[IMAGEN: url]` → `[IMAGE: url]`

**Step 3 — `apps/dashboard/src/components/KBChat.jsx`**: Pasar `lang` al API
- Línea 12: destructurar `lang` de `useLanguage()`
- Línea 71: agregar `lang` al body del request

**Step 4 — `apps/dashboard/server.js` (text chat)**: Usar `lang` en system prompt
- Línea 3849: destructurar `lang` de `req.body`
- Agregar directiva explícita de idioma basada en el valor de `lang`, antepuesta al system prompt

**Step 5 — `apps/dashboard/server.js` (voice chat)**: Usar `lang` en voice system prompt
- Antes de línea 4310: construir `voiceLangInstruction` desde `lang`
- Concatenar a `systemPromptKB` después de la regla 6

### Issue 2: Voice Overlap (`useGeminiLive.js`)

**Step 6** — `case 'audio'` (línea 288): Agregar `statusRef.current = 'speaking'` ANTES de `setStatus('speaking')` — guard sincrónico inmediato

**Step 7** — `case 'searching'` (línea 327): Agregar `statusRef.current = 'searching'` ANTES de `setStatus('searching')`

**Step 8** — `case 'interrupted'` (línea 322): Agregar `statusRef.current = 'listening'` update sincrónico

**Step 9** — `playNext()` branch de turn-complete (línea 108-113): Agregar delay de 400ms antes de setear status a `'listening'` — deja que el audio residual del speaker se disipe antes de reabrir el gate del mic

**Step 10** — `case 'turn-complete'` branch inline (línea 313-318): Mismo delay de 400ms

## Archivos críticos

- `packages/core/knowledge/retrieval.js`
- `apps/dashboard/server.js`
- `apps/dashboard/src/components/KBChat.jsx`
- `apps/dashboard/src/hooks/useGeminiLive.js`

## Verificación

- Chat texto en inglés → respuesta debe ser en inglés
- Chat texto en español → respuesta debe ser en español
- Voz en inglés (lang=en) → respuesta hablada en inglés
- Voz en español (lang=es) → respuesta hablada en español
- Voz: sin eco/solapamiento durante conversación normal
- Voz: interrupción limpia (sin playback residual)
- Visual queries siguen embeddiendo imágenes/PDFs correctamente
