export async function captureTown(svg) {
  const copy=svg.cloneNode(true);
  copy.querySelectorAll('[data-interface]').forEach(node=>node.remove());
  copy.querySelectorAll('.sounding,.note-current').forEach(node=>node.classList.remove('sounding','note-current'));
  copy.removeAttribute('style');copy.removeAttribute('tabindex');copy.removeAttribute('role');
  const box=svg.viewBox.baseVal;copy.setAttribute('width',String(box.width*2));copy.setAttribute('height',String(box.height*2));
  copy.setAttribute('xmlns','http://www.w3.org/2000/svg');
  const source=new Blob([new XMLSerializer().serializeToString(copy)],{type:'image/svg+xml;charset=utf-8'}),url=URL.createObjectURL(source);
  try {
    const image=new Image();await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(new Error('写真を描けませんでした。もう一度お試しください。'));image.src=url;});
    const canvas=document.createElement('canvas');canvas.width=box.width*2;canvas.height=box.height*2;
    const context=canvas.getContext('2d');if(!context)throw new Error('このブラウザでは写真を保存できません。');context.drawImage(image,0,0,canvas.width,canvas.height);
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw new Error('写真を保存できませんでした。');return blob;
  } finally {URL.revokeObjectURL(url);}
}
export function downloadBlob(blob,name){const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}
export function sharablePhoto(blob){return new File([blob],'water-town.png',{type:'image/png'});}
export async function sharePhoto(file){
  try{if(!navigator.share||!navigator.canShare?.({files:[file]}))return 'unsupported';await navigator.share({files:[file]});return 'shared';}catch(error){if(error.name==='AbortError')return 'cancelled';return 'failed';}
}
