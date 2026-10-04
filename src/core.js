export const WIDTH = 16, HEIGHT = 9, SAVE_VERSION = 3;
export const MUSICAL_TYPES = ['mill', 'gutter', 'bell', 'garden', 'tree', 'goat', 'cow'];
export const TYPES = Object.freeze({
  canal: { name: '水路', cost: 0, demand: 0, description: '泉からなぞってつなぐ。枝の水は「水の切替」で止められます。' },
  mill: { name: '水車', cost: 0, demand: 2, role: '木の低音', description: '水を受け、置いた拍で木の低音を鳴らす。上へ移すと高くなります。' },
  gutter: { name: '雨樋', cost: 0, demand: 1, role: '滴の旋律', description: '水を受け、置いた拍で澄んだ滴を鳴らす。横へ移すとタイミングが変わります。' },
  bell: { name: '鐘', cost: 0, demand: 2, role: '金属の余韻', description: '水を受け、置いた拍で鐘を打つ。空いた拍に置くと長い余韻が聴こえます。' },
  garden: { name: '花壇', cost: 0, demand: 0, description: '葉のシェイカー。水路なしで置いた拍を刻みます。横並びは連打、上ほど明るい音。' },
  tree: { name: '木', cost: 0, demand: 0, description: '木質のコツ音。水路なしで置いた拍を刻みます。横並びは連打、上ほど軽い音。' },
  move: { name: '移動', cost: 0, description: '楽器・木・花壇を選び、空き地を選ぶ。何度でも置き直せます。横＝拍、縦＝高さ。' },
  flow: { name: '水の切替', cost: 0, description: '水路なら枝を開閉。楽器なら水を受ける／止める。休符をつくり、響きを聴き比べます。' },
  remove: { name: '撤去', cost: 0, description: '空き地に戻す。何度でも組み直せます。' },
  goat: { name: 'ヤギ', cost: 0, demand: 0, description: '歩くカウベル。風が一周したら空き地へ一歩。切替で音と歩みを止めます。水路は不要。' },
  cow: { name: '牛', cost: 0, demand: 0, description: '歩く柔らかな低音。風が一周したら空き地へ一歩。切替で音と歩みを止めます。水路は不要。' },
});
export const ANIMAL_TYPES=['goat','cow'];
export const SCALES = Object.freeze({ d: { name: 'ニ長調 · D', root: 62 }, f: { name: 'ヘ長調 · F', root: 65 }, a: { name: 'イ長調 · A', root: 57 } });
const DEGREES = [19, 16, 14, 12, 9, 7, 4, 2, 0];
export const key = (x, y) => `${x},${y}`;
export const inside = (x, y) => Number.isInteger(x) && Number.isInteger(y) && x >= 0 && x < WIDTH && y >= 0 && y < HEIGHT;
export const neighbors = (x, y) => [[x-1,y],[x+1,y],[x,y-1],[x,y+1]].filter(([a,b])=>inside(a,b));
export const cellAt = (town,x,y) => inside(x,y) ? town.cells[y*WIDTH+x] : null;
export const noteFor = (town,y,type='gutter') => SCALES[town.scale].root + DEGREES[y] - (['mill','cow'].includes(type)?12:0);
export function createTown() {
  const cells=Array(WIDTH*HEIGHT).fill(null);cells[4*WIDTH]={type:'spring'};
  for(let x=1;x<=4;x++)cells[4*WIDTH+x]={type:'canal',open:true};
  cells[5*WIDTH+2]={type:'mill',enabled:true};
  return {version:SAVE_VERSION,cells,elapsed:0,scale:'d',scene:'day',backing:true,weather:'auto',wanderSeed:9421,nextAnimalId:1};
}
export function waterNetwork(town) {
  const wet=new Map(),queue=[[0,4,0]];
  for(let i=0;i<queue.length;i++) {
    const [x,y,d]=queue[i];if(wet.has(key(x,y)))continue;wet.set(key(x,y),d);
    for(const [nx,ny]of neighbors(x,y)){const cell=cellAt(town,nx,ny);if(cell?.type==='canal'&&cell.open!==false&&!wet.has(key(nx,ny)))queue.push([nx,ny,d+1]);}
  }
  const raining=isRaining(town),atmosphere=raining?'rain':town.scene==='evening'?'night':'day',counts=Object.fromEntries(MUSICAL_TYPES.map(t=>[t,0]));
  const buildings=[];
  town.cells.forEach((cell,index)=>{
    if(!MUSICAL_TYPES.includes(cell?.type))return;
    const x=index%WIDTH,y=Math.floor(index/WIDTH),distances=neighbors(x,y).map(([a,b])=>wet.get(key(a,b))).filter(d=>d!==undefined);
    buildings.push({index,x,y,type:cell.type,id:cell.id,atmosphere,note:noteFor(town,y,cell.type),connected:['garden','tree',...ANIMAL_TYPES].includes(cell.type)||distances.length>0,distance:distances.length?Math.min(...distances)+1:Infinity,enabled:cell.enabled!==false,active:false,reason:cell.enabled===false?'closed':distances.length?'':'dry'});
  });
  const groups=[];
  for(const b of buildings){
    if(!b.enabled){b.reason='closed';continue;}
    const previous=groups.at(-1),joins=['mill','gutter','bell'].includes(b.type)&&previous?.type===b.type&&previous.y===b.y&&previous.x+previous.span===b.x;
    if(joins){previous.members.push(b.index);previous.span++;previous.connected||=b.connected;}
    else groups.push({index:b.index,x:b.x,y:b.y,type:b.type,id:b.id,note:b.note,span:1,members:[b.index],connected:b.connected});
  }
  const beatCounts=Array(WIDTH).fill(0);let used=0;
  for(const group of groups){group.active=group.connected;for(const index of group.members){const b=buildings.find(item=>item.index===index);b.active=group.active;b.reason=b.active?'':'dry';b.start=group.x;b.span=group.span;if(b.active){used+=TYPES[b.type].demand;counts[b.type]++;}}if(group.active)beatCounts[group.x]++;}
  return {wet,buildings,groups,counts,raining,atmosphere,used,activeCount:buildings.filter(b=>b.active).length,roles:MUSICAL_TYPES.filter(t=>counts[t]>0).length,beats:beatCounts.filter(n=>n>0).length,beatCounts};

}
export function build(town,tool,x,y) {
  if(!inside(x,y)||!Object.hasOwn(TYPES,tool))return {ok:false,reason:'街のマスを選んでください。'};
  const index=y*WIDTH+x,previous=town.cells[index];
  if(previous?.type==='spring')return {ok:false,reason:'ここは泉。となりから水路をつなごう。'};
  if(tool==='flow') {
    if(!previous)return {ok:false,reason:'水路か音のある建物を選んでください。'};
    const next={...previous};if(next.type==='canal')next.open=!(next.open!==false);else next.enabled=!(next.enabled!==false);
    town.cells[index]=next;return {ok:true,change:{index,previous:{...previous},next,delta:0}};
  }
  if(tool==='remove') {
    if(!previous)return {ok:false,reason:''};const delta=TYPES[previous.type].cost;town.cells[index]=null;
    return {ok:true,change:{index,previous:{...previous},next:null,delta}};
  }
  if(tool==='move')return {ok:false,reason:'移す楽器・木・花壇を選んでから、空き地を選ぼう。'};
  if(previous)return {ok:false,reason:'ここには建物があります。「移動」で置き直せます。',inspect:previous.type};
  const next={type:tool};if(ANIMAL_TYPES.includes(tool))next.id=town.nextAnimalId++;if(tool==='canal')next.open=true;else if(MUSICAL_TYPES.includes(tool))next.enabled=true;
  town.cells[index]=next;
  return {ok:true,change:{index,previous:null,next,delta:-TYPES[tool].cost}};
}
export function moveBuilding(town,from,to) {
  if(!inside(...from)||!inside(...to))return {ok:false,reason:'街の空き地を選んでください。'};
  const index=from[1]*WIDTH+from[0],target=to[1]*WIDTH+to[0],cell=town.cells[index];
  if(!cell||!MUSICAL_TYPES.includes(cell.type))return {ok:false,reason:'楽器か木・花壇を選んでください。'};
  if(town.cells[target])return {ok:false,reason:'移動先は空き地を選んでください。'};
  town.cells[index]=null;town.cells[target]={...cell};
  return {ok:true,changes:[{index,previous:{...cell},next:null,delta:0},{index:target,previous:null,next:{...cell},delta:0}]};
}
function emptyNear(town,index,excluding=-1) {
  const queue=[index],visited=new Set();
  for(let i=0;i<queue.length;i++){const target=queue[i];if(visited.has(target))continue;visited.add(target);if(target!==excluding&&!town.cells[target])return target;for(const[x,y]of neighbors(target%WIDTH,Math.floor(target/WIDTH)))queue.push(y*WIDTH+x);}
  return -1;
}
export function undoChanges(town,changes) {
  // Roaming changes positions without erasing editing history. Track animal identity.
  for(const change of [...changes].reverse()) {
    const animalNext=ANIMAL_TYPES.includes(change.next?.type),animalPrevious=ANIMAL_TYPES.includes(change.previous?.type);
    let target=change.index;
    if(animalNext){const current=town.cells.findIndex(c=>c?.id===change.next.id&&ANIMAL_TYPES.includes(c.type));if(current>=0){target=current;town.cells[current]=null;}}
    if(!change.previous){if(!animalNext)town.cells[target]=null;continue;}
    if(!(animalPrevious&&animalNext))target=change.index;
    const occupant=town.cells[target];
    if(ANIMAL_TYPES.includes(occupant?.type)){const free=emptyNear(town,target,target);if(free<0)return false;town.cells[free]=occupant;}
    town.cells[target]={...change.previous};
  }
  return true;
}
export function isRaining(town){return town.weather==='rain'||(town.weather!=='clear'&&town.elapsed%60>=44);}
export function wanderAnimals(town,heldIds=new Set()) {
  const animals=town.cells.map((c,index)=>({cell:c,index})).filter(({cell})=>ANIMAL_TYPES.includes(cell?.type)&&cell.enabled&&!heldIds.has(cell.id)).sort((a,b)=>a.cell.id-b.cell.id),moves=[];
  for(const {cell,index}of animals){town.wanderSeed=(Math.imul(town.wanderSeed,1664525)+1013904223)>>>0;const options=neighbors(index%WIDTH,Math.floor(index/WIDTH)).map(([x,y])=>y*WIDTH+x).filter(i=>!town.cells[i]);if(!options.length||town.wanderSeed%5===0)continue;const target=options[town.wanderSeed%options.length];town.cells[index]=null;town.cells[target]=cell;moves.push({id:cell.id,from:index,to:target});}
  return moves;
}
export function previewAction(town,tool,x,y,from=null) {
  const draft={...town,cells:town.cells.slice()};const result=tool==='move'&&from?moveBuilding(draft,from,[x,y]):build(draft,tool,x,y);
  if(!result.ok)return result;
  const after=waterNetwork(draft),building=after.buildings.find(b=>b.x===x&&b.y===y);
  return {ok:true,after,building};
}
export function advance(town,seconds) {town.elapsed+=Math.max(0,Math.min(seconds,1));}
export function lineCells(from,to) {let[x,y]=from;const result=[];while(x!==to[0]){x+=Math.sign(to[0]-x);result.push([x,y]);}while(y!==to[1]){y+=Math.sign(to[1]-y);result.push([x,y]);}return result;}
export function restoreTown(data) {
  if(!data||![2,SAVE_VERSION].includes(data.version)||!Array.isArray(data.cells)||data.cells.length!==WIDTH*HEIGHT)throw new Error('街の保存形式が違います。');
  const allowed=['spring','canal',...MUSICAL_TYPES],ids=new Set();
  const cells=data.cells.map((cell,index)=>{
    if(cell===null)return null;if(!cell||!allowed.includes(cell.type))throw new Error('街のマスが正しくありません。');
    if((index===4*WIDTH)!==(cell.type==='spring'))throw new Error('泉の場所が正しくありません。');
    const value={type:cell.type};if(ANIMAL_TYPES.includes(cell.type)){if(data.version===2||!Number.isSafeInteger(cell.id)||cell.id<1||ids.has(cell.id))throw new Error('動物の記録が正しくありません。');ids.add(cell.id);value.id=cell.id;}if(cell.type==='canal'){if(typeof cell.open!=='boolean')throw new Error('水路の設定が正しくありません。');value.open=cell.open;}
    if(MUSICAL_TYPES.includes(cell.type)){if(data.version===2&&cell.type==='garden'){value.enabled=false;}else{if(typeof cell.enabled!=='boolean')throw new Error('楽器の設定が正しくありません。');value.enabled=cell.enabled;}}return value;
  });
  if(cells[4*WIDTH]?.type!=='spring')throw new Error('泉が見つかりません。');
  // Validate the former reusable budget before migrating; no balance exists in v3.
  if(data.version===2){const costs={canal:1,mill:18,gutter:14,bell:20,garden:6};const spent=cells.reduce((sum,c)=>sum+(costs[c?.type]??0),0);if(!Number.isInteger(data.wood)||data.wood<0||spent+data.wood!==220)throw new Error('以前の木材の記録が正しくありません。');}
  if(!Number.isFinite(data.elapsed)||data.elapsed<0||data.elapsed>1e9||!Object.hasOwn(SCALES,data.scale)||!['day','evening'].includes(data.scene))throw new Error('街の設定が正しくありません。');
  const backing=data.backing??true,weather=data.weather??'auto',wanderSeed=data.wanderSeed??9421,nextAnimalId=data.nextAnimalId??1;if(typeof backing!=='boolean'||!['auto','clear','rain'].includes(weather)||!Number.isInteger(wanderSeed)||wanderSeed<0||wanderSeed>4294967295||!Number.isSafeInteger(nextAnimalId)||nextAnimalId<1||[...ids].some(id=>id>=nextAnimalId))throw new Error('情景や動物の設定が正しくありません。');
  return {version:SAVE_VERSION,cells,elapsed:data.elapsed,scale:data.scale,scene:data.scene,backing,weather,wanderSeed,nextAnimalId};
}
