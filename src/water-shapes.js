import {WIDTH,HEIGHT,cellAt,waterRole,connectsToCanal,neighbors} from './core.js?v=0.6.8';

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

const canalCenter=([x,y])=>[64+x*64,94+y*58];
const line=(a,b)=>`M${a.join(' ')}L${b.join(' ')}`;
// Join degree-two runs before drawing the moving centre line. Branches keep
// their shared vertex; cycles are traced once, without resetting at each tile.
function flowTrails(edges){
  const vertices=new Map(),remaining=new Set();
  const vertex=point=>{const id=point.join(',');if(!vertices.has(id))vertices.set(id,{point,edges:[]});return id;};
  edges.forEach(([a,b],id)=>{const from=vertex(a),to=vertex(b);vertices.get(from).edges.push({id,to});vertices.get(to).edges.push({id,to:from});remaining.add(id);});
  const trace=(start,edge)=>{let path=`M${vertices.get(start).point.join(' ')}`,current=start,next=edge;while(next&&remaining.delete(next.id)){current=next.to;const node=vertices.get(current);path+=`L${node.point.join(' ')}`;if(node.edges.length!==2)break;next=node.edges.find(e=>remaining.has(e.id));}return path;};
  const paths=[];for(const [id,node]of vertices)if(node.edges.length!==2)for(const edge of node.edges)if(remaining.has(edge.id))paths.push(trace(id,edge));
  for(const [id,node]of vertices)for(const edge of node.edges)if(remaining.has(edge.id))paths.push(trace(id,edge));
  return paths.join(' ');
}
// Geometry only. Inlets are restricted to sources and water receivers by the
// same capability used by the model. Wet/dry clipping is applied by the renderer.
export function canalLayout(town,ponds=pondLayout(town)){
  const parts=[],inlets=[],edges=[],seen=new Set();
  const edge=(a,b)=>{const id=[a.join(','),b.join(',')].sort().join(':');if(!seen.has(id)){seen.add(id);edges.push([a,b]);}};
  town.cells.forEach((cell,index)=>{
    if(cell?.type!=='canal')return;const x=index%WIDTH,y=Math.floor(index/WIDTH),here=canalCenter([x,y]),inPond=ponds.cells.has(index),arms=[];
    for(const [nx,ny]of neighbors(x,y)){
      const neighbor=cellAt(town,nx,ny),next=ny*WIDTH+nx;if(!connectsToCanal(neighbor?.type))continue;
      if(inPond&&(ponds.cells.has(next)||neighbor.type==='canal'))continue;
      const there=canalCenter([nx,ny]),boundary=[(here[0]+there[0])/2,(here[1]+there[1])/2],mouth=inPond||ponds.cells.has(next)?12:0,end=[boundary[0]+(nx-x)*mouth,boundary[1]+(ny-y)*mouth];
      arms.push(line(here,end));
      if(neighbor.type!=='canal'){inlets.push({from:index,to:next,path:line(boundary,there)});edge(inPond?[boundary[0]-(nx-x)*12,boundary[1]-(ny-y)*12]:here,there);}
      else if(ponds.cells.has(next))edge(here,end);
      else edge(here,there);
    }
    if(!arms.length&&!inPond){const a=[here[0]-9,here[1]],b=[here[0]+9,here[1]];arms.push(line(a,b));edge(a,b);}
    if(arms.length)parts.push({index,path:arms.join(' ')});
  });
  return {parts,inlets,path:[...parts.map(p=>p.path),...inlets.map(p=>p.path)].join(' '),flowPath:flowTrails(edges)};
}
