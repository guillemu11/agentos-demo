# AgentOS — Lessons Learned

Actualizar este archivo despues de CUALQUIER correccion del usuario o error descubierto.
Formato: fecha, contexto, leccion, regla para el futuro.

---

## 2026-04-03 — RAG ingestion: HTML en content genera chunks semánticamente pobres

**Contexto:** Al ingestar bloques HTML de Emirates en Pinecone, se puso `description + HTML` como `content` en `ingestDocument`. El chunker divide el contenido en fragmentos de 500 tokens, generando 20-40 chunks de HTML crudo sin contexto semántico.

**Lección:** Para documentos donde el texto semántico es pequeño (descripción) pero el payload es grande (HTML), separar ambos: embedear solo la descripción, almacenar el payload en `metadata.html_source` (PostgreSQL JSONB, no Pinecone).

**Regla futura:** Antes de llamar a `ingestDocument` con contenido mixto (descripción + código/HTML), preguntarse: ¿el chunker va a fragmentar el payload en piezas inutilizables? Si sí, separar description (para embedding) del payload (para metadata).

**Tech debt pendiente:** Actualizar el endpoint de ingesta de bloques para poner solo la descripción en `content` y el HTML en `metadata.html_source`. Actualizar el retrieval de email-blocks en server.js para servir `html_source` desde `knowledge_documents.metadata`.

---

## Template

```
### YYYY-MM-DD — [Contexto breve]
**Error:** Que paso
**Causa:** Por que paso
**Regla:** Que hacer diferente en el futuro
```

---

## Lessons

### 2026-03-31 — chunkText infinite loop causaba OOM en toda la ingesta KB
**Error:** Upload de cualquier archivo que produjera texto > 2000 chars crasheaba el server con "JavaScript heap out of memory" (incluso con 4GB heap). DOCX de 10MB, PDFs, y textos largos todos fallaban.
**Causa:** `chunkText()` en `ingestion.js` tenia un bug en la condicion de salida del while loop. Cuando el ultimo chunk alcanzaba `end = text.length`, se calculaba `start = end - charOverlap` que era menor que `text.length`, asi que el loop nunca terminaba. Cada iteracion creaba un nuevo chunk object y string slice, consumiendo memoria infinitamente.
**Fix:** Agregar `if (end >= text.length) break;` ANTES de recalcular `start` con el overlap.
**Regla:** En cualquier loop de chunking/splitting con overlap, SIEMPRE verificar si ya se llego al final del input ANTES de aplicar el overlap/backtrack. El overlap solo aplica para chunks intermedios, no para el ultimo. Testear con textos de multiples tamanos (exact boundary, +1, large) para detectar edge cases.
### 2026-04-14 — email-build: PaidLounge (non-BAU) reveló 3 bugs sistémicos
**Contexto:** primer render de un template Emirates no-BAU (`PaidLounge_DynamicEmail_v17` #45919). DE principal `PaidLounge_DynamicContent_shortlink`, VAWP propio `Lounge_Email_Ask_VAWP_v2`, variant matrix = `language × headerType` sin `market_code`/`tier` en la DE.

**Bug A — Arabic leak en variante EN.** `renderAllVariants` caía a `dcRows[0]` cuando el manifest no exponía segments. En esta (y muchas otras) DE, `rows[0]` es árabe → `variantLang = 'ARABIC'` → `pickRow(headerRows/footerRows/caveat/…)` cascadeaban todos a árabe, aunque `options.language = 'en'`.
**Fix:** `renderer.js` usa `pickRow(dcRows, options.language)` como primer intento; además `index.js` ahora reenvía `language` al renderer (antes sólo pasaba `market`).
**Regla:** NUNCA usar `rows[0]` como default para content DEs multi-idioma. Siempre filtrar por el idioma pedido; `pickRow` debe ser la puerta única.

**Bug B — VAWP vars no poblados, `{FlightNo}/{DeptAirport}/{PNR}/{LoungeFare}/{Deptdate}/{ArrAirport}` leaked al HTML final.** El template tiene un bloque inicial `IF _messagecontext == 'VAWP' THEN SET @FlightNo = Field(@VAWP_Row, 'FlightNo') …`. Los valores no son AMPscript `%%=v()=%%` sino tokens literales `{X}` incrustados en el copy de la DE, que MC interpola en runtime. `replaceAmpscriptVars` no los toca → salen crudos.
**Fix:** en `renderAllVariants`:
  1. Buscar DE cuyo nombre contiene `vawp`, pickear una fila que case `language × headerType(tier)`.
  2. Fusionar con `subscriber` (caller wins) y pasarla a `buildVariableMap` → `Object.assign(vars, subscriber)` ya distribuye `FlightNo`, `PNR`, etc.
  3. Post-render: `html.replace(/\{([A-Za-z_][A-Za-z0-9_]*)\}/g, …)` contra un `varsLookup` CASE-INSENSITIVE (MC REST devuelve campos de DE en lowercase: `flightno`, el template usa `{FlightNo}`).
**Regla:** cualquier template con un init block `SET @X = Field(@VAWP_Row, 'Y')` necesita (1) VAWP row injection y (2) post-render `{Token}` interpolation case-insensitive. No basta con resolver `%%...%%`.

**Bug C — Skill sin discovery.** Usuario pedía builds por ID sólo. Añadido `searchEmailAssets(mc, query, { limit })` (REST `/asset/v1/content/assets/query` con filtro `name like X` + `assetType.id ∈ {207, 208}` + sort `modifiedDate DESC`). Skill `.claude/commands/email-build.md` ahora describe el flujo: query → top-N → **pausar y confirmar con usuario** → parsear idiomas (default `['ENGLISH']`) → correr pipeline.
**Regla:** skills que consumen APIs remotas deben tener una capa de disambiguation antes de ejecutar el pipeline pesado. No asumir que el usuario da IDs exactos.

### 2026-04-15 — email-build: skill no-generalizable hasta que se parseaban los aliases del template
**Contexto:** user probó `MilesAbandon_DynamicEmail` (#45625) y fallaba: `{abmiles}` sin resolver, stories broken. Cada email trae sus propios `{tokens}` y sus propios nombres de vars. Estaba hardcodeando case-by-case (first_name, FlightNo, Skw_Plus). No escalable.

**Raíz:** el AMPscript de Emirates declara explícitamente CÓMO mapear cada alias:
```
SET @target = Field(@VAWP_Row, 'col')           ← fuente de verdad
SET @offer_header = Replace(@offer_header, '{abmiles}', @miles_abandoned)
```
Si parseas el init block una vez, obtienes un alias map completo PARA ESE TEMPLATE sin hardcodear nada.

**Fix generic en `renderAllVariants` (renderer.js):**
1. Scan template para 3 patrones y construir `tokenAliases`:
   - `SET @target = ... Field(@VAWP_Row, 'col')` → `tokenAliases[target] = col` (autoritativo)
   - `Replace(@X, '{token}', @source)` → `tokenAliases[token] = source` (si no hay choque)
   - `SET @target = bareIdent` → `tokenAliases[target] = ident` (ELSE branch sin VAWP)
2. Resolver cadenas una vuelta (`abmiles → miles_abandoned`).
3. Post-render `{Token}` pass: lookup directo en vars → si empty, vía `tokenAliases`.

**Stories fields alias fallback:**
Diferentes templates nombran los driver fields distinto:
- BAU: `dc.story1/2/3`
- MilesAbandon: `dc.triplecols_story1/2/3`
- Otros: `story_triple{N}`, `threecol_story{N}`
Renderer prueba los candidatos antes de rendirse. Además populates `info_item{N}_*` vars para bloques AbMiles.

**Regla:** nunca hardcodear un alias por nombre de campo. Si el template lo declara vía AMPscript, parsearlo; si es un field-name convention, hacer fallback de nombres candidatos. Asumir que el próximo template traerá vars nuevos.

### 2026-04-15 — BAU preview gate: render block-level, no DE rows

**Contexto:** implementar el preview humano entre "contenido generado" y "push a MC" para campañas BAU. Iter 1 intentó reusar `buildCampaignEmails` con rows sintéticas + placeholder DE → preview vacío. Iter 2 rellenaba campos canónicos (`main_hero_image`, `body_copy`, …) basado en schema → Claude llenaba 39 campos pero el preview mostraba solo 1-2 imágenes y bloques grises.

**Raíz:**
1. El renderer de email-builder está diseñado para **leer DEs reales de MC** y resolver layouts multi-idioma/multi-tier. Forzarlo a operar sobre una row sintética intenta recrear demasiada plumbing; cualquier campo mal nombrado o empty → AMPscript guards ocultan el bloque. Con 50+ campos posibles por tipo de campaña, acertar todos los nombres canónicos es imposible sin conocer el template exacto.
2. Emirates templates anidan 2-3 niveles (`ContentBlockbyID` → logic block → language sub-block → contenido). Fetch solo top-level = wrappers vacíos.
3. Cada bloque contiene una cadena `IF @language == "X" ELSEIF … ELSEIF …` con ~25 ramas. Sin pre-resolver la rama activa, el prompt a Claude explota (1.1M tokens para un email).

**Fix (`packages/core/campaign-builder/phase-a-prepare.js`):** arquitectura block-level — rendering NO reutiliza el renderer para preview.
1. `resolveEmailTemplate` → AMPscript del template.
2. `analyzeBAUTemplate` → `blockOrder.allBlocks`.
3. **Fetch recursivo** de blocks: BFS siguiendo `%%=ContentBlockbyID("X")=%%` hasta agotar refs (visited set). Construye `blockMap<id, {name, html}>`.
4. **Pre-inline** de refs: cada top-level block sustituye sus `ContentBlockbyID(X)` por el HTML del sub-block (profundidad máx 6 para cycles).
5. **Por idioma solicitado**: `selectLanguageBranch(html, lang)` colapsa cadenas `IF @language == "ENGLISH" ELSEIF "ARABIC" …` dejando solo la rama activa. Regex procesa IFs sin IFs anidados dentro + loop iterativo → converge en ≤ 3 iter. Reduce ~85% el tamaño.
6. Claude recibe `{id, name, html}` por bloque + brief → devuelve JSON `{blocks: {id: filledHtml}}` con:
   - AMPscript vars reemplazados por copy concreto
   - `<img src=...>` reemplazados por `[[IMG: descripción]]`
   - Bloques irrelevantes omitidos del output
7. Post-process: regex `/\[\[IMG:\s*([^\]]+?)\s*\]\]/g` → Imagen (data URI, aspect 16:9) con cache por prompt. Concat en `blockOrder` + wrap en `template_style.html` shell.

**Reglas:**
- Para un **preview** pre-commit, NO reusar `renderAllVariants` que está diseñado para data real de MC. Atacar a nivel de bloque + AMPscript es más simple y robusto.
- Emirates blocks SIEMPRE están anidados. Fetch recursivo con visited-set es no negociable; sin esto solo obtienes wrappers.
- Las cadenas `IF @language` son ~25 ramas por bloque. Pre-resolverlas por idioma activo es lo que permite no explotar el contexto de Claude. Usa iteración regex (innermost-first) hasta converger.
- Claude con streaming (`anthropic.messages.stream`) es obligatorio para generaciones largas: `messages.create` falla con `"Streaming is required for operations that may take longer than 10 minutes"` si el output puede pasar de ese umbral.
- max_tokens 32000 es razonable para 10-20 bloques; output típico ~20-40KB.
- Data URIs inline de Imagen (~2.5MB/imagen PNG) son OK para preview en iframe pero engordan el HTML persistido en Postgres. Si escala: mover a `/tmp` o CDN propio.
- Push a MC (phase B) va a requerir otro approach: derivar rows MC desde el HTML aprobado + subir las imágenes generadas como assets. TBD.

### 2026-04-15 — DB drift: una semana de divergencia Docker local ↔ Railway

**Contexto:** `.env` quedó apuntando a Docker local (`localhost:5434`) durante ~1 semana. Todas las migrations nuevas (7 tablas: `bau_builds`, `campaign_*`, `experiment_*`, `meeting_sessions`, `research_sessions`) se aplicaron solo a Docker. Railway se quedó con el schema viejo mientras acumulaba datos reales (knowledge_chunks 198, tasks 71, etc.) desde otro contexto de ejecución. Resultado: 27 `bau_builds` en local que no existían en Railway, y 7 tablas completas faltantes en prod.

**Raíz:** no existe runner de migrations versionado. Cada DDL se aplica a mano contra "la DB que está conectada en ese momento", lo que equivale a elegir entre los dos entornos de forma silenciosa. Además, el flag de switch (`DATABASE_URL` comentada vs descomentada en `.env`) es invisible en logs y fácil de dejar mal.

**Fix aplicado (cutover 2026-04-15):**
1. Aplicar las 7 tablas a Railway con `CREATE TABLE IF NOT EXISTS` + indexes + FKs + CHECKs (idempotente).
2. Copiar `bau_builds` de local → Railway con `ON CONFLICT (id) DO NOTHING`. 4/27 fallaron por payloads grandes de `images_base64` (4-8MB); fix: `JSON.stringify` explícito + cast `$N::jsonb`.
3. `.env` ahora apunta SOLO a Railway; línea local comentada como legacy.
4. Docker `npm run db:up` deprecado (no borrar scripts por si acaso, pero no usar).

**Reglas futuras:**
- **DB = Railway siempre.** Dev y prod comparten DB. Sin Docker local, sin mirror bidi.
- **Sin SSL** en `yamanote.proxy.rlwy.net:42145` (proxy público). `new Pool({ connectionString })` sin `ssl:`.
- **JSONB grande (>4MB) vía pg driver:** `JSON.stringify` explícito + cast `::jsonb` en el SQL. Auto-serialización del driver falla con "invalid input syntax for type json" en payloads grandes.
- **Bidi-sync entre dev y prod es anti-patrón** (colisiones de `SERIAL`, FKs huérfanas). Una sola DB = cero drift posible.
- **Tech debt crítico:** falta un runner de migrations idempotente (`migrations/NNNN_*.sql` + `schema_migrations` table). Mientras no exista, cualquier DDL manual futuro puede repetir el drift. Priorizar antes del próximo feature que toque schema.
- **`bau_builds.images_base64`** crece rápido (4-8MB/fila). A 200+ builds mover a Blob storage; a 1000+ es urgente.
