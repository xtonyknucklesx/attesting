import React from 'react';
import { CheckCircle2, XCircle, X } from 'lucide-react';
import type { Toast } from '../../hooks/useToast';

export default function Toasts({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  if (toasts.length === 0) return null;
  return (
    <div className="toast-container" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.type === 'success' ? 'toast-success' : 'toast-error'}`}>
          {t.type === 'success'
            ? <CheckCircle2 className="h-4 w-4 text-green-400 shrink-0" aria-hidden="true" />
            : <XCircle className="h-4 w-4 text-rose-400 shrink-0" aria-hidden="true" />}
          <span className="flex-1">{t.message}</span>
          <button onClick={() => onDismiss(t.id)} style={{ color: 'var(--text-dim)' }} aria-label="Dismiss">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
