// An autosaved starter is still a starter; a player's edited arrangement reopens whole.
export default async function startViewSmoke(page,url='http://127.0.0.1:5176/'){
  const scale=()=>page.locator('#town').evaluate(n=>Number(n.style.transform.match(/scale\(([^)]+)\)/)?.[1]));
  await page.setViewportSize({width:320,height:568});await page.goto(url);await page.locator('#start-silent').click();if(await scale()!==2.5)throw Error('Fresh phone town lost its approachable zoom.');
  await page.waitForFunction(()=>!!localStorage.getItem('mon.demo6.composition.v2'));await page.reload();await page.locator('#start-silent').click();if(await scale()!==2.5)throw Error('Autosave alone turned the starter into an edited town.');
  await page.locator('#menu-button').click();await page.locator('#weather-select').selectOption('rain');await page.locator('#scene-select').selectOption('evening');await page.locator('#backing-button').click();await page.locator('#menu-done').click();if(await scale()!==2.5)throw Error('Closing settings discarded the editing zoom.');
  await page.locator('#photo-button').click();await page.waitForFunction(()=>!document.querySelector('#photo-download').disabled);await page.locator('#photo-dialog .dialog-close').click();if(await scale()!==2.5)throw Error('Closing the photo discarded the editing zoom.');
  await page.reload();await page.locator('#start-silent').click();if(await scale()!==2.5)throw Error('Sound, weather or elapsed time marked the starter as developed.');
  await page.locator('#camera-reset').click();await page.locator('button[data-tool=tree]').click();for(const [x,y]of [[0,0],[15,0],[0,8],[15,8]]){const b=await page.locator(`.cell-hit[data-x="${x}"][data-y="${y}"]`).boundingBox();await page.touchscreen.tap(b.x+b.width/2,b.y+b.height/2);}
  const saved=await page.evaluate(()=>{const t=JSON.parse(localStorage.getItem('mon.demo6.composition.v2'));return {cells:t.cells,weather:t.weather,scene:t.scene,backing:t.backing};});
  await page.locator('#zoom-in').click();await page.locator('#zoom-in').click();await page.locator('#zoom-in').click();await page.locator('button[data-tool=bell]').click();if(await scale()!==2.5)throw Error('Tool selection reset the editing zoom.');
  const views=[];for(const [width,height]of [[320,400],[320,568],[390,844],[844,390],[1280,900]]){
    await page.setViewportSize({width,height});await page.reload();await page.locator('#start-silent').click();if(await scale()!==1)throw Error('Edited town did not reopen whole.');
    const current=await page.evaluate(()=>{const t=JSON.parse(localStorage.getItem('mon.demo6.composition.v2'));return {cells:t.cells,weather:t.weather,scene:t.scene,backing:t.backing};});if(JSON.stringify(current)!==JSON.stringify(saved))throw Error('Framing the resumed town modified its arrangement or settings.');
    const result=await page.evaluate(()=>({width:innerWidth,height:innerHeight,scrollY,unseen:[...document.querySelectorAll('.cell-hit')].filter(n=>{const b=n.getBoundingClientRect(),x=b.x+b.width/2,y=b.y+b.height/2;return x<0||x>=innerWidth||y<0||y>=innerHeight||document.elementFromPoint(x,y)!==n;}).map(n=>[n.dataset.x,n.dataset.y])}));if(result.scrollY!==0||result.unseen.length)throw Error('A resumed edge placement or map cell is out of view: '+JSON.stringify(result));views.push(result);
  }
  return {freshZoom:2.5,untouchedAutosaveZoom:2.5,settingsOnlyZoom:2.5,menuAndPhotoPreserveZoom:true,toolPreservesZoom:true,editedZoom:1,views,saveUnchanged:true};
}

// Use the dedicated browser's normal tab with noDefaults:true for real visibility.
export async function editingViewVisibility(page,url='http://127.0.0.1:5176/'){
  await page.setViewportSize({width:1280,height:900});await page.bringToFront();await page.goto(url);await page.locator('#start-silent').click();await page.locator('#zoom-in').click();await page.locator('#zoom-in').click();const before=await page.locator('#town').evaluate(n=>n.style.transform);
  await page.locator('#menu-button').focus();await page.locator('#town').focus();if(await page.locator('#town').evaluate(n=>n.style.transform)!==before)throw Error('A focus change reset the editing view.');
  const cdp=await page.context().newCDPSession(page);await cdp.send('Emulation.setFocusEmulationEnabled',{enabled:false});const {targetInfo}=await cdp.send('Target.getTargetInfo'),options={url:'about:blank',newWindow:false,background:false};if(targetInfo.browserContextId)options.browserContextId=targetInfo.browserContextId;const cover=await cdp.send('Target.createTarget',options);
  try{await cdp.send('Target.activateTarget',{targetId:cover.targetId});await page.waitForFunction(()=>document.hidden,{},{timeout:5000});await cdp.send('Target.activateTarget',{targetId:targetInfo.targetId});await page.bringToFront();await page.waitForFunction(()=>!document.hidden);await page.waitForTimeout(100);if(await page.locator('#town').evaluate(n=>n.style.transform)!==before)throw Error('A short tab round trip reset the editing view.');return {focusPreserved:true,realTabRoundTripPreserved:true};}
  finally{await cdp.send('Target.closeTarget',{targetId:cover.targetId});await cdp.send('Emulation.setFocusEmulationEnabled',{enabled:true});await cdp.detach();}
}
