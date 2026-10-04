export const WIDTH = 13;
export const HEIGHT = 9;
export const SAVE_VERSION = 1;
export const TYPES = Object.freeze({
  canal: { name: '水路', cost: 2, demand: 0, color: '#71b9c0', description: '泉からつなぐ。押したままなぞって、自由に枝分かれ。' },
  mill: { name: '水車', cost: 18, demand: 2, woodRate: 1.2, growthRate: 0.10, color: '#c58a54', role: '低音と拍', description: '水路のとなりに。木材をつくり、合奏の低音を奏でる。' },
  gutter: { name: '雨樋', cost: 16, demand: 1, growthRate: 0.38, rainGrowthRate: 0.55, color: '#699b9e', role: '旋律', description: '水路のとなりに。滴の旋律が街を彩る。雨の日はさらに元気。' },
  bell: { name: '鐘', cost: 22, demand: 2, growthRate: 0.32, color: '#cba750', role: '和声', description: '水路のとなりに。やわらかな鐘が和声と彩りを重ねる。' },
  garden: { name: '花園', cost: 10, demand: 1, growthRate: 0.65, color: '#b4828f', description: '水路のとなりに。花がひらき、街の彩りが早く育つ。' },
  remove: { name: '撤去', cost: 0, color: '#a39a89', description: '水路や建物を片づける。使った木材はすべて戻ります。' },
});
export const MUSICAL_TYPES = ['mill', 'gutter', 'bell'];
const ROCKS = [[0, 0], [0, 8], [10, 0], [11, 0], [12, 1], [12, 7], [11, 8]];
export const key = (x, y) => `${x},${y}`;
export const inside = (x, y) => Number.isInteger(x) && Number.isInteger(y) && x >= 0 && x < WIDTH && y >= 0 && y < HEIGHT;
export const neighbors = (x, y) => [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]].filter(([a, b]) => inside(a, b));
export function createTown() {
  const cells = Array.from({ length: WIDTH * HEIGHT }, () => null);
  ROCKS.forEach(([x, y]) => { cells[y * WIDTH + x] = { type: 'rock' }; });
  cells[4 * WIDTH] = { type: 'spring' };
  cells[4 * WIDTH + 1] = { type: 'canal' };
  cells[4 * WIDTH + 2] = { type: 'canal' };
  cells[4 * WIDTH + 3] = { type: 'mill' };
  return { version: SAVE_VERSION, cells, wood: 92, growth: 0, elapsed: 0, upgrades: 0, stage: 0, completed: false, festivalAt: null, arrangement: 'day' };
}
export function productionFor(type, raining = false) {
  const data = TYPES[type];
  return { woodRate: data?.woodRate ?? 0, growthRate: (raining ? data?.rainGrowthRate : undefined) ?? data?.growthRate ?? 0 };
}
export function flowState(demand, capacity) { return demand < capacity ? 'spare' : demand === capacity ? 'full' : 'shared'; }
export function cellAt(town, x, y) { return inside(x, y) ? town.cells[y * WIDTH + x] : null; }
export function waterNetwork(town) {
  const wet = new Map();
  const queue = [[0, 4, 0]];
  for (let i = 0; i < queue.length; i++) {
    const [x, y, distance] = queue[i];
    if (wet.has(key(x, y))) continue;
    wet.set(key(x, y), distance);
    for (const [nx, ny] of neighbors(x, y)) {
      const type = cellAt(town, nx, ny)?.type;
      if ((type === 'canal' || type === 'spring') && !wet.has(key(nx, ny))) queue.push([nx, ny, distance + 1]);
    }
  }
  const buildings = [];
  const counts = { mill: 0, gutter: 0, bell: 0, garden: 0 };
  town.cells.forEach((cell, index) => {
    if (!cell || !Object.hasOwn(counts, cell.type)) return;
    const x = index % WIDTH, y = Math.floor(index / WIDTH);
    const distances = neighbors(x, y).map(([nx, ny]) => wet.get(key(nx, ny))).filter(d => d !== undefined);
    const active = distances.length > 0;
    if (active) counts[cell.type]++;
    buildings.push({ x, y, type: cell.type, active, distance: active ? Math.min(...distances) + 1 : Infinity });
  });
  const activeCount = Object.values(counts).reduce((sum, count) => sum + count, 0);
  const demand = Object.entries(counts).reduce((sum, [type, count]) => sum + TYPES[type].demand * count, 0);
  const raining = town.elapsed % 72 >= 54;
  const capacity = 12 + town.upgrades * 6 + (raining ? 4 : 0);
  const efficiency = demand ? Math.min(1, capacity / demand) : 1;
  const woodRate = Object.entries(counts).reduce((sum, [type, count]) => sum + productionFor(type, raining).woodRate * count, 0) * efficiency;
  const growthRate = Object.entries(counts).reduce((sum, [type, count]) => sum + productionFor(type, raining).growthRate * count, 0) * efficiency;
  return { wet, canalCount: wet.size - 1, buildings, counts, activeCount, demand, capacity, efficiency, woodRate, growthRate, raining, roles: MUSICAL_TYPES.filter(type => counts[type] > 0).length };
}
export function build(town, tool, x, y) {
  if (!inside(x, y) || !TYPES[tool]) return { ok: false, reason: '街のマスを選んでください。' };
  const index = y * WIDTH + x, previous = town.cells[index];
  if (previous?.type === 'rock') return { ok: false, reason: 'ここは岩と木の小さな森。となりに建てよう。' };
  if (previous?.type === 'spring') return { ok: false, reason: '街の泉です。水路をとなりにつなげよう。' };
  if (tool === 'remove') {
    if (!previous) return { ok: false, reason: '' };
    const refund = TYPES[previous.type].cost;
    town.cells[index] = null;
    town.wood += refund;
    return { ok: true, change: { index, previous: { ...previous }, next: null, delta: refund } };
  }
  if (previous) return { ok: false, reason: '', inspect: previous.type };
  if (town.wood < TYPES[tool].cost) return { ok: false, reason: '木材が足りません。水車がつくるのを少し待とう。' };
  const next = { type: tool };
  town.cells[index] = next;
  town.wood -= TYPES[tool].cost;
  return { ok: true, change: { index, previous: null, next, delta: -TYPES[tool].cost } };
}
export function previewAction(town, tool, x, y, before = waterNetwork(town)) {
  const draft = { ...town, cells: town.cells.slice() };
  const result = build(draft, tool, x, y);
  if (!result.ok) return result;
  const after = waterNetwork(draft);
  return { ok: true, after, woodDelta: result.change.delta, activeDelta: after.activeCount - before.activeCount, woodRateDelta: after.woodRate - before.woodRate, growthRateDelta: after.growthRate - before.growthRate, operates: after.buildings.some(building => building.x === x && building.y === y && building.active) };
}
export function undoChanges(town, changes) {
  const totalDelta = changes.reduce((sum, change) => sum + change.delta, 0);
  if (town.wood - totalDelta < 0) return false;
  for (const change of [...changes].reverse()) town.cells[change.index] = change.previous ? { ...change.previous } : null;
  town.wood -= totalDelta;
  return true;
}
export function upgrade(town) {
  if (town.upgrades >= 3) return { ok: false, reason: '泉は十分に深くなりました。' };
  const cost = 40 + town.upgrades * 20;
  if (town.wood < cost) return { ok: false, reason: '木材が足りません。水車を増やすと早くたまります。' };
  town.wood -= cost;
  town.upgrades++;
  return { ok: true };
}
export function advance(town, seconds, network = waterNetwork(town)) {
  const dt = Math.max(0, Math.min(seconds, 1));
  town.elapsed += dt;
  town.wood += network.woodRate * dt;
  town.growth = Math.min(999, town.growth + network.growthRate * dt);
  const events = [];
  if (town.stage === 0 && network.roles >= 2) { town.stage = 1; town.wood += 20; events.push('duet'); }
  if (town.stage === 1 && network.roles === 3) { town.stage = 2; town.wood += 25; events.push('trio'); }
  if (!town.completed && network.roles === 3 && network.activeCount >= 6 && network.canalCount >= 8 && town.growth >= 60) {
    town.completed = true; town.stage = 3; town.festivalAt = town.elapsed; events.push('festival');
  }
  return events;
}
export function lineCells(from, to) {
  let [x, y] = from;
  const result = [];
  while (x !== to[0]) { x += Math.sign(to[0] - x); result.push([x, y]); }
  while (y !== to[1]) { y += Math.sign(to[1] - y); result.push([x, y]); }
  return result;
}
export function restoreTown(data) {
  if (!data || data.version !== SAVE_VERSION || !Array.isArray(data.cells) || data.cells.length !== WIDTH * HEIGHT) throw new Error('この街の保存形式には対応していません。');
  const allowed = new Set(['canal', 'mill', 'gutter', 'bell', 'garden', 'rock', 'spring']);
  const cells = data.cells.map(cell => {
    if (cell === null) return null;
    if (!cell || typeof cell !== 'object' || !allowed.has(cell.type)) throw new Error('保存された街のマスが正しくありません。');
    return { type: cell.type };
  });
  const original = createTown();
  for (let i = 0; i < cells.length; i++) {
    if ((original.cells[i]?.type === 'rock' || original.cells[i]?.type === 'spring') && cells[i]?.type !== original.cells[i].type) throw new Error('泉や森の場所が正しくありません。');
    if (cells[i]?.type === 'spring' && i !== 4 * WIDTH) throw new Error('泉の場所が正しくありません。');
    if (cells[i]?.type === 'rock' && original.cells[i]?.type !== 'rock') throw new Error('森の場所が正しくありません。');
  }
  const finite = (name, max) => {
    if (typeof data[name] !== 'number' || !Number.isFinite(data[name]) || data[name] < 0 || data[name] > max) throw new Error('保存された街の数値が正しくありません。');
    return data[name];
  };
  const arrangement = data.arrangement ?? 'day';
  if (!['day', 'evening'].includes(arrangement)) throw new Error('合奏の保存設定が正しくありません。');
  const town = { version: SAVE_VERSION, cells, wood: finite('wood', 1e9), growth: finite('growth', 999), elapsed: finite('elapsed', 1e9), upgrades: finite('upgrades', 3), stage: finite('stage', 3), completed: data.completed === true, festivalAt: null, arrangement };
  if (!Number.isInteger(town.upgrades) || !Number.isInteger(town.stage) || (town.completed !== (town.stage === 3))) throw new Error('保存された街の成長記録が正しくありません。');
  if (town.completed) {
    if (typeof data.festivalAt !== 'number' || !Number.isFinite(data.festivalAt) || data.festivalAt < 0 || data.festivalAt > town.elapsed) throw new Error('祝祭の記録が正しくありません。');
    town.festivalAt = data.festivalAt;
  }
  return town;
}
