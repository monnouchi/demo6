import { SCALES } from './core.js?v=0.4.1';
export const BPM=88, STEP_SECONDS=60/BPM/2, BAR_SECONDS=STEP_SECONDS*8;
export const midiHz=note=>440*2**((note-69)/12);
export const noteName=note=>['C','C♯','D','E♭','E','F','F♯','G','A♭','A','B♭','B'][((note%12)+12)%12]+(Math.floor(note/12)-1);
export function scoreAt(stepIndex,network) {
  return network.buildings.filter(b=>b.active&&b.x===stepIndex%16).map(b=>({instrument:b.type,note:b.note,length:b.type==='bell'?4:b.type==='mill'?1.3:1.7,gain:.85,index:b.index,x:b.x,y:b.y}));
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
export function synthVoice(context,destination,event,time,pan=0,onVoice=null) {
  const duration=event.length*STEP_SECONDS;
  const preset={
    mill:{volume:.16,attack:.008,release:.19,partials:[[1,'sine',1],[2,'triangle',.16],[3,'sine',.035]]},
    gutter:{volume:.12,attack:.009,release:.36,partials:[[1,'sine',1],[2,'sine',.19],[3,'sine',.045]]},
    bell:{volume:.13,attack:.003,release:1.3,partials:[[1,'sine',1],[2.76,'sine',.30],[5.4,'sine',.10],[7.13,'sine',.04]]},
    pad:{volume:.055,attack:.3,release:.4,partials:[[1,'sine',1],[2,'sine',.08]]},
    backing:{volume:.055,attack:.02,release:.25,partials:[[1,'sine',1],[2,'sine',.08]]},
  }[event.instrument];
  const panner=context.createStereoPanner();panner.pan.value=pan;panner.connect(destination);
  let remaining=preset.partials.length;
  for(const [ratio,wave,amplitude]of preset.partials) {
    const osc=context.createOscillator(),gain=context.createGain(),peak=preset.volume*event.gain*amplitude;
    osc.type=wave;osc.frequency.value=midiHz(event.note)*ratio;
    gain.gain.setValueAtTime(0,time);gain.gain.linearRampToValueAtTime(peak,time+preset.attack);
    const decay=event.instrument==='bell'&&ratio>1?duration/(ratio*.55):duration;
    if(event.instrument==='pad'){gain.gain.setValueAtTime(peak,time+Math.max(preset.attack,decay-.2));gain.gain.linearRampToValueAtTime(0,time+decay+preset.release);}
    else {gain.gain.exponentialRampToValueAtTime(Math.max(.0001,peak*.14),time+Math.max(preset.attack+.01,decay));gain.gain.exponentialRampToValueAtTime(.0001,time+decay+preset.release);gain.gain.linearRampToValueAtTime(0,time+decay+preset.release+.02);}
    osc.connect(gain).connect(panner);osc.start(time);osc.stop(time+decay+preset.release+.04);onVoice?.(1);
    osc.onended=()=>{osc.disconnect();gain.disconnect();onVoice?.(-1);if(--remaining===0)panner.disconnect();};
  }
}
export class TownAudio {
  constructor(onStep=null){this.context=null;this.master=null;this.timer=null;this.muted=true;this.stepIndex=0;this.voices=0;this.network=null;this.scale='d';this.backing=true;this.onStep=onStep;this.pending=[];this.lastStep=-1;}
  setTown(town,network){this.scale=town.scale;this.network=network;}
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
      const notes=scoreAt(this.stepIndex,this.network),events=[...notes,...(this.backing?accompanimentAt(this.stepIndex,this.scale):[])];
      if(!this.muted)for(const event of events)synthVoice(this.context,this.bus,event,this.nextTime,event.x!==undefined?(event.x/15-.5)*.6:0,n=>{this.voices+=n;});
      this.pending.push({time:this.nextTime,step:this.stepIndex,notes});this.nextTime+=STEP_SECONDS;this.stepIndex=(this.stepIndex+1)%64;
    }
  }
  flushVisuals(){if(!this.context||this.context.state!=='running')return;while(this.pending.length&&this.pending[0].time<=this.context.currentTime){const item=this.pending.shift();this.lastStep=item.step;this.onStep?.(item.step,item.notes);}}
  async suspend(){if(this.context&&this.context.state==='running')await this.context.suspend();}
  async resume(){if(this.context?.state==='suspended'){await this.context.resume();this.pending=[];this.nextTime=this.context.currentTime+.05;}}
  async close(){if(this.timer)clearInterval(this.timer);this.timer=null;this.pending=[];this.muted=true;if(this.context&&this.context.state!=='closed')await this.context.close();}
}
