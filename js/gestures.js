/* Phân loại cử chỉ trên canvas, thuần tính toán (không DOM) để test bằng Node.
   Toạ độ là px màn hình (clientX/Y), thời gian là mili-giây. */

/* Chạm nhanh nhiều ngón: hai ngón = hoàn tác, ba ngón = làm lại.
   Chỉ tính khi mọi ngón nhấc lên trong maxMs kể từ ngón đầu đặt xuống và không ngón nào lệch quá slop:
   chụm để phóng, kéo hai ngón, hay đặt ngón lâu đều không phải chạm. */
export function createTapTracker({maxMs=250, slop=10}={}){
  let fingers=new Map(), start=0, most=0, spoiled=false;
  const reset=()=>{ fingers=new Map(); start=0; most=0; spoiled=false; };
  return {
    down(id, x, y, t){
      if(!fingers.size){ start=t; most=0; spoiled=false; }
      fingers.set(id, {x, y, up:false});
      most=Math.max(most, [...fingers.values()].filter(f=>!f.up).length);
    },
    move(id, x, y){
      const f=fingers.get(id);
      if(f && !f.up && Math.hypot(x-f.x, y-f.y)>slop) spoiled=true;
    },
    up(id, t){
      const f=fingers.get(id);
      if(!f || f.up) return null;
      f.up=true;
      if([...fingers.values()].some(g=>!g.up)) return null;
      const ok=!spoiled && t-start<=maxMs;
      const result=ok && most===2 ? 'undo' : ok && most===3 ? 'redo' : null;
      reset();
      return result;
    },
    reset
  };
}
