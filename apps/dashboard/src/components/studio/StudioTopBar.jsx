// apps/dashboard/src/components/studio/StudioTopBar.jsx
import React from 'react';

const STEP_THRESHOLDS = {
  brief: 0,
  content: 1,
  images: 5,
  preview: 10,
  handoff: 15,
};

function getCurrentStep(approvedCount) {
  if (approvedCount >= STEP_THRESHOLDS.handoff) return 'handoff';
  if (approvedCount >= STEP_THRESHOLDS.preview) return 'preview';
  if (approvedCount >= STEP_THRESHOLDS.images) return 'images';
  if (approvedCount >= STEP_THRESHOLDS.content) return 'content';
  return 'brief';
}

const STEPS = ['brief', 'content', 'images', 'preview', 'handoff'];
const STEP_LABELS = {
  brief:   'Brief',
  content: 'Content',
  images:  'Images',
  preview: 'Preview',
  handoff: 'Handoff',
};

export default function StudioTopBar({ ticket, progressStats, onShowPreviewModal, onHandoff, canHandoff }) {
  const { approved = 0, total = 0 } = progressStats || {};
  const currentStep = getCurrentStep(approved);
  const currentIdx = STEPS.indexOf(currentStep);

  return (
    <div className="studio-topbar">
      <div className="studio-topbar-left">
        <div className="studio-logo">Content Studio</div>
        <div className="studio-topbar-sep" />
        {ticket ? (
          <div className="studio-ticket-pill" title={ticket.project_name}>
            <div className="studio-ticket-dot" />
            #{ticket.id} — {ticket.project_name}
          </div>
        ) : (
          <div className="studio-ticket-pill" style={{ opacity: 0.5 }}>
            <div className="studio-ticket-dot" />
            No active ticket
          </div>
        )}
      </div>

      <div className="studio-topbar-center">
        {STEPS.map((step, i) => {
          const isDone = i < currentIdx;
          const isActive = i === currentIdx;
          return (
            <React.Fragment key={step}>
              {i > 0 && <div className="studio-step-conn">›</div>}
              <div className={`studio-step ${isDone ? 'done' : isActive ? 'active' : 'pending'}`}>
                {isDone ? '✓ ' : isActive ? '◉ ' : '○ '}{STEP_LABELS[step]}
              </div>
            </React.Fragment>
          );
        })}
      </div>

      <div className="studio-topbar-right">
        <span className="studio-progress-badge">{approved} / {total} fields approved</span>
        <button className="studio-btn studio-btn-ghost" onClick={onShowPreviewModal} disabled={!ticket}>
          ⊞ All variants
        </button>
        <button
          className="studio-btn studio-btn-primary"
          onClick={onHandoff}
          disabled={!canHandoff}
          title={canHandoff ? 'Send content to HTML Developer' : 'Approve at least one complete variant to handoff'}
        >
          → Send to HTML Dev
        </button>
      </div>
    </div>
  );
}
