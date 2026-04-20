import { useState } from 'react';
import { Sparkles } from 'lucide-react';

export default function AIInlineTip({ message }) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <div className="ai-inline-tip">
      <Sparkles size={12} className="ai-inline-tip__icon" />
      <span>{message}</span>
      <button
        className="ai-inline-tip__dismiss"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss tip"
      >
        ×
      </button>
    </div>
  );
}
