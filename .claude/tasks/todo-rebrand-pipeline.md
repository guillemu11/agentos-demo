# Email Rebrand Pipeline — Demo Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Habilitar en Email Studio un flujo end-to-end donde el usuario sube un email HTML existente, se decompone automáticamente en bloques nombrados, y puede rebrandearlo via chat con el html-developer agent (bloque por bloque o el email entero).

**Architecture:** Reutilizar 100% el chasis de Email Studio. Solo añadir (1) endpoint backend `POST /api/parse-html` que envuelve `splitIntoBlocks()` + naming async, (2) botón "Import HTML" en la toolbar de Email Studio que dispara file picker → upload → setea bloques en estado. El `onHtmlGenerated` callback ya hace decompose+naming desde generación AI; el upload reusa exactamente la misma lógica de seteo de estado. NO se crea pantalla nueva, NO se duplica componente, NO se toca Block Studio.

**Tech Stack:** Express 5 + multer (`kbUpload` ya configurado para `text/html`), React 19 con `useState`, `splitIntoBlocks()` existente en `apps/dashboard/src/utils/emailTemplate.js`, endpoint `/api/ai/name-email-blocks` ya existente para naming con Claude Haiku.

**Out of scope (NO hacer en este plan):**
- Persistir bloques individuales en DB (siguen como blob HTML en `emails.html_content`)
- Modificar Block Studio
- Cambiar el system prompt del html-developer (el rebrand quirúrgico ya funciona via `activeBlock` intent detection)
- Brief context pipeline / Sofia variants

---

## File Structure

**Backend (modify):**
- `apps/dashboard/server.js` — añadir endpoint `POST /api/parse-html` cerca del bloque de email blocks (línea ~4750, justo después de `/api/ai/name-email-blocks`)

**Frontend (modify):**
- `apps/dashboard/src/pages/EmailStudioPage.jsx` — añadir handler `handleImportHtml`, ref de input file, botón en toolbar
- `apps/dashboard/src/i18n/translations.js` — añadir 4 keys nuevas en `studio.*` (ES + EN)

**Frontend (no crear archivos nuevos):**
- Nada. Toda la UI vive dentro de EmailStudioPage.

---

## Task 1: Backend endpoint POST /api/parse-html

**Files:**
- Modify: `apps/dashboard/server.js` (insertar después de línea 4751, al final del bloque `/api/ai/name-email-blocks`)

**Context:** Necesitamos un endpoint que reciba un archivo HTML, extraiga los bloques top-level usando la misma lógica que el frontend (`splitIntoBlocks` está en utils/emailTemplate.js, JS puro), y devuelva los bloques con IDs. El naming lo hará el frontend llamando al endpoint existente `/api/ai/name-email-blocks` (que ya recibe `{blocks: [{id, html}]}`).

**Decisión clave:** El endpoint NO hace naming — solo parsing. Razón: separación de concerns y el frontend ya tiene el patrón `nameBlocksAsync(parsedBlocks)` ([EmailStudioPage.jsx:285-305](apps/dashboard/src/pages/EmailStudioPage.jsx#L285-L305)) que lanzamos después de setear bloques. Lo reutilizamos tal cual.

**Decisión clave 2:** Como `splitIntoBlocks` vive en `apps/dashboard/src/utils/emailTemplate.js` (frontend), tenemos que duplicar la lógica en el backend O exponerla. La opción más limpia: **portar la función a un módulo compartido** en `packages/core/email/split-blocks.js` que ambos lados importan. Pero esto añade scope. Para la demo, alternativa más simple: **el endpoint solo recibe el archivo, lo guarda temporal, y devuelve el HTML raw como string**. El frontend hace el split usando su propia copia. Esto evita duplicación de lógica de parsing.

**Vamos con la opción más simple: endpoint = upload + return raw HTML.** El frontend hace el split llamando `splitIntoBlocks(html)` localmente.

- [ ] **Step 1: Añadir el endpoint en server.js**

Insertar este código después de la línea 4751 (cierre del endpoint `/api/ai/name-email-blocks`):

```javascript
// POST /api/parse-html — Upload an HTML email file and return its raw content for client-side decomposition
app.post('/api/parse-html', requireAuth, kbUpload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

        // Read the uploaded file content
        const html = fs.readFileSync(req.file.path, 'utf8');

        // Cleanup temp file (best-effort)
        fs.unlink(req.file.path, () => {});

        if (!html || html.trim().length === 0) {
            return res.status(400).json({ error: 'Empty HTML file' });
        }

        // Sanity check: must look like HTML
        if (!html.toLowerCase().includes('<table') && !html.toLowerCase().includes('<body')) {
            return res.status(400).json({ error: 'File does not contain a valid email HTML structure' });
        }

        res.json({ html, filename: req.file.originalname });
    } catch (err) {
        console.error('[parse-html] Error:', err.message);
        if (req.file?.path) fs.unlink(req.file.path, () => {});
        res.status(500).json({ error: err.message });
    }
});
```

- [ ] **Step 2: Reiniciar el server (regla del usuario: auto-restart después de cambios backend)**

Run: `taskkill //F //IM node.exe 2>nul & npm start` (o el script `restart.bat` si está)
Expected: server arranca en puerto 3001 sin errors, log `[AI] ...` visible

- [ ] **Step 3: Smoke test del endpoint con curl**

Run desde otra terminal:
```bash
curl -X POST http://localhost:3001/api/parse-html \
  -F "file=@view_e_emirates_email (1).html" \
  -b "connect.sid=<cookie-de-sesion>"
```
Expected: JSON `{ "html": "<!DOCTYPE...", "filename": "view_e_emirates_email (1).html" }` con status 200

Si no tienes cookie a mano: alternativa rápida — temporalmente comentar `requireAuth` para el smoke test, y volver a poner.

- [ ] **Step 4: Commit**

```bash
git add apps/dashboard/server.js
git commit -m "feat(email-studio): POST /api/parse-html endpoint for importing external email HTML"
```

---

## Task 2: i18n keys para Import HTML

**Files:**
- Modify: `apps/dashboard/src/i18n/translations.js` (líneas ~1499 ES, ~3099 EN — sección `studio.*`)

**Context:** Regla crítica del proyecto: TODO texto visible debe estar en `translations.js` en ES y EN. Necesitamos 4 keys: el botón, el tooltip, el mensaje de éxito, y el mensaje de error.

- [ ] **Step 1: Añadir keys en bloque ES (después de línea 1499 `exportHtml`)**

Editar `apps/dashboard/src/i18n/translations.js`. Localizar la línea:
```javascript
      exportHtml: '↓ Exportar HTML',
```
(en el bloque `studio:` del lado ES, ~línea 1499)

E insertar inmediatamente después:
```javascript
      importHtml: '↑ Importar HTML',
      importHtmlHint: 'Sube un email HTML existente para descomponerlo en bloques editables',
      importHtmlSuccess: 'Email importado: {count} bloques detectados',
      importHtmlError: 'No se pudo importar el HTML. Verifica que sea un email válido.',
```

- [ ] **Step 2: Añadir las mismas keys en bloque EN (después de línea 3099 `exportHtml`)**

Localizar la línea:
```javascript
      exportHtml: '↓ Export HTML',
```
(en el bloque `studio:` del lado EN, ~línea 3099)

E insertar inmediatamente después:
```javascript
      importHtml: '↑ Import HTML',
      importHtmlHint: 'Upload an existing HTML email to decompose it into editable blocks',
      importHtmlSuccess: 'Email imported: {count} blocks detected',
      importHtmlError: 'Could not import the HTML. Make sure it is a valid email.',
```

- [ ] **Step 3: Verificar JSON-like sintaxis (no romper las comas)**

Run: `node -e "import('./apps/dashboard/src/i18n/translations.js').then(m => console.log('ES studio.importHtml:', m.translations.es.studio.importHtml, '| EN:', m.translations.en.studio.importHtml))"`

Expected output: `ES studio.importHtml: ↑ Importar HTML | EN: ↑ Import HTML`

Si falla: revisar comas trailing en ambos bloques.

- [ ] **Step 4: Commit**

```bash
git add apps/dashboard/src/i18n/translations.js
git commit -m "i18n(studio): add importHtml keys (ES + EN)"
```

---

## Task 3: Frontend — botón Import HTML + handler en EmailStudioPage

**Files:**
- Modify: `apps/dashboard/src/pages/EmailStudioPage.jsx`

**Context:** Vamos a añadir un botón "↑ Importar HTML" en la toolbar superior, justo a la izquierda del botón "Exportar HTML" existente ([línea 320-324](apps/dashboard/src/pages/EmailStudioPage.jsx#L320-L324)). El botón abre un input file oculto. Al seleccionar archivo: hace POST a `/api/parse-html`, recibe el HTML, llama `splitIntoBlocks(html)`, setea estado, dispara `nameBlocksAsync(parsed)` (la función ya existe en el componente, [línea 285](apps/dashboard/src/pages/EmailStudioPage.jsx#L285)).

**Lógica de seteo de estado (idéntica a `onHtmlGenerated`):**
```javascript
if (parsed.length > 0) {
    setBlocks(parsed);
    setAiHtml('');
    nameBlocksAsync(parsed);
} else {
    setAiHtml(html);
    setBlocks([]);
}
```

- [ ] **Step 1: Añadir `useRef` al import de React**

Editar línea 1 de `apps/dashboard/src/pages/EmailStudioPage.jsx`:

Cambiar:
```javascript
import React, { useState, useEffect, useMemo } from 'react';
```

Por:
```javascript
import React, { useState, useEffect, useMemo, useRef } from 'react';
```

- [ ] **Step 2: Añadir ref del file input dentro de `EmailStudioPage()`, justo después del `useAgentPipelineSession`**

Localizar línea 169:
```javascript
  const pipeline = useAgentPipelineSession(AGENT_ID);
```

Insertar inmediatamente después:
```javascript
  const importFileRef = useRef(null);
```

- [ ] **Step 3: Añadir el handler `handleImportHtml` justo antes de `handleExportHtml`**

Localizar línea 267:
```javascript
  const handleExportHtml = () => {
```

Insertar inmediatamente ANTES:
```javascript
  const handleImportHtml = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = ''; // reset so the same file can be re-picked
    if (!file) return;

    setBuilderStatus(t('studio.importHtmlHint'));
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`${API_URL}/parse-html`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setBuilderStatus(err.error || t('studio.importHtmlError'));
        setTimeout(() => setBuilderStatus(''), 4000);
        return;
      }

      const { html } = await res.json();
      const parsed = splitIntoBlocks(html);

      if (parsed.length > 0) {
        setBlocks(parsed);
        setAiHtml('');
        nameBlocksAsync(parsed);
        setBuilderStatus(t('studio.importHtmlSuccess').replace('{count}', parsed.length));
      } else {
        // No top-level <table> blocks found — show as monolithic HTML
        setAiHtml(html);
        setBlocks([]);
        setBuilderStatus(t('studio.importHtmlSuccess').replace('{count}', '0'));
      }
      setPatchedBlock(null);
      setEditingTemplate(null);
      setActiveTab('chat');
      setTimeout(() => setBuilderStatus(''), 3000);
    } catch (err) {
      console.error('[importHtml] error:', err);
      setBuilderStatus(t('studio.importHtmlError'));
      setTimeout(() => setBuilderStatus(''), 4000);
    }
  };

```

- [ ] **Step 4: Añadir el botón + input oculto en la toolbar**

Localizar líneas 320-324:
```javascript
        <div className="studio-topbar-actions">
          <button className="studio-action-primary" onClick={handleExportHtml} disabled={!builderHtml}>
            {t('studio.exportHtml')}
          </button>
        </div>
```

Reemplazar por:
```javascript
        <div className="studio-topbar-actions">
          <input
            ref={importFileRef}
            type="file"
            accept=".html,text/html"
            style={{ display: 'none' }}
            onChange={handleImportHtml}
          />
          <button
            className="studio-action-secondary"
            onClick={() => importFileRef.current?.click()}
            title={t('studio.importHtmlHint')}
          >
            {t('studio.importHtml')}
          </button>
          <button className="studio-action-primary" onClick={handleExportHtml} disabled={!builderHtml}>
            {t('studio.exportHtml')}
          </button>
        </div>
```

- [ ] **Step 5: Verificar que `studio-action-secondary` existe en CSS**

Run: `grep -n "studio-action-secondary\|studio-action-primary" apps/dashboard/src/index.css`

Expected: ambas clases existen. Si `studio-action-secondary` NO existe, ir al Step 6. Si existe, saltar a Step 7.

- [ ] **Step 6: (condicional) Añadir clase CSS si falta**

Localizar `.studio-action-primary` en `apps/dashboard/src/index.css` y añadir inmediatamente después un bloque equivalente con styling sutil (border en vez de fill):

```css
.studio-action-secondary {
  background: transparent;
  color: var(--text);
  border: 1px solid var(--border);
  padding: 6px 14px;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
}
.studio-action-secondary:hover {
  background: var(--bg-hover);
  border-color: var(--accent);
}
```

(Solo si Step 5 confirmó que falta. Si ya existe una clase ghost/secondary, usar esa en vez de crear nueva.)

- [ ] **Step 7: Verificar manualmente en el browser**

1. Abrir http://localhost:4000/app/workspace/agent/html-developer/studio
2. Seleccionar un ticket (cualquiera con `project_id`)
3. Click en "↑ Importar HTML"
4. Seleccionar `view_e_emirates_email (1).html` (está en raíz del repo)
5. Verificar:
   - Status chip muestra "Email importado: N bloques detectados"
   - El canvas muestra los bloques renderizados
   - Después de 2-3s, los nombres genéricos `Block 1, Block 2...` cambian a nombres semánticos (Header, Hero, etc.)
   - Click en un bloque → borde azul de selección
   - Tab Chat → enviar al agente: "haz este bloque más premium con paleta dorada"
   - Solo el bloque seleccionado se actualiza (no todo el email)

Expected: el flujo end-to-end funciona — upload → decompose → naming → select → patch.

- [ ] **Step 8: Commit**

```bash
git add apps/dashboard/src/pages/EmailStudioPage.jsx apps/dashboard/src/index.css
git commit -m "feat(email-studio): import existing HTML emails for rebranding pipeline

- Add Import HTML button in toolbar (next to Export)
- Reuses splitIntoBlocks + nameBlocksAsync from existing onHtmlGenerated flow
- Hidden file input triggered by button click
- Imported emails decompose into named, selectable blocks ready for agent patches"
```

---

## Task 4: End-to-end demo rehearsal

**Files:** Ninguno (solo verificación)

**Context:** Antes de marcar la feature como done, hacer un dry-run completo del recorrido de demo para encontrar fricciones.

- [ ] **Step 1: Recorrido completo (~5 min)**

1. Abrir Email Studio limpio (refresh duro: Ctrl+Shift+R)
2. Seleccionar ticket de proyecto Emirates
3. Click "↑ Importar HTML" → subir `view_e_emirates_email (1).html`
4. Esperar a que aparezcan nombres semánticos (max 5s)
5. Click en el bloque "Hero" (o el más prominente) → verificar selección visual
6. Tab Chat → escribir: *"Rebrandea este bloque al estilo de [marca premium]: paleta dorada, tipografía serif elegante, tono más exclusivo"*
7. Verificar que SOLO ese bloque se actualiza (no todo el email)
8. Click en otro bloque → enviar otra orden de rebrand
9. Click "💾" o equivalent → guardar como template
10. Tab Templates → verificar que aparece la card con thumbnail
11. Click "↓ Exportar HTML" → verificar que el archivo descargado abre correctamente en el browser

- [ ] **Step 2: Identificar fricciones**

Anotar en este mismo plan (sección Review abajo) cualquier:
- Step que se sintió lento o confuso
- Bloque que no se decompuso bien
- Naming que dio nombres genéricos en vez de semánticos
- Comportamiento del agente al patchear (¿respeta selección? ¿regenera de más?)

- [ ] **Step 3: Si todo funciona — preparar disclaimer para demo**

Si hay alguna fricción menor que no vale la pena arreglar antes de la demo, anotarla aquí para mencionarla en vivo como "limitación conocida":

(rellenar después del Step 2)

- [ ] **Step 4: Commit final con notas de review**

```bash
git add .claude/tasks/todo-rebrand-pipeline.md
git commit -m "docs: rebrand pipeline demo plan completed with rehearsal notes"
```

---

## Review (rellenar al terminar)

### Qué funciona
- (rellenar)

### Qué quedó como limitación conocida
- (rellenar)

### Próximos pasos post-demo (NO ahora)
- Persistir bloques individuales en DB para edición incremental sin re-parsing
- Botón "Send to Block Studio library" en cada bloque rebrandeado para reusar
- Comando "rebrandea todo el email" que itera bloques automáticamente
- Brief context pipeline para que el rebranding agarre el tono de marca desde un brief

---

## Lessons aplicables (post-mortem)

Después de implementar, actualizar `.claude/tasks/lessons.md` con cualquier patrón nuevo descubierto. Candidatos probables:
- Patrón "client-side parser, server-side just transports" cuando la lógica de parsing ya existe en frontend
- Patrón "reuse existing async naming pipeline" en vez de hacer naming sincrónico en upload
