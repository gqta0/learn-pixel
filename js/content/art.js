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
