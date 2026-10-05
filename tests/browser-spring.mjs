// Use an isolated Page in a context with hasTouch:true.
export default async function springMoveSmoke(page,url='http://127.0.0.1:5176/'){
  await page.setViewportSize({width:390,height:659});await page.goto(url);await page.locator('#start-silent').click();await page.locator('#camera-reset').click();await page.waitForFunction(()=>!!localStorage.getItem('mon.demo6.composition.v2'));
  const inspect=()=>page.evaluate(async()=>{
    const {waterNetwork}=await import('./src/core.js?v=0.6.6'),{scoreAt}=await import('./src/music.js?v=0.6.5'),town=JSON.parse(localStorage.getItem('mon.demo6.composition.v2')),network=waterNetwork(town);
    return {town,sources:town.cells.flatMap((c,i)=>c?.type==='spring'?[i]:[]),wet:[...network.wet.keys()],notes:scoreAt(0,network),overflow:document.documentElement.scrollWidth>innerWidth};
  });
  const tap=async(x,y)=>{const b=await page.locator(`.cell-hit[data-x="${x}"][data-y="${y}"]`).boundingBox();await page.touchscreen.tap(b.x+b.width/2,b.y+b.height/2);};
  const sourceIs=async index=>{const s=await inspect();if(s.sources.length!==1||s.sources[0]!==index)throw Error('Spring changed or duplicated: '+JSON.stringify(s.sources));return s;};
  const chooseMove=()=>page.locator('button[data-tool=move]').click();
  await chooseMove();await tap(0,4);await tap(1,4);await sourceIs(64); // Occupied canal cannot be replaced.
  await chooseMove();await tap(0,4);await tap(2,5);const occupied=await sourceIs(64);if(occupied.town.cells[82]?.type!=='mill')throw Error('Occupied facility was replaced.');
  await chooseMove();await tap(0,4);await tap(0,4);await tap(15,8);await sourceIs(64); // Same-cell cancel.
  await chooseMove();await tap(0,4);await page.locator('button[data-tool=mill]').click();await chooseMove();await tap(15,8);await sourceIs(64); // Tool-change cancel.
  const corners=[];
  for(const width of [320,390]){
    await page.setViewportSize({width,height:659});await page.locator('#camera-reset').click();
    for(const [x,y]of [[0,0],[15,0],[0,8],[15,8]]){
      await chooseMove();await tap(0,4);await tap(x,y);const s=await sourceIs(y*16+x);if(s.town.cells[64]!==null||s.wet.includes('0,4')||s.overflow)throw Error('Old source, obstruction or horizontal overflow remains.');
      corners.push({width,x,y});await page.locator('#undo-button').click();await sourceIs(64);
    }
  }
  // Arrow keys clamp at edges; Enter moves and Escape cancels the selection.
  await chooseMove();await tap(0,4);await page.locator('#town').focus();await page.keyboard.press('Escape');await page.keyboard.press('ArrowUp');await page.keyboard.press('Enter');await sourceIs(64);
  await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');await page.keyboard.press('ArrowUp');await page.keyboard.press('Enter');await sourceIs(48);await page.keyboard.press('Meta+z');await sourceIs(64);
  await chooseMove();await tap(0,4);await page.locator('#town').focus();
  for(let i=0;i<17;i++)await page.keyboard.press('ArrowRight');for(let i=0;i<6;i++)await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');await sourceIs(143);
  await chooseMove();await tap(15,8);await tap(0,3);await sourceIs(48);
  await page.locator('button[data-tool=gutter]').click();await tap(0,4);const oldCell=await sourceIs(48);
  if(oldCell.town.cells[64]?.type!=='gutter'||oldCell.notes[0]?.index!==64||oldCell.wet.includes('0,4'))throw Error('Old source cell cannot play from the real relocated network.');
  await page.waitForFunction(()=>document.querySelector('#building-64')?.classList.contains('sounding'),{},{timeout:7000});
  await page.screenshot({path:'output/playwright/spring-mobile.png'});
  await page.locator('#menu-button').click();const downloading=page.waitForEvent('download');await page.locator('#export-button').click();const download=await downloading;let raw='';for await(const bytes of await download.createReadStream())raw+=bytes.toString();await download.saveAs('output/playwright/spring-export.json');
  const exported=JSON.parse(raw);if(exported.cells[48]?.type!=='spring'||exported.cells[64]?.type!=='gutter')throw Error('JSON export uses the original spring position.');await page.locator('#menu-dialog .dialog-close').click();
  const load=async town=>{await page.locator('#menu-button').click();await page.locator('#import-input').evaluate((input,t)=>{const transfer=new DataTransfer();transfer.items.add(new File([JSON.stringify(t)],'spring.json',{type:'application/json'}));input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));},town);await page.waitForFunction(()=>!document.querySelector('#menu-dialog').open);await page.locator('#camera-reset').click();};
  const original=await page.evaluate(async()=>{const {createTown}=await import('./src/core.js?v=0.6.6');return createTown();});await load({...original,version:3});await sourceIs(64);await load({...original,version:2,wood:198});await sourceIs(64);await load(exported);await sourceIs(48);
  await page.locator('#photo-button').click();await page.waitForFunction(()=>!document.querySelector('#photo-download').disabled);const photo=await page.locator('#photo-preview').evaluate(n=>({width:n.naturalWidth,height:n.naturalHeight}));const photoDownload=page.waitForEvent('download');await page.locator('#photo-download').click();await(await photoDownload).saveAs('output/playwright/spring-photo.png');await page.locator('#photo-dialog .dialog-close').click();
  await page.reload();await page.locator('#start-silent').click();const reloaded=await sourceIs(48);if(reloaded.town.cells[64]?.type!=='gutter'||reloaded.notes[0]?.index!==64)throw Error('Moved spring or old-cell instrument was lost on reload.');
  return {corners,occupiedProtected:true,cancels:true,keyboard:true,oldCellNotes:oldCell.notes.map(n=>({instrument:n.instrument,index:n.index,note:n.note})),jsonRoundTrip:true,oldVersions:[2,3],photo,reloadedSource:reloaded.sources[0]};
}
