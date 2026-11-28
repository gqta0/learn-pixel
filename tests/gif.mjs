// Run: node --test tests/gif.mjs — bộ mã hoá GIF hoạt ảnh: đọc ngược lại bằng một bộ giải nhỏ viết riêng ở đây.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {encodeGif} from '../js/gif.js';

const px=(r,g,b,a=255)=>(r|(g<<8)|(b<<16)|(a<<24))>>>0;
const RED=px(255,0,0), BLUE=px(0,0,255), CLEAR=0;

/* bộ đọc GIF tối thiểu: khổ, bảng màu, vòng lặp, từng khung (độ trễ, chỉ số trong suốt, chỉ số màu đã giải LZW) */
function parseGif(g){
  const u16=i=>g[i]|(g[i+1]<<8);
  const out={sig:String.fromCharCode(...g.slice(0,6)), w:u16(6), h:u16(8), loop:null, frames:[]};
  const packed=g[10], gctSize=packed&0x80 ? 2<<(packed&7) : 0;
  out.gct=[]; for(let i=0;i<gctSize;i++) out.gct.push([g[13+i*3],g[14+i*3],g[15+i*3]]);
  let p=13+gctSize*3, gce=null;
  const blocks=()=>{ const parts=[]; while(g[p]){ parts.push(...g.slice(p+1,p+1+g[p])); p+=g[p]+1; } p++; return parts; };
  while(p<g.length){
    const b=g[p++];
    if(b===0x3b) break;
    if(b===0x21){
      const label=g[p++];
      if(label===0xf9){ const size=g[p]; gce={transparent:g[p+1]&1, delay:u16(p+2), ti:g[p+4]}; p+=size+1; blocks(); }
      else if(label===0xff){ const size=g[p]; const id=String.fromCharCode(...g.slice(p+1,p+1+size)); p+=size+1; const d=blocks(); if(id==='NETSCAPE2.0') out.loop=d[1]|(d[2]<<8); }
      else blocks();
    } else if(b===0x2c){
      const fw=u16(p+4), fh=u16(p+6); p+=9;
      const min=g[p++], data=blocks();
      out.frames.push({...gce, w:fw, h:fh, indices:lzwDecode(data,min,fw*fh)});
      gce=null;
    } else throw new Error('khối lạ '+b);
  }
  return out;
}
function lzwDecode(data,min,count){
  const clear=1<<min, eoi=clear+1, out=[];
  let size=min+1, dict=[], prev=null, bit=0;
  const reset=()=>{ dict=[]; for(let i=0;i<clear;i++) dict[i]=[i]; dict[clear]=[]; dict[eoi]=[]; size=min+1; prev=null; };
  reset();
  const read=()=>{ let v=0; for(let i=0;i<size;i++,bit++) v|=((data[bit>>3]>>(bit&7))&1)<<i; return v; };
  while(out.length<count){
    const code=read();
    if(code===clear){ reset(); continue; }
    if(code===eoi) break;
    let entry=dict[code] ? dict[code] : prev ? [...prev, prev[0]] : [];
    out.push(...entry);
    if(prev){ dict.push([...prev, entry[0]]); if(dict.length===(1<<size) && size<12) size++; }
    prev=entry;
  }
  return out;
}

test('đầu file, khổ, số khung, lặp mãi, độ trễ theo phần trăm giây',()=>{
  const f1=new Uint32Array([RED,CLEAR,BLUE,RED]), f2=new Uint32Array([BLUE,BLUE,CLEAR,CLEAR]);
  const g=parseGif(encodeGif({w:2,h:2,frames:[f1,f2],delays:[100,15]}));
  assert.equal(g.sig,'GIF89a');
  assert.deepEqual([g.w,g.h],[2,2]);
  assert.equal(g.frames.length,2);
  assert.equal(g.loop,0);
  assert.deepEqual(g.frames.map(f=>f.delay),[10,2]);          // 15ms làm tròn lên mức tối thiểu 2
});
test('giải ngược ra đúng màu; ô trong suốt là chỉ số trong suốt',()=>{
  const f1=new Uint32Array([RED,CLEAR,BLUE,RED]);
  const g=parseGif(encodeGif({w:2,h:2,frames:[f1],delays:[100]}));
  const fr=g.frames[0];
  assert.equal(fr.transparent,1);
  const rgb=fr.indices.map(i=>i===fr.ti ? 'trong' : g.gct[i].join(','));
  assert.deepEqual(rgb,['255,0,0','trong','0,0,255','255,0,0']);
});
test('scale 3 nhân khổ và nhân từng ô',()=>{
  const g=parseGif(encodeGif({w:2,h:1,frames:[new Uint32Array([RED,BLUE])],delays:[100],scale:3}));
  assert.deepEqual([g.w,g.h],[6,3]);
  const fr=g.frames[0], c=i=>g.gct[fr.indices[i]].join(',');
  assert.deepEqual([c(0),c(2),c(3),c(5),c(12),c(17)],['255,0,0','255,0,0','0,0,255','0,0,255','255,0,0','0,0,255']);
});
test('nhiều màu, ảnh lớn: LZW nới mã tới 12 bit vẫn giải đúng',()=>{
  const w=64,h=64, f=new Uint32Array(w*h);
  for(let i=0;i<f.length;i++) f[i]=px((i*37)%200,10,20);          // đúng 200 màu, xen kẽ để từ điển LZW đầy nhanh
  const g=parseGif(encodeGif({w,h,frames:[f],delays:[100]})), fr=g.frames[0];
  assert.equal(fr.indices.length,w*h);
  for(const i of [0,1,63,64,1000,4095]){
    const v=f[i]; assert.equal(g.gct[fr.indices[i]].join(','),[v&255,(v>>8)&255,(v>>16)&255].join(','));
  }
});
test('quá 255 màu thì báo lỗi rõ ràng',()=>{
  const f=new Uint32Array(300); for(let i=0;i<300;i++) f[i]=px(i&255, i>>8, 7);
  assert.throws(()=>encodeGif({w:300,h:1,frames:[f],delays:[100]}),/255 màu, tranh đang có 300 màu/);
});
