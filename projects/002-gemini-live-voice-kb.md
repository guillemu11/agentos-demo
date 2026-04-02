# Plan: Gemini 3.1 Flash Live — Speech-to-Speech en KB Chat

## Context

El usuario vio un video de Nate Herk mostrando Gemini 3.1 Flash Live (speech-to-speech real via WebSocket). Quiere integrarlo primero en el Knowledge Base chat y despues en todos los chats. Esto corresponde a **Phase 6 del PDR**: "Gemini Voice real-time in all chats".

**Problema actual:** El voice actual usa un pipeline indirecto: Browser STT (Web Speech API) -> texto -> Claude -> texto -> Browser TTS. No es speech-to-speech real.

**Objetivo:** Audio raw del microfono va directo a Gemini via WebSocket, Gemini responde con audio nativo. Con RAG via function calling para que las respuestas esten fundamentadas en la KB.

## Decisiones del usuario

1. Speech-to-speech completo (no STT/TTS intermedio)
2. RAG con function calling (Gemini busca en Pinecone dinamicamente)
3. UI: Boton mic en KBChat + VoiceOverlay fullscreen adaptado para KB
4. Server WebSocket Proxy (API key segura en servidor)

## Arquitectura

```
Browser (mic PCM 16kHz) --WebSocket--> Express /ws/voice-kb --SDK--> Gemini Live API
Browser (Web Audio API)  <--WebSocket-- Express              <--SDK-- Gemini Live API
                                            |
                                       RAG Pipeline
                                    (searchKnowledge via
                                     function calling)
```

## Archivos a modificar/crear

| Archivo | Accion | Descripcion |
|---------|--------|-------------|
| `apps/dashboard/server.js` | MODIFY | Nuevo WS endpoint `/ws/voice-kb` + handler `handleVoiceKB()` |
| `apps/dashboard/src/hooks/useGeminiLive.js` | CREATE | Hook: audio capture, WebSocket, playback, state |
| `apps/dashboard/src/components/KBVoiceOverlay.jsx` | CREATE | Overlay fullscreen adaptado para KB con fuentes RAG |
| `apps/dashboard/src/components/KBChat.jsx` | MODIFY | Agregar boton mic + render del overlay |
| `apps/dashboard/src/i18n/translations.js` | MODIFY | Keys de voz ES + EN |
| `apps/dashboard/src/index.css` | MODIFY | CSS para boton mic y fuentes RAG en overlay |

## Implementacion paso a paso

### Step 1: Server — Endpoint `/ws/voice-kb` (server.js)

**1.1 Modificar upgrade handler (linea 3980)**

Agregar `/ws/voice-kb` a la condicion existente:

```javascript
if (url.pathname === '/ws/voice' || url.pathname === '/ws/voice-meeting' || url.pathname === '/ws/voice-kb') {
```

**1.2 Agregar routing en connection handler (despues de linea 3995)**

Despues del check de `isMeeting`, antes de la logica de `/ws/voice`:

```javascript
if (url.pathname === '/ws/voice-kb') {
    return handleVoiceKB(ws, url);
}
```

**1.3 Implementar funcion `handleVoiceKB(ws, url)` (~130 lineas)**

Insertar antes de la seccion de Meeting REST Endpoints. Patron existente de referencia: `handleVoiceMeeting` (linea 4071+).

Flujo:
1. Leer query params: `namespace` (filtro KB), `lang` (default 'es')
2. Verificar que Gemini y KB esten listos (`isKBReady()` + `getGeminiClient()`)
3. Crear sesion Gemini Live:
   ```javascript
   const gemini = getGeminiClient();
   const session = await gemini.live.connect({
       model: GEMINI_LIVE_MODEL, // constante facil de actualizar
       config: {
           responseModalities: ['AUDIO'],
           systemInstruction: systemPromptKB,
           tools: [{ functionDeclarations: [searchKnowledgeTool] }],
           speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Aoede' } } },
           inputAudioTranscription: {},
           outputAudioTranscription: {},
       },
       callbacks: { onopen, onmessage, onerror, onclose }
   });
   ```
4. `onmessage` handler procesa `LiveServerMessage`:
   - `serverContent.modelTurn.parts` con `inlineData` -> relay audio como `{ type: 'audio', data, mimeType }`
   - `serverContent.inputTranscription` -> relay como `{ type: 'input-transcript', text }`
   - `serverContent.outputTranscription` -> relay como `{ type: 'output-transcript', text }`
   - `serverContent.turnComplete` -> enviar `{ type: 'turn-complete' }`
   - `serverContent.interrupted` -> enviar `{ type: 'interrupted' }`
   - `toolCall.functionCalls` -> ejecutar RAG, enviar `{ type: 'searching' }`, luego `session.sendToolResponse()`, despues `{ type: 'rag-sources', sources }`
   - `goAway` -> enviar `{ type: 'warning', timeLeft }`
5. Recibir mensajes del cliente:
   - `{ type: 'audio', data, mimeType }` -> `session.sendRealtimeInput({ audio: { data, mimeType } })`
   - `{ type: 'text', text }` -> `session.sendClientContent({ turns: [{ role: 'user', parts: [{ text }] }], turnComplete: true })`
   - `{ type: 'ping' }` -> `ws.send(JSON.stringify({ type: 'pong' }))`
6. Cleanup: `ws.on('close')` cierra sesion Gemini, `session.onclose` notifica al cliente

**Funcion declarada para RAG (function calling):**

```javascript
const searchKnowledgeTool = {
    name: 'searchKnowledge',
    description: 'Search the knowledge base for relevant information about campaigns, emails, KPIs, research, brand guidelines, and images',
    parameters: {
        type: 'OBJECT',
        properties: {
            query: { type: 'STRING', description: 'The search query based on what the user is asking about' },
        },
        required: ['query']
    }
};
```

Cuando Gemini invoca `searchKnowledge`:
```javascript
const { context, sources } = await buildRAGContext(pool, query, {
    namespaces: namespace ? [namespace] : NAMESPACES,
    maxTokens: 1500
});
session.sendToolResponse({
    functionResponses: [{
        id: functionCall.id,
        name: functionCall.name,
        response: { result: context || 'No relevant information found.' }
    }]
});
ws.send(JSON.stringify({ type: 'rag-sources', sources }));
```

**Constante de modelo (facil de actualizar):**
```javascript
const GEMINI_LIVE_MODEL = 'gemini-2.0-flash-live-001';
// TODO: Actualizar a 'gemini-3.1-flash-live-preview' cuando este disponible en SDK
```

> **Nota sobre modelo:** El SDK v1.47.0 muestra `gemini-live-2.5-flash-preview`. El video habla de "3.1 Flash Live". Usaremos el modelo que funcione y lo actualizaremos. La constante hace esto trivial.

**System prompt para KB voice:**
```
You are the Knowledge Base voice assistant for AgentOS. You help users find and understand information from their knowledge base which includes campaigns, emails, KPIs, research, and brand guidelines.

When the user asks a question, use the searchKnowledge tool to find relevant information before answering. Base your responses on the retrieved knowledge. If no relevant information is found, say so honestly.

Keep responses concise and conversational (2-4 sentences). Respond in the same language the user speaks.
```

### Step 2: Client — Hook `useGeminiLive.js` (NUEVO, ~200 lineas)

**Path:** `apps/dashboard/src/hooks/useGeminiLive.js`

**API del hook:**
```javascript
export function useGeminiLive({ namespace, lang, onSources })
// Returns: { status, inputTranscript, outputTranscript, sources, error,
//            connect, disconnect, toggleMute, isMuted }
```

**2.1 Audio capture:**
- `getUserMedia({ audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true, noiseSuppression: true } })`
- `AudioContext({ sampleRate: 16000 })` + `AudioWorkletNode` (processor inline via Blob URL)
- Processor emite chunks cada ~150ms (2400 samples a 16kHz)
- Convierte Float32 -> Int16 PCM -> base64 -> enviar como `{ type: 'audio', data, mimeType: 'audio/pcm;rate=16000' }`
- Fallback a `ScriptProcessorNode` si `audioWorklet` no existe (Safari viejo)

**2.2 Audio playback:**
- `AudioContext` separado para playback (sample rate puede ser distinto al de capture)
- Recibir `{ type: 'audio', data, mimeType }` -> decode base64 -> Int16 a Float32 -> `AudioBuffer` -> queue secuencial con `AudioBufferSourceNode`
- Queue system: array de buffers, play secuencial via `onended` callback
- En `interrupted`: limpiar queue, stop playback actual

**2.3 WebSocket:**
- URL construction: mismo patron que `useGeminiVoice.js` lineas 37-50, pero endpoint `/ws/voice-kb`
- Query params: `?namespace=X&lang=Y`
- Message dispatch segun `type`: audio, input-transcript, output-transcript, turn-complete, interrupted, searching, rag-sources, error, session-closed, warning

**2.4 Estados:**
- `idle` -> `connecting` -> `connected` -> `listening` (mic active)
- `listening` <-> `speaking` (based on audio queue + turn-complete)
- `listening` -> `searching` (RAG in progress) -> `speaking` (results back)
- Any -> `error` (on failure)

**2.5 Cleanup (disconnect):**
- Stop mic stream tracks
- Disconnect AudioWorklet
- Close capture + playback AudioContexts
- Close WebSocket
- Reset all state

**2.6 toggleMute:**
- Disable/enable mic track (`track.enabled = false/true`)
- No cierra la sesion, solo silencia el mic

### Step 3: Client — Componente `KBVoiceOverlay.jsx` (NUEVO, ~100 lineas)

**Path:** `apps/dashboard/src/components/KBVoiceOverlay.jsx`

Reutiliza CSS classes de `VoiceOverlay.jsx` (voice-overlay, voice-overlay-content, etc.) con adiciones KB-specific.

**Props:** `{ namespace, onClose }`

**Estructura:**
```jsx
<div className="voice-overlay">
  <div className="voice-overlay-content">
    {/* Status */}
    <div className="voice-overlay-status">
      {statusIcon} <span>{statusText}</span>
    </div>

    {/* Avatar - Database icon instead of emoji */}
    <div className={`voice-overlay-avatar ${status === 'speaking' ? 'speaking' : ''}`}>
      <Database size={32} />
      {status === 'speaking' && <rings />}
    </div>

    <h3 className="voice-overlay-name">{t('knowledge.chat.title')}</h3>

    {/* RAG sources indicator */}
    {sources.length > 0 && (
      <div className="voice-kb-sources">
        {sources.slice(0, 3).map(s => (
          <span className="voice-kb-source-tag">{s.namespace}: {(s.score * 100).toFixed(0)}%</span>
        ))}
      </div>
    )}

    {/* Transcripts */}
    <div className="voice-overlay-transcript">
      {inputTranscript && <div className="voice-transcript-user">...</div>}
      {outputTranscript && <div className="voice-transcript-ai">...</div>}
      {status === 'searching' && <div className="voice-transcript-system">{t('knowledge.voice.searching')}</div>}
    </div>

    {/* Controls: mute + hangup */}
    <div className="voice-overlay-controls">
      <button onClick={toggleMute}>{isMuted ? <MicOff/> : <Mic/>}</button>
      <button className="end-call" onClick={handleClose}><PhoneOff/></button>
    </div>

    {/* Error display */}
    {error && <div className="voice-kb-error">{error}</div>}
  </div>
</div>
```

**Lifecycle:** Auto-connect on mount, cleanup on unmount (mismo patron que VoiceOverlay lineas 26-30).

### Step 4: Modificar `KBChat.jsx`

Cambios minimos y quirurgicos:

**4.1 Imports (linea 4):**
Agregar `Mic` a los lucide imports, agregar import de KBVoiceOverlay.

**4.2 State (despues de linea 24):**
```javascript
const [voiceActive, setVoiceActive] = useState(false);
```

**4.3 Boton mic en input row (linea 322-338):**
Agregar boton mic entre el input y el boton send:
```jsx
<button
    className="kb-voice-btn"
    onClick={() => setVoiceActive(true)}
    disabled={streaming}
    title={t('knowledge.voice.mode')}
>
    <Mic size={16} />
</button>
```

**4.4 Overlay render (despues de linea 340):**
Wrappear return en fragment `<>...</>` y agregar:
```jsx
{voiceActive && (
    <KBVoiceOverlay
        namespace={namespace}
        onClose={() => setVoiceActive(false)}
    />
)}
```

### Step 5: i18n — translations.js

**Espanol (despues de `mediaResults` ~linea 234):**
```javascript
voice: {
    mode: 'Modo voz',
    searching: 'Buscando en la base de conocimiento...',
    error: 'Error en la sesion de voz',
    notAvailable: 'Voz no disponible. Verifica que Gemini este configurado.',
    sessionExpiring: 'La sesion de voz expirara pronto',
    micPermission: 'Se requiere permiso de microfono',
},
```

**Ingles (despues de `mediaResults` ~linea 1377):**
```javascript
voice: {
    mode: 'Voice mode',
    searching: 'Searching the knowledge base...',
    error: 'Voice session error',
    notAvailable: 'Voice not available. Check Gemini configuration.',
    sessionExpiring: 'Voice session will expire soon',
    micPermission: 'Microphone permission required',
},
```

### Step 6: CSS — index.css

Agregar despues de los estilos de `.voice-ctrl-btn`:

```css
/* KB Voice Button in chat input */
.kb-voice-btn {
    background: var(--bg-main);
    border: 1px solid var(--border-light);
    color: var(--text-secondary);
    border-radius: 10px;
    padding: 10px;
    cursor: pointer;
    display: flex;
    align-items: center;
    transition: all 0.15s ease;
}
.kb-voice-btn:hover {
    color: var(--primary);
    border-color: var(--primary);
    background: var(--bg-hover);
}
.kb-voice-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
}

/* RAG sources in voice overlay */
.voice-kb-sources {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    justify-content: center;
    margin: 8px 0;
}
.voice-kb-source-tag {
    font-size: 0.7rem;
    padding: 3px 8px;
    background: var(--bg-hover);
    border: 1px solid var(--border-light);
    border-radius: 12px;
    color: var(--text-secondary);
}
.voice-kb-error {
    color: var(--error, #ef4444);
    font-size: 0.78rem;
    margin-top: 8px;
    text-align: center;
}
```

## Riesgo: Modelo disponible

El SDK v1.47.0 muestra modelos `gemini-live-2.5-flash-preview` y `gemini-2.0-flash-live-preview-04-09`. El video habla de "Gemini 3.1 Flash Live" que puede tener un nombre distinto. Mitigacion: constante `GEMINI_LIVE_MODEL` facil de cambiar. Probaremos con el modelo disponible y actualizaremos.

## Orden de ejecucion

1. **server.js** — upgrade path + routing + `handleVoiceKB()` (testeable con wscat)
2. **useGeminiLive.js** — hook completo con audio capture/playback
3. **KBVoiceOverlay.jsx** — componente overlay
4. **KBChat.jsx** — boton mic + overlay trigger
5. **translations.js** — keys i18n
6. **index.css** — estilos

## Verificacion

1. **Server:** Conectar con wscat a `/ws/voice-kb`, verificar `{ type: 'ready' }` response
2. **Text fallback:** Enviar `{ type: 'text', text: 'Que campanas hay?' }`, verificar RAG search + respuesta
3. **Audio round-trip:** Enviar audio PCM chunk, verificar respuesta de audio
4. **Transcripts:** Verificar que llegan `input-transcript` y `output-transcript`
5. **RAG sources:** Preguntar algo del KB, verificar `rag-sources` con metadata
6. **Interruption:** Hablar mientras AI responde, verificar que para el playback
7. **Namespace filter:** Seleccionar namespace en KBChat, abrir voz, verificar busqueda filtrada
8. **i18n:** Cambiar ES/EN, verificar todos los textos
9. **Cleanup:** Abrir y cerrar overlay, verificar no hay streams de audio leaked
10. **Error path:** Iniciar sin GEMINI_API_KEY, verificar mensaje de error
