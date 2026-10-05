// Native OfflineAudioContext measurements; these do not claim a listening test.
// baselineSource is the published 0.6.4 music module, supplied by the QA runner.
export default async function millTailAudio(page,url='http://127.0.0.1:5176/',baselineSource){
  await page.goto(url);
  return page.evaluate(async(source)=>{
    const current=await import('./src/music.js?v=0.6.5');
    const blob=new Blob([source.replace("'./core.js?v=0.6.2'",JSON.stringify(new URL('./src/core.js?v=0.6.2',location.href).href))],{type:'text/javascript'}),blobUrl=URL.createObjectURL(blob);
    const baseline=await import(blobUrl);URL.revokeObjectURL(blobUrl);
    const rate=48000,step=current.STEP_SECONDS,start=.08;
    const rms=(data,from,to)=>{let sum=0,n=0;for(let i=Math.max(0,Math.floor(from*rate));i<Math.min(data.length,Math.floor(to*rate));i++){sum+=data[i]**2;n++;}return Math.sqrt(sum/Math.max(1,n));};
    const db=(a,b)=>20*Math.log10(Math.max(a,1e-12)/Math.max(b,1e-12));
    const sampleError=(a,b,end=a.length)=>{let maximum=0;for(let i=0;i<end;i++)maximum=Math.max(maximum,Math.abs(a[i]-b[i]));return maximum;};
    // Native oscillators can differ by a few float32 units between renders.
    const tolerance=2e-7;
    const render=async(module,events,seconds,production=false,muteAt=null)=>{
      const context=new OfflineAudioContext(2,Math.ceil(seconds*rate),rate);let destination=context.destination,voices=0,scheduledOscillators=0,audio=null,clock=0;
      if(production){
        // Let TownAudio construct its own native bus, compressor and delays.
        const proxy=new Proxy(context,{get:(target,name)=>name==='resume'||name==='close'?async()=>{}:name==='state'?'running':name==='currentTime'?clock:typeof target[name]==='function'?target[name].bind(target):target[name]});
        const Native=window.AudioContext;window.AudioContext=function(){return proxy;};
        try{audio=new module.TownAudio();await audio.start();audio.status='ready';audio.master.gain.setValueAtTime(.85,0);destination=audio.bus;}finally{window.AudioContext=Native;}
      }
      for(const {event,time,pan=0}of events)module.synthVoice(context,destination,event,time,pan,n=>{voices+=n;if(n>0)scheduledOscillators+=n;});
      if(muteAt!==null){clock=muteAt;audio.setMuted(true);}
      const buffer=await context.startRendering();await new Promise(resolve=>setTimeout(resolve,0));
      const data=buffer.getChannelData(0);let peak=0,finite=true;for(let i=0;i<data.length;i++){finite&&=Number.isFinite(data[i]);peak=Math.max(peak,Math.abs(data[i]),Math.abs(buffer.getChannelData(1)[i]));}
      return {data,peak,finite,voices,scheduledOscillators};
    };
    const singles=[],longhouses=[];
    for(const note of [45,62,72])for(const span of [1,2,4,16]){
      const event={instrument:'mill',note,span,length:Math.max(1.3,span),gain:.85},end=start+event.length*step,events=[{event,time:start}];
      const old=await render(baseline,events,end+1.1),now=await render(current,events,end+1.1);
      if(!now.finite||now.peak>=1||now.voices)throw Error('Invalid or uncleared watermill voice.');
      if(span===1){const error=sampleError(now.data,old.data);if(error>tolerance)throw Error('Single watermill timbre changed: '+error);singles.push({note,maxSampleError:error,peak:now.peak,voices:now.voices});continue;}
      const sustain=rms(now.data,end-.18,end-.10),preEnd=rms(now.data,end-.05,end-.01),tail80=rms(now.data,end+.06,end+.10),tail220=rms(now.data,end+.20,end+.24),tail450=rms(now.data,end+.43,end+.47),rest=rms(now.data,end+.76,end+1.0);
      const drop80=db(tail80,sustain),drop220=db(tail220,sustain),hold=db(preEnd,sustain),old80=db(rms(old.data,end+.06,end+.10),rms(old.data,end-.18,end-.10));
      if(Math.abs(hold)>1.2||drop80< -15||drop80> -2||drop220< -30||drop220> -10||!(tail80>tail220&&tail220>tail450)||rest>1e-8)throw Error('Watermill sustain/tail regression: '+JSON.stringify({note,span,hold,drop80,drop220,rest}));
      const prefix=Math.floor((end-.12)*rate);if(sampleError(now.data,old.data,prefix)>tolerance)throw Error('Watermill body changed before its final release.');
      longhouses.push({note,span,holdDb:hold,tail80Db:drop80,oldTail80Db:old80,tail220Db:drop220,tail450Db:db(tail450,sustain),rest,voices:now.voices});
    }
    const unchanged=[];
    for(const instrument of ['gutter','bell','cow','goat','tree','garden','pad','backing'])for(const span of (['gutter','bell'].includes(instrument)?[1,2,4,16]:[1])){
      const event={instrument,note:74,span,length:instrument==='bell'?span+3:Math.max(1.7,span),gain:.85,atmosphere:'day'},events=[{event,time:start}],seconds=start+event.length*step+2;
      const old=await render(baseline,events,seconds),now=await render(current,events,seconds);
      const error=sampleError(now.data,old.data);if(error>tolerance||now.voices||!now.finite)throw Error('Changed or uncleared '+instrument+' voice.');unchanged.push({instrument,span,maxSampleError:error});
    }
    const {WIDTH,HEIGHT,createTown,build,waterNetwork,restoreTown}=await import('./src/core.js?v=0.6.3'),town=createTown();town.cells=Array(WIDTH*HEIGHT).fill(null);town.cells[4*WIDTH]={type:'spring'};town.weather='clear';
    for(let y=0;y<HEIGHT;y++)for(const x of [0,5,10])if(!town.cells[y*WIDTH+x])build(town,'canal',x,y);
    for(let x=1;x<WIDTH;x++)build(town,'canal',x,4);
    for(let y=0;y<HEIGHT;y++)if(y!==4)for(let x=1;x<WIDTH;x++)if(![5,10].includes(x))build(town,'mill',x,y);
    const network=waterNetwork(town),saved=JSON.stringify(town),events=[];
    for(let beat=0;beat<32;beat++)for(const event of current.scoreAt(beat,network))events.push({event,time:start+beat*step,pan:(event.x/15-.5)*.6});
    const end=start+32*step,dense=await render(current,events,end+1.2,true),previous=await render(baseline,events,end+1.2,true),muted=await render(current,events,end+1.2,true,start+4*step+.1);
    const boundary=rms(dense.data,start+16*step-.02,start+16*step+.02),quiet=rms(muted.data,start+4*step+.30,start+4*step+.38),rest=rms(dense.data,end+1.08,end+1.2);
    if(!dense.finite||dense.peak>=.98||dense.voices||muted.voices||quiet>1e-4||rest>1e-8||JSON.stringify(town)!==saved||JSON.stringify(restoreTown(town))!==saved)throw Error('Dense loop, mute or save compatibility failed.');
    // The last cell and the next loop both have a long watermill at the same pitch.
    const crossing=[{event:{instrument:'mill',note:62,span:2,length:2,gain:.85},time:start+14*step},{event:{instrument:'mill',note:62,span:4,length:4,gain:.85},time:start+16*step}];
    const edge=await render(current,crossing,start+20*step+1.2,true);
    if(!edge.finite||edge.peak>=.98||edge.voices)throw Error('Neighbour onset or loop crossing failed.');
    return {sampleRate:rate,singles,longhouses,unchanged,dense:{peak:dense.peak,baselinePeak:previous.peak,scheduledOscillators:dense.scheduledOscillators,voices:dense.voices,boundaryRms:boundary,rest},loopCrossing:{peak:edge.peak,voices:edge.voices},mute:{rmsAfter200ms:quiet,voices:muted.voices},saveUnchanged:true};
  },baselineSource);
}

export async function millTailUi(page,url='http://127.0.0.1:5176/'){
  await page.addInitScript(()=>{
    const Native=window.AudioContext;window.__millContexts=[];
    window.AudioContext=class extends Native{
      constructor(...args){super({...args[0],sinkId:{type:'none'}});window.__millContexts.push(this);}
      createGain(){const gain=super.createGain();this.__master??=gain;return gain;}
    };
  });
  await page.setViewportSize({width:1280,height:900});await page.goto(url);await page.locator('#start-sound').click();
  await page.waitForFunction(()=>document.querySelector('#sound-button').getAttribute('aria-pressed')==='true');
  await page.locator('#menu-button').click();await page.locator('#reset-button').click();await page.locator('#reset-confirm').click();await page.locator('#backing-button').click();
  const span=()=>page.evaluate(async()=>{const {waterNetwork}=await import('./src/core.js?v=0.6.3');return waterNetwork(JSON.parse(localStorage.getItem('mon.demo6.composition.v2'))).groups.find(g=>g.type==='mill'&&g.y===3)?.span;});
  const spans=[];await page.locator('button[data-tool=mill]').click();
  for(let x=0;x<16;x++){await page.locator(`.cell-hit[data-x="${x}"][data-y="3"]`).click();if([1,3,15].includes(x)){const n=await span();if(n!==x+1)throw Error('Pointer longhouse span differs.');spans.push(n);}}
  await page.locator('#undo-button').click();if(await span()!==15)throw Error('Longhouse Undo failed.');await page.locator('.cell-hit[data-x="15"][data-y="3"]').click();
  const sounding=await page.evaluate(async()=>{
    const context=window.__millContexts[0],analyser=context.createAnalyser();context.__master.connect(analyser);const data=new Float32Array(analyser.fftSize);let maximum=0;
    for(let i=0;i<65;i++){await new Promise(r=>setTimeout(r,100));analyser.getFloatTimeDomainData(data);maximum=Math.max(maximum,Math.sqrt(data.reduce((s,x)=>s+x*x,0)/data.length));}
    context.__master.disconnect(analyser);return {contexts:window.__millContexts.length,rms:maximum,time:context.currentTime};
  });if(sounding.contexts!==1||sounding.rms<.001)throw Error('Native live longhouse did not render.');
  await page.locator('#sound-button').click();await page.waitForTimeout(300);
  const muted=await page.evaluate(()=>{const context=window.__millContexts[0],analyser=context.createAnalyser();context.__master.connect(analyser);const data=new Float32Array(analyser.fftSize);analyser.getFloatTimeDomainData(data);context.__master.disconnect(analyser);return {rms:Math.sqrt(data.reduce((s,x)=>s+x*x,0)/data.length),contexts:window.__millContexts.length};});
  if(muted.rms>1e-4||muted.contexts!==1)throw Error('Live mute did not silence the longhouse.');
  await page.reload();await page.locator('#start-silent').click();const reloaded=await span();if(reloaded!==16)throw Error('Saved longhouse changed after reload.');
  return {spans,undoSpan:15,sounding,muted,reloaded,sink:'none'};
}
