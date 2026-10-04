// Run this function with a Playwright Page in an isolated validation profile.
// The live pointer path is deliberately exercised, not just the town model.
export default async function browserSmoke(page,url='http://127.0.0.1:5176/') {
  await page.goto(url);
  await page.locator('#start-sound').click();
  await page.locator('#menu-button').click();
  await page.locator('#reset-button').click();
  await page.locator('#reset-confirm').click();
  for(const x of [1,2,3]){
    await page.locator('button[data-tool=gutter]').click();
    await page.locator(`.cell-hit[data-x="${x}"][data-y="3"]`).click();
  }
  if(await page.locator('.longhouse').count()!==1)throw new Error('Pointer construction did not create a longhouse.');
  await page.locator('button[data-tool=tree]').click();
  await page.locator('.cell-hit[data-x="6"][data-y="2"]').click();
  if(!await page.locator('#building-38').count())throw new Error('Pointer construction did not place the tree.');
  await page.locator('button[data-tool=flow]').click();
  await page.locator('.cell-hit[data-x="2"][data-y="3"]').click();
  if(await page.locator('.longhouse').count()!==0)throw new Error('OFF did not split the longhouse.');
  await page.locator('#undo-button').click();
  if(await page.locator('.longhouse').count()!==1)throw new Error('Undo did not reunite the longhouse.');
  await page.locator('#photo-button').click();
  await page.waitForFunction(()=>!document.querySelector('#photo-download').disabled);
  const photo=await page.locator('#photo-preview').evaluate(n=>({width:n.naturalWidth,height:n.naturalHeight}));
  if(photo.width!==1600||photo.height!==1200)throw new Error('Cropped photo did not render.');
  await page.locator('#photo-dialog .dialog-close').click();
  const result=await page.evaluate(()=>({version:JSON.parse(localStorage.getItem('mon.demo6.composition.v2')).version,sound:document.querySelector('#sound-button').getAttribute('aria-label'),longhouses:document.querySelectorAll('.longhouse').length,tree:!!document.querySelector('#building-38')}));
  if(result.version!==3||result.longhouses!==1||!result.tree)throw new Error('Saved composition differs from the displayed edits.');
  return {...result,photo};
}
