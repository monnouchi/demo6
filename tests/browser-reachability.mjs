// Exercise actual hit testing and touch dispatch in an isolated Chrome/CDP Page.
export default async function boardReachability(page,url='http://127.0.0.1:5176/') {
  await page.setViewportSize({width:393,height:659});
  await page.goto(url);
  await page.locator('#start-silent').click();
  await page.locator('#menu-button').click();
  await page.locator('#reset-button').click();
  await page.locator('#reset-confirm').click();
  await page.locator('#camera-reset').click();
  const cdp=await page.context().newCDPSession(page);
  await cdp.send('Emulation.setTouchEmulationEnabled',{enabled:true});
  const results=[];
  for(const [width,height]of [[1280,900],[393,659],[320,568],[393,480],[320,400],[844,390]]){
    await page.setViewportSize({width,height});
    await page.evaluate(()=>scrollTo(0,0));
    const initial=await page.evaluate(()=>[...document.querySelectorAll('.cell-hit')].map(n=>{const b=n.getBoundingClientRect(),x=b.x+b.width/2,y=b.y+b.height/2;return {x:Number(n.dataset.x),y:Number(n.dataset.y),offscreen:y<0||y>=innerHeight,target:document.elementFromPoint(x,y)?.id??document.elementFromPoint(x,y)?.tagName,blocked:document.elementFromPoint(x,y)!==n};}).filter(c=>c.blocked));
    const blocked=[];
    for(let y=0;y<9;y++)for(let x=0;x<16;x++){
      const selector=`.cell-hit[data-x="${x}"][data-y="${y}"]`;
      await page.locator(selector).scrollIntoViewIfNeeded();
      const hit=await page.locator(selector).evaluate(n=>{const b=n.getBoundingClientRect(),x=b.x+b.width/2,y=b.y+b.height/2;return{hit:document.elementFromPoint(x,y)===n,x,y};});
      if(!hit.hit)blocked.push([x,y]);
    }
    if(blocked.length)throw new Error(`${width}×${height}: unreachable cells ${JSON.stringify(blocked)}`);
    results.push({width,height,initialOffscreen:initial.filter(c=>c.offscreen).length,initialOverlays:initial.filter(c=>!c.offscreen).length,reachable:144});
  }
  // The formerly covered corners must receive real touch events.
  await page.setViewportSize({width:393,height:659});
  await page.evaluate(()=>scrollTo(0,0));
  await page.locator('button[data-tool=tree]').click();
  for(const [x,y]of [[12,0],[13,0],[14,0],[15,0],[14,8],[15,8]]){
    const target=page.locator(`.cell-hit[data-x="${x}"][data-y="${y}"]`);
    await target.scrollIntoViewIfNeeded();const b=await target.boundingBox();
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:b.x+b.width/2,y:b.y+b.height/2,id:1}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    const type=await page.evaluate(index=>JSON.parse(localStorage.getItem('mon.demo6.composition.v2')).cells[index]?.type,y*16+x);
    if(type!=='tree')throw new Error(`Touch missed formerly covered cell ${x},${y}.`);
  }
  // Verify all 144 cells with actual touch on the shortest supported test view.
  // Free cells receive flowers; occupied cells toggle; the spring reports its guard.
  await page.setViewportSize({width:320,height:400});
  let tapped=0;
  for(let y=0;y<9;y++)for(let x=0;x<16;x++){
    const index=y*16+x,before=await page.evaluate(i=>JSON.parse(localStorage.getItem('mon.demo6.composition.v2')).cells[i],index);
    await page.locator(`button[data-tool="${before?'flow':'garden'}"]`).click();
    const target=page.locator(`.cell-hit[data-x="${x}"][data-y="${y}"]`);await target.scrollIntoViewIfNeeded();const b=await target.boundingBox();
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:b.x+b.width/2,y:b.y+b.height/2,id:1}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    const after=await page.evaluate(i=>JSON.parse(localStorage.getItem('mon.demo6.composition.v2')).cells[i],index);
    if(!before&&after?.type!=='garden')throw new Error(`All-cell touch missed ${x},${y}.`);
    if(before?.type==='canal'&&after.open===before.open)throw new Error(`Canal touch missed ${x},${y}.`);
    if(before&&before.type!=='canal'&&before.type!=='spring'&&after.enabled===before.enabled)throw new Error(`Object touch missed ${x},${y}.`);
    if(before?.type==='spring'&&!await page.locator('#toast').textContent().then(t=>t.includes('泉')))throw new Error('Spring tap was not received.');
    tapped++;
  }
  return {views:results,actualTaps:tapped};
}
