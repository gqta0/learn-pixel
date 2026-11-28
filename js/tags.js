/* Thẻ hoạt ảnh: một khoảng khung có tên (idle, chạy, đánh…) trong cùng một bản vẽ, kèm chiều chạy.
   Tag = {name, from, to, dir:'fwd'|'rev'|'ping'} — chỉ số khung bắt đầu từ 0, tính cả to. Thuần, không DOM. */
export const TAG_DIRS=['fwd','rev','ping'];
export const TAG_MAX=24;

/* bỏ thẻ hỏng (thiếu tên, khoảng ngược), cắt tên, kẹp khoảng trong số khung, chiều lạ thì về xuôi */
export function cleanTags(tags, frameCount){
  if(!Array.isArray(tags) || frameCount<1) return [];
  const out=[];
  for(const t of tags){
    if(!t || typeof t!=='object') continue;
    const name=String(t.name ?? '').trim().slice(0,TAG_MAX);
    let from=Number(t.from), to=Number(t.to);
    if(!name || !Number.isInteger(from) || !Number.isInteger(to) || from>to) continue;
    from=Math.max(0,from); to=Math.min(frameCount-1,to);
    if(from>to) continue;
    out.push({name, from, to, dir:TAG_DIRS.includes(t.dir) ? t.dir : 'fwd'});
  }
  return out;
}

/* chèn / xoá / dời khung: map(i) cho chỗ mới của khung i, -1 nếu khung đã xoá.
   Thẻ ôm từ khung nhỏ nhất tới lớn nhất còn lại của nó; mất hết khung thì bỏ thẻ. */
export function remapTags(tags, map){
  const out=[];
  for(const t of tags||[]){
    let lo=Infinity, hi=-Infinity;
    for(let i=t.from;i<=t.to;i++){ const j=map(i); if(j>=0){ lo=Math.min(lo,j); hi=Math.max(hi,j); } }
    if(hi>=lo) out.push({...t, from:lo, to:hi});
  }
  return out;
}

/* thứ tự khung của một vòng chạy */
export function tagFrames(tag){
  const up=[];
  for(let i=tag.from;i<=tag.to;i++) up.push(i);
  if(tag.dir==='rev') return up.reverse();
  if(tag.dir==='ping' && up.length>2) return [...up, ...up.slice(1,-1).reverse()];
  return up;
}

/* "chạy 1-8" → {name:'chạy', from:0, to:7}; số khung đếm từ 1 như dải khung. Sai thì null. */
export function parseTagInput(text, frameCount){
  const m=String(text||'').trim().match(/^(.+?)\s+(\d+)\s*[-–]\s*(\d+)$/);
  if(!m) return null;
  const name=m[1].trim().slice(0,TAG_MAX), from=Number(m[2])-1, to=Number(m[3])-1;
  if(!name || from<0 || to<from || to>=frameCount) return null;
  return {name, from, to};
}
