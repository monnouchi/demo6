import { WIDTH, HEIGHT, TYPES, MUSICAL_TYPES, createTown, waterNetwork, build, advance, upgrade, undoChanges, lineCells, restoreTown } from './core.js';
import { renderTown, setCursor, icon, welcomeArt } from './render.js';
import { TownAudio, CHORDS } from './music.js';

const $ = id => document.getElementById(id);
const SAVE_KEY = 'mon.demo6.town.v1';
let town = createTown(), saveProblem = '', running = false, tool = 'canal', network;
let lastFrame = 0, lastUi = 0, lastSave = 0, cursor = [2, 3], keyboardMode = false;
let stroke = null, lastPointer = null, toastTimer = null, history = [], ensembleSignature = '';
const audio = new TownAudio();
try {
  const data = localStorage.getItem(SAVE_KEY);
  if (data) town = restoreTown(JSON.parse(data));
} catch { saveProblem = '保存された街を読み込めませんでした。新しい街で始めます。'; }
network = waterNetwork(town);
const soundOn = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9h4l5-4v14l-5-4H4zM17 8q4 4 0 8M20 5q7 7 0 14"/></svg>';
const soundOff = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9h4l5-4v14l-5-4H4zM17 9l5 6M22 9l-5 6"/></svg>';

function toast(message, duration = 3500) {
  if(!message)return;
  $('toast').textContent=message;$('toast').classList.add('visible');
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),duration);
}
function save() {
  try { localStorage.setItem(SAVE_KEY,JSON.stringify(town));$('save-status').textContent='この端末に自動保存'; }
  catch { $('save-status').textContent='自動保存できません · 設定からファイル保存できます'; }
}
function redraw() { network=waterNetwork(town);audio.setNetwork(network);renderTown($('town'),town,network,tool,keyboardMode?cursor:null);updateUi(); }
function selectTool(type) {
  if(!TYPES[type])return;
  tool=type;
  document.querySelectorAll('.tool-button').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.tool===type)));
  $('tool-description').textContent=TYPES[type].description;$('town').dataset.tool=type;
  const hover=$('town').querySelector('#hover-cell');if(hover)hover.classList.toggle('selection-removal',type==='remove');
  $('board-caption').textContent=type==='canal'?'泉から、好きな方向へ。':type==='remove'?'材料を戻して、つくり直そう。':`${TYPES[type].name}を、水路のとなりに。`;
}
function updateSoundUi() {
  const playing=!!audio.context&&!audio.muted;
  $('sound-button').innerHTML=playing?soundOn:soundOff;
  $('sound-button').setAttribute('aria-label',playing?'音をミュートする':'音をオンにする');
  $('sound-button').setAttribute('aria-pressed',String(playing));ensembleSignature='';
}
async function enableSound() {
  try { await audio.start();updateSoundUi();return true; }
  catch(error) { audio.setMuted(true);updateSoundUi();toast(error.message);return false; }
}
function goalCheck(label, done, value='') { return `<div class="goal-check ${done?'done':''}"><span class="check-mark">${done?'✓':''}</span><span>${label}</span><span class="check-value">${value}</span></div>`; }
function updateUi() {
  $('wood-value').textContent=Math.floor(town.wood).toLocaleString('ja-JP');$('wood-rate').textContent=`+${network.woodRate.toFixed(1)} / 秒`;
  $('active-value').textContent=network.activeCount;$('growth-value').textContent=Math.floor(town.growth);
  $('weather-label').textContent=network.raining?'☂ やさしい雨':'☀ おだやかな昼';
  $('flow-label').textContent=`${network.demand} / ${network.capacity}`;
  $('flow-meter').style.width=`${Math.min(100,network.demand/network.capacity*100)}%`;
  $('flow-meter').style.background=network.efficiency<1?'#c5a365':'#9bc3be';
  $('flow-copy').textContent=network.efficiency<1?`水を分け合っています。生産は${Math.round(network.efficiency*100)}%。泉を深くすると元気になります。`:'まだ余裕があります。水路は枝分かれできます。';
  const upgradeCost=40+town.upgrades*20;
  $('upgrade-button').innerHTML=town.upgrades>=3?'泉は十分に深くなりました':`泉を深くする <span>木材 ${upgradeCost}</span>`;
  $('upgrade-button').disabled=town.upgrades>=3||town.wood<upgradeCost;
  $('undo-button').disabled=history.length===0;
  const stage=town.stage;
  $('stage-number').textContent=stage===3?'COMPLETE':`0${stage+1} / 03`;
  let progress=0;
  if(stage===0) {
    $('goal-title').textContent='はじめの掛け合い';$('goal-copy').textContent='雨樋か鐘を置いて、水路をつなごう。水の届いた建物が街の仲間になる。';
    $('goal-checks').innerHTML=goalCheck('水の届く楽器 2種',network.roles>=2,`${network.roles} / 2`);
    $('goal-footnote').textContent='達成で木材 +20。順番も、場所も、自由。';progress=network.roles/2;
  } else if(stage===1) {
    $('goal-title').textContent='3つの音がひとつに';$('goal-copy').textContent='水車の拍に、雨樋の旋律、鐘の余韻。3種の建物へ、水を届けよう。';
    $('goal-checks').innerHTML=MUSICAL_TYPES.map(type=>goalCheck(TYPES[type].name,network.counts[type]>0,network.counts[type]>0?'水が届いた':'まだ')).join('');
    $('goal-footnote').textContent='達成で木材 +25。合奏は次の小節から。';progress=network.roles/3;
  } else if(stage===2) {
    $('goal-title').textContent='小さな水の祝祭';$('goal-copy').textContent='動く建物を6棟へ。花園や楽器を増やして、彩り60の街を育てよう。';
    $('goal-checks').innerHTML=goalCheck('楽器 3種',network.roles===3,`${network.roles}/3`)+goalCheck('動く建物',network.activeCount>=6,`${network.activeCount}/6`)+goalCheck('街の彩り',town.growth>=60,`${Math.floor(town.growth)}/60`);
    $('goal-footnote').textContent='花園は彩りを育てるのが得意です。';progress=(Math.min(1,network.roles/3)+Math.min(1,network.activeCount/6)+Math.min(1,town.growth/60))/3;
  } else {
    $('goal-title').textContent='この街だけの合奏';$('goal-copy').textContent='小さな水の祝祭を達成しました。水路を広げたり、庭を増やしたり。街の続きは、あなたの手に。';
    $('goal-checks').innerHTML=goalCheck('祝祭の記録',true,`${Math.floor(town.festivalAt/60)}分${Math.floor(town.festivalAt%60)}秒`);
    $('goal-footnote').textContent='あなたの仕組みから生まれた風景。';progress=1;
  }
  $('goal-progress').style.width=`${Math.min(100,progress*100)}%`;
  const playing=!!audio.context&&!audio.muted;
  const signature=MUSICAL_TYPES.map(t=>network.counts[t]).join(',')+playing;
  if(signature!==ensembleSignature) {
    $('ensemble-parts').innerHTML=MUSICAL_TYPES.map(type=>`<div class="ensemble-part ${network.counts[type]>0?'active':''} ${playing?'playing':''}"><span class="part-icon">${icon(type)}</span><div class="part-label">${TYPES[type].name}<span>${TYPES[type].role} · ${network.counts[type]>0?`${network.counts[type]}棟が参加`:'水を待っています'}</span></div><span class="part-status" aria-hidden="true"><i></i><i></i><i></i></span></div>`).join('');
    ensembleSignature=signature;
  }
  $('music-status').textContent=playing?network.activeCount?'同じフレーズを、街みんなで':'水の音を待っています':running?'ミュート中 · 右上の音ボタンで開始':'音は、はじめる時に選べます';
  const bar=audio.context?audio.lastBar:0;
  $('phrase-meter').innerHTML=Array.from({length:8},(_,i)=>`<i class="${playing&&i===bar?'current':''}"></i>`).join('');$('chord-label').textContent=CHORDS[bar].name;
}
function inspect(type,x,y) {
  if(!TYPES[type]||type==='canal')return;
  const building=network.buildings.find(b=>b.x===x&&b.y===y);
  toast(building?.active?`${TYPES[type].name}に水が届いています。${type==='mill'?'木材をつくっています。':type==='garden'?'花が街の彩りを育てています。':`${TYPES[type].role}を奏でます。`}`:`${TYPES[type].name}は水を待っています。泉につながる水路を上下左右に引こう。`);
}
function place(x,y,quiet=false) {
  const result=build(town,tool,x,y);
  if(result.ok){stroke?.push(result.change);redraw();return true;}
  if(!quiet){if(result.inspect)inspect(result.inspect,x,y);else toast(result.reason);}
  return false;
}
function finishStroke() {
  if(stroke?.length){history.push(stroke);if(history.length>30)history.shift();save();}
  stroke=null;lastPointer=null;updateUi();
}
function pointFromEvent(event) {
  const matrix=$('town').getScreenCTM();if(!matrix)return null;
  const point=new DOMPoint(event.clientX,event.clientY).matrixTransform(matrix.inverse());
  const x=Math.floor((point.x-60)/60),y=Math.floor((point.y-61)/58);
  return x>=0&&x<WIDTH&&y>=0&&y<HEIGHT?[x,y]:null;
}
function undo() {
  if(!history.length)return;
  const changes=history.at(-1);
  if(!undoChanges(town,changes)){toast('戻すための木材が足りません。少し待ってからもう一度。');return;}
  history.pop();redraw();save();toast('ひとつ前の建設を戻しました。',1800);
}
function showFestival() {
  $('festival-stats').innerHTML=`<div><strong>${network.activeCount}</strong><span>水のある建物</span></div><div><strong>${Math.floor(town.growth)}</strong><span>街の彩り</span></div><div><strong>3</strong><span>合奏の音色</span></div>`;
  if(!document.querySelector('dialog[open]'))$('festival-dialog').showModal();
  else toast('小さな水の祝祭を達成！この街だけの合奏ができました。',6500);
}
function frame(time) {
  const dt=lastFrame?Math.min((time-lastFrame)/1000,.1):0;lastFrame=time;
  if(running&&!document.hidden) {
    const events=advance(town,dt,network);
    if(network.raining!==(town.elapsed%72>=54)){redraw();if(network.raining)toast('やさしい雨。泉の水量と雨樋の彩りが増えています。');}
    for(const event of events) {
      if(event==='duet')toast('はじめの掛け合い！木材が20増えました。');
      if(event==='trio')toast('3つの音がひとつに。木材が25増えました。');
      if(event==='festival'){redraw();save();showFestival();}
    }
    if(time-lastUi>250){updateUi();lastUi=time;}
    if(time-lastSave>4000){save();lastSave=time;}
  }
  requestAnimationFrame(frame);
}
async function start(sound) {
  $('welcome-dialog').close();running=true;lastFrame=0;
  if(sound)await enableSound();else{audio.setMuted(true);updateSoundUi();}
  if(saveProblem)toast(saveProblem,6000);else toast(town.elapsed>1?'おかえりなさい。あなたの街の続きを。':'水路を選んで、泉から自由につなげよう。',4200);
  redraw();
}

$('build-bar').innerHTML=Object.entries(TYPES).map(([type,data],i)=>`<button class="tool-button" data-tool="${type}" aria-label="${data.name}${type==='remove'?'、木材は戻ります':`、木材${data.cost}`}" aria-pressed="${type===tool}"><span class="tool-icon" aria-hidden="true">${icon(type)}</span><span><b>${data.name}</b><small>${type==='remove'?'材料を返す':`木材 ${data.cost}`}</small></span></button>`).join('');
$('build-bar').addEventListener('click',event=>{const button=event.target.closest('[data-tool]');if(button)selectTool(button.dataset.tool);});
$('town').addEventListener('pointerdown',event=>{
  if(!running||event.button!==0)return;
  const position=pointFromEvent(event);if(!position)return;
  event.preventDefault();keyboardMode=false;setCursor($('town'),null,true);cursor=position;
  stroke=[];lastPointer=position;$('town').setPointerCapture(event.pointerId);place(...position);
});
$('town').addEventListener('pointermove',event=>{
  const position=pointFromEvent(event);setCursor($('town'),position);
  if(!stroke||!position||!lastPointer||(tool!=='canal'&&tool!=='remove'))return;
  const cells=lineCells(lastPointer,position);for(const [x,y]of cells)place(x,y,true);lastPointer=position;
});
$('town').addEventListener('pointerup',finishStroke);
$('town').addEventListener('pointercancel',finishStroke);
$('town').addEventListener('lostpointercapture',()=>{if(stroke)finishStroke();});
$('town').addEventListener('pointerleave',()=>setCursor($('town'),null));
$('town').addEventListener('focus',()=>{keyboardMode=true;setCursor($('town'),cursor,true);});
$('town').addEventListener('blur',()=>{keyboardMode=false;setCursor($('town'),null,true);});
$('town').addEventListener('keydown',event=>{
  if(!running)return;
  const moves={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};
  if(moves[event.key]){event.preventDefault();cursor=[Math.max(0,Math.min(WIDTH-1,cursor[0]+moves[event.key][0])),Math.max(0,Math.min(HEIGHT-1,cursor[1]+moves[event.key][1]))];keyboardMode=true;setCursor($('town'),cursor,true);}
  if(event.key==='Enter'||event.key===' '){event.preventDefault();stroke=[];place(...cursor);finishStroke();}
});
document.addEventListener('keydown',event=>{
  if(event.target.matches('input')||document.querySelector('dialog[open]'))return;
  if(/^[1-6]$/.test(event.key))selectTool(Object.keys(TYPES)[Number(event.key)-1]);
  if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='z'){event.preventDefault();undo();}
  if(event.key.toLowerCase()==='m')$('sound-button').click();
});
$('undo-button').addEventListener('click',undo);
$('sound-button').addEventListener('click',async()=>{if(!audio.context||audio.muted)await enableSound();else{audio.setMuted(true);updateSoundUi();}updateUi();});
$('help-button').addEventListener('click',()=>$('help-dialog').showModal());
$('menu-button').addEventListener('click',()=>$('menu-dialog').showModal());
document.querySelectorAll('[data-close]').forEach(button=>button.addEventListener('click',()=>$ (button.dataset.close).close()));
$('start-sound').addEventListener('click',()=>start(true));$('start-silent').addEventListener('click',()=>start(false));
$('upgrade-button').addEventListener('click',()=>{const result=upgrade(town);if(result.ok){redraw();save();toast('泉が深くなり、水量が6増えました。');}else toast(result.reason);});
$('continue-button').addEventListener('click',()=>$('festival-dialog').close());
$('reset-button').addEventListener('click',()=>{$('reset-confirm').hidden=false;$('reset-button').hidden=true;});
$('reset-no').addEventListener('click',()=>{$('reset-confirm').hidden=true;$('reset-button').hidden=false;});
$('reset-yes').addEventListener('click',()=>{town=createTown();history=[];audio.stepIndex=0;redraw();save();$('reset-confirm').hidden=true;$('reset-button').hidden=false;$('menu-dialog').close();toast('新しい街がはじまりました。');});
$('export-button').addEventListener('click',()=>{
  finishStroke();const blob=new Blob([JSON.stringify(town,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');
  link.href=url;link.download='demo6-town.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('街をファイルに保存しました。');
});
$('import-input').addEventListener('change',async event=>{
  const file=event.target.files[0];if(!file)return;
  try{if(file.size>100000)throw new Error('街のファイルが大きすぎます。');const loaded=restoreTown(JSON.parse(await file.text()));town=loaded;history=[];redraw();save();$('menu-dialog').close();toast('保存した街を読み込みました。');}
  catch(error){toast(error instanceof SyntaxError?'街のJSONファイルを選んでください。':error.message,5000);}
  event.target.value='';
});
document.addEventListener('visibilitychange',()=>{lastFrame=0;if(document.hidden){save();audio.suspend().catch(()=>{});}else audio.resume().catch(()=>{});});
window.addEventListener('pagehide',()=>{save();audio.close();});
$('welcome-art').innerHTML=welcomeArt();
selectTool('canal');updateSoundUi();redraw();
$('welcome-dialog').showModal();requestAnimationFrame(frame);
