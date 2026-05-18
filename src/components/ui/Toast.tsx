import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, AlertTriangle, Info, X } from 'lucide-react';
import { useApp } from '@/lib/store';

const iconMap = {
  info: Info,
  success: Check,
  error: AlertTriangle
};

const toneClass = {
  info: 'border-brand/40 text-brand-400',
  success: 'border-success/40 text-success',
  error: 'border-danger/40 text-danger'
};

export function Toast() {
  const toast = useApp((s) => s.toast);
  const dismiss = useApp((s) => s.dismissToast);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(dismiss, 4000);
    return () => clearTimeout(t);
  }, [toast, dismiss]);

  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          key={toast.id}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          className={`fixed bottom-10 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-3 h-10 rounded-xl bg-bg-2 border ${toneClass[toast.tone]} shadow-panel`}
        >
          {(() => {
            const Icon = iconMap[toast.tone];
            return <Icon className="w-4 h-4" />;
          })()}
          <span className="text-sm text-ink">{toast.message}</span>
          <button
            onClick={dismiss}
            className="ml-2 w-6 h-6 rounded-md hover:bg-bg-3 text-ink-dim flex items-center justify-center"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
