/* Trạng thái dùng chung: tài liệu đang vẽ, thiết lập khung nhìn, chủ đề sáng/tối.
   Module này không phụ thuộc DOM và không gọi ngược lên giao diện. */
import { hexToInt } from './color.js';

/* ---------------- tài liệu ---------------- */
export const doc = {
  name:'Bản vẽ không tên',
  w:32, h:32,
  layers:[{name:'Nét chính', vis:true}],
  frames:[],           // frames[i] = [Uint32Array,…] theo thứ tự lớp
  dur:[],              // dur[i] = mili-giây riêng của khung i; 0 hoặc thiếu = chạy theo fps chung
  af:0, al:0, atlasEdit:null, terrainLink:null,
  anchor:null,         // điểm chân {x,y} trong khung (y = mặt đất), có từ lúc nhập sheet — xuất kèm cho game
  charH:0              // chiều cao nhân vật (px) lúc nhập — để xem ở cỡ trong game
};
export function blank(){ return new Uint32Array(doc.w*doc.h); }
export function newFrame(){ return doc.layers.map(()=>blank()); }
doc.frames.push(newFrame());

/* lớp đang chọn của khung đang mở */
export function activeData(){ return doc.frames[doc.af][doc.al]; }

let savedGroup = true, savedPenBtn = 'sec';
// Trình duyệt chặn bộ nhớ (chế độ riêng tư, iframe) thì localStorage ném lỗi — không được làm sập app.
try { savedGroup = localStorage.getItem('lo-pixel-pal-group') !== 'false'; } catch(_) {}
try { savedPenBtn = localStorage.getItem('lo-pixel-pen-btn') || 'sec'; } catch(_) {}

export const view = {
  zoom:12, grid:true, onion:false, symLine:false, drawing:false, terrainGuide:true,
  mirX:false, mirY:false,
  tool:'pencil', brush:1,
  pri: hexToInt('#ffb43f'), sec: hexToInt('#2e2e42'),
  playing:false, fps:8, tile3:false, pingPong:false, soloLayer:false,
  lockAlpha:false, sel:null, shadeDir:1, gridStep:8, realSize:false,   // tô khối đi lên (+1) hay đi xuống (-1) trên dải
  ref:null, refOp:0.5,
  pressure:true, fingerMode:'draw', brushEff:1, hover:null, showGround:true, onionWrap:true,
  gameSize:false, gameH:(()=>{ try{ return Math.max(8,Math.min(256,parseInt(localStorage.getItem('lo-pixel-game-h'),10)||56)); }catch(_){ return 56; } })(),
  penButton: savedPenBtn, wrapMove:false,
  pixelPerfect:false, ditherPattern:'50', ditherMode:'sec',
  groupPalette: savedGroup,
  palettePinned: false,
  terrainGuideMode: 'wireframe', terrainLock:true
};

/* ---------------- chủ đề sáng / tối ---------------- */
export const THEMES={
  dark: {demoBg:'#0f0f18', ink:'#e8e8f2', mid:'#8f8fa8', bad:'#ff5c8a', good:'#7ee08a',
         gridA:'rgba(255,255,255,0.07)', gridB:'rgba(255,255,255,0.16)', hover:'rgba(255,255,255,0.80)'},
  light:{demoBg:'#eef1f7', ink:'#232838', mid:'#99a1b5', bad:'#c02a53', good:'#237a41',
         gridA:'rgba(0,0,0,0.09)',       gridB:'rgba(0,0,0,0.20)',      hover:'rgba(0,0,0,0.75)'}
};
export let TH=THEMES.dark;
export function setTH(name){ TH = THEMES[name] || THEMES.dark; return TH; }

/* ---------------- dữ liệu đi kèm lớp và tài liệu ----------------
   Lớp mang thêm: marks — mốc có tên trên khung ({chỉ số khung: 'rời đất'}), mỗi lớp một bộ vì
   mỗi lớp có thể là một động tác riêng; src — thông số lúc nhập sheet (tỉ lệ, hộp cắt…).
   Mọi chỗ chép lớp (hoàn tác, mở file, nhân bản) đi qua cloneLayer để không rơi mất các trường này. */
export const MARK_MAX=24;
export function cleanMarks(m, frameCount=Infinity){
  const out={};
  if(m && typeof m==='object') for(const [k,v] of Object.entries(m)){
    const i=Number(k);
    if(Number.isInteger(i) && i>=0 && i<frameCount && typeof v==='string' && v.trim()) out[i]=v.trim().slice(0,MARK_MAX);
  }
  return out;
}
export function cloneLayer(l, frameCount=Infinity){
  const out={name:String(l?.name||'Lớp'), vis:l?.vis!==false};
  const m=cleanMarks(l?.marks, frameCount);
  if(Object.keys(m).length) out.marks=m;
  if(l?.src && typeof l.src==='object') out.src=JSON.parse(JSON.stringify(l.src));
  return out;
}
/* chèn / bỏ / dời một khung thì mốc của mọi lớp dời theo, mốc vẫn dính đúng hình */
function remapMarks(fn){
  doc.layers.forEach(L=>{
    if(!L.marks) return;
    const m={};
    for(const [k,v] of Object.entries(L.marks)){ const j=fn(+k); if(j>=0) m[j]=v; }
    if(Object.keys(m).length) L.marks=m; else delete L.marks;
  });
}
export const marksInsert=at=>remapMarks(i=>i>=at?i+1:i);
export const marksRemove=at=>remapMarks(i=>i===at?-1:i>at?i-1:i);
export function marksMove(from,to){
  remapMarks(i=>{
    if(i===from) return to;
    if(from<to && i>from && i<=to) return i-1;
    if(from>to && i>=to && i<from) return i+1;
    return i;
  });
}
