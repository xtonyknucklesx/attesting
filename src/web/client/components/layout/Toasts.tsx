import React from 'react';
import { CheckCircle2, XCircle, X } from 'lucide-react';
import type { Toast } from '../../hooks/useToast';

interface ToastsProps {
  toasts: Toast[];
  onDismiss: (id: number) => void;
}

export default function Toasts({ toasts, onDismiss }: ToastsProps) {
  if (toasts.length === 0) return null;
  return (
    <div className="toast-container" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.type === 'success' ? 'toast-success' : 'toast-error'}`}>
          {t.type === 'success'
            ? <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" aria-hidden="true" />
            : <XCircle className="h-4 w-4 text-rose-500 shrink-0" aria-hidden="true" />}
          <span className="flex-1 text-gray-700">{t.message}</span>
          <button onClick={() => onDismiss(t.id)} className="text-gray-400 hover:text-gray-600 shrink-0" aria-label="Dismiss">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
