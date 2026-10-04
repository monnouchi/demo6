import { TYPES, cellAt, key } from './core.js?v=0.4.1';
import { noteName } from './music.js?v=0.4.1';

export function reasonCopy(building) {
  if(building?.active)return 'この拍で鳴ります';
  return {
    water:'水が足りず休止。別の楽器の水を止めると鳴らせます',
    crowded:'同じ拍の3音が先に演奏。空いた拍へ移すと鳴らせます',
    closed:'水を止めています',
    dry:'水路が未接続で休止。楽器の上下左右まで水路を伸ばそう',
  }[building?.reason]??'';
}
export function networkCopy(network,wood) {
  return `水${network.used}/${network.capacity}${network.waterBlocked?` · 水待ち${network.waterBlocked}棟`:''}${network.crowded?` · 拍待ち${network.crowded}棟`:''} · 木材${wood}`;
}
const beatCopy=x=>`第${Math.floor(x/8)+1}小節 ${Math.floor(x%8/2)+1}拍${x%2?'裏':''}`;
export function currentCellCopy(town,network,position) {
  const [x,y]=position,cell=cellAt(town,x,y),building=network.buildings.find(b=>b.x===x&&b.y===y);
  let state='空き地';
  if(building)state=`${TYPES[building.type].name} · ${noteName(building.note)} · ${beatCopy(x)} · ${reasonCopy(building)}`;
  else if(cell?.type==='garden')state='花園 · 音を鳴らさない景観。水は使いません';
  else if(cell?.type==='canal')state=cell.open===false?'水路を閉じています':network.wet.has(key(x,y))?'水路に水が流れています':'水路は開いています。泉からつなごう';
  else if(cell?.type==='spring')state='街の泉';
  return `現在：${state}。 ${networkCopy(network,town.wood)}`;
}
export function previewCopy(result,tool,position) {
  const prefix={move:'移動先',flow:'切替後',remove:'撤去後'}[tool]??'建設後';
  if(tool==='garden')return '建設後：花と小道が増えます。音なし・水0。';
  const b=result.building;
  return `${prefix}：${b?`${noteName(b.note)} · ${beatCopy(position[0])} · ${reasonCopy(b)}。 `:''}${networkCopy(result.after,result.wood)}`;
}
export function movedCellCopy(town,network,position) {
  if(cellAt(town,...position)?.type==='garden')return '花園を移しました。音を鳴らさない景観です。';
  const building=network.buildings.find(b=>b.x===position[0]&&b.y===position[1]);
  return building?.active?`場所を移しました。${noteName(building.note)}の光る拍と音を聴いてみよう。`:`場所を移しました。${reasonCopy(building)}。`;
}
