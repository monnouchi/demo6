import test from 'node:test';import assert from 'node:assert/strict';
import {createTown,build,waterNetwork,restoreTown} from '../src/core.js';
import {canalLayout,pondLayout} from '../src/water-shapes.js';import {renderTown} from '../src/render.js';
function fixture(points,source=[0,4]){const t=createTown();t.cells=Array(144).fill(null);t.cells[source[1]*16+source[0]]={type:'spring'};for(const [x,y]of points)build(t,'canal',x,y);return t;}
const ms=path=>(path.match(/M/g)||[]).length;
test('straight channel flow crosses every tile in one trail including its source',()=>{
  const h=canalLayout(fixture(Array.from({length:12},(_,i)=>[i+1,4])));assert.equal(ms(h.flowPath),1);assert.ok(h.flowPath.startsWith('M64 326L128 326'));assert.ok(h.flowPath.endsWith('L832 326'));
  const v=canalLayout(fixture(Array.from({length:7},(_,i)=>[8,i+1]),[8,0]));assert.equal(ms(v.flowPath),1);assert.ok(v.flowPath.includes('576 94'));assert.ok(v.flowPath.includes('576 500'));
});
test('turns, branches and cycles never duplicate the same flow edge',()=>{
  const cases=[{p:[[1,4],[2,4],[2,3],[2,2]],trails:1},{p:[[1,4],[2,4],[3,4],[2,3],[2,2]],trails:3},{p:[[1,4],[2,4],[3,4],[2,3],[2,5]],trails:4},{p:[[4,2],[5,2],[6,2],[4,3],[6,3],[4,4],[5,4],[6,4]],trails:1}];
  for(const {p,trails}of cases){const t=fixture(p),layout=canalLayout(t);assert.equal(ms(layout.flowPath),trails);const edges=new Set();for(const trail of layout.flowPath.split(' ').join(' ').match(/M[^M]+/g)){const points=[...trail.matchAll(/[ML](-?\d+) (-?\d+)/g)].map(m=>m[1]+','+m[2]);for(let i=1;i<points.length;i++){const edge=[points[i-1],points[i]].sort().join(':');assert.equal(edges.has(edge),false);edges.add(edge);}}assert.ok(edges.size>0);}
});
test('only sources, mills and gutters get inlet geometry, including pond mouths',()=>{
  for(const type of ['mill','gutter','bell','tree','garden','cow','goat']){const t=fixture([[1,4],[2,4]]);build(t,type,2,3);const layout=canalLayout(t);assert.equal(layout.inlets.some(i=>i.to===50),['mill','gutter'].includes(type));}
  const t=fixture([[1,4],[2,4],[3,4],[3,3],[4,4],[4,3]]);build(t,'gutter',5,3);const layout=canalLayout(t);assert.equal(pondLayout(t).groups.length,1);assert.ok(layout.inlets.some(i=>i.to===53));assert.ok(layout.path.includes('M320 268L364 268'));
});
test('painting layers and clipped wet state cannot alter water, sound or save data',()=>{
  const t=fixture([[1,4],[2,4],[3,4],[4,4],[5,4]]);build(t,'flow',3,4);const original=JSON.stringify(t),network=waterNetwork(t),svg={innerHTML:'',dataset:{}};renderTown(svg,t,network,'flow');assert.equal(JSON.stringify(t),original);assert.deepEqual(waterNetwork(t),network);assert.deepEqual(restoreTown(t),t);
  const html=svg.innerHTML;assert.equal((html.match(/class="canal-bank"/g)||[]).length,1);assert.ok(html.indexOf('class="canal-bank"')<html.indexOf('class="canal-bed"'));assert.ok(html.indexOf('class="canal-bed"')<html.indexOf('class="canal-water"'));assert.ok(html.includes('mask="url(#canal-wet)"'));assert.ok(html.includes('data-canal-gate="67"'));
});
