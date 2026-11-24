// Giữ cử chỉ kéo trong tay nắm để cọ và cuộn bảng có vùng thao tác riêng.
export function bindDrawerDrag(handle, move) {
  let start=null, suppressClick=false;
  handle.addEventListener('pointerdown', event=>{
    if(event.button!==0) return;
    start={id:event.pointerId, y:event.clientY};
    handle.setPointerCapture(event.pointerId);
  });
  handle.addEventListener('pointerup', event=>{
    if(start?.id!==event.pointerId) return;
    const distance=event.clientY-start.y;
    start=null;
    if(Math.abs(distance)<36) return;
    suppressClick=true;
    move(distance<0 ? 'up' : 'down');
    setTimeout(()=>{ suppressClick=false; },0);
  });
  handle.addEventListener('pointercancel',()=>{ start=null; });
  handle.addEventListener('click',event=>{
    if(!suppressClick) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  },true);
}
