# AgentOS — Lessons Learned

Actualizar este archivo despues de CUALQUIER correccion del usuario o error descubierto.
Formato: fecha, contexto, leccion, regla para el futuro.

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