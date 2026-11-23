import React, { useState } from 'react';
import { AlertTriangle, RefreshCw, ShieldAlert } from 'lucide-react';
import { useI18n } from '../lib/i18n';

interface VaultConflictModalProps {
  open: boolean;
  serverRevision?: number;
  onReloadServer: () => Promise<void>;
  onForceOverwrite: () => Promise<void>;
  onClose: () => void;
}

export const VaultConflictModal: React.FC<VaultConflictModalProps> = ({
  open,
  serverRevision,
  onReloadServer,
  onForceOverwrite,
  onClose,
}) => {
  const { t } = useI18n();
  const [busyMode, setBusyMode] = useState<'reload' | 'force' | null>(null);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/50 backdrop-blur-[1px] p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="vault-conflict-title"
    >
      <div className="w-full max-w-lg bg-[#FBF9F5] border border-stone-300 rounded-xl p-6 sm:p-7 space-y-5">
        <div className="flex items-start gap-3 pb-4 border-b border-stone-200">
          <div className="p-2 rounded-lg bg-amber-100 text-amber-900 shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-mono-tabular text-amber-800">{t.conflict.kicker}</p>
            <h2
              id="vault-conflict-title"
              className="font-display text-2xl font-semibold text-stone-900 mt-0.5"
            >
              {t.conflict.title}
            </h2>
          </div>
        </div>

        <p className="text-xs text-stone-700 leading-relaxed">{t.conflict.desc}</p>

        {typeof serverRevision === 'number' && (
          <p className="text-xs font-mono-tabular text-stone-600 bg-white border border-stone-200 rounded-lg px-3.5 py-2">
            {t.conflict.revisionLabel}: #{serverRevision}
          </p>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-2.5 pt-2 border-t border-stone-200">
          <button
            type="button"
            disabled={busyMode !== null}
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium border border-stone-300 bg-white hover:bg-stone-50 text-stone-700 rounded-lg whitespace-nowrap"
          >
            {t.common.cancel}
          </button>
          <button
            type="button"
            disabled={busyMode !== null}
            onClick={async () => {
              setBusyMode('force');
              try {
                await onForceOverwrite();
              } finally {
                setBusyMode(null);
              }
            }}
            className="px-4 py-2 text-xs font-medium border border-red-300 text-red-800 hover:bg-red-50 disabled:opacity-60 rounded-lg inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            {busyMode === 'force' ? t.conflict.forcingBtn : t.conflict.forceBtn}
          </button>
          <button
            type="button"
            disabled={busyMode !== null}
            onClick={async () => {
              setBusyMode('reload');
              try {
                await onReloadServer();
              } finally {
                setBusyMode(null);
              }
            }}
            className="px-4 py-2 text-xs font-medium bg-[#9E2A2B] hover:bg-[#822021] disabled:opacity-60 text-white rounded-lg inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            {busyMode === 'reload' ? t.conflict.reloadingBtn : t.conflict.reloadBtn}
          </button>
        </div>
      </div>
    </div>
  );
};
