# Campaign Briefs CRUD · Implementation Plan (v2)

> **For agentic workers:** Use superpowers:subagent-driven-development or superpowers:executing-plans to execute task-by-task.

**Goal:** Full CRUD on the Briefs Board: users can **Edit** a saved brief (which opens the wizard pre-filled with ALL previous work — Setup + Content Studio variants, blocks, copy, images — and lets them pick up where they left off), **Delete** briefs that aren't deployed, and see an enriched preview of briefs that already have content drafted.

**Key architectural change from CRUD v1:** Persist the wizard's full working state (`wizard_state` JSONB). Auto-save on every meaningful change. The Edit button becomes a thin navigation into the wizard with the same brief. "Save draft" becomes real (was decorative).

**Tech Stack:** React 19 + React Router 7, Express 5, `pg`, Railway PostgreSQL. CSS custom properties. No new dependencies. Debounced auto-save (300ms) on the wizard state.

---

## File Structure

**Modified files:**
- `apps/dashboard/migrations/202604220002_briefs-wizard-state.sql` — **new**, adds `wizard_state JSONB` column.
- `packages/core/db/schema.sql` — mirror the column.
- `apps/dashboard/server.js` — whitelist `wizard_state` in the PATCH endpoint + add `DELETE /api/campaign-briefs/:id`.
- `apps/dashboard/src/pages/CampaignCreationV2/lib/briefsApi.js` — add `remove(id)`.
- `apps/dashboard/src/pages/CampaignCreationV2Page.jsx` — seed from `brief.wizard_state` when present, fall back to `stateFromBrief`; add debounced auto-save; surface a "saved Xs ago" chip.
- `apps/dashboard/src/pages/CampaignCreationV2/components/BriefDetailModal.jsx` — Edit button now navigates to `?mode=wizard`; add Delete button with confirm-twice; add `AcceptedOptionPreview` when brief has draft content.
- `apps/dashboard/src/pages/CampaignCreationV2/BriefsBoard.jsx` — verify modal close re-loads the list (no change if already present).
- `apps/dashboard/src/pages/CampaignCreationV2/campaign-creation-v2.css` — preview-mock + danger-button styles.

**No new component files** — we're enriching the modal and adding persistence to the existing wizard.

---

## Phase 1 · Persist wizard state

### Task 1.1: Migration for `wizard_state`

**Files:**
- Create: `apps/dashboard/migrations/202604220002_briefs-wizard-state.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Store the full wizard working state so users can Edit a saved brief and
-- resume Content Studio work (variants, blocks, copy, images) exactly where
-- they left off. JSON shape matches the React state in CampaignCreationV2Page.
ALTER TABLE campaign_briefs
  ADD COLUMN IF NOT EXISTS wizard_state JSONB;
```

- [ ] **Step 2: Apply against Railway** (controller applies; subagent does NOT run psql/node)

Controller runs:
```bash
node scripts/apply-migration.mjs apps/dashboard/migrations/202604220002_briefs-wizard-state.sql
```

- [ ] **Step 3: Mirror in schema.sql**

Append to `packages/core/db/schema.sql` after the existing `campaign_briefs` block:
```sql
-- Wizard working state (added 2026-04-22)
ALTER TABLE campaign_briefs ADD COLUMN IF NOT EXISTS wizard_state JSONB;
```

- [ ] **Step 4: Commit**

```bash
git add apps/dashboard/migrations/202604220002_briefs-wizard-state.sql packages/core/db/schema.sql
git commit -m "feat(briefs): add wizard_state JSONB column"
```

### Task 1.2: Whitelist `wizard_state` in PATCH

**Files:**
- Modify: `apps/dashboard/server.js`

- [ ] **Step 1: Find the PATCH endpoint** — look for `app.patch('/api/campaign-briefs/:id'`. The `allowed` array is hard-coded there.

- [ ] **Step 2: Add `wizard_state`** to the `allowed` array AND to the `jsonbFields` Set:

```js
const allowed = [
    'name','objective','send_date','template_id','markets','languages',
    'variants_plan','audience_summary','status','accepted_option','campaign_id',
    'wizard_state',
];
const jsonbFields = new Set(['markets','languages','variants_plan','accepted_option','wizard_state']);
```

- [ ] **Step 3: Verify syntax**

```bash
cd .worktrees/campaign-creation-v2-briefs
node --check apps/dashboard/server.js && echo "✓ syntax ok"
```

- [ ] **Step 4: Commit**

```bash
git add apps/dashboard/server.js
git commit -m "feat(briefs): accept wizard_state in PATCH"
```

---

## Phase 2 · Delete endpoint + briefsApi.remove

### Task 2.1: DELETE endpoint

**Files:**
- Modify: `apps/dashboard/server.js`

- [ ] **Step 1: Add the endpoint just after `POST /:id/dismiss`**

```js
// DELETE /api/campaign-briefs/:id
// Hard-delete. Refuses on in_wizard-with-campaign_id or sent — those are tied
// to a running or deployed campaign and deleting would orphan data. Briefs
// still being edited (status=in_wizard but no campaign_id) CAN be deleted.
app.delete('/api/campaign-briefs/:id', requireAuth, async (req, res) => {
    try {
        const { rows: [existing] } = await pool.query(
            `SELECT id, status, campaign_id FROM campaign_briefs WHERE id = $1`,
            [req.params.id],
        );
        if (!existing) return res.status(404).json({ error: 'brief not found' });
        if (existing.status === 'sent' || (existing.status === 'in_wizard' && existing.campaign_id)) {
            return res.status(409).json({
                error: `cannot delete a brief with status '${existing.status}' — it is tied to an active or deployed campaign`,
            });
        }
        await pool.query(`DELETE FROM campaign_briefs WHERE id = $1`, [req.params.id]);
        res.json({ ok: true, id: req.params.id });
    } catch (err) {
        console.error('[briefs] delete failed', err);
        res.status(500).json({ error: err.message });
    }
});
```

- [ ] **Step 2: Smoke test** (server must be restarted after edit)

```bash
ID=$(curl -s -b cookies.txt -X POST http://localhost:3002/api/campaign-briefs | jq -r .brief.id)
curl -s -b cookies.txt -X DELETE http://localhost:3002/api/campaign-briefs/$ID | jq
# → {"ok":true,"id":"..."}
curl -s -b cookies.txt -X DELETE http://localhost:3002/api/campaign-briefs/$ID | jq
# → {"error":"brief not found"}
```

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/server.js
git commit -m "feat(briefs): DELETE endpoint with active-campaign guard"
```

### Task 2.2: briefsApi.remove

**Files:**
- Modify: `apps/dashboard/src/pages/CampaignCreationV2/lib/briefsApi.js`

- [ ] **Step 1: Add to the `briefsApi` object**

```js
remove: (id) => request(`/${id}`, { method: 'DELETE' }),
```

- [ ] **Step 2: Commit**

```bash
git add apps/dashboard/src/pages/CampaignCreationV2/lib/briefsApi.js
git commit -m "feat(cc2): briefsApi.remove()"
```

---

## Phase 3 · Auto-save the wizard state

### Task 3.1: Seed from `wizard_state` when present

**Files:**
- Modify: `apps/dashboard/src/pages/CampaignCreationV2Page.jsx`

- [ ] **Step 1: Change the useEffect that loads the brief** (around the top of the exported component) so that when `brief.wizard_state` is present we hydrate from it directly, otherwise we fall back to the first-time seeder `stateFromBrief(brief)`:

```jsx
useEffect(() => {
  if (!briefId) return;
  let cancelled = false;
  fetch(`${import.meta.env.VITE_API_URL || '/api'}/campaign-briefs`, { credentials: 'include' })
    .then(r => r.ok ? r.json() : Promise.reject(new Error(`${r.status}`)))
    .then(({ briefs }) => {
      if (cancelled) return;
      const b = (briefs || []).find(x => x.id === briefId);
      if (!b) { setBriefError('Brief not found'); return; }
      setBrief(b);
      setState(b.wizard_state && Object.keys(b.wizard_state).length > 0
        ? b.wizard_state
        : stateFromBrief(b));
    })
    .catch(err => { if (!cancelled) setBriefError(err.message); });
  return () => { cancelled = true; };
}, [briefId]);
```

- [ ] **Step 2: Commit**

```bash
git add apps/dashboard/src/pages/CampaignCreationV2Page.jsx
git commit -m "feat(cc2): wizard hydrates from wizard_state when resuming an edit"
```

### Task 3.2: Debounced auto-save on every change

**Files:**
- Modify: `apps/dashboard/src/pages/CampaignCreationV2Page.jsx`

- [ ] **Step 1: Add save state** next to the existing `useState` calls in the exported component:

```jsx
const [saveStatus, setSaveStatus] = useState('idle');   // 'idle' | 'saving' | 'saved' | 'error'
const [savedAt, setSavedAt] = useState(null);
const saveTimerRef = useRef(null);
const initialSkipRef = useRef(true);
```

(Also add `useRef` to the existing `import React, { useState, useMemo, useEffect }` import at the top.)

- [ ] **Step 2: Add a debounced save effect** right after the loader effect:

```jsx
// Debounced auto-save. Skips the very first render (that's the hydration from DB).
useEffect(() => {
  if (!briefId || !brief) return;
  if (initialSkipRef.current) { initialSkipRef.current = false; return; }
  clearTimeout(saveTimerRef.current);
  setSaveStatus('saving');
  saveTimerRef.current = setTimeout(async () => {
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL || '/api'}/campaign-briefs/${briefId}`,
        {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ wizard_state: state }),
        },
      );
      if (!res.ok) throw new Error(`${res.status}`);
      setSaveStatus('saved');
      setSavedAt(new Date());
    } catch (err) {
      console.error('[cc2] autosave failed', err);
      setSaveStatus('error');
    }
  }, 400);
  return () => clearTimeout(saveTimerRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [state, briefId, brief]);
```

- [ ] **Step 3: Turn the decorative "Save draft" chip into a live indicator**

Find the `<button className="cc2-btn cc2-btn-soft cc2-btn-sm">Save draft</button>` block in the top bar and replace with:

```jsx
{briefId && (
  <span
    className={`cc2-save-status cc2-save-status--${saveStatus}`}
    title={savedAt ? `Last saved: ${savedAt.toLocaleTimeString()}` : ''}
  >
    {saveStatus === 'saving' && 'Saving…'}
    {saveStatus === 'saved' && `Saved ${savedAt?.toLocaleTimeString() || ''}`}
    {saveStatus === 'error' && 'Save failed'}
    {saveStatus === 'idle' && ''}
  </span>
)}
{!briefId && (
  <button className="cc2-btn cc2-btn-soft cc2-btn-sm" disabled title="Saves automatically when launched from a brief">
    Save draft
  </button>
)}
```

- [ ] **Step 4: Browser check**

Launch from + New → chat → accept an option → wizard. Change the Campaign Name; wait 400ms; the chip shows "Saving…" then "Saved 3:42 PM". Reload the page — wizard comes back with your edit intact.

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/src/pages/CampaignCreationV2Page.jsx
git commit -m "feat(cc2): debounced auto-save of wizard state (400ms)"
```

### Task 3.3: Save-status CSS

**Files:**
- Modify: `apps/dashboard/src/pages/CampaignCreationV2Page.jsx` (the inlined `styles` template string)

- [ ] **Step 1: Append to the template-literal `styles`** string inside the wizard file (search for the end of the literal — usually a closing backtick). Add:

```css
.cc2-save-status {
  font-size: 12px;
  color: var(--text-muted);
  padding: 4px 10px;
  border-radius: 12px;
  font-family: inherit;
}
.cc2-save-status--saving { color: var(--accent-yellow, #fbbf24); }
.cc2-save-status--saved  { color: var(--accent-green,  #10b981); }
.cc2-save-status--error  { color: #dc2626; }
```

- [ ] **Step 2: Commit**

```bash
git add apps/dashboard/src/pages/CampaignCreationV2Page.jsx
git commit -m "feat(cc2): save-status chip styles"
```

---

## Phase 4 · BriefDetailModal — Edit/Delete + preview

### Task 4.1: Wire Edit button to wizard + Delete with confirm-twice

**Files:**
- Modify: `apps/dashboard/src/pages/CampaignCreationV2/components/BriefDetailModal.jsx`

- [ ] **Step 1: Add state + helpers** at the top of the component (next to the existing `useState` for `brief`):

```jsx
const [deleteArmed, setDeleteArmed] = useState(false);
const [deleting, setDeleting] = useState(false);

async function openInWizard() {
  navigate(`/app/campaign-creation-v2?briefId=${brief.id}&mode=wizard`);
  onClose();
}

async function deleteBrief() {
  if (!deleteArmed) { setDeleteArmed(true); return; }
  setDeleting(true);
  try {
    await briefsApi.remove(brief.id);
    onClose();
  } catch (err) {
    alert(`Could not delete: ${err.message}`);
    setDeleteArmed(false);
  } finally {
    setDeleting(false);
  }
}
```

- [ ] **Step 2: Replace the existing footer block** with:

```jsx
<footer className="cc2-modal__footer">
  <button
    className={`cc2-btn cc2-btn--danger ${deleteArmed ? 'is-armed' : ''}`}
    onClick={deleteBrief}
    type="button"
    disabled={deleting || brief.status === 'sent' || (brief.status === 'in_wizard' && brief.campaign_id)}
    title={
      brief.status === 'sent' || (brief.status === 'in_wizard' && brief.campaign_id)
        ? 'Cannot delete a brief tied to a deployed campaign'
        : 'Delete this brief permanently'
    }
  >
    <Trash2 size={14} /> {deleteArmed ? 'Click again to confirm' : 'Delete'}
  </button>

  {isAi && brief.status !== 'dismissed' && (
    <button className="cc2-btn" onClick={dismiss} type="button">
      Dismiss
    </button>
  )}

  <div style={{ flex: 1 }} />

  {/* Resume editing takes over for "Activate" once the brief is in_wizard —
      the verb changes but the destination is the same: open the wizard. */}
  {(brief.status === 'in_wizard') ? (
    <button className="cc2-btn primary" onClick={openInWizard} type="button">
      <Pencil size={14} /> Resume editing
    </button>
  ) : canActivate ? (
    <>
      <button className="cc2-btn" onClick={openInWizard} type="button">
        <Pencil size={14} /> Edit in wizard
      </button>
      <button className="cc2-btn primary" onClick={activate} type="button">
        <Play size={14} /> Activate
      </button>
    </>
  ) : null}
</footer>
```

- [ ] **Step 3: Add `Pencil` to the lucide-react import** at the top:

```jsx
import { X, Play, Trash2, Sparkles, User, Pencil } from 'lucide-react';
```

- [ ] **Step 4: Commit**

```bash
git add apps/dashboard/src/pages/CampaignCreationV2/components/BriefDetailModal.jsx
git commit -m "feat(cc2): BriefDetailModal — Edit navigates to wizard; Delete with confirm"
```

### Task 4.2: Preview mock when brief has content

**Files:**
- Modify: `apps/dashboard/src/pages/CampaignCreationV2/components/BriefDetailModal.jsx`

- [ ] **Step 1: Add the preview component** below the existing `Field` helper:

```jsx
function AcceptedOptionPreview({ option }) {
  return (
    <div className="cc2-preview-mock">
      <div className="cc2-preview-mock__label">
        📧 PREVIEW · {(option.direction || 'content').toUpperCase()}
      </div>
      <div className="cc2-preview-mock__body">
        <div className="cc2-preview-mock__subject">{option.subject || '(no subject)'}</div>
        <div className="cc2-preview-mock__preheader">{option.preheader}</div>
        {option.headline && <h4 className="cc2-preview-mock__headline">{option.headline}</h4>}
        <p className="cc2-preview-mock__copy">{option.body}</p>
        {option.cta_label && (
          <button type="button" className="cc2-btn primary" disabled>
            {option.cta_label}
          </button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Render it in the modal body** right above the existing `<dl className="cc2-fields">`:

```jsx
<div className="cc2-modal__body">
  {isAi && brief.opportunity_reason && (
    <div className="cc2-reason">
      <div className="cc2-reason__label">💡 WHY IS THIS AN OPPORTUNITY?</div>
      <div className="cc2-reason__text">{brief.opportunity_reason}</div>
    </div>
  )}

  {brief.accepted_option && <AcceptedOptionPreview option={brief.accepted_option} />}

  <dl className="cc2-fields">
    …existing fields…
  </dl>
</div>
```

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/src/pages/CampaignCreationV2/components/BriefDetailModal.jsx
git commit -m "feat(cc2): BriefDetailModal — preview mock when accepted_option present"
```

---

## Phase 5 · Styles

### Task 5.1: Append preview + danger-button styles

**Files:**
- Modify: `apps/dashboard/src/pages/CampaignCreationV2/campaign-creation-v2.css`

- [ ] **Step 1: Append**

```css

/* Accepted-option preview mock inside BriefDetailModal */
.cc2-preview-mock {
  border: 1px solid var(--border-light);
  border-radius: 8px;
  overflow: hidden;
  margin-bottom: 20px;
  background: var(--bg-elevated);
}
.cc2-preview-mock__label {
  background: var(--bg-card);
  padding: 8px 12px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.05em;
  color: var(--text-muted);
  border-bottom: 1px solid var(--border-light);
}
.cc2-preview-mock__body { padding: 16px; }
.cc2-preview-mock__subject {
  font-size: 15px; font-weight: 600;
  color: var(--text-main); margin-bottom: 4px;
}
.cc2-preview-mock__preheader {
  font-size: 12px; color: var(--text-muted); margin-bottom: 12px;
}
.cc2-preview-mock__headline {
  margin: 0 0 8px 0; font-size: 18px; color: var(--text-main);
}
.cc2-preview-mock__copy {
  font-size: 13px; color: var(--text-main);
  line-height: 1.5; margin: 0 0 14px 0; white-space: pre-wrap;
}

/* Danger button (Delete) */
.cc2-btn--danger {
  color: #dc2626;
  border-color: rgba(220, 38, 38, 0.3);
}
.cc2-btn--danger:hover:not(:disabled) {
  background: rgba(220, 38, 38, 0.08);
  border-color: #dc2626;
}
.cc2-btn--danger.is-armed {
  background: #dc2626;
  color: #fff;
  border-color: #dc2626;
}
.cc2-btn--danger:disabled {
  color: var(--text-muted);
  border-color: var(--border-light);
  background: transparent;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/dashboard/src/pages/CampaignCreationV2/campaign-creation-v2.css
git commit -m "feat(cc2): styles for preview mock and danger button"
```

---

## Phase 6 · Verification

### Task 6.1: End-to-end manual test

- [ ] **Step 1: + New brief** → chat → accept an option → land in wizard. Fill name, pick a variant, edit subject/preheader/body. Wait 400ms. Chip shows "Saved 3:42 PM".

- [ ] **Step 2: Back to briefs** (top-left button). Open the card → modal should show Preview mock with the subject/headline/body I just edited.

- [ ] **Step 3: Click "Resume editing"** in the modal footer → wizard opens with ALL my changes restored (name, variant content, blocks, subject, etc.). Not just `accepted_option` — the full state.

- [ ] **Step 4: Click Delete** in the modal footer on a draft or active brief → button turns red ("Click again to confirm"). Second click → brief disappears from the board.

- [ ] **Step 5: Try Delete on an AI brief `sent`** (simulate one in the DB if needed: `UPDATE campaign_briefs SET status='sent' WHERE ...`). Button is disabled with tooltip.

- [ ] **Step 6: Try resume-editing across browsers/tabs.** Edit in tab A → refresh tab B → see the same state.

---

## Self-Review

**Spec coverage:**
- Edit → Phase 3 (full wizard_state persistence) + Phase 4.1 (button navigates).
- Delete → Phase 2.1 + Phase 4.1 (confirm-twice UI).
- Preview → Phase 4.2 `AcceptedOptionPreview`.
- Dismiss kept separate → footer logic in 4.1.
- Guard for deployed campaigns → DELETE endpoint 409 + disabled button state.

**No placeholders.** Every step has concrete code.

**Type consistency:**
- `wizard_state` is JSONB on the server, plain JS object on the client. The PATCH helper stringifies JSONB fields automatically (already handled in Task 1.2).
- `initialSkipRef` guards the autosave from firing on hydration.

**Edge cases:**
- Brief loaded from a fresh chat → no `wizard_state` yet → falls through to `stateFromBrief(b)` seed (existing behavior preserved).
- Brief with partial `wizard_state` → hydrates whatever's there; other fields default from the component.
- Autosave race: the 400ms debounce + AbortController not needed because PATCH is idempotent. Worst case: two successive saves, second one wins.
- Delete while wizard is open in another tab → that tab will 404 on next save. Acceptable.
- `in_wizard` brief with no `campaign_id` → allowed to delete (user was just drafting). With `campaign_id` → refused.

---

## Execution

- **Subagent-driven** recommended (9 commits, each small and testable).
- Controller applies the migration in Task 1.1 Step 2 (as before — subagents don't touch Railway).
