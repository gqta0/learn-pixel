/* Thư viện hình mẫu: mọi hình minh hoạ đều vẽ bằng thuật toán pixel,
   nên tự đổi màu theo chủ đề sáng/tối thay vì dùng ảnh chụp. */
import { TH } from './../state.js';

export function px(g,x,y,c){ g.fillStyle=c; g.fillRect(x,y,1,1); }
export function runsLine(g,runs,color,x0,y0){
  let x=x0,y=y0;
  runs.forEach(len=>{ for(let i=0;i<len;i++) px(g,x++,y,color); y++; });
}
export function drawMap(g,map,colors,ox,oy){
  map.forEach((row,y)=>{
    for(let x=0;x<row.length;x++){
      const c=colors[row[x]];
      if(c) px(g,ox+x,oy+y,c);
    }
  });
}
export const CURVE_BAD=[
"xx...........",
"..xxxx.......",
"......x......",
".......xxx...",
"..........x..",
"..........x..",
"...........x.",
"..........x..",
"...........x."];
export const CURVE_GOOD=[
"xxxx.........",
"....xxx......",
".......xx....",
".........x...",
"..........x..",
"..........x..",
"..........x..",
"...........x.",
"...........x."];
export const AA_SOFT=[
"xxxxo........",
"...oxxx......",
"......oxx....",
"........ox...",
"..........x..",
"..........x..",
"..........x..",
"..........ox.",
"...........x."];
export const POT_W=14, POT_H=16;
export const RAMP_GLASS=['#1f4a52','#2f7a86','#63bcd1','#a8e6e0'];
export const RAMP_LIQ  =['#6b1f28','#a83a3a','#d95f4f','#f2a06a'];
export const RAMP_CORK =['#3d2b1f','#6b4423','#a06534','#c68a4a'];
export function potionGrid(){
  const grid=[];
  for(let y=0;y<POT_H;y++){ grid[y]=[]; for(let x=0;x<POT_W;x++) grid[y][x]=null; }
  const cx=6.5, cy=10.5, r=5.4;
  for(let y=0;y<POT_H;y++) for(let x=0;x<POT_W;x++){
    const dx=x-cx, dy=y-cy;
    if(Math.sqrt(dx*dx+dy*dy)<=r) grid[y][x] = (y>=10) ? 'l' : 'g';
  }
  for(let y=3;y<=6;y++) for(let x=5;x<=8;x++) grid[y][x]='g';   // cổ chai
  for(let y=1;y<=2;y++) for(let x=4;x<=9;x++) grid[y][x]='c';   // nút bần
  return grid;
}
export function drawPotion(g, ox, mode, liq){
  const grid=potionGrid();
  const RAMPS={g:RAMP_GLASS, l:liq||RAMP_LIQ, c:RAMP_CORK};
  const solid=(x,y)=> x>=0&&y>=0&&x<POT_W&&y<POT_H&&grid[y][x];
  for(let y=0;y<POT_H;y++) for(let x=0;x<POT_W;x++){
    const k=grid[y][x]; if(!k) continue;
    const ramp=RAMPS[k];
    // sáng từ trên-trái
    const t = 0.62 - (x-6.5)*0.075 - (y - (k==='l'?11.5:4))*0.085;
    let ci = Math.max(0, Math.min(ramp.length-1, Math.round(t*(ramp.length-1))));
    const openL=!solid(x-1,y), openR=!solid(x+1,y), openT=!solid(x,y-1), openB=!solid(x,y+1);
    const edge = openL||openR||openT||openB;
    let col=ramp[ci];
    if(edge){
      if(mode==='hard') col='#14101a';
      else if(mode==='selective') col=(openR||openB) ? '#14101a' : ramp[Math.min(ramp.length-1,ci+1)];
      else if(mode==='colored') col=ramp[0];
    }
    px(g,ox+x,y,col);
  }
}
export function drawSphere(g,ox,oy,size,ramp,pillow){
  const r=size/2-0.5, cx=(size-1)/2, cy=(size-1)/2;
  const lx=-0.52, ly=-0.62, lz=0.58;
  for(let y=0;y<size;y++) for(let x=0;x<size;x++){
    const dx=x-cx, dy=y-cy, d=Math.sqrt(dx*dx+dy*dy);
    if(d>r+0.15) continue;
    let t;
    if(pillow){ t = 1 - d/r; }
    else{
      const nz=Math.sqrt(Math.max(0,r*r-dx*dx-dy*dy))/r;
      t = (dx/r)*lx + (dy/r)*ly + nz*lz;
      t = (t+0.30)/1.15;
    }
    const i=Math.max(0, Math.min(ramp.length-1, Math.floor(t*ramp.length)));
    px(g,ox+x,oy+y,ramp[i]);
  }
}
export function drawBands(g,w,h,ramp,even){
  for(let y=0;y<h;y++) for(let x=0;x<w;x++){
    const s=x+y;
    let i;
    if(even) i=Math.min(ramp.length-1, Math.floor(s/6));
    else{
      const off=[0,2,1,3,1,0,2,4,1,2,0,3,1,2][y%14];
      const q=s+off;
      i = q<5?0 : q<13?1 : q<17?2 : q<28?3 : 4;
    }
    px(g,x,y,ramp[Math.min(i,ramp.length-1)]);
  }
}
export const BAYER=[[0,8,2,10],[12,4,14,6],[3,11,1,9],[15,7,13,5]];
export function drawGradient(g,w,h,a,b,dither){
  for(let y=0;y<h;y++) for(let x=0;x<w;x++){
    const t=x/(w-1);
    let use;
    if(dither){ use = t > (BAYER[y%4][x%4]+0.5)/16 ? b : a; }
    else { use = t>0.5 ? b : a; }
    px(g,x,y,use);
  }
}
export function hash01(x,y){ const s=Math.sin(x*127.1+y*311.7)*43758.5453; return s-Math.floor(s); }
export function drawTile(g,seam){
  const T=16;
  for(let y=0;y<32;y++) for(let x=0;x<32;x++){
    const tx=x%T, ty=y%T;
    let c = hash01(tx,ty)<0.16 ? '#5d9c3c' : (hash01(tx+3,ty+7)<0.20 ? '#356b30' : '#8ab547');
    if(seam && (tx===0||ty===0)) c='#25401f';
    px(g,x,y,c);
  }
}


/* =======================================================================
   THƯ VIỆN HÌNH MẪU (vẽ bằng thuật toán, đổi màu theo chủ đề)
   ======================================================================= */
export const PAL={
 'k':'#14101a','w':'#fff6e0','W':'#efdcc0',
 'g':'#8ab547','G':'#5d9c3c','d':'#356b30',
 'b':'#6b4423','B':'#3d2b1f','n':'#a06534',
 's':'#8595a1','S':'#c2c3c7','x':'#566c86',
 'r':'#c94f4f','R':'#8c2f39','p':'#e88a5a',
 'y':'#f2c14e','Y':'#d18f3c',
 'c':'#63bcd1','C':'#3d7d8c',
 'm':'#b96ea8','f':'#efdcc0','F':'#c8ae94',
 'h':'#4a3b4e','H':'#2b2231','o':'#a8e6e0'
};
export function art(g,map,ox,oy,solid,over){
  map.forEach((row,y)=>{
    for(let x=0;x<row.length;x++){
      const ch=row[x]; if(ch==='.') continue;
      px(g,ox+x,oy+y, solid || (over&&over[ch]) || PAL[ch] || '#ffffff');
    }
  });
}
export function artFlip(g,map,ox,oy,solid,over){
  map.forEach((row,y)=>{
    for(let x=0;x<row.length;x++){
      const ch=row[row.length-1-x]; if(ch==='.') continue;
      px(g,ox+x,oy+y, solid || (over&&over[ch]) || PAL[ch] || '#ffffff');
    }
  });
}
export const A_SWORD=[
'................','......kk........','.....kSsk.......','.....kSsk.......',
'.....kSsk.......','.....kSsk.......','.....kSsk.......','.....kSsk.......',
'.....kSsk.......','...kkkkkkkk.....','...kyyyyyyk.....','...kkkbbkkk.....',
'......bb........','......bb........','......kk........','................'];
export const A_KEY=[
'................','.....kkkk.......','....kyyyyk......','....ky..yk......',
'....ky..yk......','....kyyyyk......','.....kyyk.......','......yk........',
'......yk........','......yk........','......ykk.......','......yyyk......',
'......ykkk......','......yyk.......','......kk........','................'];
export const A_BAG=[
'................','.....kkkk.......','....kb..bk......','...kkbbbbkk.....',
'..kbbbbbbbbk....','..kbnnnnnnbk....','..kbnnyynnbk....','..kbnnyynnbk....',
'..kbnnnnnnbk....','..kkbbbbbbkk....','...kkkkkkkk.....','................'];
export const A_COIN=[
'................','.....kkkk.......','...kkyyyykk.....','..kyyYyyyyYk....',
'..kyYyyyyyYk....','..kyyyyyyyyk....','..kyYyyyyyYk....','...kkyyyykk.....',
'.....kkkk.......','................'];
export const A_TREE=[
'......ggg.......','....ggGGGgg.....','...gGGgggGGg....','..gGGgggggGGg...',
'..gGGgggggGGg...','...gGGgggGGg....','....ggGGGgg.....','......ggg.......',
'.......bb.......','.......bB.......','.......bB.......','......bbBB......'];
export const A_CHEST=[
'................','..kkkkkkkkkk....','..knnnnnnnnk....','..knyyyyyynk....',
'..kkkkkkkkkk....','..knnnnnnnnk....','..knnnkkYnnk....','..knnnkYknnk....',
'..knnnnnnnnk....','..kkkkkkkkkk....'];
export const A_CHEST_OPEN=[
'....kkkkkkkk....','...knnnnnnnnk...','...kyyyyyyyyk...','...kkkkkkkkkk...',
'..kHHHHHHHHHHk..','..kHyyHHHHyyHk..','..kHHyyHHyyHHk..','..knnnnnnnnnnk..',
'..kkkkkkkkkkkk..'];
export const A_CHIBI=[
'................','.....HHHH.......','....HhhhhH......','....hffffh......',
'....hfkfkf......','....hffffh......','.....kffk.......','....kccck.......',
'...kccccck......','...kcfccfck.....','...kccccck......','....kbbbk.......',
'....kbkbk.......','....kb.bk.......','...kkk.kkk......','................'];
export const A_CHIBI_BACK=[
'................','.....HHHH.......','....HhhhhH......','....HhhhhH......',
'....HhhhhH......','....HhhhhH......','.....kffk.......','....kccck.......',
'...kccccck......','...kcfccfck.....','...kccccck......','....kbbbk.......',
'....kbkbk.......','....kb.bk.......','...kkk.kkk......','................'];
export const A_CHIBI_SIDE=[
'................','.....HHHh.......','....HhhhhH......','....Hffffh......',
'....Hfkff.......','....Hffffh......','.....kffk.......','.....kcck.......',
'....kcccck......','....kccccf......','....kcccck......','.....kbbk.......',
'.....kbbk.......','....kb.bk.......','...kkk.kkk......','................'];
export const A_STAFF=[
'................','......kk........','.....kcCk.......','....kcooCk......',
'.....kcCk.......','......kbk.......','......kbk.......','......kbk.......',
'......kbk.......','......kbk.......','......kbk.......','......kbk.......',
'......kbk.......','......kbk.......','......kk........','................'];
export const A_FACE=[
'....HHHHHH......','...HhhhhhhH.....','...HffffffH.....','...hffffffh.....',
'...hffffffh.....','...hffffffh.....','...hffffffh.....','...hffffffh.....',
'....hffffh......','.....kffk.......','....kccck.......','...kccccck......'];
export const A_STAR=['...kk...','...kk...','.kkkkkk.','..kkkk..','..kkkk..','.kk..kk.','........','........'];
export const A_ARROW=['...k....','..kkk...','.kkkkk..','...k....','...k....','...k....','...k....','........'];
export const A_PLUS=['........','...kk...','...kk...','.kkkkkk.','.kkkkkk.','...kk...','...kk...','........'];

/* --- bộ phận rời & lắp ghép (dùng cho Chặng 6) --- */
export const P_HEAD =['.HHHh..','HhhhhH.','Hffffh.','Hfkff..','Hffffh.','.kffk..'];   // 7×6
export const P_TORSO=['.kcck.','kcccck','kcccck','kcccck','.kcck.'];                  // 6×5
export const P_ARM  =['kck','kck','kck','kfk'];                                       // buông, vai ở đỉnh
export const P_ARM_DIA=['..kf','.kck','kck.','kk..'];                                 // chếch lên, vai ở đáy
export const P_ARM_UP =['kfk','kck','kck','kck'];                                     // giơ thẳng, vai ở đáy
export const ARMS={down:[P_ARM,0], dia:[P_ARM_DIA,-3], up:[P_ARM_UP,-3]};             // [hình, lệch để vai đứng yên]
export const P_LEG  =['kbk','kbk','kbk','kkk'];                                       // đứng, hông ở đỉnh
export const P_LEG_F=['kbk..','.kbk.','..kbk','..kkk'];                               // bước tới
export const P_LEG_B=['..kbk','.kbk.','kbk..','kkk..'];                               // đạp về sau
export const P_LEG_U=['kbk..','kbbk.','.kkk.','.....'];                               // co lên
export const LEGS={thang:[P_LEG,0], truoc:[P_LEG_F,0], sau:[P_LEG_B,-2], co:[P_LEG_U,0]};
/* katana chéo lên, chuôi ở góc dưới-trái */
export const P_KATANA=['.....S','....Sk','...Sk.','..Sk..','.bk...','bk....'];
export const FAR={c:'#3d7d8c', f:'#c8ae94', b:'#4a3020'};      // part phía xa: tối hơn một bậc
/* lắp 6 part lại; pose là các độ lệch pixel của từng part */
export function drawRig(g,ox,oy,pose){
  const P=Object.assign({hx:0,hy:0,ax:0,ay:0,fax:0,fay:0,lx:0,ly:0,flx:0,fly:0,ty:0,
                         arm:'down', legN:'thang', legF:'thang', sword:null}, pose||{});
  const A=ARMS[P.arm], LN=LEGS[P.legN], LF=LEGS[P.legF];
  art(g,P_ARM,  ox+3+P.fax, oy+6+P.fay+P.ty, null, FAR);
  art(g,LF[0],  ox+4+LF[1]+P.flx, oy+9+P.fly, null, FAR);
  art(g,LN[0],  ox+7+LN[1]+P.lx,  oy+9+P.ly);
  art(g,P_TORSO,ox+4,       oy+5+P.ty);
  art(g,P_HEAD, ox+3+P.hx,  oy+P.hy+P.ty);
  art(g,A[0],   ox+8+P.ax,  oy+6+A[1]+P.ay+P.ty);
  if(P.sword) art(g,P_KATANA, ox+P.sword[0], oy+P.sword[1]);
}
export function drawCleanup(g,ox,oy,done){
  drawRig(g,ox,oy);
  if(done) for(let y=6;y<10;y++) px(g,ox+8,oy+y,PAL.C);   // viền trong → sắc tối, viền ngoài giữ nguyên
}
/* tóc trễ một khung so với thân */
export function drawHairLag(g,ox,oy,lag){
  drawRig(g,ox,oy,{ty:1});
  const hy = lag ? 0 : 1;
  px(g,ox+2,oy+1+hy,PAL.H); px(g,ox+2,oy+2+hy,PAL.H);
  px(g,ox+1,oy+2+hy,PAL.H); px(g,ox+1,oy+3+hy,PAL.h);
}
/* đường đi của bàn tay: gãy thẳng hay lượn cung */
export function handPath(g,w,h,curve){
  for(let i=0;i<6;i++){
    const t=i/5, x=Math.round(1+t*(w-3));
    const y = curve ? Math.round(h-2-Math.sin(t*Math.PI)*(h-4)) : Math.round(h-2-t*(h-4));
    px(g,x,y, i===5?'#ffb43f':TH.mid);
  }
}
/* nền trung tính để viền đen của part không chìm vào nền tối */
export function onBg(w,h,fn){ return g=>{ g.fillStyle=TH.mid; g.fillRect(0,0,w,h); fn(g); }; }
/* giãn cách khung: đều đặn (máy móc) hay có easing */
export function drawSpacing(g,w,h,even){
  for(let i=0;i<6;i++){
    const t=i/5, u = even ? t : (1-Math.cos(t*Math.PI))/2;
    drawShadow(g, 2+Math.round(u*(w-5)), Math.round(h/2), 1, 1, i===5?'#ffb43f':TH.mid);
  }
}

/* --- hình vẽ bằng công thức --- */
export function heartShape(g,ox,oy,size,cols){
  for(let y=0;y<size;y++) for(let x=0;x<size;x++){
    const u=(x+0.5)/size*2.6-1.3, v=1.15-(y+0.5)/size*2.3;
    const t=u*u+v*v-1;
    if(t*t*t - u*u*v*v*v <= 0){
      const shade = (x+y < size*0.75) ? cols[1] : (x+y > size*1.35 ? cols[2] : cols[0]);
      px(g,ox+x,oy+y,shade);
    }
  }
}
export function ringShape(g,ox,oy,size,inner,col){
  const c=(size-1)/2, r=size/2-0.5;
  for(let y=0;y<size;y++) for(let x=0;x<size;x++){
    const d=Math.hypot(x-c,y-c);
    if(d<=r && d>=inner) px(g,ox+x,oy+y,col);
  }
}
export function drawCyl(g,ox,oy,w,h,ramp){
  for(let y=0;y<h;y++) for(let x=0;x<w;x++){
    const t=1-Math.abs((x-w*0.32)/(w*0.9));
    let i=Math.max(0,Math.min(ramp.length-1,Math.round(t*(ramp.length-1))));
    if(y<2 || y>h-3) i=Math.max(0,i-1);
    px(g,ox+x,oy+y+3,ramp[i]);
  }
  for(let y=0;y<6;y++) for(let x=0;x<w;x++){
    const u=(x-(w-1)/2)/(w/2), v=(y-2.5)/3;
    if(u*u+v*v<=1) px(g,ox+x,oy+y,ramp[ramp.length-1]);
  }
}
export function drawBox(g,ox,oy,w,h,dp,ramp){
  for(let j=0;j<dp;j++) for(let i=0;i<w;i++) px(g,ox+(dp-j)+i, oy+j, ramp[4]);
  for(let y=0;y<h;y++) for(let x=0;x<w;x++) px(g,ox+x, oy+dp+y, ramp[2]);
  for(let i=0;i<dp;i++) for(let y=0;y<h;y++) px(g,ox+w+i, oy+dp+y-(i+1), ramp[1]);
}
export function drawShadow(g,cx,cy,rx,ry,col){
  for(let y=-ry;y<=ry;y++) for(let x=-rx;x<=rx;x++){
    if((x/rx)*(x/rx)+(y/ry)*(y/ry)<=1) px(g,cx+x,cy+y,col);
  }
}
/* 5 chất liệu trên cùng một khối cầu */
export const MATS={
  metal:['#20242e','#4a5566','#8c99ab','#c9d4e0','#ffffff'],
  wood: ['#2b1a10','#5a3620','#8a5630','#b57c46','#d8a86a'],
  stone:['#26262e','#43434f','#63636f','#85858f','#a8a8b0'],
  cloth:['#3a2140','#5e3358','#8a4a6a','#b06a7e','#cf8f96'],
  glass:['#10333d','#1b5566','#2f8fa3','#7fd4de','#e6ffff']
};
export function drawMaterial(g,ox,oy,size,kind){
  const ramp=MATS[kind];
  const r=size/2-0.5, c=(size-1)/2;
  for(let y=0;y<size;y++) for(let x=0;x<size;x++){
    const dx=x-c, dy=y-c, d=Math.hypot(dx,dy);
    if(d>r+0.15) continue;
    const nz=Math.sqrt(Math.max(0,r*r-dx*dx-dy*dy))/r;
    let t=((dx/r)*-0.52+(dy/r)*-0.62+nz*0.58+0.30)/1.15;
    if(kind==='metal') t = t<0.45 ? t*0.5 : t*1.35;                       // tương phản gắt
    if(kind==='cloth') t = 0.28+t*0.55;                                   // êm
    if(kind==='stone') t += (hash01(x*3,y*5)-0.5)*0.28;                   // nhiễu
    if(kind==='wood')  t += Math.sin(x*1.6)*0.10;                         // vân dọc
    if(kind==='glass') t = Math.max(t*0.5, (d>r-1.6?0.95:t*0.35));        // sáng viền
    const i=Math.max(0,Math.min(4,Math.floor(t*5)));
    px(g,ox+x,oy+y,ramp[i]);
  }
  if(kind==='metal'||kind==='glass'){ px(g,ox+Math.round(c-2),oy+Math.round(c-3),'#ffffff'); px(g,ox+Math.round(c-1),oy+Math.round(c-3),'#ffffff'); }
}
/* cây trồng 5 giai đoạn */
export function drawCrop(g,ox,oy,stage){
  const base=13;
  px(g,ox+7,oy+base+1,PAL.B); px(g,ox+8,oy+base+1,PAL.B); px(g,ox+6,oy+base+1,PAL.B);
  if(stage===0){ px(g,ox+7,oy+base,PAL.d); px(g,ox+8,oy+base-1,PAL.G); px(g,ox+6,oy+base-1,PAL.G); return; }
  const hgt=[0,3,6,8,8][stage];
  for(let i=0;i<hgt;i++) px(g,ox+7,oy+base-i,PAL.d);
  if(stage>=1){ px(g,ox+5,oy+base-2,PAL.G); px(g,ox+6,oy+base-2,PAL.g); px(g,ox+9,oy+base-3,PAL.G); px(g,ox+8,oy+base-3,PAL.g); }
  if(stage>=2){ px(g,ox+4,oy+base-5,PAL.G); px(g,ox+5,oy+base-5,PAL.g); px(g,ox+10,oy+base-6,PAL.G); px(g,ox+9,oy+base-6,PAL.g); }
  if(stage===3){ px(g,ox+6,oy+base-9,PAL.w); px(g,ox+7,oy+base-10,PAL.w); px(g,ox+8,oy+base-9,PAL.w); px(g,ox+7,oy+base-9,PAL.y); }
  if(stage===4){ drawShadow(g,ox+7,oy+base-9,2,2,PAL.r); px(g,ox+7,oy+base-11,PAL.G); px(g,ox+6,oy+base-10,PAL.R); }
}
/* nhân vật đi bộ: đổi 3 hàng chân theo pha */
export function drawWalk(g,ox,oy,phase){
  art(g,A_CHIBI_SIDE,ox,oy);
  for(let y=11;y<15;y++) for(let x=0;x<16;x++) px(g,ox+x,oy+y,TH.demoBg);
  const legs=[
    ['.....kbbk.......','.....kbbk.......','....kb..bk......','...kkk..kkk.....'],
    ['.....kbbk.......','.....kbbk.......','.....kbbk.......','....kkkk........'],
    ['.....kbbk.......','....kbbbk.......','...kb...bk......','..kkk....kkk....'],
    ['.....kbbk.......','.....kbbk.......','.....kbbk.......','.....kkkk.......']
  ][phase];
  art(g,legs,ox,oy+11);
}
/* biểu đồ nhịp khung hình */
export function drawTiming(g,w,h,even){
  const spans = even ? [5,5,5,5,5] : [8,4,1,2,10];
  const cols=[TH.mid,TH.mid,'#ffb43f','#ff5c8a',TH.mid];
  let x=0;
  spans.forEach((sp,i)=>{
    for(let j=0;j<sp && x<w;j++,x++){
      for(let y=2;y<h-2;y++) px(g,x,y, j===0 ? TH.ink : cols[i]);
    }
  });
}
/* vụ nổ: 1 khung theo thời điểm t */
export function drawBoom(g,ox,oy,size,t){
  const c=(size-1)/2, R=(0.25+t*0.75)*(size/2);
  const cols = t<0.3 ? ['#fff6e0','#f2c14e'] : (t<0.6 ? ['#f2c14e','#e88a5a'] : ['#8595a1','#566c86']);
  for(let y=0;y<size;y++) for(let x=0;x<size;x++){
    const d=Math.hypot(x-c,y-c)+ (hash01(x*2+t*10,y*3)-0.5)*2.2;
    if(d<=R*0.55) px(g,ox+x,oy+y,cols[0]);
    else if(d<=R) px(g,ox+x,oy+y,cols[1]);
  }
}
/* 3 lớp nền xa - giữa - gần */
export function drawParallax(g,w,h,layer){
  const cols=[['#8fa8c4','#7b95b4'],['#4d6f74','#3d5b60'],['#22343a','#2f4a45']][layer];
  const amp=[3,5,7][layer], base=[6,9,12][layer];
  for(let x=0;x<w;x++){
    const top = base - Math.round(Math.sin(x*0.5+layer)*amp*0.5 + Math.sin(x*0.17+layer*2)*amp*0.5);
    for(let y=top;y<h;y++) px(g,x,y, y===top?cols[0]:cols[1]);
  }
}
/* bộ 9 ô đất trong cỏ */
export function drawTile9(g){
  const T=10;
  for(let ty=0;ty<3;ty++) for(let tx=0;tx<3;tx++)
    for(let y=0;y<T;y++) for(let x=0;x<T;x++){
      const gx=tx*T+x, gy=ty*T+y;
      const edgeL=(tx===0&&x<2), edgeR=(tx===2&&x>=T-2), edgeT=(ty===0&&y<2), edgeB=(ty===2&&y>=T-2);
      let c = (edgeL||edgeR||edgeT||edgeB) ? (hash01(gx,gy)<0.4?'#5d9c3c':'#8ab547') : (hash01(gx,gy)<0.3?'#8a5630':'#a06534');
      px(g,gx,gy,c);
      if(x===0 || y===0) px(g,gx,gy, (edgeL||edgeR||edgeT||edgeB) ? '#46783a' : '#6f4526');
    }
}

export function drawFace(g,ox,mood){
  art(g,A_FACE,ox,0);
  const K=PAL.k;
  px(g,ox+5,5,K); px(g,ox+9,5,K);                       // mắt
  if(mood==='vui'){
    px(g,ox+4,3,PAL.H); px(g,ox+5,3,PAL.H); px(g,ox+9,3,PAL.H); px(g,ox+10,3,PAL.H);
    px(g,ox+5,7,K); px(g,ox+6,8,K); px(g,ox+7,8,K); px(g,ox+8,8,K); px(g,ox+9,7,K);
  }else if(mood==='giận'){
    px(g,ox+4,4,PAL.H); px(g,ox+5,4,PAL.H); px(g,ox+6,5,PAL.H);
    px(g,ox+8,5,PAL.H); px(g,ox+9,4,PAL.H); px(g,ox+10,4,PAL.H);
    px(g,ox+5,8,K); px(g,ox+6,7,K); px(g,ox+7,7,K); px(g,ox+8,7,K); px(g,ox+9,8,K);
  }else{
    px(g,ox+4,4,PAL.H); px(g,ox+5,4,PAL.H); px(g,ox+9,4,PAL.H); px(g,ox+10,4,PAL.H);
    px(g,ox+6,7,K); px(g,ox+7,7,K); px(g,ox+8,7,K);
  }
}
export function drawApple(g,ox,oy){
  drawSphere(g,ox,oy,13,['#5c1b22','#8c2f39','#c94f4f','#e07a6a','#f2a894'],false);
  px(g,ox+6,oy-1,PAL.B); px(g,ox+6,oy-2,PAL.B); px(g,ox+7,oy-2,PAL.G); px(g,ox+8,oy-3,PAL.G);
}
export function drawBread(g,ox,oy){
  for(let y=0;y<9;y++) for(let x=0;x<15;x++){
    const u=(x-7)/7.4, v=(y-4.5)/4.6;
    if(u*u+v*v<=1){
      let c = y<3 ? '#d8a86a' : (y<6 ? '#b57c46' : '#8a5630');
      if(y<2 && (x%4)===1) c='#efdcc0';
      px(g,ox+x,oy+y,c);
    }
  }
}
export function drawHouse(g,ox,oy){
  for(let y=0;y<7;y++){ const w=3+y*3; for(let x=0;x<w;x++) px(g,ox+11-Math.floor(w/2)+x, oy+y, y===0?'#8c2f39':(x<2?'#c94f4f':'#8c2f39')); }
  for(let y=7;y<18;y++) for(let x=3;x<20;x++) px(g,ox+x,oy+y, x<5?'#6b4423':(x>17?'#3d2b1f':'#a06534'));
  for(let y=11;y<18;y++) for(let x=9;x<14;x++) px(g,ox+x,oy+y,'#3d2b1f');
  for(let y=9;y<13;y++) for(let x=5;x<8;x++) px(g,ox+x,oy+y,'#63bcd1');
  for(let y=9;y<13;y++) for(let x=15;x<18;x++) px(g,ox+x,oy+y,'#63bcd1');
}
export function drawFrame(g,w,h,messy){
  for(let x=1;x<w-1;x++){ px(g,x,1,TH.ink); px(g,x,h-2,TH.ink); }
  for(let y=1;y<h-1;y++){ px(g,1,y,TH.ink); px(g,w-2,y,TH.ink); }
  if(messy){
    for(let x=4;x<9;x++) px(g,x,2,TH.bad);
    for(let y=4;y<8;y++) px(g,2,y,TH.bad);
    px(g,w-3,h-3,TH.bad); px(g,w-4,h-3,TH.bad); px(g,w-3,h-4,TH.bad);
  }
}
export function drawSoft(g,size,soft){
  const c=(size-1)/2, r=size/2-1;
  for(let y=0;y<size;y++) for(let x=0;x<size;x++){
    const d=Math.hypot(x-c,y-c);
    if(soft){
      const a=Math.max(0,1-d/r);
      if(a>0){ g.fillStyle='rgba(255,180,63,'+(a*a).toFixed(2)+')'; g.fillRect(x,y,1,1); }
    }else if(d<=r) px(g,x,y,'#ffb43f');
  }
}

/* =======================================================================
   GÓC NHÌN NGANG (side view) — nhân vật hành động & tile nền
   ======================================================================= */

/* --- bộ động tác: mỗi khung chỉ là một tập độ lệch của các part --- */
export const RUN_POSES=[
  {legN:'truoc', legF:'sau',   ty:0,  arm:'dia'},
  {legN:'thang', legF:'co',    ty:1,  arm:'down'},
  {legN:'co',    legF:'thang', ty:0,  arm:'down'},
  {legN:'sau',   legF:'truoc', ty:-1, arm:'dia'},
  {legN:'sau',   legF:'truoc', ty:0,  arm:'down'},
  {legN:'co',    legF:'thang', ty:1,  arm:'down'},
  {legN:'thang', legF:'co',    ty:0,  arm:'dia'},
  {legN:'truoc', legF:'sau',   ty:-1, arm:'dia'}
];
export const JUMP_POSES=[
  {legN:'co',    legF:'co',    ty:2,  arm:'down'},   // nhún lấy đà
  {legN:'sau',   legF:'sau',   ty:-2, arm:'up'},     // bật lên
  {legN:'co',    legF:'co',    ty:-3, arm:'up'},     // đỉnh
  {legN:'truoc', legF:'sau',   ty:-2, arm:'dia'},    // rơi
  {legN:'truoc', legF:'sau',   ty:3,  arm:'down'}    // tiếp đất
];
/* vệt chém: một cung hai màu quanh tâm xoay của lưỡi kiếm */
export function slashArc(g,cx,cy,r,a0,a1,cols){
  for(let a=a0;a<=a1;a+=0.04){
    const c=Math.cos(a), s=Math.sin(a);
    px(g, Math.round(cx+c*r),     Math.round(cy+s*r),     cols[0]);
    px(g, Math.round(cx+c*(r-1)), Math.round(cy+s*(r-1)), cols[1]);
  }
}
/* một khung của combo chém: lấy đà → bung (có vệt) → chạm → thu */
export function drawSlash(g,ox,oy,phase){
  const P=[
    {pose:{legN:'sau',legF:'truoc',ty:1,arm:'up'},    sword:[9,1]},
    {pose:{legN:'truoc',legF:'sau',ty:0,arm:'dia'},   sword:[10,4], arc:[11,8,7,-1.5,0.2]},
    {pose:{legN:'truoc',legF:'sau',ty:1,arm:'down'},  sword:[10,8], arc:[11,9,5,-0.6,1.2]},
    {pose:{legN:'thang',legF:'thang',ty:0,arm:'down'},sword:[10,7]}
  ][phase];
  drawRig(g,ox,oy,Object.assign({sword:P.sword},P.pose));
  if(P.arc) slashArc(g, ox+P.arc[0], oy+P.arc[1], P.arc[2], P.arc[3], P.arc[4], ['#fff6e0','#e88a5a']);
}
/* khung nhoè (smear): kéo dài lưỡi kiếm thành vệt, chỉ hiện 1/12 giây */
export function drawSmear(g,ox,oy,on){
  drawRig(g,ox,oy,{legN:'truoc',legF:'sau',arm:'dia',sword:on?null:[10,4]});
  if(on){
    slashArc(g,ox+10,oy+7,7,-1.7,0.5,['#fff6e0','#e88a5a']);
    slashArc(g,ox+10,oy+7,5,-1.4,0.2,['#e88a5a','#8c2f39']);
  }
}

/* --- tile nền nhìn ngang --- */
export const GROUND={g1:'#8ab547',g2:'#5d9c3c',g3:'#356b30',
                     d1:'#a06534',d2:'#8a5630',d3:'#6b4423',d4:'#43290f'};
/* vol=false: hai màu phẳng như nhìn từ trên xuống — sai với góc nhìn ngang */
export function sideGround(g,ox,oy,w,h,vol){
  for(let y=0;y<h;y++) for(let x=0;x<w;x++){
    let c;
    if(!vol){ c = y<3 ? GROUND.g2 : GROUND.d2; }
    else if(y===0) c=GROUND.g1;
    else if(y===1) c = hash01(ox+x,7)>0.4 ? GROUND.g2 : GROUND.g1;
    else if(y===2) c = hash01(x*2,y*3)>0.45 ? GROUND.g3 : GROUND.g2;
    else{
      const t=(y-3)/Math.max(1,h-4);
      c = t<0.2?GROUND.d1 : t<0.55?GROUND.d2 : t<0.85?GROUND.d3 : GROUND.d4;
      if(hash01(x*5+ox,y*7)>0.9) c=GROUND.d1;                   // sạn đá
      if(y===3 && hash01(x*3,1)>0.6) c=GROUND.d1;               // rễ cỏ ăn xuống
    }
    px(g,ox+x,oy+y,c);
  }
}
/* cảnh nhỏ: nền xa, mặt đất, bệ lơ lửng, dốc bậc — và nhân vật đứng đúng mốc chân */
export function sideScene(g,w,h){
  for(let x=0;x<w;x++){                                          // đồi xa, nhạt và ngả lam
    const top = h-16-Math.round(3+Math.sin(x*0.22)*2+Math.sin(x*0.07)*2);
    for(let y=top;y<h-16;y++) px(g,x,y, y===top?'#5d7f8c':'#46626e');
  }
  sideGround(g,0,h-16,w,16,true);                                // mặt đất chính
  sideGround(g,4,h-27,13,7,true);                                // bệ lơ lửng
  for(let s=0;s<4;s++) sideGround(g, w-16+s*4, h-16-(s+1)*3, 4, 3+(s+1)*3, true);  // dốc bậc
  drawRig(g,20,h-30);                                            // chân chạm đúng mặt đất
}
/* mép bệ: bo tròn và cỏ rủ xuống hay cắt vuông như miếng gạch */
export function platformEdge(g,ox,oy,w,h,soft){
  sideGround(g,ox,oy,w,h,true);
  if(!soft) return;
  px(g,ox,oy,PAL.k); px(g,ox+w-1,oy,PAL.k);                      // bo hai góc trên
  for(const x of [1,3,w-4,w-2]){                                 // cỏ rủ xuống mép
    px(g,ox+x,oy+3,GROUND.g2); px(g,ox+x,oy+4,GROUND.g3);
  }
}
/* tư thế thủ + 4 đường mốc tỉ lệ (đỉnh đầu · vai · hông · mặt đất) */
export function drawSideProp(g,w,h,guides){
  if(guides) for(const y of [3,8,12,16]) for(let x=0;x<w;x+=2) px(g,x,y,TH.mid);
  drawRig(g,1,3,{sword:[10,7]});
}

/* =======================================================================
   PHONG CÁCH TERRARIA — khối, tường, quặng, vật phẩm
   Đặc điểm nhận dạng: khối KHÔNG có viền đen bao quanh (vì khối nào cũng
   kề khối khác), sạn nhiễu dày, sáng ở mép trên tối dần xuống đáy.
   Vật phẩm thì ngược lại: viền đen kín, vì nó nằm trên nền bất kỳ.
   ======================================================================= */
export const TERRA={
  stone:['#33333d','#454551','#5a5a68','#74747f'],
  dirt: ['#33200f','#4a2f18','#63401f','#7d5329'],
  grass:['#245018','#356f22','#4a9130'],
  wood: ['#33220f','#4d3418','#6b4a24','#8a6231'],
  gold: ['#6b4a12','#a8791f','#dcae35','#ffe07a'],
  copper:['#5c2e14','#8f4a20','#c26e33','#e59c5e']
};
/* flat=true là kiểu SAI hay gặp: viền đen kín quanh khối, ruột phẳng lì */
export function terraBlock(g,ox,oy,s,kind,flat){
  const r=TERRA[kind]||TERRA.stone, K='#14101a';
  for(let y=0;y<s;y++) for(let x=0;x<s;x++){
    let c;
    if(flat){
      c = (x===0||y===0||x===s-1||y===s-1) ? K : r[2];
    }else{
      const t=y/s;
      let i = t<0.12 ? 3 : t<0.42 ? 2 : t<0.78 ? 1 : 0;
      const n=hash01(ox+x*3, oy+y*5);
      if(n>0.85) i=Math.min(r.length-1,i+1);
      else if(n<0.13) i=Math.max(0,i-1);
      c=r[i];
    }
    px(g,ox+x,oy+y,c);
  }
}
/* khối đất có cỏ phủ mép trên, viền cỏ nhấp nhô ngẫu nhiên */
export function terraGrass(g,ox,oy,s){
  terraBlock(g,ox,oy,s,'dirt');
  for(let x=0;x<s;x++){
    const h=2+Math.round(hash01(ox+x,3)*2);
    for(let y=0;y<h;y++) px(g,ox+x,oy+y, y===0?TERRA.grass[2]:TERRA.grass[1]);
    if(hash01(x,9)>0.7) px(g,ox+x,oy+h,TERRA.grass[0]);
  }
}
/* tường lát phía sau: cùng vật liệu nhưng lùi ra sau — tối hơn, tương phản thấp */
export function terraWall(g,ox,oy,s){
  for(let y=0;y<s;y++) for(let x=0;x<s;x++){
    const n=hash01(ox+x*2,y*3);
    px(g,ox+x,oy+y, n>0.68?'#2b2b34' : n>0.32?'#24242c' : '#1e1e25');
  }
  const m=Math.floor(s/2);
  for(let x=0;x<s;x++) px(g,ox+x,oy+m,'#191920');
  for(let y=0;y<s;y++) px(g,ox+(y<m?m:0),oy+y,'#191920');
}
/* quặng nhúng trong đá: cụm 3–4 pixel, có một chấm sáng nhất */
export function terraOre(g,ox,oy,s,kind){
  const c=TERRA[kind]||TERRA.gold;
  terraBlock(g,ox,oy,s,'stone');
  // vị trí cụm theo tỉ lệ khổ, nên ở 16×16 vẫn đủ ba cụm chứ không rơi hết ra ngoài
  const cum=[[0.22,0.30],[0.28,0.25],[0.56,0.54],[0.62,0.50],[0.70,0.22],[0.38,0.72]];
  cum.forEach(([u,v],i)=>{
    const x=Math.round(u*(s-3)), y=Math.round(v*(s-3));
    px(g,ox+x,oy+y,c[2]); px(g,ox+x+1,oy+y,c[1]); px(g,ox+x,oy+y+1,c[1]);
    if(i%2===0 && y>0) px(g,ox+x,oy+y-1,c[3]);
  });
}
/* vật phẩm nằm chéo 45° — dáng chuẩn của kiếm/cuốc trong Terraria */
export function terraSword(g,ox,oy,s,noOutline){
  const K='#14101a', BL=['#5a5a68','#8f8f9c','#c2c3c7','#eef0f5'];
  const put=(x,y,c)=>{ if(x>=0&&y>=0&&x<s&&y<s) px(g,ox+x,oy+y,c); };
  const n=s-10;
  for(let i=0;i<n;i++){                       // lưỡi đi chéo lên-phải
    const x=5+i, y=s-6-i;
    put(x,y,BL[2]); put(x+1,y,BL[1]); put(x,y-1,BL[3]);
    if(!noOutline){ put(x+1,y-1,K); put(x-1,y,K); put(x,y+1,K); }
  }
  put(5+n,s-6-n,BL[3]); put(6+n,s-7-n,BL[3]);  // mũi kiếm
  for(let i=-2;i<=2;i++){                      // chắn tay
    put(4+i,s-5+i,'#a8791f'); put(5+i,s-4+i,'#6b4a12');
  }
  for(let i=0;i<4;i++) put(3-i,s-4+i,'#4d3418'); // cán
  if(!noOutline) for(let i=0;i<5;i++) put(2-i,s-3+i,K);
}
/* thanh kim loại (bar) — vật phẩm chế tạo cơ bản nhất của Terraria */
export function terraBar(g,ox,oy,kind){
  const c=TERRA[kind]||TERRA.copper, K='#14101a';
  for(let y=0;y<7;y++) for(let x=0;x<14;x++){
    const inTop = y<3 && x>=y && x<14-y;
    const inBody= y>=3 && x>=1 && x<13;
    if(!inTop && !inBody) continue;
    px(g,ox+x,oy+y, y<2 ? c[3] : y<4 ? c[2] : y<6 ? c[1] : c[0]);
  }
  for(let x=0;x<14;x++){ px(g,ox+x,oy+7,K); }
  for(let y=0;y<7;y++){ px(g,ox+0,oy+y,K); px(g,ox+13,oy+y,K); }
}

/* --- hình mẫu bù cho các bài Terraria còn thiếu --- */
export function terraWood(g,ox,oy,kind,s){
  const w=TERRA.wood, S=s||32, m=S/32;
  const r=v=>Math.max(1,Math.round(v*m));
  if(kind==='van'){                                   // ván gỗ: vân dọc, mối ghép so le
    for(let y=0;y<S;y++) for(let x=0;x<S;x++){
      let i = y<r(2) ? 3 : y>S-r(3) ? 0 : 2;
      if(Math.sin(x*1.7/m)>0.55) i=Math.max(0,i-1);
      px(g,ox+x,oy+y,w[i]);
    }
    const h1=r(10), h2=r(21);
    for(let x=0;x<S;x++){ px(g,ox+x,oy+h1,w[0]); px(g,ox+x,oy+h2,w[0]); }
    for(let y=0;y<h1;y++)    px(g,ox+r(11),oy+y,w[0]);
    for(let y=h1+1;y<h2;y++) px(g,ox+r(22),oy+y,w[0]);
    for(let y=h2+1;y<S;y++)  px(g,ox+r(7), oy+y,w[0]);
  }else if(kind==='than'){                            // thân cây: khối tròn nhìn ngang
    for(let y=0;y<S;y++) for(let x=0;x<S;x++){
      const t=1-Math.abs((x-S*0.34)/(S*0.53));
      let i=Math.max(0,Math.min(3,Math.round(t*3)));
      if(hash01(x*3,y*7)>0.88) i=Math.max(0,i-1);
      px(g,ox+x,oy+y,w[i]);
    }
  }else{                                              // tán lá: có lỗ hở thấy nền
    const L=TERRA.grass;
    for(let y=0;y<S;y++) for(let x=0;x<S;x++){
      const n=hash01(x*2.3,y*1.9);
      if(n<0.12) continue;                            // lỗ hở
      px(g,ox+x,oy+y, n>0.72 ? L[2] : n>0.35 ? L[1] : L[0]);
    }
  }
}
/* cuốc và rìu: đầu kim loại gắn vào cán gỗ chéo 45° */
export function terraTool(g,ox,oy,s,axe){
  const K='#14101a', M=['#5a5a68','#8f8f9c','#c2c3c7'], W=TERRA.wood;
  const put=(x,y,c)=>{ if(x>=0&&y>=0&&x<s&&y<s) px(g,ox+x,oy+y,c); };
  for(let i=0;i<s-10;i++){                            // cán gỗ
    const x=4+i, y=s-5-i;
    put(x,y,W[2]); put(x+1,y,W[1]);
    put(x,y-1,K); put(x+1,y+1,K);
  }
  const hx=s-7, hy=6;
  if(axe){
    for(let y=0;y<9;y++) for(let x=0;x<7;x++){
      const t=(x+y*0.4)/9;
      if(x>4 && y>2 && y<6) continue;
      put(hx-4+x, hy+y, t<0.35?M[0]:t<0.7?M[1]:M[2]);
    }
  }else{
    for(let x=-6;x<=6;x++){
      const y=hy+Math.round(Math.abs(x)*0.55);
      put(hx+x,y,M[2]); put(hx+x,y+1,M[1]); put(hx+x,y+2,M[0]);
    }
  }
  for(let x=-1;x<=2;x++) for(let y=0;y<3;y++) put(hx+x-1,hy+7+y,K);   // đai buộc
}
/* nhân vật đứng cạnh lưới khối 16px, cho thấy cao đúng mấy khối */
export function terraChar(g,w,h){
  for(let y=0;y<h;y++) for(let x=0;x<w;x++)
    px(g,x,y, (x%16<1||y%16<1) ? '#242430' : '#1a1a22');
  drawRig(g, Math.floor(w/2)-7, h-14-2);
}
/* bốn khung đi, vẽ trên nền lưới khối */
export function terraWalk(g,w,h,i){
  for(let y=0;y<h;y++) for(let x=0;x<w;x++)
    px(g,x,y, (x%16<1||y%16<1) ? '#242430' : '#1a1a22');
  drawRig(g, Math.floor(w/2)-7, h-14-2, RUN_POSES[i*2]);
}
/* slime: nén rồi bật, thân trong suốt thấy nền */
export function terraSlime(g,ox,oy,s,phase){
  const body=['#2b5a2e','#3f8a44','#5cb862','#8fe08f'];
  const kx=[1.0,1.22,0.86][phase], ky=[1.0,0.72,1.24][phase];
  const rw=Math.round(9*kx), rh=Math.round(8*ky);
  const cx=s/2, cy=s-2-rh;
  for(let y=0;y<s;y++) for(let x=0;x<s;x++){
    const u=(x-cx)/rw, v=(y-cy)/rh;
    const d=u*u+v*v;
    if(d>1) continue;
    const rim = d>0.72;
    let i = rim ? 2 : (y-cy)/rh < -0.25 ? 1 : 0;
    px(g,ox+x,oy+y, body[i]);
  }
  px(g,ox+Math.round(cx-rw*0.45),oy+Math.round(cy-rh*0.45),body[3]);   // đốm sáng
  px(g,ox+Math.round(cx-rw*0.3), oy+Math.round(cy-rh*0.45),body[3]);
  px(g,ox+Math.round(cx+1),oy+Math.round(cy+rh*0.3),'#dcae35');        // đồng xu bên trong
  px(g,ox+Math.round(cx+2),oy+Math.round(cy+rh*0.3),'#a8791f');
}
/* tilesheet: các ô cách nhau đúng 2px như Terraria yêu cầu */
export function terraSheet(g,w,h){
  g.fillStyle='#0f0f16'; g.fillRect(0,0,w,h);
  const T=16, gap=2;
  for(let r=0;r<2;r++) for(let c=0;c<3;c++){
    const ox=1+c*(T+gap), oy=1+r*(T+gap);
    if(r===0&&c===0) terraGrass(g,ox,oy,T);
    else if(r===0&&c===1) terraBlock(g,ox,oy,T,'dirt');
    else if(r===0&&c===2) terraOre(g,ox,oy,T,'gold');
    else if(r===1&&c===0) terraBlock(g,ox,oy,T,'stone');
    else if(r===1&&c===1) terraWall(g,ox,oy,T);
    else terraBlock(g,ox,oy,T,'wood');
  }
}
/* cả bộ đặt trên nền hang tối — phép thử cuối của lộ trình */
export function terraSet(g,w,h){
  g.fillStyle='#0d0d13'; g.fillRect(0,0,w,h);
  terraGrass(g,2,2,16); terraBlock(g,20,2,16,'stone'); terraOre(g,38,2,16,'copper');
  terraWall(g,56,2,16);
  terraBar(g,3,22,'gold'); terraBar(g,21,22,'copper');
  terraSword(g,38,20,20); 
  drawRig(g,60,20);
}

/* =======================================================================
   NGƯỜI QUE — học chuyển động khi đã bỏ hết màu và khối
   Bộ xương dựng bằng góc khớp, nên mọi hình minh hoạ dưới đây đều là một
   tư thế thật chứ không phải hình vẽ tay: đổi vài con số là ra khung khác.
   Góc tính theo độ, 0° là hướng sang phải, 90° là hướng xuống.
   ======================================================================= */
const DEG=Math.PI/180;
function segLine(g,x0,y0,x1,y1,c){          // Bresenham, vẽ nét dày 1 pixel
  x0=Math.round(x0); y0=Math.round(y0); x1=Math.round(x1); y1=Math.round(y1);
  let dx=Math.abs(x1-x0), dy=Math.abs(y1-y0);
  let sx=x0<x1?1:-1, sy=y0<y1?1:-1, err=dx-dy;
  for(;;){
    px(g,x0,y0,c);
    if(x0===x1&&y0===y1) break;
    const e2=2*err;
    if(e2>-dy){ err-=dy; x0+=sx; }
    if(e2<dx){ err+=dx; y0+=sy; }
  }
}
function chain(x,y,segs){                    // nối các đoạn theo góc, trả về danh sách khớp
  const pts=[[x,y]]; let cx=x, cy=y;
  segs.forEach(([len,a])=>{ cx+=Math.cos(a*DEG)*len; cy+=Math.sin(a*DEG)*len; pts.push([cx,cy]); });
  return pts;
}
function ring(g,cx,cy,r,c){
  for(let a=0;a<360;a+=12) px(g, Math.round(cx+Math.cos(a*DEG)*r), Math.round(cy+Math.sin(a*DEG)*r), c);
}
export const STICK_COL={ nguoi:'#e8e8f2', mo:'#5a5a70', khop:'#ffb43f', cung:'#58d5ff' };

/* p: {x,y} hông · spine · tayA/tayB [góc trên, góc dưới] · chanA/chanB · dai (tỉ lệ kéo dài) */
export function stickman(g,ox,oy,p){
  const P=Object.assign({
    x:12, y:21, spine:-90, dai:1, col:STICK_COL.nguoi, khop:false,
    tayA:[64,76], tayB:[116,100], chanA:[75,85], chanB:[105,95]
  }, p||{});
  const L=(v)=>v*P.dai;
  const [hip, neck] = chain(ox+P.x, oy+P.y, [[L(9), P.spine]]);
  const headC = chain(neck[0],neck[1], [[L(4), P.spine]])[1];
  segLine(g,hip[0],hip[1],neck[0],neck[1],P.col);            // cột sống
  ring(g, headC[0], headC[1], 3, P.col);                      // đầu
  const parts=[];
  [['tayA',6,5,neck],['tayB',6,5,neck],['chanA',7,7,hip],['chanB',7,7,hip]].forEach(([k,l1,l2,root])=>{
    const a=P[k];
    const pts=chain(root[0],root[1], [[L(l1),a[0]],[L(l2),a[1]]]);
    segLine(g,pts[0][0],pts[0][1],pts[1][0],pts[1][1],P.col);
    segLine(g,pts[1][0],pts[1][1],pts[2][0],pts[2][1],P.col);
    parts.push(pts);
  });
  if(P.khop){                                                 // chấm khớp: dạy chỗ được phép gập
    px(g,Math.round(hip[0]),Math.round(hip[1]),STICK_COL.khop);
    px(g,Math.round(neck[0]),Math.round(neck[1]),STICK_COL.khop);
    parts.forEach(pts=>px(g,Math.round(pts[1][0]),Math.round(pts[1][1]),STICK_COL.khop));
  }
  return {hip, neck, head:headC, parts};
}

/* ---- các tư thế dùng lại nhiều lần ---- */
export const STICK_WALK=[
  {chanA:[62,88],  chanB:[118,96], tayA:[115,102],tayB:[66,80], y:21},   // chạm đất
  {chanA:[80,92],  chanB:[104,120],tayA:[106,98], tayB:[76,86], y:22},   // hạ thấp
  {chanA:[92,95],  chanB:[86,128], tayA:[92,92],  tayB:[88,88],  y:20},   // lướt qua
  {chanA:[104,96], chanB:[70,92],  tayA:[70,82],  tayB:[110,98],  y:21}    // vươn lên
];
export const STICK_RUN=[
  {chanA:[45,80],  chanB:[135,70], tayA:[62,-18],  tayB:[122,200], y:20, spine:-82},
  {chanA:[75,110], chanB:[100,25], tayA:[85,10],   tayB:[105,185], y:23, spine:-80},
  {chanA:[125,72], chanB:[50,85],  tayA:[122,200], tayB:[62,-18],   y:20, spine:-82},
  {chanA:[100,20], chanB:[78,112], tayA:[105,185], tayB:[85,10],  y:23, spine:-80}
];
export const STICK_JUMP=[
  {chanA:[70,130], chanB:[110,50], tayA:[128,162],tayB:[122,158],   y:25, spine:-78, dai:0.9},  // nhún
  {chanA:[85,88],  chanB:[95,92],  tayA:[-56,-76], tayB:[-124,-104],y:18, spine:-95, dai:1.1}, // bật
  {chanA:[60,120], chanB:[120,60], tayA:[-135,-160],tayB:[-45,-20], y:16, spine:-90},           // đỉnh
  {chanA:[80,100], chanB:[110,88], tayA:[150,170], tayB:[30,10],y:19, spine:-86, dai:1.05}, // rơi
  {chanA:[68,128], chanB:[112,52], tayA:[60,20],   tayB:[74,34],y:26,spine:-74, dai:0.88}  // tiếp đất
];
export const STICK_PUNCH=[
  {tayA:[135,170], tayB:[85,55], chanA:[70,90], chanB:[112,96], spine:-96, x:11},   // lấy đà
  {tayA:[20,0],    tayB:[95,70],  chanA:[75,88], chanB:[108,94], spine:-90, x:12},   // bung
  {tayA:[5,-5],    tayB:[100,75], chanA:[80,86], chanB:[104,92], spine:-84, x:14},   // chạm
  {tayA:[60,25],   tayB:[90,65],chanA:[76,88], chanB:[106,94], spine:-88, x:12}    // thu
];

/* bóng nảy: giãn cách và squash — bài học đầu tiên của mọi khoá animation */
export function stickBall(g,w,h,deu){
  const n=7, dat=h-3, cao=h-8, nay=0.62;
  for(let i=0;i<n;i++){
    const x = 3+Math.round(i/(n-1)*(w-7));
    let len;                                   // độ cao so với mặt đất
    if(deu){                                   // chia đều → không có trọng lực
      len = i<=3 ? cao*(3-i)/3 : cao*nay*(i-3)/3;
    }else{                                     // parabol: rơi nhanh dần, lên chậm dần
      const f = i<=3 ? i/3 : (i-3)/3;
      len = i<=3 ? cao*(1-f*f) : cao*nay*(1-(1-f)*(1-f));
    }
    const y = Math.round(dat-len);
    const cham = !deu && i===3;                // chỉ khung chạm đất mới bẹt
    const rx = cham?3:2, ry = cham?1:2;
    for(let dy=-ry;dy<=ry;dy++) for(let dx=-rx;dx<=rx;dx++)
      if((dx/rx)**2+(dy/ry)**2<=1.05) px(g,x+dx,y+dy, i===3?STICK_COL.khop:STICK_COL.nguoi);
  }
  for(let x=0;x<w;x++) px(g,x,h-1,STICK_COL.mo);
}
/* quả lắc: cung tròn, chậm ở hai đầu */
export function stickPendulum(g,w,h,cung){
  const cx=w/2, cy=1;
  for(let i=0;i<7;i++){
    const t=i/6;
    const a = cung ? (-50+100*(1-Math.cos(t*Math.PI))/2) : (-50+100*t);
    const x=cx+Math.sin(a*DEG)*(h-5), y=cy+Math.cos(a*DEG)*(h-5);
    segLine(g,cx,cy,x,y, i===6?STICK_COL.cung:STICK_COL.mo);
    px(g,Math.round(x),Math.round(y), i===6?STICK_COL.khop:STICK_COL.nguoi);
  }
}
/* trọng lượng: cùng một cú nhảy, người nhẹ bay cao và nhanh, người nặng thấp và lâu */
export function stickWeight(g,w,h,nang){
  const n=5;
  for(let i=0;i<n;i++){
    const t=i/(n-1);
    const cao = nang ? 6 : 14;
    const y = h-16-Math.round(Math.sin(t*Math.PI)*cao);
    stickman(g, i*(w/n)+1, y-6, {
      dai: nang?0.92:1.05,
      spine: nang?-80:-92,
      chanA:[nang?70:60, nang?120:110], chanB:[nang?110:120, nang?60:50],
      tayA:[nang?104:-120, nang?134:-150], tayB:[nang?82:-58, nang?112:-28],
      col: i===n-1?STICK_COL.khop:STICK_COL.nguoi
    });
  }
  for(let x=0;x<w;x++) px(g,x,h-1,STICK_COL.mo);
}
/* đường trục: dáng có một đường cong xuyên suốt thì đọc được, dáng thẳng đơ thì không */
export function stickPose(g,ox,oy,kieu){
  if(kieu==='do'){                              // đứng thẳng đơ, tay chân đối xứng
    stickman(g,ox,oy,{spine:-90, tayA:[88,90], tayB:[92,90], chanA:[85,88], chanB:[95,92]});
  }else if(kieu==='vuon'){                      // vươn người, trục cong từ chân tới tay
    stickman(g,ox,oy,{spine:-100, tayA:[-48,-68], tayB:[-132,-146], chanA:[70,80], chanB:[100,110], y:22});
  }else{                                        // né người, trục cong ngược lại
    stickman(g,ox,oy,{spine:-72, tayA:[36,-14], tayB:[140,172], chanA:[65,95], chanB:[115,90], y:20});
  }
}

/* =======================================================================
   MINECRAFT — texture 16×16 lát vô tận, và điều làm nó khác hẳn Terraria:
   texture KHÔNG mang nguồn sáng. Engine tự làm tối mặt bên và mặt dưới,
   nên ai vẽ sẵn bóng đổ vào texture thì lúc dựng khối sẽ tối hai lần.
   Mọi hàm dưới đây dựng texture bằng nhiễu có cộng vòng, nên lát ra là
   liền mạch chứ không phải vẽ tay rồi chắp lại.
   ======================================================================= */
export const MC={
  da:      ['#6e6e6e','#787878','#828282','#8c8c8c'],
  cuoi:    ['#616161','#7a7a7a','#8f8f8f','#a3a3a3'],
  dat:     ['#5f4229','#6f4c33','#79553a','#866141'],
  co:      ['#4d8235','#5d9b3e','#6aad46','#77b74f'],
  van:     ['#7d6540','#8a7044','#9c7f4e','#af8f58'],
  vo:      ['#4f3b26','#5c452c','#6b5133','#7a5c3b'],
  loi:     ['#8a6f43','#9c7f4e','#b09062','#c0a070'],
  than:    ['#2b2b2b','#343434','#3d3d3d','#141414'],
  sat:     ['#b8a998','#cbb9a4','#d8c8b0','#9d8d7c'],
  vang:    ['#c7a11e','#e0be3a','#f2d55c','#a8871a'],
  kimcuong:['#2fa8a0','#43c8c0','#63e0d8','#218a84'],
  gach:    ['#7a3d33','#8c493c','#9c5546','#6a342b']
};
/* hash số nguyên: hash01 kiểu sin() mất chính xác khi đối số lớn và đẻ ra
   nguyên hàng đồng màu — thứ lát ra thành sọc ngang. */
export function mcRand(x,y,seed){
  let n = Math.imul(x|0, 374761393) + Math.imul(y|0, 668265263) + Math.imul(seed|0, 1442695041);
  n = Math.imul(n ^ (n>>>13), 1274126177);
  return ((n ^ (n>>>16)) >>> 0) / 4294967296;
}
/* nhiễu lát được: làm mờ có cộng vòng nên mép trái nối liền mép phải */
function mcField(s,seed,mem){
  const a=new Float32Array(s*s);
  for(let i=0;i<s*s;i++) a[i]=mcRand(i%s, (i/s)|0, seed);
  if(!mem) return a;
  const b=new Float32Array(s*s);
  for(let y=0;y<s;y++) for(let x=0;x<s;x++){
    let t=0;
    for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++)
      t += a[((y+dy+s)%s)*s + ((x+dx+s)%s)];      // cộng vòng: đây là chỗ giữ lát liền mạch
    b[y*s+x]=t/9;
  }
  return b;
}
/* chia pixel vào các sắc độ theo đúng tỉ lệ đặt trước, không theo ngưỡng cứng —
   nhờ vậy đổi hạt nhiễu thì bố cục sáng tối vẫn giữ nguyên */
function mcShade(f, phan){
  const thu=Array.from(f.keys()).sort((a,b)=>f[a]-f[b]);
  const out=new Uint8Array(f.length);
  let k=0;
  phan.forEach((p,ci)=>{ const n=Math.round(p*f.length); for(let i=0;i<n && k<thu.length;i++,k++) out[thu[k]]=ci; });
  while(k<thu.length){ out[thu[k]]=phan.length-1; k++; }
  return out;
}
/* một ô texture 16×16; sang=true thì cố tình nướng sẵn nguồn sáng vào (kiểu sai) */
export function mcTex(g,ox,oy,s,cols,seed,opt){
  const o=Object.assign({phan:[0.28,0.34,0.26,0.12], mem:true, sang:false}, opt||{});
  const m=mcShade(mcField(s,seed,o.mem), o.phan);
  for(let y=0;y<s;y++) for(let x=0;x<s;x++){
    let i=m[y*s+x];
    if(o.sang) i = Math.max(0, Math.min(cols.length-1, i + (y<s*0.3 ? 1 : y>s*0.72 ? -1 : 0)));
    px(g,ox+x,oy+y,cols[i]);
  }
}
/* lát 3×3 để soi mối nối — đúng cái nút "Lặp 3×3" trong app làm */
export function mcTile3(g,s,cols,seed,lien){
  for(let ty=0;ty<3;ty++) for(let tx=0;tx<3;tx++){
    mcTex(g,tx*s,ty*s,s,cols,seed,{mem:lien});
    if(!lien){                                   // mép bị vẽ tay đậm lên → lát ra thành lưới ca-rô
      for(let i=0;i<s;i++){ px(g,tx*s+i,ty*s,cols[0]); px(g,tx*s,ty*s+i,cols[0]); }
    }
  }
}
/* cỏ: mặt trên, mặt bên có viền cỏ rủ xuống, mặt dưới là đất trơn */
export function mcGrassTop(g,ox,oy,s,seed){ mcTex(g,ox,oy,s,MC.co,seed||3,{phan:[0.22,0.36,0.28,0.14]}); }
export function mcGrassSide(g,ox,oy,s,seed){
  mcTex(g,ox,oy,s,MC.dat,seed||5,{});
  for(let x=0;x<s;x++){
    const r=mcRand(x,0,(seed||5)+9);
    const sau = r<0.18 ? 2 : r<0.72 ? 3 : r<0.94 ? 4 : 5;   // mép cỏ răng cưa, không phải một đường thẳng
    for(let y=0;y<sau;y++){
      const t=mcRand(x,y,(seed||5)+21);
      px(g,ox+x,oy+y, MC.co[t<0.24?0:t<0.6?1:t<0.88?2:3]);
    }
  }
}
export function mcLogSide(g,ox,oy,s,seed){
  for(let y=0;y<s;y++) for(let x=0;x<s;x++){
    const nen=mcRand(x,0,seed||11);                 // mỗi cột một tông → thớ chạy dọc theo thân
    const j=mcRand(x,y,(seed||11)+5);
    const i=Math.min(3, Math.max(0, Math.floor(nen*4) + (j<0.20?1:j>0.86?-1:0)));
    px(g,ox+x,oy+y,MC.vo[i]);
  }
}
export function mcLogTop(g,ox,oy,s,seed){
  const c=(s-1)/2;
  for(let y=0;y<s;y++) for(let x=0;x<s;x++){
    const d=Math.hypot(x-c,y-c);
    const v=d + hash01(x*2.7,y*3.3+(seed||0))*0.9;
    px(g,ox+x,oy+y, d>c-0.4 ? MC.vo[1] : MC.loi[Math.min(3, Math.round(v)%3 + (v>c*0.72?1:0))]);
  }
}
export function mcPlank(g,ox,oy,s,seed){
  for(let y=0;y<s;y++){
    const nen=mcRand(0,y,seed||7);                  // mỗi hàng một tông → thớ chạy ngang mặt ván
    for(let x=0;x<s;x++){
      // trộn thêm một thành phần đổi chậm theo x, nếu không mỗi hàng thành một sọc trơn
      const doan=mcRand((x/5)|0, y, (seed||7)+3);
      const j=mcRand(x,y,(seed||7)+7);
      const i=Math.min(3, Math.max(0, Math.floor((nen*0.7+doan*0.3)*4) + (j<0.16?1:j>0.88?-1:0)));
      px(g,ox+x,oy+y,MC.van[i]);
    }
  }
  for(let x=0;x<s;x++){ px(g,ox+x,oy+Math.floor(s/2)-1,MC.van[0]); px(g,ox+x,oy+s-1,MC.van[0]); }
  for(let y=0;y<s;y++){                             // mối nối so le giữa hai hàng ván
    if(y<s/2-1) px(g,ox+Math.floor(s*0.62),oy+y,MC.van[0]);
    else if(y>s/2-1 && y<s-1) px(g,ox+Math.floor(s*0.28),oy+y,MC.van[0]);
  }
}
/* quặng: nền đá nguyên vẹn + vài cụm khoáng, phải đọc được từ xa nên cụm to và ít */
export function mcOre(g,ox,oy,s,loai,seed){
  mcTex(g,ox,oy,s,MC.da,seed||2,{});
  const r=MC[loai]||MC.sat, k=s/16;
  const cum=[[3,3],[10,5],[5,10],[11,11]];
  cum.forEach(([cx,cy],i)=>{
    if(hash01(cx+(seed||0), cy)<0.18) return;    // bỏ bớt một cụm cho các khối không giống hệt nhau
    const R=(i%2?1.6:2.2)*k;
    for(let y=-3;y<=3;y++) for(let x=-3;x<=3;x++){
      const d=Math.hypot(x,y);
      if(d>R) continue;
      const gx=Math.round(cx*k+x), gy=Math.round(cy*k+y);
      if(gx<0||gy<0||gx>=s||gy>=s) continue;
      px(g,ox+gx,oy+gy, r[d>R-1 ? 0 : (hash01(gx*3,gy*3)<0.4 ? 3 : 2)]);
    }
  });
}
/* Sai / đúng của bài nguồn sáng: cùng một texture, một cái nướng sẵn bóng đổ */
export function mcLit(g,s,sang){ mcTex(g,0,0,s,MC.da,2,{sang}); }
/* Sai / đúng của bài dải màu: dải quá rộng thì texture nhìn bẩn và lấn át vật khác */
export function mcRamp(g,w,h,rong){
  const r = rong ? ['#3a3a3a','#6e6e6e','#a5a5a5','#dcdcdc'] : MC.da;
  const o=Math.floor(h/2);
  r.forEach((c,i)=>{ for(let y=0;y<o;y++) for(let x=0;x<Math.floor(w/4);x++) px(g,i*Math.floor(w/4)+x,y,c); });
  for(let ty=0;ty<Math.ceil((h-o)/16);ty++) for(let tx=0;tx<Math.ceil(w/16);tx++) mcTex(g,tx*16,o+ty*16,16,r,2,{});
}
/* vật phẩm: nằm chéo góc dưới-trái lên góc trên-phải, có nét sẫm ôm ngoài */
export function mcItem(g,ox,oy,kind){
  const K='#2b2118', S=['#6b4a2a','#8a6238','#a67a46'];
  const dat=(x,y,c)=>{ if(x>=0&&y>=0&&x<16&&y<16) px(g,ox+x,oy+y,c); };
  for(let i=0;i<10;i++){                          // cán: luôn cùng một cây gậy cho cả bộ
    const x=3+i, y=12-i;
    dat(x,y,S[1]); dat(x+1,y,S[0]); dat(x,y-1,S[2]);
  }
  const dau = kind==='kiem' ? MC.sat : kind==='vang' ? MC.vang : kind==='kimcuong' ? MC.kimcuong : MC.sat;
  const hinh={
    cuoc:  [[9,1],[10,1],[11,1],[12,1],[13,1],[9,2],[10,2],[13,2],[12,2],[9,3],[10,3]],
    riu:   [[10,1],[11,1],[12,1],[10,2],[11,2],[12,2],[13,2],[10,3],[11,3],[12,3],[10,4],[11,4]],
    xeng:  [[10,1],[11,1],[12,1],[10,2],[11,2],[12,2],[10,3],[11,3],[12,3]],
    kiem:  [[9,1],[10,1],[11,1],[12,1],[8,2],[9,2],[10,2],[11,2],[7,3],[8,3],[9,3],[10,3]]
  }[kind]||[];
  hinh.forEach(([x,y],i)=>dat(x,y,dau[1+(i%2)]));
  hinh.forEach(([x,y])=>{                         // nét sẫm ôm ngoài — chỗ này MC khác Terraria: chỉ vật phẩm mới có
    [[1,0],[-1,0],[0,1],[0,-1]].forEach(([dx,dy])=>{
      if(!hinh.some(([a,b])=>a===x+dx&&b===y+dy)) dat(x+dx,y+dy,K);
    });
  });
  if(kind==='kiem'){ for(let i=0;i<3;i++) dat(5+i,10-i,K); dat(4,12,S[0]); }
}
/* bốn món cùng một khuôn: đổi phần đầu, giữ nguyên cán */
export function mcTools(g){
  ['cuoc','riu','xeng','kiem'].forEach((k,i)=>mcItem(g,i*17,0,k));
}
/* lưới UV của khối hộp: mặt nào dán đi đâu */
export function mcUV(g,s){
  const put=(cx,cy,fn)=>fn(cx*s,cy*s);
  put(1,0,(x,y)=>mcGrassTop(g,x,y,s,3));                     // trên
  [0,1,2,3].forEach(i=>put(i,1,(x,y)=>mcGrassSide(g,x,y,s,5+i)));   // bốn mặt bên
  put(1,2,(x,y)=>mcTex(g,x,y,s,MC.dat,5,{}));                // dưới
  g.fillStyle='rgba(255,255,255,0.5)';
  for(let i=0;i<=4;i++) g.fillRect(i*s,0,1,3*s);
  for(let i=0;i<=3;i++) g.fillRect(0,i*s,4*s,1);
}
/* bố cục file da nhân vật 64×32: mỗi khối hộp một cụm sáu mặt */
export function mcSkin(g){
  const o=[['#8a6b4f',0,8,8,8,'đầu'],['#6a9bd8',20,20,8,12,'thân'],
           ['#8a6b4f',44,20,4,12,'tay'],['#3b4a8a',4,20,4,12,'chân']];
  for(let y=0;y<32;y++) for(let x=0;x<64;x++) px(g,x,y,'#1b1b24');
  o.forEach(([c,ox,oy,w,h])=>{
    for(let y=0;y<h;y++) for(let x=0;x<w;x++){
      const t=hash01(ox+x,oy+y)<0.22;
      px(g,ox+x,oy+y, t ? shadeOf(c,-14) : c);
    }
    for(let x=0;x<w;x++){ px(g,ox+x,oy,shadeOf(c,12)); }
  });
}
function shadeOf(hex,d){
  const n=parseInt(hex.slice(1),16);
  const c=[(n>>16)&255,(n>>8)&255,n&255].map(v=>Math.max(0,Math.min(255,v+d)));
  return '#'+c.map(v=>v.toString(16).padStart(2,'0')).join('');
}
/* texture động = một dải dọc, mỗi 16px là một khung, engine chạy theo file .mcmeta */
export function mcAnim(g,s,n){
  for(let k=0;k<n;k++){
    mcTex(g,0,k*s,s,['#8a2b06','#c04a08','#e8760f','#ffb02a'],k*3+1,{phan:[0.3,0.3,0.26,0.14]});
    g.fillStyle='rgba(255,255,255,0.45)'; g.fillRect(0,k*s,s,1);
  }
}
/* cả bộ xếp lưới: kiểm cùng một mức nhiễu, cùng biên độ sáng tối */
export function mcSet(g,s){
  const o=[g=>mcTex(g,0,0,s,MC.da,2,{}), g=>mcTex(g,0,0,s,MC.cuoi,4,{phan:[0.3,0.28,0.26,0.16]}),
           g=>mcTex(g,0,0,s,MC.dat,5,{}), g=>mcGrassTop(g,0,0,s,3),
           g=>mcGrassSide(g,0,0,s,5), g=>mcPlank(g,0,0,s,7),
           g=>mcLogSide(g,0,0,s,11), g=>mcLogTop(g,0,0,s,1),
           g=>mcOre(g,0,0,s,'sat',2), g=>mcOre(g,0,0,s,'vang',6),
           g=>mcOre(g,0,0,s,'kimcuong',9), g=>mcTex(g,0,0,s,MC.gach,8,{phan:[0.26,0.34,0.26,0.14]})];
  o.forEach((fn,i)=>{
    const ox=(i%4)*s, oy=((i/4)|0)*s;
    g.save(); g.translate(ox,oy); fn(g); g.restore();
  });
}

/* =======================================================================
   TỪNG BƯỚC DỰNG MỘT Ô TILE
   Mỗi hàm dưới đây vẽ đúng một giai đoạn của cùng một ô, cộng dồn: bước n
   là bước n-1 cộng thêm một việc. Nhờ vậy dải hình trong bài tập chính là
   thứ tự thao tác thật, không phải mấy bức đẹp xếp cạnh nhau.
   ======================================================================= */

/* bước 1 của mọi bài: dải màu đã chọn, mỗi ô một sắc độ */
export function buocMau(g,w,h,cols,ten){
  const o=Math.floor(w/cols.length);
  cols.forEach((c,i)=>{ for(let y=0;y<h;y++) for(let x=0;x<o;x++) px(g,i*o+x,y,c); });
  for(let x=cols.length*o;x<w;x++) for(let y=0;y<h;y++) px(g,x,y,cols[cols.length-1]);
  if(ten!==false){                                  // gạch chân bậc nền để biết đổ nền bằng màu nào
    for(let x=o;x<o*2;x++){ px(g,x,h-1,'#ffb43f'); px(g,x,h-2,'#ffb43f'); }
  }
}
/* Khối kiểu Minecraft: nền → bậc tối → bậc sáng → điểm sáng nhất.
   Thứ tự này quan trọng: rắc tối trước thì mới thấy chỗ nào còn trống để rắc sáng. */
export function mcBuoc(g,ox,oy,s,cols,seed,n,phan){
  const m=mcShade(mcField(s,seed,true), phan||[0.28,0.34,0.26,0.12]);
  const hien=[[1],[1],[1,0],[1,0,2],[1,0,2,3]][Math.min(n,4)];
  for(let y=0;y<s;y++) for(let x=0;x<s;x++){
    const i=m[y*s+x];
    px(g,ox+x,oy+y, hien.indexOf(i)>=0 ? cols[i] : cols[1]);
  }
}
/* Quặng: bước 1–2 là khối đá đã xong, rồi mới đắp cụm lên.
   Nền đá không được sửa — đó là chỗ khối quặng ghép liền với đá xung quanh. */
export function mcBuocQuang(g,ox,oy,s,loai,seed,n){
  mcBuoc(g,ox,oy,s,MC.da,seed,4);
  if(n<2) return;
  const r=MC[loai]||MC.sat, k=s/16;
  const cum=[[4,4],[11,6],[6,11]];
  cum.forEach(([cx,cy],ci)=>{
    const R=(ci===1?1.7:2.3)*k;
    for(let y=-3;y<=3;y++) for(let x=-3;x<=3;x++){
      const d=Math.hypot(x,y);
      if(d>R) continue;
      const gx=Math.round(cx*k+x), gy=Math.round(cy*k+y);
      if(gx<0||gy<0||gx>=s||gy>=s) continue;
      if(n===2){ if(d<=0.6) px(g,ox+gx,oy+gy,'#ffb43f'); continue; }   // mới đánh dấu tâm cụm
      const ria = d>R-1;
      if(n===3 && ria) continue;                                       // chưa viền: chỉ lõi
      px(g,ox+gx,oy+gy, r[ria ? 0 : (mcRand(gx,gy,7)<0.4 ? 3 : 2)]);
    }
  });
}
/* Mặt bên khối cỏ: đất trước, mép cỏ phẳng, rồi mới bẻ răng cưa, rồi mới rám màu */
export function mcBuocCo(g,ox,oy,s,seed,n){
  mcBuoc(g,ox,oy,s,MC.dat,seed,4);
  if(n<2) return;
  for(let x=0;x<s;x++){
    const r=mcRand(x,0,(seed||5)+9);
    const sau = n<3 ? 3 : (r<0.18 ? 2 : r<0.72 ? 3 : r<0.94 ? 4 : 5);
    for(let y=0;y<sau;y++){
      if(n<4){ px(g,ox+x,oy+y,MC.co[2]); continue; }
      const t=mcRand(x,y,(seed||5)+21);
      px(g,ox+x,oy+y, MC.co[t<0.24?0:t<0.6?1:t<0.88?2:3]);
    }
  }
}
/* Gỗ: nền → chia cột theo tông → rắc nhiễu dọc thớ → xong */
export function mcBuocGo(g,ox,oy,s,seed,n){
  for(let y=0;y<s;y++) for(let x=0;x<s;x++){
    const nen=mcRand(x,0,seed||11);
    let i = n<2 ? 1 : Math.floor(nen*4);
    if(n>=3){ const j=mcRand(x,y,(seed||11)+5); i += (j<0.20?1:j>0.86?-1:0); }
    px(g,ox+x,oy+y, MC.vo[Math.min(3,Math.max(0,i))]);
  }
}
/* Khối kiểu Terraria thì NGƯỢC LẠI: có hướng sáng thật, nên dựng bậc trước
   rồi mới rắc nhiễu, và bước cuối là hạ tối mép đáy. */
export function terraBuoc(g,ox,oy,s,kind,n){
  const r=TERRA[kind]||TERRA.stone;
  for(let y=0;y<s;y++) for(let x=0;x<s;x++){
    let i=1;
    if(n>=2){ const t=y/s; i = t<0.12 ? 3 : t<0.42 ? 2 : t<0.78 ? 1 : 0; }   // bậc theo chiều cao
    if(n>=3){
      const nz=hash01(x*3,y*5);
      if(nz>0.85) i=Math.min(r.length-1,i+1); else if(nz<0.13) i=Math.max(0,i-1);
    }
    px(g,ox+x,oy+y,r[i]);
  }
  if(n>=4) for(let x=0;x<s;x++){ px(g,ox+x,oy+s-1,r[0]); if(hash01(x*7,3)<0.5) px(g,ox+x,oy+s-2,r[0]); }
}
/* Quặng Terraria: cùng ba bước như quặng Minecraft, chỉ khác nền có hướng sáng */
export function terraBuocQuang(g,ox,oy,s,kind,n){
  const c=TERRA[kind]||TERRA.gold;
  terraBuoc(g,ox,oy,s,'stone',4);
  if(n<2) return;
  const cum=[[0.22,0.30],[0.56,0.54],[0.70,0.22],[0.38,0.72]];
  cum.forEach(([u,v],i)=>{
    const x=Math.round(u*(s-3)), y=Math.round(v*(s-3));
    if(n===2){ px(g,ox+x,oy+y,'#ffb43f'); return; }
    px(g,ox+x,oy+y,c[2]); px(g,ox+x+1,oy+y,c[1]); px(g,ox+x,oy+y+1,c[1]);
    if(n>=4 && i%2===0 && y>0) px(g,ox+x,oy+y-1,c[3]);
  });
}
/* Cỏ phủ kiểu Terraria: khối đất xong → viền cỏ phẳng → bẻ răng cưa → rám màu */
export function terraBuocCo(g,ox,oy,s,n){
  terraBuoc(g,ox,oy,s,'dirt',4);
  if(n<2) return;
  const G=TERRA.grass;
  for(let x=0;x<s;x++){
    const sau = n<3 ? 2 : (hash01(x*5.3,2)<0.35 ? 2 : hash01(x*5.3,2)<0.8 ? 3 : 4);
    for(let y=0;y<sau;y++) px(g,ox+x,oy+y, n<4 ? G[1] : G[hash01(x*3.7,y*2.9)<0.35?0:hash01(x*3.7,y*2.9)<0.8?1:2]);
  }
}
/* Gạch: mạch ngang trước, mạch dọc so le sau, rám nhiễu cuối.
   16 chia hết cho cả bề cao viên (4) lẫn bề ngang (8) nên lát ra khớp nhịp. */
export function mcBrick(g,ox,oy,s,seed,n){
  const bw=Math.round(s/2), bh=Math.round(s/4);
  for(let y=0;y<s;y++) for(let x=0;x<s;x++){
    const hang=Math.floor(y/bh), lech=(hang%2)*(bw/2);
    let i=2;
    if((n||4)>=2 && y%bh===0) i=0;                       // mạch ngang
    else if((n||4)>=3 && (x+lech)%bw===0) i=0;           // mạch dọc, so le nửa viên
    if((n||4)>=4 && i!==0){
      const j=mcRand(x,y,seed||8);
      i = 2 + (j<0.22?1:j>0.80?-1:0);
    }
    px(g,ox+x,oy+y,MC.gach[Math.min(3,Math.max(0,i))]);
  }
}
