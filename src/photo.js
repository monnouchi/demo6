export function frameForBounds(full,bounds) {
  if(!bounds.length)return {...full,cropped:false};
  const left=Math.min(...bounds.map(b=>b.x)),right=Math.max(...bounds.map(b=>b.x+b.width));
  const top=Math.min(...bounds.map(b=>b.y)),bottom=Math.max(...bounds.map(b=>b.y+b.height));
  let width=Math.max(320,right-left+128),height=Math.max(240,bottom-top+128);
  if(width/height<4/3)width=height*4/3;else height=width*3/4;
  if(width>=full.width||height>=full.height)return {...full,cropped:false};
  const x=Math.max(full.x,Math.min(full.x+full.width-width,(left+right-width)/2));
  const y=Math.max(full.y,Math.min(full.y+full.height-height,(top+bottom-height)/2));
  return {x,y,width,height,cropped:true};
}
export function photoFrame(svg,framing='whole') {
  const box=svg.viewBox.baseVal,full={x:box.x,y:box.y,width:box.width,height:box.height};
  if(framing!=='buildings')return {...full,cropped:false};
  const matrix=svg.getScreenCTM();if(!matrix)return {...full,cropped:false};
  const inverse=matrix.inverse(),bounds=[];
  for(const element of svg.querySelectorAll('[data-building],[data-landscape]')){
    const local=element.getBBox(),screen=element.getScreenCTM();if(!screen)continue;
    const points=[[local.x,local.y],[local.x+local.width,local.y],[local.x,local.y+local.height],[local.x+local.width,local.y+local.height]].map(([x,y])=>new DOMPoint(x,y).matrixTransform(screen).matrixTransform(inverse));
    const xs=points.map(p=>p.x),ys=points.map(p=>p.y),x=Math.min(...xs),y=Math.min(...ys);
    bounds.push({x,y,width:Math.max(...xs)-x,height:Math.max(...ys)-y});
  }
  return frameForBounds(full,bounds);
}
export async function captureTown(svg,framing='whole') {
  const copy=svg.cloneNode(true);
  copy.querySelectorAll('[data-interface]').forEach(node=>node.remove());
  copy.querySelectorAll('.sounding,.note-current').forEach(node=>node.classList.remove('sounding','note-current'));
  copy.removeAttribute('style');copy.removeAttribute('tabindex');copy.removeAttribute('role');
  const box=photoFrame(svg,framing),width=box.cropped?1600:Math.round(box.width*2),height=box.cropped?1200:Math.round(box.height*2);
  copy.setAttribute('viewBox',`${box.x} ${box.y} ${box.width} ${box.height}`);copy.setAttribute('width',String(width));copy.setAttribute('height',String(height));
  copy.setAttribute('xmlns','http://www.w3.org/2000/svg');
  const source=new Blob([new XMLSerializer().serializeToString(copy)],{type:'image/svg+xml;charset=utf-8'}),url=URL.createObjectURL(source);
  try {
    const image=new Image();await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(new Error('写真を描けませんでした。もう一度お試しください。'));image.src=url;});
    const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
    const context=canvas.getContext('2d');if(!context)throw new Error('このブラウザでは写真を保存できません。');context.drawImage(image,0,0,canvas.width,canvas.height);
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw new Error('写真を保存できませんでした。');return blob;
  } finally {URL.revokeObjectURL(url);}
}
export function downloadBlob(blob,name){const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}
export function sharablePhoto(blob){return new File([blob],'sequencer-town.png',{type:'image/png'});}
export async function sharePhoto(file){
  try{if(!navigator.share||!navigator.canShare?.({files:[file]}))return 'unsupported';await navigator.share({files:[file]});return 'shared';}catch(error){if(error.name==='AbortError')return 'cancelled';return 'failed';}
}
