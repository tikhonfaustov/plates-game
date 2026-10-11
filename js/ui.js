// Экраны, окна и обработка нажатий.
(function () {
  const G = window.Game;
  const P = window.Plates;
  const Pf = window.Platform;
  const $ = (id) => document.getElementById(id);
  const app = $('app');
  const modalRoot = $('modal-root');

  const fmt = (n) => Math.floor(n).toLocaleString('ru-RU');
  const rub = (n) => fmt(n) + ' ₽';
  const usd = (n) => fmt(n) + ' $';
  const mult = (x) => '×' + x.toFixed(2);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const ri = (e) => P.RARITY_IDX[e.rarity.id];
  const countryName = (id) => P.COUNTRIES[id].name;

  // ---------- номерной знак ----------
  function plateHTML(p, cls = '') {
    const reg = `<div class="reg ${p.r.length > 2 ? 'r3' : ''}"><span class="R">${p.r}</span><span class="rus">RUS${p.k === 'c' ? '<i class="flag-ru"></i>' : ''}</span></div>`;
    const L = (s) => `<span class="L">${s}</span>`;
    const Dg = (s) => `<span class="D">${s}</span>`;
    let inner;
    if (p.k === 'c') inner = `<div class="main">${L(p.l[0])}${Dg(p.d)}${L(p.l.slice(1))}</div>${reg}`;
    else if (p.k === 't' || p.k === 'p') inner = `<div class="main">${L(p.l)}${Dg(p.d)}</div>${reg}`;
    else if (p.k === 'm') inner = `<div class="main">${Dg(p.d)}${L(p.l)}</div>${reg}`;
    else inner = `<div class="by"><i class="flag-by"></i>BY</div><div class="main">${Dg(p.d)}${L(P.toLatin(p.l) + '-' + p.r)}</div>`;
    return `<div class="plate k-${p.k} ${cls}"><div class="pi">${inner}</div><i class="screw l"></i><i class="screw r"></i><i class="shine"></i></div>`;
  }
  const A = window.Art;
  const IC = A.ICONS;
  const plateOf = (code, cls) => plateHTML(P.decode(code), cls);
  const segs = (n) => `<span class="segs">${[0, 1, 2, 3, 4].map((i) => `<i class="${i <= n ? 'on' : ''}"></i>`).join('')}</span>`;
  const SAMPLE = { c: 'cААА001|01', t: 'tАА001|01', p: 'pА0001|01', m: 'mАА0001|09', b: 'bАА0001|7' };

  // ---------- звук ----------
  let actx = null;
  function beep(freq, dur, vol = 0.05, delay = 0) {
    if (!G.s.set.sound) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const t = actx.currentTime + delay;
      const o = actx.createOscillator(), g = actx.createGain();
      o.frequency.value = freq; o.type = 'triangle';
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(actx.destination); o.start(t); o.stop(t + dur);
    } catch (e) { /* звук недоступен */ }
  }
  const haptic = (t) => { if (G.s.set.vibro) Pf.haptic(t); };

  // ---------- уведомления ----------
  function toast(text) {
    const t = $('toast');
    t.textContent = text;
    t.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => t.classList.remove('show'), 2200);
  }

  // ---------- навигация ----------
  const ui = {
    stack: ['gen'],
    last: null,          // последний прокрут
    info: [],            // временные уведомления на главном экране
    sort: { by: 'date', dir: -1 },
    filter: { country: 'all', kind: 'all', rar: [] },
    qs: { country: 'all', kind: 'all', rar: [] },
    sel: new Set(),
    statsTab: 'all',
    cat: { country: 'ru', kind: 'c', region: 'Москва' },
    anim: 0,
  };
  const cur = () => ui.stack[ui.stack.length - 1];
  function go(screen) { ui.stack.push(screen); ui.sel.clear(); render(); window.scrollTo(0, 0); }
  function back() {
    if (modalRoot.innerHTML) { closeModal(); return; }
    if (ui.stack.length > 1) { ui.stack.pop(); ui.sel.clear(); render(); }
  }

  function render() {
    Pf.setBack(ui.stack.length > 1 ? back : null);
    app.innerHTML = SCREENS[cur()]();
    if (cur() === 'gen') {
      window.FX.attach($('fx'));
      setGlow(ui.last ? ri(ui.last.e) : 0);
      updateGen();
    }
  }
  const head = (title, right = '') => `<div class="head"><button class="icon-btn" data-act="back">${IC.back}</button><h1>${title}</h1>${right}</div>`;

  // ---------- главный экран (генератор) ----------
  function warnNotes() {
    const notes = [];
    if (G.s.money < G.rollCost()) notes.push('Не хватает денег на прокрут');
    else if (G.collFull()) notes.push('Коллекция заполнена');
    return notes.map((t) => `<div class="note">${IC.warn} ${t} <button class="btn btn-red" data-act="go" data-to="coll">Открыть</button></div>`).join('');
  }
  function addInfo(title, sub) {
    const id = Math.random();
    ui.info.push({ id, title, sub });
    if (ui.info.length > 2) ui.info.shift();
    setTimeout(() => { ui.info = ui.info.filter((x) => x.id !== id); if (cur() === 'gen') updateNotes(); }, 2600);
  }
  function updateNotes() {
    const el = $('notes');
    if (!el) return;
    el.innerHTML = ui.info.map((x) => `<div class="note info">${IC.unlock}<div><b>${esc(x.title)}</b><small>${esc(x.sub)}</small></div></div>`).join('') + warnNotes();
  }
  const bonusReady = () => G.allTasksDone() && !G.s.daily.bonus;

  function stageHTML(res, cls = '') {
    if (!res) return '<div class="hint"><div class="tap-ring"></div>Нажмите в любом месте</div>';
    const e = res.e;
    return `<div class="info-card" data-r="${ri(e)}">
        <div><div class="rlabel">${e.rarity.name}${res.soldNow ? ' · продан' : ''}</div>${segs(ri(e))}</div>
        <div class="price">${rub(e.price)}</div>
      </div>
      ${plateOf(res.code, cls)}
      <div class="combo-text">${e.combos.map((c) => esc(c.name)).join(' · ')}</div>`;
  }

  function updateGen() {
    if (!$('gen')) return;
    $('pill-rub').lastChild.textContent = fmt(G.s.money);
    $('pill-usd').lastChild.textContent = fmt(G.s.usd);
    $('menu-btn').classList.toggle('glow', bonusReady());
    const cnt = $('coll-cnt');
    cnt.textContent = `${G.s.coll.length}/${G.collCap()}`;
    cnt.classList.toggle('full', G.collFull());
    $('tasks-dot').hidden = !bonusReady();
    updateNotes();
  }

  function setGlow(r) {
    const glow = $('glow');
    if (!glow) return;
    glow.dataset.r = r;
    glow.style.background = r > 0
      ? 'radial-gradient(75% 42% at 50% 50%, color-mix(in srgb, var(--rc) 38%, transparent), transparent 75%)'
      : 'radial-gradient(75% 42% at 50% 50%, rgba(120,140,255,.08), transparent 75%)';
    const old = $('rays');
    if (old) old.remove();
    if (r >= 3) {
      const rays = document.createElement('div');
      rays.className = 'rays'; rays.id = 'rays'; rays.dataset.r = r;
      $('gen').insertBefore(rays, $('stage'));
    }
  }

  function ripple(x, y) {
    const gen = $('gen');
    if (!gen) return;
    const el = document.createElement('div');
    el.className = 'ripple';
    el.style.left = x + 'px'; el.style.top = y + 'px';
    gen.appendChild(el);
    setTimeout(() => el.remove(), 600);
  }

  function floatCost(cost) {
    const gen = $('gen');
    const el = document.createElement('div');
    el.className = 'float-cost';
    el.textContent = '−' + rub(cost);
    gen.appendChild(el);
    setTimeout(() => el.remove(), 950);
    const pill = $('pill-rub');
    pill.classList.remove('bump'); void pill.offsetWidth; pill.classList.add('bump');
  }

  function doRoll(x, y) {
    const cost = G.rollCost();
    const res = G.roll();
    if (res.autoSold.length && G.s.set.showSold) toast(`Автопродажа: продано ${res.autoSold.length} шт.`);
    if (!res.ok) {
      haptic('error'); beep(160, 0.12);
      updateGen();
      return;
    }
    if (x != null) ripple(x, y);
    floatCost(cost);
    ui.last = res;
    for (const o of res.opened) addInfo('Открыто новое', o);
    if (res.levelUp) addInfo(`Уровень ${res.levelUp.level}!`, `Награда: ${usd(res.levelUp.usd)}`);
    while (G.justDone.length) {
      const t = G.justDone.shift();
      addInfo('Задание выполнено', t.hard ? `+${usd(G.TASK_REWARD_USD)}` : `+${rub(G.TASK_REWARD_RUB)}`);
    }
    reveal(res);
    updateGen();
    save();
  }

  // Анимация выпадения: короткое мелькание, для эпических и легендарных — дольше и со вспышкой.
  function reveal(res) {
    const token = ++ui.anim;
    const stage = $('stage');
    const r = ri(res.e);
    const long = (r === 3 && !G.s.set.skipEpic) || (r === 4 && !G.s.set.skipLegendary);
    const frames = long ? 14 : 3;
    let i = 0;
    beep(520, 0.03, 0.03);
    const tick = () => {
      if (token !== ui.anim) return;
      if (i < frames) {
        const kind = res.e.kind.id;
        stage.innerHTML = `<div class="info-card" style="visibility:hidden"><div>.</div></div>${plateHTML(P.random(kind), 'spin')}<div class="combo-text"></div>`;
        if (long) haptic('select');
        i++;
        setTimeout(tick, long ? 40 + i * 9 : 45);
        return;
      }
      stage.innerHTML = stageHTML(res, 'reveal');
      setGlow(r);
      if (long) {
        const f = document.createElement('div');
        f.className = 'flash'; f.dataset.r = r;
        f.style.background = 'radial-gradient(circle, var(--rc), transparent 70%)';
        $('gen').appendChild(f);
        setTimeout(() => f.remove(), 800);
      }
      // Частицы из центра номера: чем реже номер, тем их больше.
      if (r >= 2) {
        const pl = stage.querySelector('.plate').getBoundingClientRect();
        const color = getComputedStyle(document.documentElement).getPropertyValue('--r' + r).trim();
        const cx = pl.left + pl.width / 2, cy = pl.top + pl.height / 2;
        window.FX.burst(cx, cy, color, [0, 0, 28, 60, 110][r], [0, 0, 0.8, 1.1, 1.4][r]);
        if (r === 4) setTimeout(() => window.FX.burst(cx, cy, '#ffffff', 40, 1.2), 180);
      }
      if (r >= 3) { haptic('heavy'); beep(660, 0.15); beep(990, 0.25, 0.05, 0.12); }
      else if (r === 2) { haptic('success'); beep(780, 0.12); }
      else if (r === 1) { haptic('light'); beep(700, 0.06, 0.04); }
      else haptic('light');
    };
    tick();
  }

  // ---------- экраны ----------
  const SCREENS = {
    gen() {
      const c = G.country();
      const types = c.kinds.filter((k) => G.kindUnlocked(k)).length;
      return `<div class="gen" id="gen">
        <div class="gen-glow" id="glow"></div>
        <div class="gen-road"></div>
        <canvas class="fx-canvas" id="fx"></canvas>
        <div class="gen-top">
          <button class="menu-btn" id="menu-btn" data-act="go" data-to="menu">${IC.menu}</button>
          <div class="balance">
            <div class="pill" id="pill-rub">${A.coin('rub')}<span></span></div>
            <div class="pill" id="pill-usd">${A.coin('usd')}<span></span></div>
          </div>
        </div>
        <div class="notes" id="notes"></div>
        <div class="stage" id="stage">${stageHTML(ui.last)}</div>
        <div class="gen-bottom">
          <button class="dock-btn" data-act="go" data-to="coll">${IC.coll}<span class="cnt" id="coll-cnt"></span></button>
          <button class="country-chip" data-act="go" data-to="gensettings"><i class="flag ${c.id}"></i>${c.name} <small>${types} тип</small></button>
          <button class="dock-btn" data-act="go" data-to="tasks">${IC.tasks}<i class="dot" id="tasks-dot"></i></button>
        </div>
      </div>`;
    },

    menu() {
      const card = (to, label, art, cls = '') => `<button class="mcard ${cls}" data-act="go" data-to="${to}"><div class="art">${art}</div><div class="lbl">${label}</div></button>`;
      const mini = (codes) => `<div class="mini-plates">${codes.map((c) => plateOf(c)).join('')}</div>`;
      return head('Меню') + `<div class="page">
        <div class="menu-grid">
          ${card('gen', 'Генератор', plateOf('cААА777|777'), 'wide')}
          ${card('tasks', 'Ежедневные задания', A.ART.tasks(), 'mid' + (bonusReady() ? ' glow' : ''))}
          ${card('coll', 'Коллекция', mini(['cАВЕ012|77', 'cКАО004|78', 'cМРР555|97']))}
          ${card('safe', 'Сейф', A.ART.safe())}
          ${card('auto', 'Автопродажа', A.ART.auto())}
          ${card('upgrades', 'Улучшения', A.ART.upgrades())}
          ${card('catalog', 'Каталог редкостей', mini(['tАА001|77', 'pА0102|99', 'mАВ0123|10']))}
          ${card('stats', 'Статистика', A.ART.stats())}
          ${card('theme', 'Тема', A.ART.theme())}
          ${card('settings', 'Настройки', A.ART.settings())}
        </div>
        <div class="soon-title">Скоро в игре</div>
        <p class="soon-sub">Эти разделы ещё в разработке — они откроются в следующих обновлениях</p>
        <div class="menu-grid">
          ${[['Магазин', 'shop'], ['Кейсы', 'cases'], ['Альбом', 'album'], ['Карта', 'map']].map(([n, a]) => `<div class="mcard soon"><div class="art">${A.ART[a]()}</div><div class="lbl">${n}</div></div>`).join('')}
        </div>
      </div>`;
    },

    gensettings() {
      const c = G.country();
      const shares = G.kindShares();
      const rows = c.kinds.map((k) => {
        const kind = P.KINDS[k];
        const unlocked = G.kindUnlocked(k);
        const on = unlocked && shares[k] != null;
        const right = unlocked
          ? `<b>${kind.name}</b><small>${on ? shares[k].toFixed(1).replace('.', ',') + '%' : 'Выключен'}</small>`
          : `<b class="muted">${kind.name}</b><small>${IC.lock} Закрыт</small>`;
        return `<button class="kind-row ${unlocked ? (on ? '' : 'off') : 'locked'}" data-act="kind" data-k="${k}">${plateOf(SAMPLE[k])}<div class="kmeta">${right}</div></button>`;
      }).join('');
      const parts = G.rollCostParts();
      const regions = G.regionList();
      const cur = G.region();
      const opts = ['<option value="">Все регионы</option>'].concat(regions.map((r) => `<option value="${esc(r.name)}" ${r.name === cur ? 'selected' : ''}>${esc(r.name)}</option>`)).join('');
      const unlockedCount = c.kinds.filter((k) => G.kindUnlocked(k)).length;
      return head('Настройка генерации') + `<div class="page" style="padding-bottom:${parts.reg ? 230 : 160}px">
        <button class="banner on" data-act="go" data-to="country"><i class="bflag ${c.id}"></i><span>${c.name}</span><small>${unlockedCount} / ${c.kinds.length}</small></button>
        <div class="section-label">Типы номеров</div>
        ${rows}
      </div>
      <div class="cost-panel">
        <div class="card">
          <div class="total"><span>Стоимость генерации</span><b>${rub(parts.total)}</b></div>
          ${parts.reg ? `<div class="line"><span>Базовая пошлина</span><span>${rub(G.ROLL_BASE)}</span></div>
          <div class="line"><span>Множитель региона</span><span>${mult(parts.reg.m)}</span></div>
          <div class="line"><span>Гарантия региона</span><span>${mult(G.REGION_GUARANTEE)}</span></div>` : ''}
        </div>
        <div class="btns">
          <button class="btn" data-act="go" data-to="country">Выбрать страну</button>
          <div class="select-wrap"><select data-change="region">${opts}</select></div>
        </div>
      </div>`;
    },

    country() {
      return head('Страна') + `<div class="page" style="display:grid;gap:8px">
        ${Object.values(P.COUNTRIES).sort((a, b) => a.name.localeCompare(b.name)).map((c) => {
          const n = c.kinds.filter((k) => G.kindUnlocked(k)).length;
          return `<button class="banner ${G.s.gen.country === c.id ? 'on' : ''}" data-act="country" data-c="${c.id}"><i class="bflag ${c.id}"></i><span>${c.name}</span><small>${n} / ${c.kinds.length}</small></button>`;
        }).join('')}
      </div>`;
    },

    coll() { return listScreen(false); },
    safe() { return listScreen(true); },

    upgrades() {
      const s = G.s;
      return head('Улучшения') + `<div class="page">
        <div class="card">
          <div class="row"><h3>Коллекция</h3><b>${s.coll.length} / ${G.collCap()}</b></div>
          <div class="bar"><i style="width:${Math.min(100, (100 * s.coll.length) / G.collCap())}%"></i></div>
          <p>Здесь хранятся выпавшие номера. Когда место кончится, прокрутить не получится, пока не продашь что-нибудь.</p>
          <button class="btn btn-blue btn-wide" style="margin-top:12px" data-act="upcoll" ${s.money < G.collUpCost() ? 'disabled' : ''}>Расширить до ${G.collCap() + 25} · ${rub(G.collUpCost())}</button>
        </div>
        <div class="card">
          <div class="row"><h3>Сейф</h3><b>${s.safe.length} / ${G.safeCap()}</b></div>
          <div class="bar"><i style="width:${Math.min(100, (100 * s.safe.length) / G.safeCap())}%"></i></div>
          <p>Номера в сейфе нельзя продать ни случайно, ни автопродажей.</p>
          <button class="btn btn-blue btn-wide" style="margin-top:12px" data-act="upsafe" ${s.usd < G.safeUpCost() ? 'disabled' : ''}>Расширить до ${G.safeCap() + 5} · ${usd(G.safeUpCost())}</button>
        </div>
        <button class="card row" style="width:100%;text-align:left;margin-top:10px" data-act="go" data-to="auto">
          <div><h3>Автопродажа</h3><p>${s.auto.lvl ? `Уровень ${s.auto.lvl} из ${G.AUTO_LEVELS.length}` : 'Не приобретено'}</p></div><span class="muted">${IC.chevron}</span>
        </button>
      </div>`;
    },

    auto() {
      const a = G.s.auto;
      const next = G.AUTO_LEVELS[a.lvl];
      const levels = G.AUTO_LEVELS.map((l, i) => `<li class="${i < a.lvl ? 'got' : i === a.lvl ? 'next' : ''}"><span class="n">${i < a.lvl ? IC.check : i + 1}</span><div>${l.name} · ${usd(l.cost)}<small>${l.desc}</small></div></li>`).join('');
      const btn = next
        ? `<button class="btn btn-blue btn-wide" data-act="autobuy" ${G.s.usd < next.cost ? 'disabled' : ''}>${a.lvl ? 'Открыть: ' + next.name : 'Открыть автопродажу'} · ${usd(next.cost)}</button>`
        : '<p style="text-align:center">Все уровни открыты</p>';
      const chip = (on, act, val, label, need) => `<button class="chip ${on ? 'on' : ''}" data-act="${act}" data-v="${val}" ${a.lvl < need ? 'disabled style="opacity:.35"' : ''}>${a.lvl < need ? IC.lock + ' ' : ''}${label}</button>`;
      const settings = a.lvl ? `<div class="card">
          <div class="toggle-row" style="padding:0;margin:0 0 10px;background:none"><h3 style="margin:0">Включена</h3><button class="toggle ${a.on ? 'on' : ''}" data-act="autoset" data-v="on">${a.on ? 'Вкл' : 'Выкл'}</button></div>
          <div class="field-label">Что продавать</div>
          <div class="chips">
            ${chip(a.tiers.includes('common'), 'autotier', 'common', 'Обычные', 1)}
            ${chip(a.tiers.includes('uncommon'), 'autotier', 'uncommon', 'Необычные', 4)}
            ${chip(a.tiers.includes('rare'), 'autotier', 'rare', 'Редкие', 8)}
            ${chip(a.special, 'autoset', 'special', 'Спецномера', 5)}
          </div>
          <div class="field-label">Сначала продавать</div>
          <div class="chips">
            ${chip(a.order === 'new', 'autoorder', 'new', 'Новые', 1)}
            ${chip(a.order === 'old', 'autoorder', 'old', 'Старые', 2)}
            ${chip(a.order === 'cheap', 'autoorder', 'cheap', 'Дешёвые', 7)}
          </div>
          <div class="field-label">Когда продавать (коллекция заполнена — всегда)</div>
          <div class="chips">
            ${chip(a.every, 'autoset', 'every', 'Каждая генерация', 6)}
            ${chip(a.money, 'autoset', 'money', 'Не хватает денег', 9)}
          </div>
          <div class="row" style="margin-top:6px"><span class="field-label" style="margin:0">${a.lvl < 3 ? IC.lock + ' ' : ''}Потолок цены</span>
            <input class="ceil-input" type="number" inputmode="numeric" min="0" placeholder="без потолка" value="${a.ceil || ''}" data-change="ceil" ${a.lvl < 3 ? 'disabled' : ''}></div>
        </div>` : '';
      return head('Автопродажа') + `<div class="page">
        <div class="card"><h3>Автопродажа</h3><p>Автоматически продаёт подходящие под фильтры номера из коллекции. Номера в сейфе защищены от автоматической продажи.</p></div>
        <div class="card"><p>Уровни</p><ul class="lvl-list">${levels}</ul>${btn}</div>
        ${settings}
      </div>`;
    },

    tasks() {
      G.ensureDaily();
      const d = G.s.daily;
      const cards = d.tasks.map((t, i) => {
        const prog = t.type === 'earn' ? `${fmt(t.progress)} / ${fmt(t.target)}` : `${t.progress} / ${t.target}`;
        const reward = t.hard ? A.coin('usd') + usd(G.TASK_REWARD_USD) : A.coin('rub') + rub(G.TASK_REWARD_RUB);
        const right = t.done ? `<span class="done-mark">${IC.check} Выполнено</span>`
          : t.replaced ? '' : `<button class="btn btn-sm" data-act="replace" data-i="${i}">${IC.play} Заменить</button>`;
        return `<div class="card task ${t.done ? 'done' : ''}">
          ${t.hard ? '<span class="badge">СЛОЖНОЕ</span>' : ''}
          <div class="row"><h3>${G.taskTitle(t)}</h3><b>${prog}</b></div>
          ${G.taskHint(t) ? `<p>${G.taskHint(t)}</p>` : ''}
          <div class="bar"><i style="width:${(100 * t.progress) / t.target}%"></i></div>
          <div class="row"><div class="reward ${t.hard ? 'inline' : ''}">Награда: <b>${reward}</b></div>${right}</div>
        </div>`;
      }).join('');
      const can = G.allTasksDone() && !d.bonus;
      const bonus = `<div class="card"><h3>Бонус за все задания</h3><p>${d.bonus ? 'Бонус получен ✓' : 'Выполни все задания — получи бонус'}</p>
        <div class="modal-btns"><button class="btn btn-blue" data-act="bonus" data-v="usd" ${can ? '' : 'disabled'}>${usd(G.BONUS.usd)}</button>
        <button class="btn btn-blue" data-act="bonus" data-v="rub" ${can ? '' : 'disabled'}>${rub(G.BONUS.rub)}</button></div></div>`;
      return head('Задания') + `<div class="page"><div class="timer" id="task-timer">${timerText()}</div>${cards}${bonus}</div>`;
    },

    catalog() {
      const c = ui.cat;
      const country = P.COUNTRIES[c.country];
      const kind = P.KINDS[c.kind];
      const regions = P.REGION_SETS[kind.regions];
      if (!regions.find((r) => r.name === c.region)) c.region = regions.reduce((m, r) => (r.m > m.m ? r : m)).name;
      const sel = (name, opts, value) => `<div class="select-wrap"><select data-change="${name}">${opts.map(([v, t]) => `<option value="${esc(v)}" ${v === value ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></div>`;
      const ex = catalogExamples(c.kind, c.region);
      const cards = P.RARITIES.map((r, i) => {
        const x = ex[i];
        return `<button class="cat-card" data-r="${i}" ${x ? `data-act="catdetail" data-code="${esc(x.code)}"` : ''}>
          <div class="pl">${x ? plateOf(x.code) : plateOf(SAMPLE[c.kind])}</div>
          <div class="info"><div class="rl"><div class="rname">${r.name}</div>${segs(i)}</div>
          <div class="chance">${P.CHANCES[c.kind][i].toFixed(2).replace('.', ',')}%</div>
          <div class="from">${x ? rub(x.min) + '+' : '—'}</div></div>
        </button>`;
      }).join('');
      return head('Каталог редкостей') + `<div class="page">
        <div class="selects">
          ${sel('catcountry', Object.values(P.COUNTRIES).map((x) => [x.id, x.name]), c.country)}
          ${sel('catkind', country.kinds.map((k) => [k, P.KINDS[k].name]), c.kind)}
          ${sel('catregion', regions.map((r) => [r.name, r.name]), c.region)}
        </div>
        ${cards}
        <div class="foot">Шанс одинаков в любом регионе — меняются только цены. Нажмите на карточку для подробностей</div>
      </div>`;
    },

    stats() {
      const st = ui.statsTab === 'all' ? G.s.stats : G.session;
      const maxR = Math.max(1, ...st.rar);
      const combos = Object.entries(st.combos).sort((a, b) => b[1] - a[1]);
      const kinds = Object.entries(st.kinds).sort((a, b) => b[1] - a[1]);
      return head('Статистика') + `<div class="page">
        <div class="chips">
          <button class="chip ${ui.statsTab === 'all' ? 'on' : ''}" data-act="statstab" data-v="all">Общая</button>
          <button class="chip ${ui.statsTab === 'session' ? 'on' : ''}" data-act="statstab" data-v="session">За сессию</button>
        </div>
        <div class="card level-card"><div class="level-badge">${G.s.level}</div><div class="grow">
          <div class="row"><b>Уровень ${G.s.level}</b><span class="muted">${fmt(G.s.xp)} / ${fmt(G.levelNeed())} XP</span></div>
          <div class="bar" style="margin-bottom:0"><i style="width:${(100 * G.s.xp) / G.levelNeed()}%"></i></div></div></div>
        <div class="tiles">
          <div class="tile"><b>${fmt(st.total)}</b><small>Всего сгенерировано</small></div>
          <div class="tile"><b>${rub(st.bestPrice)}</b><small>Самый дорогой номер</small></div>
        </div>
        ${P.RARITIES.map((r, i) => `<div class="rbar" data-r="${i}"><span>${r.name}</span><div class="bar"><i style="width:${(100 * st.rar[i]) / maxR}%"></i></div><span>${fmt(st.rar[i])}</span></div>`).join('')}
        <div style="margin-top:12px">
          ${combos.map(([id, n]) => `<div class="kv"><span>${P.COMBOS[id]}</span><b>${fmt(n)}</b></div>`).join('')}
          ${kinds.map(([id, n]) => `<div class="kv"><span>${P.KINDS[id].name}${id === 'b' ? ' (Беларусь)' : ''}</span><b>${fmt(n)}</b></div>`).join('')}
          <div class="kv"><span>Продано номеров</span><b>${fmt(st.sold)}</b></div>
          <div class="kv"><span>Заработано на продаже</span><b>${rub(st.earned)}</b></div>
        </div>
      </div>`;
    },

    theme() {
      const looks = {
        dark: ['#1f2128', '#eceef3'], light: ['#ffffff', '#17181c'], pink: ['#f4b6d2', '#3a1426'],
        gold: ['#b8891c', '#1c1505'], silver: ['#5d636e', '#f1f3f6'],
      };
      return head('Тема') + `<div class="page">
        ${G.THEMES.map((th) => {
          const ok = G.themeUnlocked(th);
          const [bg, fg] = looks[th.id];
          return `<button class="theme-card ${G.s.theme === th.id ? 'on' : ''} ${ok ? '' : 'locked'}" style="background:${bg};color:${fg}" data-act="theme" data-v="${th.id}">
            <b>${th.name}</b>${ok ? '<i class="dot"></i>' : ''}
            <div class="sw"><i style="background:${fg};opacity:.5"></i><i style="background:var(--r1)"></i><i style="background:var(--r2)"></i><i style="background:var(--r3)"></i><i style="background:var(--r4)"></i></div>
            ${ok ? '' : `<span class="lock">${IC.lock} ${th.lock}</span>`}
          </button>`;
        }).join('')}
      </div>`;
    },

    settings() {
      const t = (key, label) => `<div class="toggle-row"><span>${label}</span><button class="toggle ${G.s.set[key] ? 'on' : ''}" data-act="set" data-v="${key}">${G.s.set[key] ? 'Вкл' : 'Выкл'}</button></div>`;
      return head('Настройки') + `<div class="page">
        ${t('sound', 'Звук')}
        ${t('vibro', 'Вибрация')}
        ${t('showSold', 'Показывать проданные автопродажей')}
        ${t('skipEpic', 'Пропускать анимацию эпических')}
        ${t('skipLegendary', 'Пропускать анимацию легендарных')}
        <button class="btn btn-red btn-wide" style="margin-top:8px" data-act="reset">Сбросить прогресс</button>
      </div>`;
    },
  };

  // ---------- коллекция и сейф ----------
  function sortedList(list) {
    const { by, dir } = ui.sort;
    const key = (x) => {
      const e = G.ev(x.c);
      if (by === 'price') return e.price;
      if (by === 'rarity') return ri(e) * 1e12 + e.price;
      return x.t + x.id / 1e6;
    };
    return [...list].sort((a, b) => (key(a) - key(b)) * dir);
  }
  function rowHTML(x) {
    const e = G.ev(x.c);
    return `<button class="prow ${ui.sel.has(x.id) ? 'sel' : ''}" data-r="${ri(e)}" data-act="item" data-id="${x.id}">
      ${plateOf(x.c)}
      <div class="meta"><small>${countryName(e.kind.country)} · ${e.kind.name}</small>${segs(ri(e))}<b>${rub(e.price)}</b></div>
    </button>`;
  }
  function filterActive() { const f = ui.filter; return f.country !== 'all' || f.kind !== 'all' || f.rar.length > 0; }

  function listScreen(isSafe) {
    const all = isSafe ? G.s.safe : G.s.coll;
    const list = sortedList(G.filter(all, ui.filter));
    const cap = isSafe ? G.safeCap() : G.collCap();
    const right = `<div class="head-right"><b>${rub(G.s.money)}</b><br>${all.length} / ${cap}<br>Стоимость коллекции ${rub(G.collValue(all))}</div>`;
    const arrow = (by) => (ui.sort.by === by ? (ui.sort.dir < 0 ? ' ▼' : ' ▲') : '');
    const chips = `<div class="chips">
      <button class="chip ${filterActive() ? 'on' : ''}" data-act="filters">Фильтры</button>
      <button class="chip ${ui.sort.by === 'date' ? 'on' : ''}" data-act="sort" data-v="date">Дата${arrow('date')}</button>
      <button class="chip ${ui.sort.by === 'price' ? 'on' : ''}" data-act="sort" data-v="price">Цена${arrow('price')}</button>
      <button class="chip ${ui.sort.by === 'rarity' ? 'on' : ''}" data-act="sort" data-v="rarity">Редкость${arrow('rarity')}</button>
    </div>`;
    const body = list.length ? `<div class="plist">${list.map(rowHTML).join('')}</div>`
      : `<div class="empty">${isSafe ? 'В сейфе пока пусто' : all.length ? 'Ничего не найдено' : 'Коллекция пуста — крути номера!'}</div>`;
    const bar = isSafe ? '' : `<div class="bottom-bar">
      <button class="btn" data-act="selall">${ui.sel.size ? 'Снять выбор' : 'Выбрать всё'}</button>
      <button class="btn" data-act="selsafe" ${ui.sel.size ? '' : 'disabled'}>Поместить в сейф</button>
      ${ui.sel.size ? `<button class="btn btn-red" data-act="selsell">Продать (${ui.sel.size})</button>` : '<button class="btn" data-act="quicksell">Быстрая продажа</button>'}
    </div>`;
    return head(isSafe ? 'Сейф' : 'Коллекция', right) + `<div class="page ${isSafe ? '' : 'has-bar'}">${chips}${body}</div>${bar}`;
  }

  // ---------- окна ----------
  // Своё окно подтверждения: стандартный confirm() в Telegram и встроенных браузерах
  // часто не показывается и сразу отвечает «нет».
  function confirmBox(text, okLabel = 'Да') {
    const root = $('confirm-root');
    return new Promise((resolve) => {
      root.innerHTML = `<div class="modal-bg confirm-bg"><div class="modal"><div class="modal-body">
        <h3 style="margin:6px 0 4px">${esc(text)}</h3>
        <div class="modal-btns"><button class="btn" data-c="no">Отмена</button><button class="btn btn-red" data-c="yes">${esc(okLabel)}</button></div>
      </div></div></div>`;
      root.onclick = (e) => {
        const b = e.target.closest('[data-c]');
        if (!b && !e.target.classList.contains('confirm-bg')) return;
        e.stopPropagation();
        root.innerHTML = '';
        root.onclick = null;
        resolve(!!b && b.dataset.c === 'yes');
      };
    });
  }

  function openModal(html, onClick) {
    modalRoot.innerHTML = `<div class="modal-bg" id="modal-bg">${html}</div>`;
    Pf.setBack(back);
    $('modal-bg').addEventListener('click', (e) => { if (e.target.id === 'modal-bg') closeModal(); });
    modalRoot.onclick = onClick || null;
  }
  function closeModal() {
    modalRoot.innerHTML = '';
    modalRoot.onclick = null;
    Pf.setBack(ui.stack.length > 1 ? back : null);
  }

  function detailHTML(code, buttons = '') {
    const e = G.ev(code);
    const p = P.decode(code);
    const combos = e.combos.length ? `<div class="dline"><span>Комбинации</span></div>${e.combos.map((c) => `<div class="dline sub"><span>${esc(c.name)}</span><b>+${rub(c.bonus)}</b></div>`).join('')}` : '';
    return `<div class="modal" data-r="${ri(e)}">
      <div class="detail-top">${ri(e) >= 3 ? '<div class="rays"></div>' : ''}${plateHTML(p, 'reveal')}${segs(ri(e))}<div class="rname">${e.rarity.name}</div></div>
      <div class="modal-body">
        <h3>${e.kind.name}</h3>
        <div class="dsub">${countryName(e.kind.country)} · ${p.r} · ${esc(e.region.name)}</div>
        <div class="dline"><span>Базовая стоимость</span><b>${rub(e.kind.base)}</b></div>
        ${combos}
        <div class="mults">
          <div>комбо<b>${mult(e.comboMult)}</b></div><div>регион<b>${mult(e.regionMult)}</b></div>
          <div>код<b>${mult(e.codeMult)}</b></div><div>класс<b>${mult(e.classMult)}</b></div>
        </div>
        <div class="dline total"><span>Цена номера</span><b>${rub(e.price)}</b></div>
        ${buttons}
      </div>
    </div>`;
  }

  function openItem(id) {
    const f = G.find(id);
    if (!f) return;
    const x = f.list[f.i];
    const btns = `<div class="modal-btns">
      <button class="btn" data-m="${f.inSafe ? 'unsafe' : 'tosafe'}">${f.inSafe ? 'Из сейфа' : 'В сейф'}</button>
      <button class="btn btn-red" data-m="sell" ${f.inSafe ? 'disabled' : ''}>Продать</button>
    </div>`;
    openModal(detailHTML(x.c, btns), (e) => {
      const b = e.target.closest('[data-m]');
      if (!b) return;
      const act = b.dataset.m;
      if (act === 'sell') { const p = G.sell(id); haptic('light'); beep(880, 0.05); toast(`Продано за ${rub(p)}`); }
      if (act === 'tosafe') { if (G.toSafe(id)) toast('Номер в сейфе'); else { toast('Сейф заполнен'); return; } }
      if (act === 'unsafe') { if (G.fromSafe(id)) toast('Номер возвращён в коллекцию'); else { toast('Коллекция заполнена'); return; } }
      closeModal(); render(); save();
    });
  }

  // Окно с фильтрами (страна, тип, редкость). mode: 'filter' или 'quicksell'.
  function filterModal(mode) {
    const f = mode === 'filter' ? ui.filter : ui.qs;
    const draw = () => {
      const kinds = f.country === 'all' ? Object.keys(P.KINDS) : P.COUNTRIES[f.country].kinds;
      if (f.kind !== 'all' && !kinds.includes(f.kind)) f.kind = 'all';
      const base = G.filter(G.s.coll, { country: f.country, kind: f.kind });
      const counts = P.RARITIES.map((r) => base.filter((x) => G.ev(x.c).rarity.id === r.id).length);
      const opt = (v, t, cur) => `<option value="${v}" ${v === cur ? 'selected' : ''}>${t}</option>`;
      const chosen = G.filter(G.s.coll, f);
      const summary = mode === 'quicksell' ? `<div class="dline"><b>На продажу: ${chosen.length}</b></div><div class="dline"><b>Цена — ${rub(G.collValue(chosen))}</b></div>` : '';
      return `<div class="modal"><div class="modal-body">
        <h3>${mode === 'filter' ? 'Фильтры' : 'Быстрая продажа'}</h3>
        ${mode === 'quicksell' ? '<p class="muted" style="text-align:center;font-size:12px;margin:0">Выбери, что продать. Если в строке ничего не выбрано — подходит любое. Сейф не трогается.</p>' : ''}
        <div class="field-label">Страна</div>
        <div class="select-wrap"><select data-f="country">${opt('all', 'Все страны', f.country)}${Object.values(P.COUNTRIES).map((c) => opt(c.id, c.name, f.country)).join('')}</select></div>
        <div class="field-label">Тип номера</div>
        <div class="select-wrap"><select data-f="kind">${opt('all', 'Все типы', f.kind)}${kinds.map((k) => opt(k, P.KINDS[k].name + (k === 'b' ? ' (BY)' : ''), f.kind)).join('')}</select></div>
        <div class="field-label">Редкость</div>
        <div class="rar-pick">${P.RARITIES.map((r, i) => `<button data-r="${i}" data-rar="${r.id}" class="${f.rar.includes(r.id) ? 'on' : ''}"><i></i><b>${counts[i]}</b></button>`).join('')}</div>
        <div style="margin-top:12px">${summary}</div>
        <div class="modal-btns">
          <button class="btn" data-m="reset">Сбросить</button>
          ${mode === 'filter' ? '<button class="btn btn-blue" data-m="done">Готово</button>' : `<button class="btn btn-red" data-m="sell" ${chosen.length ? '' : 'disabled'}>Продать</button>`}
        </div>
      </div></div>`;
    };
    const redraw = () => { $('modal-bg').innerHTML = draw(); bindSelects(); };
    const bindSelects = () => {
      modalRoot.querySelectorAll('select[data-f]').forEach((s) => s.addEventListener('change', () => { f[s.dataset.f] = s.value; redraw(); }));
    };
    openModal(draw(), async (e) => {
      const rb = e.target.closest('[data-rar]');
      if (rb) {
        const id = rb.dataset.rar;
        f.rar = f.rar.includes(id) ? f.rar.filter((x) => x !== id) : [...f.rar, id];
        redraw(); return;
      }
      const b = e.target.closest('[data-m]');
      if (!b) return;
      if (b.dataset.m === 'reset') { f.country = 'all'; f.kind = 'all'; f.rar = []; redraw(); return; }
      if (b.dataset.m === 'done') { closeModal(); render(); return; }
      if (b.dataset.m === 'sell') {
        const chosen = G.filter(G.s.coll, f);
        if (!(await confirmBox(`Продать ${chosen.length} шт. за ${rub(G.collValue(chosen))}?`, 'Продать'))) return;
        const { count, total } = G.sellMany(chosen.map((x) => x.id));
        haptic('success'); beep(880, 0.08);
        toast(`Продано ${count} шт. за ${rub(total)}`);
        closeModal(); render(); save();
      }
    });
    bindSelects();
  }

  // ---------- каталог: примеры номеров ----------
  const catCache = new Map();
  function catalogExamples(kind, regionName) {
    const key = kind + ':' + regionName;
    if (catCache.has(key)) return catCache.get(key);
    const found = [[], [], [], [], []];
    const want = [40, 40, 25, 8, 3];
    for (let i = 0; i < 400000; i++) {
      const p = P.random(kind, regionName);
      const e = P.evaluate(p);
      const r = ri(e);
      if (found[r].length < want[r]) found[r].push({ code: P.encode(p), price: e.price });
      if (found.every((f, j) => f.length >= want[j])) break;
    }
    const res = found.map((list) => {
      if (!list.length) return null;
      const min = list.reduce((m, x) => (x.price < m.price ? x : m));
      return { code: min.code, min: min.price };
    });
    catCache.set(key, res);
    return res;
  }

  // ---------- нажатия ----------
  const ACTIONS = {
    back,
    go: (b) => go(b.dataset.to),
    kind(b) {
      const k = b.dataset.k;
      if (!G.kindUnlocked(k)) {
        const kind = P.KINDS[k];
        toast(`Откроется за ${fmt(kind.unlock)} номеров (${countryName(kind.country)})`);
        return;
      }
      G.toggleKind(k); render(); save();
    },
    country(b) { G.s.gen.country = b.dataset.c; ui.last = null; back(); save(); },
    item(b) {
      const id = +b.dataset.id;
      if (ui.sel.size && cur() === 'coll') {
        if (ui.sel.has(id)) ui.sel.delete(id); else ui.sel.add(id);
        render(); return;
      }
      openItem(id);
    },
    sort(b) {
      const by = b.dataset.v;
      if (ui.sort.by === by) ui.sort.dir *= -1; else ui.sort = { by, dir: -1 };
      render();
    },
    filters: () => filterModal('filter'),
    quicksell: () => filterModal('quicksell'),
    selall() {
      if (ui.sel.size) ui.sel.clear();
      else for (const x of G.filter(G.s.coll, ui.filter)) ui.sel.add(x.id);
      render();
    },
    selsafe() {
      let moved = 0;
      for (const id of ui.sel) if (G.toSafe(id)) moved++;
      toast(moved < ui.sel.size ? `В сейф: ${moved}. Сейф заполнен` : `В сейф: ${moved}`);
      ui.sel.clear(); render(); save();
    },
    async selsell() {
      const ids = [...ui.sel];
      const total = ids.reduce((s, id) => { const f = G.find(id); return s + (f ? G.ev(f.list[f.i].c).price : 0); }, 0);
      if (!(await confirmBox(`Продать ${ids.length} шт. за ${rub(total)}?`, 'Продать'))) return;
      const r = G.sellMany(ids);
      haptic('success'); toast(`Продано ${r.count} шт. за ${rub(r.total)}`);
      ui.sel.clear(); render(); save();
    },
    upcoll() { if (G.upColl()) { haptic('success'); toast('Коллекция расширена'); } render(); save(); },
    upsafe() { if (G.upSafe()) { haptic('success'); toast('Сейф расширен'); } render(); save(); },
    autobuy() { if (G.buyAutoLevel()) { haptic('success'); toast('Открыто: ' + G.AUTO_LEVELS[G.s.auto.lvl - 1].name); } render(); save(); },
    autoset(b) { const k = b.dataset.v; G.s.auto[k] = !G.s.auto[k]; render(); save(); },
    autotier(b) {
      const t = b.dataset.v, a = G.s.auto;
      a.tiers = a.tiers.includes(t) ? a.tiers.filter((x) => x !== t) : [...a.tiers, t];
      render(); save();
    },
    autoorder(b) { G.s.auto.order = b.dataset.v; render(); save(); },
    async replace(b) {
      if (!(await Pf.rewardedAd())) return;
      if (G.replaceTask(+b.dataset.i)) { haptic('light'); render(); save(); }
    },
    bonus(b) {
      if (G.claimBonus(b.dataset.v)) { haptic('success'); beep(990, 0.2); toast('Бонус получен!'); }
      render(); save();
    },
    catdetail(b) { openModal(detailHTML(b.dataset.code)); },
    statstab(b) { ui.statsTab = b.dataset.v; render(); },
    theme(b) {
      const th = G.THEMES.find((t) => t.id === b.dataset.v);
      if (!G.themeUnlocked(th)) { toast(th.lock); return; }
      G.s.theme = th.id; applyTheme(); render(); save();
    },
    set(b) { const k = b.dataset.v; G.s.set[k] = !G.s.set[k]; render(); save(); },
    async reset() {
      if (!(await confirmBox('Точно сбросить прогресс? Все номера и деньги пропадут.', 'Сбросить'))) return;
      G.reset(); ui.last = null; ui.stack = ['gen']; applyTheme(); render(); save();
    },
  };

  document.addEventListener('click', (e) => {
    if (modalRoot.contains(e.target) || $('confirm-root').contains(e.target)) return;
    const b = e.target.closest('[data-act]');
    if (!b || b.disabled) return;
    const fn = ACTIONS[b.dataset.act];
    if (fn) { haptic('select'); fn(b); }
  });

  document.addEventListener('change', (e) => {
    const el = e.target;
    const k = el.dataset && el.dataset.change;
    if (!k) return;
    if (k === 'region') { G.s.gen.region[G.s.gen.country] = el.value || null; render(); save(); }
    if (k === 'ceil') { G.s.auto.ceil = Math.max(0, parseInt(el.value, 10) || 0); save(); }
    if (k === 'catcountry') { ui.cat.country = el.value; ui.cat.kind = P.COUNTRIES[el.value].kinds[0]; render(); }
    if (k === 'catkind') { ui.cat.kind = el.value; render(); }
    if (k === 'catregion') { ui.cat.region = el.value; render(); }
  });

  // На главном экране номер выпадает от нажатия в любом месте (кроме кнопок).
  document.addEventListener('pointerdown', (e) => {
    if (cur() !== 'gen' || modalRoot.innerHTML || e.button > 0) return;
    if (e.target.closest('button, a, select')) return;
    doRoll(e.clientX, e.clientY);
  });

  // ---------- тема, таймеры, сохранение ----------
  function applyTheme() {
    document.documentElement.dataset.theme = G.s.theme;
    const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
    if (bg) Pf.setColors(bg);
  }
  function timerText() {
    const ms = G.msToNewTasks();
    const h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, s = Math.floor(ms / 1000) % 60;
    return `Новые задания через ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  let saveTimer = null;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => Pf.save(G.toSave()), 400);
  }

  async function start() {
    Pf.init();
    G.load(await Pf.load());
    applyTheme();
    render();
    setInterval(() => {
      const day = G.s.daily && G.s.daily.day;
      G.ensureDaily();
      if (cur() === 'tasks') {
        if (G.s.daily.day !== day) render();
        else { const t = $('task-timer'); if (t) t.textContent = timerText(); }
      }
    }, 1000);
    setInterval(() => Pf.save(G.toSave()), 15000);
    document.addEventListener('visibilitychange', () => { if (document.hidden) Pf.save(G.toSave()); });
  }

  start();
})();
