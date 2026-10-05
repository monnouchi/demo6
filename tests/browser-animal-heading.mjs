// Isolated hasTouch:true Page. All test animals are player-created fixtures.
export default async function animalHeadingSmoke(page,url='http://127.0.0.1:5176/'){
  await page.setViewportSize({width:1280,height:900});await page.goto(url);await page.locator('#start-silent').click();
  const load=async config=>{
    const town=await page.evaluate(async config=>{
      const {WIDTH,HEIGHT,createTown,build}=await import('./src/core.js?v=0.6.8'),town=createTown();town.cells=Array(WIDTH*HEIGHT).fill(null);town.cells[64]={type:'spring'};town.weather='clear';town.wanderSeed=0;
      for(const a of config.animals){build(town,a.type,a.x,a.y);Object.assign(town.cells[a.y*WIDTH+a.x],{facing:a.facing,enabled:a.enabled??true});if(a.legacy)delete town.cells[a.y*WIDTH+a.x].facing;}
      for(const [x,y]of config.blocks??[])build(town,'canal',x,y);town.version=config.version??4;return town;
    },config);
    await page.locator('#menu-button').click();await page.locator('#import-input').evaluate((input,t)=>{const transfer=new DataTransfer();transfer.items.add(new File([JSON.stringify(t)],'animals.json',{type:'application/json'}));input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));},town);await page.waitForFunction(()=>!document.querySelector('#menu-dialog').open);await page.locator('#camera-reset').click();
  };
  const inspect=()=>page.evaluate(()=>{const town=JSON.parse(localStorage.getItem('mon.demo6.composition.v2'));return town.cells.flatMap((c,index)=>['cow','goat'].includes(c?.type)?[{...c,index,drawn:document.querySelector(`[data-animal-id="${c.id}"] .animal-body`)?.dataset.facing}]:[]);});
  const tap=async(x,y)=>{const b=await page.locator(`.cell-hit[data-x="${x}"][data-y="${y}"]`).boundingBox();await page.touchscreen.tap(b.x+b.width/2,b.y+b.height/2);};
  const directions=[['east',1,0],['west',-1,0],['north',0,-1],['south',0,1]],animals=[],blocks=[];
  for(const [type,y]of [['cow',3],['goat',6]])directions.forEach(([facing],i)=>{const x=3+i*3;animals.push({type,x,y,facing});for(const [,dx,dy]of directions)blocks.push([x+dx,y+dy]);});
  await page.emulateMedia({reducedMotion:'reduce'});await load({animals,blocks});
  const poses=await inspect();if(poses.length!==8||poses.some(a=>a.facing!==a.drawn))throw Error('Saved and drawn animal poses differ.');
  await page.screenshot({path:'output/playwright/heading-pc.png'});
  for(const width of [320,390]){
    await page.setViewportSize({width,height:659});await page.locator('#camera-reset').click();await page.screenshot({path:`output/playwright/heading-${width}.png`});
    for(const animal of animals){await page.locator('#camera-reset').click();await page.locator('button[data-tool=move]').click();await tap(animal.x,animal.y);for(let i=0;i<4;i++)await page.locator('#zoom-in').click();await page.screenshot({path:`output/playwright/heading-${animal.type}-${animal.facing}-${width}.png`});}
    if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Animal headings overflow the mobile view.');
  }
  await page.locator('#camera-reset').click();await page.locator('#photo-button').click();await page.waitForFunction(()=>!document.querySelector('#photo-download').disabled);const photoDownload=page.waitForEvent('download');await page.locator('#photo-download').click();await(await photoDownload).saveAs('output/playwright/heading-photo.png');await page.locator('#photo-dialog .dialog-close').click();
  await page.reload();await page.locator('#start-silent').click();if((await inspect()).some(a=>a.facing!==a.drawn)||JSON.stringify((await inspect()).map(a=>[a.id,a.index,a.facing]))!==JSON.stringify(poses.map(a=>[a.id,a.index,a.facing])))throw Error('Reload changed animal directions.');
  await page.setViewportSize({width:390,height:659});await page.emulateMedia({reducedMotion:'no-preference'});
  // Four forced successful walk directions, without calling the walker from UI tests.
  const walks=[];
  for(const [facing,dx,dy]of directions){
    const pair=[{type:'cow',x:6,y:3,facing:'north'},{type:'goat',x:10,y:6,facing:'west'}],barriers=[];
    for(const a of pair)for(const [,aX,aY]of directions)if(aX!==dx||aY!==dy)barriers.push([a.x+aX,a.y+aY]);await load({animals:pair,blocks:barriers});
    await page.waitForFunction(({facing,dx,dy})=>{const t=JSON.parse(localStorage.getItem('mon.demo6.composition.v2'));return [[6,3],[10,6]].every(([x,y])=>t.cells[(y+dy)*16+x+dx]?.facing===facing);},{facing,dx,dy},{timeout:7000});
    const moved=await inspect();if(moved.some(a=>a.facing!==facing||a.drawn!==facing))throw Error('Walking pose did not follow the real move.');walks.push({facing,indices:moved.map(a=>a.index)});await page.locator('button[data-tool=flow]').click();for(const a of moved)await tap(a.index%16,Math.floor(a.index/16));
  }
  // Selected animals remain still, OFF preserves the pose, and resume only turns on a move.
  await load({animals:[{type:'cow',x:8,y:4,facing:'north'}],blocks:[[7,4],[8,3],[8,5]]});await page.locator('button[data-tool=move]').click();await tap(8,4);await page.waitForTimeout(5900);let state=await inspect();if(state[0].index!==72||state[0].facing!=='north')throw Error('Selected animal turned or wandered.');
  await page.locator('button[data-tool=flow]').click();await tap(8,4);await page.waitForTimeout(5900);state=await inspect();if(state[0].index!==72||state[0].facing!=='north'||state[0].enabled)throw Error('OFF animal turned or wandered.');await tap(8,4);if((await inspect())[0].facing!=='north')throw Error('Resume turned before moving.');
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('mon.demo6.composition.v2')).cells[73]?.facing==='east',{},{timeout:7000});await page.locator('button[data-tool=flow]').click();await tap(9,4);const resumed=await inspect();
  // Stopped animals can be repositioned and Undo restores the previous facing.
  await load({animals:[{type:'cow',x:8,y:4,facing:'east',enabled:false},{type:'goat',x:12,y:6,facing:'east',enabled:false}]});const manual=[];
  for(const a of [{type:'cow',x:8,y:4},{type:'goat',x:12,y:6}])for(const [facing,dx,dy]of directions){await page.locator('button[data-tool=move]').click();await tap(a.x,a.y);await tap(a.x+dx,a.y+dy);const moved=(await inspect()).find(c=>c.type===a.type);if(moved.facing!==facing||moved.drawn!==facing||moved.enabled)throw Error('Manual move changed OFF or drew the wrong facing.');manual.push({type:a.type,facing});await page.locator('#undo-button').click();const restored=(await inspect()).find(c=>c.type===a.type);if(restored.facing!=='east'||restored.index!==a.y*16+a.x)throw Error('Animal Undo did not restore its pose.');}
  for(const version of [3,4]){await load({version,animals:[{type:'cow',x:8,y:4,legacy:true,enabled:false},{type:'goat',x:12,y:6,legacy:true,enabled:false}]});if((await inspect()).some(a=>a.facing!=='east'||a.drawn!=='east'))throw Error('Directionless old save has an unsafe pose.');}
  return {poses:poses.map(a=>({type:a.type,facing:a.facing,index:a.index})),walks,selectedOffResume:true,resumed:resumed.map(a=>({facing:a.facing,index:a.index,enabled:a.enabled})),manual,photo:true,reload:true,oldVersions:[3,4]};
}
