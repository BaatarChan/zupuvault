import React, { useState } from 'react';
import { Check, Copy, Eye, EyeOff, Sparkles } from 'lucide-react';
import { useI18n } from '../lib/i18n';
import {
  evaluatePassphraseStrength,
  generateDicewarePassphrase,
} from '../lib/passphraseStrength';

interface SecretInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  minLength?: number;
  autoComplete?: string;
  showStrengthMeter?: boolean;
  onGeneratePassphrase?: (generated: string) => void;
  className?: string;
}

export const SecretInput: React.FC<SecretInputProps> = ({
  value,
  onChange,
  placeholder,
  required,
  minLength,
  autoComplete,
  showStrengthMeter = false,
  onGeneratePassphrase,
  className = '',
}) => {
  const { t } = useI18n();
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  const strength = showStrengthMeter ? evaluatePassphraseStrength(value) : null;

  const strengthColor =
    strength?.score === 4
      ? 'bg-emerald-600'
      : strength?.score === 3
        ? 'bg-emerald-500'
        : strength?.score === 2
          ? 'bg-amber-500'
          : 'bg-red-500';

  const strengthTextColor =
    strength?.score === 4 || strength?.score === 3
      ? 'text-emerald-800'
      : strength?.score === 2
        ? 'text-amber-800'
        : 'text-red-700';

  const strengthLabel =
    strength?.tier === 'strong'
      ? t.mfa.strengthStrong
      : strength?.tier === 'good'
        ? t.mfa.strengthGood
        : strength?.tier === 'fair'
          ? t.mfa.strengthFair
          : t.mfa.strengthWeak;

  const handleGenerate = () => {
    const generated = generateDicewarePassphrase(5);
    setRevealed(true);
    setCopied(false);
    if (onGeneratePassphrase) {
      onGeneratePassphrase(generated);
    } else {
      onChange(generated);
    }
  };

  const handleCopy = async () => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard may be restricted in non-focused context
    }
  };

  return (
    <div className="space-y-1.5">
      <div className="relative">
        <input
          type={revealed ? 'text' : 'password'}
          required={required}
          minLength={minLength}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full pr-10 ${className}`}
        />
        <button
          type="button"
          onClick={() => setRevealed((prev) => !prev)}
          aria-label={revealed ? t.mfa.hideSecretAria : t.mfa.showSecretAria}
          title={revealed ? t.mfa.hideSecretAria : t.mfa.showSecretAria}
          className="absolute inset-y-0 right-0 px-3 flex items-center text-stone-400 hover:text-stone-700 transition-colors"
        >
          {revealed ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>

      {(showStrengthMeter || onGeneratePassphrase) && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          {showStrengthMeter && strength && strength.score > 0 ? (
            <div className="flex items-center gap-2 flex-1 min-w-[160px]">
              <div className="flex-1 grid grid-cols-4 gap-1">
                {[1, 2, 3, 4].map((step) => (
                  <span
                    key={step}
                    className={`h-1.5 rounded-full transition-colors ${
                      strength.score >= step ? strengthColor : 'bg-stone-200'
                    }`}
                  />
                ))}
              </div>
              <span className={`text-[11px] font-medium whitespace-nowrap ${strengthTextColor}`}>
                {strengthLabel} · ~{strength.bits}b
              </span>
            </div>
          ) : (
            <span />
          )}

          {onGeneratePassphrase && (
            <div className="flex items-center gap-2">
              {value && (
                <button
                  type="button"
                  onClick={handleCopy}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-stone-600 hover:text-stone-900 px-2 py-0.5 rounded border border-stone-200 bg-white"
                >
                  {copied ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-700" />
                      {t.common.copied}
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      {t.common.copy}
                    </>
                  )}
                </button>
              )}
              <button
                type="button"
                onClick={handleGenerate}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-[#9E2A2B] hover:text-[#7E1F20] px-2 py-0.5 rounded border border-[#9E2A2B]/25 bg-[#FBF9F5]"
              >
                <Sparkles className="w-3 h-3" />
                {t.mfa.generateDicewareBtn}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
