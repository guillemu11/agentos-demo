# Campaign Briefs CRUD · Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development or superpowers:executing-plans to execute task-by-task.

**Goal:** Add full CRUD to the Briefs Board so users can edit any brief (human or AI), delete briefs that haven't been deployed, and see an enriched visual preview when a brief already has an accepted content option.

**Architecture:** Extend the existing `BriefDetailModal` with an inline edit mode + a Delete button, add a `DELETE /api/campaign-briefs/:id` endpoint with guards for `in_wizard` / `sent` statuses, and enrich the read-only view with a compact email mockup when `accepted_option` is present. Dismiss (soft-hide AI opportunities) stays separate and continues to apply only to AI briefs.

**Tech Stack:** React 19 + React Router 7, Express 5, `pg`, Railway PostgreSQL. CSS custom properties in `campaign-creation-v2.css`. No new dependencies.

---

## File Structure

**Modified files:**
- `apps/dashboard/server.js` — add `DELETE /api/campaign-briefs/:id` endpoint inline (project rule 5).
- `apps/dashboard/src/pages/CampaignCreationV2/lib/briefsApi.js` — add `remove(id)` and `patch(id, patch)` if not already used.
- `apps/dashboard/src/pages/CampaignCreationV2/components/BriefDetailModal.jsx` — add edit mode, delete flow, enriched preview.
- `apps/dashboard/src/pages/CampaignCreationV2/campaign-creation-v2.css` — styles for edit inputs, preview mockup, confirm-delete button.
- `apps/dashboard/src/pages/CampaignCreationV2/BriefsBoard.jsx` — remove stale-data issue by reloading after modal close (already does this; verify only).

**No new files.**

---

## Phase 1 · DELETE endpoint

### Task 1.1: Add DELETE to server.js

**Files:**
- Modify: `apps/dashboard/server.js`

- [ ] **Step 1: Add the endpoint just after the `POST /:id/dismiss` block**

```js
// DELETE /api/campaign-briefs/:id
// Hard-delete a brief. Refuses if status is in_wizard or sent — those are
// tied to an executed or in-flight campaign and deleting them is destructive.
app.delete('/api/campaign-briefs/:id', requireAuth, async (req, res) => {
    try {
        const { rows: [existing] } = await pool.query(
            `SELECT id, status FROM campaign_briefs WHERE id = $1`,
            [req.params.id],
        );
        if (!existing) return res.status(404).json({ error: 'brief not found' });
        if (existing.status === 'in_wizard' || existing.status === 'sent') {
            return res.status(409).json({
                error: `cannot delete a brief with status '${existing.status}' — it is tied to an active campaign`,
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

- [ ] **Step 2: Syntax check**

```bash
cd .worktrees/campaign-creation-v2-briefs
node --check apps/dashboard/server.js && echo "✓ syntax ok"
```

- [ ] **Step 3: Smoke test** (server must be restarted after edit)

```bash
# create a draft
ID=$(curl -s -b cookies.txt -X POST http://localhost:3002/api/campaign-briefs | jq -r .brief.id)

# delete it
curl -s -b cookies.txt -X DELETE http://localhost:3002/api/campaign-briefs/$ID | jq
# → {"ok":true,"id":"..."}

# 404 on second delete
curl -s -b cookies.txt -X DELETE http://localhost:3002/api/campaign-briefs/$ID | jq
# → {"error":"brief not found"}
```

- [ ] **Step 4: Commit**

```bash
git add apps/dashboard/server.js
git commit -m "feat(briefs): DELETE endpoint with status guard

Refuses to delete briefs in status in_wizard or sent (tied to active or
deployed campaigns). Returns 409 with explanatory message."
```

---

## Phase 2 · briefsApi client

### Task 2.1: Add `remove` method

**Files:**
- Modify: `apps/dashboard/src/pages/CampaignCreationV2/lib/briefsApi.js`

- [ ] **Step 1: Add the method** in the `briefsApi` object literal next to `dismiss`:

```js
remove: (id) => request(`/${id}`, { method: 'DELETE' }),
```

Keep the existing `patch(id, patch)` method — it's already the Update half of CRUD.

- [ ] **Step 2: Commit**

```bash
git add apps/dashboard/src/pages/CampaignCreationV2/lib/briefsApi.js
git commit -m "feat(cc2): briefsApi.remove() for hard delete"
```

---

## Phase 3 · BriefDetailModal edit mode

### Task 3.1: Introduce `mode` state + editable form shape

**Files:**
- Modify: `apps/dashboard/src/pages/CampaignCreationV2/components/BriefDetailModal.jsx`

- [ ] **Step 1: Replace the top of the component with a mode-aware version**

At the top of `BriefDetailModal`, after the `useState` for `brief` and `error`, add:

```jsx
const [mode, setMode] = useState('view');   // 'view' | 'edit'
const [form, setForm] = useState(null);     // edit form state, seeded on enter edit
const [saving, setSaving] = useState(false);
const [deleteArmed, setDeleteArmed] = useState(false);
```

And right after the `useEffect` that loads the brief, add a helper:

```jsx
function enterEdit() {
  setForm({
    name:             brief.name || '',
    objective:        brief.objective || '',
    send_date:        brief.send_date ? new Date(brief.send_date).toISOString().slice(0, 16) : '',
    template_id:      brief.template_id || '',
    markets:          Array.isArray(brief.markets) ? brief.markets.join(', ') : '',
    languages:        Array.isArray(brief.languages) ? brief.languages.join(', ') : '',
    audience_summary: brief.audience_summary || '',
  });
  setMode('edit');
  setDeleteArmed(false);
}

function cancelEdit() {
  setForm(null);
  setMode('view');
}

async function saveEdit() {
  setSaving(true);
  try {
    const patch = {
      name:             form.name.trim() || null,
      objective:        form.objective.trim() || null,
      send_date:        form.send_date ? new Date(form.send_date).toISOString() : null,
      template_id:      form.template_id.trim() || null,
      markets:          form.markets.split(',').map(s => s.trim()).filter(Boolean),
      languages:        form.languages.split(',').map(s => s.trim()).filter(Boolean),
      audience_summary: form.audience_summary.trim() || null,
    };
    const { brief: updated } = await briefsApi.patch(brief.id, patch);
    setBrief(updated);
    setMode('view');
    setForm(null);
  } catch (err) {
    alert(`Could not save: ${err.message}`);
  } finally {
    setSaving(false);
  }
}

async function deleteBrief() {
  if (!deleteArmed) { setDeleteArmed(true); return; }
  try {
    await briefsApi.remove(brief.id);
    onClose();  // parent reloads on close
  } catch (err) {
    alert(`Could not delete: ${err.message}`);
    setDeleteArmed(false);
  }
}
```

- [ ] **Step 2: Commit the scaffold**

```bash
git add apps/dashboard/src/pages/CampaignCreationV2/components/BriefDetailModal.jsx
git commit -m "feat(cc2): BriefDetailModal — mode state + edit/delete helpers"
```

### Task 3.2: Render view vs edit

**Files:**
- Modify: `apps/dashboard/src/pages/CampaignCreationV2/components/BriefDetailModal.jsx`

- [ ] **Step 1: Replace the body rendering (`<div className="cc2-modal__body">...</div>`)** with a switch on `mode`:

```jsx
<div className="cc2-modal__body">
  {mode === 'view' ? (
    <>
      {isAi && brief.opportunity_reason && (
        <div className="cc2-reason">
          <div className="cc2-reason__label">💡 WHY IS THIS AN OPPORTUNITY?</div>
          <div className="cc2-reason__text">{brief.opportunity_reason}</div>
        </div>
      )}

      {brief.accepted_option && <AcceptedOptionPreview option={brief.accepted_option} />}

      <dl className="cc2-fields">
        <Field label="Objective" value={brief.objective} />
        <Field label="Send date" value={brief.send_date && new Date(brief.send_date).toLocaleString()} />
        <Field label="Template"  value={brief.template_id} />
        <Field label="Markets"   value={markets.join(', ')} />
        <Field label="Languages" value={langs.join(', ')} />
        <Field label="Audience"  value={brief.audience_summary} />
        <Field label="Status"    value={brief.status} />
      </dl>
    </>
  ) : (
    <EditForm form={form} setForm={setForm} />
  )}
</div>
```

- [ ] **Step 2: Add the `EditForm` component** below the existing `Field` helper:

```jsx
function EditForm({ form, setForm }) {
  const upd = (k) => (e) => setForm(prev => ({ ...prev, [k]: e.target.value }));
  return (
    <div className="cc2-edit-grid">
      <label className="cc2-edit-row">
        <span className="cc2-edit-label">Name</span>
        <input className="cc2-edit-input" value={form.name} onChange={upd('name')} />
      </label>
      <label className="cc2-edit-row">
        <span className="cc2-edit-label">Objective</span>
        <input className="cc2-edit-input" value={form.objective} onChange={upd('objective')} />
      </label>
      <label className="cc2-edit-row">
        <span className="cc2-edit-label">Send date</span>
        <input type="datetime-local" className="cc2-edit-input" value={form.send_date} onChange={upd('send_date')} />
      </label>
      <label className="cc2-edit-row">
        <span className="cc2-edit-label">Template</span>
        <input className="cc2-edit-input" value={form.template_id} onChange={upd('template_id')} />
      </label>
      <label className="cc2-edit-row">
        <span className="cc2-edit-label">Markets (comma-separated)</span>
        <input className="cc2-edit-input" value={form.markets} onChange={upd('markets')} placeholder="FR, DE, UK" />
      </label>
      <label className="cc2-edit-row">
        <span className="cc2-edit-label">Languages (comma-separated)</span>
        <input className="cc2-edit-input" value={form.languages} onChange={upd('languages')} placeholder="en, fr" />
      </label>
      <label className="cc2-edit-row cc2-edit-row--full">
        <span className="cc2-edit-label">Audience</span>
        <textarea
          className="cc2-edit-input cc2-edit-textarea"
          value={form.audience_summary}
          onChange={upd('audience_summary')}
          rows={2}
        />
      </label>
    </div>
  );
}
```

- [ ] **Step 3: Add the `AcceptedOptionPreview` component**:

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

- [ ] **Step 4: Commit**

```bash
git add apps/dashboard/src/pages/CampaignCreationV2/components/BriefDetailModal.jsx
git commit -m "feat(cc2): BriefDetailModal — edit form + accepted-option preview"
```

### Task 3.3: Rework the footer with Edit / Delete / Save / Cancel

**Files:**
- Modify: `apps/dashboard/src/pages/CampaignCreationV2/components/BriefDetailModal.jsx`

- [ ] **Step 1: Replace the existing footer block** with a mode-aware version:

```jsx
<footer className="cc2-modal__footer">
  {mode === 'view' ? (
    <>
      <button
        className={`cc2-btn cc2-btn--danger ${deleteArmed ? 'is-armed' : ''}`}
        onClick={deleteBrief}
        type="button"
        disabled={brief.status === 'in_wizard' || brief.status === 'sent'}
        title={
          brief.status === 'in_wizard' || brief.status === 'sent'
            ? 'Cannot delete a brief tied to an active or deployed campaign'
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
      <button className="cc2-btn" onClick={enterEdit} type="button">
        <Pencil size={14} /> Edit
      </button>
      {canActivate && (
        <button className="cc2-btn primary" onClick={activate} type="button">
          <Play size={14} /> Activate
        </button>
      )}
    </>
  ) : (
    <>
      <div style={{ flex: 1 }} />
      <button className="cc2-btn" onClick={cancelEdit} type="button" disabled={saving}>
        Cancel
      </button>
      <button className="cc2-btn primary" onClick={saveEdit} type="button" disabled={saving}>
        {saving ? 'Saving…' : 'Save changes'}
      </button>
    </>
  )}
</footer>
```

- [ ] **Step 2: Add the `Pencil` icon import** at the top of the file:

```jsx
import { X, Play, Trash2, Sparkles, User, Pencil } from 'lucide-react';
```

- [ ] **Step 3: Browser check**

Open the board, click a brief card:
- See preview mock if `accepted_option` is present.
- Click **Edit** → inputs appear, Save/Cancel on footer.
- Edit the name, Save → modal stays open with updated content.
- Click **Delete** → button turns red and says "Click again to confirm".
- Click again → brief disappears from the board.
- Try Delete on a brief in status `in_wizard` — button is disabled with tooltip.

- [ ] **Step 4: Commit**

```bash
git add apps/dashboard/src/pages/CampaignCreationV2/components/BriefDetailModal.jsx
git commit -m "feat(cc2): BriefDetailModal — footer with Edit/Delete/Save flow"
```

---

## Phase 4 · Styles

### Task 4.1: Append edit + preview + danger styles

**Files:**
- Modify: `apps/dashboard/src/pages/CampaignCreationV2/campaign-creation-v2.css`

- [ ] **Step 1: Append to the end of the file**

```css

/* Edit form inside BriefDetailModal */
.cc2-edit-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}
.cc2-edit-row { display: flex; flex-direction: column; gap: 4px; }
.cc2-edit-row--full { grid-column: 1 / -1; }
.cc2-edit-label {
  font-size: 11px;
  color: var(--text-muted);
  font-weight: 600;
}
.cc2-edit-input {
  background: var(--bg-elevated);
  border: 1px solid var(--border-light);
  color: var(--text-main);
  padding: 8px 10px;
  border-radius: 6px;
  font-size: 13px;
  font-family: inherit;
  width: 100%;
}
.cc2-edit-input:focus {
  outline: 2px solid var(--primary-soft);
  border-color: var(--primary);
}
.cc2-edit-textarea { resize: vertical; min-height: 50px; }

/* Accepted-option preview mock */
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
  font-size: 15px;
  font-weight: 600;
  color: var(--text-main);
  margin-bottom: 4px;
}
.cc2-preview-mock__preheader {
  font-size: 12px;
  color: var(--text-muted);
  margin-bottom: 12px;
}
.cc2-preview-mock__headline {
  margin: 0 0 8px 0;
  font-size: 18px;
  color: var(--text-main);
}
.cc2-preview-mock__copy {
  font-size: 13px;
  color: var(--text-main);
  line-height: 1.5;
  margin: 0 0 14px 0;
  white-space: pre-wrap;
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
git commit -m "feat(cc2): styles for edit form, preview mock, and danger button"
```

---

## Phase 5 · Board reload on modal close

### Task 5.1: Verify BriefsBoard reloads after delete/edit

**Files:**
- `apps/dashboard/src/pages/CampaignCreationV2/BriefsBoard.jsx`

- [ ] **Step 1: Read the `onClose` handler**

Current code:
```jsx
onClose={() => { setOpenBriefId(null); load(); }}
```

Verify `load()` is called. If yes, nothing to change. The modal's `onClose()` already triggers a fresh list fetch on the board, so:
- Edit → close modal → board re-renders with updated card.
- Delete → close modal → deleted card disappears.
- Dismiss → close modal → dismissed AI card disappears.

- [ ] **Step 2: If missing, add `load()` to the close handler.**

No commit needed if the call is already present.

---

## Self-Review

**Coverage:**
- Create → existed, unchanged.
- Read (enriched) → Phase 3.2 `AcceptedOptionPreview` component.
- Update → Phase 3.1 helpers + 3.2 EditForm + 3.3 Save button.
- Delete → Phase 1 endpoint + Phase 3.3 button with confirm-twice.
- Dismiss kept separate → Phase 3.3 only renders Dismiss for AI briefs not already dismissed.

**Placeholder scan:** every step has concrete code. Nothing vague.

**Type consistency:**
- `briefsApi.patch(id, patch)` already exists (no rename).
- `briefsApi.remove(id)` matches the DELETE endpoint path.
- `mode` values are the exact strings checked in conditionals (`'view'` / `'edit'`).
- `form.send_date` stays in datetime-local format in the form, converted to ISO on save.

**Edge cases covered:**
- Delete on `in_wizard` or `sent` → disabled button + backend 409.
- Empty trim fields on save → coerced to `null` so backend PATCH clears them.
- Markets/languages edited as CSV → split+trim+filter to array before save.

---

## Execution

You can run this with either:
- **Subagent-driven** (dispatch one subagent per task with review loops) — recommended.
- **Inline** (execute straight away, one commit per task).
