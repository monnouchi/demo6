import test from 'node:test';
import assert from 'node:assert/strict';
import {WIDTH,HEIGHT,createTown,build,waterNetwork,waterRole,receivesWater,connectsToCanal} from '../src/core.js';
import {renderTown,center} from '../src/render.js';

const directions=[[-1,0],[1,0],[0,-1],[0,1]];
function fixture(type,dx,dy){
  const town=createTown();town.cells=Array(WIDTH*HEIGHT).fill(null);town.cells[4*WIDTH]={type:'spring'};
  const routeY=dy===-1?6:2;
  const put=(tool,x,y)=>{if(town.cells[y*WIDTH+x])return;assert.equal(build(town,tool,x,y).ok,true);};
  for(let y=Math.min(4,routeY);y<=Math.max(4,routeY);y++)put('canal',0,y);
  for(let x=1;x<=8;x++)put('canal',x,routeY);
  for(let y=Math.min(4,routeY);y<=Math.max(4,routeY);y++)put('canal',8,y);
  put(type,8+dx,4+dy);
  return town;
}
function drawing(town){const svg={innerHTML:'',dataset:{}};renderTown(svg,town,waterNetwork(town),'flow');return svg.innerHTML;}

test('sources, channels, receivers and independent voices have explicit water capabilities',()=>{
  assert.equal(waterRole('spring'),'source');assert.equal(waterRole('canal'),'channel');
  for(const type of ['mill','gutter','bell']){assert.equal(receivesWater(type),true);assert.equal(connectsToCanal(type),true);}
  for(const type of ['tree','garden','cow','goat']){assert.equal(waterRole(type),'independent');assert.equal(connectsToCanal(type),false);}
  for(const type of [undefined,'remove','unknown','__proto__'])assert.equal(waterRole(type),null);
});
test('each facility has the same four-direction water capability in the model and SVG',()=>{
  for(const type of ['mill','gutter','bell','tree','garden','cow','goat'])for(const [dx,dy]of directions){
    const town=fixture(type,dx,dy),index=(4+dy)*WIDTH+8+dx;
    let network=waterNetwork(town),building=network.buildings.find(b=>b.index===index);
    assert.equal(building.active,true,`${type} is playable beside water`);
    assert.equal(building.waterConnected,receivesWater(type));
    const html=drawing(town),path=html.match(/data-canal="72" d="([^"]*)"/)[1],a=center(8,4),b=center(8+dx,4+dy),arm=`M${a[0]} ${a[1]}L${(a[0]+b[0])/2} ${(a[1]+b[1])/2}`;
    assert.equal(path.includes(arm),receivesWater(type),`${type}: canal arm ${dx},${dy}`);
    assert.equal(html.includes(`data-water-receiver="${index}"`),receivesWater(type),`${type}: facility-side inlet`);
    build(town,'flow',8,4);network=waterNetwork(town);building=network.buildings.find(b=>b.index===index);
    assert.equal(building.waterConnected,false);
    assert.equal(building.active,!receivesWater(type),`${type}: closing supply only stops receivers`);
    assert.equal(drawing(town).includes(`data-water-receiver="${index}"`),false);
  }
});
test('canal arms still join both other channels and the spring',()=>{
  const town=createTown(),html=drawing(town),a=center(1,4),spring=center(0,4),canal=center(2,4),path=html.match(/data-canal="65" d="([^"]*)"/)[1];
  for(const b of [spring,canal])assert.ok(path.includes(`M${a[0]} ${a[1]}L${(a[0]+b[0])/2} ${(a[1]+b[1])/2}`));
});
