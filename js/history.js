/* Hoàn tác / làm lại: chụp lại toàn bộ tài liệu, giữ 80 bước gần nhất. */
import { doc, view, cloneLayer } from './state.js';

/* Mỗi bước hoàn tác là một bản chụp cả tài liệu, nên phải chặn theo DUNG LƯỢNG
   chứ không theo số bước: 128×128 với 6 lớp × 8 khung là 3 MB một bản chụp,
   80 bước sẽ thành 250 MB. Khổ nhỏ thì vẫn đủ 80 bước như cũ. */
const MAX_STEPS=80, MAX_BYTES=160*1024*1024;      // khổ 256: 3 lớp × 16 khung ≈ 12 MB một bản chụp, vẫn giữ được ~13 bước
const undoStack=[], redoStack=[];
let bytes=0;
/* Bản vẽ trong thư viện mà tranh đang mở thuộc về. Mỗi bước hoàn tác nhớ nó, để hoàn tác qua lúc mở bản
   khác (Ghép rối nhảy giữa sheet Đầu / Thân, mở từ 📁) thì lần cất sau ghi đúng vào bản của tranh đó,
   không đè lên bản đang mở. main.js nối vào đây — không import library.js để khỏi vòng import. */
let docId={get:()=>null, set:()=>{}};
export function bindDocId(get,set){ docId={get,set}; }
let refreshHistoryView=()=>{};
let readSettings=()=>null, restoreSettings=()=>{};
export function bindHistoryView(refresh, read=readSettings, restore=restoreSettings){
  refreshHistoryView=refresh; readSettings=read; restoreSettings=restore;
}
const sizeOf = s => s.frames.length * s.layers.length * s.w * s.h * 4;
function trim(){
  while(undoStack.length && (undoStack.length>MAX_STEPS || bytes>MAX_BYTES))
    bytes -= sizeOf(undoStack.shift());
}
export function captureUndo(withSettings=false){
  return {
    w:doc.w, h:doc.h, af:doc.af, al:doc.al,
    layers: doc.layers.map(l=>cloneLayer(l)),
    frames: doc.frames.map(f=>f.map(d=>d.slice())),
    dur: doc.dur.slice(), tags:(doc.tags||[]).map(t=>({...t})), sel:view.sel ? {...view.sel} : null,
    atlasEdit:doc.atlasEdit ? {...doc.atlasEdit} : null,
    anchor:doc.anchor ? {...doc.anchor} : null, charH:doc.charH||0, puppet:doc.puppet||null,    // đổi khổ dời điểm chân: hoàn tác phải trả về cùng lúc
    lib:docId.get(), settings:withSettings ? readSettings() : null
  };
}
function restore(s){
  doc.w=s.w; doc.h=s.h; doc.af=s.af; doc.al=s.al;
  doc.layers=s.layers.map(l=>cloneLayer(l));
  doc.frames=s.frames.map(f=>f.map(d=>d.slice()));
  doc.dur=(s.dur||[]).slice();
  doc.tags=(s.tags||[]).map(t=>({...t}));
  view.sel=s.sel ? {...s.sel} : null;
  doc.atlasEdit=s.atlasEdit ? {...s.atlasEdit} : null;
  doc.anchor=s.anchor ? {...s.anchor} : null; doc.charH=s.charH||0; doc.puppet=s.puppet||null;
  docId.set(s.lib??null);
  if(s.settings) restoreSettings(s.settings);
}
export function pushUndo(s=captureUndo()){
  undoStack.push(s); bytes+=sizeOf(s);
  trim();
  redoStack.length=0;
}
export function undo(){
  if(!undoStack.length) return;
  const s=undoStack.pop(); bytes-=sizeOf(s);
  redoStack.push(captureUndo(!!s.settings));
  restore(s);
  refreshHistoryView();
}
export function redo(){
  if(!redoStack.length) return;
  const next=redoStack.pop(), s=captureUndo(!!next.settings);
  undoStack.push(s); bytes+=sizeOf(s);
  restore(next);
  refreshHistoryView();
}
