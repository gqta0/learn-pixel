import {test} from 'node:test';
import assert from 'node:assert/strict';
import {countClusters, suggestCount, suggestGrid, unionBBox, medianCut, keyOutBackground,
  pixelizeSheet, spriteFramesTres, sheetBox, fitRatio, pixelizeImage, stackSheets} from '../js/sheet.js';
import {groupColors, pickColors} from '../js/palgroups.js';

const rgba=(r,g,b,a=255)=>((a<<24)|(b<<16)|(g<<8)|r)>>>0;
/* sheet giả: n khung, mỗi khung một khối màu lệch chỗ khác nhau trong ô */
function sheet(cols,cw,ch,rows=1){
  const w=cols*cw,h=rows*ch,px=new Uint32Array(w*h);
  for(let r=0;r<rows;r++) for(let c=0;c<cols;c++){
    const i=r*cols+c, x0=4+(i%3), y0=6, bw=cw-12, bh=ch-8;
    for(let y=y0;y<y0+bh;y++) for(let x=x0;x<x0+bw;x++){
      const edge=x===x0||y===y0||x===x0+bw-1||y===y0+bh-1;
      px[(r*ch+y)*w+c*cw+x]=edge?rgba(20,20,30):(y<y0+bh/2?rgba(220,60,60):rgba(60,90,220));
    }
  }
  return {px,w,h};
}

test('frame count is suggested from the gaps between sprites, and falls back to square cells',()=>{
  const {px,w,h}=sheet(16,40,40);
  assert.equal(countClusters(px,w,h,'x'),16);
  const g=suggestGrid(px,w,h);
  assert.equal(g.cols,16); assert.equal(g.rows,1);
  assert.ok(g.colOptions.includes(16) && g.colOptions.every(n=>w%n===0));
  // khung chạm nhau, không còn khe để đếm: lấy ô gần vuông nhất
  assert.equal(suggestCount(2000,127,0).pick,16);
  assert.equal(suggestCount(640,64,1).pick,10);
  // số cụm không chia hết chiều dài thì không tin nó, lấy ước số gần nhất
  assert.equal(suggestCount(2000,127,15).pick,16);
  const two=sheet(8,40,40,2);
  assert.deepEqual([suggestGrid(two.px,two.w,two.h).cols,suggestGrid(two.px,two.w,two.h).rows],[8,2]);
});

test('an opaque flat background is keyed out; a transparent sheet is left alone',()=>{
  const {px,w,h}=sheet(4,20,20);
  assert.equal(keyOutBackground(px,w,h),px);
  const solid=px.map(p=>p||rgba(255,0,255));
  const keyed=keyOutBackground(solid,w,h);
  assert.deepEqual(keyed,px);
  assert.equal(countClusters(keyed,w,h,'x'),4);
});

test('pixelize keeps every frame on one shared crop so the animation does not jitter',()=>{
  const {px,w,h}=sheet(6,40,40);
  const box=unionBBox(px,w,6,1,40,40);
  assert.deepEqual(box,{x:4,y:6,w:30,h:32});           // gộp cả ba độ lệch 0,1,2
  const r=pixelizeSheet(px,w,h,{cols:6,rows:1,ratio:0.5,canvas:0,colors:4});
  assert.deepEqual([r.w,r.h,r.frames.length],[15,16,6]);
  // khung 0 và khung 1 lệch nhau 1px ở gốc → sau khi thu 50% vẫn phải khác nhau, không bị canh lại cho trùng
  assert.notDeepEqual(r.frames[0],r.frames[2]);
  assert.deepEqual(r.frames[0],r.frames[3]);
});

test('fixed canvas anchors the sprite bottom-centre and refuses a sprite that does not fit',()=>{
  const {px,w,h}=sheet(2,40,40);
  const r=pixelizeSheet(px,w,h,{cols:2,rows:1,ratio:0.5,canvas:32,colors:4});
  assert.deepEqual([r.w,r.h],[32,32]);
  const f=r.frames[0], rowHas=y=>{ for(let x=0;x<32;x++) if(f[y*32+x]) return true; return false; };
  assert.ok(rowHas(31),'chân phải chạm hàng đáy');
  assert.ok(!rowHas(0));
  let minX=32,maxX=-1;
  for(let y=0;y<32;y++) for(let x=0;x<32;x++) if(f[y*32+x]){ minX=Math.min(minX,x); maxX=Math.max(maxX,x); }
  assert.ok(Math.abs(minX-(31-maxX))<=2,'canh giữa theo chiều ngang');
  assert.throws(()=>pixelizeSheet(px,w,h,{cols:2,rows:1,ratio:1,canvas:16,colors:4}),/không vừa khung/);
});

test('colours are limited, taken by majority vote, and the dark outline survives downscaling',()=>{
  const {px,w,h}=sheet(2,40,40);
  // rắc nhiễu màu vào để giống tranh có khử răng cưa
  const noisy=px.map((p,i)=>p?rgba((p&255)+(i%7),((p>>>8)&255)+(i%5),((p>>>16)&255)+(i%3)):0);
  const r=pixelizeSheet(noisy,w,h,{cols:2,rows:1,ratio:0.5,canvas:0,colors:3});
  const used=new Set(); r.frames.forEach(f=>f.forEach(p=>{ if(p) used.add(p); }));
  assert.ok(used.size<=3 && r.palette.length===used.size);
  assert.ok(r.frames[0].every(p=>p===0 || (p>>>24)===255),'không còn pixel nửa trong suốt');
  assert.equal(medianCut(noisy,3).length,3);
  // bảng màu cho sẵn thì dùng đúng bảng đó
  const fixed=pixelizeSheet(noisy,w,h,{cols:2,rows:1,ratio:0.5,canvas:0,palette:['#000000','#ffffff']});
  const fu=new Set(); fixed.frames.forEach(f=>f.forEach(p=>{ if(p) fu.add(p); }));
  assert.ok([...fu].every(p=>p===0xff000000||p===0xffffffff));
});

test('trailing empty cells are dropped, so a half-filled last row does not add blank frames',()=>{
  const {px,w,h}=sheet(4,20,20,2);
  // xoá hai ô cuối của hàng dưới
  for(let y=20;y<40;y++) for(let x=40;x<80;x++) px[y*w+x]=0;
  assert.equal(pixelizeSheet(px,w,h,{cols:4,rows:2,ratio:1,canvas:0,colors:4}).frames.length,6);
});

test('godot SpriteFrames lists one atlas region per frame in sheet order',()=>{
  const t=spriteFramesTres({name:'hero attack!',texture:'res://sprites/hero.png',fw:64,fh:48,cols:4,count:6,fps:12,loop:false,durations:[1,2.5]});
  assert.match(t,/^\[gd_resource type="SpriteFrames" load_steps=8 format=3\]/);
  assert.match(t,/path="res:\/\/sprites\/hero\.png"/);
  assert.equal((t.match(/\[sub_resource type="AtlasTexture"/g)||[]).length,6);
  assert.ok(t.includes('region = Rect2(0, 0, 64, 48)') && t.includes('region = Rect2(64, 48, 64, 48)'));   // khung 5 xuống hàng 2
  assert.ok(t.includes('"duration": 2.5') && t.includes('"speed": 12.0') && t.includes('"loop": false'));
  assert.ok(t.includes('"name": &"hero_attack"'));
});

test('fit ratio fills the canvas on the longer side, never overflows and never upscales',()=>{
  assert.equal(fitRatio({w:120,h:123},64),64/123);
  assert.equal(fitRatio({w:200,h:50},64),64/200);
  assert.equal(fitRatio({w:40,h:30},64),1);                 // ảnh gốc nhỏ hơn khung: giữ nguyên, không phóng
  assert.equal(fitRatio({w:300,h:200},0),128/300);           // không chọn khung thì chặn ở 128
  const {px,w,h}=sheet(4,125,127);
  const box=sheetBox(px,w,h,4,1);
  for(const side of [32,48,64,96,128]){
    const r=pixelizeSheet(px,w,h,{cols:4,rows:1,ratio:fitRatio(box,side),fit:true,canvas:side,colors:4});
    assert.deepEqual([r.w,r.h],[side,side]);
    assert.ok(r.sprite.w<=side && r.sprite.h<=side);
    if(Math.max(box.w,box.h)>=side) assert.equal(Math.max(r.sprite.w,r.sprite.h),side,'chiều dài hơn phải chạm sát mép khung '+side);
    else assert.deepEqual([r.sprite.w,r.sprite.h],[box.w,box.h],'hình nhỏ hơn khung thì giữ nguyên cỡ');
  }
});

test('tight canvas hugs the sprite: long side equals the chosen size and no margin is left',()=>{
  // hình gốc rộng hơn cao, giống tấm có tư thế vươn tay
  const cols=4,cw=125,ch=100,w=cols*cw,h=ch,px=new Uint32Array(w*h);
  for(let c=0;c<cols;c++){
    const bw=c===2?119:90;                       // khung thứ 3 vươn rộng hơn hẳn
    for(let y=22;y<98;y++) for(let x=3;x<3+bw;x++) px[y*w+c*cw+x]=rgba(200,80,60);
  }
  const box=sheetBox(px,w,h,cols,1);
  assert.deepEqual([box.w,box.h],[119,76]);
  const sq=pixelizeSheet(px,w,h,{cols,rows:1,ratio:fitRatio(box,96),fit:true,canvas:96,colors:2});
  const tight=pixelizeSheet(px,w,h,{cols,rows:1,ratio:fitRatio(box,96),fit:true,canvas:96,tight:true,colors:2});
  assert.deepEqual([sq.w,sq.h],[96,96]);
  assert.deepEqual([tight.w,tight.h],[96,61]);    // không còn 35 px trống phía trên
  const top=r=>{ for(let i=0;i<r.w*r.h;i++) if(r.frames[2][i]) return Math.floor(i/r.w); };
  assert.equal(top(sq),35); assert.equal(top(tight),0);
  // khung rộng nhất chạm đủ hai mép; khung hẹp vẫn trống bên — đó là chỗ của tư thế vươn ra
  assert.deepEqual(tight.widths,[73,73,96,73]);
});

test('image → pixel votes each target pixel into the chosen palette, keeping hard edges',()=>{
  // 8×8 nguồn: nửa trái đỏ, nửa phải xanh, thêm nhiễu lệch tông
  const w=8,h=8,src=new Uint32Array(w*h);
  for(let y=0;y<h;y++) for(let x=0;x<w;x++) src[y*w+x]=x<4?rgba(200+(y%2)*20,40,40):rgba(40,60,210-(x%2)*15);
  const out=pixelizeImage(src,w,h,2,2,['#d03030','#3040d0','#ffffff']);
  const red=rgba(0xd0,0x30,0x30), blue=rgba(0x30,0x40,0xd0);
  assert.deepEqual([...out],[red,blue,red,blue]);
  assert.throws(()=>pixelizeImage(src,w,h,2,2,[]),/chưa có màu/);
  // ô nguồn quá nửa trong suốt thì để trong suốt
  const clear=new Uint32Array(16); clear[0]=rgba(255,0,0);
  assert.equal(pixelizeImage(clear,4,4,1,1,['#ff0000'])[0],0);
});
test('several sheets stack into layers of one drawing: first sheet on top, shared size, short sheets padded',()=>{
  const mk=(w,h,n,c)=>({w,h,palette:['#'+c],frames:Array.from({length:n},()=>new Uint32Array(w*h).fill(rgba(1,2,3)))});
  const st=stackSheets([{name:'Gốc',r:mk(4,6,3,'010203')},{name:'Style mới',r:mk(6,4,2,'040506')}]);
  assert.equal(st.w,6); assert.equal(st.h,6); assert.equal(st.count,3);
  assert.deepEqual(st.layers.map(l=>l.name),['Style mới','Gốc']);          // lớp 0 = dưới cùng
  assert.equal(st.frames.length,3); assert.ok(st.frames.every(f=>f.length===2));
  // "Gốc" 4×6 canh giữa ngang: cột 0 trống, cột 1 có hình
  const top=st.frames[0][1];
  assert.equal(top[0],0); assert.notEqual(top[1],0);
  // "Style mới" 6×4 đặt chân sát đáy: hàng 0–1 trống, hàng 2 có hình
  const bottom=st.frames[0][0];
  assert.equal(bottom[0],0); assert.notEqual(bottom[2*6],0);
  // tấm chỉ có 2 khung: khung 3 của nó trống
  assert.ok(st.frames[2][0].every(v=>v===0)); assert.ok(st.frames[2][1].some(v=>v));
  assert.deepEqual(st.counts,[3,2]); assert.deepEqual(st.palette,['#010203','#040506']);
});
test('palette groups come from the token table; unknown colours fall into "Khác"; groups can be switched off',()=>{
  const tokens={'#aa0000':{group:'Fire'},'#bb0000':{group:'Fire'},'#00aa00':{group:'Grass'},'#123456':{group:'Ink',legacy:true}};
  const hexes=['#AA0000','#00aa00','#bb0000','#ffffff','#123456'];
  assert.deepEqual(groupColors(hexes,tokens).map(g=>[g.group,g.colors.length]),[['Fire',2],['Grass',1],['Khác',2]]);
  assert.deepEqual(pickColors(hexes,tokens,new Set(['Fire'])),['#00aa00','#ffffff','#123456']);
  assert.deepEqual(pickColors(hexes,tokens,['Fire','Grass','Khác']),[]);
});
