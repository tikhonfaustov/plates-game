// Генерация номеров, поиск комбинаций, редкость и цена.
//
// Цена номера = (базовая стоимость + сумма комбинаций) × комбо × регион × код × класс
//   комбо  — 1.5 в степени (число комбинаций − 1)
//   регион — престиж региона, код — основной код дороже поздних
//   класс  — зависит от редкости
// Редкость считается по «очкам» = сумма комбинаций × комбо × код (без региона),
// поэтому шанс каждой редкости одинаков во всех регионах — отличаются только цены.
(function (root) {
  const D = root.GameData || (typeof require !== 'undefined' ? require('./data.js') : null);

  const LETTERS = 'АВЕКМНОРСТУХ';
  const LATIN = { А: 'A', В: 'B', Е: 'E', К: 'K', М: 'M', Н: 'H', О: 'O', Р: 'P', С: 'C', Т: 'T', У: 'Y', Х: 'X' };

  const RARITIES = [
    { id: 'common', name: 'Обычный', cls: 1, xp: 10 },
    { id: 'uncommon', name: 'Необычный', cls: 1.05, xp: 15 },
    { id: 'rare', name: 'Редкий', cls: 1.2, xp: 40 },
    { id: 'epic', name: 'Эпический', cls: 5, xp: 200 },
    { id: 'legendary', name: 'Легендарный', cls: 50, xp: 1000 },
  ];
  const RARITY_IDX = Object.fromEntries(RARITIES.map((r, i) => [r.id, i]));
  // Пороги очков для редкостей, отдельно для каждого вида номера (необычный — любая комбинация).
  // Подобраны симуляцией (tools/simulate.js) под шансы оригинальной игры.
  const THRESHOLDS = {
    c: [19125, 49725, 72000],
    t: [13000, 30001, 57001],
    p: [10000, 46500, 91501],
    m: [21000, 60000, 121500],
    b: [22500, 63000, 117000],
  };

  // Шансы редкостей по видам номеров, % — с учётом удачи 0.5 из game.js (tools/simulate.js).
  const CHANCES = {
    c: [40.91, 46.49, 12.14, 0.44, 0.03],
    t: [52.57, 39.26, 7.65, 0.48, 0.03],
    p: [36.98, 51.47, 11.00, 0.53, 0.02],
    m: [32.93, 55.20, 11.38, 0.47, 0.03],
    b: [29.13, 57.03, 12.91, 0.89, 0.04],
  };

  // Виды номеров. letters/digits — сколько букв и цифр, base — базовая стоимость.
  const KINDS = {
    c: { id: 'c', country: 'ru', name: 'Гражданский', letters: 3, digits: 3, base: 100, unlock: 0, weight: 70, regions: 'ru' },
    t: { id: 't', country: 'ru', name: 'Такси', letters: 2, digits: 3, base: 1000, unlock: 1000, weight: 15, regions: 'ru' },
    p: { id: 'p', country: 'ru', name: 'Полиция', letters: 1, digits: 4, base: 25000, unlock: 5000, weight: 10, regions: 'ru' },
    m: { id: 'm', country: 'ru', name: 'Военный', letters: 2, digits: 4, base: 10000, unlock: 10000, weight: 5, regions: 'mil' },
    b: { id: 'b', country: 'by', name: 'Гражданский', letters: 2, digits: 4, base: 100, unlock: 0, weight: 100, regions: 'by' },
  };
  const COUNTRIES = {
    ru: { id: 'ru', name: 'Россия', kinds: ['c', 't', 'p', 'm'] },
    by: { id: 'by', name: 'Беларусь', kinds: ['b'] },
  };

  // Все комбинации (для статистики, заданий и каталога).
  const COMBOS = {
    d4same: 'Четыре одинаковые цифры',
    d3same: '3 одинаковые цифры',
    dtwopair: 'Две пары цифр',
    dpair: '2 одинаковые цифры',
    dmirror: 'Зеркальные цифры',
    dseq: 'Цифры подряд',
    dround: 'Круглый номер',
    dsmall: 'Малый номер',
    dyear: 'Похоже на год',
    dregion: 'Цифры совпадают с регионом',
    lpair: '2 одинаковые буквы',
    ltri: '3 одинаковые буквы',
    lpal: 'Палиндром букв',
    similar: 'Номер из похожих символов',
    series: 'Блатная серия',
  };
  const COMBO_HINTS = {
    d4same: '7777, 1111', d3same: '777, 555', dtwopair: '1122, 3434', dpair: '772, 115',
    dmirror: '121, 1221', dseq: '123, 456, 789', dround: '100, 500, 7000', dsmall: '001, 007',
    dyear: '1987, 2024', dregion: '767 с регионом 67', lpair: 'А…АВ', ltri: 'А…АА', lpal: 'В…ОВ',
    similar: 'В888ВВ, Т777ТТ', series: 'АМР, ЕКХ, ООО',
  };

  // ---------- регионы ----------
  const REGION_SETS = { ru: D.RU_REGIONS, by: D.BY_REGIONS, mil: D.MIL_REGIONS };
  const CODE_INFO = {}; // "ru:77" → { region, mult }
  for (const [set, list] of Object.entries(REGION_SETS)) {
    for (const reg of list) {
      reg.codes.forEach((code, i) => {
        const mult = set === 'ru' && D.CODE_MULT[code] != null ? D.CODE_MULT[code] : D.CODE_STEP[Math.min(i, D.CODE_STEP.length - 1)];
        CODE_INFO[set + ':' + code] = { region: reg, mult };
      });
    }
  }
  const SERIES = Object.fromEntries(D.SPECIAL_SERIES.map((x) => [x.s, x]));

  const rnd = (n) => Math.floor(Math.random() * n);
  const pick = (arr) => arr[rnd(arr.length)];

  // regionName — конкретный регион или null («все регионы»).
  function random(kindId, regionName = null) {
    const k = KINDS[kindId];
    const list = REGION_SETS[k.regions];
    const reg = (regionName && list.find((r) => r.name === regionName)) || pick(list);
    let l = '';
    for (let i = 0; i < k.letters; i++) l += pick(LETTERS);
    const max = Math.pow(10, k.digits) - 1;
    const d = String(1 + rnd(max)).padStart(k.digits, '0');
    return { k: kindId, l, d, r: pick(reg.codes) };
  }

  // ---------- комбинации ----------
  function digitCombos(d, r, out) {
    const c = d.split('');
    const n = c.length;
    const counts = {};
    for (const x of c) counts[x] = (counts[x] || 0) + 1;
    const maxSame = Math.max(...Object.values(counts));
    const add = (id, bonus) => out.push({ id, name: COMBOS[id], bonus });

    let pairBlocked = false;
    if (maxSame === n) { add(n === 4 ? 'd4same' : 'd3same', n === 4 ? 60000 : 21000); pairBlocked = true; }
    else if (n === 4 && maxSame === 3) { add('d3same', 21000); pairBlocked = true; }

    const num = +d;
    if (maxSame < n) {
      if (n === 3 && num <= 9) { add('dsmall', 30000); pairBlocked = true; }
      else if (n === 4 && num <= 9) { add('dsmall', 40000); pairBlocked = true; }
      else if (n === 3 && num % 100 === 0) { add('dround', 15000); pairBlocked = true; }
      else if (n === 4 && num % 1000 === 0) { add('dround', 25000); pairBlocked = true; }
      else if (n === 4 && num % 100 === 0) { add('dround', 10000); pairBlocked = true; }
    }

    const isMirror = n === 3 ? c[0] === c[2] && c[0] !== c[1] : c[0] === c[3] && c[1] === c[2] && c[0] !== c[1];
    if (isMirror) { add('dmirror', 10000); pairBlocked = true; }
    if (n === 4 && !isMirror && maxSame === 2 && Object.keys(counts).length === 2) { add('dtwopair', 12000); pairBlocked = true; }

    const x = c.map(Number);
    let up = true, down = true;
    for (let i = 1; i < n; i++) { if (x[i] !== x[i - 1] + 1) up = false; if (x[i] !== x[i - 1] - 1) down = false; }
    if (up || down) add('dseq', n === 4 ? 8000 : 5000);

    if (n === 4 && num >= 1950 && num <= 2029) add('dyear', 6000);

    if (!pairBlocked && maxSame === 2) {
      // В трёхзначном номере пара засчитывается, только если цифры стоят рядом.
      let adjacent = n === 4;
      for (let i = 1; i < n; i++) if (c[i] === c[i - 1]) adjacent = true;
      if (adjacent) add('dpair', 7000);
    }

    if (r.length === 3 ? d.endsWith(r) : d.endsWith(r) && num >= 10) add('dregion', 13000);
  }

  function letterCombos(p, out) {
    const l = p.l;
    const add = (id, bonus, name) => out.push({ id, name: name || COMBOS[id], bonus });
    if (l.length === 3) {
      if (l[0] === l[1] && l[1] === l[2]) add('ltri', 24000);
      else if (l[0] === l[2]) add('lpal', 9000);
      else if (l[0] === l[1] || l[1] === l[2]) add('lpair', 8000);
    } else if (l.length === 2 && l[0] === l[1]) add('lpair', 8000);

    if (p.k === 'c') {
      const s = SERIES[l];
      if (s) {
        // В чужом регионе серия ценится как обычные буквы — без бонуса.
        if (s.home.includes(p.r)) add('series', 130000, `Серия ${l}`);
      }
      const similar = { В: '8', О: '0', Т: '7' };
      if (l[0] === l[1] && l[1] === l[2] && similar[l[0]] && p.d === similar[l[0]].repeat(3)) add('similar', 150000);
    }
  }

  function evaluate(p) {
    const k = KINDS[p.k];
    const combos = [];
    digitCombos(p.d, p.r, combos);
    letterCombos(p, combos);
    const sum = combos.reduce((s, c) => s + c.bonus, 0);
    const comboMult = combos.length ? Math.pow(1.5, combos.length - 1) : 1;
    const ci = CODE_INFO[k.regions + ':' + p.r] || { region: { name: '?', m: 1 }, mult: 1 };
    const score = sum * comboMult * ci.mult;
    let ri = 0;
    if (combos.length) ri = 1;
    const th = THRESHOLDS[p.k];
    if (score >= th[0]) ri = 2;
    if (score >= th[1]) ri = 3;
    if (score >= th[2]) ri = 4;
    const rarity = RARITIES[ri];
    const value = (k.base + sum) * comboMult; // «базовая стоимость номера» без региона
    const price = Math.floor(value * ci.region.m * ci.mult * rarity.cls);
    return {
      kind: k, combos, sum, comboMult, score, rarity, value, price,
      region: ci.region, regionMult: ci.region.m, codeMult: ci.mult, classMult: rarity.cls,
    };
  }

  // ---------- хранение ----------
  // Номер строкой: вид + буквы + цифры + "|" + регион. А777АА 77 хранится как "cААА777|77".
  const encode = (p) => p.k + p.l + p.d + '|' + p.r;
  function decode(s) {
    const k = KINDS[s[0]];
    const [body, r] = s.slice(1).split('|');
    return { k: k.id, l: body.slice(0, k.letters), d: body.slice(k.letters), r };
  }

  // Номер как текст (для поиска, подсказок и т.п.).
  function text(p) {
    if (p.k === 'c') return `${p.l[0]}${p.d}${p.l.slice(1)} ${p.r}`;
    if (p.k === 't') return `${p.l} ${p.d} ${p.r}`;
    if (p.k === 'p') return `${p.l} ${p.d} ${p.r}`;
    if (p.k === 'm') return `${p.d} ${p.l} ${p.r}`;
    return `${p.d} ${toLatin(p.l)}-${p.r}`;
  }
  const toLatin = (l) => l.split('').map((ch) => LATIN[ch] || ch).join('');

  const api = {
    LETTERS, RARITIES, RARITY_IDX, THRESHOLDS, CHANCES, KINDS, COUNTRIES, COMBOS, COMBO_HINTS, REGION_SETS, CODE_INFO,
    random, evaluate, encode, decode, text, toLatin,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Plates = api;
})(typeof window !== 'undefined' ? window : globalThis);
