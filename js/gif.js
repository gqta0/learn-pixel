/* Mã hoá GIF89a hoạt ảnh, thuần tính toán (không DOM).
   frames: Uint32Array theo định dạng màu của color.js (ABGR: r = v&255). Ô có alpha < 128 thành trong suốt.
   Một bảng màu chung cho mọi khung (chỉ số 0 = trong suốt), tối đa 255 màu thật — pixel art hiếm khi vượt.
   delays: mili-giây từng khung; GIF lưu theo phần trăm giây, tối thiểu 2 (trình duyệt coi nhỏ hơn là 10). */
export function encodeGif({w, h, frames, delays=[], scale=1, loop=0}){
  scale=Math.max(1, Math.floor(scale));
  const W=w*scale, H=h*scale;

  // bảng màu chung
  const index=new Map(), colors=[];
  for(const f of frames) for(const v of f){
    if(((v>>>24)&255)<128) continue;
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
      const v=f[Math.floor(y/scale)*w+Math.floor(x/scale)];
      idx[y*W+x]=((v>>>24)&255)<128 ? 0 : index.get(v&0xffffff);
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
