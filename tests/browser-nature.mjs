// Run after browser-smoke.mjs, using the same isolated Playwright Page.
export default async function natureSmoke(page) {
  await page.locator('button[data-tool=garden]').click();
  await page.locator('.cell-hit[data-x="8"][data-y="2"]').click();
  await page.locator('#backing-button').click();
  await page.locator('#weather-select').selectOption('rain');
  if(!await page.locator('.rain-layer').count())throw new Error('Fixed rain is not visible.');
  await page.locator('#weather-select').selectOption('clear');
  await page.locator('#scene-select').selectOption('evening');
  if(await page.locator('body').getAttribute('data-scene')!=='evening')throw new Error('Night scenery did not change.');
  await page.locator('button[data-tool=cow]').click();
  await page.locator('.cell-hit[data-x="10"][data-y="5"]').click();
  await page.locator('button[data-tool=goat]').click();
  await page.locator('.cell-hit[data-x="12"][data-y="5"]').click();
  const before=await page.evaluate(()=>{const t=JSON.parse(localStorage.getItem('mon.demo6.composition.v2'));return t.cells.flatMap((c,index)=>['cow','goat'].includes(c?.type)?[{id:c.id,index}]:[]);});
  if(before.length!==2)throw new Error('Animal placement did not save two identities.');
  await page.waitForFunction(initial=>{const t=JSON.parse(localStorage.getItem('mon.demo6.composition.v2'));return initial.some(a=>t.cells.findIndex(c=>c?.id===a.id)!==a.index);},before,{timeout:14000});
  const moved=await page.evaluate(()=>{const t=JSON.parse(localStorage.getItem('mon.demo6.composition.v2'));return t.cells.flatMap((c,index)=>['cow','goat'].includes(c?.type)?[{id:c.id,index}]:[]);});
  await page.locator('button[data-tool=flow]').click();
  for(const {id}of moved){const index=Number(await page.locator(`[data-animal-id="${id}"]`).getAttribute('data-building'));await page.locator(`.cell-hit[data-x="${index%16}"][data-y="${Math.floor(index/16)}"]`).click();}
  const stopped=await page.evaluate(()=>{const t=JSON.parse(localStorage.getItem('mon.demo6.composition.v2'));return t.cells.flatMap((c,index)=>['cow','goat'].includes(c?.type)?[{id:c.id,index,enabled:c.enabled}]:[]);});
  if(stopped.some(a=>a.enabled))throw new Error('Animal OFF did not stop it.');
  await page.waitForTimeout(5900);
  const still=await page.evaluate(()=>{const t=JSON.parse(localStorage.getItem('mon.demo6.composition.v2'));return t.cells.flatMap((c,index)=>['cow','goat'].includes(c?.type)?[{id:c.id,index,enabled:c.enabled}]:[]);});
  if(JSON.stringify(still)!==JSON.stringify(stopped))throw new Error('Stopped animals kept walking.');
  await page.reload();
  await page.locator('#start-silent').click();
  const reloaded=await page.evaluate(()=>{const t=JSON.parse(localStorage.getItem('mon.demo6.composition.v2'));return{weather:t.weather,scene:t.scene,backing:t.backing,animals:t.cells.flatMap((c,index)=>['cow','goat'].includes(c?.type)?[{id:c.id,index,enabled:c.enabled}]:[])};});
  if(reloaded.backing!==false||reloaded.weather!=='clear'||reloaded.scene!=='evening'||JSON.stringify(reloaded.animals)!==JSON.stringify(stopped))throw new Error('Nature settings or animals did not survive reload.');
  return {before,moved,stopped,reloaded};
}
