import React, { useMemo, useRef, useState } from 'react';
import {
  Edit3,
  Lock,
  Maximize2,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useI18n } from '../lib/i18n';
import { compareClanMembers, getBranchRank } from '../lib/lineageOrder';
import { isValidPortraitDataUrl } from '../lib/portraitImage';
import {
  getBranchesFromMetadata,
  getBranchLabel,
  getSensitivityLabel,
  SENSITIVITY_META,
  slugifyBranchId,
} from '../lib/roles';
import type {
  BranchDefinition,
  BranchScope,
  ClanMetadata,
  DecryptedMember,
  UserProfile,
} from '../types/zupu';

interface LineageTreeCanvasProps {
  metadata: ClanMetadata;
  members: DecryptedMember[];
  currentUser: UserProfile;
  selectedMemberId: string | null;
  onSelectMember: (id: string) => void;
  onAddNewMember: (preset?: {
    generation?: number;
    branch?: Exclude<BranchScope, 'all'>;
    parentIds?: string[];
  }) => void;
  onUpdateClanMetadata: (
    next: Pick<
      ClanMetadata,
      | 'clanName'
      | 'clanChineseName'
      | 'hallName'
      | 'ancestralOrigin'
      | 'generationPoem'
      | 'branches'
    >
  ) => Promise<void>;
}

const GENERATION_CHINESE = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];

function formatGenLabel(gen: number): string {
  return gen >= 1 && gen <= GENERATION_CHINESE.length
    ? `第${GENERATION_CHINESE[gen - 1]}世`
    : `第${gen}世`;
}

// Layout geometry constants
const CARD_W = 176;
const CARD_H = 104;
const SPOUSE_GAP = 26;
const UNIT_GAP = 32;
const ROW_H = 164; // CARD_H (104) + 60px orthogonal routing corridor
const TREE_PAD_X = 28;
const TREE_PAD_Y = 20;

interface TreeUnit {
  id: string;
  generation: number;
  branch: Exclude<BranchScope, 'all'>;
  members: DecryptedMember[];
  parentUnitId: string | null;
  children: TreeUnit[];
  ownW: number;
  subtreeW: number;
  x: number; // left X of the unit inside canvas coordinate space
  y: number; // top Y of the unit inside canvas coordinate space
  anchorX: number; // bottom anchor X for outgoing child lines (center of marriage bridge or primary)
}

interface PlacedMember {
  member: DecryptedMember;
  x: number;
  y: number;
}

interface MarriageBridge {
  id: string;
  x1: number;
  x2: number;
  y: number;
  highlighted: boolean;
}

interface ParentChildEdge {
  id: string;
  parentUnitId: string;
  childUnitId: string;
  parentMemberIds: string[];
  childMemberId: string;
  d: string;
}

interface GenerationBand {
  generation: number;
  y: number;
}

interface TreeLayoutResult {
  width: number;
  height: number;
  bands: GenerationBand[];
  placedMembers: PlacedMember[];
  bridges: MarriageBridge[];
  edges: ParentChildEdge[];
}

function computeTidyTreeLayout(
  scopedMembers: DecryptedMember[],
  highlightedIds: Set<string>,
  branchOrder?: BranchDefinition[]
): TreeLayoutResult {
  if (scopedMembers.length === 0) {
    return {
      width: 600,
      height: 200,
      bands: [],
      placedMembers: [],
      bridges: [],
      edges: [],
    };
  }

  const sorted = [...scopedMembers].sort(
    (a, b) => a.generation - b.generation || compareClanMembers(a, b, branchOrder)
  );
  const byId = new Map(sorted.map((m) => [m.id, m]));
  const genValues = Array.from(new Set(sorted.map((m) => m.generation))).sort((a, b) => a - b);
  const genRowMap = new Map<number, number>();
  genValues.forEach((g, idx) => genRowMap.set(g, idx));

  // 1. Group same-generation spouses into conjugal TreeUnits
  const usedInUnit = new Set<string>();
  const units: TreeUnit[] = [];
  const memberToUnit = new Map<string, TreeUnit>();

  for (const m of sorted) {
    if (usedInUnit.has(m.id)) continue;
    usedInUnit.add(m.id);

    const group: DecryptedMember[] = [m];
    for (const sid of m.spouseIds) {
      const sp = byId.get(sid);
      if (sp && !usedInUnit.has(sp.id) && sp.generation === m.generation) {
        usedInUnit.add(sp.id);
        group.push(sp);
      }
    }

    // Put bloodline / parent-linked member on the left of the couple so connectors stay clean
    group.sort((a, b) => {
      const aHasParents = a.parentIds.some((pid) => byId.has(pid)) ? 0 : 1;
      const bHasParents = b.parentIds.some((pid) => byId.has(pid)) ? 0 : 1;
      if (aHasParents !== bHasParents) return aHasParents - bHasParents;
      if (a.gender !== b.gender) return a.gender === 'male' ? -1 : 1;
      return compareClanMembers(a, b, branchOrder);
    });

    const primary = group[0];
    const ownW = group.length * CARD_W + Math.max(0, group.length - 1) * SPOUSE_GAP;
    const unit: TreeUnit = {
      id: `unit_${group.map((x) => x.id).join('+')}`,
      generation: primary.generation,
      branch: primary.branch,
      members: group,
      parentUnitId: null,
      children: [],
      ownW,
      subtreeW: ownW,
      x: 0,
      y: 0,
      anchorX: 0,
    };
    units.push(unit);
    for (const gm of group) {
      memberToUnit.set(gm.id, unit);
    }
  }

  // 2. Link each unit to its earliest-generation parent unit
  const roots: TreeUnit[] = [];
  for (const unit of units) {
    let resolvedParentUnit: TreeUnit | null = null;
    for (const gm of unit.members) {
      for (const pid of gm.parentIds) {
        const pu = memberToUnit.get(pid);
        if (pu && pu.id !== unit.id && pu.generation < unit.generation) {
          resolvedParentUnit = pu;
          break;
        }
      }
      if (resolvedParentUnit) break;
    }

    if (resolvedParentUnit) {
      unit.parentUnitId = resolvedParentUnit.id;
      resolvedParentUnit.children.push(unit);
    } else {
      roots.push(unit);
    }
  }

  const sortUnits = (a: TreeUnit, b: TreeUnit) => {
    const rankDiff = getBranchRank(a.branch, branchOrder) - getBranchRank(b.branch, branchOrder);
    if (rankDiff !== 0) return rankDiff;
    return compareClanMembers(a.members[0], b.members[0], branchOrder);
  };
  roots.sort(sortUnits);
  for (const u of units) {
    u.children.sort(sortUnits);
  }

  // 3. Bottom-up subtree width calculation (with cycle safety)
  const visitedWidth = new Set<string>();
  const calcSubtreeWidth = (u: TreeUnit): number => {
    if (visitedWidth.has(u.id)) return u.ownW;
    visitedWidth.add(u.id);
    if (u.children.length === 0) {
      u.subtreeW = u.ownW;
      return u.subtreeW;
    }
    let childrenSpan = 0;
    u.children.forEach((c, idx) => {
      childrenSpan += calcSubtreeWidth(c);
      if (idx > 0) childrenSpan += UNIT_GAP;
    });
    u.subtreeW = Math.max(u.ownW, childrenSpan);
    return u.subtreeW;
  };
  for (const r of roots) calcSubtreeWidth(r);

  // 4. Top-down centered X placement & generation-locked Y placement
  const placedMembers: PlacedMember[] = [];
  const bridges: MarriageBridge[] = [];
  const placedUnits = new Set<string>();

  const placeSubtree = (u: TreeUnit, leftX: number) => {
    if (placedUnits.has(u.id)) return;
    placedUnits.add(u.id);

    const rowIdx = genRowMap.get(u.generation) ?? 0;
    const centerX = leftX + u.subtreeW / 2;
    u.x = centerX - u.ownW / 2;
    u.y = TREE_PAD_Y + rowIdx * ROW_H;

    // Anchor X for children lines sits cleanly between spouses if married, else card center
    if (u.members.length >= 2) {
      u.anchorX = u.x + CARD_W + SPOUSE_GAP / 2;
    } else {
      u.anchorX = u.x + CARD_W / 2;
    }

    u.members.forEach((m, idx) => {
      const mx = u.x + idx * (CARD_W + SPOUSE_GAP);
      placedMembers.push({ member: m, x: mx, y: u.y });
      if (idx > 0) {
        const prev = u.members[idx - 1];
        const prevRight = u.x + (idx - 1) * (CARD_W + SPOUSE_GAP) + CARD_W;
        bridges.push({
          id: `${prev.id}-${m.id}`,
          x1: prevRight,
          x2: mx,
          y: u.y + CARD_H / 2,
          highlighted: highlightedIds.has(prev.id) || highlightedIds.has(m.id),
        });
      }
    });

    if (u.children.length > 0) {
      const childrenSpan =
        u.children.reduce((acc, c) => acc + c.subtreeW, 0) +
        (u.children.length - 1) * UNIT_GAP;
      let childX = centerX - childrenSpan / 2;
      for (const child of u.children) {
        placeSubtree(child, childX);
        childX += child.subtreeW + UNIT_GAP;
      }
    }
  };

  let rootCursorX = TREE_PAD_X;
  for (const r of roots) {
    placeSubtree(r, rootCursorX);
    rootCursorX += r.subtreeW + UNIT_GAP;
  }

  // 5. Build crisp orthogonal Parent -> Child SVG paths grouped cleanly by parent bus
  const edges: ParentChildEdge[] = [];
  const memberPosMap = new Map(placedMembers.map((p) => [p.member.id, p]));

  for (const u of units) {
    if (!u.parentUnitId) continue;
    const parentUnit = units.find((cand) => cand.id === u.parentUnitId);
    if (!parentUnit) continue;

    // Connect directly to the bloodline child member card top center
    const bloodlineChild =
      u.members.find((gm) => gm.parentIds.some((pid) => memberToUnit.get(pid)?.id === parentUnit.id)) ??
      u.members[0];
    const childPos = memberPosMap.get(bloodlineChild.id);
    if (!childPos) continue;

    const px = parentUnit.anchorX;
    // If parents are a couple (2 cards), drop directly from the marriage bridge midpoint!
    const py =
      parentUnit.members.length >= 2
        ? parentUnit.y + CARD_H / 2
        : parentUnit.y + CARD_H;

    const cx = childPos.x + CARD_W / 2;
    const cy = childPos.y;
    // Route horizontal bus cleanly in the open corridor directly above child row
    const busY = cy - (ROW_H - CARD_H) / 2;

    const d = `M ${px.toFixed(1)} ${py.toFixed(1)} V ${busY.toFixed(1)} H ${cx.toFixed(1)} V ${cy.toFixed(1)}`;
    edges.push({
      id: `${parentUnit.id}->${u.id}`,
      parentUnitId: parentUnit.id,
      childUnitId: u.id,
      parentMemberIds: parentUnit.members.map((pm) => pm.id),
      childMemberId: bloodlineChild.id,
      d,
    });
  }

  const totalW = Math.max(680, rootCursorX - UNIT_GAP + TREE_PAD_X);
  const totalH = TREE_PAD_Y * 2 + genValues.length * ROW_H - (ROW_H - CARD_H);

  const bands: GenerationBand[] = genValues.map((generation, idx) => ({
    generation,
    y: TREE_PAD_Y + idx * ROW_H,
  }));

  return {
    width: totalW,
    height: totalH,
    bands,
    placedMembers,
    bridges,
    edges,
  };
}

export const LineageTreeCanvas: React.FC<LineageTreeCanvasProps> = ({
  metadata,
  members,
  currentUser,
  selectedMemberId,
  onSelectMember,
  onAddNewMember,
  onUpdateClanMetadata,
}) => {
  const { locale, t } = useI18n();
  const [search, setSearch] = useState('');
  const [branchFilter, setBranchFilter] = useState<BranchScope>('all');
  const [zoom, setZoom] = useState(1);
  const [sealFailed, setSealFailed] = useState(false);
  const [hoveredMemberId, setHoveredMemberId] = useState<string | null>(null);
  const scrollViewportRef = useRef<HTMLDivElement>(null);

  const branches = useMemo(() => getBranchesFromMetadata(metadata), [metadata]);

  const [editingZupu, setEditingZupu] = useState(false);
  const [clanNameInput, setClanNameInput] = useState(metadata.clanName);
  const [clanChineseNameInput, setClanChineseNameInput] = useState(metadata.clanChineseName);
  const [hallNameInput, setHallNameInput] = useState(metadata.hallName);
  const [ancestralOriginInput, setAncestralOriginInput] = useState(metadata.ancestralOrigin);
  const [poemInput, setPoemInput] = useState(metadata.generationPoem.join(' '));
  const [branchesDraft, setBranchesDraft] = useState<(BranchDefinition & { key: string })[]>(() =>
    branches.map((b, idx) => ({ ...b, key: `${b.id}-${idx}` }))
  );
  const [zupuBusy, setZupuBusy] = useState(false);
  const [zupuError, setZupuError] = useState<string | null>(null);

  const inUseBranchIds = useMemo(() => new Set(members.map((m) => m.branch)), [members]);

  const canEditZupuHeader =
    currentUser.permissions.canEditLineage &&
    (currentUser.role === 'patriarch' || currentUser.permissions.branchScope === 'all');

  const openZupuEditor = () => {
    setClanNameInput(metadata.clanName);
    setClanChineseNameInput(metadata.clanChineseName);
    setHallNameInput(metadata.hallName);
    setAncestralOriginInput(metadata.ancestralOrigin);
    setPoemInput(metadata.generationPoem.join(' '));
    setBranchesDraft(branches.map((b, idx) => ({ ...b, key: `${b.id}-${idx}` })));
    setZupuError(null);
    setEditingZupu(true);
  };

  const handleSaveZupu = async (e: React.FormEvent) => {
    e.preventDefault();
    setZupuError(null);
    const nextClanName = clanNameInput.trim();
    const nextClanZhName = clanChineseNameInput.trim();
    if (!nextClanName || !nextClanZhName) {
      setZupuError(t.tree.zupuRequiredError);
      return;
    }
    if (nextClanName.length > 120 || nextClanZhName.length > 80) {
      setZupuError('Clan Name (<=120 chars) or Chinese Zupu Title (<=80 chars) exceeds length limit.');
      return;
    }
    if (branchesDraft.length === 0) {
      setZupuError(t.tree.branchMinOneError);
      return;
    }
    if (branchesDraft.some((b) => !b.label.trim() || !b.chinese.trim())) {
      setZupuError(t.tree.branchRequiredError);
      return;
    }

    const usedIds: string[] = [];
    const finalizedBranches: BranchDefinition[] = branchesDraft.map((b) => {
      const cleanLabel = b.label.trim();
      const cleanZh = b.chinese.trim();
      const validExistingId =
        b.id && /^[a-z0-9_]{2,40}$/.test(b.id) && b.id !== 'all' && !usedIds.includes(b.id)
          ? b.id
          : slugifyBranchId(cleanLabel || cleanZh, usedIds);
      usedIds.push(validExistingId);
      return { id: validExistingId, label: cleanLabel, chinese: cleanZh };
    });

    const poemChars = poemInput
      .replace(/[\s,，、·.。]+/g, '')
      .split('')
      .filter(Boolean);

    setZupuBusy(true);
    try {
      await onUpdateClanMetadata({
        clanName: nextClanName,
        clanChineseName: nextClanZhName,
        hallName: hallNameInput.trim(),
        ancestralOrigin: ancestralOriginInput.trim(),
        generationPoem: poemChars,
        branches: finalizedBranches,
      });
      setEditingZupu(false);
    } catch (err) {
      setZupuError(err instanceof Error ? err.message : 'Unable to save Zupu changes');
    } finally {
      setZupuBusy(false);
    }
  };

  // Scope tree cleanly by selected branch (preserving Generation 1 founders so branches stay rooted)
  const branchScopedMembers = useMemo(() => {
    return members.filter((m) => {
      if (branchFilter !== 'all' && m.generation > 1 && m.branch !== branchFilter) {
        return false;
      }
      return true;
    });
  }, [members, branchFilter]);

  // Search highlights matched nodes inside the intact tree instead of fragmenting parent-child structure
  const searchQuery = search.trim().toLowerCase();
  const searchMatchedIds = useMemo(() => {
    if (!searchQuery) return null;
    const matched = new Set<string>();
    for (const m of branchScopedMembers) {
      if (
        m.chineseName.toLowerCase().includes(searchQuery) ||
        m.romanizedName.toLowerCase().includes(searchQuery) ||
        (m.courtesyName || '').toLowerCase().includes(searchQuery) ||
        (m.artName || '').toLowerCase().includes(searchQuery) ||
        (m.occupationOrTitle || '').toLowerCase().includes(searchQuery)
      ) {
        matched.add(m.id);
      }
    }
    return matched;
  }, [branchScopedMembers, searchQuery]);

  // Full ancestor + descendant + spouse trace for selected or hovered member
  const focusMemberId = hoveredMemberId ?? selectedMemberId;
  const tracedIds = useMemo(() => {
    const set = new Set<string>();
    if (!focusMemberId) return set;

    const byId = new Map(branchScopedMembers.map((m) => [m.id, m]));
    const childrenByParent = new Map<string, string[]>();
    for (const m of branchScopedMembers) {
      for (const pid of m.parentIds) {
        const list = childrenByParent.get(pid) ?? [];
        list.push(m.id);
        childrenByParent.set(pid, list);
      }
    }

    const focus = byId.get(focusMemberId);
    if (!focus) return set;
    set.add(focus.id);
    for (const sid of focus.spouseIds) {
      if (byId.has(sid)) set.add(sid);
    }

    // Walk ancestors upward
    const upQueue = [...focus.parentIds];
    const upVisited = new Set<string>([focus.id]);
    while (upQueue.length > 0) {
      const pid = upQueue.shift()!;
      if (upVisited.has(pid)) continue;
      upVisited.add(pid);
      const p = byId.get(pid);
      if (p) {
        set.add(p.id);
        for (const sid of p.spouseIds) {
          if (byId.has(sid)) set.add(sid);
        }
        for (const gp of p.parentIds) upQueue.push(gp);
      }
    }

    // Walk descendants downward
    const downQueue = [...(childrenByParent.get(focus.id) ?? [])];
    const downVisited = new Set<string>([focus.id]);
    while (downQueue.length > 0) {
      const cid = downQueue.shift()!;
      if (downVisited.has(cid)) continue;
      downVisited.add(cid);
      const c = byId.get(cid);
      if (c) {
        set.add(c.id);
        for (const nextChild of childrenByParent.get(c.id) ?? []) {
          downQueue.push(nextChild);
        }
      }
    }

    return set;
  }, [focusMemberId, branchScopedMembers]);

  const layout = useMemo(
    () => computeTidyTreeLayout(branchScopedMembers, tracedIds, branches),
    [branchScopedMembers, tracedIds, branches]
  );

  const handleFitToView = () => {
    const el = scrollViewportRef.current;
    if (!el || layout.width <= 0) return;
    // Subtract sticky left rail width (112px) and padding
    const availableW = Math.max(320, el.clientWidth - 136);
    const nextZoom = Math.min(1, Math.max(0.55, Number((availableW / layout.width).toFixed(2))));
    setZoom(nextZoom);
  };

  const hasSearchNoMatch = Boolean(searchMatchedIds && searchMatchedIds.size === 0);

  return (
    <div className="space-y-6">
      {/* Clan Archival Masthead */}
      <section className="bg-white border border-stone-200 rounded-xl p-6 sm:p-7">
        {editingZupu ? (
          <form onSubmit={handleSaveZupu} className="space-y-4">
            <div className="pb-3 border-b border-stone-200">
              <h2 className="font-display text-2xl font-semibold text-stone-900">
                {t.tree.editZupuTitle}
              </h2>
            </div>

            {zupuError && (
              <div
                role="alert"
                className="px-4 py-2.5 rounded-lg border border-red-300 bg-red-50 text-xs text-red-900"
              >
                {zupuError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">
                  {t.gate.clanNameEng}
                </label>
                <input
                  type="text"
                  required
                  maxLength={120}
                  value={clanNameInput}
                  onChange={(e) => setClanNameInput(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-[#FBF9F5] border border-stone-300 rounded-lg focus:outline-none focus:border-[#9E2A2B]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">
                  {t.gate.clanTitleZh}
                </label>
                <input
                  type="text"
                  required
                  maxLength={80}
                  value={clanChineseNameInput}
                  onChange={(e) => setClanChineseNameInput(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-serif-zh bg-[#FBF9F5] border border-stone-300 rounded-lg focus:outline-none focus:border-[#9E2A2B]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">
                  {t.gate.hallName}
                </label>
                <input
                  type="text"
                  maxLength={120}
                  value={hallNameInput}
                  onChange={(e) => setHallNameInput(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-[#FBF9F5] border border-stone-300 rounded-lg focus:outline-none focus:border-[#9E2A2B]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">
                  {t.gate.ancestralOrigin}
                </label>
                <input
                  type="text"
                  maxLength={120}
                  value={ancestralOriginInput}
                  onChange={(e) => setAncestralOriginInput(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-[#FBF9F5] border border-stone-300 rounded-lg focus:outline-none focus:border-[#9E2A2B]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">
                {t.gate.generationPoem}
              </label>
              <input
                type="text"
                value={poemInput}
                onChange={(e) => setPoemInput(e.target.value)}
                className="w-full px-3 py-2 text-sm font-serif-zh bg-[#FBF9F5] border border-stone-300 rounded-lg focus:outline-none focus:border-[#9E2A2B]"
              />
              <p className="text-[11px] text-stone-500 mt-1">{t.tree.poemHint}</p>
            </div>

            {/* Custom Expandable Branches Manager */}
            <div className="pt-2 border-t border-stone-200 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-medium text-stone-800">{t.tree.branchesTitle}</p>
                  <p className="text-[11px] text-stone-500 mt-0.5">{t.tree.branchesHint}</p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setBranchesDraft((prev) => [
                      ...prev,
                      {
                        key: `new-${Date.now()}-${prev.length}`,
                        id: '',
                        label: '',
                        chinese: '',
                      },
                    ])
                  }
                  className="px-3 py-1.5 text-xs font-medium border border-stone-300 bg-white hover:bg-stone-50 text-stone-800 rounded-lg inline-flex items-center gap-1 whitespace-nowrap shrink-0"
                >
                  <Plus className="w-3.5 h-3.5 text-[#9E2A2B]" />
                  {t.tree.addBranchBtn}
                </button>
              </div>

              <div className="space-y-2">
                {branchesDraft.map((b, idx) => {
                  const lockedInUse = Boolean(b.id && inUseBranchIds.has(b.id));
                  const cannotRemove = lockedInUse || branchesDraft.length <= 1;
                  return (
                    <div key={b.key} className="flex flex-wrap sm:flex-nowrap items-center gap-2">
                      <input
                        type="text"
                        required
                        maxLength={60}
                        placeholder={t.tree.branchLabelEn}
                        value={b.label}
                        onChange={(e) =>
                          setBranchesDraft((prev) =>
                            prev.map((row, rIdx) =>
                              rIdx === idx ? { ...row, label: e.target.value } : row
                            )
                          )
                        }
                        className="flex-1 min-w-[140px] px-3 py-1.5 text-xs bg-[#FBF9F5] border border-stone-300 rounded-lg focus:outline-none focus:border-[#9E2A2B]"
                      />
                      <input
                        type="text"
                        required
                        maxLength={40}
                        placeholder={t.tree.branchLabelZh}
                        value={b.chinese}
                        onChange={(e) =>
                          setBranchesDraft((prev) =>
                            prev.map((row, rIdx) =>
                              rIdx === idx ? { ...row, chinese: e.target.value } : row
                            )
                          )
                        }
                        className="w-36 px-3 py-1.5 text-xs font-serif-zh bg-[#FBF9F5] border border-stone-300 rounded-lg focus:outline-none focus:border-[#9E2A2B]"
                      />
                      <button
                        type="button"
                        disabled={cannotRemove}
                        title={lockedInUse ? t.tree.branchInUseTitle : t.tree.removeBranchBtn}
                        onClick={() =>
                          setBranchesDraft((prev) => prev.filter((_, rIdx) => rIdx !== idx))
                        }
                        className="p-1.5 text-stone-400 hover:text-red-700 disabled:opacity-35 disabled:hover:text-stone-400 border border-stone-200 rounded-lg bg-white shrink-0"
                        aria-label={t.tree.removeBranchBtn}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <button
                type="submit"
                disabled={zupuBusy}
                className="px-4 py-2 bg-[#9E2A2B] hover:bg-[#822021] disabled:opacity-60 text-white text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                {zupuBusy ? t.tree.savingZupu : t.tree.saveZupu}
              </button>
              <button
                type="button"
                onClick={() => setEditingZupu(false)}
                className="px-4 py-2 border border-stone-300 bg-white hover:bg-stone-50 text-stone-700 text-xs font-medium rounded-lg whitespace-nowrap shrink-0"
              >
                {t.common.cancel}
              </button>
            </div>
          </form>
        ) : (
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="flex items-start sm:items-center gap-5">
              {!sealFailed ? (
                <img
                  src="/src/assets/images/vermilion_clan_seal_1795328946321.jpg"
                  alt="Clan Vermilion Seal"
                  referrerPolicy="no-referrer"
                  onError={() => setSealFailed(true)}
                  className="w-16 h-16 sm:w-20 sm:h-20 object-cover rounded-lg border border-stone-300 shrink-0"
                />
              ) : (
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg border border-[#9E2A2B]/40 bg-[#9E2A2B]/10 flex items-center justify-center font-serif-zh text-2xl text-[#9E2A2B] font-bold shrink-0">
                  譜
                </div>
              )}
              <div>
                <p className="text-xs text-stone-500">
                  {[metadata.hallName, metadata.ancestralOrigin].filter(Boolean).join(' · ')}
                </p>
                <h1 className="font-display text-3xl sm:text-4xl font-semibold text-stone-900 mt-1">
                  <span className="font-serif-zh mr-2.5">{metadata.clanChineseName}</span>
                  <span className="text-stone-700 text-2xl sm:text-3xl font-normal">
                    {metadata.clanName}
                  </span>
                </h1>
                <div className="flex flex-wrap items-center gap-3 mt-1.5">
                  <p className="text-xs text-stone-500 font-mono-tabular">
                    {t.tree.vaultKey} {metadata.keyFingerprint} · {members.length} {t.gate.encryptedRecords}
                  </p>
                  {canEditZupuHeader && (
                    <button
                      type="button"
                      onClick={openZupuEditor}
                      className="text-xs font-medium text-[#9E2A2B] hover:underline inline-flex items-center gap-1 whitespace-nowrap shrink-0"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      {t.tree.editZupu}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Generation Poem Banner */}
            <div className="lg:text-right border-t lg:border-t-0 pt-4 lg:pt-0 border-stone-200">
              <p className="text-xs text-stone-500 mb-2">{t.tree.poemTitle}</p>
              <div className="inline-flex flex-wrap items-center gap-2">
                {metadata.generationPoem.length === 0 ? (
                  <span className="text-xs text-stone-400">{t.common.noneRecorded}</span>
                ) : (
                  metadata.generationPoem.map((char, idx) => (
                    <div
                      key={`${char}-${idx}`}
                      className="w-9 h-11 border border-stone-300 bg-[#FBF9F5] rounded flex flex-col items-center justify-center"
                    >
                      <span className="font-serif-zh text-base font-semibold text-stone-900 leading-none">
                        {char}
                      </span>
                      <span className="text-[10px] font-mono-tabular text-stone-400 mt-1">
                        {idx + 1}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Workspace Filter & Canvas Toolbar */}
      <section className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t.tree.searchPlaceholder}
              className="pl-9 pr-3.5 py-2 text-sm bg-white border border-stone-300 rounded-lg w-64 focus:outline-none focus:border-[#9E2A2B]"
            />
          </div>

          <div className="flex items-center gap-1 p-1 bg-stone-100 border border-stone-200 rounded-lg overflow-x-auto">
            {(['all', ...branches.map((b) => b.id)] as BranchScope[]).map(
              (scope) => (
                <button
                  key={scope}
                  type="button"
                  onClick={() => setBranchFilter(scope)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    branchFilter === scope
                      ? 'bg-white text-stone-900 shadow-xs'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  {getBranchLabel(scope, locale, branches)}
                </button>
              )
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div className="flex items-center border border-stone-300 bg-white rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(0.55, Number((z - 0.1).toFixed(2))))}
              aria-label="Zoom out"
              className="p-2 text-stone-600 hover:bg-stone-50 transition-colors"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="px-2.5 text-xs font-mono-tabular text-stone-700 border-x border-stone-200">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(1.25, Number((z + 0.1).toFixed(2))))}
              aria-label="Zoom in"
              className="p-2 text-stone-600 hover:bg-stone-50 transition-colors"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleFitToView}
              title={t.tree.fitView}
              className="px-2.5 py-2 text-xs text-stone-600 hover:bg-stone-50 border-l border-stone-200 transition-colors inline-flex items-center gap-1 whitespace-nowrap"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              {t.tree.fitView}
            </button>
            <button
              type="button"
              onClick={() => setZoom(1)}
              aria-label="Reset zoom"
              className="p-2 text-stone-500 hover:bg-stone-50 border-l border-stone-200 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          {currentUser.permissions.canEditLineage && (
            <button
              type="button"
              onClick={() =>
                onAddNewMember({
                  generation: 1,
                  branch:
                    currentUser.permissions.branchScope === 'all'
                      ? branches[0]?.id || 'elder_branch'
                      : currentUser.permissions.branchScope,
                })
              }
              className="px-4 py-2 bg-[#9E2A2B] hover:bg-[#822021] text-white text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              {t.tree.addRelative}
            </button>
          )}
        </div>
      </section>

      {/* Interactive Tidy Hierarchical Zupu Tree Canvas */}
      {branchScopedMembers.length === 0 || hasSearchNoMatch ? (
        <div className="bg-white border border-stone-200 rounded-xl p-12 text-center">
          <p className="font-display text-2xl font-semibold text-stone-900">
            {t.tree.emptyTitle}
          </p>
          <p className="text-sm text-stone-500 mt-1 max-w-md mx-auto">
            {members.length === 0 ? t.tree.emptyBlankDesc : t.tree.emptyFilterDesc}
          </p>
          {currentUser.permissions.canEditLineage && members.length === 0 && (
            <button
              type="button"
              onClick={() =>
                onAddNewMember({ generation: 1, branch: branches[0]?.id || 'elder_branch' })
              }
              className="mt-5 px-4 py-2 bg-[#9E2A2B] hover:bg-[#822021] text-white text-xs font-medium rounded-lg inline-flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              {t.tree.recordFoundingBtn}
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
          {/* Clean Tree Reading Legend */}
          <div className="px-5 py-2.5 border-b border-stone-200 bg-[#FBF9F5] flex flex-wrap items-center justify-between gap-3 text-xs text-stone-500">
            <div className="flex flex-wrap items-center gap-4">
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block w-3 h-[2px] bg-[#9E2A2B]" />
                {t.tree.legendParent}
              </span>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1.5">
                <span className="font-serif-zh text-[11px] font-semibold text-[#9E2A2B]">
                  {t.tree.marriageChar}
                </span>
                {t.tree.legendSpouse}
              </span>
              <span aria-hidden="true" className="hidden sm:inline">·</span>
              <span className="hidden sm:inline">{t.tree.traceHint}</span>
            </div>

            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setHoveredMemberId(null);
                }}
                className="text-xs font-medium text-[#9E2A2B] hover:underline whitespace-nowrap shrink-0"
              >
                {t.common.dismiss}
              </button>
            )}
          </div>

          <div
            ref={scrollViewportRef}
            className="overflow-x-auto bg-white"
          >
            <div className="flex items-stretch min-w-max">
              {/* Anchored Left Generation Plaque Column */}
              <div
                className="sticky left-0 z-20 w-28 shrink-0 bg-[#FBF9F5]/95 backdrop-blur-xs border-r border-stone-200"
                style={{ height: layout.height * zoom }}
              >
                {layout.bands.map((band, idx) => {
                  const poemChar = metadata.generationPoem[band.generation - 1];
                  return (
                    <div
                      key={band.generation}
                      style={{
                        top: band.y * zoom,
                        height: CARD_H * zoom,
                      }}
                      className={`absolute inset-x-0 px-3 flex flex-col justify-center ${
                        idx > 0 ? 'border-t border-stone-200/70' : ''
                      }`}
                    >
                      <p className="font-serif-zh text-sm font-semibold text-[#9E2A2B] leading-tight">
                        {formatGenLabel(band.generation)}
                      </p>
                      <p className="text-[11px] text-stone-600 font-mono-tabular mt-0.5 truncate">
                        {t.common.genPrefix} {band.generation}
                        {poemChar ? ` · ${poemChar}` : ''}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* Scaled Hierarchical SVG + Node Layer */}
              <div
                style={{
                  width: layout.width * zoom,
                  height: layout.height * zoom,
                }}
                className="relative shrink-0"
              >
                <div
                  style={{
                    width: layout.width,
                    height: layout.height,
                    transform: `scale(${zoom})`,
                    transformOrigin: 'top left',
                  }}
                  className="relative"
                >
                  {/* Subtle horizontal generation lanes for effortless cross-row scanning */}
                  {layout.bands.map((band, idx) =>
                    idx % 2 === 1 ? (
                      <div
                        key={`band-${band.generation}`}
                        style={{
                          top: band.y - 12,
                          height: CARD_H + 24,
                        }}
                        className="absolute inset-x-0 bg-[#FBF9F5]/60 border-y border-stone-100 pointer-events-none"
                      />
                    ) : null
                  )}

                  {/* SVG Connectors (Parent->Child orthogonal lines + Marriage bridges) */}
                  <svg
                    width={layout.width}
                    height={layout.height}
                    className="absolute inset-0 pointer-events-none"
                    aria-hidden="true"
                  >
                    {layout.edges.map((edge) => {
                      const isHighlighted =
                        tracedIds.size > 0 &&
                        tracedIds.has(edge.childMemberId) &&
                        edge.parentMemberIds.some((pid) => tracedIds.has(pid));
                      const isDimmed = tracedIds.size > 0 && !isHighlighted;
                      return (
                        <path
                          key={edge.id}
                          d={edge.d}
                          fill="none"
                          stroke={isHighlighted ? '#9E2A2B' : '#D6CEBE'}
                          strokeWidth={isHighlighted ? 2.2 : 1.5}
                          strokeOpacity={isDimmed ? 0.35 : 1}
                          strokeLinecap="square"
                        />
                      );
                    })}

                    {layout.bridges.map((bridge) => {
                      const mx = (bridge.x1 + bridge.x2) / 2;
                      return (
                        <g key={bridge.id}>
                          <line
                            x1={bridge.x1}
                            y1={bridge.y}
                            x2={bridge.x2}
                            y2={bridge.y}
                            stroke={bridge.highlighted ? '#9E2A2B' : '#C7BFB0'}
                            strokeWidth={bridge.highlighted ? 1.8 : 1.2}
                          />
                          <rect
                            x={mx - 9}
                            y={bridge.y - 9}
                            width={18}
                            height={18}
                            rx={3}
                            fill="#FBF9F5"
                            stroke={bridge.highlighted ? '#9E2A2B' : '#D6CEBE'}
                            strokeWidth={1}
                          />
                          <text
                            x={mx}
                            y={bridge.y + 4}
                            textAnchor="middle"
                            fontSize={10}
                            fill="#9E2A2B"
                            fontFamily='"Noto Serif TC", "Noto Serif SC", serif'
                          >
                            {t.tree.marriageChar}
                          </text>
                        </g>
                      );
                    })}
                  </svg>

                  {/* Member Node Cards */}
                  {layout.placedMembers.map(({ member, x, y }) => {
                    const isSelected = selectedMemberId === member.id;
                    const isTraced = tracedIds.has(member.id);
                    const isSearchMatch = !searchMatchedIds || searchMatchedIds.has(member.id);
                    const shouldDim =
                      (tracedIds.size > 0 && !isTraced) ||
                      (searchMatchedIds !== null && !isSearchMatch);

                    const lifespan = member.isLiving
                      ? `${member.birthYear || '?'}–${t.common.present}`
                      : `${member.birthYear || '?'}–${member.deathYear || '?'}`;
                    const sens = SENSITIVITY_META[member.sensitivity];
                    const isRestrictedView =
                      member.isLiving && !currentUser.permissions.canViewLivingPII;

                    const showPortrait =
                      isValidPortraitDataUrl(member.portraitDataUrl) && !isRestrictedView;

                    return (
                      <button
                        key={member.id}
                        type="button"
                        onClick={() => onSelectMember(member.id)}
                        onMouseEnter={() => setHoveredMemberId(member.id)}
                        onMouseLeave={() => setHoveredMemberId(null)}
                        style={{
                          left: x,
                          top: y,
                          width: CARD_W,
                          height: CARD_H,
                        }}
                        className={`absolute z-10 text-left px-3 py-2.5 rounded-lg border transition-all flex flex-col justify-between ${
                          isSelected || (searchMatchedIds && isSearchMatch)
                            ? 'bg-white border-[#9E2A2B] ring-1 ring-[#9E2A2B]/30 shadow-xs'
                            : isTraced
                              ? 'bg-white border-[#9E2A2B]/60'
                              : 'bg-[#FBF9F5] border-stone-200 hover:bg-white hover:border-stone-400'
                        } ${shouldDim ? 'opacity-45 hover:opacity-100' : 'opacity-100'}`}
                      >
                        <div className="flex items-start gap-2 min-w-0">
                          {showPortrait && (
                            <img
                              src={member.portraitDataUrl}
                              alt=""
                              className="w-8 h-8 rounded object-cover border border-stone-300 shrink-0 mt-0.5"
                            />
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-baseline justify-between gap-1">
                              <span className="font-serif-zh text-base font-bold text-stone-900 truncate">
                                {member.chineseName}
                              </span>
                              <span className="text-[10px] font-mono-tabular text-stone-500 shrink-0">
                                {lifespan}
                              </span>
                            </div>
                            <p className="text-[11px] font-medium text-stone-700 truncate">
                              {member.romanizedName}
                            </p>
                          </div>
                        </div>

                        <div>
                          <p className="text-[10px] text-stone-500 truncate">
                            {getBranchLabel(member.branch, locale, branches)}
                            {member.courtesyName ? ` · 字${member.courtesyName}` : ''}
                          </p>
                          <div className="mt-1 pt-1 border-t border-stone-200/80 flex items-center justify-between text-[10px]">
                            <span className={`${sens.toneClass} truncate`}>
                              {getSensitivityLabel(member.sensitivity, locale)}
                            </span>
                            {isRestrictedView ? (
                              <Lock className="w-3 h-3 text-stone-400 shrink-0" />
                            ) : (
                              <span className="text-stone-400 shrink-0">
                                {member.isLiving ? t.common.living : t.common.ancestor}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
