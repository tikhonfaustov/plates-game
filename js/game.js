// Состояние и правила игры. Ничего не знает ни про Telegram, ни про отрисовку.
(function () {
  const P = window.Plates;

  const START_MONEY = 50000;
  const ROLL_BASE = 3000;
  const REGION_GUARANTEE = 1.5; // наценка за выбор конкретного региона

  // Автопродажа: уровни покупаются по порядку за $.
  const AUTO_LEVELS = [
    { name: 'Автопродажа', cost: 25, desc: 'Когда коллекция заполнена, продаёт обычные номера' },
    { name: 'Режим «Старый»', cost: 50, desc: 'Можно продавать сначала самые старые номера' },
    { name: 'Потолок цены', cost: 100, desc: 'Не продавать номера дороже заданной цены' },
    { name: 'Тир «Необычные»', cost: 150, desc: 'Можно продавать необычные номера' },
    { name: 'Спецномера', cost: 200, desc: 'Можно продавать номера такси, полиции и военные' },
    { name: '«Каждая генерация»', cost: 250, desc: 'Продаёт подходящий номер сразу после прокрута' },
    { name: 'Режим «Дешёвый»', cost: 300, desc: 'Можно продавать сначала самые дешёвые номера' },
    { name: 'Тир «Редкие»', cost: 400, desc: 'Можно продавать редкие номера' },
    { name: '«Когда не хватает денег»', cost: 500, desc: 'Продаёт номера, если не хватает на прокрут' },
  ];

  const THEMES = [
    { id: 'dark', name: 'Тёмная' },
    { id: 'light', name: 'Светлая' },
    { id: 'pink', name: 'Розовая' },
    { id: 'gold', name: 'Золото', lock: 'Откроется при базовой стоимости номера 50 000 ₽', ok: (s) => s.stats.bestValue >= 50000 },
    { id: 'silver', name: 'Серебро', lock: 'Откроется за 50 номеров', ok: (s) => s.stats.total >= 50 },
  ];

  // ---------- ежедневные задания ----------
  const TASK_REWARD_RUB = 50000;
  const TASK_REWARD_USD = 50;
  const BONUS = { usd: 50, rub: 500000 };
  const NORMAL_TASKS = [
    () => ({ type: 'combo', combo: pickOne(['dmirror', 'dseq', 'dround', 'lpal', 'ltri', 'dregion']), target: 1 }),
    () => ({ type: 'sell', target: 100 }),
    () => ({ type: 'roll', target: 200 }),
    () => ({ type: 'earn', target: 300000 }),
    () => ({ type: 'rarity', min: 'rare', target: 10 }),
  ];
  const HARD_TASKS = [
    () => ({ type: 'rarity', min: 'uncommon', target: 500 }),
    () => ({ type: 'rarity', min: 'epic', target: 1 }),
    () => ({ type: 'roll', target: 1000 }),
    () => ({ type: 'combo', combo: 'd3same', target: 3 }),
  ];
  const pickOne = (a) => a[Math.floor(Math.random() * a.length)];

  function taskTitle(t) {
    if (t.type === 'combo') return `Выбей комбинацию «${P.COMBOS[t.combo]}»`;
    if (t.type === 'sell') return 'Продай номера';
    if (t.type === 'roll') return 'Сгенерируй номера';
    if (t.type === 'earn') return 'Заработай на продаже номеров';
    if (t.type === 'rarity') return `Выбей номера «${P.RARITIES[P.RARITY_IDX[t.min]].name}» и выше`;
    return '';
  }
  const taskHint = (t) => (t.type === 'combo' ? 'Например: ' + P.COMBO_HINTS[t.combo] : '');

  function newTask(hard, exclude = []) {
    const pool = hard ? HARD_TASKS : NORMAL_TASKS;
    for (let i = 0; i < 20; i++) {
      const t = pickOne(pool)();
      const key = t.type + (t.combo || '') + (t.min || '');
      if (exclude.includes(key)) continue;
      return { ...t, key, hard, progress: 0, done: false, replaced: false };
    }
    return { ...pool[0](), key: 'x', hard, progress: 0, done: false, replaced: false };
  }

  const today = () => {
    const d = new Date();
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  };

  function emptyStats() {
    return { total: 0, rar: [0, 0, 0, 0, 0], combos: {}, kinds: {}, countries: {}, best: null, bestPrice: 0, bestValue: 0, sold: 0, earned: 0 };
  }

  function freshState() {
    return {
      v: 2,
      money: START_MONEY,
      usd: 0,
      coll: [],     // номера в коллекции: { id, c: код, t: время }
      safe: [],     // номера в сейфе
      up: { coll: 0, safe: 0 },
      auto: { lvl: 0, on: true, tiers: ['common'], ceil: 0, special: false, order: 'new', every: false, money: false },
      gen: { country: 'ru', off: [], region: { ru: null, by: null } },
      stats: emptyStats(),
      xp: 0, level: 1,
      seen: [],     // что уже «открыто»: редкости, комбинации, виды номеров
      daily: null,
      theme: 'dark',
      set: { sound: true, vibro: true, showSold: true, skipEpic: false, skipLegendary: false },
      t: Date.now(),
    };
  }

  let nextId = 1;
  const item = (c, t = Date.now()) => ({ id: nextId++, c, t });

  const Game = {
    P, AUTO_LEVELS, THEMES, BONUS, REGION_GUARANTEE, ROLL_BASE,
    TASK_REWARD_RUB, TASK_REWARD_USD, taskTitle, taskHint,
    s: freshState(),
    session: emptyStats(),
    cache: new Map(), // код → результат evaluate (оценка не меняется, считаем один раз)

    // ---------- сохранение ----------
    toSave() {
      const pack = (list) => list.map((x) => x.c + '~' + Math.floor(x.t / 1000).toString(36)).join(',');
      return { ...this.s, coll: pack(this.s.coll), safe: pack(this.s.safe), t: Date.now() };
    },
    load(saved) {
      const base = freshState();
      if (saved && saved.v === 2) {
        const unpack = (str) => (str ? str.split(',').map((x) => {
          const [c, t] = x.split('~');
          return item(c, parseInt(t, 36) * 1000);
        }) : []);
        this.s = {
          ...base, ...saved,
          coll: unpack(saved.coll), safe: unpack(saved.safe),
          up: { ...base.up, ...saved.up },
          auto: { ...base.auto, ...saved.auto },
          gen: { ...base.gen, ...saved.gen, region: { ...base.gen.region, ...(saved.gen && saved.gen.region) } },
          stats: { ...base.stats, ...saved.stats },
          set: { ...base.set, ...saved.set },
        };
      }
      this.ensureDaily();
    },

    // ---------- справочное ----------
    ev(code) {
      let e = this.cache.get(code);
      if (!e) { e = P.evaluate(P.decode(code)); this.cache.set(code, e); }
      return e;
    },
    collCap() { return 50 + this.s.up.coll * 25; },
    safeCap() { return 5 + this.s.up.safe * 5; },
    collUpCost() { return Math.round(100000 * Math.pow(2.5, this.s.up.coll)); },
    safeUpCost() { return 25 * Math.pow(2, this.s.up.safe); },
    collFull() { return this.s.coll.length >= this.collCap(); },
    collValue(list = this.s.coll) { return list.reduce((sum, x) => sum + this.ev(x.c).price, 0); },

    country() { return P.COUNTRIES[this.s.gen.country]; },
    region() { return this.s.gen.region[this.s.gen.country]; },
    regionList() { return this.s.gen.country === 'by' ? P.REGION_SETS.by : P.REGION_SETS.ru; },
    rollCostParts() {
      const name = this.region();
      const reg = name && this.regionList().find((r) => r.name === name);
      if (!reg) return { total: ROLL_BASE, reg: null };
      return { total: Math.round(ROLL_BASE * reg.m * REGION_GUARANTEE), reg };
    },
    rollCost() { return this.rollCostParts().total; },

    kindUnlocked(kindId) {
      const k = P.KINDS[kindId];
      return (this.s.stats.countries[k.country] || 0) >= k.unlock;
    },
    activeKinds() {
      return this.country().kinds.filter((k) => this.kindUnlocked(k) && !this.s.gen.off.includes(k));
    },
    // Доля каждого вида номеров в генерации, в процентах.
    kindShares() {
      const act = this.activeKinds();
      const total = act.reduce((s, k) => s + P.KINDS[k].weight, 0);
      return Object.fromEntries(act.map((k) => [k, (100 * P.KINDS[k].weight) / total]));
    },
    toggleKind(kindId) {
      if (!this.kindUnlocked(kindId)) return false;
      const off = this.s.gen.off;
      if (off.includes(kindId)) off.splice(off.indexOf(kindId), 1);
      else if (this.activeKinds().length > 1) off.push(kindId); // хотя бы один вид должен остаться
      return true;
    },

    levelNeed() { return 200 * this.s.level; },
    themeUnlocked(th) { return !th.ok || th.ok(this.s); },

    // ---------- прокрут ----------
    roll() {
      const cost = this.rollCost();
      const autoSold = [];
      if (this.s.money < cost && this.autoCan('money')) {
        while (this.s.money < cost) {
          const x = this.autoPick();
          if (!x) break;
          autoSold.push(x.c);
          this.sell(x.id, { auto: true });
        }
      }
      if (this.s.money < cost) return { ok: false, reason: 'money', autoSold };
      if (this.collFull() && this.autoCan('full')) {
        const x = this.autoPick();
        if (x) { autoSold.push(x.c); this.sell(x.id, { auto: true }); }
      }
      if (this.collFull()) return { ok: false, reason: 'full', autoSold };

      this.s.money -= cost;
      const shares = this.kindShares();
      let r = Math.random() * 100, kind = Object.keys(shares)[0];
      for (const [k, sh] of Object.entries(shares)) { if ((r -= sh) < 0) { kind = k; break; } }
      const code = P.encode(P.random(kind, this.region()));
      const e = this.ev(code);
      const it = item(code);
      this.s.coll.push(it);

      const opened = this.record(code, e);
      const levelUp = this.addXp(e.rarity.xp);
      this.taskEvent('roll', 1);
      this.taskEvent('rarity', 1, e);
      for (const c of e.combos) this.taskEvent('combo', 1, null, c.id);

      // «Каждая генерация»: сразу продаём выпавший номер, если он подходит под фильтры.
      let soldNow = false;
      if (this.autoCan('every') && this.autoMatches(it)) {
        this.sell(it.id, { auto: true });
        soldNow = true;
      }
      return { ok: true, code, e, id: it.id, opened, levelUp, autoSold, soldNow };
    },

    // Записывает номер в статистику. Возвращает список «впервые открытых» вещей.
    record(code, e) {
      const opened = [];
      for (const st of [this.s.stats, this.session]) {
        st.total++;
        st.rar[P.RARITY_IDX[e.rarity.id]]++;
        st.kinds[e.kind.id] = (st.kinds[e.kind.id] || 0) + 1;
        st.countries[e.kind.country] = (st.countries[e.kind.country] || 0) + 1;
        for (const c of e.combos) st.combos[c.id] = (st.combos[c.id] || 0) + 1;
        if (e.price > st.bestPrice) { st.bestPrice = e.price; st.best = code; }
        if (e.value > st.bestValue) st.bestValue = e.value;
      }
      const mark = (key, label) => {
        if (!this.s.seen.includes(key)) { this.s.seen.push(key); opened.push(label); }
      };
      mark('r:' + e.rarity.id, e.rarity.name);
      for (const c of e.combos) mark('c:' + c.id, P.COMBOS[c.id]);
      mark('k:' + e.kind.id, e.kind.name + (e.kind.country === 'by' ? ' (Беларусь)' : ''));
      return opened;
    },

    addXp(xp) {
      this.s.xp += xp;
      let up = 0;
      while (this.s.xp >= this.levelNeed()) {
        this.s.xp -= this.levelNeed();
        this.s.level++;
        this.s.usd += 10;
        up++;
      }
      return up ? { level: this.s.level, usd: 10 * up } : null;
    },

    // ---------- продажа и сейф ----------
    find(id) {
      let i = this.s.coll.findIndex((x) => x.id === id);
      if (i >= 0) return { list: this.s.coll, i, inSafe: false };
      i = this.s.safe.findIndex((x) => x.id === id);
      if (i >= 0) return { list: this.s.safe, i, inSafe: true };
      return null;
    },
    sell(id, { auto = false } = {}) {
      const f = this.find(id);
      if (!f || f.inSafe) return 0; // из сейфа продать нельзя
      const [x] = f.list.splice(f.i, 1);
      const price = this.ev(x.c).price;
      this.s.money += price;
      for (const st of [this.s.stats, this.session]) { st.sold++; st.earned += price; }
      this.taskEvent('sell', 1);
      this.taskEvent('earn', price);
      return price;
    },
    sellMany(ids) {
      let total = 0, count = 0;
      for (const id of ids) { const p = this.sell(id); if (p > 0) { total += p; count++; } }
      return { total, count };
    },
    toSafe(id) {
      const f = this.find(id);
      if (!f || f.inSafe || this.s.safe.length >= this.safeCap()) return false;
      this.s.safe.push(...f.list.splice(f.i, 1));
      return true;
    },
    fromSafe(id) {
      const f = this.find(id);
      if (!f || !f.inSafe || this.collFull()) return false;
      this.s.coll.push(...f.list.splice(f.i, 1));
      return true;
    },
    // Фильтр для быстрой продажи и коллекции: { country, kind, rar: [id] }.
    filter(list, f) {
      return list.filter((x) => {
        const e = this.ev(x.c);
        if (f.country && f.country !== 'all' && e.kind.country !== f.country) return false;
        if (f.kind && f.kind !== 'all' && e.kind.id !== f.kind) return false;
        if (f.rar && f.rar.length && !f.rar.includes(e.rarity.id)) return false;
        return true;
      });
    },

    // ---------- улучшения ----------
    upColl() {
      const cost = this.collUpCost();
      if (this.s.money < cost) return false;
      this.s.money -= cost; this.s.up.coll++;
      return true;
    },
    upSafe() {
      const cost = this.safeUpCost();
      if (this.s.usd < cost) return false;
      this.s.usd -= cost; this.s.up.safe++;
      return true;
    },

    // ---------- автопродажа ----------
    buyAutoLevel() {
      const next = AUTO_LEVELS[this.s.auto.lvl];
      if (!next || this.s.usd < next.cost) return false;
      this.s.usd -= next.cost;
      this.s.auto.lvl++;
      return true;
    },
    // Работает ли автопродажа в этой ситуации: 'full' — коллекция полна (всегда), 'every' — каждый прокрут, 'money' — нет денег.
    autoCan(situation) {
      const a = this.s.auto;
      if (!a.on || a.lvl < 1) return false;
      if (situation === 'full') return true;
      if (situation === 'every') return a.every && a.lvl >= 6;
      if (situation === 'money') return a.money && a.lvl >= 9;
      return false;
    },
    autoAllowedTiers() {
      const lvl = this.s.auto.lvl;
      return ['common', lvl >= 4 && 'uncommon', lvl >= 8 && 'rare'].filter(Boolean);
    },
    autoMatches(x) {
      const a = this.s.auto;
      const e = this.ev(x.c);
      const tiers = a.tiers.filter((t) => this.autoAllowedTiers().includes(t));
      if (!tiers.includes(e.rarity.id)) return false;
      if (a.lvl >= 3 && a.ceil > 0 && e.price > a.ceil) return false;
      const special = !['c', 'b'].includes(e.kind.id);
      if (special && !(a.lvl >= 5 && a.special)) return false;
      return true;
    },
    // Какой номер автопродажа продаст следующим.
    autoPick() {
      const a = this.s.auto;
      const list = this.s.coll.filter((x) => this.autoMatches(x));
      if (!list.length) return null;
      const order = (a.order === 'old' && a.lvl >= 2) ? 'old' : (a.order === 'cheap' && a.lvl >= 7) ? 'cheap' : 'new';
      if (order === 'old') return list.reduce((m, x) => (x.t < m.t ? x : m));
      if (order === 'cheap') return list.reduce((m, x) => (this.ev(x.c).price < this.ev(m.c).price ? x : m));
      return list.reduce((m, x) => (x.t >= m.t ? x : m));
    },

    // ---------- задания ----------
    ensureDaily() {
      const d = this.s.daily;
      if (d && d.day === today()) return;
      const a = newTask(false);
      const b = newTask(false, [a.key]);
      this.s.daily = { day: today(), tasks: [a, b, newTask(true)], bonus: null };
    },
    taskEvent(type, amount, e = null, comboId = null) {
      this.ensureDaily();
      for (const t of this.s.daily.tasks) {
        if (t.done || t.type !== type) continue;
        if (type === 'rarity' && P.RARITY_IDX[e.rarity.id] < P.RARITY_IDX[t.min]) continue;
        if (type === 'combo' && comboId !== t.combo) continue;
        t.progress = Math.min(t.target, t.progress + amount);
        if (t.progress >= t.target) {
          t.done = true;
          if (t.hard) this.s.usd += TASK_REWARD_USD;
          else this.s.money += TASK_REWARD_RUB;
          this.justDone.push(t);
        }
      }
    },
    justDone: [], // выполненные задания, о которых ещё не сообщили игроку
    replaceTask(i) {
      const d = this.s.daily;
      const t = d.tasks[i];
      if (!t || t.done || t.replaced) return false;
      const n = newTask(t.hard, d.tasks.map((x) => x.key));
      n.replaced = true;
      d.tasks[i] = n;
      return true;
    },
    allTasksDone() { return this.s.daily.tasks.every((t) => t.done); },
    claimBonus(kind) {
      const d = this.s.daily;
      if (d.bonus || !this.allTasksDone()) return false;
      d.bonus = kind;
      if (kind === 'usd') this.s.usd += BONUS.usd;
      else this.s.money += BONUS.rub;
      return true;
    },
    msToNewTasks() {
      const n = new Date();
      const next = new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1);
      return next - n;
    },

    reset() {
      this.s = freshState();
      this.session = emptyStats();
      this.ensureDaily();
    },
  };

  window.Game = Game;
})();
