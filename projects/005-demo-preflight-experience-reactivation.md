# Guión de Demo: Preflight Experience Reactivation

## Contexto
Emirates paró campañas por la guerra iraní en Dubai. Reactivamos el programa Preflight — enfoque en **Preflight Experience**: email de cabin preview para TODAS las clases (Economy, Premium Economy, Business, First Class), 48h antes del vuelo, en 4 idiomas (EN, AR, RU, ES). 71.5% open rate pre-pausa. La demo muestra el flujo completo: KB → PM Agent → Pipeline de 10 agentes.

---

## PARTE 1: Knowledge Base (2 min)

### Navegación: Sidebar → Knowledge Base

### Prompt 1 — Voz (overview)
> "Tell me about the Preflight Experience campaign. What's the trigger, who receives it, and what's the current performance?"

**Esperamos:** Trigger a 48h del vuelo, preview del servicio por clase de cabina, 71.5% open rate, 28.9% click rate. Datos de los docs cargados.

### Prompt 2 — Voz (detalle)
> "What personalization does the Preflight Experience email use and what content does it typically include?"

**Esperamos:** Tokens de personalización, contenido sobre lounge, dining, ICE, chauffeur. Detalles técnicos de los docs.

### Transición
> "Now that we have the full picture, let's go to the PM Agent and plan the reactivation."

---

## PARTE 2: PM Agent — 2 mensajes (2-3 min)

### Navegación: Sidebar → Inbox → PM Agent chat

### Prompt 3 — PM Agent (mensaje 1: describe el proyecto)
> We need to reactivate the Preflight Experience campaign — the premium cabin preview email that goes to Economy, Premium Economy, Business and First Class passengers 48 hours before departure. It's been paused during the Dubai disruption caused by the Iranian war. We send to multiple languages: English, Arabic, Russian and Spanish.

**Esperamos:** El PM reconoce la situación, pide más detalles o empieza a estructurar el proyecto.

### Prompt 4 — PM Agent (mensaje 2: lo que has pensado + pide input)
> I have thought that we need to:
> - Adjust the messaging from "excitement" to "reassurance and welcome back"
> - Exclude passengers who were disrupted — they shouldn't get a happy email
> - Check if Qatar or Etihad have done anything clever we should match
> - Redesign the email template for the new tone
> - Full legal and brand review given the sensitivity

> Let me know if you would add something else

**Esperamos:** El PM valida tus ideas Y añade cosas que no habías pensado (ej: soft launch phasing, monitoring/kill switch, multi-language QA, consent re-validation). Luego genera el proyecto completo con pipeline recomendado.

**Punto de demo:** "Notice I gave the PM my initial thoughts, and it came back with additional considerations I hadn't thought of — that's the value of an AI project manager that understands the full campaign lifecycle."

### En la UI
Click en proyecto creado → Tab "Pipeline" → Seleccionar template → Ajustar agentes → Confirmar

---

## PARTE 3: Pipeline — Stage by Stage (6-8 min)

### Pipeline (10 stages):
```
[0] Strategy Brief (Raul)                      GATE
     |
     +--------+--------+--------+
     |                  |         |
[1] Technical      [2] CRM      [3] Competitive
    (Guillermo)        (Valentina)   Intel
     |                  |         |
     +--------+---------+---------+
     |                  |
[4] Content        [5] HTML Design
    (Lucia)            (HTML Dev)
     |                  |
     +--------+--------+
     |                  |
[6] Brand          [7] Legal
    (Sofia)            (Javier)     GATE
     |                  |
     +--------+--------+
              |
[8] Automation (Andres)
     |
[9] QA & Go-Live (Elena)           GATE
```

---

### STAGE 0 — Raul: Strategy Brief

**Prompt:**
> We're reactivating the Preflight Experience email — cabin preview for all classes (Economy, Premium Economy, Business, First Class), triggered 48h before departure. It was paused during the Dubai disruption caused by the Iranian war.
>
> Pre-pause performance: 71.5% open rate, 28.9% click rate, 67,800 monthly sends across 4 languages (English, Arabic, Russian, Spanish).
>
> I need a reactivation strategy:
> 1. What's the right messaging approach? We need to shift from "look what awaits you" to "welcome back." But the tone should differ by cabin class — First Class expects premium white-glove, Economy needs warmth and reassurance.
> 2. Should we soft-launch with a subset before going to all passengers? If so, which cabin class or tier first?
> 3. What KPI targets for the first 30 days? The 71.5% open rate was pre-disruption — should we expect a dip?
> 4. Multi-language considerations — Arabic and Russian markets may have different sensitivities about the conflict. Any adjustments needed per language?
> 5. Risk assessment — what could go wrong with reactivating this now?
> 6. Success criteria to decide if we can reactivate the other 3 Preflight sub-campaigns (Ancillary, BeforeYouFly, Upgrades)

**Handoff → Stages 1, 2, 3 se activan en paralelo**

**Punto de demo:** "Raul produced the strategy in seconds. Now watch — three agents activate at once because they don't depend on each other."

---

### STAGE 1 — Guillermo: Technical Review

**Prompt:**
> The Preflight Experience journey has been paused in Journey Builder for several weeks during the Iranian war disruption. Technical assessment needed:
>
> 1. Are there passengers stuck in a "running" state from when we paused? These would be passengers who entered the journey before the pause but hadn't received the email yet
> 2. The trigger pulls from the booking engine API — is the data feed still active? We need confirmed bookings with departure within 48h, all cabin classes (Y/W/J/F)
> 3. Send classification and delivery profile — still valid post-pause?
> 4. We have 4 language versions (EN, AR, RU, ES) — is the language selection logic still correctly mapping to subscriber language preference?
> 5. What's the unpause procedure? Do we need to republish the journey or just resume?
>
> Align with Raul's phased approach — if he recommends starting with a specific cabin class, how do we add that filter technically?

---

### STAGE 2 — Valentina: CRM & Audience Analysis

**Prompt:**
> Audience analysis for the Preflight Experience reactivation — this targets ALL cabin classes now, not just premium:
>
> 1. How many passengers across all cabin classes have departures in the next 14 days who should receive this email?
> 2. Breakdown by cabin class (Economy / Premium Economy / Business / First) and by Skywards tier (Blue/Silver/Gold/Platinum/non-member)
> 3. Language distribution — how many fall into each language version (EN, AR, RU, ES)?
> 4. Disruption suppression — how many of these passengers were previously affected by the war-related disruptions? We need a suppression list that excludes anyone whose flight was cancelled or significantly delayed
> 5. Consent check — any GDPR, UAE, or Russian data protection concerns after the pause?
> 6. If Raul recommends a phased soft launch, what's the expected volume per phase?
>
> Critical risk: a passenger who had their flight cancelled during the war disruption receiving a "Your Emirates experience awaits" email. That absolutely cannot happen.

---

### STAGE 3 — Competitive Intelligence

**Prompt:**
> I need competitive intelligence on how other airlines have handled communications during and after the Dubai disruption caused by the Iranian war:
>
> 1. Has Qatar Airways sent any communications to their passengers about the situation? What messaging approach did they use?
> 2. Has Etihad done anything to position Abu Dhabi as a "safer alternative" in their comms?
> 3. Are any competitors running pre-flight experience previews right now? Are they tone-sensitive or business-as-usual?
> 4. Have any airlines sent "welcome back" or "we're here for you" type campaigns post-disruption that we can learn from?
> 5. What's the competitive opportunity? If we reactivate with the right tone, can we actually strengthen passenger loyalty while competitors stay silent?
> 6. Any messaging pitfalls — what did competitors get wrong that we should avoid?
>
> I need actionable insights that Lucia can use when writing the new Experience email copy across all 4 languages.

**Handoff de los 3 stages → Content + HTML se activan en paralelo**

**Punto de demo:** "Three specialists worked simultaneously — Technical, CRM, and Competitive Intel. Now Content and HTML Design have the full picture: strategy, technical constraints, audience data, AND competitive intelligence. All in their context automatically."

---

### STAGE 4 — Lucia: Content Refresh

**Prompt:**
> Write the refreshed Preflight Experience email. This goes to ALL cabin classes (Economy, Premium Economy, Business, First Class) 48h before departure, in 4 languages.
>
> Use the context from previous stages:
> - Raul's strategy for the "welcome back" messaging approach
> - Valentina's audience breakdown by cabin class and tier
> - Competitive intel insights on what competitors are doing
>
> The email needs cabin-class-specific content:
> - **First Class**: Private Suite, chauffeur-drive service, onboard shower spa, lounge dining
> - **Business Class**: Lie-flat seat, lounge access, premium dining, ICE entertainment
> - **Premium Economy**: Extra legroom, enhanced dining, priority boarding
> - **Economy**: Seat selection, meal options, entertainment highlights, Dubai Duty Free offers
>
> For each cabin version provide:
> - 3 subject line variants for A/B testing
> - Preview text
> - Hero section: "Welcome back" tone, not excitement
> - Cabin-specific content blocks
> - CTA: Soft — "Explore your experience" not "Don't miss out"
> - Personalization: %%FirstName%%, %%Destination%%, %%CabinClass%%, %%SkywardsTier%%, %%DepartureDate%%
>
> Primary language: English. Flag specific sections needing cultural adaptation for Arabic, Russian, and Spanish versions. Note: Russian market may have specific sensitivities about the conflict context.

---

### STAGE 5 — HTML Developer: Email Template Design

**Prompt:**
> Based on Lucia's copy, I need the template spec for the Preflight Experience email:
>
> 1. Modular structure for SFMC Content Builder — hero image slot, cabin-class content blocks (4 versions), CTA, footer
> 2. Conditional rendering by cabin class: First Class → Private Suite + chauffeur; Business → lounge + lie-flat; Premium Economy → extra legroom; Economy → seat selection + meals
> 3. Responsive design: Must render on Gmail, Outlook 365, Apple Mail, Samsung Mail
> 4. Emirates brand design: Primary red #D71921, gold accent #C8A96E, white background, clean typography
> 5. RTL support for Arabic version
> 6. Language switching logic — 4 language versions (EN, AR, RU, ES) using SFMC subscriber language preference
> 7. Personalization token placement — where each %%Token%% renders in the layout
>
> Provide the structural HTML spec with content slots clearly marked for each cabin class variant.

**Handoff → Brand + Legal activan en paralelo**

---

### STAGE 6 — Sofia: Brand Review

**Prompt:**
> Review the Preflight Experience email content and template design across all 4 cabin classes:
>
> 1. Premium tone per cabin class — First Class should feel ultra-premium, Economy should feel warm and aspirational but not overselling
> 2. "Welcome back" narrative — is it subtle enough? We don't want to explicitly mention the war or disruption, just signal we care
> 3. Terminology audit: "Emirates First Class Suite" (not "Private Suite"), "Business Class lie-flat seat" (not "flatbed"), "Skywards" (capital S), "ice" (lowercase, entertainment system)
> 4. Visual spec alignment with current Emirates email design guidelines
> 5. Multi-language review — Arabic, Russian, Spanish versions: any cultural flags or tone issues per market?
> 6. Red flag scan — anything in any version that could be perceived as insensitive, tone-deaf, or inappropriately commercial given the war context?
>
> Line-by-line feedback with specific rewrites where needed. This needs to be bulletproof.

---

### STAGE 7 — Javier: Legal & Compliance

**Prompt:**
> Legal review for the Preflight Experience reactivation across all markets:
>
> 1. GDPR compliance — is pre-disruption consent still valid for this triggered email? The pause was several weeks.
> 2. UAE data protection — any new regulations or guidance issued related to the conflict?
> 3. Russian market — any sanctions-related email restrictions? Can we legally send marketing emails to Russian passengers right now?
> 4. Disruption-affected passengers — are we legally safe to exclude them via suppression list? Any duty of care if they have new upcoming flights?
> 5. Cabin service claims — lounge access, chauffeur, dining — are all claims accurate? Any services modified post-disruption?
> 6. Spanish market — LSSI compliance for commercial communications
> 7. Arabic market — GCC-specific data protection requirements
>
> Provide go/no-go compliance checklist per market (EN, AR, RU, ES).

**Handoff → Automation activa**

---

### STAGE 8 — Andres: Automation Rebuild

**Prompt:**
> Build the automation plan for Preflight Experience reactivation across 4 cabin classes and 4 languages:
>
> 1. Journey Builder: Unpause sequence — soft-start with 10% of eligible passengers day 1, 50% day 2, 100% day 3
> 2. Trigger logic: Booking confirmed + Departure within 48h + NOT in disruption suppression list + Language preference routing (EN/AR/RU/ES)
> 3. Cabin class routing: Detect cabin class from booking data → route to correct content version (Y/W/J/F)
> 4. Monitoring: Alert if open rate drops below 50% or bounce rate exceeds 2% — per language version (Russian version may behave differently)
> 5. Kill switch: One-click pause all 4 language versions if we need to stop
> 6. Suppression sync: Daily auto-import of disruption-affected passengers, excluded from all Preflight sends
> 7. Deployment runbook: Step-by-step for go-live morning with rollback procedure
>
> Include the Journey Builder decision split logic for cabin class × language matrix.

**Handoff → QA activa**

---

### STAGE 9 — Elena: QA & Go-Live

**Prompt:**
> Final QA for Preflight Experience. We have 4 cabin classes × 4 languages = 16 email variations to validate.
>
> Test checklist:
> 1. Render test: All 4 cabin versions across Gmail, Outlook 365, Apple Mail, Samsung Mail
> 2. Personalization: %%FirstName%%, %%Destination%%, %%CabinClass%%, %%SkywardsTier%%, %%DepartureDate%% — correct in all languages
> 3. Conditional content: First Class sees chauffeur + suite; Business sees lounge + lie-flat; Premium Economy sees extra legroom; Economy sees seat selection + meals
> 4. Language rendering: Arabic RTL correct, Russian Cyrillic renders properly, Spanish accents display correctly
> 5. Link check: All CTAs, booking deep links, unsubscribe, privacy policy — per language version
> 6. Spam score: Below 3.0 for all 16 variations
> 7. Suppression test: Send to disruption-affected test profile → NOT delivered
> 8. Soft-start test: 10% segment send works, monitoring alerts trigger correctly
>
> Pass/fail for each. Priority: Flag any fails in the Russian or Arabic versions first — these are the most sensitive markets. Any fail = no go-live until fixed.

**Final handoff → Pipeline completes**

---

## TALKING POINTS DE CIERRE

> "In under 15 minutes, we went from 'we need to reactivate Preflight' to a fully reviewed, legally approved, QA-tested campaign across 4 cabin classes and 4 languages — that's 16 email variations coordinated through a single pipeline.
>
> 10 agents worked on this. Three of them ran in parallel when they could. Every agent had the full context from all previous stages — strategy, technical constraints, audience data, competitive intelligence — all automatically passed through handoff summaries.
>
> No email threads. No Slack. No context lost. And this is just Preflight Experience — we can do the same for Abandoned Cart, Search Abandon, Route Launch — any campaign in your lifecycle program."

---

## DATOS CLAVE

| Dato | Valor |
|------|-------|
| Campaña | Preflight Experience |
| Trigger | 48h before departure |
| Audiencia | ALL cabin classes (Economy, Premium Eco, Business, First) |
| Idiomas | English, Arabic, Russian, Spanish |
| Variaciones email | 16 (4 cabin × 4 languages) |
| Open Rate (pre-pausa) | 71.5% |
| Click Rate | 28.9% |
| Volumen mensual | 67,800 sends |
| Industry benchmark OR | 21.3% |
| Agentes | 10 (Raul, Guillermo, Valentina, Competitive Intel, Lucia, HTML Dev, Sofia, Javier, Andres, Elena) |
| Causa de pausa | Iranian war / Dubai disruption |
