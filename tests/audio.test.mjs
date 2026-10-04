import test from 'node:test';
import assert from 'node:assert/strict';
import {AudioClock,TownAudio} from '../src/music.js';

test('running without a moving clock never confirms sound and eventually fails',()=>{
  const clock=new AudioClock();
  for(let i=0;i<14;i++)assert.equal(clock.tick(.1,0,'running'),false);
  assert.equal(clock.status,'checking');
  clock.tick(.1,0,'running');assert.equal(clock.status,'failed');
  assert.equal(clock.tick(.1,1,'running'),false); // Explicit retry is required.
  clock.reset(1);assert.equal(clock.tick(.1,1.1,'running'),true);
});
test('quantized output and brief interruptions recover without reporting failure',()=>{
  const clock=new AudioClock();assert.equal(clock.tick(.016,.01,'running'),true);
  for(let i=0;i<10;i++)clock.tick(.016,.01,'running');
  assert.equal(clock.status,'ready');
  clock.tick(.1,.01,'interrupted');assert.equal(clock.status,'paused');
  for(let i=0;i<100;i++)clock.tick(.1,.01,'interrupted');
  assert.equal(clock.status,'paused');
  assert.equal(clock.tick(.1,.02,'running'),true);
});
test('intentional pauses and long frame gaps restart the visible-time grace period',()=>{
  const clock=new AudioClock();clock.tick(.1,.1,'running');
  for(let i=0;i<100;i++)clock.tick(.1,.1,'suspended',false);
  assert.notEqual(clock.status,'failed');
  clock.tick(60,.1,'running');
  for(let i=0;i<14;i++)clock.tick(.1,.1,'running');
  assert.equal(clock.tick(.1,.2,'running'),true);
});
test('a clock that stops after confirmation falls back, even if muted',()=>{
  const clock=new AudioClock();clock.tick(.1,.1,'running');
  for(let i=0;i<15;i++)clock.tick(.1,.1,'running');
  assert.equal(clock.status,'failed');
});

const parameter=()=>({value:0,setValueAtTime(){},setTargetAtTime(){}});
function fakeContextFactory(){
  const contexts=[];
  class Context {
    constructor(){this.state='suspended';this.currentTime=0;this.destination={};contexts.push(this);}
    node(){const n={connect:()=>n,disconnect(){}};for(const key of ['gain','threshold','knee','ratio','attack','release','delayTime','frequency'])n[key]=parameter();return n;}
    createGain(){return this.node();}createDynamicsCompressor(){return this.node();}createDelay(){return this.node();}createBiquadFilter(){return this.node();}
    async resume(){if(this.reject)throw new Error('device unavailable');this.state='running';}
    async suspend(){this.state='suspended';}async close(){this.state='closed';}
  }
  return {Context,contexts};
}
test('failed retries reuse one context, successful recovery and mute keep the clock',async()=>{
  const previous=globalThis.window,{Context,contexts}=fakeContextFactory();
  globalThis.window={AudioContext:Context,setInterval};const audio=new TownAudio();
  try{
    const first=audio.start(4);assert.equal(audio.start(8),first);await first;
    assert.equal(audio.syncing,false);
    for(let attempt=0;attempt<3;attempt++){
      for(let i=0;i<15;i++)audio.updateClock(.1,4);
      assert.equal(audio.status,'failed');assert.equal(audio.muted,true);assert.equal(audio.timer,null);
      await audio.start(4);
    }
    assert.equal(contexts.length,1);contexts[0].currentTime=.01;
    assert.equal(audio.updateClock(.1,9),true);assert.equal(audio.stepIndex,9);assert.equal(audio.syncing,true);
    audio.setMuted(true);contexts[0].currentTime=.02;assert.equal(audio.updateClock(.1,9),true);
    const timer=audio.timer;audio.heardAnimals.add(7);await audio.start(12);assert.equal(audio.timer,timer);assert.equal(audio.stepIndex,9);assert.equal(audio.heardAnimals.has(7),true);audio.setMuted(true);
    await audio.suspend();for(let i=0;i<50;i++)audio.updateClock(.1,9);assert.equal(audio.status,'paused');
    await audio.resume();contexts[0].currentTime=.03;assert.equal(audio.updateClock(.1,9),true);assert.equal(audio.muted,true);
    await audio.suspend();contexts[0].reject=true;await assert.rejects(audio.start(),/device unavailable/);
    assert.equal(audio.status,'failed');assert.equal(contexts.length,1);
  }finally{await audio.close();globalThis.window=previous;}
});
