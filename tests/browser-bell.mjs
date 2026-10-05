// Isolated hasTouch:true Page; verify migration through a real reload, not a draft.
export default async function bellWindSmoke(page,url='http://127.0.0.1:5176/'){
  await page.setViewportSize({width:390,height:659});await page.goto(url);
  const raw=await page.evaluate(async()=>{
    const {createTown,build}=await import('./src/core.js?v=0.6.7'),town=createTown();
    for(const [x,y]of [[1,3],[2,3],[3,3],[10,7],[11,7],[12,7]])build(town,'bell',x,y);build(town,'flow',12,7);town.version=3;
    const raw=JSON.stringify(town);localStorage.setItem('mon.demo6.composition.v2',raw);return raw;
  });await page.addInitScript(raw=>{if(!sessionStorage.getItem('bell-migration-seeded')){localStorage.setItem('mon.demo6.composition.v2',raw);sessionStorage.setItem('bell-migration-seeded','1');}},raw);await page.reload();await page.locator('#start-silent').click();await page.locator('#camera-reset').click();
  const inspect=()=>page.evaluate(async()=>{
    const {waterNetwork}=await import('./src/core.js?v=0.6.7'),{scoreAt}=await import('./src/music.js?v=0.6.5'),town=JSON.parse(localStorage.getItem('mon.demo6.composition.v2')),network=waterNetwork(town);
    return {town,active:network.buildings.filter(b=>b.type==='bell'&&b.active).map(b=>b.index),houses:network.groups.filter(g=>g.type==='bell').map(g=>({x:g.x,y:g.y,span:g.span})),notes:Array.from({length:16},(_,i)=>scoreAt(i,network)),bellPipes:network.buildings.filter(b=>b.type==='bell').some(b=>document.querySelector(`[data-water-receiver="${b.index}"]`)),backup:localStorage.getItem('mon.demo6.composition.original.v3')};
  });
  const before=await inspect();if(before.town.version!==4||before.backup!==raw||before.active.join(',')!=='49,50,51'||before.bellPipes)throw Error('Legacy bell migration differs: '+JSON.stringify({version:before.town.version,backupExact:before.backup===raw,active:before.active,pipes:before.bellPipes}));
  if(!(await page.locator('#toast').textContent()).includes('休止のまま'))throw Error('The preserved dry rests were not explained.');
  await page.locator('#menu-button').click();const downloading=page.waitForEvent('download');await page.locator('#original-export').click();const d=await downloading;let original='';for await(const bytes of await d.createReadStream())original+=bytes.toString();await d.saveAs('output/playwright/bell-original-v3.json');if(original!==raw)throw Error('Original composition export changed bytes.');await page.locator('#menu-dialog .dialog-close').click();
  const tap=async(x,y)=>{const b=await page.locator(`.cell-hit[data-x="${x}"][data-y="${y}"]`).boundingBox();await page.touchscreen.tap(b.x+b.width/2,b.y+b.height/2);};
  await page.locator('button[data-tool=bell]').click();await tap(8,2);await tap(9,2);let s=await inspect();
  if(s.bellPipes||s.notes[8][0]?.span!==2||s.notes[8][0]?.note!==76||s.notes[8][0]?.length!==5)throw Error('New dry bell house changed the musical phrase.');
  await page.waitForFunction(()=>document.querySelector('#building-40')?.classList.contains('sounding')&&document.querySelector('#building-41')?.classList.contains('sounding'),{},{timeout:7000});
  await page.locator('button[data-tool=flow]').click();if(await page.locator('button[data-tool=flow]').getAttribute('aria-label')!=='水・音の切替')throw Error('Bell ON/OFF is called a water gate.');await tap(1,4);s=await inspect();if(!s.active.includes(49)||s.bellPipes)throw Error('A water gate muted the wind bells.');
  await tap(8,2);await tap(10,7);s=await inspect();if(s.town.cells[40].enabled||!s.active.includes(122)||s.town.cells[123].enabled||s.town.cells[124].enabled)throw Error('Bell OFF or deliberate dry-bell activation failed.');
  await page.locator('button[data-tool=move]').click();await tap(8,2);await tap(8,1);s=await inspect();if(s.town.cells[24]?.enabled!==false||s.town.cells[40]!==null)throw Error('Moving the resting bell enabled it.');await page.locator('#undo-button').click();
  for(const width of [320,390]){await page.setViewportSize({width,height:659});await page.locator('#camera-reset').click();if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Wind bell layout overflows.');await page.screenshot({path:`output/playwright/bell-${width}.png`});}
  await page.locator('#photo-button').click();await page.waitForFunction(()=>!document.querySelector('#photo-download').disabled);const photo=await page.locator('#photo-preview').evaluate(n=>({width:n.naturalWidth,height:n.naturalHeight}));const photoDownload=page.waitForEvent('download');await page.locator('#photo-download').click();await(await photoDownload).saveAs('output/playwright/bell-photo.png');await page.locator('#photo-dialog .dialog-close').click();
  await page.reload();await page.locator('#start-silent').click();s=await inspect();if(s.backup!==raw||s.town.cells[40].enabled||!s.town.cells[122].enabled||s.town.cells[123].enabled||s.town.cells[124].enabled||s.bellPipes)throw Error('Reload reapplied old water rules to the chosen bell states.');
  await page.locator('#menu-button').click();const saving=page.waitForEvent('download');await page.locator('#export-button').click();const saved=await saving;let current='';for await(const bytes of await saved.createReadStream())current+=bytes.toString();await saved.saveAs('output/playwright/bell-current-v4.json');await page.locator('#menu-dialog .dialog-close').click();
  await page.locator('#camera-reset').click();await page.locator('button[data-tool=flow]').click();await tap(10,7);await page.locator('#menu-button').click();await page.locator('#import-input').evaluate((input,raw)=>{const transfer=new DataTransfer();transfer.items.add(new File([raw],'bells.json',{type:'application/json'}));input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));},current);await page.waitForFunction(()=>!document.querySelector('#menu-dialog').open);s=await inspect();if(!s.town.cells[122].enabled||s.backup!==raw||s.bellPipes)throw Error('Current JSON import lost chosen bell state or original data.');
  return {version:s.town.version,legacyActive:before.active,legacyDryOff:[122,123],explicitOff:124,backupExact:true,originalFilename:d.suggestedFilename(),newHouse:{note:76,span:2,length:5},waterGateIndependent:true,moveUndo:true,reloadedDryOn:122,jsonRoundTrip:true,photo};
}

export async function bellBackupFailure(page,url,raw){
  await page.addInitScript(raw=>{const set=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='mon.demo6.composition.original.v3')throw new DOMException('Test quota','QuotaExceededError');return set.call(this,key,value);};localStorage.setItem('mon.demo6.composition.v2',raw);},raw);
  await page.goto(url);await page.locator('#start-silent').click();await page.waitForTimeout(2300);
  const same=await page.evaluate(raw=>localStorage.getItem('mon.demo6.composition.v2')===raw,raw);if(!same||!(await page.locator('#save-status').textContent()).includes('元データ'))throw Error('Failed backup overwrote the old composition.');
  return {backupFailurePreservesOriginal:true};
}

export async function bellLegacyScores(page,baselineCoreSource){
  return page.evaluate(async source=>{
    const url=URL.createObjectURL(new Blob([source],{type:'text/javascript'})),old=await import(url);URL.revokeObjectURL(url);
    const core=await import('./src/core.js?v=0.6.7'),music=await import('./src/music.js?v=0.6.5');let seed=7931;
    const next=()=>seed=(Math.imul(seed,1664525)+1013904223)>>>0;
    for(let sample=0;sample<80;sample++){
      const town=core.createTown();town.cells=Array(144).fill(null);town.cells[64]={type:'spring'};town.version=3;town.scale=['d','f','a'][sample%3];town.scene=sample%2?'evening':'day';town.weather=sample%3?'clear':'rain';
      for(let i=0;i<260;i++){
        const index=next()%144,type=['canal','canal','bell','bell','mill','gutter','tree','garden','cow','goat'][next()%10];core.build(town,type,index%16,Math.floor(index/16));if(next()%5===0)core.build(town,'flow',index%16,Math.floor(index/16));
      }
      if(sample%2)core.moveBuilding(town,[0,4],[15,8]);
      const raw=JSON.stringify(town),before=old.waterNetwork(old.restoreTown(town)),after=core.waterNetwork(core.restoreTown(town));
      for(let beat=0;beat<64;beat++)if(JSON.stringify(music.scoreAt(beat,before))!==JSON.stringify(music.scoreAt(beat,after)))throw Error('Legacy musical events changed at layout '+sample+', beat '+beat);
      if(JSON.stringify(town)!==raw)throw Error('Legacy fixture mutated.');
    }
    return {layouts:80,stepsPerLayout:64,eventsUnchanged:true};
  },baselineCoreSource);
}
