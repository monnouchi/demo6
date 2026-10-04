export const WIDTH = 16, HEIGHT = 9, SAVE_VERSION = 2, WOOD_BUDGET = 220;
export const MAX_VOICES = 3;
export const MUSICAL_TYPES = ['mill', 'gutter', 'bell'];
export const TYPES = Object.freeze({
  canal: { name: '水路', cost: 1, demand: 0, description: '泉からなぞってつなぐ。枝の水は「水の切替」で止められます。' },
  mill: { name: '水車', cost: 18, demand: 2, role: '木の低音', description: '水を受け、置いた拍で木の低音を鳴らす。上へ移すと高くなります。' },
  gutter: { name: '雨樋', cost: 14, demand: 1, role: '滴の旋律', description: '水を受け、置いた拍で澄んだ滴を鳴らす。横へ移すとタイミングが変わります。' },
  bell: { name: '鐘', cost: 20, demand: 2, role: '金属の余韻', description: '水を受け、置いた拍で鐘を打つ。空いた拍に置くと長い余韻が聴こえます。' },
  garden: { name: '花園', cost: 6, demand: 0, description: '音を鳴らさない景観。水は使わず、花と小道で街の写真を彩ります。' },
  move: { name: '移動', cost: 0, description: '楽器・花園を選び、空き地を選ぶ。木材は不要。横＝拍、縦＝高さ。' },
  flow: { name: '水の切替', cost: 0, description: '水路なら枝を開閉。楽器なら水を受ける／止める。空いた水を別の音へ。' },
  remove: { name: '撤去', cost: 0, description: '使った木材を全額返す。何度でも組み直せます。' },
});
export const SCALES = Object.freeze({ d: { name: 'ニ長調 · D', root: 62 }, f: { name: 'ヘ長調 · F', root: 65 }, a: { name: 'イ長調 · A', root: 57 } });
const DEGREES = [19, 16, 14, 12, 9, 7, 4, 2, 0];
export const key = (x, y) => `${x},${y}`;
export const inside = (x, y) => Number.isInteger(x) && Number.isInteger(y) && x >= 0 && x < WIDTH && y >= 0 && y < HEIGHT;
export const neighbors = (x, y) => [[x-1,y],[x+1,y],[x,y-1],[x,y+1]].filter(([a,b])=>inside(a,b));
export const cellAt = (town,x,y) => inside(x,y) ? town.cells[y*WIDTH+x] : null;
export const noteFor = (town,y,type='gutter') => SCALES[town.scale].root + DEGREES[y] - (type==='mill'?12:0);
export function createTown() {
  const cells=Array(WIDTH*HEIGHT).fill(null);cells[4*WIDTH]={type:'spring'};
  for(let x=1;x<=4;x++)cells[4*WIDTH+x]={type:'canal',open:true};
  cells[5*WIDTH+2]={type:'mill',enabled:true};
  return {version:SAVE_VERSION,cells,wood:WOOD_BUDGET-4-18,elapsed:0,scale:'d',scene:'day',placed:false,heard:false,moved:false,listenTicks:0,completed:false};
}
export function waterNetwork(town) {
  const wet=new Map(),queue=[[0,4,0]];
  for(let i=0;i<queue.length;i++) {
    const [x,y,d]=queue[i];if(wet.has(key(x,y)))continue;wet.set(key(x,y),d);
    for(const [nx,ny]of neighbors(x,y)){const cell=cellAt(town,nx,ny);if(cell?.type==='canal'&&cell.open!==false&&!wet.has(key(nx,ny)))queue.push([nx,ny,d+1]);}
  }
  const raining=town.elapsed%60>=44,capacity=12+(raining?4:0),counts={mill:0,gutter:0,bell:0};
  const buildings=[];
  town.cells.forEach((cell,index)=>{
    if(!MUSICAL_TYPES.includes(cell?.type))return;
    const x=index%WIDTH,y=Math.floor(index/WIDTH),distances=neighbors(x,y).map(([a,b])=>wet.get(key(a,b))).filter(d=>d!==undefined);
    buildings.push({index,x,y,type:cell.type,note:noteFor(town,y,cell.type),connected:distances.length>0,distance:distances.length?Math.min(...distances)+1:Infinity,enabled:cell.enabled!==false,active:false,reason:cell.enabled===false?'closed':distances.length?'':'dry'});
  });
  const candidates=buildings.filter(b=>b.connected&&b.enabled).sort((a,b)=>a.distance-b.distance||a.index-b.index);
  const beatCounts=Array(WIDTH).fill(0);let used=0;
  for(const b of candidates) {
    if(beatCounts[b.x]>=MAX_VOICES){b.reason='crowded';continue;}
    if(used+TYPES[b.type].demand>capacity){b.reason='water';continue;}
    b.active=true;b.reason='';used+=TYPES[b.type].demand;beatCounts[b.x]++;counts[b.type]++;
  }
  return {wet,buildings,counts,raining,capacity,used,demand:candidates.reduce((sum,b)=>sum+TYPES[b.type].demand,0),activeCount:buildings.filter(b=>b.active).length,roles:MUSICAL_TYPES.filter(t=>counts[t]>0).length,beats:beatCounts.filter(n=>n>0).length,beatCounts,waterBlocked:buildings.filter(b=>b.reason==='water').length,crowded:buildings.filter(b=>b.reason==='crowded').length};
}
function changed(town) {if(!town.completed)town.listenTicks=0;}
export function build(town,tool,x,y) {
  if(!inside(x,y)||!Object.hasOwn(TYPES,tool))return {ok:false,reason:'街のマスを選んでください。'};
  const index=y*WIDTH+x,previous=town.cells[index];
  if(previous?.type==='spring')return {ok:false,reason:'ここは泉。となりから水路をつなごう。'};
  if(tool==='flow') {
    if(!previous||previous.type==='garden')return {ok:false,reason:'水路か楽器を選んでください。花園は水を使いません。'};
    const next={...previous};if(next.type==='canal')next.open=!(next.open!==false);else next.enabled=!(next.enabled!==false);
    town.cells[index]=next;changed(town);return {ok:true,change:{index,previous:{...previous},next,delta:0}};
  }
  if(tool==='remove') {
    if(!previous)return {ok:false,reason:''};const delta=TYPES[previous.type].cost;town.cells[index]=null;town.wood+=delta;changed(town);
    return {ok:true,change:{index,previous:{...previous},next:null,delta}};
  }
  if(tool==='move')return {ok:false,reason:'移す楽器・花園を選んでから、空き地を選ぼう。'};
  if(previous)return {ok:false,reason:'ここには建物があります。「移動」で置き直せます。',inspect:previous.type};
  if(town.wood<TYPES[tool].cost)return {ok:false,reason:'木材の予算いっぱい。撤去すると全額戻ります。'};
  const next={type:tool};if(tool==='canal')next.open=true;else if(MUSICAL_TYPES.includes(tool))next.enabled=true;
  town.cells[index]=next;town.wood-=TYPES[tool].cost;if(MUSICAL_TYPES.includes(tool))town.placed=true;changed(town);
  return {ok:true,change:{index,previous:null,next,delta:-TYPES[tool].cost}};
}
export function moveBuilding(town,from,to) {
  if(!inside(...from)||!inside(...to))return {ok:false,reason:'街の空き地を選んでください。'};
  const index=from[1]*WIDTH+from[0],target=to[1]*WIDTH+to[0],cell=town.cells[index];
  if(!cell||!['mill','gutter','bell','garden'].includes(cell.type))return {ok:false,reason:'楽器か花園を選んでください。'};
  if(town.cells[target])return {ok:false,reason:'移動先は空き地を選んでください。'};
  town.cells[index]=null;town.cells[target]={...cell};if(MUSICAL_TYPES.includes(cell.type))town.moved=true;changed(town);
  return {ok:true,changes:[{index,previous:{...cell},next:null,delta:0},{index:target,previous:null,next:{...cell},delta:0}]};
}
export function undoChanges(town,changes) {
  const delta=changes.reduce((sum,c)=>sum+c.delta,0);if(town.wood-delta<0||town.wood-delta>WOOD_BUDGET)return false;
  for(const change of [...changes].reverse())town.cells[change.index]=change.previous?{...change.previous}:null;
  town.wood-=delta;changed(town);return true;
}
export function previewAction(town,tool,x,y,from=null) {
  const draft={...town,cells:town.cells.slice()};const result=tool==='move'&&from?moveBuilding(draft,from,[x,y]):build(draft,tool,x,y);
  if(!result.ok)return result;
  const after=waterNetwork(draft),building=after.buildings.find(b=>b.x===x&&b.y===y);
  return {ok:true,after,building,wood:draft.wood};
}
export function recordPlayback(town,network,notes=null) {
  const playing=notes??network.buildings.filter(b=>b.active);
  if(town.placed&&playing.some(note=>note.index!==5*WIDTH+2))town.heard=true;
  if(town.completed||!town.placed||!town.heard||!town.moved||network.roles<3||network.beats<4)return false;
  town.listenTicks=Math.min(16,town.listenTicks+1);if(town.listenTicks===16){town.completed=true;return true;}return false;
}
export function advance(town,seconds) {town.elapsed+=Math.max(0,Math.min(seconds,1));}
export function lineCells(from,to) {let[x,y]=from;const result=[];while(x!==to[0]){x+=Math.sign(to[0]-x);result.push([x,y]);}while(y!==to[1]){y+=Math.sign(to[1]-y);result.push([x,y]);}return result;}
export function restoreTown(data) {
  if(!data||data.version!==SAVE_VERSION||!Array.isArray(data.cells)||data.cells.length!==WIDTH*HEIGHT)throw new Error('街の保存形式が違います。');
  const allowed=['spring','canal','mill','gutter','bell','garden'];
  const cells=data.cells.map((cell,index)=>{
    if(cell===null)return null;if(!cell||!allowed.includes(cell.type))throw new Error('街のマスが正しくありません。');
    if((index===4*WIDTH)!==(cell.type==='spring'))throw new Error('泉の場所が正しくありません。');
    const value={type:cell.type};if(cell.type==='canal'){if(typeof cell.open!=='boolean')throw new Error('水路の設定が正しくありません。');value.open=cell.open;}
    if(MUSICAL_TYPES.includes(cell.type)){if(typeof cell.enabled!=='boolean')throw new Error('楽器の水設定が正しくありません。');value.enabled=cell.enabled;}return value;
  });
  if(cells[4*WIDTH]?.type!=='spring')throw new Error('泉が見つかりません。');
  const spent=cells.reduce((sum,cell)=>sum+(TYPES[cell?.type]?.cost??0),0);
  if(!Number.isInteger(data.wood)||data.wood<0||spent+data.wood!==WOOD_BUDGET)throw new Error('木材の予算が正しくありません。');
  if(!Number.isFinite(data.elapsed)||data.elapsed<0||data.elapsed>1e9||!Object.hasOwn(SCALES,data.scale)||!['day','evening'].includes(data.scene))throw new Error('街の設定が正しくありません。');
  if(!Number.isInteger(data.listenTicks)||data.listenTicks<0||data.listenTicks>16||['placed','moved','completed'].some(k=>typeof data[k]!=='boolean')||(data.completed&&data.listenTicks!==16))throw new Error('街の記録が正しくありません。');
  const heard=data.heard??data.completed;if(typeof heard!=='boolean')throw new Error('演奏の記録が正しくありません。');
  return {version:SAVE_VERSION,cells,wood:data.wood,elapsed:data.elapsed,scale:data.scale,scene:data.scene,placed:data.placed,heard,moved:data.moved,listenTicks:data.listenTicks,completed:data.completed};
}
