import React, { useEffect, useRef, useState } from 'react';
import { Camera, Edit3, Lock, Plus, RotateCcw, Trash2, UserCheck, X } from 'lucide-react';
import { useI18n } from '../lib/i18n';
import { compareClanMembersByGeneration } from '../lib/lineageOrder';
import {
  compressImageToPortraitDataUrl,
  isValidPortraitDataUrl,
} from '../lib/portraitImage';
import { DEFAULT_BRANCHES, getBranchLabel, getSensitivityLabel } from '../lib/roles';
import {
  containsHanzi,
  defaultRomanizationScheme,
  romanizeChineseName,
  type RomanizationScheme,
} from '../lib/romanizeName';
import type {
  BranchDefinition,
  BranchScope,
  DecryptedMember,
  RecordSensitivity,
  UserProfile,
} from '../types/zupu';

interface MemberDetailDrawerProps {
  member: DecryptedMember | null;
  isCreateMode: boolean;
  createPreset?: {
    generation?: number;
    branch?: Exclude<BranchScope, 'all'>;
    parentIds?: string[];
    spouseIds?: string[];
  } | null;
  allMembers: DecryptedMember[];
  branches?: BranchDefinition[];
  currentUser: UserProfile;
  onClose: () => void;
  onSelectMember: (id: string) => void;
  onSaveMember: (member: DecryptedMember, isNew: boolean) => Promise<void>;
  onDeleteMember: (id: string) => Promise<void>;
  onTriggerAddRelative: (preset: {
    generation?: number;
    branch?: Exclude<BranchScope, 'all'>;
    parentIds?: string[];
    spouseIds?: string[];
  }) => void;
}

const EMPTY_FORM: Omit<DecryptedMember, 'id' | 'updatedAt'> = {
  generation: 1,
  branch: 'elder_branch',
  sensitivity: 'public_clan',
  parentIds: [],
  spouseIds: [],
  chineseName: '',
  romanizedName: '',
  courtesyName: '',
  artName: '',
  gender: 'male',
  birthOrder: '',
  isLiving: false,
  birthYear: '',
  birthLunar: '',
  deathYear: '',
  deathLunar: '',
  birthplace: '',
  currentResidence: '',
  occupationOrTitle: '',
  biography: '',
  sealedTestament: '',
  portraitDataUrl: '',
};

export const MemberDetailDrawer: React.FC<MemberDetailDrawerProps> = ({
  member,
  isCreateMode,
  createPreset,
  allMembers,
  branches = DEFAULT_BRANCHES,
  currentUser,
  onClose,
  onSelectMember,
  onSaveMember,
  onDeleteMember,
  onTriggerAddRelative,
}) => {
  const { locale, t } = useI18n();
  const [editing, setEditing] = useState(isCreateMode);
  const [form, setForm] = useState<Omit<DecryptedMember, 'id' | 'updatedAt'>>(EMPTY_FORM);
  const [romanizeScheme, setRomanizeScheme] = useState<RomanizationScheme>(() =>
    defaultRomanizationScheme(locale)
  );
  const [romanizedTouched, setRomanizedTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const portraitInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setRomanizeScheme(defaultRomanizationScheme(locale));
  }, [locale]);

  useEffect(() => {
    setError(null);
    if (isCreateMode) {
      setEditing(true);
      setRomanizedTouched(false);
      setForm({
        ...EMPTY_FORM,
        generation: createPreset?.generation ?? 1,
        branch: createPreset?.branch ?? branches[0]?.id ?? 'elder_branch',
        parentIds: createPreset?.parentIds ?? [],
        spouseIds: createPreset?.spouseIds ?? [],
      });
    } else if (member) {
      setEditing(false);
      setRomanizedTouched(Boolean(member.romanizedName.trim()));
      setForm({
        generation: member.generation,
        branch: member.branch,
        sensitivity: member.sensitivity,
        parentIds: member.parentIds,
        spouseIds: member.spouseIds,
        chineseName: member.chineseName,
        romanizedName: member.romanizedName,
        courtesyName: member.courtesyName ?? '',
        artName: member.artName ?? '',
        gender: member.gender,
        birthOrder: member.birthOrder ?? '',
        isLiving: member.isLiving,
        birthYear: member.birthYear ?? '',
        birthLunar: member.birthLunar ?? '',
        deathYear: member.deathYear ?? '',
        deathLunar: member.deathLunar ?? '',
        birthplace: member.birthplace ?? '',
        currentResidence: member.currentResidence ?? '',
        occupationOrTitle: member.occupationOrTitle ?? '',
        biography: member.biography,
        sealedTestament: member.sealedTestament ?? '',
        portraitDataUrl: member.portraitDataUrl ?? '',
      });
    }
  }, [member, isCreateMode, createPreset]);

  if (!member && !isCreateMode) return null;

  const canEditThisMember =
    currentUser.permissions.canEditLineage &&
    (currentUser.permissions.branchScope === 'all' ||
      form.branch === currentUser.permissions.branchScope);

  const canSeeLivingPII = !form.isLiving || currentUser.permissions.canViewLivingPII;
  const canSeeSealed = currentUser.permissions.canViewElderSealed;

  const parentRecords = allMembers.filter((m) => form.parentIds.includes(m.id));
  const spouseRecords = allMembers.filter((m) => form.spouseIds.includes(m.id));
  const childRecords = member
    ? allMembers
        .filter((m) => m.parentIds.includes(member.id))
        .sort((a, b) => compareClanMembersByGeneration(a, b, branches))
    : [];

  const candidateParents = allMembers
    .filter((m) => m.id !== member?.id && m.generation <= form.generation)
    .sort((a, b) => compareClanMembersByGeneration(a, b, branches));

  const candidateSpouses = allMembers
    .filter((m) => m.id !== member?.id && !form.parentIds.includes(m.id))
    .sort((a, b) => {
      const aSame = a.generation === form.generation ? 0 : 1;
      const bSame = b.generation === form.generation ? 0 : 1;
      if (aSame !== bSame) return aSame - bSame;
      return a.generation - b.generation || a.chineseName.localeCompare(b.chineseName);
    });

  const toggleParentId = (pid: string) => {
    setForm((prev) => {
      const exists = prev.parentIds.includes(pid);
      const nextParents = exists
        ? prev.parentIds.filter((id) => id !== pid)
        : [...prev.parentIds, pid];
      const nextSpouses = exists ? prev.spouseIds : prev.spouseIds.filter((id) => id !== pid);
      return { ...prev, parentIds: nextParents, spouseIds: nextSpouses };
    });
  };

  const toggleSpouseId = (sid: string) => {
    setForm((prev) => {
      const exists = prev.spouseIds.includes(sid);
      const nextSpouses = exists
        ? prev.spouseIds.filter((id) => id !== sid)
        : [...prev.spouseIds, sid];
      return { ...prev, spouseIds: nextSpouses };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.chineseName.trim() || !form.romanizedName.trim()) {
      setError(t.drawer.nameRequiredError);
      return;
    }
    setBusy(true);
    try {
      const recordId = isCreateMode ? `mem_${Date.now()}` : member!.id;
      const cleanParents = form.parentIds.filter((id) => id !== recordId);
      const cleanSpouses = form.spouseIds.filter(
        (id) => id !== recordId && !cleanParents.includes(id)
      );
      const nextRecord: DecryptedMember = {
        ...form,
        chineseName: form.chineseName.trim(),
        romanizedName: form.romanizedName.trim(),
        parentIds: cleanParents,
        spouseIds: cleanSpouses,
        id: recordId,
        updatedAt: new Date().toISOString(),
      };
      await onSaveMember(nextRecord, isCreateMode);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save encrypted record');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!member) return;
    setBusy(true);
    try {
      await onDeleteMember(member.id);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-stone-950/35 backdrop-blur-[1px]">
      <aside className="w-full max-w-xl bg-[#FBF9F5] border-l border-stone-200 h-full overflow-y-auto p-6 sm:p-8 flex flex-col justify-between">
        <div>
          <div className="flex items-start justify-between gap-4 pb-5 border-b border-stone-200">
            <div className="flex items-center gap-4 min-w-0">
              {!isCreateMode &&
                isValidPortraitDataUrl(form.portraitDataUrl) &&
                canSeeLivingPII && (
                  <img
                    src={form.portraitDataUrl}
                    alt={`${member!.chineseName} Portrait`}
                    className="w-16 h-16 rounded-lg object-cover border border-stone-300 bg-white shrink-0"
                  />
                )}
              <div className="min-w-0">
                <p className="text-xs text-stone-500">
                  {isCreateMode
                    ? t.drawer.newKicker
                    : `${t.common.genPrefix} ${member!.generation} · ${getBranchLabel(member!.branch, locale, branches)} · ${getSensitivityLabel(member!.sensitivity, locale)}`}
                </p>
                <h2 className="font-display text-3xl font-semibold text-stone-900 mt-1 truncate">
                  {isCreateMode ? (
                    t.drawer.newTitle
                  ) : (
                    <>
                      <span className="font-serif-zh mr-2">{member!.chineseName}</span>
                      <span className="text-xl font-normal text-stone-600">
                        {member!.romanizedName}
                      </span>
                    </>
                  )}
                </h2>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close detail drawer"
              className="p-2 rounded-lg border border-stone-200 bg-white hover:bg-stone-50 text-stone-600 shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {error && (
            <div className="mt-4 px-4 py-3 rounded-lg border border-red-300 bg-red-50 text-xs text-red-900">
              {error}
            </div>
          )}

          {editing ? (
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              {/* Encrypted Archival Portrait Picker */}
              <div className="p-3.5 rounded-lg border border-stone-200 bg-white flex items-center justify-between gap-4">
                <div className="flex items-center gap-3.5 min-w-0">
                  {isValidPortraitDataUrl(form.portraitDataUrl) ? (
                    <img
                      src={form.portraitDataUrl}
                      alt="Member portrait preview"
                      className="w-12 h-12 rounded-lg object-cover border border-stone-300 shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-lg border border-dashed border-stone-300 bg-[#FBF9F5] flex items-center justify-center text-stone-400 shrink-0">
                      <Camera className="w-4 h-4" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-stone-800">{t.drawer.portraitTitle}</p>
                    <p className="text-[11px] text-stone-500 truncate">{t.drawer.portraitDesc}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => portraitInputRef.current?.click()}
                    className="px-3 py-1.5 text-xs font-medium border border-stone-300 bg-white hover:bg-stone-50 text-stone-800 rounded-lg whitespace-nowrap"
                  >
                    {isValidPortraitDataUrl(form.portraitDataUrl)
                      ? t.drawer.portraitReplaceBtn
                      : t.drawer.portraitUploadBtn}
                  </button>
                  {isValidPortraitDataUrl(form.portraitDataUrl) && (
                    <button
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, portraitDataUrl: '' }))}
                      className="px-2.5 py-1.5 text-xs text-red-700 hover:bg-red-50 border border-red-200 rounded-lg whitespace-nowrap"
                    >
                      {t.drawer.portraitRemoveBtn}
                    </button>
                  )}
                  <input
                    ref={portraitInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setError(null);
                      try {
                        const compressed = await compressImageToPortraitDataUrl(file);
                        setForm((prev) => ({ ...prev, portraitDataUrl: compressed }));
                      } catch (err) {
                        setError(err instanceof Error ? err.message : 'Unable to process image');
                      } finally {
                        if (portraitInputRef.current) portraitInputRef.current.value = '';
                      }
                    }}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">
                    {t.drawer.chineseName}
                  </label>
                  <input
                    type="text"
                    required
                    value={form.chineseName}
                    placeholder={t.drawer.chineseNamePlaceholder}
                    onChange={(e) => {
                      const nextZh = e.target.value;
                      setForm((prev) => {
                        const shouldAutoFill =
                          !romanizedTouched || !prev.romanizedName.trim();
                        return {
                          ...prev,
                          chineseName: nextZh,
                          romanizedName: shouldAutoFill
                            ? romanizeChineseName(nextZh, romanizeScheme)
                            : prev.romanizedName,
                        };
                      });
                    }}
                    className="w-full px-3 py-2 text-sm font-serif-zh bg-white border border-stone-300 rounded-lg focus:outline-none focus:border-[#9E2A2B]"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <label className="block text-xs font-medium text-stone-700 truncate">
                      {t.drawer.romanizedName}
                    </label>
                    <div className="flex items-center gap-1 shrink-0">
                      <div className="inline-flex rounded border border-stone-300 bg-stone-50 overflow-hidden text-[11px]">
                        <button
                          type="button"
                          onClick={() => {
                            setRomanizeScheme('cantonese');
                            setRomanizedTouched(false);
                            if (form.chineseName.trim()) {
                              setForm((prev) => ({
                                ...prev,
                                romanizedName: romanizeChineseName(prev.chineseName, 'cantonese'),
                              }));
                            }
                          }}
                          className={`px-1.5 py-0.5 transition-colors whitespace-nowrap ${
                            romanizeScheme === 'cantonese'
                              ? 'bg-[#9E2A2B] text-white font-medium'
                              : 'text-stone-600 hover:bg-stone-100'
                          }`}
                        >
                          {t.drawer.romanizeSchemeCantonese}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setRomanizeScheme('pinyin');
                            setRomanizedTouched(false);
                            if (form.chineseName.trim()) {
                              setForm((prev) => ({
                                ...prev,
                                romanizedName: romanizeChineseName(prev.chineseName, 'pinyin'),
                              }));
                            }
                          }}
                          className={`px-1.5 py-0.5 transition-colors whitespace-nowrap ${
                            romanizeScheme === 'pinyin'
                              ? 'bg-[#9E2A2B] text-white font-medium'
                              : 'text-stone-600 hover:bg-stone-100'
                          }`}
                        >
                          {t.drawer.romanizeSchemePinyin}
                        </button>
                      </div>
                      {containsHanzi(form.chineseName) && romanizedTouched && (
                        <button
                          type="button"
                          title={t.drawer.romanizeRegenerate}
                          aria-label={t.drawer.romanizeRegenerate}
                          onClick={() => {
                            setRomanizedTouched(false);
                            setForm((prev) => ({
                              ...prev,
                              romanizedName: romanizeChineseName(prev.chineseName, romanizeScheme),
                            }));
                          }}
                          className="p-1 text-stone-500 hover:text-[#9E2A2B] rounded border border-stone-300 bg-white hover:bg-stone-50 transition-colors"
                        >
                          <RotateCcw className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                  <input
                    type="text"
                    required
                    value={form.romanizedName}
                    placeholder={t.drawer.romanizedNamePlaceholder}
                    onChange={(e) => {
                      const nextVal = e.target.value;
                      setRomanizedTouched(nextVal.trim().length > 0);
                      setForm((prev) => ({ ...prev, romanizedName: nextVal }));
                    }}
                    className="w-full px-3 py-2 text-sm bg-white border border-stone-300 rounded-lg focus:outline-none focus:border-[#9E2A2B]"
                  />
                  {!romanizedTouched && containsHanzi(form.chineseName) && (
                    <p className="text-[11px] text-stone-500 mt-1">
                      {t.drawer.romanizeAutoHint}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">
                    {t.drawer.generation}
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={form.generation}
                    onChange={(e) =>
                      setForm({ ...form, generation: Math.max(1, Number(e.target.value) || 1) })
                    }
                    className="w-full px-3 py-2 text-sm font-mono-tabular bg-white border border-stone-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">
                    {t.drawer.branch}
                  </label>
                  <select
                    value={form.branch}
                    disabled={currentUser.permissions.branchScope !== 'all'}
                    onChange={(e) =>
                      setForm({ ...form, branch: e.target.value as Exclude<BranchScope, 'all'> })
                    }
                    className="w-full px-2.5 py-2 text-xs bg-white border border-stone-300 rounded-lg"
                  >
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {getBranchLabel(b.id, locale, branches)}
                      </option>
                    ))}
                    {!branches.some((b) => b.id === form.branch) && (
                      <option value={form.branch}>
                        {getBranchLabel(form.branch, locale, branches)}
                      </option>
                    )}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">
                    {t.drawer.courtesy}
                  </label>
                  <input
                    type="text"
                    value={form.courtesyName}
                    onChange={(e) => setForm({ ...form, courtesyName: e.target.value })}
                    className="w-full px-3 py-2 text-sm font-serif-zh bg-white border border-stone-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">
                    {t.drawer.artName}
                  </label>
                  <input
                    type="text"
                    value={form.artName}
                    onChange={(e) => setForm({ ...form, artName: e.target.value })}
                    className="w-full px-3 py-2 text-sm font-serif-zh bg-white border border-stone-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">
                    {t.drawer.gender}
                  </label>
                  <select
                    value={form.gender}
                    onChange={(e) =>
                      setForm({ ...form, gender: e.target.value as 'male' | 'female' })
                    }
                    className="w-full px-2.5 py-2 text-xs bg-white border border-stone-300 rounded-lg"
                  >
                    <option value="male">{t.drawer.genderMale}</option>
                    <option value="female">{t.drawer.genderFemale}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">
                    {t.drawer.sensitivity}
                  </label>
                  <select
                    value={form.sensitivity}
                    onChange={(e) =>
                      setForm({ ...form, sensitivity: e.target.value as RecordSensitivity })
                    }
                    className="w-full px-2.5 py-2 text-xs bg-white border border-stone-300 rounded-lg"
                  >
                    <option value="public_clan">{getSensitivityLabel('public_clan', locale)}</option>
                    <option value="branch_restricted">{getSensitivityLabel('branch_restricted', locale)}</option>
                    <option value="elder_sealed">{getSensitivityLabel('elder_sealed', locale)}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">
                    {t.drawer.birthOrder}
                  </label>
                  <input
                    type="text"
                    value={form.birthOrder}
                    onChange={(e) => setForm({ ...form, birthOrder: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-white border border-stone-300 rounded-lg"
                  />
                </div>
                <div className="flex items-end pb-2">
                  <label className="flex items-center gap-2 text-xs font-medium text-stone-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.isLiving}
                      onChange={(e) => setForm({ ...form, isLiving: e.target.checked })}
                      className="accent-[#9E2A2B]"
                    />
                    {t.drawer.livingRelative}
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">
                    {t.drawer.birthYear}
                  </label>
                  <input
                    type="text"
                    value={form.birthYear}
                    onChange={(e) => setForm({ ...form, birthYear: e.target.value })}
                    placeholder="1954"
                    className="w-full px-3 py-2 text-xs font-mono-tabular bg-white border border-stone-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">
                    {t.drawer.lunarBirth}
                  </label>
                  <input
                    type="text"
                    value={form.birthLunar}
                    onChange={(e) => setForm({ ...form, birthLunar: e.target.value })}
                    className="w-full px-3 py-2 text-xs font-serif-zh bg-white border border-stone-300 rounded-lg"
                  />
                </div>
                {!form.isLiving && (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-stone-700 mb-1">
                        {t.drawer.deathYear}
                      </label>
                      <input
                        type="text"
                        value={form.deathYear}
                        onChange={(e) => setForm({ ...form, deathYear: e.target.value })}
                        placeholder="2004"
                        className="w-full px-3 py-2 text-xs font-mono-tabular bg-white border border-stone-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-stone-700 mb-1">
                        {t.drawer.lunarDeath}
                      </label>
                      <input
                        type="text"
                        value={form.deathLunar}
                        onChange={(e) => setForm({ ...form, deathLunar: e.target.value })}
                        className="w-full px-3 py-2 text-xs font-serif-zh bg-white border border-stone-300 rounded-lg"
                      />
                    </div>
                  </>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">
                    {t.drawer.birthplace}
                  </label>
                  <input
                    type="text"
                    value={form.birthplace}
                    onChange={(e) => setForm({ ...form, birthplace: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-white border border-stone-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">
                    {t.drawer.occupation}
                  </label>
                  <input
                    type="text"
                    value={form.occupationOrTitle}
                    onChange={(e) => setForm({ ...form, occupationOrTitle: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-white border border-stone-300 rounded-lg"
                  />
                </div>
              </div>

              {form.isLiving && (
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">
                    {t.drawer.currentResidence}
                  </label>
                  <input
                    type="text"
                    value={form.currentResidence}
                    onChange={(e) => setForm({ ...form, currentResidence: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-white border border-stone-300 rounded-lg"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">
                  {t.drawer.biography}
                </label>
                <textarea
                  rows={3}
                  value={form.biography}
                  onChange={(e) => setForm({ ...form, biography: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-white border border-stone-300 rounded-lg leading-relaxed"
                />
              </div>

              {canSeeSealed && (
                <div>
                  <label className="block text-xs font-medium text-[#9E2A2B] mb-1">
                    {t.drawer.sealedTestament}
                  </label>
                  <textarea
                    rows={2}
                    value={form.sealedTestament}
                    onChange={(e) => setForm({ ...form, sealedTestament: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-white border border-stone-300 rounded-lg leading-relaxed"
                  />
                </div>
              )}

              {allMembers.length > 0 && (
                <div className="p-4 rounded-lg bg-white border border-stone-200 space-y-3">
                  <div>
                    <h3 className="text-xs font-semibold text-stone-800">{t.drawer.lineageLinks}</h3>
                    <p className="text-[11px] text-stone-500 mt-0.5">{t.drawer.relationshipHint}</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs font-medium text-stone-700 mb-1.5">
                        {t.drawer.parentsSelect}
                      </p>
                      <div className="max-h-36 overflow-y-auto border border-stone-200 rounded-lg divide-y divide-stone-100 bg-[#FBF9F5]">
                        {candidateParents.length === 0 ? (
                          <p className="p-2.5 text-[11px] text-stone-400">{t.common.noneRecorded}</p>
                        ) : (
                          candidateParents.map((cand) => (
                            <label
                              key={cand.id}
                              className="flex items-center gap-2 px-2.5 py-1.5 text-xs text-stone-800 hover:bg-white cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={form.parentIds.includes(cand.id)}
                                onChange={() => toggleParentId(cand.id)}
                                className="accent-[#9E2A2B] shrink-0"
                              />
                              <span className="font-serif-zh font-medium truncate">
                                {cand.chineseName}
                              </span>
                              <span className="text-[11px] text-stone-500 truncate">
                                {cand.romanizedName}
                              </span>
                              <span className="ml-auto text-[10px] font-mono-tabular text-stone-400 shrink-0">
                                {t.common.genPrefix} {cand.generation}
                              </span>
                            </label>
                          ))
                        )}
                      </div>
                    </div>

                    <div>
                      <p className="text-xs font-medium text-stone-700 mb-1.5">
                        {t.drawer.spousesSelect}
                      </p>
                      <div className="max-h-36 overflow-y-auto border border-stone-200 rounded-lg divide-y divide-stone-100 bg-[#FBF9F5]">
                        {candidateSpouses.length === 0 ? (
                          <p className="p-2.5 text-[11px] text-stone-400">{t.common.noneRecorded}</p>
                        ) : (
                          candidateSpouses.map((cand) => (
                            <label
                              key={cand.id}
                              className="flex items-center gap-2 px-2.5 py-1.5 text-xs text-stone-800 hover:bg-white cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={form.spouseIds.includes(cand.id)}
                                onChange={() => toggleSpouseId(cand.id)}
                                className="accent-[#9E2A2B] shrink-0"
                              />
                              <span className="font-serif-zh font-medium truncate">
                                {cand.chineseName}
                              </span>
                              <span className="text-[11px] text-stone-500 truncate">
                                {cand.romanizedName}
                              </span>
                              <span className="ml-auto text-[10px] font-mono-tabular text-stone-400 shrink-0">
                                {t.common.genPrefix} {cand.generation}
                              </span>
                            </label>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="submit"
                  disabled={busy}
                  className="px-4 py-2.5 bg-[#9E2A2B] hover:bg-[#822021] disabled:opacity-60 text-white text-xs font-medium rounded-lg transition-colors"
                >
                  {busy ? t.drawer.savingRecord : t.drawer.saveRecord}
                </button>
                <button
                  type="button"
                  onClick={() => (isCreateMode ? onClose() : setEditing(false))}
                  className="px-4 py-2.5 border border-stone-300 bg-white hover:bg-stone-50 text-stone-700 text-xs font-medium rounded-lg"
                >
                  {t.common.cancel}
                </button>
              </div>
            </form>
          ) : (
            <div className="mt-6 space-y-6">
              {canEditThisMember && (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditing(true)}
                    className="px-3.5 py-2 text-xs font-medium bg-white border border-stone-300 hover:bg-stone-50 text-stone-800 rounded-lg flex items-center gap-1.5"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    {t.drawer.editRecord}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onTriggerAddRelative({
                        generation: member!.generation + 1,
                        branch: member!.branch,
                        parentIds: [member!.id, ...member!.spouseIds.slice(0, 1)],
                      })
                    }
                    className="px-3.5 py-2 text-xs font-medium bg-white border border-stone-300 hover:bg-stone-50 text-stone-800 rounded-lg flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    {t.drawer.addChild}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onTriggerAddRelative({
                        generation: member!.generation,
                        branch: member!.branch,
                        spouseIds: [member!.id],
                      })
                    }
                    className="px-3.5 py-2 text-xs font-medium bg-white border border-stone-300 hover:bg-stone-50 text-stone-800 rounded-lg flex items-center gap-1.5"
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    {t.drawer.addSpouse}
                  </button>
                </div>
              )}

              <dl className="divide-y divide-stone-200 border-y border-stone-200 text-xs">
                <div className="py-2.5 flex justify-between gap-4">
                  <dt className="text-stone-500">{t.drawer.courtesyArtLabel}</dt>
                  <dd className="font-serif-zh text-stone-900 text-right">
                    {form.courtesyName || '—'} {form.artName ? `· ${form.artName}` : ''}
                  </dd>
                </div>
                <div className="py-2.5 flex justify-between gap-4">
                  <dt className="text-stone-500">{t.drawer.orderTitleLabel}</dt>
                  <dd className="text-stone-900 text-right">
                    {[form.birthOrder, form.occupationOrTitle].filter(Boolean).join(' · ') || '—'}
                  </dd>
                </div>
                <div className="py-2.5 flex justify-between gap-4">
                  <dt className="text-stone-500">{t.drawer.datesLabel}</dt>
                  <dd className="font-mono-tabular text-stone-900 text-right">
                    {form.birthYear || '?'} – {form.isLiving ? t.common.present : form.deathYear || '?'}
                    {form.birthLunar ? ` (${form.birthLunar})` : ''}
                  </dd>
                </div>
                <div className="py-2.5 flex justify-between gap-4">
                  <dt className="text-stone-500">{t.drawer.originLabel}</dt>
                  <dd className="text-stone-900 text-right">{form.birthplace || '—'}</dd>
                </div>
                {form.isLiving && (
                  <div className="py-2.5 flex justify-between gap-4">
                    <dt className="text-stone-500">{t.drawer.residenceLabel}</dt>
                    <dd className="text-stone-900 text-right">
                      {canSeeLivingPII ? (
                        form.currentResidence || '—'
                      ) : (
                        <span className="text-stone-400 inline-flex items-center gap-1">
                          <Lock className="w-3 h-3" />
                          {t.drawer.piiRestrictedMsg}
                        </span>
                      )}
                    </dd>
                  </div>
                )}
              </dl>

              <div>
                <h3 className="text-xs font-semibold text-stone-500 mb-2">
                  {t.drawer.biography}
                </h3>
                <p className="text-sm text-stone-800 leading-relaxed">
                  {form.biography || t.drawer.noBio}
                </p>
              </div>

              <div className="p-4 rounded-lg bg-white border border-stone-200">
                <h3 className="text-xs font-semibold text-[#9E2A2B] mb-1.5 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5" />
                  {t.drawer.sealedTestament}
                </h3>
                {canSeeSealed ? (
                  <p className="text-xs text-stone-700 leading-relaxed">
                    {form.sealedTestament || t.drawer.noSealed}
                  </p>
                ) : (
                  <p className="text-xs text-stone-500">{t.drawer.sealedWithheldMsg}</p>
                )}
              </div>

              <div className="space-y-3 pt-2 border-t border-stone-200">
                <h3 className="text-xs font-semibold text-stone-500">{t.drawer.lineageLinks}</h3>
                <div className="space-y-2 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-stone-500 w-20 shrink-0">{t.drawer.parents}</span>
                    {parentRecords.length === 0 ? (
                      <span className="text-stone-400">{t.drawer.foundingUnlinked}</span>
                    ) : (
                      parentRecords.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => onSelectMember(p.id)}
                          className="text-[#9E2A2B] hover:underline font-medium"
                        >
                          {p.chineseName} ({p.romanizedName})
                        </button>
                      ))
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-stone-500 w-20 shrink-0">{t.drawer.spouse}</span>
                    {spouseRecords.length === 0 ? (
                      <span className="text-stone-400">{t.common.noneRecorded}</span>
                    ) : (
                      spouseRecords.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => onSelectMember(s.id)}
                          className="text-[#9E2A2B] hover:underline font-medium"
                        >
                          {s.chineseName} ({s.romanizedName})
                        </button>
                      ))
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-stone-500 w-20 shrink-0">{t.drawer.children}</span>
                    {childRecords.length === 0 ? (
                      <span className="text-stone-400">{t.common.noneRecorded}</span>
                    ) : (
                      childRecords.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => onSelectMember(c.id)}
                          className="text-[#9E2A2B] hover:underline font-medium"
                        >
                          {c.chineseName} ({c.romanizedName})
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {canEditThisMember && member && (
                <div className="pt-4 border-t border-stone-200 flex justify-end">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={handleDelete}
                    className="px-3.5 py-2 text-xs font-medium text-red-700 hover:bg-red-50 border border-red-200 rounded-lg inline-flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    {t.drawer.removeRecord}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
};
