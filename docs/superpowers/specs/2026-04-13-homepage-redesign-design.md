# Homepage Redesign — AgentOS

## Context

The current homepage is a generic dashboard landing: hero with tagline, stats bar, 9 feature cards, 3 "how it works" steps, and a PM Agent callout. It doesn't communicate what problems AgentOS solves, how it works, or why a VP/Director should care. Feedback from stakeholders: "it needs to show what it solves and be easier to understand the platform."

This redesign replaces the entire homepage with a narrative-driven page that takes the reader from **pain → solution → evolution → concrete workflows**.

**Target audience:** VP / Director of Marketing — executive tone, results-oriented, no technical jargon in the first layer.

---

## Page Structure (7 sections, top to bottom)

### Section 1: Hero

**Purpose:** Immediate emotional hook — the VP reads this and thinks "that's me."

- **Headline (h1):** Pain-direct tone. Example: "Tu equipo pierde semanas coordinando lo que agentes IA resuelven en horas"
- **Subtitle (p):** Solution framing. Example: "AgentOS orquesta agentes especializados que trabajan como tu equipo — pero más rápido, con más contexto, y sin perder conocimiento."
- **2 CTAs:** Primary "Ver Demo" (solid button, links to `/app/projects` as the most representative existing view), Secondary "Hablar con PM Agent" (outlined button, links to `/app/inbox`)
- **No stats bar** — removed. Stats don't communicate value to a VP on first visit.

**File changes:**
- `HomePage.jsx` — replace hero section, remove stats fetch/display
- `translations.js` — update `home.heroTitle`, `home.heroSubtitle`, add `home.ctaDemo`, `home.ctaPmAgent`
- `index.css` — update `.home-hero` styles for larger, more impactful typography

### Section 2: The 5 Problems

**Purpose:** Empathy — list the pains the VP lives daily so they feel understood.

**Layout:** 2-column grid (2+2+1 centered). Each card has:
- Lucide icon (left-aligned, colored `var(--danger)` or similar)
- Title (bold)
- Description (1-2 lines, conversational)

**The 5 problems:**
1. **Velocidad** — Icon: `Clock` — "Lanzar una campaña BAU tarda días entre briefing, copy, HTML, QA y deployment."
2. **Visibilidad** — Icon: `Eye` — "No hay vista centralizada de campañas en vuelo, quién hace qué, ni el estado real."
3. **Dependencia de personas** — Icon: `Users` — "Si alguien rota o se va, el conocimiento se pierde. No hay documentación viva."
4. **Decisiones a ciegas** — Icon: `Target` — "Se lanzan campañas sin análisis del código, segmentación ni benchmarks."
5. **Coordinación manual** — Icon: `Link2` — "Cada workflow se orquesta por email y chat. No hay sistema automático."

**Section header:** "¿Te suena esto?"

**File changes:**
- `HomePage.jsx` — new section component
- `translations.js` — add `home.problemsTitle`, `home.problem1Title`, `home.problem1Desc`, etc. (ES + EN)
- `index.css` — new `.home-problems-grid` class (2-column grid, gap 16px), `.home-problem-card`

### Section 3: The Solution — PM Agent + Org Chart

**Purpose:** Transition from problems to "here's what solves this." PM Agent as the orchestrator with full department context.

**Layout:**
- **Header text:** "Un agente orquestador con el contexto de todo tu departamento"
- **Subtitle:** "PM Agent conoce tus campañas, tu equipo, tus reglas y tu histórico. Decide qué agentes IA poner a trabajar, en qué orden, y con qué tareas."
- **Org chart** (tree hierarchy):
  - **Top row:** PM Agent (primary color box with glow) ━━━━ Knowledge Base (green box with glow), connected by horizontal line
  - **Connector:** Vertical line from PM Agent down, branching into 3 columns
  - **3 columns below:**
    - **Estrategia** (yellow label): Campaign Manager, CRM Specialist, Analytics Agent, Competitive Intel
    - **Ejecución** (blue label): Content Agent, HTML Developer, Segmentation, Automation Architect
    - **Control** (red label): QA Agent, Brand Guardian, Legal Agent, Doc Agent

**Implementation:** Pure CSS + JSX, no external diagram library. Uses flexbox for top row, CSS grid for 3-column agent groups.

**File changes:**
- `HomePage.jsx` — new `OrgChart` section/component (inline, not separate file)
- `translations.js` — add `home.solutionTitle`, `home.solutionSubtitle`, `home.orgStrategy`, `home.orgExecution`, `home.orgControl`
- `index.css` — new `.home-org-chart`, `.home-org-top`, `.home-org-connector`, `.home-org-layers`, `.home-org-agent`
- `icons.jsx` — add `HomeIcons` export for the new homepage icons (reuse existing Lucide imports, no new dependencies)

### Section 4: The 3 Evolution Stages

**Purpose:** Show the journey from tool to autonomous decision-maker. This is the strategic vision that excites a VP.

**Layout:** Horizontal timeline — 3 blocks connected by → arrows.

Each block:
- Stage label (small, colored, uppercase): "ETAPA 1", "ETAPA 2", "ETAPA 3"
- Title (bold): "Copiloto IA", "Automatización", "Era Agéntica"
- Description (2-3 lines explaining the stage)
- Left border accent in stage color

**Stage details:**
1. **Copiloto IA** (blue `#74b9ff` / `var(--info)`)
   - Agents as team tools. Human decides, AI executes and learns. Bidirectional knowledge transfer — the team trains the AI while the AI accelerates the team.
2. **Automatización** (purple `var(--primary)`)
   - Validated workflows become autonomous. A single initial prompt activates the full agent chain. PM Agent orchestrates sub-agents in order.
3. **Era Agéntica** (green `var(--success)`)
   - AI moves to decision-making. With accumulated experience, it proposes, executes, and optimizes. Human supervises and validates strategy.

**Section header:** "De herramienta a decisor autónomo"
**Subtitle:** "La IA evoluciona con tu equipo. Empieza asistiendo, termina decidiendo."

**File changes:**
- `HomePage.jsx` — new evolution timeline section
- `translations.js` — add `home.evolutionTitle`, `home.evolutionSubtitle`, `home.stage1Title`, `home.stage1Desc`, etc.
- `index.css` — new `.home-evolution-timeline`, `.home-evolution-stage`, `.home-evolution-arrow`

### Section 5: Concrete Workflows

**Purpose:** Make it tangible — "here's what you can do TODAY."

**Layout:** 2-column grid. Each card shows:
- Lucide icon + Title (top row, bold)
- "Before" line (red text with `CircleX` icon)
- "After" line (green text with `CircleCheck` icon)

**The 6 workflows:**
1. **Campaign Creation** — Icon: `Rocket`
   - Before: "Semanas entre briefing y go-live, 5+ personas en la cadena"
   - After: "De prompt a campaña deployada en horas"
2. **A/B Testing** — Icon: `TestTube`
   - Before: "Tests manuales sin análisis comparativo post-envío"
   - After: "Variantes generadas y comparadas automáticamente"
3. **Auto Research** — Icon: `Search`
   - Before: "Research manual, fragmentado y sin estructura"
   - After: "Investigación multi-agente con presentación lista"
4. **QA de Programas** — Icon: `Shield`
   - Before: "Nadie revisa los programas en vivo sistemáticamente"
   - After: "Chequeo continuo automatizado de cada programa"
5. **Documentation** — Icon: `BookOpen`
   - Before: "Documentación desactualizada o inexistente"
   - After: "Documentación viva que se actualiza con cada cambio"
6. **Technical Analysis** — Icon: `BarChart2`
   - Before: "Stakeholders sin visión del código ni la segmentación"
   - After: "Auditoría técnica clara para proponer mejoras con IA"

**Section header:** "Workflows listos para usar"
**Subtitle:** "Cada workflow resuelve un problema concreto que tu equipo vive hoy."

**File changes:**
- `HomePage.jsx` — new workflows section (replaces old features grid)
- `translations.js` — add `home.workflowsTitle`, `home.workflowsSubtitle`, `home.wf1Title`, `home.wf1Before`, `home.wf1After`, etc.
- `index.css` — new `.home-workflows-grid`, `.home-workflow-card`, `.home-wf-before`, `.home-wf-after`

### Section 6: CTA Final

**Purpose:** Close with a clear call to action after the reader has been convinced.

**Layout:** Centered card with subtle gradient background and border.
- **Headline:** "Deja de coordinar. Empieza a orquestar."
- **Subtitle:** "Conecta a tu equipo con agentes IA que tienen el contexto completo de tu departamento."
- **2 CTAs:** "Empezar ahora" (primary), "Ver workflows" (outlined, links to `/app/workflows`)

**File changes:**
- `HomePage.jsx` — new CTA section (replaces old PM callout)
- `translations.js` — add `home.ctaFinalTitle`, `home.ctaFinalSubtitle`, `home.ctaStart`, `home.ctaViewWorkflows`
- `index.css` — new `.home-cta-final` with gradient background

---

## Files to Modify

| File | Action | Scope |
|------|--------|-------|
| `apps/dashboard/src/pages/HomePage.jsx` | **Rewrite** | Replace entire component with new 6-section layout |
| `apps/dashboard/src/i18n/translations.js` | **Edit** | Replace `home` namespace in both ES and EN |
| `apps/dashboard/src/index.css` | **Edit** | Replace `.home-*` styles (lines ~5793-5982) with new classes |
| `apps/dashboard/src/components/icons.jsx` | **Edit** | Add `HomeIcons` export for homepage-specific icons |

## Files NOT Modified

- `main.jsx` — routing stays the same, HomePage still renders at `/app/`
- `server.js` — no backend changes needed
- No new files created — everything stays in existing files

## What Gets Removed

- Stats bar (agents/projects/workflows/departments counts)
- 9-feature cards grid (Projects, Workspace, Standup, Weekly, PM Agent, Workflows, Intelligence, Inbox, Audit)
- 3-step "How it works" section
- PM Agent callout card
- Related translations (old `home.*` keys replaced with new ones)
- Related CSS classes (`.home-features-grid`, `.home-step-card`, etc. replaced)
- `WORKFLOWS` import and `data/workflows.js` dependency from HomePage

## Design Constraints

- **Icons:** Lucide React only. No emojis anywhere on the page. All icons already imported in `icons.jsx`.
- **Colors:** CSS custom properties only (`var(--primary)`, `var(--text-main)`, `var(--bg-card)`, etc.)
- **i18n:** Every visible string in `translations.js` (ES + EN)
- **Responsive:** Mobile-first breakpoints at 768px and 1024px
- **Animation:** Reuse existing `animate-fade-in` class
- **No new dependencies** — pure React + CSS + Lucide

## Verification

1. `npm start` — verify Vite + Express boot without errors
2. Open `http://localhost:4000/app` — verify the homepage loads
3. Check all 6 sections render correctly with proper layout
4. Toggle language (ES/EN) — verify all text switches correctly
5. Resize browser to mobile width — verify responsive grid collapses properly
6. Click both CTA buttons — verify navigation works
7. Verify no console errors
8. Visual check: no emojis anywhere, all icons are Lucide SVGs
