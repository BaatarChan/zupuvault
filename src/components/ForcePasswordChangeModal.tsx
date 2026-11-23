import React, { useState } from 'react';
import { KeyRound, Lock, LogOut, ShieldAlert } from 'lucide-react';
import { api, setInMemoryAuthToken } from '../lib/api';
import { useI18n } from '../lib/i18n';
import type { UserProfile } from '../types/zupu';

interface ForcePasswordChangeModalProps {
  user: UserProfile;
  onPasswordUpdated: (updatedUser: UserProfile) => void;
  onSignOut: () => void;
}

export const ForcePasswordChangeModal: React.FC<ForcePasswordChangeModalProps> = ({
  user,
  onPasswordUpdated,
  onSignOut,
}) => {
  const { t } = useI18n();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 8 || newPassword.length > 128) {
      setError(t.roles.passwordMinLengthError);
      return;
    }
    if (newPassword === currentPassword) {
      setError(t.forcePw.differentError);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t.forcePw.mismatchError);
      return;
    }

    setBusy(true);
    try {
      const res = await api.rotatePassword({ currentPassword, newPassword });
      if (res.token) {
        setInMemoryAuthToken(res.token);
      }
      onPasswordUpdated(
        res.user ?? {
          ...user,
          mustChangePassword: false,
        }
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update account password');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FBF9F5] flex flex-col justify-center p-6 sm:p-10">
      <div className="max-w-lg w-full mx-auto bg-white border border-stone-200 rounded-2xl overflow-hidden">
        <div className="p-6 sm:p-8 border-b border-stone-200 bg-[#FBF9F5] flex items-start justify-between gap-4">
          <div>
            <p className="text-xs text-[#9E2A2B] font-medium flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5" />
              {t.forcePw.kicker}
            </p>
            <h1 className="font-display text-3xl font-semibold text-stone-900 mt-1">
              {t.forcePw.title}
            </h1>
            <p className="text-xs text-stone-600 mt-2 leading-relaxed">
              {t.forcePw.descPrefix}{' '}
              <strong className="text-stone-900">
                {user.chineseName} ({user.displayName})
              </strong>
              {t.forcePw.descSuffix}
            </p>
          </div>
          <button
            type="button"
            onClick={onSignOut}
            className="text-xs text-stone-600 hover:text-stone-900 inline-flex items-center gap-1 whitespace-nowrap shrink-0"
          >
            <LogOut className="w-3.5 h-3.5" />
            {t.common.signOut}
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-4">
          {error && (
            <div
              role="alert"
              className="px-4 py-3 rounded-lg border border-red-300 bg-red-50 text-xs text-red-900"
            >
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-stone-700 mb-1">
              {t.forcePw.tempPasswordLabel}
            </label>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder={t.forcePw.tempPasswordPlaceholder}
              className="w-full px-3.5 py-2.5 text-sm bg-white border border-stone-300 rounded-lg focus:outline-none focus:border-[#9E2A2B]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-700 mb-1">
              {t.forcePw.newPasswordLabel}
            </label>
            <input
              type="password"
              required
              minLength={8}
              maxLength={128}
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder={t.forcePw.newPasswordPlaceholder}
              className="w-full px-3.5 py-2.5 text-sm bg-white border border-stone-300 rounded-lg focus:outline-none focus:border-[#9E2A2B]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-700 mb-1">
              {t.forcePw.confirmPasswordLabel}
            </label>
            <input
              type="password"
              required
              minLength={8}
              maxLength={128}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm bg-white border border-stone-300 rounded-lg focus:outline-none focus:border-[#9E2A2B]"
            />
          </div>

          <button
            type="submit"
            disabled={busy}
            className="w-full py-2.5 px-4 bg-[#9E2A2B] hover:bg-[#822021] disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors inline-flex items-center justify-center gap-2"
          >
            <KeyRound className="w-4 h-4" />
            {busy ? t.forcePw.savingBtn : t.forcePw.submitBtn}
          </button>

          <p className="text-[11px] text-stone-500 flex items-center gap-1.5 pt-1">
            <Lock className="w-3.5 h-3.5 shrink-0 text-stone-400" />
            {t.forcePw.securityNote}
          </p>
        </form>
      </div>
    </div>
  );
};
