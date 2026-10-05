import test from 'node:test';
import assert from 'node:assert/strict';
import {WIDTH,HEIGHT,TYPES,createTown,build,moveBuilding,waterNetwork,restoreTown,undoChanges} from '../src/core.js';
import {scoreAt} from '../src/music.js';
import {renderTown} from '../src/render.js';
const put=(t,type,x,y)=>{const r=build(t,type,x,y);assert.equal(r.ok,true);return r.change;};
function bare(){const t=createTown();t.cells=Array(WIDTH*HEIGHT).fill(null);t.cells[64]={type:'spring'};return t;}

test('new bells play without water, with the same pitch, beat and longhouse lengths',()=>{
  for(const span of [1,2,4,16]){
    const town=bare();for(let x=0;x<span;x++)put(town,'bell',x,2);
    const network=waterNetwork(town),note=scoreAt(0,network)[0];assert.equal(network.activeCount,span);assert.equal(note.note,76);assert.equal(note.span,span);assert.equal(note.length,span+3);
    assert.equal(scoreAt(1,network).length,0);assert.deepEqual(scoreAt(16,network),scoreAt(0,network));
    const svg={innerHTML:'',dataset:{}};renderTown(svg,town,network,'bell');assert.ok(!svg.innerHTML.includes('data-water-receiver'));assert.ok(svg.innerHTML.includes('bell-swing'));
    if(span>1)assert.ok(svg.innerHTML.includes('class="longhouse"'));
  }
});
test('water gates and source moves only affect mills and gutters, not enabled bells',()=>{
  const town=createTown();put(town,'gutter',1,3);put(town,'bell',6,2);put(town,'flow',1,4);
  let network=waterNetwork(town);assert.deepEqual(network.buildings.filter(b=>b.active).map(b=>b.type),['bell']);assert.equal(scoreAt(6,network)[0].instrument,'bell');
  moveBuilding(town,[0,4],[15,8]);network=waterNetwork(town);assert.deepEqual(network.buildings.filter(b=>b.active).map(b=>b.type),['bell']);assert.equal(TYPES.bell.demand,0);
});
test('bell OFF, move and remove split the phrase and Undo restores it without water',()=>{
  for(const tool of ['flow','move','remove']){
    const town=bare();for(let x=1;x<=3;x++)put(town,'bell',x,3);const before=JSON.stringify(town);
    const edit=tool==='move'?moveBuilding(town,[2,3],[6,3]):build(town,tool,2,3);assert.equal(edit.ok,true);assert.equal(waterNetwork(town).groups.filter(g=>g.type==='bell'&&g.span>1).length,0);
    undoChanges(town,edit.changes??[edit.change]);assert.equal(JSON.stringify(town),before);assert.equal(scoreAt(1,waterNetwork(town))[0].span,3);
  }
});
test('v3 migration retains supplied houses, dry rests and explicit OFF without changing the input',()=>{
  const town=createTown();for(const [x,y]of [[1,3],[2,3],[3,3],[10,7],[11,7],[12,7]])put(town,'bell',x,y);put(town,'flow',12,7);town.version=3;town.scene='evening';town.weather='rain';town.backing=false;
  const raw=JSON.stringify(town),restored=restoreTown(town);assert.equal(JSON.stringify(town),raw);assert.equal(restored.version,4);
  for(const x of [1,2,3])assert.equal(restored.cells[3*WIDTH+x].enabled,true);
  for(const x of [10,11,12])assert.equal(restored.cells[7*WIDTH+x].enabled,false);
  assert.deepEqual(restored.cells.filter(c=>c?.type!=='bell'),town.cells.filter(c=>c?.type!=='bell'));assert.equal(restored.scene,town.scene);assert.equal(restored.weather,town.weather);assert.equal(restored.backing,town.backing);
  assert.equal(scoreAt(1,waterNetwork(restored))[0].span,3);assert.equal(scoreAt(10,waterNetwork(restored)).length,0);assert.deepEqual(restoreTown(restored),restored);
  put(restored,'flow',10,7);assert.equal(scoreAt(10,waterNetwork(restored))[0].instrument,'bell');assert.equal(restoreTown(restored).cells[122].enabled,true);
});
test('legacy OFF gaps and row edges never share water between separate bell houses',()=>{
  const town=bare();for(const y of [2,3,4])put(town,'canal',1,y);for(const x of [1,2,3])put(town,'bell',x,1);put(town,'flow',2,1);town.version=3;
  const restored=restoreTown(town);assert.equal(restored.cells[17].enabled,true);assert.equal(restored.cells[18].enabled,false);assert.equal(restored.cells[19].enabled,false);
  const edge=bare();put(edge,'canal',0,3);put(edge,'bell',15,2);put(edge,'bell',0,2);edge.version=3;const e=restoreTown(edge);assert.equal(e.cells[47].enabled,false);assert.equal(e.cells[32].enabled,true);
});
test('v2 and moved-source v3 bell migration use the actual old water supply',()=>{
  const old=createTown();put(old,'bell',1,3);put(old,'bell',10,7);old.version=2;old.wood=158;const a=restoreTown(old);assert.equal(a.cells[49].enabled,true);assert.equal(a.cells[122].enabled,false);
  const moved=bare();moveBuilding(moved,[0,4],[15,8]);put(moved,'bell',14,8);put(moved,'bell',0,4);moved.version=3;const b=restoreTown(moved);assert.equal(b.cells[142].enabled,true);assert.equal(b.cells[64].enabled,false);assert.equal(b.cells[143].type,'spring');
});
test('v4 keeps an explicitly enabled dry bell on through every save round trip',()=>{
  const town=bare();put(town,'bell',15,8);const restored=restoreTown(JSON.parse(JSON.stringify(town)));assert.deepEqual(restored,town);assert.equal(restored.cells[143].enabled,true);assert.equal(scoreAt(15,waterNetwork(restored))[0].instrument,'bell');
});
