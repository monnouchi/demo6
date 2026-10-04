// Original eight-bar score. The gutter repeats a motif with answering phrases;
// the wheel and bells share the D–G–Bm–A harmony and the same musical clock.
export const BPM = 88;
export const STEP_SECONDS = 60 / BPM / 4;
export const BAR_SECONDS = STEP_SECONDS * 16;
export const CHORDS = [
  { name: 'D add9', root: 50, fifth: 57, notes: [62, 66, 69], pad: [50, 57, 64, 66] },
  { name: 'D add9', root: 50, fifth: 57, notes: [62, 66, 69], pad: [50, 57, 64, 66] },
  { name: 'G maj7', root: 43, fifth: 50, notes: [59, 62, 66], pad: [43, 50, 59, 66] },
  { name: 'G maj7', root: 43, fifth: 50, notes: [59, 62, 66], pad: [43, 50, 59, 66] },
  { name: 'B m7', root: 47, fifth: 54, notes: [59, 62, 66], pad: [47, 54, 62, 66] },
  { name: 'B m7', root: 47, fifth: 54, notes: [59, 62, 66], pad: [47, 54, 62, 66] },
  { name: 'A sus4', root: 45, fifth: 52, notes: [57, 62, 64], pad: [45, 52, 62, 64] },
  { name: 'A', root: 45, fifth: 52, notes: [57, 61, 64], pad: [45, 52, 61, 64] },
];
const MELODY = [
  [74, 78, 81, 78, 76], [74, 76, 78, 76, 74],
  [74, 78, 83, 81, 78], [76, 74, 71, 74, 78],
  [74, 78, 81, 78, 76], [74, 71, 69, 71, 74],
  [76, 81, 78, 76, 74], [76, 73, 69, 73, 74],
];
const MELODY_STEPS = [0, 3, 6, 8, 12];
const MELODY_LENGTHS = [3, 3, 2, 4, 4];
export const midiHz = note => 440 * 2 ** ((note - 69) / 12);
export function scoreAt(stepIndex, counts, activeCount = 0) {
  const bar = Math.floor(stepIndex / 16) % 8, step = stepIndex % 16, chord = CHORDS[bar];
  const events = [];
  if (counts.mill > 0 && [0, 6, 8, 14].includes(step)) events.push({ instrument: 'mill', note: [0, 8].includes(step) ? chord.root : chord.fifth, length: [0, 8].includes(step) ? 5 : 1.6, gain: Math.min(1.3, 0.85 + counts.mill * 0.12) * (step === 6 || step === 14 ? 0.65 : 1) });
  const melodyIndex = MELODY_STEPS.indexOf(step);
  if (counts.gutter > 0 && melodyIndex >= 0) events.push({ instrument: 'gutter', note: MELODY[bar][melodyIndex], length: MELODY_LENGTHS[melodyIndex], gain: Math.min(1.25, .8 + counts.gutter * .10) });
  if (counts.bell > 0 && step === 0 && bar % 2 === 0) chord.notes.forEach((note, i) => events.push({ instrument: 'bell', note, length: 12, offset: i * .065, gain: .32 * Math.min(1.3, .9 + counts.bell * .08) }));
  if (counts.bell > 0 && step === 10 && bar % 2 === 1) events.push({ instrument: 'bell', note: chord.notes[2] + 12, length: 6, gain: .45 });
  if (activeCount >= 4 && counts.mill > 0 && counts.gutter > 0 && counts.bell > 0 && step === 0) chord.pad.forEach(note => events.push({ instrument: 'pad', note, length: 16, gain: .22 }));
  return events;
}

export function synthVoice(context, destination, event, time, pan = 0, onVoice = null) {
  const duration = event.length * STEP_SECONDS;
  const gain = context.createGain();
  const panner = context.createStereoPanner();
  panner.pan.value = pan;
  gain.connect(panner).connect(destination);
  const preset = {
    mill: { volume: .20, attack: .014, release: .22, harmonics: [[1, 'sine', 1], [2, 'triangle', .20]] },
    gutter: { volume: .12, attack: .012, release: .48, harmonics: [[1, 'sine', 1], [2, 'sine', .23], [3, 'sine', .05]] },
    bell: { volume: .14, attack: .012, release: 1.0, harmonics: [[1, 'sine', 1], [2, 'sine', .35], [3, 'sine', .08]] },
    pad: { volume: .065, attack: .42, release: .45, harmonics: [[1, 'sine', 1], [2, 'sine', .10]] },
  }[event.instrument];
  const peak = preset.volume * event.gain;
  gain.gain.setValueAtTime(0, time);
  gain.gain.linearRampToValueAtTime(peak, time + preset.attack);
  if (event.instrument === 'pad') {
    gain.gain.setValueAtTime(peak, time + Math.max(preset.attack, duration - .25));
    gain.gain.linearRampToValueAtTime(0, time + duration + preset.release);
  } else {
    gain.gain.exponentialRampToValueAtTime(Math.max(.0001, peak * .2), time + Math.max(preset.attack + .02, duration));
    gain.gain.exponentialRampToValueAtTime(.0001, time + duration + preset.release);
    gain.gain.linearRampToValueAtTime(0, time + duration + preset.release + .02);
  }
  let remaining = preset.harmonics.length;
  for (const [ratio, wave, amplitude] of preset.harmonics) {
    const oscillator = context.createOscillator(), harmonicGain = context.createGain();
    oscillator.type = wave;
    oscillator.frequency.value = midiHz(event.note) * ratio;
    harmonicGain.gain.value = amplitude;
    oscillator.connect(harmonicGain).connect(gain);
    oscillator.start(time);
    oscillator.stop(time + duration + preset.release + .04);
    onVoice?.(1);
    oscillator.onended = () => { oscillator.disconnect(); harmonicGain.disconnect(); onVoice?.(-1); if (--remaining === 0) { gain.disconnect(); panner.disconnect(); } };
  }
}

export class TownAudio {
  constructor() { this.context = null; this.master = null; this.timer = null; this.muted = true; this.stepIndex = 0; this.network = null; this.voices = 0; this.queuedParts = null; this.parts = { mill: 1, gutter: 0, bell: 0 }; this.activeCount = 1; this.lastBar = 0; }
  setNetwork(network) { this.network = network; this.queuedParts = { ...network.counts }; }
  async start() {
    if (!this.context || this.context.state === 'closed') {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) throw new Error('このブラウザでは音を使えません。音なしで遊べます。');
      this.context = new AudioContextClass();
      this.master = this.context.createGain();this.master.gain.value = 0;
      const compressor = this.context.createDynamicsCompressor();
      compressor.threshold.value = -16;compressor.knee.value = 18;compressor.ratio.value = 3;compressor.attack.value = .008;compressor.release.value = .25;
      this.bus = this.context.createGain();
      this.bus.gain.value = .7;
      this.bus.connect(compressor).connect(this.master).connect(this.context.destination);
      // Two quiet, filtered reflections give the original instruments a shared room.
      for (const [seconds, amount] of [[.23, .14], [.41, .09]]) {
        const delay = this.context.createDelay(1), reflection = this.context.createGain(), filter = this.context.createBiquadFilter();
        delay.delayTime.value = seconds;reflection.gain.value = amount;filter.type='lowpass';filter.frequency.value = 2200;
        this.bus.connect(delay).connect(filter).connect(reflection).connect(compressor);
      }
      this.nextTime = this.context.currentTime + .08;
    }
    await this.context.resume();
    this.muted = false;
    this.master.gain.setTargetAtTime(.65, this.context.currentTime, .035);
    if (!this.timer) { this.nextTime = this.context.currentTime + .08; this.timer = window.setInterval(() => this.schedule(), 25); }
  }
  setMuted(muted) { this.muted=muted;if(this.master)this.master.gain.setTargetAtTime(muted?0:.65,this.context.currentTime,.035); }
  schedule() {
    if(!this.context || this.context.state!=='running')return;
    if(this.nextTime < this.context.currentTime - .1)this.nextTime=this.context.currentTime+.04;
    while(this.nextTime < this.context.currentTime+.13) {
      if(this.stepIndex%16===0) { if(this.queuedParts)this.parts={...this.queuedParts};this.activeCount=this.network?.activeCount??1;this.lastBar=Math.floor(this.stepIndex/16)%8; }
      if(!this.muted) for(const event of scoreAt(this.stepIndex,this.parts,this.activeCount)) {
        const buildings=this.network?.buildings.filter(b=>b.active&&b.type===event.instrument)??[];
        const pan=buildings.length?((buildings.reduce((sum,b)=>sum+b.x,0)/buildings.length)/12-.5)*.7:0;
        synthVoice(this.context,this.bus,event,this.nextTime+(event.offset??0),pan,n=>{this.voices+=n;});
      }
      this.nextTime+=STEP_SECONDS;this.stepIndex=(this.stepIndex+1)%128;
    }
  }
  async suspend() { if(this.context)await this.context.suspend(); }
  async resume() { if(this.context&&this.context.state==='suspended') { await this.context.resume();this.nextTime=this.context.currentTime+.08; } }
  async close() { if(this.timer)clearInterval(this.timer);this.timer=null;this.muted=true;if(this.context&&this.context.state!=='closed')await this.context.close(); }
}
