// Run in an isolated Page. Fixtures use the same JSON import as a player's save.
export default async function pondSmoke(page,url='http://127.0.0.1:5176/'){
  await page.setViewportSize({width:390,height:659});await page.goto(url);await page.locator('#start-silent').click();
  const load=async(points,extra=[])=>{
    const town=await page.evaluate(async({points,extra})=>{
      const {WIDTH,HEIGHT,createTown,build}=await import('./src/core.js?v=0.6.3');
      const t=createTown();t.cells=Array(WIDTH*HEIGHT).fill(null);t.cells[4*WIDTH]={type:'spring'};
      for(const [x,y]of points)build(t,'canal',x,y);
      for(const [type,x,y]of extra){build(t,type,x,y);if(type==='cow'||type==='goat')build(t,'flow',x,y);}
      return t;
    },{points,extra});
    await page.locator('#menu-button').click();await page.locator('#import-input').evaluate((input,t)=>{
      const transfer=new DataTransfer();transfer.items.add(new File([JSON.stringify(t)],'pond.json',{type:'application/json'}));input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));
    },town);await page.waitForFunction(()=>!document.querySelector('#menu-dialog').open);await page.locator('#camera-reset').click();
  };
  const rectangle=(x,y,w,h)=>Array.from({length:w*h},(_,i)=>[x+i%w,y+Math.floor(i/w)]);
  const shapes=[];
  for(const [name,points,count]of [
    ['line',rectangle(3,2,4,1),0],['2×2',rectangle(3,2,2,2),1],['2×3',rectangle(3,2,2,3),1],['3×3',rectangle(3,2,3,3),1],
    ['overlapping L',[...rectangle(3,2,3,2),...rectangle(3,4,2,1)],1],
    ['thin neck',[...rectangle(3,2,2,2),[5,2],[6,2],...rectangle(7,2,2,2)],2],
  ]){await load(points);const actual=await page.locator('[data-pond]').count();if(actual!==count)throw new Error(name+' pond count: '+actual);shapes.push({name,ponds:actual});}
  await load([[1,4],[2,4],...rectangle(3,2,3,3)],[['mill',2,5],['gutter',6,3],['tree',6,2],['garden',4,1],['goat',2,2],['cow',7,4]]);
  const inspect=()=>page.evaluate(()=>({ponds:document.querySelectorAll('[data-pond]').length,inlets:[...document.querySelectorAll('[data-water-receiver]')].map(n=>Number(n.dataset.waterReceiver)),overflow:document.documentElement.scrollWidth>innerWidth,saved:JSON.parse(localStorage.getItem('mon.demo6.composition.v2'))}));
  const stableTown=t=>JSON.stringify({...t,elapsed:0}); // Weather time advances during play.
  const before=await inspect();if(before.ponds!==1||before.inlets.join(',')!=='54,82')throw new Error('Pond receiver classification: '+JSON.stringify(before.inlets));
  for(const width of [320,390]){await page.setViewportSize({width,height:659});await page.locator('button[data-tool=canal]').click();if((await inspect()).overflow)throw new Error('Horizontal overflow '+width);await page.screenshot({path:`output/playwright/pond-${width}.png`});}
  await page.locator('button[data-tool=move]').click();await page.locator('.cell-hit[data-x="4"][data-y="3"]').click();for(let i=0;i<4;i++)await page.locator('#zoom-in').click();await page.screenshot({path:'output/playwright/pond-zoom.png'});await page.locator('#camera-reset').click();
  const pixels=await page.evaluate(async()=>{
    const {captureTown}=await import('./src/photo.js?v=0.6.4'),blob=await captureTown(document.querySelector('#town'),'whole'),bitmap=await createImageBitmap(blob),canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;const c=canvas.getContext('2d');c.drawImage(bitmap,0,0);
    const sample=(x,y)=>[...c.getImageData(x*2,y*2,1,1).data].slice(0,3).join(',');
    return {seams:[[288,240],[352,240],[300,239],[330,297],[288,297],[352,297]].map(([x,y])=>sample(x,y)),mouth:sample(220,330),plantShore:sample(420,210),inside:sample(300,240)};
  });
  if(pixels.seams.some(c=>c!==pixels.inside)||pixels.inside!=='133,185,176'||pixels.mouth!==pixels.inside||pixels.plantShore!=='198,185,145')throw new Error('Pond pixels retain a divider or plugged mouth: '+JSON.stringify(pixels));
  await page.locator('#photo-button').click();await page.waitForFunction(()=>!document.querySelector('#photo-download').disabled);const crop=await page.locator('#photo-preview').evaluate(n=>({width:n.naturalWidth,height:n.naturalHeight}));
  const download=page.waitForEvent('download');await page.locator('#photo-download').click();await(await download).saveAs('output/playwright/pond-photo.png');
  await page.locator('#photo-framing').selectOption('whole');await page.waitForFunction(()=>!document.querySelector('#photo-download').disabled&&document.querySelector('#photo-preview').naturalWidth===2176);const whole=await page.locator('#photo-preview').evaluate(n=>({width:n.naturalWidth,height:n.naturalHeight}));
  await page.locator('#photo-dialog .dialog-close').click();if(stableTown((await inspect()).saved)!==stableTown(before.saved))throw new Error('Viewing or photographing changed the saved town.');
  await page.reload();await page.locator('#start-silent').click();if(stableTown((await inspect()).saved)!==stableTown(before.saved)||(await inspect()).ponds!==1)throw new Error('Pond save/reload changed town.');
  await load([[1,4],[2,4],[4,1],[6,3],[4,5],...rectangle(3,2,3,3)]);
  const mouths=await page.evaluate(async()=>{
    const {captureTown}=await import('./src/photo.js?v=0.6.4'),bitmap=await createImageBitmap(await captureTown(document.querySelector('#town'),'whole')),canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;const c=canvas.getContext('2d');c.drawImage(bitmap,0,0);
    return [[220,330],[324,177],[420,272],[324,359]].map(([x,y])=>[...c.getImageData(x*2,y*2,1,1).data].slice(0,3).join(','));
  });if(mouths.some(color=>color!=='133,185,176'))throw new Error('A four-direction mouth is blocked: '+JSON.stringify(mouths));
  await load([[1,4],[2,4],...rectangle(3,3,2,2)]);
  await page.locator('button[data-tool=remove]').click();const hit=await page.locator('.cell-hit[data-x="4"][data-y="3"]').boundingBox();await page.touchscreen.tap(hit.x+hit.width/2,hit.y+hit.height/2);if(await page.locator('[data-pond]').count())throw new Error('Broken 2×2 did not revert to canals.');
  await page.locator('#undo-button').click();if(await page.locator('[data-pond]').count()!==1)throw new Error('Undo failed to restore pond.');
  await page.locator('button[data-tool=flow]').click();await page.locator('.cell-hit[data-x="3"][data-y="3"]').click();if(await page.locator('[data-pond]').count()!==1||!await page.locator('[data-canal-gate="51"]').count())throw new Error('Closed gate changed the pond shape or disappeared.');
  return {shapes,pixels,mouths,crop,whole,reload:true,touchDeleteUndo:true,gate:true};
}
