// Use an isolated Page. In Chrome, freeze only the AudioContext clock getter;
// the context, resume, suspension and synthesis nodes remain native.
// WebKit without a working device can run with recover=false, frozen=false.
// Real visibility needs connectOverCDP(...,{noDefaults:true}); standard
// Playwright forces pages visible, so use realVisibility=false for that driver.
export default async function audioFallback(page,url='http://127.0.0.1:5176/',recover=true,frozen=true,silentSink=false,realVisibility=true){
  await page.addInitScript(initial=>{
    const Native=window.AudioContext||window.webkitAudioContext;
    window.__demo6Audio={contexts:[],frozen:initial.frozen,hold:0};
    if(!Native)return;
    window.AudioContext=class extends Native{
      constructor(...args){super(...(initial.silentSink?[{...args[0],sinkId:{type:'none'}}]:args));window.__demo6Audio.contexts.push(this);}
      get currentTime(){return window.__demo6Audio.frozen?window.__demo6Audio.hold:super.currentTime;}
    };
  },{frozen,silentSink});
  await page.goto(url);await page.locator('#start-sound').click();
  const waitFailed=()=>page.waitForFunction(()=>document.querySelector('#music-status').textContent.includes('音を開始できませんでした'),{},{timeout:5000});
  const waitReady=()=>page.waitForFunction(()=>document.querySelector('#sound-button').getAttribute('aria-pressed')==='true',{},{timeout:5000});
  const wind=async()=>{const before=await page.locator('#town').getAttribute('data-step');await page.waitForTimeout(850);const after=await page.locator('#town').getAttribute('data-step');if(before===after)throw new Error('Wind stopped without audio output.');return {before,after};};
  await waitFailed();const failedWind=await wind();
  if(await page.locator('#sound-button').getAttribute('aria-pressed')!=='false')throw new Error('Failed sound is shown as ON.');
  await page.locator('button[data-tool=tree]').click();await page.locator('.cell-hit[data-x="6"][data-y="2"]').click();
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('mon.demo6.composition.v2')).cells[38]?.type);
  if(saved!=='tree')throw new Error('Editing or saving failed in silent fallback.');
  for(let i=0;i<2;i++){await page.locator('#sound-button').click();await waitFailed();}
  if(await page.evaluate(()=>window.__demo6Audio.contexts.length)!==1)throw new Error('Retries multiplied AudioContexts.');
  let recoveredWind=null,mutedWind=null,pausedWind=null,resumed=null;
  if(recover){
    await page.evaluate(()=>window.__demo6Audio.frozen=false);await page.locator('#sound-button').click();await waitReady();
    recoveredWind=await wind();await page.locator('#sound-button').click();mutedWind=await wind();
    await page.locator('#sound-button').click();await waitReady();
    await page.evaluate(()=>{const a=window.__demo6Audio;a.hold=a.contexts[0].currentTime;a.frozen=true;});
    await waitFailed();await wind();
    await page.evaluate(()=>window.__demo6Audio.frozen=false);await page.locator('#sound-button').click();await waitReady();
    await page.evaluate(()=>window.__demo6Audio.contexts[0].suspend());
    await page.waitForFunction(()=>document.querySelector('#music-status').textContent.includes('一時休止'));
    await page.waitForTimeout(1900);pausedWind=await wind();
    if((await page.locator('#music-status').textContent()).includes('できませんでした'))throw new Error('A temporary suspension was reported as failure.');
    await page.evaluate(()=>window.__demo6Audio.contexts[0].resume());await waitReady();
    if(realVisibility){
    const cdp=await page.context().newCDPSession(page);
    // Playwright forces focus by default; release it to observe real OS visibility.
    await cdp.send('Emulation.setFocusEmulationEnabled',{enabled:false});
    const {targetInfo}=await cdp.send('Target.getTargetInfo');
    const options={url:'about:blank',newWindow:false,background:false};
    if(targetInfo.browserContextId)options.browserContextId=targetInfo.browserContextId;
    const cover=await cdp.send('Target.createTarget',options);
    try{
      await cdp.send('Target.activateTarget',{targetId:cover.targetId});
      await page.waitForFunction(()=>document.hidden,{},{timeout:5000});
      await page.waitForTimeout(1900);
      const hiddenState=await page.evaluate(()=>window.__demo6Audio.contexts[0].state);
      if(hiddenState!=='suspended')throw new Error('Real background visibility did not suspend audio.');
      await cdp.send('Target.activateTarget',{targetId:targetInfo.targetId});
      await page.bringToFront();await page.waitForFunction(()=>!document.hidden,{},{timeout:5000});await waitReady();resumed=await wind();
    }finally{await cdp.send('Target.closeTarget',{targetId:cover.targetId});await cdp.send('Emulation.setFocusEmulationEnabled',{enabled:true});await cdp.detach();}
    }
  }
  const contexts=await page.evaluate(()=>window.__demo6Audio.contexts.length);
  if(contexts!==1)throw new Error('Recovery multiplied AudioContexts.');
  return {failedWind,saved,contexts,recoveredWind,mutedWind,pausedWind,resumed,status:await page.locator('#music-status').textContent()};
}
