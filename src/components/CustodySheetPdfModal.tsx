import React, { useEffect, useState } from 'react';
import { FileDown, KeyRound, X } from 'lucide-react';
import { downloadHeirCustodySheetPdf } from '../lib/custodySheetPdf';
import { useI18n } from '../lib/i18n';
import type { ClanMetadata, UserProfile } from '../types/zupu';
import { SecretInput } from './SecretInput';

interface CustodySheetPdfModalProps {
  open: boolean;
  metadata: ClanMetadata | null;
  currentUser: UserProfile;
  onClose: () => void;
  onExported?: () => void;
}

export const CustodySheetPdfModal: React.FC<CustodySheetPdfModalProps> = ({
  open,
  metadata,
  currentUser,
  onClose,
  onExported,
}) => {
  const { t } = useI18n();
  const [pdfACompliant, setPdfACompliant] = useState(true);
  const [protectWithPassword, setProtectWithPassword] = useState(false);
  const [pdfPassword, setPdfPassword] = useState('');
  const [pdfConfirmPassword, setPdfConfirmPassword] = useState('');
  const [allowPrint, setAllowPrint] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setPdfACompliant(true);
      setProtectWithPassword(false);
      setPdfPassword('');
      setPdfConfirmPassword('');
      setAllowPrint(true);
      setError(null);
    }
  }, [open]);

  if (!open || !metadata) return null;

  const handleDownload = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedPassword = pdfPassword.trim();
    if (protectWithPassword) {
      if (trimmedPassword.length < 6) {
        setError(t.pdf.pdfPasswordMinLengthError);
        return;
      }
      if (pdfPassword !== pdfConfirmPassword) {
        setError(t.pdf.pdfPasswordMismatchError);
        return;
      }
    }

    setBusy(true);
    try {
      await downloadHeirCustodySheetPdf(metadata, currentUser, window.location.origin, {
        pdfACompliant: protectWithPassword ? false : pdfACompliant,
        password: protectWithPassword ? trimmedPassword : undefined,
        allowPrint,
      });
      onExported?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to generate custody sheet PDF');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/40 backdrop-blur-[1px] p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="custody-pdf-title"
    >
      <div className="w-full max-w-md max-h-[92vh] overflow-y-auto bg-[#FBF9F5] border border-stone-200 rounded-xl p-6 space-y-5">
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-stone-200">
          <div>
            <p className="text-xs text-stone-500 font-mono-tabular">
              {metadata.clanChineseName} · {metadata.keyFingerprint}
            </p>
            <h2
              id="custody-pdf-title"
              className="font-display text-2xl font-semibold text-stone-900 mt-0.5"
            >
              {t.pdf.custodyModalTitle}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.common.dismiss}
            className="p-2 rounded-lg border border-stone-200 bg-white hover:bg-stone-50 text-stone-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-stone-600 leading-relaxed">{t.pdf.custodyModalDesc}</p>

        {error && (
          <div
            role="alert"
            className="px-4 py-3 rounded-lg border border-red-300 bg-red-50 text-xs text-red-900"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleDownload} className="space-y-4">
          <div className="space-y-3 p-4 rounded-lg bg-white border border-stone-200">
            <label
              className={`flex items-start gap-2.5 text-xs ${
                protectWithPassword
                  ? 'text-stone-400 opacity-70 cursor-not-allowed'
                  : 'text-stone-800 cursor-pointer'
              }`}
            >
              <input
                type="checkbox"
                disabled={protectWithPassword}
                checked={!protectWithPassword && pdfACompliant}
                onChange={(e) => setPdfACompliant(e.target.checked)}
                className="mt-0.5 accent-[#9E2A2B]"
              />
              <span>
                <span className="font-medium block">{t.pdf.pdfACompliant}</span>
                <span className="text-[11px] text-stone-500 leading-relaxed">
                  {protectWithPassword ? t.pdf.pdfAPasswordDisabledNote : t.pdf.pdfACompliantHint}
                </span>
              </span>
            </label>

            <div className="pt-2 border-t border-stone-100 space-y-3">
              <label className="flex items-start gap-2.5 text-xs text-stone-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={protectWithPassword}
                  onChange={(e) => {
                    const enabled = e.target.checked;
                    setProtectWithPassword(enabled);
                    if (!enabled) {
                      setPdfPassword('');
                      setPdfConfirmPassword('');
                      setError(null);
                    }
                  }}
                  className="mt-0.5 accent-[#9E2A2B]"
                />
                <span>
                  <span className="font-medium text-stone-900 inline-flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-[#9E2A2B]" />
                    {t.pdf.protectWithPassword}
                  </span>
                  <span className="block text-[11px] text-stone-500 leading-relaxed mt-0.5">
                    {t.pdf.protectWithPasswordHint}
                  </span>
                </span>
              </label>

              {protectWithPassword && (
                <div className="pl-6 space-y-3 pt-1">
                  <div>
                    <label className="block text-[11px] font-medium text-stone-700 mb-1">
                      {t.pdf.pdfPasswordLabel}
                    </label>
                    <SecretInput
                      required
                      minLength={6}
                      autoComplete="new-password"
                      showStrengthMeter
                      value={pdfPassword}
                      onChange={setPdfPassword}
                      onGeneratePassphrase={(generated) => {
                        setPdfPassword(generated);
                        setPdfConfirmPassword(generated);
                      }}
                      placeholder={t.pdf.pdfPasswordPlaceholder}
                      className="px-3 py-2 text-xs bg-[#FBF9F5] border border-stone-300 rounded-lg focus:outline-none focus:border-[#9E2A2B]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-stone-700 mb-1">
                      {t.pdf.pdfConfirmPasswordLabel}
                    </label>
                    <SecretInput
                      required
                      minLength={6}
                      autoComplete="new-password"
                      value={pdfConfirmPassword}
                      onChange={setPdfConfirmPassword}
                      placeholder={t.pdf.pdfPasswordPlaceholder}
                      className="px-3 py-2 text-xs bg-[#FBF9F5] border border-stone-300 rounded-lg focus:outline-none focus:border-[#9E2A2B]"
                    />
                  </div>
                  <label className="flex items-center gap-2 text-xs text-stone-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={allowPrint}
                      onChange={(e) => setAllowPrint(e.target.checked)}
                      className="accent-[#9E2A2B]"
                    />
                    <span>{t.pdf.pdfAllowPrint}</span>
                  </label>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-stone-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium border border-stone-300 bg-white hover:bg-stone-50 text-stone-700 rounded-lg whitespace-nowrap shrink-0"
            >
              {t.common.cancel}
            </button>
            <button
              type="submit"
              disabled={busy}
              className="px-4 py-2 text-xs font-medium bg-[#9E2A2B] hover:bg-[#822021] disabled:opacity-60 text-white rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <FileDown className="w-3.5 h-3.5" />
              {busy ? t.mfa.custodySheetGenerating : t.mfa.custodySheetBtn}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
