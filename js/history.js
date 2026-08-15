/* Hoàn tác / làm lại: chụp lại toàn bộ tài liệu, giữ 80 bước gần nhất. */
import { doc } from './state.js';
import { syncAll } from './ui.js';

/* Mỗi bước hoàn tác là một bản chụp cả tài liệu, nên phải chặn theo DUNG LƯỢNG
   chứ không theo số bước: 128×128 với 6 lớp × 8 khung là 3 MB một bản chụp,
   80 bước sẽ thành 250 MB. Khổ nhỏ thì vẫn đủ 80 bước như cũ. */
const MAX_STEPS=80, MAX_BYTES=64*1024*1024;
const undoStack=[], redoStack=[];
let bytes=0;
const sizeOf = s => s.frames.length * s.layers.length * s.w * s.h * 4;
function trim(){
  while(undoStack.length && (undoStack.length>MAX_STEPS || bytes>MAX_BYTES))
    bytes -= sizeOf(undoStack.shift());
}
function snap(){
  return {
    w:doc.w, h:doc.h, af:doc.af, al:doc.al,
    layers: doc.layers.map(l=>({name:l.name, vis:l.vis})),
    frames: doc.frames.map(f=>f.map(d=>d.slice())),
    dur: doc.dur.slice()
  };
}
function restore(s){
  doc.w=s.w; doc.h=s.h; doc.af=s.af; doc.al=s.al;
  doc.layers=s.layers.map(l=>({name:l.name,vis:l.vis}));
  doc.frames=s.frames.map(f=>f.map(d=>d.slice()));
  doc.dur=(s.dur||[]).slice();
}
export function pushUndo(){
  const s=snap();
  undoStack.push(s); bytes+=sizeOf(s);
  trim();
  redoStack.length=0;
}
export function undo(){
  if(!undoStack.length) return;
  redoStack.push(snap());
  const s=undoStack.pop(); bytes-=sizeOf(s);
  restore(s);
  syncAll();
}
export function redo(){
  if(!redoStack.length) return;
  const s=snap();
  undoStack.push(s); bytes+=sizeOf(s);
  restore(redoStack.pop());
  syncAll();
}
