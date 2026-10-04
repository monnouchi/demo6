import { WIDTH, HEIGHT, TYPES, SCALES, MUSICAL_TYPES, WOOD_BUDGET, createTown, waterNetwork, build, moveBuilding, undoChanges, previewAction, recordPlayback, advance, lineCells, restoreTown, cellAt, noteFor } from './core.js?v=0.4.1';
import { renderTown, pulseTown, setCursor, center, icon, welcomeArt } from './render.js?v=0.4.1';
import { TownAudio, scoreAt, STEP_SECONDS, noteName } from './music.js?v=0.4.1';
import { captureTown, photoFrame, downloadBlob, sharablePhoto, sharePhoto } from './photo.js?v=0.4.1';
import { restoreTown as restoreLegacy, waterNetwork as legacyNetwork } from './legacy-core.js?v=0.4.1';
import { renderTown as renderLegacy } from './legacy-render.js?v=0.4.1';
import { reasonCopy, currentCellCopy, previewCopy, movedCellCopy } from './feedback.js?v=0.4.1';
const $=id=>document.getElementById(id),SAVE_KEY='mon.demo6.composition.v2',LEGACY_KEY='mon.demo6.town.v1';
let town=createTown(),network,legacy=null,saveProblem='',running=false,tool='gutter',cursor=[4,3],hover=null,moveSource=null,detailPosition=null;
let history=[],stroke=null,visited=null,lastPointer=null,toastTimer,lastFrame=0,lastSave=0,silentTime=0,silentStep=0,currentStep=-1,legacyRaw=null;
let photoBlob=null,photoFile=null,photoUrl=null,photoRequest=0,photoSource=null,sharing=false;
const camera={zoom:1,x:0,y:0,pan:false,drag:null};
const audio=new TownAudio(onStep);
try{const raw=localStorage.getItem(SAVE_KEY);if(raw)town=restoreTown(JSON.parse(raw));}catch{saveProblem='保存された街を読み込めません。元のデータは自動で上書きせず、設定から保管できます。';}
let preventAutoSave=!!saveProblem;
try{const raw=localStorage.getItem(LEGACY_KEY);if(raw){legacy=restoreLegacy(JSON.parse(raw));legacyRaw=raw;}}catch{/* Preserve the old key even if its contents cannot be displayed. */}
function toast(message,duration=3500){if(!message)return;$('toast').textContent=message;$('toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),duration);}
function save(){if(preventAutoSave){$('save-status').textContent='元データを保管してから保存できます';return;}try{localStorage.setItem(SAVE_KEY,JSON.stringify(town));$('save-status').textContent='この端末に自動保存';}catch{$('save-status').textContent='自動保存できません · 設定からファイル保存を';}}
function edited(){town.listenTicks=town.completed?16:0;if(preventAutoSave){try{localStorage.setItem('mon.demo6.composition.recovery',localStorage.getItem(SAVE_KEY));}catch{return;}}preventAutoSave=false;save();}
function redraw(){network=waterNetwork(town);audio.setTown(town,network);document.body.dataset.scene=town.scene;renderTown($('town'),town,network,tool,moveSource);if(currentStep>=0)pulseTown($('town'),currentStep,[]);setCursor($('town'),hover);updateUi();}
function selectTool(type){if(!TYPES[type])return;tool=type;moveSource=null;hover=null;detailPosition=null;camera.pan=false;updateCamera();document.querySelectorAll('[data-tool]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.tool===tool)));setCursor($('town'),hover);updateSelection();}
function updateSelection(){
  const data=TYPES[tool];$('selected-label').textContent=data.name;$('tool-stats').textContent=data.cost?`木材${data.cost}${data.demand?` · 水${data.demand} / 空き${network.capacity-network.used}`:tool==='garden'?' · 音なし / 水0':''}`:tool==='remove'?'木材を全額返す':tool==='move'?'木材0':'流す音を選ぶ';
  let message=data.description;
  if(moveSource&&!hover)message='移す先の空き地を選ぼう。';
  if(detailPosition&&(!hover||(hover[0]===detailPosition[0]&&hover[1]===detailPosition[1])))message=currentCellCopy(town,network,detailPosition);
  else if(hover){
    const result=previewAction(town,tool,...hover,moveSource);
    if(result.ok)message=previewCopy(result,tool,hover);
    else if(tool==='move'&&moveSource)message=hover[0]===moveSource[0]&&hover[1]===moveSource[1]?'楽器を選びました。移す先の空き地を選ぼう。':result.reason;else if(tool==='move')message=moveSource?'移す先の空き地を選ぼう。':'移す楽器・花園を選ぼう。';else if(result.inspect){const b=network.buildings.find(b=>b.x===hover[0]&&b.y===hover[1]);message=b?`${TYPES[b.type].name} · ${noteName(b.note)} · ${reasonCopy(b)}`:result.inspect==='garden'?'花園 · 音は鳴らない景観です。':data.description;}else if(result.reason)message=result.reason;
  }
  $('placement-preview').textContent=message;$('placement-preview').classList.toggle('warning',/足り|待ち|先に演奏|未接続/.test(message));
}
function check(label,done,value=''){return `<div class="goal-check ${done?'done':''}"><span>${done?'✓':'○'}</span>${label}<em>${value}</em></div>`;}
function updateUi(){
  $('wood-value').innerHTML=`${town.wood} <em>/ ${WOOD_BUDGET}</em>`;$('water-value').innerHTML=`${network.used} <em>/ ${network.capacity}</em>`;$('beat-value').innerHTML=`${network.beats} <em>/ 16</em>`;
  $('water-note').textContent=network.waterBlocked?`水待ち ${network.waterBlocked}棟`:network.used===network.capacity?'水量いっぱい':`あと${network.capacity-network.used}使えます`;
  $('beat-note').textContent=network.crowded?`拍待ち ${network.crowded}棟`:'同じ拍は3音まで';
  $('weather-label').textContent=network.raining?'☂ 雨 · 水＋4':town.scene==='evening'?'☾ おだやかな宵':'☀ おだやかな昼';
  $('flow-copy').textContent=`${network.activeCount}棟が演奏。${network.waterBlocked?`水待ち${network.waterBlocked}棟。水を止める楽器を選んで、別の音へ。`:'水の切替で、低音だけ・鐘だけの合奏にも。'}${network.crowded?`同じ拍で${network.crowded}棟が休止。横へ移して音の間を広げよう。`:''}`;
  let lesson='',stage=0;
  if(town.completed){lesson='はじめの一曲ができました。音も景色も、続きを自由に。';stage=3;}
  else if(!town.placed){lesson='雨樋を水路のとなりにひとつ。光る場所から音が鳴ります。';stage=0;}
  else if(!town.heard){lesson=network.buildings.some(b=>b.active&&b.index!==82)?'置いた楽器が光る拍を聴こう。その次に、1マス移してみよう。':'置いた楽器に水をつなごう。水路の上下左右で光と音が始まります。';stage=0;}
  else if(!town.moved){lesson='移動を選び、楽器→空き地。横は拍、上ほど高い音。';stage=1;}
  else {lesson=`4つの拍へ3つの音色を。いま ${network.beats}拍・${network.roles}音色。${network.roles===3&&network.beats>=4?'このまま2小節を聴こう。':''}`;stage=2;}
  $('lesson-copy').textContent=lesson;$('lesson-count').textContent=town.completed?'✓':`${stage+1} / 3`;
  $('goal-title').textContent=town.completed?'この街の一曲ができました。':'この街の、はじめの一曲。';
  $('goal-copy').textContent=town.completed?'音の間を広げたり、雨の合奏を聴いたり。花園と小道を、街の写真に。':'ひとつ置いて、移して聴く。次に4つの拍へ3つの音色を届け、2小節を一周。';
  $('goal-checks').innerHTML=check('置く → 聴く → 移す',town.placed&&town.heard&&town.moved)+check('3つの音色',network.roles===3,`${network.roles}/3`)+check('4つの拍',network.beats>=4,`${network.beats}/4`)+check('2小節を聴く',town.completed,`${town.listenTicks}/16`);
  $('goal-progress').style.width=`${town.completed?100:((town.placed&&town.moved?1:0)+network.roles/3+Math.min(1,network.beats/4)+town.listenTicks/16)/4*100}%`;
  $('undo-button').disabled=!history.length;$('scale-select').value=town.scale;$('scene-select').value=town.scene;
  $('backing-button').textContent=audio.backing?'伴奏あり · 88 BPM':'自分の音だけ · 88 BPM';$('backing-button').setAttribute('aria-pressed',String(audio.backing));
  const audible=!!audio.context&&!audio.muted;$('sound-button').textContent=audible?'♪':'♪̸';$('sound-button').setAttribute('aria-label',audible?'音をミュートする':'音をオンにする');$('sound-button').setAttribute('aria-pressed',String(audible));
  $('music-status').textContent=audible?'光る建物が、いま鳴っている音。':running?'ミュート中 · 光は音と同じ拍で進みます。':'音は、はじめる時に選べます。';
  $('legacy-button').hidden=!legacy;updateSelection();
}
function pushChanges(changes){if(!changes.length)return;history.push(changes);if(history.length>40)history.shift();edited();}
function place(x,y,quiet=false){
  if(tool==='move'){
    const cell=cellAt(town,x,y);
    if(cell&&['mill','gutter','bell','garden'].includes(cell.type)){detailPosition=null;moveSource=moveSource?.[0]===x&&moveSource?.[1]===y?null:[x,y];redraw();toast(moveSource?'空き地を選んで移動。横＝拍、縦＝高さ。':'移動を取り消しました。',2200);return;}
    if(!moveSource){if(!quiet)toast('移す楽器・花園を先に選ぼう。');return;}
    const result=moveBuilding(town,moveSource,[x,y]);if(!result.ok){toast(result.reason);return;}
    pushChanges(result.changes);moveSource=null;detailPosition=[x,y];redraw();toast(movedCellCopy(town,network,[x,y]),4200);return;
  }
  const result=build(town,tool,x,y);if(result.ok){stroke?.push(result.change);detailPosition=[x,y];redraw();}else if(!quiet){if(result.inspect){detailPosition=[x,y];updateSelection();}toast(result.reason);}
}
function finishStroke(){if(stroke?.length)pushChanges(stroke);stroke=null;visited=null;lastPointer=null;camera.drag=null;updateUi();}
function pointFromEvent(event){const matrix=$('town').getScreenCTM();if(!matrix)return null;const p=new DOMPoint(event.clientX,event.clientY).matrixTransform(matrix.inverse()),x=Math.floor((p.x-32)/64),y=Math.floor((p.y-65)/58);return x>=0&&x<WIDTH&&y>=0&&y<HEIGHT?[x,y]:null;}
function updateCamera(){const viewport=$('board-viewport');camera.x=Math.max(viewport.clientWidth*(1-camera.zoom),Math.min(0,camera.x));camera.y=Math.max(viewport.clientHeight*(1-camera.zoom),Math.min(0,camera.y));$('town').style.transform=`translate(${camera.x}px,${camera.y}px) scale(${camera.zoom})`;$('zoom-out').disabled=camera.zoom<=1;$('zoom-in').disabled=camera.zoom>=3;if(camera.zoom<=1)camera.pan=false;$('pan-button').disabled=camera.zoom<=1;$('pan-button').setAttribute('aria-pressed',String(camera.pan));$('board-viewport').classList.toggle('pan-mode',camera.pan);}
function focusCamera(position=cursor){if(camera.zoom<=1)return;const viewport=$('board-viewport'),bounds=viewport.getBoundingClientRect(),p=new DOMPoint(...center(...position)).matrixTransform($('town').getScreenCTM());camera.x+=bounds.width/2-(p.x-bounds.x);camera.y+=bounds.height/2-(p.y-bounds.y);updateCamera();}
function zoomBy(delta){const before=camera.zoom;camera.zoom=Math.max(1,Math.min(3,camera.zoom+delta));const viewport=$('board-viewport'),ratio=camera.zoom/before;camera.x=viewport.clientWidth/2-(viewport.clientWidth/2-camera.x)*ratio;camera.y=viewport.clientHeight/2-(viewport.clientHeight/2-camera.y)*ratio;updateCamera();if(before===1)focusCamera();}
function revealCursor(){if(camera.zoom===1)return;const viewport=$('board-viewport'),bounds=viewport.getBoundingClientRect(),p=new DOMPoint(...center(...cursor)).matrixTransform($('town').getScreenCTM()),x=p.x-bounds.x,y=p.y-bounds.y;if(x<30)camera.x+=30-x;else if(x>bounds.width-30)camera.x-=x-bounds.width+30;if(y<30)camera.y+=30-y;else if(y>bounds.height-30)camera.y-=y-bounds.height+30;updateCamera();}
function fitBoard(){const viewport=$('board-viewport');if(innerWidth>960){viewport.style.removeProperty('height');}else{const top=viewport.getBoundingClientRect().top+scrollY,height=Math.max(165,Math.min(viewport.clientWidth*666/1088,innerHeight-top-$('construction-panel').getBoundingClientRect().height-16));viewport.style.height=`${height}px`;}updateCamera();}
function undo(){if(!history.length)return;if(undoChanges(town,history.at(-1))){history.pop();moveSource=null;detailPosition=null;redraw();edited();toast('ひとつ前に戻しました。',1700);}}
function onStep(step,notes){if(!running||document.hidden)return;currentStep=step;$('town').dataset.step=step%16;pulseTown($('town'),step,notes);const meter=$('phrase-meter');meter.querySelectorAll('i').forEach((node,index)=>node.classList.toggle('current',index===step%16));const wasHeard=town.heard;const firstPerformance=recordPlayback(town,network,notes);if(wasHeard!==town.heard)updateUi();if(firstPerformance){save();updateUi();if(!document.querySelector('dialog[open]'))$('festival-dialog').showModal();else toast('この街の一曲ができました。写真にも残せます。',6000);}}
function frame(time){const dt=lastFrame?Math.min((time-lastFrame)/1000,.1):0;lastFrame=time;if(running&&!document.hidden){const rain=network.raining;advance(town,dt);if(rain!==(town.elapsed%60>=44)){redraw();toast(network.raining?'雨が泉に水を4足しています。休んでいた音も聴いてみよう。':'雨が上がりました。水を配り直すのも、街の編曲。',4000);}if(audio.context?.state==='running')audio.flushVisuals();else{silentTime+=dt;while(silentTime>=STEP_SECONDS){silentTime-=STEP_SECONDS;onStep(silentStep,scoreAt(silentStep,network));silentStep=(silentStep+1)%64;}}if(time-lastSave>2000){updateUi();save();lastSave=time;}}requestAnimationFrame(frame);}
async function enableSound(){try{await audio.start(silentStep);updateUi();}catch(error){audio.setMuted(true);toast(error.message);updateUi();}}
async function start(sound){$('welcome-dialog').close();running=true;lastFrame=0;if(innerWidth<=640){camera.zoom=2.5;updateCamera();focusCamera([2,4]);}if(sound)await enableSound();redraw();if(saveProblem)toast(saveProblem,6500);else toast('雨樋を置いてみよう。光る場所が、あなたの音。',4000);}
function exportTown(){const blob=new Blob([JSON.stringify(town,null,2)],{type:'application/json'});downloadBlob(blob,'water-town.json');}
function exportLegacy(){if(legacyRaw)downloadBlob(new Blob([legacyRaw],{type:'application/json'}),'previous-water-town.json');}
function showLegacy(){if(!legacy)return;$('menu-dialog').close();renderLegacy($('legacy-town'),legacy,legacyNetwork(legacy),'canal',null);$('legacy-town').querySelectorAll('.cell-hit,#hover-cell,#keyboard-cursor').forEach(node=>node.dataset.interface='true');$('legacy-town').querySelectorAll('text').forEach(node=>node.dataset.interface='true');$('legacy-dialog').showModal();}
function clearPhoto(){photoRequest++;if(photoUrl)URL.revokeObjectURL(photoUrl);photoUrl=null;photoBlob=null;photoFile=null;$('photo-preview').removeAttribute('src');}
async function takePhoto(source=$('town')){
  const canFrame=!!source.querySelector('[data-building]');if(! $('photo-dialog').open||source!==photoSource)$('photo-framing').value=canFrame?'buildings':'whole';$('photo-framing').querySelector('[value=buildings]').disabled=!canFrame;photoSource=source;const request=++photoRequest;
  if(!$('photo-dialog').open)$('photo-dialog').showModal();$('photo-status').textContent='街を写真にしています…';$('photo-download').disabled=true;$('photo-share').disabled=true;$('photo-again').disabled=true;$('photo-button').disabled=true;$('photo-framing').disabled=true;
  try{const framing=$('photo-framing').value,frame=photoFrame(source,framing);const blob=await captureTown(source,framing);if(request!==photoRequest||!$('photo-dialog').open)return;if(photoUrl)URL.revokeObjectURL(photoUrl);photoBlob=blob;photoFile=sharablePhoto(blob);photoUrl=URL.createObjectURL(blob);$('photo-preview').src=photoUrl;let canShare=false;try{canShare=!!navigator.canShare?.({files:[photoFile]})&&!!navigator.share;}catch{}$('photo-share').hidden=!canShare;$('photo-status').textContent=(framing==='buildings'&&!frame.cropped?'建物が街全体に広がっているため、全景に収めました。 ':'')+(canShare?'画像を保存、または共有先を選べます。':'画像を保存して、お好きな場所へ。');$('photo-download').disabled=false;$('photo-share').disabled=false;}
  catch(error){if(request===photoRequest)$('photo-status').textContent=error.message;}
  finally{$('photo-again').disabled=false;$('photo-button').disabled=false;$('photo-framing').disabled=false;}
}
$('welcome-art').innerHTML=welcomeArt();$('phrase-meter').innerHTML=Array.from({length:16},()=>'<i></i>').join('');
$('build-bar').innerHTML=Object.entries(TYPES).map(([type,data],index)=>`<button class="tool-button" data-tool="${type}" aria-label="${data.name}${data.cost?`、木材${data.cost}`:''}" aria-pressed="${type===tool}" title="${data.description}"><span class="tool-icon" aria-hidden="true">${type==='move'?'<svg viewBox="0 0 40 40"><path d="M20 3v34M3 20h34m-23-11 6-6 6 6m-12 22 6 6 6-6M9 14l-6 6 6 6m22-12 6 6-6 6" fill="none" stroke="#839783" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>':type==='flow'?'<svg viewBox="0 0 40 40"><path d="M5 26h30M20 5v14m-8-8h16" stroke="#859d88" stroke-width="4" stroke-linecap="round"/><path d="M12 26v8m16-8v8" stroke="#7cb2b1" stroke-width="5" stroke-linecap="round"/></svg>':icon(type)}</span><span><b>${data.name}</b><small>${data.cost?`木材 ${data.cost}`:type==='move'?'置き直す':type==='flow'?'開く / 閉じる':'全額返却'}</small></span></button>`).join('');
$('build-bar').addEventListener('click',event=>{const button=event.target.closest('[data-tool]');if(button)selectTool(button.dataset.tool);});
$('town').addEventListener('pointerdown',event=>{
  if(!running||event.button!==0||!event.isPrimary)return;
  if(camera.pan){event.preventDefault();camera.drag={sx:event.clientX,sy:event.clientY,x:camera.x,y:camera.y};$('town').setPointerCapture(event.pointerId);return;}
  const position=pointFromEvent(event);if(!position)return;event.preventDefault();cursor=position;hover=position;stroke=[];visited=new Set([position.join(',')]);lastPointer=position;$('town').setPointerCapture(event.pointerId);place(...position);
});
$('town').addEventListener('pointermove',event=>{
  if(camera.drag){camera.x=camera.drag.x+event.clientX-camera.drag.sx;camera.y=camera.drag.y+event.clientY-camera.drag.sy;updateCamera();return;}
  const position=pointFromEvent(event);hover=position;setCursor($('town'),position);updateSelection();
  if(stroke&&lastPointer&&position&&(tool==='canal'||tool==='remove')){for(const cell of lineCells(lastPointer,position)){const id=cell.join(',');if(!visited.has(id)){visited.add(id);place(...cell,true);}}lastPointer=position;}
});
$('town').addEventListener('pointerup',finishStroke);$('town').addEventListener('pointercancel',finishStroke);$('town').addEventListener('lostpointercapture',()=>{if(stroke)finishStroke();});$('town').addEventListener('pointerleave',()=>{if(!stroke){hover=null;setCursor($('town'),null);updateSelection();}});
$('town').addEventListener('keydown',event=>{if(!running)return;const directions={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};if(directions[event.key]){event.preventDefault();const[dX,dY]=directions[event.key];cursor=[Math.max(0,Math.min(WIDTH-1,cursor[0]+dX)),Math.max(0,Math.min(HEIGHT-1,cursor[1]+dY))];hover=cursor;revealCursor();setCursor($('town'),cursor);updateSelection();}else if(event.key==='Enter'||event.key===' '){event.preventDefault();stroke=[];place(...cursor);finishStroke();}else if(event.key==='Escape'){moveSource=null;redraw();}});
window.addEventListener('keydown',event=>{if(document.querySelector('dialog[open]')||/INPUT|SELECT|TEXTAREA/.test(event.target.tagName))return;if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='z'){event.preventDefault();undo();}else if(event.key.toLowerCase()==='m')$('sound-button').click();else if(/^[1-8]$/.test(event.key))selectTool(Object.keys(TYPES)[Number(event.key)-1]);});
$('welcome-dialog').addEventListener('cancel',event=>{event.preventDefault();start(false);});
$('start-sound').addEventListener('click',()=>start(true));$('start-silent').addEventListener('click',()=>start(false));$('sound-button').addEventListener('click',async()=>{if(!audio.context||audio.muted)await enableSound();else{audio.setMuted(true);updateUi();}});
$('backing-button').addEventListener('click',()=>{audio.backing=!audio.backing;updateUi();});$('scale-select').addEventListener('change',event=>{if(SCALES[event.target.value]){town.scale=event.target.value;edited();redraw();toast('街全体の調性を変えました。');}});$('scene-select').addEventListener('change',event=>{town.scene=event.target.value;edited();redraw();});$('flow-shortcut').addEventListener('click',()=>{selectTool('flow');$('town').focus({preventScroll:true});});
$('undo-button').addEventListener('click',undo);$('zoom-in').addEventListener('click',()=>zoomBy(.5));$('zoom-out').addEventListener('click',()=>zoomBy(-.5));$('pan-button').addEventListener('click',()=>{camera.pan=!camera.pan;updateCamera();});$('camera-reset').addEventListener('click',()=>{Object.assign(camera,{zoom:1,x:0,y:0,pan:false});updateCamera();});
$('menu-button').addEventListener('click',()=>{$('menu-status').hidden=!saveProblem;$('menu-status').textContent=saveProblem;$('menu-dialog').showModal();});$('menu-done').addEventListener('click',()=>$('menu-dialog').close());document.querySelectorAll('.dialog-close').forEach(button=>button.addEventListener('click',()=>button.closest('dialog').close()));
$('export-button').addEventListener('click',()=>{if(preventAutoSave){const raw=localStorage.getItem(SAVE_KEY);if(raw)downloadBlob(new Blob([raw],{type:'application/json'}),'water-town-unread.json');}else exportTown();});
$('import-input').addEventListener('change',async event=>{const file=event.target.files?.[0];if(!file)return;try{if(file.size>500000)throw new Error('保存ファイルが大きすぎます。');const raw=await file.text(),data=JSON.parse(raw);if(data.version===1){const restored=restoreLegacy(data);legacyRaw=raw;legacy=restored;updateUi();showLegacy();toast('ファイルの前の街を表示しました。端末の保存はそのままです。');}else{const restored=restoreTown(data);town=restored;history=[];moveSource=null;detailPosition=null;preventAutoSave=false;saveProblem='';redraw();save();$('menu-dialog').close();toast('保存した街を読み込みました。');}}catch(error){$('menu-status').hidden=false;$('menu-status').textContent=`読み込めませんでした。今の街は残っています。${error.message}`;}finally{event.target.value='';}});
$('reset-button').addEventListener('click',()=>{$('menu-dialog').close();$('reset-dialog').showModal();});$('reset-export').addEventListener('click',exportTown);$('reset-cancel').addEventListener('click',()=>$('reset-dialog').close());$('reset-confirm').addEventListener('click',()=>{town=createTown();history=[];moveSource=null;detailPosition=null;preventAutoSave=false;saveProblem='';currentStep=-1;silentTime=0;silentStep=0;redraw();save();$('reset-dialog').close();toast('新しい街をつくりはじめます。');});
$('legacy-button').addEventListener('click',showLegacy);$('legacy-export').addEventListener('click',exportLegacy);$('legacy-photo').addEventListener('click',()=>{$('legacy-dialog').close();takePhoto($('legacy-town'));});
$('photo-framing').addEventListener('change',()=>takePhoto(photoSource??$('town')));
$('photo-button').addEventListener('click',()=>takePhoto());$('photo-again').addEventListener('click',()=>takePhoto(photoSource??$('town')));$('photo-download').addEventListener('click',()=>{if(photoBlob){downloadBlob(photoBlob,'water-town.png');$('photo-status').textContent='画像の保存を開始しました。共有先でこの画像を選べます。';}});
$('photo-share').addEventListener('click',async()=>{if(!photoFile||sharing)return;sharing=true;const request=photoRequest;$('photo-share').disabled=true;const result=await sharePhoto(photoFile);if(request===photoRequest&&$('photo-dialog').open)$('photo-status').textContent=result==='shared'?'画像を共有しました。':result==='cancelled'?'共有をやめました。写真は保存・再共有できます。':result==='unsupported'?'この端末では直接共有できません。画像を保存してください。':'共有できませんでした。画像を保存するか、もう一度お試しください。';sharing=false;$('photo-share').disabled=false;});$('photo-dialog').addEventListener('close',clearPhoto);
$('continue-button').addEventListener('click',()=>$('festival-dialog').close());$('festival-photo').addEventListener('click',()=>{$('festival-dialog').close();takePhoto();});
document.addEventListener('visibilitychange',async()=>{lastFrame=0;if(document.hidden){finishStroke();save();await audio.suspend();}else if(running)await audio.resume();});window.addEventListener('pagehide',()=>{finishStroke();save();audio.suspend();});window.addEventListener('pageshow',()=>{lastFrame=0;if(running&&!document.hidden)audio.resume();});window.addEventListener('resize',fitBoard);
redraw();fitBoard();new ResizeObserver(fitBoard).observe($('construction-panel'));$('welcome-dialog').showModal();requestAnimationFrame(frame);
