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

/* Chạm giữ: đủ ms mà vẫn trong slop px (px màn hình) quanh chỗ đặt xuống. */
export function longPressReady(down, cur, {ms=400, slop=6}={}){
  return cur.t-down.t>=ms && Math.hypot(cur.x-down.x, cur.y-down.y)<=slop;
}

/* Đầu bút đã đứng yên ms cuối chưa: lấy vị trí lúc đầu khoảng ms (mẫu cuối cùng có t ≤ now-ms) và mọi mẫu sau nó,
   tất cả phải trong slop px quanh mẫu mới nhất. Chưa có mẫu nào cũ đủ ms thì chưa tính. */
export function stillFor(samples, now, ms=600, slop=3){
  let k=-1;
  for(let i=0;i<samples.length;i++) if(samples[i].t<=now-ms) k=i;
  if(k<0) return false;
  const last=samples[samples.length-1];
  for(let i=k;i<samples.length;i++) if(Math.hypot(samples[i].x-last.x, samples[i].y-last.y)>slop) return false;
  return true;
}
