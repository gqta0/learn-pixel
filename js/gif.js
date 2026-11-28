/* Mã hoá GIF89a hoạt ảnh, thuần tính toán (không DOM).
   frames: Uint32Array theo định dạng màu của color.js (ABGR: r = v&255).
   GIF chỉ có đặc hoặc trong: ô bán trong suốt thành chấm hạt Bayer 4×4 theo đúng độ mờ (tính theo ô của tranh,
   nên phóng to vẫn là khối pixel gọn).
   Một bảng màu chung cho mọi khung (chỉ số 0 = trong suốt), tối đa 255 màu thật — pixel art hiếm khi vượt.
   delays: mili-giây từng khung; GIF lưu theo phần trăm giây, tối thiểu 2 (trình duyệt coi nhỏ hơn là 10). */
const BAYER=[0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5];
const solid=(v,x,y)=>((v>>>24)&255) > (BAYER[(y&3)*4+(x&3)]+.5)*16;
/* tổng số điểm ảnh tối đa (khổ đã phóng × số khung): quá thì mã hoá đồng bộ làm đứng trang vài giây */
export const GIF_MAX_PIXELS=40e6;

export function encodeGif({w, h, frames, delays=[], scale=1, loop=0}){
  scale=Math.max(1, Math.floor(scale));
  const W=w*scale, H=h*scale;
  const total=W*H*frames.length;
  if(total>GIF_MAX_PIXELS) throw new Error('GIF quá lớn ('+Math.round(total/1e6)+' triệu điểm ảnh): giảm Cỡ xuất hoặc số khung');

  // bảng màu chung (chỉ màu của những ô đặc sau khi chấm hạt)
  const index=new Map(), colors=[];
  for(const f of frames) for(let i=0;i<f.length;i++){
    const v=f[i];
    if(!solid(v, i%w, Math.floor(i/w))) continue;
    const rgb=v&0xffffff;
    if(!index.has(rgb)){ index.set(rgb, colors.length+1); colors.push(rgb); }
  }
  if(colors.length>255) throw new Error('GIF chỉ chứa được 255 màu, tranh đang có '+colors.length+' màu');
  let bits=1;
  while((1<<bits)<colors.length+1) bits++;

  const out=[];
  const u16=v=>out.push(v&255, (v>>8)&255);
  const str=s=>{ for(const c of s) out.push(c.charCodeAt(0)); };
  str('GIF89a'); u16(W); u16(H);
  out.push(0x80 | ((bits-1)<<4) | (bits-1), 0, 0);              // có bảng màu chung, nền = chỉ số 0
  for(let i=0;i<(1<<bits);i++){
    const rgb=i===0 ? 0 : (colors[i-1] ?? 0);
    out.push(rgb&255, (rgb>>8)&255, (rgb>>16)&255);
  }
  out.push(0x21, 0xff, 11); str('NETSCAPE2.0'); out.push(3, 1); u16(loop); out.push(0);   // lặp

  const minCode=Math.max(2, bits);
  frames.forEach((f, k)=>{
    const cs=Math.max(2, Math.round((delays[k] ?? 100)/10));
    out.push(0x21, 0xf9, 4, (2<<2) | 1); u16(cs); out.push(0, 0);          // xoá về nền sau khung, có ô trong suốt
    out.push(0x2c); u16(0); u16(0); u16(W); u16(H); out.push(0);
    const idx=new Uint8Array(W*H);
    for(let y=0;y<H;y++) for(let x=0;x<W;x++){
      const sx=Math.floor(x/scale), sy=Math.floor(y/scale), v=f[sy*w+sx];
      idx[y*W+x]=solid(v,sx,sy) ? index.get(v&0xffffff) : 0;
    }
    out.push(minCode);
    const data=lzw(idx, minCode);
    for(let i=0;i<data.length;i+=255){
      const n=Math.min(255, data.length-i);
      out.push(n); for(let j=0;j<n;j++) out.push(data[i+j]);
    }
    out.push(0);
  });
  out.push(0x3b);
  return Uint8Array.from(out);
}

/* LZW kiểu GIF: mã bắt đầu minCode+1 bit, nới dần tới 12 bit, đầy thì phát mã xoá và làm lại từ điển */
function lzw(idx, minCode){
  const clear=1<<minCode, eoi=clear+1, bytes=[];
  let size=minCode+1, next=eoi+1, dict=new Map(), acc=0, nbits=0;
  const emit=code=>{
    acc|=code<<nbits; nbits+=size;
    while(nbits>=8){ bytes.push(acc&255); acc>>>=8; nbits-=8; }
  };
  emit(clear);
  let prefix=idx.length ? idx[0] : -1;
  for(let i=1;i<idx.length;i++){
    const c=idx[i], key=prefix*256+c, hit=dict.get(key);
    if(hit!==undefined){ prefix=hit; continue; }
    emit(prefix);
    if(next<4096){
      dict.set(key, next++);
      if(next>(1<<size) && size<12) size++;
    } else {
      emit(clear); dict=new Map(); size=minCode+1; next=eoi+1;
    }
    prefix=c;
  }
  if(prefix>=0) emit(prefix);
  emit(eoi);
  if(nbits>0) bytes.push(acc&255);
  return bytes;
}
