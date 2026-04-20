# PLAYBOOK — DERTOUR Lifecycle Investigation

**Operativo, no académico.** Lee de arriba abajo. Haz cada fila, marca el step en el dashboard, espera la ventana de observación, sigue.

- **Investigación:** DERTOUR UK Lifecycle Audit — April 2026 (id 2 en AgentOS)
- **Dashboard:** http://localhost:4000/app/competitor-intel/2
- **Deadline:** viernes 2026-04-24, demo con Sarah Shaughnessy
- **Regla oro:** nunca uses el mismo email para dos personas. Sarah = `guillemugo11@gmail.com`. Tom = `gmg.pdf@gmail.com`.

---

## 1. Tus 2 personas — datos que USARÁS en cada form

Copia-pega estos valores. Son consistentes, detectables como "perfil real", y no disparan filtros anti-bot.

### 👤 Sarah Whitfield — luxury honeymooner

| Campo | Valor |
|---|---|
| First name | `Sarah` |
| Last name | `Whitfield` |
| Email | `guillemugo11@gmail.com` |
| Phone UK | `+44 7700 900123` |
| Postcode | `SW1A 1AA` |
| City | `London` |
| Country | `United Kingdom` |
| DOB | `1991-06-14` (34 años) |
| Travel interests (si hay checkboxes) | Maldives, Seychelles, Mauritius, Honeymoons, Beach, Luxury |
| Budget band (si preguntan) | £5,000 – £10,000+ per person |
| Travel date (quote forms) | **6 months ahead** — usa `2026-10-15` |
| Adults / children (quote forms) | `2 adults / 0 children` |
| Preferred contact | Email |

**Historia consistente (si un consultant te llama):** *"Nos casamos en septiembre, queremos luna de miel en Maldivas 10-14 noches, presupuesto flexible, preferimos overwater villa con servicio personalizado."*

### 🎒 Tom Haskins — adventure solo traveler

| Campo | Valor |
|---|---|
| First name | `Tom` |
| Last name | `Haskins` |
| Email | `gmg.pdf@gmail.com` |
| Phone UK | `+44 7700 900456` |
| Postcode | `M1 1AA` |
| City | `Manchester` |
| Country | `United Kingdom` |
| DOB | `1996-03-22` (29 años) |
| Travel interests | Trekking, Hiking, Adventure, Small group, Patagonia, Himalaya |
| Budget band | £1,500 – £3,500 per person |
| Travel date | `2026-09-01` |
| Adults / children | `1 adult / 0 children` |
| Preferred contact | Email |

**Historia consistente:** *"Llevo 3 años queriendo hacer el Circuito de Torres del Paine o el Annapurna. Solo, en grupo pequeño, entre 14 y 21 días. Soy profesor, puedo viajar en verano."*

---

## 2. Asignación persona × marca

**Inntravel la hacen ambas personas** (doble run) — nos permite comparar segmentación dentro de la misma marca.

| Marca | Persona | Por qué |
|---|---|---|
| **Kuoni** | Sarah | Luxury puro; enquiry telefónico/formulario largo |
| **Carrier** | Sarah | Ultra-luxury; consultant-led |
| **Inntravel** | Sarah + Tom | Slow travel para Sarah, walking holidays para Tom → segmentación |
| **Explore Worldwide** | Tom | Adventure grupal |
| **CV Villas** | Sarah | Villa rental mediterráneo |

Total: **6 runs × 8 steps = 48 acciones** (ya seedeadas en DB, cada una como `competitor_playbook_steps`).

---

## 3. Matriz de ejecución por marca (RECON + STEPS ESPECÍFICOS)

Lo que sigue expande el playbook genérico con **detalles específicos descubiertos en el recon automático** (ESP detectado, form action, campos que piden, tipo de journey esperado).

---

### 🏛️ KUONI (persona: Sarah) — `kuoni.co.uk`

**Recon:**
- ESP: **no detectable** (probablemente SFMC/Epsilon interno — Kuoni es grande)
- CDPs: Google Tag Manager
- **Form visible en HTML:** sí — `POST /api/appointment/make-enquiry` con 14 campos (firstName, lastName, email, postCode, phone, dateOfTravel, adults, children, **marketingOptIn checkbox**, storeId, etc.)
- Cart real: **NO** — Kuoni es luxury tradicional, todo va por enquiry / call-to-book

**Step 1 — Recon pasivo** (5 min)
- Abre `kuoni.co.uk` en **modo incógnito** (no ensuciamos cookies).
- Acepta solo cookies esenciales en OneTrust si aparece (no lo detecté, pero por si acaso).
- Screenshot homepage para Analysis 5.
- Navega: *Destinations → Maldives* — observa el layout, los precios "from £X" (Sarah persona).
- Ya está. No te suscribas aún.

**Step 2 — Newsletter sign-up** (~10 min, espera welcome 24h)
- Baja al footer del homepage. Busca "Sign up" / "Newsletter".
- Rellena con datos de **Sarah**. Acepta marketing opt-in.
- **Inmediatamente después**: marca step 2 `done` en el dashboard con timestamp preciso (esto sirve para el "time to first useful email"). Añade nota: `"Signed up via footer, [HH:MM]"`.
- Puede NO haber newsletter clásica en Kuoni — muchas marcas luxury no tienen. Si no hay form de newsletter explícito, marca step 2 como `skipped` con nota `"No newsletter form — Kuoni uses enquiry-only model"` y pasa a step 7 directo.

**Step 3 — Double opt-in** (cuando llegue)
- Si recibes email de confirmación, clica el link.
- Marca step 3 `done` con la hora.

**Step 4 — Wait 24h**
- Silencio total. Observa qué llega solo.

**Step 5 — Account creation**
- Recon dice `account_hint: false` — Kuoni NO tiene cuenta de cliente self-service. **Marca `skipped`** con nota "No account creation available".

**Step 6 — Preference center**
- Busca "Email preferences" en el footer de emails recibidos. Si no hay, `skipped`.

**Step 7 — HIGH-INTENT: Enquiry** (⭐ el paso que importa en Kuoni — 15 min)
- Ve a una página de destino: `kuoni.co.uk/honeymoons` o `kuoni.co.uk/maldives`.
- Busca botón "Enquire" o "Request a quote" o "Speak to a travel expert".
- Rellena el form entero con persona Sarah:
  - Date of travel: **2026-10-15** (6 months ahead, honeymoon realista)
  - Adults: 2, Children: 0
  - Phone: `+44 7700 900123`
  - Postcode: `SW1A 1AA`
  - Enquiry text / comments: **usa la historia**: "Getting married in September, looking for 10-14 night Maldives honeymoon in overwater villa. Budget flexible. Prefer full-board or all-inclusive with butler service."
- **Submit**.
- Marca step 7 `done` con nota: `"Full enquiry submitted for Maldives honeymoon, 2 adults, 2026-10-15"`.
- **Espera:** 24-72h típicamente. Kuoni llama por teléfono — si llaman al +44 7700 900123 (no tiene SIM, no responde), déjalo. Lo importante son los emails que llegan.

**Step 8 — Cart abandonment test**
- Kuoni no tiene cart real. `skipped` con nota `"No cart — quote-based model"`.

---

### 💎 CARRIER (persona: Sarah) — `carrier.co.uk`

**Recon:**
- ESP: no detectable
- Form en HTML: **NO** (JS-rendered dinámicamente) — tendrás que inspeccionar en vivo
- Cart: NO (1-to-1 consultant)

**Step 1 — Recon pasivo** — homepage + *Destinations → Africa / Asia*.

**Step 2 — Newsletter sign-up**
- Busca footer. Si hay link "Sign up to our newsletter":
  - Abre, rellena con Sarah.
- Si no encuentras newsletter form visible:
  - Busca "Request a brochure" o "Stay in touch" — rellena eso como proxy. Marca con nota `"Used brochure-request as newsletter proxy"`.
- **Hora exacta en el step note.**

**Step 3 — Double opt-in** — si llega.

**Step 4 — Wait 24h**.

**Step 5 — Account creation** — recon dice `false`. Probablemente no hay cuenta cliente. `skipped`.

**Step 6 — Preference center** — busca en footer de emails.

**Step 7 — HIGH-INTENT: Consultant match** (⭐)
- Carrier se diferencia asignando un **travel consultant** a cada cliente.
- Ve a cualquier página de destino luxury (ej. *Maldives* o *Seychelles*).
- Botón "Start planning" o "Request a quote" o "Talk to a specialist".
- Rellena: persona Sarah, historia honeymoon. Usa el mismo texto que en Kuoni.
- **Key observation:** Carrier debería asignarte un consultant NOMBRADO (ej. "Your specialist is Emma — she'll be in touch"). Si lo hace, ESO es un insight fuerte. Screenshot.

**Step 8 — Cart abandonment** — no aplica, `skipped` con nota `"Consultant-led, no cart flow"`.

---

### 🌿 INNTRAVEL (persona: **AMBAS Sarah + Tom**) — `inntravel.co.uk`

**Recon:**
- ESP: **Emarsys** ✅ (el único que pudimos identificar — gran insight para Sarah Shaughnessy)
- Cart: no visible en HTML (check manualmente)
- Account: `true` — sí tienen sistema de cuenta

**⚠️ IMPORTANTE:** tienes que hacer **los 8 steps DOS VECES** — una con cada persona, en sesiones separadas del navegador (usa dos ventanas incógnito o dos navegadores distintos para que Inntravel no las mezcle). Si pueden segmentar entre "luxury honeymooner" y "solo adventure walker", este es el test.

#### Run A — Sarah en Inntravel

**Step 2** — Newsletter con Sarah. Si hay checkboxes de "interests", **marca los de luxury/beach/honeymoon** (NO walking ni cycling). Objetivo: que Emarsys la segmente como luxury.

**Step 5** — Crea cuenta Sarah.

**Step 7** — Busca un producto luxury (una villa en Italia o un hotel en Mallorca premium). Pide información / quote.

#### Run B — Tom en Inntravel

**Step 2** — Newsletter con Tom. Marca **walking, hiking, active, Alps, Pyrenees** (NO beach ni luxury).

**Step 5** — Crea cuenta Tom.

**Step 7** — Busca un walking holiday (Inntravel es famoso por eso — Pyrenees, Alps Self-Guided). Pide información.

**Qué observar (insight crítico para Sarah Shaughnessy):** ¿los dos usuarios reciben emails distintos? Si Sarah recibe hotel-luxury y Tom recibe walking-routes, es señal de segmentación madura (Emarsys bien configurado). Si reciben lo mismo → blast genérico.

---

### 🏔️ EXPLORE WORLDWIDE (persona: Tom) — `explore.co.uk`

**Recon:**
- ESP: no detectable
- Cart: probable (reservas con deposit)
- Account: no detectable en HTML (puede estar JS-rendered)

**Step 2** — Newsletter con Tom. Si hay interests: marca **trekking, adventure, small group**.

**Step 7 — HIGH-INTENT: Real cart + deposit** (⭐ diferente a Kuoni/Carrier)
- Ve a una trip real: busca "Torres del Paine" o "Everest Base Camp" o "Kilimanjaro".
- Añade fechas concretas (2026-09-01).
- Llega hasta el punto de pagar el **deposit** (~£250-500).
- **NO pagues.** Abandona justo antes de meter tarjeta.
- Marca step 7 `done` con nota: `"Reached deposit page for [trip name], abandoned at payment"`.

**Step 8 — Cart abandonment** (⭐ aquí sí aplica)
- Espera 24, 48, 72h. **Guardian check:** ¿recibes email "you left something"? Si sí, cuándo llegó — es oro para Analysis 5.

---

### 🏡 CV VILLAS (persona: Sarah) — `cvvillas.com`

**Recon:**
- ESP: no detectable (pero tiene OneTrust + GTM visibles)
- Form newsletter: **sí visible** (`/umbraco/api/newsletterapi/addnewuser/`) — campos `email`, `referringPage`, `sessionId`, `website`, reCAPTCHA
- Cart: falso positivo del recon — **sí hay booking flow real** (villa rental)
- Account: `true`

**Step 2** — Newsletter con Sarah. Si hay segmentación por destino (Greek islands, Balearics, Italy): marca **Balearics + Italy**.

**Step 5** — Crea cuenta con Sarah.

**Step 7 — HIGH-INTENT: Villa booking** (⭐)
- Busca una villa en Mallorca o Ibiza, 7 nights, 2 adults, septiembre 2026.
- Llega al checkout / payment page.
- Abandona antes de meter tarjeta.

**Step 8 — Cart abandonment** — espera 24-72h.

---

## 4. Ejecución cronológica recomendada — HOY y mañana

### 🗓️ LUNES (hoy) — tarde, 2 horas

- [ ] **15:00 — 15:15** Kuoni step 1 + 2 (Sarah). Marca steps done en dashboard. Timestamp preciso.
- [ ] **15:15 — 15:30** Carrier step 1 + 2 (Sarah).
- [ ] **15:30 — 15:50** Inntravel step 1 + 2 **Run A Sarah** (ventana incógnito #1).
- [ ] **15:50 — 16:10** Inntravel step 1 + 2 **Run B Tom** (ventana incógnito #2, otro navegador idealmente — Edge para Tom, Chrome para Sarah).
- [ ] **16:10 — 16:25** Explore step 1 + 2 (Tom).
- [ ] **16:25 — 16:40** CV Villas step 1 + 2 (Sarah).

**Antes de cerrar:** verifica en el dashboard que los 6 sign-ups están marcados `done` con timestamps. Eso activa la query de "time to first useful email" para el viernes.

### 🗓️ MARTES — 30 min mañana, 30 min tarde

- [ ] **Mañana** — revisa dashboard. ¿Llegaron welcome emails? Haz **step 3** (double opt-in) donde aplique: clica el link, marca done.
- [ ] **Tarde** — haz **step 5** (account creation) en Inntravel (ambas personas), CV Villas (Sarah). Los demás step 5 → `skipped` con nota.

### 🗓️ MIÉRCOLES — 1 hora

- [ ] **Step 6** (preference centers) en las marcas donde hayas recibido ≥2 emails: busca el link "Manage preferences" en el footer del último email. Clica, explora qué granularidad ofrecen (destino? frecuencia? canal?). Screenshot → nota.
- [ ] **Step 7 — HIGH-INTENT** en las 6 runs. Es el paso que más dispara journeys. Hazlos en orden:
  1. Kuoni enquiry (Sarah)
  2. Carrier consultant request (Sarah)
  3. Inntravel quote luxury (Sarah)
  4. Inntravel quote walking (Tom)
  5. Explore cart-to-deposit (Tom)
  6. CV Villas villa-to-checkout (Sarah)

### 🗓️ JUEVES — 1 hora mañana, 2-3 horas tarde

- [ ] **AM — Step 8 (cart abandonment test)** en Explore + CV Villas. Esos son los únicos con cart real. Tras abandonar, espera 24-72h (te llegarán emails el viernes).
- [ ] **PM — REDACCIÓN DE INSIGHTS** en el dashboard:
  - `/app/competitor-intel/2/insights` → botón "Save insight" — captura 2-3 insights por marca.
  - Ejemplos de título bien formado:
    - *"Carrier asigna consultant nombrado en 4 min — Kuoni no responde en 48h"*
    - *"Emarsys segmenta correctamente en Inntravel: Tom recibe walking, Sarah luxury"*
    - *"CV Villas no tiene abandonment flow — 72h de silencio tras abandon"*
  - Vincula evidencia: pega IDs de emails concretos en el body como citación.
- [ ] **PM — SCORING manual** en cada brand tab `/app/competitor-intel/2/brand/:id` → tab Scoring:
  - Click "Auto-score from emails" para tener un baseline.
  - Ajusta los 4 sliders según tu criterio.
  - Textarea de notes: justifica cada axis brevemente.

### 🗓️ VIERNES AM — 30 min

- [ ] **Rehearsal demo** en este orden:
  1. `/app/competitor-intel/2` — Overview: arrancar con las 5 brand cards, apuntar a una (ej. "Carrier 7.5, emails in 4 min").
  2. `/app/competitor-intel/2/comparative` — **LA PANTALLA ESTRELLA**. Narrar el "time to first touch" grid de izquierda a derecha. Sarah verá en 10 segundos la diferencia.
  3. `/app/competitor-intel/2/insights` — leer 3 insights top.
  4. `/app/competitor-intel/2/gap` — cerrar con el gap vs Emirates Holidays (7.2).
  5. `/app/competitor-intel/2/brand/:id` — si hay tiempo, entrar en un brand para enseñar el playbook que ejecutaste.
- [ ] Botón **"Export Analysis 5 (.docx)"** → descarga → mándalo por email a Ian con asunto claro **después** de la demo (no antes, para no matar el wow).

---

## 5. Reglas de oro durante la ejecución

1. **Una persona = una sesión de navegador.** Usa ventanas incógnito DISTINTAS (Ctrl+Shift+N para Chrome, Ctrl+Shift+P para Edge) o directamente navegadores distintos. Nunca cambies de persona en la misma ventana.

2. **Timestamps precisos.** Cuando marques un step `done` en el dashboard, hazlo en el mismo minuto en que ejecutaste la acción. La query TTFT mide desde `step 2 executed_at` hasta `first email received`. 5 min de error = insight roto.

3. **NO respondas ni hagas clic en los emails.** El sistema ya simula opens/clicks automáticamente según el `engagement_pattern` de cada persona (Sarah abre 80%, clica Maldives/Seychelles; Tom 60%, clica trek/adventure). Si tú respondes un email real, ensucias el experimento.

4. **Spam check:** mira cada 24h la carpeta Spam de los 2 Gmails. Si algo cayó ahí, es en sí un insight ("CV Villas → spam") — anótalo pero no muevas el email al inbox (el ingestor los recoge igualmente gracias a `includeSpamTrash: true`).

5. **Si un form te rechaza** (captcha duro, phone validation): intenta una vez más con un móvil real tuyo en vez del `+44 7700 9001XX`. Si sigue fallando, marca step `skipped` con nota y sigue. No bloquea el análisis.

6. **Disciplina de notas:** cada step `done` debe llevar una nota de 1 frase explicando qué pasó. Son el cuerpo de Analysis 5.

---

## 6. Qué esperar según día

| Día | Qué debería haber llegado a los inboxes |
|---|---|
| Lunes tarde | 3-5 welcome emails (Kuoni, Inntravel, CV Villas tienen newsletter visible) |
| Martes mañana | Double opt-in emails + primeros nurture |
| Miércoles | 1-2 emails por marca. Alguna promo semanal. |
| Jueves | Post step-7: Carrier debería haber respondido con consultant; Kuoni con email del enquiry. |
| Viernes AM | Abandonment emails de Explore + CV Villas tras step 8 del jueves. |

---

## 7. Criterios de éxito de la demo

- **Mínimo viable (lunes al jueves):** ≥ 1 welcome por marca ingerido y clasificado, TTFT grid poblado con al menos 3 de 5 marcas, ≥ 2 insights escritos por marca.
- **Bueno:** los 5 TTFT verdes/amber/rojos, heatmap con al menos 3 tipos de email por marca, 10+ insights con evidencia.
- **Wow:** Carrier vs Kuoni contraste demoledor en TTFT, segmentación Inntravel detectada en las 2 personas, abandonment email de Explore capturado en vivo durante la demo.

---

**Si algo se tuerce, para y dime.** No improvises con los datos de persona — la consistencia es lo que permite que la investigación sea comparable entre marcas.

**Empieza por Kuoni.** 15 minutos. Reloj en mano.
