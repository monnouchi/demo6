import test from 'node:test';
import assert from 'node:assert/strict';
import {WIDTH,HEIGHT,createTown,build,undoChanges,restoreTown,waterNetwork} from '../src/core.js';
import {pondLayout} from '../src/water-shapes.js';

function townWith(points){const town=createTown();town.cells=Array(WIDTH*HEIGHT).fill(null);town.cells[4*WIDTH]={type:'spring'};for(const [x,y]of points)assert.equal(build(town,'canal',x,y).ok,true);return town;}
const rectangle=(x,y,w,h)=>Array.from({length:w*h},(_,i)=>[x+i%w,y+Math.floor(i/w)]);
const sorted=set=>[...set].sort((a,b)=>a-b);
test('a line or incomplete 2×2 stays a narrow canal',()=>{
  for(const points of [rectangle(2,2,4,1),rectangle(2,2,1,4),[[2,2],[3,2],[2,3]]])assert.equal(pondLayout(townWith(points)).cells.size,0);
});
test('2×2, 2×3 and 3×3 water rectangles have one surface and only perimeter banks',()=>{
  for(const [w,h]of [[2,2],[2,3],[3,3]]){
    const points=rectangle(2,2,w,h),layout=pondLayout(townWith(points));
    assert.deepEqual(sorted(layout.cells),points.map(([x,y])=>y*WIDTH+x).sort((a,b)=>a-b));
    assert.equal(layout.groups.length,1);assert.equal(layout.groups[0].boundary.length,2*w+2*h);
  }
});
test('overlapping blocks form an L without including an incomplete corner',()=>{
  const points=[...rectangle(2,2,2,2),...rectangle(3,2,2,2),...rectangle(2,3,2,2)];
  const town=townWith([...new Map(points.map(p=>[p.join(','),p])).values()]),layout=pondLayout(town);
  assert.equal(layout.cells.size,8);assert.equal(layout.groups.length,1);assert.equal(layout.cells.has(4*WIDTH+4),false);assert.equal(layout.groups[0].boundary.length,12);
});
test('a thin entrance joins separate basins without turning into another pond',()=>{
  const points=[...rectangle(2,2,2,2),...rectangle(6,2,2,2),[4,2],[5,2]],layout=pondLayout(townWith(points));
  assert.equal(layout.cells.size,8);assert.equal(layout.groups.length,2);
  for(const x of [4,5])assert.equal(layout.cells.has(2*WIDTH+x),false);
  assert.equal(layout.groups.reduce((n,g)=>n+g.ports.length,0),2);
});
test('pond shores have ports for water facilities, channels and sources, not independent voices',()=>{
  for(const type of ['mill','gutter','bell','tree','garden','cow','goat'])for(const [x,y]of [[1,2],[4,2],[2,1],[2,4]]){
    const town=townWith(rectangle(2,2,2,2));build(town,type,x,y);
    assert.equal(pondLayout(town).groups[0].ports.length,['mill','gutter','bell'].includes(type)?1:0);
  }
  const source=townWith(rectangle(1,3,2,2));assert.equal(pondLayout(source).groups[0].ports.length,1);
});
test('edge blocks do not wrap; closed water, delete/undo and saves keep the same model',()=>{
  const edge=townWith(rectangle(WIDTH-2,HEIGHT-2,2,2));assert.equal(pondLayout(edge).cells.size,4);assert.equal(pondLayout(edge).groups[0].boundary.length,8);
  const town=townWith(rectangle(2,2,2,2)),saved=JSON.stringify(town),network=waterNetwork(town);
  pondLayout(town);assert.equal(JSON.stringify(town),saved);assert.deepEqual(waterNetwork(town),network);
  build(town,'flow',2,2);assert.equal(pondLayout(town).cells.size,4);
  const removed=build(town,'remove',2,2);assert.equal(pondLayout(town).cells.size,0);
  undoChanges(town,[removed.change]);assert.equal(pondLayout(town).cells.size,4);
  assert.deepEqual(pondLayout(restoreTown(JSON.parse(JSON.stringify(town)))),pondLayout(town));
});
