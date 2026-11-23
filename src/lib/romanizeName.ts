import { pinyin } from 'pinyin-pro';
import { getJyutpingList } from 'to-jyutping';
import type { Locale } from './i18n';

export type RomanizationScheme = 'cantonese' | 'pinyin';

const HANZI_REGEX = /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/;

export function containsHanzi(text: string): boolean {
  return HANZI_REGEX.test(text);
}

export function defaultRomanizationScheme(locale: Locale): RomanizationScheme {
  return locale === 'zh-CN' ? 'pinyin' : 'cantonese';
}

const COMPOUND_SURNAMES: Record<
  string,
  { cantonese: string; pinyin: string }
> = {
  歐陽: { cantonese: 'Au-Yeung', pinyin: 'Ouyang' },
  欧阳: { cantonese: 'Au-Yeung', pinyin: 'Ouyang' },
  司徒: { cantonese: 'Szeto', pinyin: 'Situ' },
  司馬: { cantonese: 'Sze-Ma', pinyin: 'Sima' },
  司马: { cantonese: 'Sze-Ma', pinyin: 'Sima' },
  諸葛: { cantonese: 'Chu-Kot', pinyin: 'Zhuge' },
  诸葛: { cantonese: 'Chu-Kot', pinyin: 'Zhuge' },
  上官: { cantonese: 'Sheung-Koon', pinyin: 'Shangguan' },
  皇甫: { cantonese: 'Wong-Po', pinyin: 'Huangfu' },
  東方: { cantonese: 'Tung-Fong', pinyin: 'Dongfang' },
  东方: { cantonese: 'Tung-Fong', pinyin: 'Dongfang' },
  夏侯: { cantonese: 'Ha-Hau', pinyin: 'Xiahou' },
  慕容: { cantonese: 'Mo-Yung', pinyin: 'Murong' },
  令狐: { cantonese: 'Ling-Wu', pinyin: 'Linghu' },
  尉遲: { cantonese: 'Wat-Chi', pinyin: 'Yuchi' },
  尉迟: { cantonese: 'Wat-Chi', pinyin: 'Yuchi' },
  端木: { cantonese: 'Tuen-Muk', pinyin: 'Duanmu' },
  宇文: { cantonese: 'Yu-Man', pinyin: 'Yuwen' },
  太史: { cantonese: 'Tai-Si', pinyin: 'Taishi' },
};

const HK_SURNAME_MAP: Record<string, string> = {
  陳: 'Chan', 陈: 'Chan',
  李: 'Lee',
  張: 'Cheung', 张: 'Cheung',
  黃: 'Wong', 黄: 'Wong',
  王: 'Wong',
  何: 'Ho',
  林: 'Lam',
  周: 'Chow',
  鄭: 'Cheng', 郑: 'Cheng',
  謝: 'Tse', 谢: 'Tse',
  蔡: 'Choi',
  許: 'Hui', 许: 'Hui',
  曾: 'Tsang',
  吳: 'Ng', 吴: 'Ng',
  伍: 'Ng',
  劉: 'Lau', 刘: 'Lau',
  楊: 'Yeung', 杨: 'Yeung',
  梁: 'Leung',
  郭: 'Kwok',
  羅: 'Law', 罗: 'Law',
  葉: 'Ip', 叶: 'Ip',
  蘇: 'So', 苏: 'So',
  徐: 'Tsui',
  孫: 'Suen', 孙: 'Suen',
  鄧: 'Tang', 邓: 'Tang',
  馬: 'Ma', 马: 'Ma',
  胡: 'Wu',
  朱: 'Chu',
  高: 'Ko',
  馮: 'Fung', 冯: 'Fung',
  潘: 'Poon',
  鍾: 'Chung', 钟: 'Chung',
  譚: 'Tam', 谭: 'Tam',
  廖: 'Liu',
  黎: 'Lai',
  賴: 'Lai', 赖: 'Lai',
  方: 'Fong',
  蕭: 'Siu', 萧: 'Siu',
  姚: 'Yiu',
  盧: 'Lo', 卢: 'Lo',
  韋: 'Wai', 韦: 'Wai',
  陸: 'Luk', 陆: 'Luk',
  袁: 'Yuen',
  韓: 'Hon', 韩: 'Hon',
  施: 'Sze',
  史: 'Sze',
  區: 'Au', 区: 'Au',
  歐: 'Au', 欧: 'Au',
  單: 'Sin', 单: 'Sin',
  仇: 'Sau',
  解: 'Kai',
  沈: 'Sum',
  呂: 'Lui', 吕: 'Lui',
  江: 'Kong',
  溫: 'Wan', 温: 'Wan',
  嚴: 'Yim', 严: 'Yim',
  傅: 'Fu',
  蔣: 'Tseung', 蒋: 'Tseung',
  彭: 'Pang',
  邱: 'Yau',
  杜: 'To',
  丁: 'Ting',
  董: 'Tung',
  程: 'Ching',
  曹: 'Cho',
  莊: 'Chong', 庄: 'Chong',
  關: 'Kwan', 关: 'Kwan',
  麥: 'Mak', 麦: 'Mak',
  霍: 'Fok',
  顏: 'Ngan', 颜: 'Ngan',
  龍: 'Lung', 龙: 'Lung',
  湯: 'Tong', 汤: 'Tong',
  唐: 'Tong',
  錢: 'Chin', 钱: 'Chin',
  白: 'Pak',
  戴: 'Tai',
  任: 'Yam',
  洪: 'Hung',
  文: 'Man',
  阮: 'Yuen',
  余: 'Yu',
  俞: 'Yu',
  顧: 'Koo', 顾: 'Koo',
  薛: 'Sit',
  石: 'Shek',
  范: 'Fan',
  魏: 'Ngai',
  姜: 'Keung',
  孔: 'Hung',
  康: 'Hong',
  毛: 'Mo',
  秦: 'Chun',
  莫: 'Mok',
  雷: 'Lui',
  賀: 'Ho', 贺: 'Ho',
  利: 'Lee',
  招: 'Chiu',
  冼: 'Sin',
  龐: 'Pong', 庞: 'Pong',
  岑: 'Shum',
  簡: 'Kan', 简: 'Kan',
  卓: 'Cheuk',
  田: 'Tin',
  萬: 'Man', 万: 'Man',
  尹: 'Wan',
  倪: 'Ngai',
  鄒: 'Chow', 邹: 'Chow',
  熊: 'Hung',
  孟: 'Mang',
  段: 'Tuen',
  邵: 'Siu',
  郝: 'Kok',
  易: 'Yik',
  常: 'Sheung',
  武: 'Mo',
  喬: 'Kiu', 乔: 'Kiu',
  龔: 'Kung', 龚: 'Kung',
  崔: 'Chui',
  齊: 'Chai', 齐: 'Chai',
  連: 'Lin', 连: 'Lin',
  柯: 'Or',
  游: 'Yau',
  鮑: 'Pau', 鲍: 'Pau',
  章: 'Cheung',
  柏: 'Pak',
  藍: 'Lam', 蓝: 'Lam',
  賈: 'Ka', 贾: 'Ka',
  侯: 'Hau',
  宋: 'Sung',
  夏: 'Ha',
  華: 'Wah', 华: 'Wah',
  金: 'Kam',
  陶: 'To',
  梅: 'Mui',
  戚: 'Chik',
  魯: 'Lo', 鲁: 'Lo',
  畢: 'Pat', 毕: 'Pat',
  殷: 'Yan',
  樊: 'Fan',
  翁: 'Yung',
  盛: 'Shing',
};

const HK_GIVEN_CHAR_OVERRIDES: Record<string, string> = {
  大: 'Tai',
  小: 'Siu',
  少: 'Siu',
  文: 'Man',
  明: 'Ming',
  志: 'Chi',
  智: 'Chi',
  德: 'Tak',
  遠: 'Yuen', 远: 'Yuen',
  瑞: 'Sui',
  淑: 'Shuk',
  貞: 'Ching', 贞: 'Ching',
  星: 'Sing',
  華: 'Wah', 华: 'Wah',
  海: 'Hoi',
  雲: 'Wan', 云: 'Wan',
  秀: 'Sau',
  蓮: 'Lin', 莲: 'Lin',
  婉: 'Yuen',
  儀: 'Yi', 仪: 'Yi',
  啟: 'Kai', 启: 'Kai',
  政: 'Ching',
  慧: 'Wai',
  宏: 'Wang',
  蘭: 'Lan', 兰: 'Lan',
  輝: 'Fai', 辉: 'Fai',
  家: 'Ka',
  嘉: 'Ka',
  佳: 'Kai',
  國: 'Kwok', 国: 'Kwok',
  偉: 'Wai', 伟: 'Wai',
  強: 'Keung', 强: 'Keung',
  永: 'Wing',
  樂: 'Lok', 乐: 'Lok',
  詩: 'Sze', 诗: 'Sze',
  思: 'Sze',
  婷: 'Ting',
  欣: 'Yan',
  怡: 'Yee',
  軒: 'Hin', 轩: 'Hin',
  謙: 'Him', 谦: 'Him',
  凱: 'Hoi', 凯: 'Hoi',
  子: 'Tsz',
  梓: 'Tsz',
  朗: 'Long',
  俊: 'Chun',
  傑: 'Kit', 杰: 'Kit',
  潔: 'Kit', 洁: 'Kit',
  敏: 'Man',
  美: 'Mei',
  寶: 'Po', 宝: 'Po',
  麗: 'Lai', 丽: 'Lai',
  芳: 'Fong',
  玉: 'Yuk',
  翠: 'Chui',
  鳳: 'Fung', 凤: 'Fung',
  龍: 'Lung', 龙: 'Lung',
  安: 'On',
  榮: 'Wing', 荣: 'Wing',
  富: 'Fu',
  貴: 'Kwai', 贵: 'Kwai',
  順: 'Shun', 顺: 'Shun',
  昌: 'Cheong',
  成: 'Shing',
  發: 'Fat', 发: 'Fat',
  財: 'Choi', 财: 'Choi',
  福: 'Fuk',
  壽: 'Sau', 寿: 'Sau',
  康: 'Hong',
  健: 'Kin',
  平: 'Ping',
  泰: 'Tai',
  忠: 'Chung',
  孝: 'Hau',
  仁: 'Yan',
  義: 'Yee', 义: 'Yee',
  禮: 'Lai', 礼: 'Lai',
  信: 'Sun',
  賢: 'Yin', 贤: 'Yin',
  良: 'Leung',
  清: 'Ching',
  源: 'Yuen',
  祖: 'Cho',
  宗: 'Chung',
  光: 'Kwong',
  耀: 'Yiu',
  新: 'San',
  春: 'Chun',
  秋: 'Chau',
  冬: 'Tung',
  夏: 'Ha',
  月: 'Yuet',
  日: 'Yat',
  山: 'Shan',
  水: 'Shui',
  石: 'Shek',
  松: 'Chung',
  竹: 'Chuk',
  梅: 'Mui',
  菊: 'Kuk',
  花: 'Fa',
  天: 'Tin',
  風: 'Fung', 风: 'Fung',
  雨: 'Yu',
  雪: 'Suet',
  金: 'Kam',
  銀: 'Ngan', 银: 'Ngan',
  森: 'Sam',
  林: 'Lam',
  柏: 'Pak',
  權: 'Kuen', 权: 'Kuen',
  建: 'Kin',
  軍: 'Kwan', 军: 'Kwan',
  生: 'Sang',
  民: 'Man',
  東: 'Tung', 东: 'Tung',
  南: 'Nam',
  西: 'Sai',
  北: 'Pak',
  中: 'Chung',
  正: 'Ching',
  慶: 'Hing', 庆: 'Hing',
  喜: 'Hei',
  希: 'Hei',
  熙: 'Hei',
  禧: 'Hei',
  佩: 'Pui',
  碧: 'Pik',
  珊: 'Shan',
  琪: 'Ki',
  玲: 'Ling',
  晶: 'Ching',
  穎: 'Wing', 颖: 'Wing',
  靜: 'Ching', 静: 'Ching',
  雅: 'Nga',
  晴: 'Ching',
  曉: 'Hiu', 晓: 'Hiu',
  嵐: 'Lam', 岚: 'Lam',
  彤: 'Tung',
  盈: 'Ying',
  姿: 'Chi',
  韻: 'Wan', 韵: 'Wan',
  浩: 'Ho',
  豪: 'Ho',
  宇: 'Yu',
  庭: 'Ting',
  廷: 'Ting',
  誠: 'Shing', 诚: 'Shing',
  基: 'Kei',
  超: 'Chiu',
  立: 'Lap',
  君: 'Kwan',
  峰: 'Fung',
  鋒: 'Fung', 锋: 'Fung',
  雄: 'Hung',
  威: 'Wai',
  振: 'Chun',
  興: 'Hing', 兴: 'Hing',
  邦: 'Pong',
  達: 'Tat', 达: 'Tat',
};

function capitalize(word: string): string {
  if (!word) return '';
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

function jyutpingToHkGovt(rawJyutping: string): string {
  const jp = rawJyutping.toLowerCase().replace(/[1-6]/g, '').trim();
  if (!jp) return '';

  // Direct high-frequency syllable exact matches
  const exactSyllables: Record<string, string> = {
    si: 'sze',
    zi: 'chi',
    ci: 'chi',
    ji: 'yi',
    jyu: 'yu',
    jyun: 'yuen',
    jyut: 'yuet',
    zyu: 'chu',
    zyun: 'chuen',
    zyut: 'chuet',
    cyu: 'chu',
    cyun: 'chuen',
    cyut: 'chuet',
    syu: 'shu',
    syun: 'shuen',
    syut: 'shuet',
    seoi: 'sui',
    zeoi: 'chui',
    ceoi: 'chui',
    soeng: 'sheung',
    zoeng: 'cheung',
    coeng: 'cheung',
    joeng: 'yeung',
    loeng: 'leung',
    koeng: 'keung',
    goeng: 'keung',
    hoeng: 'heung',
    noeng: 'neung',
    doeng: 'teung',
    toeng: 'teung',
    boeng: 'peung',
    poeng: 'peung',
    m: 'm',
    ng: 'ng',
  };
  if (exactSyllables[jp]) return capitalize(exactSyllables[jp]);

  // Split initial + final
  const initialMatch = jp.match(/^(gw|kw|ng|[bpmfdtnlgkhwzcsj])/);
  const initial = initialMatch ? initialMatch[1] : '';
  const final = jp.slice(initial.length);

  const initialMap: Record<string, string> = {
    b: 'p',
    p: 'p',
    m: 'm',
    f: 'f',
    d: 't',
    t: 't',
    n: 'n',
    l: 'l',
    g: 'k',
    k: 'k',
    ng: 'ng',
    h: 'h',
    gw: 'kw',
    kw: 'kw',
    w: 'w',
    z: 'ch',
    c: 'ch',
    s: final.startsWith('u') || final.startsWith('oe') || final.startsWith('yu') ? 'sh' : 's',
    j: 'y',
  };

  let hkInitial = initial ? (initialMap[initial] ?? initial) : '';

  let hkFinal = final
    .replace(/^aa/, 'a')
    .replace(/^eoi$/, 'ui')
    .replace(/^eo/, 'u')
    .replace(/^oe/, 'eu')
    .replace(/^yu/, 'ue')
    .replace(/^ou$/, 'o')
    .replace(/^ei$/, 'ei')
    .replace(/^ui$/, 'ui')
    .replace(/^oi$/, 'oi');

  // Special tidy HK Govt adjustments
  if (hkInitial === 'k' && hkFinal === 'u') hkFinal = 'oo';
  if (hkInitial === 'w' && hkFinal === 'u') hkFinal = 'oo';
  if (hkInitial === 'f' && hkFinal === 'u') hkFinal = 'u';
  if (hkInitial === 's' && hkFinal === 'uk') hkInitial = 'sh';
  if (hkInitial === 's' && hkFinal === 'un') hkInitial = 'sh';
  if (hkInitial === 'y' && hkFinal.startsWith('i')) {
    hkInitial = '';
    hkFinal = 'y' + hkFinal;
  }

  return capitalize(`${hkInitial}${hkFinal}`);
}

function romanizeCantonese(cleanName: string): string {
  const parts: string[] = [];
  let idx = 0;

  // Check compound 2-character surname at start
  const firstTwo = cleanName.slice(0, 2);
  if (COMPOUND_SURNAMES[firstTwo]) {
    parts.push(COMPOUND_SURNAMES[firstTwo].cantonese);
    idx = 2;
  }

  const remaining = cleanName.slice(idx);
  if (!remaining) return parts.join(' ');

  const jyutpingPairs = getJyutpingList(remaining);
  jyutpingPairs.forEach(([char, jp], pairIdx) => {
    if (!HANZI_REGEX.test(char)) {
      if (/[A-Za-z0-9]/.test(char)) {
        const last = parts[parts.length - 1];
        if (last && /^[A-Za-z0-9]+$/.test(last) && pairIdx > 0) {
          parts[parts.length - 1] = last + char;
        } else {
          parts.push(char);
        }
      }
      return;
    }

    const isSurnamePos = idx === 0 && pairIdx === 0;
    if (isSurnamePos && HK_SURNAME_MAP[char]) {
      parts.push(HK_SURNAME_MAP[char]);
      return;
    }
    if (!isSurnamePos && HK_GIVEN_CHAR_OVERRIDES[char]) {
      parts.push(HK_GIVEN_CHAR_OVERRIDES[char]);
      return;
    }
    if (jp) {
      parts.push(jyutpingToHkGovt(jp));
      return;
    }

    // Fallback to pinyin syllable if a rare Hanzi lacks Jyutping entry
    const py = pinyin(char, { toneType: 'none', mode: 'surname' }).replace(/ü/g, 'u');
    if (py) parts.push(capitalize(py));
  });

  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

function romanizePinyin(cleanName: string): string {
  const firstTwo = cleanName.slice(0, 2);
  let surnameText = '';
  let rest = cleanName;

  if (COMPOUND_SURNAMES[firstTwo]) {
    surnameText = COMPOUND_SURNAMES[firstTwo].pinyin;
    rest = cleanName.slice(2);
  } else {
    const firstChar = cleanName.charAt(0);
    if (HANZI_REGEX.test(firstChar)) {
      const pySurname = pinyin(cleanName, {
        toneType: 'none',
        mode: 'surname',
        type: 'array',
      })[0];
      surnameText = capitalize((pySurname ?? '').replace(/ü/g, 'u'));
      rest = cleanName.slice(1);
    }
  }

  if (!rest) return surnameText;

  // Check if remaining contains only Hanzi (standard given name concatenation like Deyuan)
  const chars = Array.from(rest);
  const hanziOnly = chars.filter((c) => HANZI_REGEX.test(c));
  const nonHanzi = chars.filter((c) => !HANZI_REGEX.test(c) && /[A-Za-z0-9]/.test(c)).join('');

  let givenText = '';
  if (hanziOnly.length > 0) {
    const givenSyllables = pinyin(hanziOnly.join(''), {
      toneType: 'none',
      type: 'array',
    }).map((s) => s.replace(/ü/g, 'u').toLowerCase());
    givenText = capitalize(givenSyllables.join(''));
  }

  return [surnameText, givenText, nonHanzi].filter(Boolean).join(' ').trim();
}

export function romanizeChineseName(
  rawChineseName: string,
  scheme: RomanizationScheme
): string {
  const trimmed = rawChineseName.trim();
  if (!trimmed) return '';

  // Preserve plain Latin/English names if user didn't enter Hanzi
  if (!containsHanzi(trimmed)) {
    return trimmed;
  }

  // Strip common honorifics / CJK punctuation spacing around characters
  const normalized = trimmed.replace(/[・·\-_,，。()（）\s]+/g, '');
  if (!normalized) return '';

  return scheme === 'cantonese'
    ? romanizeCantonese(normalized)
    : romanizePinyin(normalized);
}
