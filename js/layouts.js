/* Bộ khuôn tile: một trang Tile phục vụ nhiều loại bộ (56 ô blob, 4×4 nối cạnh, 4×4 nối góc, lưới tự do).
   Mỗi khuôn là dữ liệu thuần: danh sách ô, chỗ đặt trong ảnh atlas, cách chọn ô theo hàng xóm,
   và chế độ terrain của Godot. Không DOM — kiểm thử bằng Node. */
import { BLOB_47_MASKS, TERRAIN_TILES, TERRAIN_CELLS, TERRAIN_COPY_CELLS, ATLAS_COLS, ATLAS_ROWS,
         normalizeMask, tileRoles, terrainSlot, terrainConnectorIndices, terrainArt, terrainPixels, shapeInset } from './terrain.js';

/* bit hàng xóm 8 hướng (giống terrain.js): N=1 E=2 S=4 W=8 NE=16 SE=32 SW=64 NW=128 */
const N8=[[0,-1,1],[1,0,2],[0,1,4],[-1,0,8],[1,-1,16],[1,1,32],[-1,1,64],[-1,-1,128]];
/* bit góc của khuôn nối góc: trên-trái=1, trên-phải=2, dưới-phải=4, dưới-trái=8 */
export const CORNER_BITS=[[0,0,1],[1,0,2],[1,1,4],[0,1,8]];

const sideName=m=>m===15?'Ruột (nối 4 phía)':m===0?'Khối rời':
  'Nối '+[['trên',1],['phải',2],['dưới',4],['trái',8]].filter(([,b])=>m&b).map(([n])=>n).join(' + ');
const cornerName=m=>m===15?'Đầy (4 góc)':m===0?'Trống (vật liệu nền)':
  'Góc '+[['trên-trái',1],['trên-phải',2],['dưới-phải',4],['dưới-trái',8]].filter(([,b])=>m&b).map(([n])=>n).join(' + ');
/* ô nối cạnh = ô blob có đủ góc chỗ hai cạnh kề cùng nối, nên dùng lại được vai pixel và gợi ý của blob */
export const sidesToBlob=m=>normalizeMask((m&15)|0xf0);
const grid4=m=>[m%4,Math.floor(m/4)];

const BLOB56={
  id:'blob56', name:'Terrain 56 (blob 47 + 9 biến thể)', match:'blob', godotMode:0, cols:ATLAS_COLS, rows:ATLAS_ROWS,
  slots:TERRAIN_TILES.map(t=>({slot:t.slot,mask:t.mask,kind:t.kind,variant:t.variant,title:t.title})),
  cells:TERRAIN_CELLS.map(c=>c.slice()), copies:TERRAIN_COPY_CELLS.map(c=>({slot:c.slot,cell:c.cell.slice()})),
  shaped:true
};
const SIDES16={
  id:'sides16', name:'4×4 nối cạnh (16 ô: ống, hàng rào, dây leo)', match:'sides', godotMode:2, cols:4, rows:4,
  slots:Array.from({length:16},(_,m)=>({slot:m,mask:m,kind:'blob',variant:0,title:sideName(m)})),
  cells:Array.from({length:16},(_,m)=>grid4(m)), copies:[], shaped:true
};
const CORNERS16={
  id:'corners16', name:'4×4 nối góc (16 ô Wang: nước, cỏ chuyển vùng)', match:'corners', godotMode:1, cols:4, rows:4,
  slots:Array.from({length:16},(_,m)=>({slot:m,mask:m,kind:'corner',variant:0,title:cornerName(m)})),
  cells:Array.from({length:16},(_,m)=>grid4(m)), copies:[], shaped:false
};
export const LAYOUT_IDS=['blob56','sides16','corners16','free'];
export const FREE_MAX=16;
export function getLayout(id,opt={}){
  if(id==='blob56') return BLOB56;
  if(id==='sides16') return SIDES16;
  if(id==='corners16') return CORNERS16;
  if(id==='free'){
    const cols=Math.max(1,Math.min(FREE_MAX,opt.cols|0||4)), rows=Math.max(1,Math.min(FREE_MAX,opt.rows|0||4)), n=cols*rows;
    return {id:'free', name:'Lưới tự do '+cols+'×'+rows+' (decor, đồ vật)', match:'none', godotMode:null, cols, rows,
      slots:Array.from({length:n},(_,i)=>({slot:i,mask:0,kind:'free',variant:0,title:'Ô '+(i+1)})),
      cells:Array.from({length:n},(_,i)=>[i%cols,Math.floor(i/cols)]), copies:[], shaped:false};
  }
  throw new Error('không có khuôn "'+id+'"');
}

/* ---------------- vai pixel (để vẽ gợi ý và dựng mẫu) ---------------- */
function cornerRoles(mask,size){
  const solid=new Uint8Array(size*size), out=new Uint8Array(size*size), h=size/2;
  for(let y=0;y<size;y++) for(let x=0;x<size;x++){
    const q=CORNER_BITS.find(([cx,cy])=>(x<h?0:1)===cx && (y<h?0:1)===cy);
    solid[y*size+x]=mask&q[2]?1:0;
  }
  // ngoài mép ô coi như góc kề kéo dài (cùng trạng thái), nên mép ô không bị tính là mép đất
  const at=(x,y)=>solid[Math.max(0,Math.min(size-1,y))*size+Math.max(0,Math.min(size-1,x))];
  for(let y=0;y<size;y++) for(let x=0;x<size;x++){
    if(!solid[y*size+x]) continue;
    out[y*size+x]=!at(x,y-1)?2:!at(x,y+1)?3:(!at(x-1,y)||!at(x+1,y))?4:1;
  }
  return out;
}
/* null = khuôn không có vai (lưới tự do) */
export function layoutRoles(layout,slot,size,shape='inset'){
  if(layout.match==='blob') return tileRoles(slot,size,shape);
  if(layout.match==='sides') return tileRoles(BLOB_47_MASKS.indexOf(sidesToBlob(slot)),size,shape);
  if(layout.match==='corners') return cornerRoles(slot,size);
  return null;
}
/* pixel nối ở mép ô (phải giữ nguyên để ô ghép liền với hàng xóm); khuôn nối góc / tự do không có */
export function connectorIndices(layout,slot,size,shape='inset'){
  if(layout.match==='blob') return terrainConnectorIndices(slot,size,shape);
  if(layout.match==='sides') return terrainConnectorIndices(BLOB_47_MASKS.indexOf(sidesToBlob(slot)),size,shape);
  return [];
}
/* bản sao của `after` với các pixel ở idx lấy lại từ `before` — chỉ pixel nối đã có màu (đục hẳn);
   pixel nối còn trong suốt thì vẫn cho vẽ lên */
export function keepConnectors(before,after,idx){
  const out=after.slice(); for(const i of idx) if((before[i]>>>24)===255) out[i]=before[i]; return out;
}
/* tranh mẫu khi tạo bộ mới: khối đặc theo vai, đủ để có ngay một bộ chạy được rồi vẽ đè */
export function seedPixels(layout,slot,size,colors,shape='inset'){
  if(layout.match==='blob') return terrainPixels(slot,size,colors,shape);
  if(layout.match==='sides') return terrainPixels(BLOB_47_MASKS.indexOf(sidesToBlob(slot)),size,colors,shape);
  if(layout.match==='corners'){
    const art=terrainArt(colors), roles=cornerRoles(slot,size), low=colors?.low ? art[3] : 0;
    return Uint32Array.from(roles,r=>r?art[r]:low);
  }
  return new Uint32Array(size*size);
}

/* ---------------- chọn ô theo hàng xóm ---------------- */
/* on(x,y): ô map có vật liệu không. Trả slot của ô (x,y), -1 = để trống. */
export function pickSlot(layout,on,x,y,seed=1701){
  if(layout.match==='corners'){
    // khuôn nối góc đặt trên lưới đối ngẫu: ô (x,y) lấy bốn góc từ bốn ô map quanh đỉnh
    let m=0; for(const [dx,dy,b] of CORNER_BITS) if(on(x+dx,y+dy)) m|=b;
    return m;
  }
  if(!on(x,y)) return -1;
  if(layout.match==='none') return 0;
  let mask=0; for(const [dx,dy,b] of N8) if(on(x+dx,y+dy)) mask|=b;
  if(layout.match==='sides') return mask&15;
  return terrainSlot(mask,x,y,layout.slots.length,seed);
}
/* Khung ngữ cảnh 3×3 quanh một ô: ô giữa là slot đang vẽ, tám ô quanh là những ô thật sẽ đứng
   cạnh nó trong map (vật liệu kéo dài ra ngoài theo hướng ô giữa đang nối). -1 = trống. */
export function contextSlots(layout,slot){
  if(layout.match==='none') return Array(9).fill(slot);
  if(layout.match==='corners'){
    // lưới đỉnh 4×4; bốn đỉnh giữa lấy từ mask ô giữa, đỉnh ngoài chép đỉnh trong gần nhất
    const c=v=>Math.max(1,Math.min(2,v));
    const vert=(vx,vy)=>{ const [ , ,b]=CORNER_BITS.find(([dx,dy])=>dx===c(vx)-1 && dy===c(vy)-1); return !!(slot&b); };
    const out=[];
    for(let ty=0;ty<3;ty++) for(let tx=0;tx<3;tx++){
      let m=0; for(const [dx,dy,b] of CORNER_BITS) if(vert(tx+dx,ty+dy)) m|=b;
      out.push(m);
    }
    out[4]=slot; return out;
  }
  const mask=layout.match==='sides' ? sidesToBlob(slot) : layout.slots[slot].mask;
  // lưới 5×5: giữa là ô đang vẽ, vòng trong theo mask, vòng ngoài chép vòng trong gần nhất
  const inner=(x,y)=>{
    if(x===0&&y===0) return true;
    const b=N8.find(([dx,dy])=>dx===x&&dy===y)[2];
    return !!(mask&b);
  };
  const c=v=>Math.max(-1,Math.min(1,v));
  const on=(x,y)=>inner(c(x),c(y));
  const out=[];
  for(let y=-1;y<=1;y++) for(let x=-1;x<=1;x++){
    if(!on(x,y)){ out.push(-1); continue; }
    let m=0; for(const [dx,dy,b] of N8) if(on(x+dx,y+dy)) m|=b;
    out.push(layout.match==='sides' ? m&15 : BLOB_47_MASKS.indexOf(normalizeMask(m)));
  }
  out[4]=slot; return out;
}

/* ---------------- xuất cho Godot 4 ---------------- */
const q=t=>'"'+String(t).replace(/\\/g,'\\\\').replace(/"/g,'\\"')+'"';
const godotColor=hex=>{ const v=[1,3,5].map(i=>(parseInt(hex.slice(i,i+2),16)/255).toFixed(3).replace(/\.?0+$/,'')||'0'); return 'Color('+v.join(', ')+', 1)'; };
const PEER_BLOB=[[1,'top_side'],[2,'right_side'],[4,'bottom_side'],[8,'left_side'],
  [16,'top_right_corner'],[32,'bottom_right_corner'],[64,'bottom_left_corner'],[128,'top_left_corner']];
const PEER_SIDES=PEER_BLOB.slice(0,4);
const PEER_CORNERS=[[1,'top_left_corner'],[2,'top_right_corner'],[4,'bottom_right_corner'],[8,'bottom_left_corner']];
/* hộp va chạm theo khung toạ độ tâm ô (Godot): mảng đa giác [x0,y0,x1,y1,…] */
function collision(layout,t,size,shape){
  const h=size/2;
  if(layout.match==='none') return [];
  if(layout.match==='corners') return CORNER_BITS.filter(([,,b])=>t.mask&b).map(([cx,cy])=>{
    const x0=cx?0:-h, y0=cy?0:-h; return [x0,y0,x0+h,y0,x0+h,y0+h,x0,y0+h];
  });
  const m=t.mask, ins=shapeInset(shape,size);
  const x0=m&8?-h:-h+ins, x1=m&2?h:h-ins, y0=m&1?-h:-h+ins, y1=m&4?h:h-ins;
  return [[x0,y0,x1,y0,x1,y1,x0,y1]];
}
/* Một TileSet .tres: một nguồn atlas, terrain set 0 theo chế độ của khuôn.
   anim: {[slot]: [ms, ms, …]} — ô có từ 2 khung trở lên thành ô hoạt ảnh. Ảnh xuất xếp khung theo
   khối: khối k (lệch k×cols ô sang phải) chứa khung k của mọi ô, nên separation = cols-1. */
export function layoutGodotTres(layout,size,{shape='inset',texture='res://tileset.png',name='Terrain',color='#63c74d',anim={},collide=true}={}){
  const L=['[gd_resource type="TileSet" load_steps=3 format=3]','',
    '[ext_resource type="Texture2D" path='+q(texture)+' id="1_tex"]','',
    '[sub_resource type="TileSetAtlasSource" id="TileSetAtlasSource_1"]',
    'texture = ExtResource("1_tex")','texture_region_size = Vector2i('+size+', '+size+')'];
  const peers=layout.match==='blob'?PEER_BLOB:layout.match==='sides'?PEER_SIDES:layout.match==='corners'?PEER_CORNERS:[];
  for(const t of layout.slots){
    const [c,r]=layout.cells[t.slot], k=c+':'+r;
    const durs=anim[t.slot];
    if(durs && durs.length>1){
      L.push(k+'/animation_columns = 0',k+'/animation_separation = Vector2i('+(layout.cols-1)+', 0)',
        k+'/animation_frames_count = '+durs.length);
      durs.forEach((ms,i)=>L.push(k+'/animation_frame_'+i+'/duration = '+(Math.max(10,ms||100)/1000)));
    }
    L.push(k+'/0 = 0');
    if(layout.match==='blob'){
      const group=layout.slots.filter(o=>o.mask===t.mask).length;
      const p=group===1?1:group===2?(t.slot<47?2:1):1;
      if(p!==1) L.push(k+'/0/probability = '+p);
    }
    if(peers.length && !(layout.match==='corners' && t.mask===0)){
      L.push(k+'/0/terrain_set = 0',k+'/0/terrain = 0');
      for(const [bit,pn] of peers) if(t.mask&bit) L.push(k+'/0/terrains_peering_bit/'+pn+' = 0');
    }
    if(collide) collision(layout,t,size,shape).forEach((pts,i)=>
      L.push(k+'/0/physics_layer_0/polygon_'+i+'/points = PackedVector2Array('+pts.join(', ')+')'));
  }
  L.push('','[resource]','tile_size = Vector2i('+size+', '+size+')');
  if(collide) L.push('physics_layer_0/collision_layer = 1');
  if(peers.length) L.push('terrain_set_0/mode = '+layout.godotMode,'terrain_set_0/terrain_0/name = '+q(name),'terrain_set_0/terrain_0/color = '+godotColor(color));
  L.push('sources/0 = SubResource("TileSetAtlasSource_1")');
  return L.join('\n')+'\n';
}
/* bảng kê cho game đọc khuôn từ dữ liệu, không viết cứng */
export function layoutJson(layout,size,{shape='inset',anim={},frames=1}={}){
  return {schema:'lo-pixel.tileset.v1',layout:layout.id,match:layout.match,tile_size:size,edge_shape:shape,
    columns:layout.cols,rows:layout.rows,frame_blocks:frames,
    bit_order:layout.match==='corners'?{TL:1,TR:2,BR:4,BL:8}:{N:1,E:2,S:4,W:8,NE:16,SE:32,SW:64,NW:128},
    tiles:layout.slots.map(t=>({slot:t.slot,mask:t.mask,kind:t.kind,title:t.title,cell:layout.cells[t.slot].slice(),
      ...(anim[t.slot]?.length>1?{frames_ms:anim[t.slot].slice()}:{})})),
    copies:layout.copies.map(c=>({slot:c.slot,cell:c.cell.slice()})),
    note:'Ảnh xuất xếp khung hoạt ảnh theo khối: khối k nằm lệch k×columns ô sang phải và chứa khung k của mọi ô.'};
}
