import { TYPES, cellAt, key } from './core.js?v=0.6.0';
import { noteName } from './music.js?v=0.6.0';

export function reasonCopy(building) {
  if(building?.active)return building.span>1?`長屋${building.span}マス · 先頭から長く響きます`:'この拍で鳴ります';
  return {
    closed:'音を止めています',
    dry:'水路が未接続で休止。楽器の上下左右まで水路を伸ばそう',
  }[building?.reason]??'';
}
export function networkCopy(network) {
  return `${network.activeCount}棟が演奏 · ${network.beats}の場所に音`;
}
export const toneCopy=b=>b.type==='garden'?(b.atmosphere==='night'?'虫の音':b.atmosphere==='rain'?'雨のブラシ':'葉のシェイカー'):b.type==='tree'?(b.atmosphere==='rain'?'滴の打音':b.atmosphere==='night'?'柔らかな木音':'木の打音'):b.type==='goat'?`カウベル ${noteName(b.note)}`:b.type==='cow'?`低音 ${noteName(b.note)}`:noteName(b.note);
const beatCopy=x=>`第${Math.floor(x/8)+1}小節 ${Math.floor(x%8/2)+1}拍${x%2?'裏':''}`;
export function currentCellCopy(town,network,position) {
  const [x,y]=position,cell=cellAt(town,x,y),building=network.buildings.find(b=>b.x===x&&b.y===y);
  let state='空き地';
  if(building)state=`${TYPES[building.type].name} · ${toneCopy(building)} · ${beatCopy(x)} · ${reasonCopy(building)}`;
  else if(cell?.type==='canal')state=cell.open===false?'水路を閉じています':network.wet.has(key(x,y))?'水路に水が流れています':'水路は開いています。泉からつなごう';
  else if(cell?.type==='spring')state='街の泉';
  return `現在：${state}。 ${networkCopy(network)}`;
}
export function previewCopy(result,tool,position) {
  const prefix={move:'移動先',flow:'切替後',remove:'撤去後'}[tool]??'建設後';
  const b=result.building;
  return `${prefix}：${b?`${toneCopy(b)} · ${beatCopy(position[0])} · ${reasonCopy(b)}。 `:''}${networkCopy(result.after)}`;
}
export function movedCellCopy(town,network,position) {
  const building=network.buildings.find(b=>b.x===position[0]&&b.y===position[1]);
  return building?.active?`場所を移しました。${toneCopy(building)}の光る拍と音を聴いてみよう。`:`場所を移しました。${reasonCopy(building)}。`;
}
