const DICEWARE_WORDS = [
  'acorn', 'agate', 'alder', 'amber', 'anchor', 'anise', 'apricot', 'arbor',
  'arch', 'ashlar', 'aspen', 'aster', 'atlas', 'atrium', 'autumn', 'azalea',
  'bamboo', 'banyan', 'barge', 'barley', 'basalt', 'basin', 'beacon', 'bell',
  'beryl', 'birch', 'bloom', 'blossom', 'boat', 'bonsai', 'bough', 'boulder',
  'branch', 'breeze', 'bridge', 'bronze', 'brook', 'brush', 'buckwheat', 'canal',
  'candle', 'canopy', 'canyon', 'caravan', 'carver', 'cascade', 'castle', 'cedar',
  'celadon', 'censer', 'chalice', 'chamfer', 'chapel', 'charcoal', 'cherry', 'chime',
  'chronicle', 'cinnabar', 'citadel', 'citron', 'clay', 'cliff', 'clover', 'cobble',
  'compass', 'conifer', 'copper', 'coral', 'courtyard', 'cove', 'crane', 'creek',
  'crest', 'crimson', 'crocus', 'crown', 'crystal', 'cypress', 'dahlia', 'dale',
  'dawn', 'deer', 'delta', 'dewdrop', 'dock', 'dome', 'dove', 'dragon',
  'drift', 'dune', 'dusk', 'eagle', 'earthen', 'ebony', 'echo', 'elder',
  'elm', 'ember', 'emerald', 'enamel', 'estuary', 'evergreen', 'fable', 'falcon',
  'fern', 'ferry', 'field', 'finial', 'fir', 'flame', 'flax', 'flint',
  'flora', 'flute', 'fog', 'folio', 'ford', 'forest', 'forge', 'fountain',
  'frost', 'gable', 'gale', 'garden', 'garnet', 'gate', 'gazelle', 'gablet',
  'geyser', 'ginger', 'ginkgo', 'glacier', 'glade', 'glen', 'globe', 'granite',
  'grass', 'gravel', 'grove', 'gull', 'harbor', 'harvest', 'haven', 'hawk',
  'hazel', 'hearth', 'heather', 'heirloom', 'hemlock', 'herald', 'heron', 'hibiscus',
  'hilltop', 'hollow', 'honey', 'horizon', 'hornbeam', 'indigo', 'inkstone', 'inlet',
  'iris', 'ironwood', 'island', 'ivory', 'ivy', 'jade', 'jasmine', 'jasper',
  'juniper', 'keel', 'kelp', 'kestrel', 'kiln', 'kingdom', 'knoll', 'lagoon',
  'lake', 'lantern', 'larch', 'lark', 'laurel', 'leaf', 'ledge', 'ledger',
  'lichen', 'lilac', 'lily', 'limestone', 'linden', 'linen', 'locket', 'locust',
  'lotus', 'lute', 'lynx', 'magnolia', 'mahogany', 'manor', 'maple', 'marble',
  'marsh', 'masonry', 'meadow', 'meridian', 'mesa', 'mill', 'millet', 'mineral',
  'mint', 'mirror', 'mist', 'monarch', 'moonbeam', 'moor', 'mosaic', 'moss',
  'mountain', 'mulberry', 'myrtle', 'nectar', 'needle', 'nest', 'noble', 'north',
  'nutmeg', 'oak', 'oasis', 'obsidian', 'ocean', 'ochre', 'olive', 'onyx',
  'opal', 'orchard', 'orchid', 'oriole', 'osprey', 'otter', 'outrigger', 'owl',
  'pagoda', 'palm', 'panther', 'paper', 'parchment', 'pavilion', 'pebble', 'pecan',
  'peony', 'pepper', 'petal', 'pewter', 'pheasant', 'phoenix', 'piazza', 'pillar',
  'pine', 'plover', 'plum', 'plume', 'pond', 'poplar', 'porcelain', 'portal',
  'prairie', 'prism', 'quartz', 'quill', 'quince', 'rain', 'ravine', 'reed',
  'reef', 'relic', 'ridge', 'ripple', 'river', 'robin', 'rock', 'rosewood',
  'rowan', 'ruby', 'rush', 'rustic', 'sable', 'saffron', 'sage', 'sail',
  'salmon', 'sandal', 'sapphire', 'satin', 'scroll', 'seal', 'seaport', 'sedge',
  'seedling', 'sequoia', 'serene', 'shadow', 'shale', 'shell', 'shield', 'shingle',
  'shore', 'shrine', 'silk', 'silver', 'slate', 'snow', 'solstice', 'songbird',
  'sorrel', 'sound', 'sparrow', 'spire', 'spring', 'spruce', 'starlight', 'statue',
  'stele', 'stem', 'stone', 'stork', 'stream', 'summit', 'sunbeam', 'sundial',
  'swallow', 'sycamore', 'tablet', 'tallow', 'tamarack', 'tarn', 'teak', 'temple',
  'terrace', 'thatch', 'thicket', 'thistle', 'thorn', 'thrush', 'thunder', 'tide',
  'tiger', 'tile', 'timber', 'topaz', 'torch', 'torrent', 'tower', 'trail',
  'travertine', 'treasure', 'trestle', 'trillium', 'tributary', 'trout', 'tulip', 'tundra',
  'turret', 'twilight', 'umber', 'upland', 'vale', 'valley', 'vault', 'velvet',
  'veranda', 'vermilion', 'vessel', 'vesper', 'vineyard', 'violet', 'walnut', 'waterfall',
  'wave', 'weather', 'weir', 'wellspring', 'westwind', 'wheat', 'wharf', 'whisper',
  'wildflower', 'willow', 'windmill', 'winter', 'wisteria', 'woodland', 'wren', 'yarrow',
  'yew', 'zenith', 'zephyr', 'zircon',
];

export type PassphraseStrengthTier = 'empty' | 'weak' | 'fair' | 'good' | 'strong';

export interface PassphraseStrengthResult {
  score: 0 | 1 | 2 | 3 | 4;
  tier: PassphraseStrengthTier;
  bits: number;
}

/**
 * Generates a memorable multi-word passphrase using WebCrypto rejection sampling
 * to guarantee uniform word selection without modulo bias.
 */
export function generateDicewarePassphrase(wordCount = 5): string {
  const n = DICEWARE_WORDS.length;
  const maxValid = Math.floor(0x1_0000_0000 / n) * n;
  const chosen: string[] = [];

  while (chosen.length < wordCount) {
    const buf = new Uint32Array(wordCount - chosen.length);
    globalThis.crypto.getRandomValues(buf);
    for (let i = 0; i < buf.length && chosen.length < wordCount; i++) {
      if (buf[i] < maxValid) {
        chosen.push(DICEWARE_WORDS[buf[i] % n]);
      }
    }
  }
  return chosen.join('-');
}

export function evaluatePassphraseStrength(value: string): PassphraseStrengthResult {
  if (!value) {
    return { score: 0, tier: 'empty', bits: 0 };
  }

  const len = value.length;
  const hasLower = /[a-z]/.test(value);
  const hasUpper = /[A-Z]/.test(value);
  const hasDigit = /\d/.test(value);
  const hasSymbol = /[^A-Za-z0-9\s]/.test(value);
  const hasSpaceOrDash = /[\s_-]/.test(value);
  const nonAscii = /[^\x20-\x7E]/.test(value);

  let pool = 0;
  if (hasLower) pool += 26;
  if (hasUpper) pool += 26;
  if (hasDigit) pool += 10;
  if (hasSymbol) pool += 32;
  if (hasSpaceOrDash && !hasSymbol) pool += 2;
  if (nonAscii) pool += 64;
  pool = Math.max(pool, 10);

  // Estimate effective unique characters / words to avoid inflating repeated chars
  const uniqueChars = new Set(Array.from(value)).size;
  const repetitionFactor = Math.min(1, uniqueChars / Math.max(4, Math.min(len, 18)));
  const wordTokens = value.trim().split(/[\s\-_]+/).filter((w) => w.length >= 3);
  const wordBits = wordTokens.length >= 4 ? wordTokens.length * 9 : 0;
  const rawBits = Math.round(len * Math.log2(pool) * (0.45 + 0.55 * repetitionFactor));
  const bits = Math.max(wordBits, rawBits);

  if (len < 8 || bits < 30) {
    return { score: 1, tier: 'weak', bits };
  }
  if (bits < 44) {
    return { score: 2, tier: 'fair', bits };
  }
  if (bits < 60) {
    return { score: 3, tier: 'good', bits };
  }
  return { score: 4, tier: 'strong', bits };
}
