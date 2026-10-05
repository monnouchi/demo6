import test from 'node:test';
import assert from 'node:assert/strict';
import {WIDTH,HEIGHT,createTown,build,moveBuilding,previewAction,waterNetwork,undoChanges,restoreTown} from '../src/core.js';
import {scoreAt} from '../src/music.js';
import {renderTown} from '../src/render.js';
const springs=t=>t.cells.flatMap((cell,index)=>cell?.type==='spring'?[index]:[]);

test('spring moves atomically into empty land and Undo restores the original network',()=>{
  const town=createTown(),before=JSON.stringify(town),network=waterNetwork(town),preview=previewAction(town,'move',10,2,[0,4]);
  assert.equal(preview.ok,true);assert.equal(JSON.stringify(town),before);assert.equal(preview.after.activeCount,0);
  const move=moveBuilding(town,[0,4],[10,2]);assert.equal(move.ok,true);assert.deepEqual(springs(town),[42]);assert.equal(town.cells[64],null);
  assert.equal(waterNetwork(town).wet.has('0,4'),false);assert.equal(waterNetwork(town).activeCount,0);
  assert.equal(undoChanges(town,move.changes),true);assert.equal(JSON.stringify(town),before);assert.deepEqual(waterNetwork(town),network);
});
test('occupied targets and board edges cannot delete, duplicate or replace the source',()=>{
  for(const target of [[1,4],[2,5],[0,4],[-1,4],[16,4],[0,-1],[0,9]]){
    const town=createTown(),before=JSON.stringify(town);assert.equal(moveBuilding(town,[0,4],target).ok,false);assert.equal(JSON.stringify(town),before);
  }
  for(const [x,y]of [[0,0],[15,0],[0,8],[15,8]]){
    const town=createTown();assert.equal(moveBuilding(town,[0,4],[x,y]).ok,true);assert.deepEqual(springs(town),[y*WIDTH+x]);
    for(const tool of ['flow','remove','mill'])assert.equal(build(town,tool,x,y).ok,false);
    assert.equal(build(town,'spring',7,7).ok,false);assert.equal(waterNetwork(town).wet.size,1);
    const svg={innerHTML:'',dataset:{}};renderTown(svg,town,waterNetwork(town),'move');assert.ok(svg.innerHTML.includes(`data-building="${y*WIDTH+x}"`));assert.deepEqual(restoreTown(town),town);
  }
});
test('water and notes come from the moved source, including an instrument on its old cell',()=>{
  const town=createTown();build(town,'canal',10,3);build(town,'gutter',11,3);moveBuilding(town,[0,4],[10,2]);
  let network=waterNetwork(town);assert.equal(network.wet.has('10,3'),true);assert.equal(network.wet.has('1,4'),false);assert.equal(scoreAt(11,network)[0].instrument,'gutter');
  assert.equal(build(town,'mill',0,4).ok,true);assert.equal(scoreAt(0,waterNetwork(town)).length,0);
  for(let x=5;x<=10;x++)assert.equal(build(town,'canal',x,4).ok,true);
  network=waterNetwork(town);assert.equal(network.wet.has('1,4'),true);assert.equal(scoreAt(0,network)[0].instrument,'mill');assert.equal(scoreAt(2,network)[0].instrument,'mill');
  build(town,'flow',10,3);assert.equal(waterNetwork(town).activeCount,0);
});
test('moved v3 sources round-trip while original v2/v3 files still load',()=>{
  const original=createTown();assert.deepEqual(restoreTown(original),original);
  const old={...original,version:2,wood:198};assert.deepEqual(restoreTown(old),original);
  const town=createTown();moveBuilding(town,[0,4],[15,8]);assert.deepEqual(restoreTown(JSON.parse(JSON.stringify({...town,version:3}))),town);
  for(const mutate of [t=>{t.cells[64]=null;},t=>{t.cells[0]={type:'spring'};}]){const bad=structuredClone(original);mutate(bad);assert.throws(()=>restoreTown(bad));}
  const oldMoved={...town,version:2,wood:198};assert.throws(()=>restoreTown(oldMoved));
});
test('Undo frees the old source cell without losing an instrument or the single spring',()=>{
  const town=createTown(),original=JSON.stringify(town),move=moveBuilding(town,[0,4],[15,8]),building=build(town,'bell',0,4);
  assert.equal(building.ok,true);undoChanges(town,[building.change]);undoChanges(town,move.changes);assert.equal(JSON.stringify(town),original);assert.deepEqual(springs(town),[64]);
});
test('random moves and Undo always preserve one source and valid saves',()=>{
  const town=createTown(),history=[];let seed=7381;
  for(let i=0;i<300;i++){
    seed=(Math.imul(seed,1664525)+1013904223)>>>0;
    if(seed%5===0&&history.length)undoChanges(town,history.pop());else{
      const index=springs(town)[0],target=seed%(WIDTH*HEIGHT),move=moveBuilding(town,[index%WIDTH,Math.floor(index/WIDTH)],[target%WIDTH,Math.floor(target/WIDTH)]);if(move.ok)history.push(move.changes);
    }
    assert.equal(springs(town).length,1);assert.deepEqual(restoreTown(JSON.parse(JSON.stringify(town))),town);
  }
  town.cells[springs(town)[0]]=null;assert.equal(waterNetwork(town).wet.size,0);
});
