// Run in an isolated Page: changes are made through the saved-town import UI.
export default async function animalArtSmoke(page,url='http://127.0.0.1:5176/'){
  await page.setViewportSize({width:393,height:659});await page.goto(url);await page.locator('#start-silent').click();
  const fixture=await page.evaluate(async()=>{
    const {createTown,build,restoreTown}=await import('./src/core.js?v=0.6.3'),town=createTown();
    for(let x=5;x<=11;x++)build(town,'canal',x,4);
    for(const [x,y]of [[5,5],[5,6]])build(town,'canal',x,y);
    for(const [type,x,y]of [['gutter',1,3],['bell',3,3],['tree',9,3],['garden',10,5],['goat',5,3],['cow',7,5],['cow',12,4],['goat',4,6]]){
      build(town,type,x,y);if(type==='cow'||type==='goat')build(town,'flow',x,y);
    }
    return restoreTown(town);
  });
  await page.locator('#menu-button').click();
  await page.locator('#import-input').evaluate((input,town)=>{const transfer=new DataTransfer();transfer.items.add(new File([JSON.stringify(town)],'animal-water-fixture.json',{type:'application/json'}));input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));},fixture);
  await page.waitForFunction(()=>!document.querySelector('#menu-dialog').open);
  await page.locator('#camera-reset').click();
  const inspect=()=>page.evaluate(()=>{
    const saved=JSON.parse(localStorage.getItem('mon.demo6.composition.v2'));
    const animals=saved.cells.flatMap((cell,index)=>['cow','goat'].includes(cell?.type)?[{...cell,index}]:[]);
    return {animals,animalPipes:animals.filter(a=>document.querySelector(`[data-water-receiver="${a.index}"]`)).length,receivers:document.querySelectorAll('[data-water-receiver]').length,overflow:document.documentElement.scrollWidth>innerWidth};
  });
  for(const width of [393,320]){
    await page.setViewportSize({width,height:659});await page.locator('button[data-tool=cow]').click();
    const state=await inspect();if(state.animalPipes||state.overflow||state.receivers!==2)throw new Error('Water classification or narrow layout differs. '+JSON.stringify(state));
    for(const type of ['cow','goat'])if(!await page.locator(`button[data-tool="${type}"] .animal-${type}`).count())throw new Error('Tool icon differs from animal art.');
  }
  await page.locator('button[data-tool=move]').click();
  await page.locator('.cell-hit[data-x="12"][data-y="4"]').click();await page.locator('.cell-hit[data-x="11"][data-y="3"]').click();
  const moved=await inspect();if(!moved.animals.some(a=>a.type==='cow'&&a.index===59&&!a.enabled)||moved.animalPipes)throw new Error('Stopped animal movement or inlet redraw failed.');
  await page.locator('#undo-button').click();
  const restored=await inspect();if(!restored.animals.some(a=>a.index===76&&a.type==='cow'&&!a.enabled))throw new Error('Animal move undo changed identity or OFF.');
  for(let i=0;i<4;i++)await page.locator('#zoom-in').click();
  await page.locator('#camera-reset').click();
  const before=JSON.stringify((await inspect()).animals);await page.waitForTimeout(5900);
  if(JSON.stringify((await inspect()).animals)!==before)throw new Error('OFF animals kept walking.');
  await page.locator('#photo-button').click();await page.waitForFunction(()=>!document.querySelector('#photo-download').disabled);
  const photo=await page.locator('#photo-preview').evaluate(n=>({width:n.naturalWidth,height:n.naturalHeight}));
  if(!photo.width||!photo.height)throw new Error('Animal photo was not rendered.');
  await page.locator('#photo-dialog .dialog-close').click();
  await page.reload();await page.locator('#start-silent').click();
  if(JSON.stringify((await inspect()).animals)!==before)throw new Error('Art update changed the saved animal data.');
  return {moved:moved.animals,restored:restored.animals,photo,reloaded:await inspect()};
}
