/* Blob topology shared by the artist template and Map Preview. No DOM. */
export const TERRAIN_SCHEMA='lo-pixel.terrain56.v1';
export const DIRECTIONS=[
  {key:'N',bit:1,opposite:4,dx:0,dy:-1,label:'Trên / sàn'},
  {key:'E',bit:2,opposite:8,dx:1,dy:0,label:'Phải / tường phải'},
  {key:'S',bit:4,opposite:1,dx:0,dy:1,label:'Dưới / trần'},
  {key:'W',bit:8,opposite:2,dx:-1,dy:0,label:'Trái / tường trái'}
];
export const CORNERS=[
  {name:'trên-trái',v:1,h:8,d:128,x:-1,y:-1},
  {name:'trên-phải',v:1,h:2,d:16,x:1,y:-1},
  {name:'dưới-phải',v:4,h:2,d:32,x:1,y:1},
  {name:'dưới-trái',v:4,h:8,d:64,x:-1,y:1}
];
export function normalizeMask(m){
  m &= 255;
  for(const c of CORNERS) if(!(m&c.v) || !(m&c.h)) m &= ~c.d;
  return m;
}
export const BLOB_47_MASKS=Array.from({length:256},(_,i)=>i).filter(m=>normalizeMask(m)===m);
export function describeMask(mask){
  const exposed=DIRECTIONS.filter(d=>!(mask&d.bit));
  const inner=CORNERS.filter(c=>(mask&c.v)&&(mask&c.h)&&!(mask&c.d)).map(c=>c.name);
  const outer=CORNERS.filter(c=>!(mask&c.v)&&!(mask&c.h)).map(c=>c.name);
  const title=mask===255?'Ô giữa':mask===0?'Khối rời':
    exposed.length===3?'Mỏm / đầu nhánh':
    exposed.length===2 && !outer.length?'Dải / cầu hẹp':
    exposed.length===1?exposed[0].label:outer.length?'Góc ngoài':'Góc lõm';
  return {title,exposed,inner,outer};
}
export const TERRAIN_TILES=[
  ...BLOB_47_MASKS.map((mask,slot)=>({slot,mask,kind:'blob',variant:0,title:describeMask(mask).title})),
  ...['Vân thưa','Nứt ngắn','Hạt nhỏ','Mảng sáng','Mảng tối'].map((title,i)=>({slot:47+i,mask:255,kind:'center',variant:i+1,title:'Ruột · '+title})),
  ...[254,251,247,253].map((mask,i)=>({slot:52+i,mask:normalizeMask(mask),kind:'edge',variant:1,
    title:'Mép biến thể · '+['sàn','trần','tường trái','tường phải'][i]}))
];
// Exposed N/S/W/E, respectively. Diagonals without both sides are removed.
export function terrainSlot(mask,x=0,y=0,total=56,seed=1701){
  mask=normalizeMask(mask);
  const base=BLOB_47_MASKS.indexOf(mask);
  const hash=(seed+Math.imul(x,374761393)+Math.imul(y,668265263))>>>0;
  if(mask===255 && total>=52){
    const v=hash%6; return v===0?base:46+v; // base + five EXTRA centers
  }
  const edge=TERRAIN_TILES.slice(52).find(t=>t.mask===mask);
  if(edge && total>=56 && hash%3===0) return edge.slot;
  return base<total?base:-1;
}

/* Two neighborhoods must agree where their 3×3 windows overlap.
   A gated-out diagonal is unknown, not necessarily air. */
function neighborhood(mask){
  return [{x:0,y:0,value:1},...DIRECTIONS.map(d=>({x:d.dx,y:d.dy,value:+!!(mask&d.bit)})),
    ...CORNERS.filter(c=>(mask&c.v)&&(mask&c.h)).map(c=>({x:c.x,y:c.y,value:+!!(mask&c.d)}))];
}
export function canConnect(a,b,direction){
  const d=DIRECTIONS.find(d=>d.key===direction);
  if(!d || !(a&d.bit) || !(b&d.opposite)) return false;
  const aa=neighborhood(a), bb=neighborhood(b);
  return aa.every(p=>{
    const q=bb.find(q=>q.x+d.dx===p.x && q.y+d.dy===p.y);
    return !q || p.value===q.value;
  });
}
export function neighbors(slot,direction){
  return TERRAIN_TILES.filter(t=>canConnect(TERRAIN_TILES[slot].mask,t.mask,direction)).map(t=>t.slot);
}

export const ROLE_COLORS=['#101018','#657e8c','#f4d37c','#34435a','#927ca7','#ef789c','#f3a34a'];
export const ROLE_NAMES=['Để trong suốt','Thân đất/đá: vẽ vân','Mép trên / sàn: bắt sáng',
  'Mép dưới / trần: bóng tối','Tường: viền bên','Góc ngoài (lồi)','Góc trong (lõm)'];
export function tileRoles(slot,size){
  const tile=TERRAIN_TILES[slot], mask=tile.mask, r=Math.max(1,Math.floor(size/8));
  const solid=new Uint8Array(size*size), out=new Uint8Array(size*size);
  for(let y=0;y<size;y++) for(let x=0;x<size;x++){
    const left=x<size/2, top=y<size/2;
    const c=CORNERS.find(c=>c.x===(left?-1:1)&&c.y===(top?-1:1));
    const dx=left?x:size-1-x, dy=top?y:size-1-y;
    let rx=r, ry=r;
    // Only alter the middle of an exposed edge; keep connector endpoints intact.
    if(tile.kind==='edge'){
      if(x>r+1 && x<size-r-2 && !(mask&c.v)) ry+=x%5===2?1:0;
      if(y>r+1 && y<size-r-2 && !(mask&c.h)) rx+=y%5===2?1:0;
    }
    const v=!!(mask&c.v), h=!!(mask&c.h);
    solid[y*size+x]=+!((!h&&dx<rx)||(!v&&dy<ry)||(v&&h&&!(mask&c.d)&&dx<r&&dy<r));
  }
  for(let y=0;y<size;y++) for(let x=0;x<size;x++){
    const i=y*size+x;if(!solid[i]) continue;
    const air=(a,b)=>a>=0&&b>=0&&a<size&&b<size&&!solid[b*size+a];
    let role=air(x,y-1)?2:air(x,y+1)?3:(air(x-1,y)||air(x+1,y))?4:1;
    for(const c of CORNERS){
      const dx=c.x<0?x:size-1-x,dy=c.y<0?y:size-1-y;
      if(dx<=r&&dy<=r && role!==1){
        if((mask&c.v)&&(mask&c.h)&&!(mask&c.d)) role=6;
        else if(!(mask&c.v)&&!(mask&c.h)) role=5;
      }
    }
    out[i]=role;
  }
  return out;
}
export function terrainConnectorIndices(slot,size){
  const roles=tileRoles(slot,size), out=[];
  for(let y=0;y<size;y++) for(let x=0;x<size;x++){
    const i=y*size+x;
    if(roles[i] && (x===0||y===0||x===size-1||y===size-1)) out.push(i);
  }
  return out;
}
const rgba=hex=>(parseInt(hex.slice(1,3),16)|(parseInt(hex.slice(3,5),16)<<8)|(parseInt(hex.slice(5,7),16)<<16)|0xff000000)>>>0;
export function terrainPixels(slot,size){
  const roles=tileRoles(slot,size), tile=TERRAIN_TILES[slot];
  const art=[0,rgba('#657e8c'),rgba('#b4c5d1'),rgba('#2e4659'),rgba('#435d73'),rgba('#99b0bf'),rgba('#2e4659')];
  const pixels=Uint32Array.from(roles,r=>art[r]);
  if(tile.kind==='center'){
    for(let y=3;y<size-3;y++) for(let x=3;x<size-3;x++){
      const hit=tile.variant===1?(x+3*y)%17===0:tile.variant===2?x===Math.floor(size/2)+(y%3===0?1:0):
        tile.variant===3?(x*7+y*11)%23===0:Math.abs(x-size/2)+Math.abs(y-size/2)<size/5;
      if(hit) pixels[y*size+x]=art[tile.variant===4?2:3];
    }
  }
  return pixels;
}
export function edgeIndex(direction,p,size){
  return direction==='N'?p:direction==='S'?(size-1)*size+p:direction==='W'?p*size:p*size+size-1;
}
export function checkSeams(pixels,size){
  const issues=[];
  for(const a of TERRAIN_TILES) for(const dir of ['E','S']){
    const opposite=dir==='E'?'W':'N', roles=tileRoles(a.slot,size);
    for(const b of neighbors(a.slot,dir)){
      const positions=[];
      for(let p=0;p<size;p++){
        const ai=edgeIndex(dir,p,size),bi=edgeIndex(opposite,p,size);
        const aa=pixels[a.slot][ai]>>>24,ba=pixels[b][bi]>>>24;
        if(roles[ai] ? aa!==255 || ba!==255 : (aa===0)!==(ba===0)) positions.push(p);
      }
      if(positions.length) issues.push({a:a.slot,b,direction:dir,positions,kind:'alpha'});
    }
  }
  return issues;
}
export function checkColorSeams(pixels,size){
  const issues=[];
  for(const a of TERRAIN_TILES) for(const dir of ['E','S']){
    const opposite=dir==='E'?'W':'N', ar=tileRoles(a.slot,size);
    for(const b of neighbors(a.slot,dir)){
      const br=tileRoles(b,size), positions=[];
      for(let p=0;p<size;p++){
        const ai=edgeIndex(dir,p,size),bi=edgeIndex(opposite,p,size);
        const aa=pixels[a.slot][ai]>>>24,ba=pixels[b][bi]>>>24;
        // Compare only equal-role, opaque connector pixels. Light/dark role changes are intentional.
        if(aa===255 && ba===255 && ar[ai]===br[bi] && pixels[a.slot][ai]!==pixels[b][bi]) positions.push(p);
      }
      if(positions.length) issues.push({a:a.slot,b,direction:dir,positions,kind:'color'});
    }
  }
  return issues;
}
export function terrainManifest(size){
  return {schema:TERRAIN_SCHEMA,columns:8,rows:7,tileWidth:size,tileHeight:size,
    bitOrder:{N:1,E:2,S:4,W:8,NE:16,SE:32,SW:64,NW:128},
    note:'Custom ascending-mask layout; map by mask, not by engine tile index. Guides are not artwork.',
    tiles:TERRAIN_TILES.map(t=>({...t,x:(t.slot%8)*size,y:Math.floor(t.slot/8)*size,
      connects:Object.fromEntries(DIRECTIONS.map(d=>[d.key,neighbors(t.slot,d.key)]))}))};
}
export function terrainGodotManifest(size){
  return {schema:TERRAIN_SCHEMA,format:'godot4-terrain-set-handoff',terrainSet:0,terrain:0,
    tileSize:[size,size],columns:8,rows:7,
    note:'Tạo TileSet terrain set 0/terrain 0 trong Godot 4; peeringBits 0 = nối terrain, -1 = mép hở.',
    tiles:TERRAIN_TILES.map(t=>({slot:t.slot,atlasCoords:[t.slot%8,Math.floor(t.slot/8)],mask:t.mask,kind:t.kind,title:t.title,
      peeringBits:Object.fromEntries(DIRECTIONS.map(d=>[d.key,t.mask&d.bit?0:-1]))}))};
}
export function paintTerrainGuide(ctx,slot,size,scale,mode='wireframe'){
  const roles=tileRoles(slot,size);
  ctx.save();
  if(mode==='wireframe'){
    const edgeW=Math.max(2, Math.min(4, Math.floor(scale*0.16)));
    for(let y=0;y<size;y++) for(let x=0;x<size;x++){
      const role=roles[y*size+x];
      const px=x*scale, py=y*scale;
      if(!role){
        // Để trong suốt: gạch chéo mờ góc để nhận biết, không phủ màu đè tranh
        ctx.strokeStyle='rgba(255,92,138,.35)'; ctx.lineWidth=1;
        ctx.beginPath();
        ctx.moveTo(px+3, py+scale-3); ctx.lineTo(px+scale-3, py+3);
        ctx.stroke();
      } else if(role===1){
        // Ruột đá/đất: viền mảnh mờ
        ctx.strokeStyle='rgba(101,126,140,.3)'; ctx.lineWidth=1;
        ctx.strokeRect(px+.5, py+.5, scale-1, scale-1);
      } else {
        // Sàn / trần / tường / góc: viền màu sắc nét 1.5px, ruột mờ 8% để không át màu thật
        ctx.fillStyle=ROLE_COLORS[role]; ctx.globalAlpha=.08;
        ctx.fillRect(px, py, scale, scale);
        ctx.strokeStyle=ROLE_COLORS[role]; ctx.globalAlpha=.85; ctx.lineWidth=1.5;
        ctx.strokeRect(px+1, py+1, scale-2, scale-2);
      }
      // Dải cyan ở biên nối: vẽ vạch mép 2px ở cạnh ngoài cùng, không đè lấp ruột pixel
      if(role && (x===0||y===0||x===size-1||y===size-1)){
        ctx.strokeStyle='#58d5ff'; ctx.globalAlpha=.95; ctx.lineWidth=edgeW;
        ctx.beginPath();
        if(y===0){ ctx.moveTo(px, py+edgeW/2); ctx.lineTo(px+scale, py+edgeW/2); }
        if(y===size-1){ ctx.moveTo(px, py+scale-edgeW/2); ctx.lineTo(px+scale, py+scale-edgeW/2); }
        if(x===0){ ctx.moveTo(px+edgeW/2, py); ctx.lineTo(px+edgeW/2, py+scale); }
        if(x===size-1){ ctx.moveTo(px+scale-edgeW/2, py); ctx.lineTo(px+scale-edgeW/2, py+scale); }
        ctx.stroke();
      }
    }
  } else {
    // Chế độ phủ mờ (tint)
    for(let y=0;y<size;y++) for(let x=0;x<size;x++){
      const role=roles[y*size+x];
      ctx.fillStyle=role?ROLE_COLORS[role]:'#ff5c8a';
      ctx.globalAlpha=role===1?.12:role?.28:.15;
      ctx.fillRect(x*scale,y*scale,scale,scale);
      if(role && (x===0||y===0||x===size-1||y===size-1)){
        ctx.strokeStyle='#58d5ff'; ctx.globalAlpha=.85; ctx.lineWidth=Math.max(2, Math.floor(scale*0.14));
        const px=x*scale, py=y*scale;
        ctx.beginPath();
        if(y===0){ ctx.moveTo(px, py+1); ctx.lineTo(px+scale, py+1); }
        if(y===size-1){ ctx.moveTo(px, py+scale-1); ctx.lineTo(px+scale, py+scale-1); }
        if(x===0){ ctx.moveTo(px+1, py); ctx.lineTo(px+1, py+scale); }
        if(x===size-1){ ctx.moveTo(px+scale-1, py); ctx.lineTo(px+scale-1, py+scale); }
        ctx.stroke();
      }
    }
  }
  ctx.restore();
}
