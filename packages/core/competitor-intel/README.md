# competitor-intel

Reusable module for competitive lifecycle intelligence.
See: docs/superpowers/specs/2026-04-20-competitor-intel-design.md

Consumed by:
- apps/dashboard (UI + API endpoints in server.js)

Dependencies (internal):
- packages/core/db (pool)
- packages/core/ai-providers (claude)
- packages/core/crypto (AES-GCM helper — to be created in Task 1.2)

Public exports via index.js:
- createInvestigation, getInvestigation
- ingestEmails (worker entry)
- classifyEmail (phase 1 + 2)
- simulateEngagement
- calculateScoring
- exportAnalysisDocx
- reconBrand
