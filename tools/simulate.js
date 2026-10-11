// Проверка баланса: node tools/simulate.js
globalThis.GameData = require('../js/data.js');
const P = require('../js/plates.js');

// Примеры из оригинальной игры — цены должны совпасть.
const checks = [['cААА012|777', 149282], ['cААА111|77', 1691250], ['cАМР997|97', 76832437], ['cТХВ808|790', 21341], ['cАВЕ129|799', 234]];
for (const [code, want] of checks) {
  const e = P.evaluate(P.decode(code));
  console.log(P.text(P.decode(code)).padEnd(14), e.rarity.name.padEnd(12), e.price, want === e.price || Math.abs(e.price - want) <= 1 ? 'OK' : 'ждали ' + want);
}

const N = 300000;
for (const kind of Object.keys(P.KINDS)) {
  const cnt = [0, 0, 0, 0, 0]; let sum = 0;
  for (let i = 0; i < N; i++) { const e = P.evaluate(P.random(kind)); cnt[P.RARITY_IDX[e.rarity.id]]++; sum += e.price; }
  console.log(kind, cnt.map((c) => (100 * c / N).toFixed(2) + '%').join('  '), ' средняя цена', Math.round(sum / N));
}
console.log("оригинал: c 53.79 37.86 8.05 0.28 0.02 | t 65.20 29.71 4.60 0.46 0.03 | p 53.51 39.00 7.13 0.33 0.03 | m 49.06 42.96 7.72 0.25 0.01");
