/* Terrain 56 — phần I/O thuần (không DOM): đọc/ghi file dự án, đổi atlas cũ, dọn mép trong suốt. */
import { TERRAIN_SCHEMA, TERRAIN_LAYOUT, TERRAIN_TILES, ATLAS_COLS, ATLAS_ROWS,
  terrainSlotCells, legacyTerrainCell, tileRoles, terrainManifest, terrainGodotManifest, checkSeams, checkColorSeams } from './terrain.js';
import { frameAt } from './tileset.js';

/* Master giữ riêng; mọi bảng khác (kể cả nhóm Genesis v3 và bảng tự tạo) dùng bộ tổng Genesis v3. */
export const toolPaletteKey=(paletteName,masterName)=>paletteName===masterName?'master':'genesis';

export const TERRAIN_CREATE_PRESETS={
  genesis:{
    stone:{base:'#97b3b6',edge:'#c3d4d6'},
    warmStone:{base:'#965b4f',edge:'#c37669'},
    soil:{base:'#857870',edge:'#9c8f8a'},
    blueQi:{base:'#5b98e6',edge:'#86bdf0'},
    qiBlue:{base:'#3fd0a6',edge:'#9ef2cf'},
    skyWater:{base:'#5b98e6',edge:'#bfe0f8'},
    qi:{base:'#c955e7',edge:'#e187f8'}
  },
  master:{
    stone:{base:'#5e788c',edge:'#b4c5d1'},
    warmStone:{base:'#7c6d6c',edge:'#cabcad'},
    soil:{base:'#765640',edge:'#d7aa6b'},
    blueQi:{base:'#1e789c',edge:'#6cf2ff'},
    qiBlue:{base:'#08919b',edge:'#6cf2ff'},
    skyWater:{base:'#3973ad',edge:'#91d2ec'},
    qi:{base:'#5e419e',edge:'#b99cff'}
  }
};

/* 56 ô của bộ blob56 theo slot (khung `frame`) */
export const slotPixels=(ts,frame=0)=>Array.from({length:56},(_,slot)=>frameAt(ts,slot,frame));

/* Báo cáo mối nối: mode 'alpha' | 'color' | 'both' (mặc định). Alpha đứng trước, màu/vân đứng sau. */
export function seamReport(pixels,size,shape,mode='both'){
  return [...(mode==='color'?[]:checkSeams(pixels,size,shape)),...(mode==='alpha'?[]:checkColorSeams(pixels,size,shape))];
}

/* Kế hoạch ghi của ⚡ Tạo nhanh vào bộ 56 ô đang mở: ô trong phạm vi `scopeTest(tile)` trừ ô khoá
   (không bao giờ ghi) và ô đã sửa tay (chỉ giữ khi `keepEdited`). `kept` = số ô trong phạm vi được giữ;
   `ask` = bộ chưa từng tạo nhanh (`!known`) nên phải hỏi trước khi đè. */
export function planApply({scopeTest,locks=new Set(),edited=new Set(),keepEdited=false,known=false}){
  const inScope=TERRAIN_TILES.filter(t=>scopeTest(t)).map(t=>t.slot);
  const slots=inScope.filter(s=>!locks.has(s) && !(keepEdited && edited.has(s))).sort((a,b)=>a-b);
  return {slots,kept:inScope.length-slots.length,ask:!known};
}

/* Atlas bố cục cũ 8×7 (layout 1/2) → lưới cr31 10×7, kể cả ô bản sao.
   Layout 1: #50, #51 đổi từ biến thể ruột sang biến thể sàn nên chép ô sàn gốc #31 vào. */
export function legacySheetTo10x7({w,h,data},layoutVersion,size){
  const src=data.slice();
  const copy=(sx,sy,dx,dy,from,to)=>{
    for(let y=0;y<size;y++) to.set(from.subarray((sy*size+y)*w+sx*size,(sy*size+y)*w+sx*size+size),(dy*size+y)*w+dx*size);
  };
  if((layoutVersion||1)<2){
    const [sx,sy]=legacyTerrainCell(31);
    for(const slot of [50,51]){ const [x,y]=legacyTerrainCell(slot); copy(sx,sy,x,y,data,src); }
  }
  const ow=size*ATLAS_COLS, oh=size*ATLAS_ROWS, out=new Uint32Array(ow*oh);
  for(const t of TERRAIN_TILES){
    const [ox,oy]=legacyTerrainCell(t.slot);
    for(const [x,y] of terrainSlotCells(t.slot))
      for(let j=0;j<size;j++) out.set(src.subarray((oy*size+j)*w+ox*size,(oy*size+j)*w+ox*size+size),(y*size+j)*ow+x*size);
  }
  return {w:ow,h:oh,data:out};
}

/* Quyết định theo KÍCH THƯỚC ảnh (như trang Vẽ): đúng 10×7 ô = bố cục hiện tại, bất kể `layout`;
   8×7 ô = bố cục cũ (layout chỉ chọn biến thể 1/2); còn lại ném lỗi tiếng Việt. */
export function terrainSheetTo10x7(sheet,layoutVersion,size){
  const {w,h}=sheet;
  if(w===size*ATLAS_COLS && h===size*ATLAS_ROWS) return sheet;
  if(w===size*8 && h===size*ATLAS_ROWS) return legacySheetTo10x7(sheet,layoutVersion===2?2:1,size);
  throw new Error('ảnh atlas phải là lưới '+ATLAS_COLS+'×'+ATLAS_ROWS+' (hoặc 8×'+ATLAS_ROWS+' bố cục cũ) ô '+size+' px');
}

const FORMATS=['lo-pixel-terrain56-project.v1','lo-pixel-terrain56-pack.v1'];
export function parseTerrainFile(d){
  if(d?.schema!==TERRAIN_SCHEMA || !FORMATS.includes(d.format)) throw new Error('không phải dự án Terrain 56');
  const size=Number(d.tileSize||d.manifest?.tileWidth), png=d.files?.['terrain56.png']||d.atlas?.png;
  if(![16,32].includes(size) || typeof png!=='string' || !png.startsWith('data:image/png'))
    throw new Error('thiếu atlas PNG hoặc khổ tile không hợp lệ');
  const shape=(d.edgeShape||d.manifest?.edgeShape)==='flush'?'flush':'inset';
  return {name:d.name||'terrain56-'+size,size,shape,layout:d.layout||1,png};
}

export function terrainProjectJson(ts,pngDataUrl){
  const n=ts.size;
  return {schema:TERRAIN_SCHEMA,layout:TERRAIN_LAYOUT,format:FORMATS[0],name:ts.name,tileSize:n,edgeShape:ts.shape,
    manifest:terrainManifest(n,ts.shape),link:{schema:TERRAIN_SCHEMA,labels:true,live:true,autoSave:true},
    files:{'terrain56.png':pngDataUrl}};
}
export function terrainPackJson(ts,pngDataUrl,annotatedDataUrl){
  const n=ts.size, files={'terrain56.png':pngDataUrl};
  if(annotatedDataUrl) files['terrain56-annotated.png']=annotatedDataUrl;
  return {schema:TERRAIN_SCHEMA,layout:TERRAIN_LAYOUT,format:FORMATS[1],tileSize:n,manifest:terrainManifest(n,ts.shape),
    godot:terrainGodotManifest(n,ts.shape),edgeShape:ts.shape,files};
}

/* Dọn pixel "để trong suốt" ở hàng/cột biên ô (chỗ mối nối alpha đòi trống); phần thụt bên trong giữ nguyên. */
export function cleanSheet({w,h,data},size,shape){
  if(!Number.isInteger(size) || size<=0) throw new Error('cleanSheet: thiếu khổ ô hợp lệ');
  if(shape!=='inset' && shape!=='flush') throw new Error("cleanSheet: shape phải là 'inset' hoặc 'flush'");
  if(w<size*ATLAS_COLS || h<size*ATLAS_ROWS) throw new Error('cleanSheet: ảnh nhỏ hơn lưới '+ATLAS_COLS+'×'+ATLAS_ROWS+' ô');
  const out=data.slice();
  for(const t of TERRAIN_TILES){
    const roles=tileRoles(t.slot,size,shape);
    for(const [c,r] of terrainSlotCells(t.slot)){
      const ox=c*size,oy=r*size;
      for(let i=0;i<roles.length;i++){
        const x=i%size,y=Math.floor(i/size);
        if(!roles[i] && (x===0||y===0||x===size-1||y===size-1)) out[(oy+y)*w+ox+x]&=0x00ffffff;
      }
    }
  }
  return {w,h,data:out};
}
