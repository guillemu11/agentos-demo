---
paths:
  - "apps/dashboard/src/**"
---

# Frontend Standards

## React

- React 19, functional components, hooks only (no class components)
- React Router 7 para routing
- State management: component-level useState/useEffect (no Redux/Zustand)
- API como source of truth: fetch on mount, update state after API call

## Routing

- Rutas en `apps/dashboard/src/main.jsx` bajo `<Route path="/app/*">`
- `AuthGate` wrapper para proteccion de rutas
- Layout con sidebar via `<Outlet />`
- Sidebar nav groups definidos en `Layout.jsx`

## Styling

- CSS puro con custom properties en `apps/dashboard/src/index.css`
- Variables en `:root` — nunca hardcodear colores, usar `var(--nombre)`
- No Tailwind, no CSS-in-JS, no styled-components
- Patron de clases: `.card`, `.chat-container`, `.chat-bubble`, `.dashboard-container`
- Animacion: `animate-fade-in` class
- Responsive: media queries en index.css

## i18n

- Archivo: `apps/dashboard/src/i18n/translations.js`
- Hook: `const { t, lang } = useLanguage()`
- Formato: `t('namespace.key')` — ej: `t('campaigns.send')`
- Interpolacion: `t('agentChat.chatWith').replace('{name}', agentName)`
- Idiomas: `es` (espanol) y `en` (ingles)
- TODO texto visible al usuario DEBE estar en translations (ambos idiomas)

## Charts

- Recharts 3: AreaChart, LineChart, BarChart, ResponsiveContainer
- Tooltips con estilos custom que usan CSS variables
- Gradients con `<defs>` y `<linearGradient>`

## Iconos

- `lucide-react` para iconos generales
- Emojis para avatares de agentes (definidos en mockData.js)
- Iconos de navegacion centralizados en `components/icons.jsx`

## Voz

- Hook actual: `useVoice.js` (Web Speech API nativa)
- Componentes: `VoiceControls.jsx` (MicButton, SpeakerButton, TtsToggle)
- Migrando a: `useGeminiVoice.js` (WebSocket a Gemini) con fallback a nativo

## Data

- Mock data en `apps/dashboard/src/data/` (mockData.js, agentViewMocks.js, emiratesCampaigns.js, emiratesBauTypes.js)
- API_URL: `import.meta.env.VITE_API_URL || '/api'` — nunca hardcodear
- Vite proxy: `/api` y `/auth` redirigen a backend en dev