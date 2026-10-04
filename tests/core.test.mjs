import test from 'node:test';
import assert from 'node:assert/strict';
import { WIDTH, TYPES, createTown, waterNetwork, build, advance, upgrade, undoChanges, lineCells, restoreTown } from '../src/core.js';
import { scoreAt, midiHz, CHORDS } from '../src/music.js';
const put=(town,type,x,y)=>{const result=build(town,type,x,y);assert.equal(result.ok,true,result.reason);return result.change;};

test('the starter mill runs, and unconnected buildings stay dry',()=>{
  const town=createTown();assert.equal(waterNetwork(town).counts.mill,1);
  put(town,'bell',9,4);assert.equal(waterNetwork(town).counts.bell,0);
  for(let x=1;x<=8;x++)if(!town.cells[3*WIDTH+x])put(town,'canal',x,3);
  assert.equal(waterNetwork(town).counts.bell,0);
  put(town,'canal',9,3);assert.equal(waterNetwork(town).counts.bell,1);
});

test('branching and loops connect through canals, not through buildings',()=>{
  const town=createTown();town.wood=300;
  put(town,'gutter',2,3);put(town,'bell',2,5);
  assert.equal(waterNetwork(town).roles,3);
  put(town,'garden',3,3);assert.equal(waterNetwork(town).counts.garden,0);
  put(town,'canal',1,3);put(town,'canal',1,2);put(town,'canal',2,2);put(town,'canal',3,2);
  assert.equal(waterNetwork(town).counts.garden,1);
  put(town,'canal',3,1);put(town,'canal',2,1);
  assert.equal(waterNetwork(town).counts.garden,1);
});

test('removing a shared canal disconnects the branch, and undo restores it',()=>{
  const town=createTown();put(town,'gutter',2,3);put(town,'bell',2,5);
  const before=town.wood;const change=put(town,'remove',1,4);
  assert.equal(waterNetwork(town).activeCount,0);assert.equal(town.wood,before+TYPES.canal.cost);
  assert.equal(undoChanges(town,[change]),true);assert.equal(waterNetwork(town).roles,3);assert.equal(town.wood,before);
});

test('a dragged route is continuous and refunds as one operation',()=>{
  const town=createTown(),route=lineCells([2,4],[7,2]);
  assert.deepEqual(route,[[3,4],[4,4],[5,4],[6,4],[7,4],[7,3],[7,2]]);
  const changes=route.filter(([x,y])=>!town.cells[y*WIDTH+x]).map(([x,y])=>put(town,'canal',x,y));
  const remaining=town.wood;assert.equal(undoChanges(town,changes),true);assert.equal(town.wood,remaining+changes.length*2);
});

test('insufficient funds and protected terrain do not mutate the town',()=>{
  const town=createTown();town.wood=1;const before=JSON.stringify(town);
  assert.equal(build(town,'bell',2,2).ok,false);assert.equal(build(town,'remove',0,4).ok,false);assert.equal(build(town,'canal',0,0).ok,false);assert.equal(build(town,'canal',-1,3).ok,false);
  assert.equal(JSON.stringify(town),before);
});

test('many buildings share water fairly, and an upgraded spring increases production',()=>{
  const town=createTown();town.wood=1000;
  for(let x=1;x<=10;x++){put(town,'canal',x,5);put(town,'bell',x,6);}
  let network=waterNetwork(town);assert.equal(network.counts.bell,10);assert.ok(network.efficiency<1);
  const previous=network.growthRate;assert.equal(upgrade(town).ok,true);network=waterNetwork(town);
  assert.ok(network.growthRate>previous);assert.ok(network.buildings.filter(b=>b.active).length===11);
});

test('a free-form six-building town reaches a festival once and can continue',()=>{
  const town=createTown();put(town,'gutter',2,3);put(town,'bell',2,5);advance(town,.1);
  for(const [x,y]of [[1,3],[1,5],[0,3]])put(town,'garden',x,y);
  assert.equal(waterNetwork(town).activeCount,6);
  for(const [x,y]of [[0,5],[0,6],[1,6],[2,6],[3,6],[4,6]])put(town,'canal',x,y);
  assert.equal(waterNetwork(town).canalCount,8);
  let festivals=0;for(let i=0;i<90;i++)festivals+=advance(town,1).filter(event=>event==='festival').length;
  assert.equal(festivals,1);assert.equal(town.completed,true);assert.equal(town.stage,3);assert.ok(town.growth>=60);
  const before=town.growth;advance(town,1);assert.ok(town.growth>before);assert.equal(advance(town,1).length,0);
});

test('save round-trip preserves completed towns and rejects invalid or injected data',()=>{
  const town=createTown();assert.deepEqual(restoreTown(JSON.parse(JSON.stringify(town))),town);
  assert.throws(()=>restoreTown({...town,wood:NaN}));assert.throws(()=>restoreTown({...town,upgrades:1.5}));
  const bad=structuredClone(town);bad.cells[4*WIDTH]={type:'bell'};assert.throws(()=>restoreTown(bad));
  const injected=structuredClone(town);injected.cells[1]={type:'<script>alert(1)</script>'};assert.throws(()=>restoreTown(injected));
  assert.throws(()=>restoreTown({...town,stage:3,completed:true,festivalAt:Infinity}));
});

test('the festival rewards a water system the player has actually extended',()=>{
  const town=createTown();town.wood=300;town.growth=100;
  put(town,'gutter',2,3);put(town,'bell',2,5);
  for(const [x,y]of [[1,3],[1,5],[0,3]])put(town,'garden',x,y);
  advance(town,1);assert.equal(town.completed,false);assert.equal(town.stage,2);
  for(const [x,y]of [[0,5],[0,6],[1,6],[2,6],[3,6],[4,6]])put(town,'canal',x,y);
  assert.deepEqual(advance(town,1),['festival']);assert.equal(town.completed,true);
});

test('repeated building, removal, undo, upgrades, and saving preserve a valid town',()=>{
  const town=createTown(),history=[];let seed=6726;
  const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/2**32;};
  for(let i=0;i<3000;i++){
    const action=Math.floor(random()*9);
    if(action===7&&history.length){if(undoChanges(town,history.at(-1)))history.pop();}
    else if(action===8)upgrade(town);
    else{const tool=Object.keys(TYPES)[action%6],x=Math.floor(random()*13),y=Math.floor(random()*9),result=build(town,tool,x,y);if(result.ok)history.push([result.change]);}
    advance(town,random());
    assert.ok(town.wood>=0&&Number.isFinite(town.wood));assert.ok(town.growth>=0&&town.growth<=999);
    if(i%100===0)assert.deepEqual(restoreTown(JSON.parse(JSON.stringify(town))),town);
  }
  assert.equal(town.cells[4*WIDTH].type,'spring');assert.equal(town.cells[0].type,'rock');
});

test('original score is an eight-bar phrase with repeated motifs and a final cadence',()=>{
  const counts={mill:1,gutter:1,bell:1};const events=Array.from({length:128},(_,step)=>scoreAt(step,counts,6)).flat();
  assert.equal(CHORDS.length,8);assert.ok(events.some(e=>e.instrument==='pad'));
  for(const event of events){assert.ok(Number.isFinite(midiHz(event.note)));assert.ok(event.note>=43&&event.note<=83);assert.ok(event.length>0);assert.ok(event.gain>0&&event.gain<=1.3);}
  assert.deepEqual(scoreAt(0,counts,6).filter(e=>e.instrument==='gutter'),scoreAt(64,counts,6).filter(e=>e.instrument==='gutter'));
  assert.equal(scoreAt(124,counts,6).find(e=>e.instrument==='gutter').note,74);
  assert.deepEqual(scoreAt(128,counts,6),scoreAt(0,counts,6));
  assert.deepEqual(scoreAt(0,{mill:0,gutter:0,bell:0},0),[]);
});
