// Векторная графика: иконки и иллюстрации для меню. Всё рисуется SVG прямо в коде,
// поэтому не нужно грузить картинки и всё остаётся чётким на любом экране.
(function () {
  const svg = (vb, body, cls = '') => `<svg class="${cls}" viewBox="${vb}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${body}</svg>`;
  let uid = 0;
  const id = (p) => p + (++uid);

  const ICONS = {
    menu: svg('0 0 24 24', '<path d="M4 7h16M4 12h16M4 17h10" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" fill="none"/>', 'ic'),
    back: svg('0 0 24 24', '<path d="M15 5l-7 7 7 7" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" fill="none"/>', 'ic'),
    lock: svg('0 0 24 24', '<rect x="5" y="10.5" width="14" height="10" rx="2.5" fill="currentColor"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" stroke="currentColor" stroke-width="2.2" fill="none"/>', 'ic ic-sm'),
    unlock: svg('0 0 24 24', '<rect x="5" y="10.5" width="14" height="10" rx="2.5" fill="currentColor"/><path d="M8 10.5V8a4 4 0 0 1 7.6-1.8" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round"/>', 'ic'),
    chevron: svg('0 0 24 24', '<path d="M9 5l7 7-7 7" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" fill="none"/>', 'ic ic-sm'),
    check: svg('0 0 24 24', '<path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" fill="none"/>', 'ic ic-sm'),
    play: svg('0 0 24 24', '<path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/>', 'ic ic-sm'),
    warn: svg('0 0 24 24', '<path d="M12 3l10 18H2z" fill="currentColor"/><path d="M12 10v5M12 17.6v.4" stroke="#000" stroke-opacity=".55" stroke-width="2.2" stroke-linecap="round"/>', 'ic ic-sm'),
    coll: svg('0 0 24 24', '<rect x="3" y="9" width="18" height="8" rx="1.6" fill="none" stroke="currentColor" stroke-width="2"/><path d="M5 6h14M7 3.5h10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M7 13h6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>', 'ic'),
    tasks: svg('0 0 24 24', '<rect x="4.5" y="3.5" width="15" height="17" rx="2.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 9l1.6 1.6L12.5 7.7M8 15l1.6 1.6 2.9-2.9M14.5 9.2H16.5M14.5 15.2H16.5" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" fill="none"/>', 'ic'),
  };

  // Монетки для балансов.
  function coin(kind) {
    const g = id('cg');
    const [a, b, c] = kind === 'usd' ? ['#7ef0a8', '#22b464', '#0f6b3a'] : ['#ffe08a', '#f5a524', '#a8620a'];
    const sign = kind === 'usd' ? '$' : '₽';
    return svg('0 0 24 24', `<defs><linearGradient id="${g}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset=".6" stop-color="${b}"/><stop offset="1" stop-color="${c}"/></linearGradient></defs>
      <circle cx="12" cy="12" r="10.5" fill="url(#${g})"/><circle cx="12" cy="12" r="8" fill="none" stroke="#fff" stroke-opacity=".45" stroke-width="1"/>
      <text x="12" y="16.3" text-anchor="middle" font-family="Manrope, Arial" font-weight="800" font-size="12" fill="${c}">${sign}</text>`, 'coin');
  }

  // ---------- иллюстрации меню (viewBox 160×90) ----------
  const ART = {
    tasks() {
      const g = id('tg');
      return svg('0 0 160 90', `<defs><linearGradient id="${g}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#dfe6f5"/></linearGradient></defs>
        <g transform="rotate(-6 80 45)">
          <rect x="44" y="10" width="72" height="80" rx="6" fill="url(#${g})"/>
          ${[0, 1, 2, 3, 4, 5].map((i) => `<circle cx="${52 + i * 11.5}" cy="10" r="3.2" fill="#2a3a66"/><rect x="${51 + i * 11.5}" y="3" width="2.2" height="9" rx="1.1" fill="#9aa6c4"/>`).join('')}
          <rect x="54" y="24" width="10" height="10" rx="2" fill="none" stroke="#2f5bd8" stroke-width="2"/><path d="M56 29l2.6 2.6 5-6" stroke="#2f5bd8" stroke-width="2.4" fill="none" stroke-linecap="round"/>
          <text x="70" y="33" font-family="Roboto Condensed, Arial" font-size="12" fill="#2f5bd8" font-style="italic">А***АА</text>
          <rect x="54" y="44" width="10" height="10" rx="2" fill="none" stroke="#2f5bd8" stroke-width="2"/>
          <text x="70" y="53" font-family="Roboto Condensed, Arial" font-size="12" fill="#2f5bd8" font-style="italic">*777**</text>
          <rect x="54" y="64" width="10" height="10" rx="2" fill="none" stroke="#9aa6c4" stroke-width="2"/>
          <rect x="70" y="67" width="34" height="4" rx="2" fill="#c7d0e6"/>
        </g>`, 'art');
    },
    safe() {
      const g = id('sg'), h = id('sh');
      return svg('0 0 160 90', `<defs>
          <linearGradient id="${g}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8d9bb8"/><stop offset=".5" stop-color="#4b5874"/><stop offset="1" stop-color="#262e40"/></linearGradient>
          <radialGradient id="${h}" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#e9eef8"/><stop offset="1" stop-color="#7d8aa6"/></radialGradient></defs>
        <rect x="40" y="10" width="80" height="72" rx="8" fill="url(#${g})"/>
        <rect x="46" y="16" width="68" height="60" rx="5" fill="none" stroke="#c9d3e8" stroke-opacity=".35" stroke-width="1.5"/>
        <circle cx="80" cy="46" r="17" fill="#1b2232" stroke="#9fb0d0" stroke-width="2.5"/>
        <circle cx="80" cy="46" r="11" fill="url(#${h})"/>
        ${[0, 60, 120, 180, 240, 300].map((a) => `<rect x="79" y="26" width="2" height="6" rx="1" fill="#c9d3e8" transform="rotate(${a} 80 46)"/>`).join('')}
        <path d="M80 39v7l5 4" stroke="#2b3550" stroke-width="2.6" stroke-linecap="round" fill="none"/>
        <rect x="44" y="30" width="5" height="12" rx="2" fill="#c9d3e8"/><rect x="44" y="52" width="5" height="12" rx="2" fill="#c9d3e8"/>
        <rect x="46" y="82" width="10" height="5" rx="1.5" fill="#1b2232"/><rect x="104" y="82" width="10" height="5" rx="1.5" fill="#1b2232"/>`, 'art');
    },
    auto() {
      const g = id('ag');
      return svg('0 0 160 90', `<defs><linearGradient id="${g}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#58e08f"/><stop offset="1" stop-color="#1c9a56"/></linearGradient></defs>
        <rect x="14" y="62" width="132" height="10" rx="5" fill="#16203a" stroke="#4a6bb8" stroke-width="1.5"/>
        ${[0, 1, 2, 3, 4, 5, 6].map((i) => `<circle cx="${24 + i * 19}" cy="67" r="3" fill="#4a6bb8"/>`).join('')}
        <g transform="translate(22 36) rotate(-4)"><rect width="58" height="16" rx="2.5" fill="#f4f4f2" stroke="#111" stroke-width="1.6"/>
          <text x="5" y="12.5" font-family="Roboto Condensed, Arial" font-size="12" fill="#111">Е123ВК</text><line x1="45" y1="1" x2="45" y2="15" stroke="#111" stroke-width="1.2"/><text x="47" y="11" font-family="Roboto Condensed, Arial" font-size="8" fill="#111">77</text></g>
        <path d="M86 44h14l-4-4M100 44l-4 4" stroke="#8fb0ff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
        <g transform="translate(108 18)">
          <rect x="0" y="22" width="34" height="18" rx="3" fill="url(#${g})"/><rect x="3" y="14" width="34" height="18" rx="3" fill="url(#${g})" opacity=".85"/>
          <rect x="6" y="6" width="34" height="18" rx="3" fill="url(#${g})"/><circle cx="23" cy="15" r="5" fill="none" stroke="#e8fff0" stroke-width="1.6"/>
          <text x="23" y="18" text-anchor="middle" font-family="Manrope, Arial" font-weight="800" font-size="8" fill="#e8fff0">₽</text></g>`, 'art');
    },
    upgrades() {
      return svg('0 0 160 90', `
        <rect x="26" y="12" width="70" height="66" rx="5" fill="#16203a" stroke="#4a6bb8" stroke-width="1.5"/>
        ${[0, 1, 2, 3, 4].map((r) => [0, 1].map((c) => `<rect x="${31 + c * 32}" y="${17 + r * 12}" width="28" height="8" rx="1.5" fill="#f4f4f2" opacity="${r < 3 || c === 0 ? 0.92 : 0.25}"/><rect x="${33 + c * 32}" y="${19.5 + r * 12}" width="14" height="3" rx="1" fill="#26314d" opacity="${r < 3 || c === 0 ? 0.6 : 0.2}"/>`).join('')).join('')}
        <rect x="104" y="20" width="36" height="50" rx="6" fill="#1d2b55" stroke="#5c86ff" stroke-width="1.6" stroke-dasharray="4 3"/>
        <circle cx="122" cy="45" r="11" fill="#3a6dff"/><path d="M122 39v12M116 45h12" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/>`, 'art');
    },
    stats() {
      const cols = ['#a4abbd', '#3ddc84', '#3d8bff', '#b05cff', '#ffb627'];
      const hs = [58, 46, 32, 20, 12];
      return svg('0 0 160 90', `
        <path d="M22 80h120" stroke="#4a6bb8" stroke-width="1.5"/>
        ${hs.map((h, i) => `<g transform="translate(${28 + i * 23} ${80 - h})">
          <rect width="18" height="${h}" rx="3" fill="#e9edf6"/>
          ${Array.from({ length: Math.floor(h / 6) }, (_, j) => `<rect x="2.5" y="${3 + j * 6}" width="13" height="3" rx="1" fill="#26314d" opacity=".35"/>`).join('')}
          <rect y="${h - 5}" width="18" height="5" rx="2" fill="${cols[i]}"/></g>`).join('')}`, 'art');
    },
    theme() {
      const cols = ['#2a2f3a', '#f2f3f6', '#f4a6c8', '#c9a227', '#9aa3b2'];
      return svg('0 0 160 90', `
        ${cols.map((c, i) => `<g transform="rotate(${-40 + i * 20} 80 92)"><rect x="70" y="14" width="20" height="78" rx="6" fill="${c}" stroke="#000" stroke-opacity=".25"/><circle cx="80" cy="24" r="3" fill="#000" opacity=".2"/></g>`).join('')}
        <circle cx="80" cy="84" r="5" fill="#11182a" stroke="#8fa6dd" stroke-width="1.5"/>`, 'art');
    },
    settings() {
      const g = id('gg');
      const teeth = Array.from({ length: 10 }, (_, i) => `<rect x="76" y="14" width="8" height="12" rx="2" transform="rotate(${i * 36} 80 46)"/>`).join('');
      return svg('0 0 160 90', `<defs><linearGradient id="${g}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#c9d4ec"/><stop offset="1" stop-color="#55627f"/></linearGradient></defs>
        <g fill="url(#${g})">${teeth}<circle cx="80" cy="46" r="25"/></g>
        <circle cx="80" cy="46" r="10" fill="#141c30" stroke="#8fa6dd" stroke-width="2"/>
        <g transform="translate(116 22) scale(.55)" fill="url(#${g})" opacity=".8">${teeth}<circle cx="80" cy="46" r="25"/></g>`, 'art');
    },
    shop: () => svg('0 0 160 90', '<path d="M56 30h48l-5 46H61z" fill="currentColor" opacity=".35"/><path d="M68 34v-8a12 12 0 0 1 24 0v8" stroke="currentColor" stroke-width="3" fill="none" opacity=".45"/>', 'art'),
    cases: () => svg('0 0 160 90', '<rect x="50" y="34" width="60" height="40" rx="5" fill="currentColor" opacity=".35"/><rect x="46" y="24" width="68" height="14" rx="4" fill="currentColor" opacity=".45"/><rect x="76" y="24" width="8" height="50" fill="currentColor" opacity=".25"/>', 'art'),
    album: () => svg('0 0 160 90', '<rect x="46" y="18" width="68" height="58" rx="5" fill="currentColor" opacity=".35"/><rect x="54" y="28" width="52" height="12" rx="2" fill="currentColor" opacity=".35"/><rect x="54" y="48" width="52" height="12" rx="2" fill="currentColor" opacity=".35"/>', 'art'),
    map: () => svg('0 0 160 90', '<path d="M40 26l26-8 28 8 26-8v50l-26 8-28-8-26 8z" fill="currentColor" opacity=".35"/><path d="M66 18v50M94 26v50" stroke="currentColor" stroke-width="2" opacity=".35"/>', 'art'),
  };

  window.Art = { ICONS, ART, coin };
})();
