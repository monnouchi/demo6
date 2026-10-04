import { SCALES } from './core.js?v=0.6.0';
export const BPM=88, STEP_SECONDS=60/BPM/2, BAR_SECONDS=STEP_SECONDS*8;
export const midiHz=note=>440*2**((note-69)/12);
export const noteName=note=>['C','C♯','D','E♭','E','F','F♯','G','A♭','A','B♭','B'][((note%12)+12)%12]+(Math.floor(note/12)-1);
export function scoreAt(stepIndex,network) {
  const notes=network.groups.filter(b=>b.active&&b.x===stepIndex%16);
  // Keep every chosen note; balance dense chords continuously rather than dropping voices.
  const gain=.85/Math.sqrt(Math.max(1,notes.length/3));
  return notes.map(b=>({instrument:b.type,note:b.note,length:b.type==='cow'?1.8:b.type==='goat'?1.2:b.type==='bell'?b.span+3:b.type==='garden'?.4:b.type==='tree'?.35:Math.max(b.type==='mill'?1.3:1.7,b.span),gain,index:b.index,x:b.x,y:b.y,span:b.span,members:b.members,atmosphere:['garden','tree'].includes(b.type)?network.atmosphere:'day',animalId:b.id}));
}
export function windNotes(step,network,heardAnimals) {
  if(step%16===0)heardAnimals.clear();
  return scoreAt(step,network).filter(note=>{if(note.animalId===undefined)return true;if(heardAnimals.has(note.animalId))return false;heardAnimals.add(note.animalId);return true;});
}
// An original quiet eight-bar accompaniment leaves the melody to the placed town.
// D6/9 – Bm7 – G6/9 – D6/9, transposed as a whole with the player's scale.
export function accompanimentAt(stepIndex,scale='d') {
  const root=SCALES[scale].root,bar=Math.floor(stepIndex/8)%8,step=stepIndex%8;
  const chord=[[0,4,9,14],[0,4,9,14],[-3,0,4,7],[-3,0,4,7],[-7,-3,2,9],[-7,-3,2,9],[0,4,9,14],[0,4,9,14]][bar];
  const events=[];
  if(step===0)for(const interval of [chord[0]-12,chord[1],chord[2]])events.push({instrument:'pad',note:root+interval,length:8,gain:.20});
  const motif=[[7,9,4],[7,4,0],[4,7,0],[4,0,-3],[2,4,9],[2,-3,0],[7,9,4],[4,2,0]][bar];
  const index=[1,4,6].indexOf(step);if(index>=0)events.push({instrument:'backing',note:root+motif[index],length:index===2?2:2.5,gain:.23});
  return events;
}
// Continuous voicing keeps the selected pitch while softening the upper register.
// The bell body is tuned; its short, inharmonic crown fades as the pitch rises.
export function voiceProfile(instrument,note,atmosphere='day') {
  const high=Math.max(0,Math.min(1,(note-69)/15)),mix=(low,top)=>low+(top-low)*high;
  const presets={
    cow:{volume:.105,attack:.025,release:.28,partials:[[1,'sine',1],[2,'sine',.10],[3,'sine',.025]]},
    goat:{volume:mix(.08,.058),attack:mix(.012,.025),release:.42,partials:[[1,'sine',1],[2.76,'sine',mix(.12,.035),.4],[4.1,'sine',mix(.018,.003),.18]]},
    tree:{volume:.11,attack:.006,release:.10,partials:[[.25,'sine',1],[.58,'sine',.22,.45]]},
    mill:{volume:.16,attack:.008,release:.19,partials:[[1,'sine',1],[2,'triangle',.16],[3,'sine',.035]]},
    gutter:{volume:mix(.125,.098),attack:mix(.014,.031),release:mix(.42,.54),partials:[[1,'sine',1],[2,'sine',mix(.16,.065)],[3,'sine',mix(.035,.008)]]},
    bell:{volume:mix(.13,.105),attack:mix(.009,.024),release:mix(1.15,.92),partials:[[1,'sine',1],[2,'sine',mix(.16,.09)],[2.76,'sine',mix(.22,.065),mix(.55,.30)],[5.4,'sine',mix(.065,.007),.18],[7.13,'sine',mix(.022,.0015),.12]]},
    pad:{volume:.055,attack:.3,release:.4,partials:[[1,'sine',1],[2,'sine',.08]]},
    backing:{volume:.055,attack:.02,release:.25,partials:[[1,'sine',1],[2,'sine',.08]]},
  };
  if(instrument==='tree'&&atmosphere==='rain')return {volume:.09,attack:.016,release:.19,partials:[[.25,'sine',1],[.5,'sine',.1,.55]]};
  if(instrument==='tree'&&atmosphere==='night')return {volume:.065,attack:.035,release:.20,partials:[[.25,'sine',1],[1,'sine',.07,.7]]};
  return presets[instrument];
}
const noiseBuffers=new WeakMap();
function leafVoice(context,destination,event,time,pan,onVoice){
  if(event.atmosphere==='night'){insectVoice(context,destination,event,time,pan,onVoice);return;}
  let buffer=noiseBuffers.get(context);if(!buffer){buffer=context.createBuffer(1,Math.ceil(context.sampleRate*.25),context.sampleRate);let seed=9421;const data=buffer.getChannelData(0);for(let i=0;i<data.length;i++){seed=(seed*1664525+1013904223)>>>0;data[i]=seed/2147483648-1;}noiseBuffers.set(context,buffer);}
  const source=context.createBufferSource(),filter=context.createBiquadFilter(),soft=context.createBiquadFilter(),gain=context.createGain(),panner=context.createStereoPanner();source.buffer=buffer;filter.type='bandpass';filter.frequency.value=(event.atmosphere==='rain'?650:1500)+Math.max(0,event.note-57)*40;filter.Q.value=.65;soft.type='lowpass';soft.frequency.value=event.atmosphere==='rain'?2200:3300;panner.pan.value=pan;
  gain.gain.setValueAtTime(0,time);gain.gain.linearRampToValueAtTime(.075*event.gain,time+.012);gain.gain.exponentialRampToValueAtTime(.0001,time+.15);gain.gain.linearRampToValueAtTime(0,time+.18);source.connect(filter).connect(soft).connect(gain).connect(panner).connect(destination);source.start(time);source.stop(time+.19);onVoice?.(1);source.onended=()=>{for(const node of [source,filter,soft,gain,panner])node.disconnect();onVoice?.(-1);};
}
function insectVoice(context,destination,event,time,pan,onVoice){
  // A quiet tuned chirr, gated at the player's beat; no ambient noise bed.
  const tone=context.createOscillator(),pulse=context.createOscillator(),pulseGain=context.createGain(),gain=context.createGain(),panner=context.createStereoPanner();tone.frequency.value=midiHz(event.note);pulse.frequency.value=22;pulseGain.gain.setValueAtTime(0,time);pulseGain.gain.linearRampToValueAtTime(.009*event.gain,time+.04);pulseGain.gain.setValueAtTime(.009*event.gain,time+.10);pulseGain.gain.linearRampToValueAtTime(0,time+.13);gain.gain.setValueAtTime(0,time);gain.gain.linearRampToValueAtTime(.022*event.gain,time+.025);gain.gain.setValueAtTime(.022*event.gain,time+.13);gain.gain.linearRampToValueAtTime(0,time+.22);pulse.connect(pulseGain).connect(gain.gain);tone.connect(gain).connect(panner).connect(destination);panner.pan.value=pan;tone.start(time);pulse.start(time+.025);tone.stop(time+.22);pulse.stop(time+.13);onVoice?.(2);tone.onended=()=>{tone.disconnect();gain.disconnect();panner.disconnect();onVoice?.(-1);};pulse.onended=()=>{pulse.disconnect();pulseGain.disconnect();onVoice?.(-1);};
}
export function synthVoice(context,destination,event,time,pan=0,onVoice=null) {
  if(event.instrument==='garden'){leafVoice(context,destination,event,time,pan,onVoice);return;}
  const duration=event.length*STEP_SECONDS,preset=voiceProfile(event.instrument,event.note,event.atmosphere);
  const panner=context.createStereoPanner();panner.pan.value=pan;panner.connect(destination);
  let remaining=preset.partials.length;
  for(const [ratio,wave,amplitude,ring]of preset.partials) {
    const osc=context.createOscillator(),gain=context.createGain(),peak=preset.volume*event.gain*amplitude;
    osc.type=wave;osc.frequency.value=midiHz(event.note)*ratio;
    gain.gain.setValueAtTime(0,time);gain.gain.linearRampToValueAtTime(peak,time+preset.attack);
    const decay=duration*(ring??1),release=ring?preset.release*ring:preset.release;
    if(event.instrument==='pad'){gain.gain.setValueAtTime(peak,time+Math.max(preset.attack,decay-.2));gain.gain.linearRampToValueAtTime(0,time+decay+release);}
    else {if(event.span>1&&['mill','gutter'].includes(event.instrument)){gain.gain.setTargetAtTime(peak*.72,time+preset.attack,.08);gain.gain.setValueAtTime(peak*.72,time+Math.max(preset.attack,duration-.06));}gain.gain.exponentialRampToValueAtTime(Math.max(.0001,peak*.14),time+Math.max(preset.attack+.01,decay));gain.gain.exponentialRampToValueAtTime(.0001,time+decay+release);gain.gain.linearRampToValueAtTime(0,time+decay+release+.02);}
    osc.connect(gain).connect(panner);osc.start(time);osc.stop(time+decay+release+.04);onVoice?.(1);
    osc.onended=()=>{osc.disconnect();gain.disconnect();onVoice?.(-1);if(--remaining===0)panner.disconnect();};
  }
}
export class TownAudio {
  constructor(onStep=null){this.context=null;this.master=null;this.timer=null;this.muted=true;this.stepIndex=0;this.voices=0;this.network=null;this.scale='d';this.backing=true;this.onStep=onStep;this.pending=[];this.lastStep=-1;this.heardAnimals=new Set();}
  setTown(town,network){this.scale=town.scale;this.network=network;this.backing=town.backing??true;}
  async start(step=0) {
    if(!this.context||this.context.state==='closed'){
      const Context=window.AudioContext||window.webkitAudioContext;if(!Context)throw new Error('このブラウザでは音を使えません。光で遊べます。');
      this.context=new Context();this.master=this.context.createGain();this.master.gain.value=0;
      const compressor=this.context.createDynamicsCompressor();compressor.threshold.value=-14;compressor.knee.value=18;compressor.ratio.value=3;compressor.attack.value=.004;compressor.release.value=.25;
      this.bus=this.context.createGain();this.bus.gain.value=1.5;this.bus.connect(compressor).connect(this.master).connect(this.context.destination);
      for(const [seconds,amount]of [[.19,.09],[.31,.06]]){const delay=this.context.createDelay(1),gain=this.context.createGain(),filter=this.context.createBiquadFilter();delay.delayTime.value=seconds;gain.gain.value=amount;filter.type='lowpass';filter.frequency.value=2100;this.bus.connect(delay).connect(filter).connect(gain).connect(compressor);}
      this.stepIndex=step%64;
    }
    await this.context.resume();this.muted=false;this.master.gain.setTargetAtTime(.85,this.context.currentTime,.025);
    if(!this.timer){this.nextTime=this.context.currentTime+.05;this.timer=window.setInterval(()=>this.schedule(),25);}
  }
  setMuted(muted){this.muted=muted;if(this.master)this.master.gain.setTargetAtTime(muted?0:.85,this.context.currentTime,.025);}
  schedule(){
    if(!this.context||this.context.state!=='running'||!this.network)return;
    if(this.nextTime<this.context.currentTime-.1)this.nextTime=this.context.currentTime+.04;
    while(this.nextTime<this.context.currentTime+.12){
      const notes=windNotes(this.stepIndex,this.network,this.heardAnimals),events=[...notes,...(this.backing?accompanimentAt(this.stepIndex,this.scale):[])];
      if(!this.muted)for(const event of events)synthVoice(this.context,this.bus,event,this.nextTime,event.x!==undefined?(event.x/15-.5)*.6:0,n=>{this.voices+=n;});
      this.pending.push({time:this.nextTime,step:this.stepIndex,notes});this.nextTime+=STEP_SECONDS;this.stepIndex=(this.stepIndex+1)%64;
    }
  }
  flushVisuals(){if(!this.context||this.context.state!=='running')return;while(this.pending.length&&this.pending[0].time<=this.context.currentTime){const item=this.pending.shift();this.lastStep=item.step;this.onStep?.(item.step,item.notes);}}
  async suspend(){if(this.context&&this.context.state==='running')await this.context.suspend();}
  async resume(){if(this.context?.state==='suspended'){await this.context.resume();this.pending=[];this.nextTime=this.context.currentTime+.05;}}
  async close(){if(this.timer)clearInterval(this.timer);this.timer=null;this.pending=[];this.muted=true;if(this.context&&this.context.state!=='closed')await this.context.close();}
}
