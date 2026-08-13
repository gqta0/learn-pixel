/* Hoàn tác / làm lại: chụp lại toàn bộ tài liệu, giữ 80 bước gần nhất. */
import { doc } from './state.js';
import { syncAll } from './ui.js';

const undoStack=[], redoStack=[];
function snap(){
  return {
    w:doc.w, h:doc.h, af:doc.af, al:doc.al,
    layers: doc.layers.map(l=>({name:l.name, vis:l.vis})),
    frames: doc.frames.map(f=>f.map(d=>d.slice()))
  };
}
function restore(s){
  doc.w=s.w; doc.h=s.h; doc.af=s.af; doc.al=s.al;
  doc.layers=s.layers.map(l=>({name:l.name,vis:l.vis}));
  doc.frames=s.frames.map(f=>f.map(d=>d.slice()));
}
export function pushUndo(){
  undoStack.push(snap());
  if(undoStack.length>80) undoStack.shift();
  redoStack.length=0;
}
export function undo(){
  if(!undoStack.length) return;
  redoStack.push(snap());
  restore(undoStack.pop());
  syncAll();
}
export function redo(){
  if(!redoStack.length) return;
  undoStack.push(snap());
  restore(redoStack.pop());
  syncAll();
}
