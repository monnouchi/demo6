import test from 'node:test';import assert from 'node:assert/strict';
import {WIDTH,HEIGHT,ANIMAL_DIRECTIONS,createTown,build,moveBuilding,wanderAnimals,undoChanges,restoreTown,previewAction} from '../src/core.js';
import {buildingArt,icon} from '../src/art.js';
const directions=[['west',-1,0],['east',1,0],['north',0,-1],['south',0,1]];
function townWith(type='cow'){const town=createTown();town.cells=Array(WIDTH*HEIGHT).fill(null);town.cells[64]={type:'spring'};build(town,type,8,4);town.cells[72].facing='west';town.wanderSeed=0;return town;}
test('successful orthogonal walks face the actual direction without changing earlier edit snapshots',()=>{
  for(const type of ['cow','goat'])for(const [facing,dx,dy]of directions){
    const town=townWith(type),original=town.cells[72];for(const [,a,b]of directions)if(a!==dx||b!==dy)build(town,'canal',8+a,4+b);
    const moves=wanderAnimals(town),target=(4+dy)*WIDTH+8+dx;assert.equal(moves.length,1);assert.equal(moves[0].to,target);assert.equal(town.cells[target].facing,facing);assert.equal(town.cells[target].id,original.id);assert.equal(original.facing,'west');
  }
});
test('OFF, selection, blocked walks and skipped trials keep the last facing',()=>{
  const held=townWith();const id=held.cells[72].id,saved=JSON.stringify(held);assert.deepEqual(wanderAnimals(held,new Set([id])),[]);assert.equal(JSON.stringify(held),saved);
  const off=townWith();build(off,'flow',8,4);assert.deepEqual(wanderAnimals(off),[]);assert.equal(off.cells[72].facing,'west');build(off,'flow',8,4);assert.equal(off.cells[72].facing,'west');
  const blocked=townWith();for(const [,dx,dy]of directions)build(blocked,'canal',8+dx,4+dy);assert.deepEqual(wanderAnimals(blocked),[]);assert.equal(blocked.cells[72].facing,'west');
  const skipped=townWith();while(((Math.imul(skipped.wanderSeed,1664525)+1013904223)>>>0)%5!==0)skipped.wanderSeed++;assert.deepEqual(wanderAnimals(skipped),[]);assert.equal(skipped.cells[72].facing,'west');
});
test('manual moves, previews and Undo retain identity, OFF and the prior pose',()=>{
  for(const type of ['cow','goat'])for(const [facing,dx,dy]of directions){
    const town=townWith(type);build(town,'flow',8,4);const saved=JSON.stringify(town);assert.equal(previewAction(town,'move',8+dx,4+dy,[8,4]).ok,true);assert.equal(JSON.stringify(town),saved);
    const move=moveBuilding(town,[8,4],[8+dx,4+dy]),animal=town.cells[(4+dy)*WIDTH+8+dx];assert.equal(move.ok,true);assert.equal(animal.facing,facing);assert.equal(animal.enabled,false);undoChanges(town,move.changes);assert.equal(JSON.stringify(town),saved);
    assert.equal(moveBuilding(town,[8,4],[0,4]).ok,false);assert.equal(JSON.stringify(town),saved);
  }
  const diagonal=townWith();moveBuilding(diagonal,[8,4],[10,7]);assert.equal(diagonal.cells[122].facing,'south');
});
test('directionless v3/v4 animals safely face right and valid directions round-trip',()=>{
  for(const version of [3,4]){const old=townWith('goat');old.version=version;delete old.cells[72].facing;const raw=JSON.stringify(old),restored=restoreTown(old);assert.equal(restored.cells[72].facing,'east');assert.equal(JSON.stringify(old),raw);}
  for(const facing of ANIMAL_DIRECTIONS){const town=townWith();town.cells[72].facing=facing;assert.deepEqual(restoreTown(JSON.parse(JSON.stringify(town))),town);}
  for(const facing of [null,1,'diagonal','<svg>',{},[]]){const town=townWith();town.cells[72].facing=facing;assert.throws(()=>restoreTown(town),/向き/);}
});
test('Undo after roaming restores the animal move pose and displacement faces its real destination',()=>{
  const town=townWith(),move=moveBuilding(town,[8,4],[9,4]);for(let i=0;i<5;i++)wanderAnimals(town);undoChanges(town,move.changes);assert.equal(town.cells[72].facing,'west');assert.equal(town.cells.filter(c=>c?.type==='cow').length,1);
  const displaced=townWith('goat');build(displaced,'garden',7,4);const remove=build(displaced,'remove',7,4);moveBuilding(displaced,[8,4],[7,4]);undoChanges(displaced,[remove.change]);const index=displaced.cells.findIndex(c=>c?.type==='goat');assert.equal(displaced.cells[71].type,'garden');assert.equal(displaced.cells[index].facing,index%16<7?'west':index%16>7?'east':index<71?'north':'south');
});
test('mirrors stay inside the animated body, while front/back are authored upright poses',()=>{
  for(const type of ['cow','goat']){
    for(const facing of ANIMAL_DIRECTIONS){const art=buildingArt(type,false,0,facing);assert.ok(art.includes(`data-facing="${facing}"`));assert.ok(art.includes('class="animal-pose"'));assert.ok(!art.includes('scale(1 -1)'));}
    assert.ok(buildingArt(type,false,0,'west').includes('transform="scale(-1 1)"'));assert.ok(!buildingArt(type,false,0,'north').includes('scale('));assert.notEqual(buildingArt(type,false,0,'north'),buildingArt(type,false,0,'south'));assert.ok(icon(type).includes('data-facing="east"'));
  }
});
