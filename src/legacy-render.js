import { WIDTH, HEIGHT, TYPES, cellAt, neighbors, key } from './legacy-core.js?v=0.6.1';
export const center = (x, y) => [90 + x * 60, 90 + y * 58];
const wrap = (body, extra = '') => `<svg viewBox="-40 -52 80 86" fill="none" xmlns="http://www.w3.org/2000/svg" ${extra}>${body}</svg>`;
const plinth = '<ellipse cx="0" cy="20" rx="29" ry="11" fill="#9cae8f" opacity=".24"/><ellipse cx="0" cy="13" rx="26" ry="12" fill="#f2e8cb"/><path d="M-26 13v5q26 15 52 0v-5q-26 14-52 0" fill="#d5c7a4"/>';
export function buildingArt(type, active = false, variant = 0) {
  const status = active ? 'active' : '';
  if (type === 'mill') return `${plinth}<path d="M-21-14l25-9 19 9v32L4 27l-25-9z" fill="#e9d9b2"/><path d="M4-23l19 9v32L4 27z" fill="#cdb98d"/><path d="M-27-14L-3-38 28-20 4-4z" fill="#b67a53"/><path d="M-3-38l31 18-24 16-20-14z" fill="#bd865f"/><path d="M-27-14l31 10v5l-31-11z" fill="#8f604b"/><path d="M4-4l24-16v5L4 1z" fill="#936246"/><rect x="-15" y="-6" width="10" height="12" rx="3" fill="#728d80"/><path d="M8 5l8-4v11l-8 4z" fill="#8c987a"/><g transform="translate(-17 10)"><g class="wheel ${status}"><circle r="17" fill="#e0b477" stroke="#8d6546" stroke-width="3"/><circle r="11" fill="none" stroke="#a6784d" stroke-width="2"/>${[0,45,90,135].map(a=>`<path d="M-16 0h32" stroke="#976844" stroke-width="3" transform="rotate(${a})"/>`).join('')}<circle r="4" fill="#7a6048"/></g></g><path d="M-24 25q6 3 15 0" stroke="#a5c9c0" stroke-width="3" stroke-linecap="round"/>`;
  if (type === 'gutter') return `${plinth}<path d="M-18-22L7-30l16 12v34L7 24l-25-9z" fill="#f1e8cd"/><path d="M7-30l16 12v34L7 24z" fill="#d8d3b3"/><path d="M-25-24L1-44 29-26 6-12z" fill="#78a9a5"/><path d="M1-44l28 18L6-12l-9-24z" fill="#8ab8ae"/><path d="M-25-24L6-12l23-14" stroke="#4d827d" stroke-width="4" stroke-linejoin="round"/><path d="M26-22v25q0 7-10 7" stroke="#b1bd91" stroke-width="5" stroke-linecap="round"/><path d="M-12-13l10-3v14l-10 3z" fill="#809c8c"/><path d="M-13 12v-7M-7 14V3M-1 16V1" stroke="#bd9e63" stroke-width="3" stroke-linecap="round"/><path d="M10-6v19" stroke="#9bb5a7" stroke-width="2"/><circle class="gutter-drop ${status}" cx="16" cy="11" r="2" fill="#6bbbc1"/><ellipse cx="18" cy="21" rx="8" ry="3" fill="#9fc6b9"/>`;
  if (type === 'bell') return `${plinth}<path d="M-18-31v46M18-31v46" stroke="#c3b99b" stroke-width="6"/><path d="M-24-31L0-49 25-31 0-22z" fill="#bdc49d"/><path d="M0-49l25 18L0-22l-6-20z" fill="#aebc90"/><path d="M-24-31L0-22l25-9" stroke="#879574" stroke-width="3"/><path d="M-18 15L0 24l18-9" stroke="#a69c7e" stroke-width="5"/><g class="bell-swing ${status}"><path d="M0-29v9" stroke="#8a7953" stroke-width="3"/><path d="M-12-1q5-6 5-15 7-10 14 0 0 9 5 15z" fill="#d8b667" stroke="#a28b50" stroke-width="1.5"/><ellipse cy="0" rx="13" ry="4" fill="#ba9853"/><path d="M-5-12q0-4 4-5" stroke="#f0d48a" stroke-width="2" stroke-linecap="round"/><circle cy="3" r="3" fill="#877951"/></g><path d="M-8 18v-6M8 18v-6" stroke="#a3936f" stroke-width="2"/>`;
  if (type === 'garden') return `${plinth}<ellipse cy="9" rx="21" ry="10" fill="#b3c998"/><path d="M-16 15L0 22l18-8" stroke="#93ad7f" stroke-width="2"/>${[[-12,4],[0,-2],[12,5],[-1,12]].map(([x,y],i)=>`<g class="flower ${status}" style="animation-delay:-${i*.4}s"><path d="M${x} ${y+5}v-14" stroke="#7c9a73" stroke-width="2"/><path d="M${x} ${y}q-9-8-10 0 4 6 10 3M${x} ${y-2}q8-7 9-1-3 6-9 4" fill="#91ad7b"/><g transform="translate(${x} ${y-11})"><circle r="5" fill="${['#c19292','#d9b886','#bba2b1','#d1a39c'][(i+variant)%4]}"/><circle r="2" fill="#ece1b0"/></g></g>`).join('')}`;
  if (type === 'spring') return '<ellipse cy="21" rx="29" ry="12" fill="#8eab98" opacity=".3"/><path d="M-25 6q0-13 25-13T25 6v12q-26 19-50 0z" fill="#bbc6a7"/><ellipse cy="7" rx="25" ry="14" fill="#dee1c6"/><ellipse cy="7" rx="20" ry="10" fill="#7fbbb7"/><ellipse cy="7" rx="14" ry="6" fill="#a4d3c4"/><ellipse class="spring-ripple" cy="7" rx="14" ry="6" stroke="#e9f0d5" stroke-width="1.5"/><path d="M-10 0l4-20q7-7 12 0L10 0" fill="#b6c3a2"/><path d="M0-22v20" stroke="#849c87" stroke-width="3"/><path d="M0-2q6 1 7 7" stroke="#c5e3ce" stroke-width="3" stroke-linecap="round"/>';
  if (type === 'rock') return '<ellipse cy="22" rx="25" ry="8" fill="#a0b08f" opacity=".2"/><path d="M-18 18l-6-11 9-14 14 4 7 14-9 12z" fill="#bbc2a7"/><path d="M-15-7L-1-3l7 14-17-2z" fill="#cbd0b6"/><path d="M12 21V-26" stroke="#9f9b75" stroke-width="3"/><path d="M12-41l-12 21h6L-3-5H7L1 8q13 7 24 0l-6-13h8l-9-15h6z" fill="#83a185"/><path d="M12-41v54q7-2 13-5l-6-13h8l-9-15h6z" fill="#78987c"/>';
  if (type === 'remove') return '<path d="M-21 21L17-17" stroke="#a6a389" stroke-width="8" stroke-linecap="round"/><path d="M0-30q20-9 29 11l-11 9-8-9-10 5-10-6z" fill="#aaa891"/><path d="M-21 21L-6 6" stroke="#b7966e" stroke-width="8" stroke-linecap="round"/>';
  return '<path d="M-25 17H-6V-9h30" stroke="#cbbf99" stroke-width="21" stroke-linecap="round" stroke-linejoin="round"/><path d="M-25 17H-6V-9h30" stroke="#77b4b7" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/><path d="M-25 15H-8V-11h32" stroke="#afd6c7" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>';
}
export const icon = type => wrap(buildingArt(type, false));
export function welcomeArt() {
  return `<svg viewBox="0 0 360 148" fill="none" xmlns="http://www.w3.org/2000/svg"><ellipse cx="180" cy="122" rx="147" ry="19" fill="#e3e8d6"/><path d="M62 113h78v-19h67v19h81" fill="none" stroke="#d4c8a3" stroke-width="16" stroke-linejoin="round" stroke-linecap="round"/><path d="M62 113h78v-19h67v19h81" fill="none" stroke="#8bbdb8" stroke-width="9" stroke-linejoin="round" stroke-linecap="round"/><g transform="translate(87 82) scale(.95)">${buildingArt('mill',true)}</g><g transform="translate(183 61) scale(1.04)">${buildingArt('gutter',true)}</g><g transform="translate(270 86) scale(.95)">${buildingArt('bell',true)}</g><path d="M43 53q10-9 17 0M306 40q10-8 17 0" fill="none" stroke="#bac4a4" stroke-width="1.5"/><circle cx="321" cy="78" r="2" fill="#d0bb78"/><path d="M130 20v10m-5-5h10" stroke="#c7b475" stroke-width="1.5"/></svg>`;
}
export function renderTown(svg, town, network, tool, cursor = null) {
  const growthStage = Math.min(3, Math.floor(town.growth / 20));
  const evening = town.arrangement === 'evening';
  const defs = `<defs><linearGradient id="terrain" x2="0" y2="1"><stop stop-color="${evening?'#dbe2d6':'#e0e9cd'}"/><stop offset="1" stop-color="${evening?'#cad8cf':'#d6e1c0'}"/></linearGradient><linearGradient id="outer" x2="0" y2="1"><stop stop-color="${evening?'#dfe1e7':'#e8ecdc'}"/><stop offset="1" stop-color="${evening?'#cbd7da':'#d6e1ce'}"/></linearGradient><clipPath id="island-clip"><rect x="55" y="53" width="791" height="536" rx="45"/></clipPath><filter id="building-shadow" x="-60%" y="-60%" width="220%" height="240%"><feDropShadow dx="1" dy="5" stdDeviation="3" flood-color="#526f5a" flood-opacity=".10"/></filter></defs>`;
  let terrain = '<rect width="900" height="650" fill="url(#outer)"/><path d="M25 109Q6 37 102 25H798q96 5 82 88v420q8 73-75 80H89q-75-3-66-86z" fill="none" stroke="#c4d4bf" opacity=".55"/><path d="M16 209q-11-82 23-98M861 521q29 61-22 92M105 619q139 11 268 7" fill="none" stroke="#becfba" opacity=".5"/><rect x="57" y="67" width="791" height="536" rx="45" fill="#b9cbaa"/><rect x="55" y="53" width="791" height="536" rx="45" fill="url(#terrain)"/><g clip-path="url(#island-clip)">';
  for (let y=0; y<HEIGHT; y++) for(let x=0; x<WIDTH; x++) {
    const [cx,cy] = center(x,y);
    terrain += `<rect x="${cx-27}" y="${cy-25}" width="54" height="51" rx="10" fill="${(x*7+y*3)%4===0?'#cbdcba':'#e8eed8'}" opacity="${(x+y)%3===0?.47:.26}"/><path d="M${cx-20} ${cy+22}h6M${cx+16} ${cy-20}h4" stroke="#b8ccaa" opacity=".27" stroke-linecap="round"/>`;
    if (!cellAt(town,x,y) && (x*5+y*9)%11===0) terrain += `<path d="M${cx-9} ${cy+9}v-4m5 5v-6m4 4 2-4" stroke="#a1bc8e" opacity=".45" stroke-width="1.4"/>`;
    if (!cellAt(town,x,y) && growthStage>0 && (x*7+y*13)%17 < growthStage) terrain += `<circle cx="${cx+13}" cy="${cy+13}" r="2" fill="#c49e95"/><circle cx="${cx+17}" cy="${cy+9}" r="2" fill="#d2bb85"/>`;
  }
  terrain += '</g><text x="450" y="625" text-anchor="middle" font-family="Georgia,serif" font-size="10" fill="#9cac90" letter-spacing="2">YOUR TOWN · NO. 06</text><path d="M771 30q8-7 14 0m15 0q8-7 14 0" stroke="#b1c1a8" stroke-width="1.5" fill="none"/>';
  let canals = '';
  town.cells.forEach((cell,i) => {
    if(cell?.type !== 'canal') return;
    const x=i%WIDTH,y=Math.floor(i/WIDTH),[cx,cy]=center(x,y),wet=network.wet.has(key(x,y));
    const segments = neighbors(x,y).filter(([nx,ny])=>cellAt(town,nx,ny) && cellAt(town,nx,ny).type!=='rock').map(([nx,ny])=>{const [px,py]=center(nx,ny);return `M${cx} ${cy}L${cx+(px-cx)/2} ${cy+(py-cy)/2}`;}).join(' ');
    const path=segments || `M${cx-9} ${cy}h18`;
    canals += `<path d="${path}" stroke="#c8bd97" stroke-width="21" stroke-linecap="round"/><path d="${path}" stroke="${wet?'#88bcb7':'#bcb69c'}" stroke-width="13" stroke-linecap="round"/>${wet?`<path d="${path}" stroke="#c4e0c9" stroke-width="2" stroke-linecap="round" class="water-flow"/>`:''}<circle cx="${cx}" cy="${cy}" r="6" fill="${wet?'#99c9bf':'#c5bea2'}"/>`;
  });
  let buildings = '';
  town.cells.forEach((cell,i) => {
    if(!cell || cell.type==='canal')return;
    const x=i%WIDTH,y=Math.floor(i/WIDTH),[cx,cy]=center(x,y),active=network.buildings.find(b=>b.x===x&&b.y===y)?.active ?? cell.type==='spring';
    if(TYPES[cell.type] && active) {
      for(const [nx,ny] of neighbors(x,y)) if(network.wet.has(key(nx,ny))) {const [px,py]=center(nx,ny);buildings += `<path d="M${cx} ${cy+8}Q${cx} ${cy} ${cx+(px-cx)/2} ${cy+(py-cy)/2}" stroke="#c7bb94" stroke-width="15" fill="none"/><path d="M${cx} ${cy+8}Q${cx} ${cy} ${cx+(px-cx)/2} ${cy+(py-cy)/2}" stroke="#8bbfb9" stroke-width="9" fill="none"/>`;}
    }
    buildings += `<g transform="translate(${cx} ${cy-7}) scale(.83)" filter="url(#building-shadow)" ${!active&&TYPES[cell.type]?'opacity=".65"':''}>${buildingArt(cell.type,active,(x+y)%4)}</g>`;
    if(TYPES[cell.type])buildings+=`<circle cx="${cx+19}" cy="${cy+20}" r="3" fill="${active?'#7fa779':'#d1c7a8'}" stroke="#edf0dc" stroke-width="1.5"/>`;
    if(cell.type==='spring')buildings += `<text x="${cx}" y="${cy+37}" text-anchor="middle" font-size="8" fill="#688e7c">泉</text>`;
  });
  let celebration = evening ? '<g fill="#f0ddb2"><circle cx="34" cy="32" r="10"/><circle cx="38" cy="28" r="9" fill="#dfe1e7"/><circle cx="867" cy="32" r="2"/><circle cx="840" cy="18" r="1.5"/></g>' : '';
  if(town.completed)celebration += `<g class="festival-bunting"><path d="M126 39Q444 76 771 39" stroke="#aab88b" fill="none"/>${Array.from({length:15},(_,i)=>{const x=144+i*42,y=42+Math.sin((i+1)/16*Math.PI)*16;return `<path d="M${x} ${y}l15 1-6 15z" fill="${['#c69a84','#a9b996','#d0b471','#92b8af'][i%4]}"/>`;}).join('')}</g>`;
  let rain='';
  if(network.raining)rain=`<g pointer-events="none" opacity=".28">${Array.from({length:30},(_,i)=>`<path d="M${50+(i*137)%800} ${10+(i*83)%530}l-3 9" stroke="#91b4ae" stroke-width="1.5" stroke-linecap="round" class="rain-drop" style="animation-delay:-${i*.13}s"/>`).join('')}</g>`;
  const hits=Array.from({length:WIDTH*HEIGHT},(_,i)=>{const x=i%WIDTH,y=Math.floor(i/WIDTH),[cx,cy]=center(x,y),cell=town.cells[i],active=network.buildings.find(b=>b.x===x&&b.y===y)?.active;const label=`${x+1}列 ${y+1}行：${cell?(TYPES[cell.type]?.name??(cell.type==='spring'?'泉':'森')):'空き地'}${TYPES[cell?.type]?.demand?active?'、水が届いています':'、水が届いていません':''}`;return `${x===0?`<g role="row" aria-rowindex="${y+1}">`:""}<rect id="cell-${i}" aria-colindex="${x+1}" data-x="${x}" data-y="${y}" x="${cx-30}" y="${cy-29}" width="60" height="58" fill="transparent" class="cell-hit" role="gridcell" aria-label="${label}"/>${x===WIDTH-1?"</g>":""}`;}).join('');
  svg.innerHTML=`${defs}${terrain}<g>${canals}</g><g>${buildings}</g>${celebration}${rain}<rect id="hover-cell" class="hover-cell ${tool==='remove'?'selection-removal':''}" rx="9" width="54" height="51" visibility="hidden"/><rect id="keyboard-cell" class="keyboard-cell" rx="9" width="54" height="51" visibility="hidden"/><g>${hits}</g>`;
  svg.dataset.tool=tool;
  if(cursor)setCursor(svg,cursor,true);
}
export function setCursor(svg, position, keyboard=false) {
  const element=svg.querySelector(keyboard?'#keyboard-cell':'#hover-cell');
  if(!element)return;
  if(!position){element.setAttribute('visibility','hidden');return;}
  const [cx,cy]=center(...position);
  element.setAttribute('x',cx-27);element.setAttribute('y',cy-25);element.setAttribute('visibility','visible');
  if(keyboard)svg.setAttribute('aria-activedescendant',`cell-${position[1]*WIDTH+position[0]}`);
}
