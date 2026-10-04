import { WIDTH, HEIGHT, TYPES, cellAt, neighbors, key, noteFor } from './core.js?v=0.4.0';
import { noteName } from './music.js?v=0.4.0';
import { buildingArt } from './art.js?v=0.4.0';
export { icon, welcomeArt } from './art.js?v=0.4.0';
export const VIEW_WIDTH=1088,VIEW_HEIGHT=666;
export const center=(x,y)=>[64+x*64,94+y*58];
export function renderTown(svg,town,network,tool,selection=null){
  const evening=town.scene==='evening',raining=network.raining;
  const sky=evening?'#d6dbe4':raining?'#d3e0df':'#e5ecda',ground=raining?'#c3d8c4':'#d7e3bf';
  let body=`<defs><linearGradient id="land" x2="0" y2="1"><stop stop-color="${evening?'#cedccf':ground}"/><stop offset="1" stop-color="${evening?'#bfcec4':'#c9dab4'}"/></linearGradient><filter id="shade" x="-70%" y="-60%" width="240%" height="220%"><feDropShadow dx="1" dy="4" stdDeviation="2.5" flood-color="#496452" flood-opacity=".12"/></filter></defs><rect width="1088" height="666" fill="${sky}"/><path d="M22 93Q11 28 94 32h902q85 0 77 65v474q7 67-75 69H89q-71-1-67-67z" fill="#aec6ac" opacity=".25"/><rect x="26" y="51" width="1034" height="558" rx="35" fill="#a7bea0"/><rect x="24" y="43" width="1034" height="558" rx="35" fill="url(#land)"/>`;
  for(let y=0;y<HEIGHT;y++)for(let x=0;x<WIDTH;x++){
    const [cx,cy]=center(x,y);
    body+=`<rect x="${cx-29}" y="${cy-26}" width="58" height="53" rx="9" fill="${x%4===0?'#eff2dc':'#e5eed4'}" opacity="${y%2?.25:.43}"/>`;
    if(!cellAt(town,x,y)&&(x*7+y*3)%13===0)body+=`<path d="M${cx-11} ${cy+15}v-7m6 9v-9m6 6 3-6" stroke="#9eb889" opacity=".45" stroke-width="2"/>`;
  }
  let canals='',buildings='';
  town.cells.forEach((cell,index)=>{
    if(!cell)return;const x=index%WIDTH,y=Math.floor(index/WIDTH),[cx,cy]=center(x,y),wet=network.wet.has(key(x,y));
    if(cell.type==='canal'){
      const path=neighbors(x,y).filter(([a,b])=>cellAt(town,a,b)&&cellAt(town,a,b).type!=='garden').map(([a,b])=>{const[px,py]=center(a,b);return `M${cx} ${cy}L${(cx+px)/2} ${(cy+py)/2}`;}).join(' ')||`M${cx-9} ${cy}h18`;
      canals+=`<path d="${path}" stroke="#c6b991" stroke-width="20" stroke-linecap="round"/><path d="${path}" stroke="${wet?(raining?'#5d9fad':'#85b9b0'):'#b7af91'}" stroke-width="12" stroke-linecap="round"/>${wet?`<path class="water-flow" d="${path}" stroke="#d3ece0" stroke-width="2" stroke-linecap="round"/>`:''}`;
      if(cell.open===false)canals+=`<path d="M${cx-6} ${cy-8}l12 16m-12 0 12-16" stroke="#9a704b" stroke-width="4" stroke-linecap="round"/>`;return;
    }
    const b=network.buildings.find(item=>item.index===index),active=b?.active??(cell.type==='spring'||cell.type==='garden');
    if(b?.connected){const neighbor=neighbors(x,y).find(([a,c])=>network.wet.has(key(a,c)));if(neighbor){const[px,py]=center(...neighbor);canals+=`<path d="M${cx} ${cy+10}L${(cx+px)/2} ${(cy+py)/2}" stroke="#91bfb0" stroke-width="9" stroke-linecap="round"/>`;}}
    const opacity=b&&!active ? .63 : 1;
    buildings+=`<g id="building-${index}" data-building="${index}" transform="translate(${cx} ${cy}) scale(.88)" opacity="${opacity}"><ellipse class="note-glow" cx="0" cy="13" rx="37" ry="22" fill="#fff2ad" opacity="0"/><g filter="url(#shade)">${buildingArt(cell.type,cell.type==='garden'||cell.type==='spring',index%4)}</g>`;
    if(cell.type==='garden')buildings+=`<path d="M-26 28q23 7 49-2" stroke="#efe0b8" stroke-width="5" stroke-linecap="round"/><circle cx="-25" cy="5" r="3" fill="#dbb382"/><circle cx="24" cy="10" r="3" fill="#c1929a"/>`;
    if(b&&!active)buildings+=`<g data-interface="true"><circle cx="24" cy="-20" r="9" fill="${b.reason==='dry'?'#f3ecda':'#e5c28b'}"/><text x="24" y="-16" font-size="12" text-anchor="middle" fill="#896744">${b.reason==='closed'?'Ⅱ':b.reason==='crowded'?'3':b.reason==='water'?'!':'·'}</text></g>`;
    buildings+='</g>';
  });
  body+=canals+buildings;
  if(evening)body+='<path d="M1021 16a11 11 0 1 0 14 14 13 13 0 0 1-14-14" fill="#ece5b9"/>';
  if(raining){body+='<g class="rain-layer" pointer-events="none">';for(let i=0;i<54;i++){const x=40+(i*127)%1020,y=25+(i*89)%560;body+=`<path class="rain-drop" style="animation-delay:-${(i%15)/10}s" d="M${x} ${y}l-5 17" stroke="#709daf" stroke-width="1.8" opacity=".43"/>`;if(i%6===0)body+=`<ellipse class="rain-ripple" style="animation-delay:-${i/12}s" cx="${x-10}" cy="${y+30}" rx="8" ry="3" fill="none" stroke="#b7d6db" stroke-width="1.7"/>`;}body+='</g>';}
  body+='<g data-interface="true" class="score-guides" aria-hidden="true">';
  for(let x=0;x<WIDTH;x++){const[cx]=center(x,0);body+=`<text x="${cx}" y="634" text-anchor="middle" font-size="12" fill="#6d8b70">${x%2===0?x/2+1:'·'}</text>`;if(x%4===0)body+=`<path d="M${cx-32} 55v533" stroke="#89a886" opacity=".28" stroke-width="${x===8?2:1}"/>`;}
  for(let y=0;y<HEIGHT;y++){const[,cy]=center(0,y);body+=`<text x="13" y="${cy+4}" text-anchor="middle" font-size="10" fill="#719275" transform="rotate(-90 13 ${cy+4})">${noteName(noteFor(town,y))}</text>`;}
  body+='<text x="304" y="655" text-anchor="middle" font-size="10" fill="#7a9777">1小節目</text><text x="816" y="655" text-anchor="middle" font-size="10" fill="#7a9777">2小節目</text><rect id="playhead" x="35" y="54" width="58" height="546" rx="10" fill="#fff5b1" opacity="0"/><path id="playhead-line" d="M64 50v555" stroke="#c1aa64" stroke-width="2" opacity="0"/>';
  body+='<rect id="hover-cell" width="58" height="53" rx="9" fill="#fff5" stroke="#6e926d" stroke-width="2" visibility="hidden"/>';
  if(selection){const[cx,cy]=center(...selection);body+=`<rect x="${cx-29}" y="${cy-26}" width="58" height="53" rx="9" fill="#e4b97833" stroke="#ae8a4c" stroke-width="3"/>`;}
  body+='</g><g data-interface="true" class="hit-layer">';
  for(let y=0;y<HEIGHT;y++){body+='<g role="row">';for(let x=0;x<WIDTH;x++){const[cx,cy]=center(x,y),cell=cellAt(town,x,y),b=network.buildings.find(item=>item.x===x&&item.y===y);body+=`<rect class="cell-hit" data-x="${x}" data-y="${y}" x="${cx-32}" y="${cy-29}" width="64" height="58" fill="transparent" role="gridcell" aria-label="${x+1}列 ${y+1}行、${cell?TYPES[cell.type]?.name??'泉':'空き地'}${b?`、${noteName(b.note)}、${b.active?'演奏':b.reason==='water'?'水不足':b.reason==='crowded'?'拍がいっぱい':'休止'}`:''}"/>`;}
    body+='</g>';}
  body+='</g>';svg.innerHTML=body;svg.dataset.tool=tool;
}
export function setCursor(svg,position){const rect=svg.querySelector('#hover-cell');if(!rect)return;if(!position){rect.setAttribute('visibility','hidden');return;}const[cx,cy]=center(...position);rect.setAttribute('x',cx-29);rect.setAttribute('y',cy-26);rect.setAttribute('visibility','visible');}
export function pulseTown(svg,step,notes){
  svg.querySelectorAll('.note-current').forEach(node=>node.classList.remove('note-current'));
  const[cx]=center(step%16,0);const head=svg.querySelector('#playhead'),line=svg.querySelector('#playhead-line');if(head){head.setAttribute('x',cx-29);head.setAttribute('opacity','.17');line.setAttribute('d',`M${cx} 50v555`);line.setAttribute('opacity','.6');}
  for(const note of notes){const building=svg.querySelector(`#building-${note.index}`);if(!building)continue;building.classList.remove('sounding');void building.getBoundingClientRect();building.classList.add('sounding','note-current');}
}
