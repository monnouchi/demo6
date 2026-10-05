import {WIDTH,HEIGHT,cellAt,waterRole,connectsToCanal,neighbors} from './core.js?v=0.6.6';

// A visual layer only: closed canals remain canals, and no saved cells change.
// A narrow path belongs to a pond only if it participates in a complete 2×2.
export function pondLayout(town){
  const cells=new Set();
  for(let y=0;y<HEIGHT-1;y++)for(let x=0;x<WIDTH-1;x++){
    const block=[[x,y],[x+1,y],[x,y+1],[x+1,y+1]];
    if(block.every(([a,b])=>waterRole(cellAt(town,a,b)?.type)==='channel'))for(const [a,b]of block)cells.add(b*WIDTH+a);
  }
  const remaining=new Set(cells),groups=[];
  while(remaining.size){
    const first=remaining.values().next().value,queue=[first],members=[];remaining.delete(first);
    for(let i=0;i<queue.length;i++){
      const index=queue[i];members.push(index);
      for(const [x,y]of neighbors(index%WIDTH,Math.floor(index/WIDTH))){const next=y*WIDTH+x;if(remaining.delete(next))queue.push(next);}
    }
    const boundary=[],ports=[];
    for(const index of members){
      const x=index%WIDTH,y=Math.floor(index/WIDTH);
      for(const edge of [
        {from:[x,y],to:[x+1,y],neighbor:[x,y-1]},
        {from:[x+1,y],to:[x+1,y+1],neighbor:[x+1,y]},
        {from:[x+1,y+1],to:[x,y+1],neighbor:[x,y+1]},
        {from:[x,y+1],to:[x,y],neighbor:[x-1,y]},
      ]){
        const [nx,ny]=edge.neighbor;
        if(nx>=0&&nx<WIDTH&&ny>=0&&ny<HEIGHT&&cells.has(ny*WIDTH+nx))continue;
        boundary.push(edge);
        if(connectsToCanal(cellAt(town,nx,ny)?.type))ports.push(edge);
      }
    }
    groups.push({id:Math.min(...members),cells:members,boundary,ports});
  }
  return {cells,groups};
}
