/* Bảng hình minh hoạ: tên demo → các khung "sai / đúng" đặt cạnh nhau.
   Bài tập và bài lý thuyết chỉ nhắc tới tên demo, không biết chúng được vẽ thế nào. */
import { TH } from './../state.js';
import { buildRamp } from './../color.js';
import { PALETTES } from './../palette.js';
import {
  AA_SOFT, A_ARROW, A_BAG, A_CHEST, A_CHEST_OPEN, A_CHIBI, A_CHIBI_BACK, A_CHIBI_SIDE, A_COIN,
  A_KEY, A_PLUS, A_STAFF, A_STAR, A_SWORD, A_TREE, CURVE_BAD, CURVE_GOOD, FAR, JUMP_POSES, MC,
  P_ARM, P_HEAD, P_LEG, P_TORSO, RUN_POSES, STICK_COL, STICK_JUMP, STICK_PUNCH, STICK_RUN,
  STICK_WALK, TERRA, art, artFlip, drawApple, drawBands, drawBoom, drawBox, drawBread,
  drawCleanup, drawCrop, drawCyl, drawFace, drawFrame, drawGradient, drawHairLag, drawHouse,
  drawMap, drawMaterial, drawParallax, drawPotion, drawRig, drawShadow, drawSideProp,
  drawSlash, drawSmear, drawSoft, drawSpacing, drawSphere, drawTile, drawTile9, drawTiming,
  drawWalk, handPath, heartShape, mcAnim, mcGrassSide, mcGrassTop, mcItem, mcLit, mcLogSide,
  mcLogTop, mcOre, mcPlank, mcRamp, mcSet, mcSkin, mcTex, mcTile3, mcTools, mcUV, onBg,
  platformEdge, px, ringShape, runsLine, sideGround, sideScene, stickBall, stickPendulum,
  stickPose, stickWeight, stickman, terraBar, terraBlock, terraChar, terraGrass, terraOre,
  terraSet, terraSheet, terraSlime, terraSword, terraTool, terraWalk, terraWall, terraWood
} from './art.js';

const RAMP_FLAT = ['#4a1414','#7a2020','#a82c2c','#d63a3a','#f26a6a'];
const RAMP_HUE  = ['#3a1442','#7a2340','#c14a3a','#e8863f','#ffd472'];

export const DEMOS = {
  lines:[
    {cap:'Bậc lộn xộn', cls:'bad',  w:26,h:12, fn:g=>runsLine(g,[4,1,5,2,3,1],TH.bad,1,1)},
    {cap:'Bậc đều nhau', cls:'good', w:26,h:12, fn:g=>runsLine(g,[3,3,3,3,3,3],TH.good,1,1)}
  ],
  curve:[
    {cap:'Cụm nhảy bậc', cls:'bad',  w:13,h:9, fn:g=>drawMap(g,CURVE_BAD,{x:TH.bad},0,0)},
    {cap:'Cụm giảm dần 4-3-2-1', cls:'good', w:13,h:9, fn:g=>drawMap(g,CURVE_GOOD,{x:TH.good},0,0)}
  ],
  outline:[
    {cap:'Viền đen kín', cls:'', w:14,h:16, fn:g=>drawPotion(g,0,'hard')},
    {cap:'Viền chọn lọc', cls:'good', w:14,h:16, fn:g=>drawPotion(g,0,'selective')},
    {cap:'Viền theo màu', cls:'good', w:14,h:16, fn:g=>drawPotion(g,0,'colored')}
  ],
  shading:[
    {cap:'Pillow shading', cls:'bad',  w:20,h:20, fn:g=>drawSphere(g,0,0,20,RAMP_HUE,true)},
    {cap:'Một nguồn sáng', cls:'good', w:20,h:20, fn:g=>drawSphere(g,0,0,20,RAMP_HUE,false)}
  ],
  hue:[
    {cap:'Chỉ đổi độ sáng', cls:'bad',  w:20,h:20, fn:g=>drawSphere(g,0,0,20,RAMP_FLAT,false)},
    {cap:'Có lệch tông', cls:'good', w:20,h:20, fn:g=>drawSphere(g,0,0,20,RAMP_HUE,false)}
  ],
  banding:[
    {cap:'Sọc song song đều', cls:'bad',  w:26,h:14, fn:g=>drawBands(g,26,14,RAMP_HUE,true)},
    {cap:'Bậc dày mỏng lệch nhau', cls:'good', w:26,h:14, fn:g=>drawBands(g,26,14,RAMP_HUE,false)}
  ],
  dither:[
    {cap:'Chuyển gắt', cls:'bad',  w:28,h:12, fn:g=>drawGradient(g,28,12,'#29366f','#63bcd1',false)},
    {cap:'Tán sắc Bayer', cls:'good', w:28,h:12, fn:g=>drawGradient(g,28,12,'#29366f','#63bcd1',true)}
  ],
  aa:[
    {cap:'Không khử răng cưa', cls:'', w:13,h:9, fn:g=>drawMap(g,CURVE_GOOD,{x:TH.ink},0,0)},
    {cap:'Khử răng cưa chọn lọc', cls:'good', w:13,h:9, fn:g=>drawMap(g,AA_SOFT,{x:TH.ink,o:TH.mid},0,0)}
  ],
  tile:[
    {cap:'Lộ mối nối', cls:'bad',  w:32,h:32, fn:g=>drawTile(g,true)},
    {cap:'Lặp liền mạch', cls:'good', w:32,h:32, fn:g=>drawTile(g,false)}
  ]
};
/* --- hình minh hoạ bổ sung cho bài tập & lý thuyết --- */
Object.assign(DEMOS, {
  shapes:[{cap:'Vuông · tròn · tam giác', cls:'', w:46,h:16, fn:g=>{
    for(let y=1;y<15;y++) for(let x=1;x<15;x++) if(y===1||y===14||x===1||x===14) px(g,x,y,TH.ink);
    ringShape(g,16,1,14,5.6,TH.ink);
    for(let y=0;y<14;y++){ const w=Math.round((y+1)*0.55); for(let i=0;i<=w;i++){ px(g,39-i,y+1,TH.ink); px(g,39+i,y+1,TH.ink); } }
  }}],
  thickness:[
    {cap:'Nét dày mỏng lẫn lộn', cls:'bad',  w:16,h:16, fn:g=>drawFrame(g,16,16,true)},
    {cap:'Nét đều 1px', cls:'good', w:16,h:16, fn:g=>drawFrame(g,16,16,false)}
  ],
  silhouette:[
    {cap:'Kiếm', cls:'good', w:16,h:16, fn:g=>art(g,A_SWORD,0,0,TH.ink)},
    {cap:'Chìa khoá', cls:'good', w:16,h:16, fn:g=>art(g,A_KEY,0,0,TH.ink)},
    {cap:'Cây', cls:'good', w:16,h:12, fn:g=>art(g,A_TREE,0,0,TH.ink)}
  ],
  negative:[
    {cap:'Lỗ 1px → bị bít', cls:'bad',  w:16,h:16, fn:g=>ringShape(g,0,0,16,1.6,TH.ink)},
    {cap:'Lỗ 3px → đọc rõ', cls:'good', w:16,h:16, fn:g=>ringShape(g,0,0,16,3.6,TH.ink)}
  ],
  uiicons8:[{cap:'Icon 8×8: cộng · mũi tên · sao · tim', cls:'', w:36,h:8, fn:g=>{
    art(g,A_PLUS,0,0,TH.ink); art(g,A_ARROW,9,0,TH.ink); art(g,A_STAR,18,0,TH.ink);
    heartShape(g,27,0,8,['#c94f4f','#e88a5a','#8c2f39']);
  }}],
  uiicons16:[{cap:'Bộ HUD 16×16 cùng phong cách', cls:'', w:66,h:16, fn:g=>{
    heartShape(g,0,2,14,['#c94f4f','#e88a5a','#8c2f39']);
    art(g,A_COIN,16,3); art(g,A_BAG,33,2); art(g,A_KEY,50,0);
  }}],
  squint:[
    {cap:'Nhoè thành một cục', cls:'bad',  w:16,h:12, fn:g=>art(g,A_TREE,0,0,null,{g:'#6f8f52',G:'#68884e',d:'#5f7f48',b:'#6a7a4a',B:'#66764a'})},
    {cap:'Ba khối tách bạch', cls:'good', w:16,h:12, fn:g=>art(g,A_TREE,0,0)}
  ],
  ramp5:[
    {cap:'Dải 5 bậc — chỉ đổi sáng', cls:'bad', w:25,h:8, fn:g=>{
      ['#4a1414','#7a2020','#a82c2c','#d63a3a','#f26a6a'].forEach((c,i)=>{ for(let y=0;y<8;y++) for(let x=0;x<5;x++) px(g,i*5+x,y,c); });
    }},
    {cap:'Dải 5 bậc — có lệch tông', cls:'good', w:25,h:8, fn:g=>{
      buildRamp('#c94f4f',5,30).forEach((c,i)=>{ for(let y=0;y<8;y++) for(let x=0;x<5;x++) px(g,i*5+x,y,c); });
    }}
  ],
  solids:[
    {cap:'Cầu', cls:'', w:18,h:18, fn:g=>drawSphere(g,0,0,18,RAMP_HUE,false)},
    {cap:'Trụ', cls:'', w:14,h:20, fn:g=>drawCyl(g,0,0,14,15,RAMP_HUE)},
    {cap:'Hộp', cls:'', w:20,h:20, fn:g=>drawBox(g,0,1,12,11,5,RAMP_HUE)}
  ],
  materials:[
    {cap:'Kim loại', cls:'', w:16,h:16, fn:g=>drawMaterial(g,0,0,16,'metal')},
    {cap:'Gỗ', cls:'', w:16,h:16, fn:g=>drawMaterial(g,0,0,16,'wood')},
    {cap:'Đá', cls:'', w:16,h:16, fn:g=>drawMaterial(g,0,0,16,'stone')},
    {cap:'Vải', cls:'', w:16,h:16, fn:g=>drawMaterial(g,0,0,16,'cloth')},
    {cap:'Thuỷ tinh', cls:'', w:16,h:16, fn:g=>drawMaterial(g,0,0,16,'glass')}
  ],
  crop5:[{cap:'5 giai đoạn — gốc cây không xê dịch', cls:'good', w:80,h:16, fn:g=>{
    for(let i=0;i<5;i++) drawCrop(g,i*16,0,i);
    for(let x=0;x<80;x++) px(g,x,15,TH.mid);
  }}],
  weapons:[
    {cap:'Kiếm', cls:'', w:16,h:16, fn:g=>art(g,A_SWORD,0,0)},
    {cap:'Gậy phép', cls:'', w:16,h:16, fn:g=>art(g,A_STAFF,0,0)}
  ],
  potions3:[{cap:'Một hình — ba màu nước', cls:'good', w:44,h:16, fn:g=>{
    drawPotion(g,0,'selective',['#6b1f28','#a83a3a','#d95f4f','#f2a06a']);
    drawPotion(g,15,'selective',['#1c3b6b','#2f5fa8','#4a93d9','#8fd0f2']);
    drawPotion(g,30,'selective',['#5c4a12','#9a7c1e','#d9b93a','#f2e08a']);
  }}],
  chest2:[
    {cap:'Đóng', cls:'', w:16,h:10, fn:g=>art(g,A_CHEST,0,0)},
    {cap:'Mở — lòng trong tối hẳn', cls:'good', w:16,h:9, fn:g=>art(g,A_CHEST_OPEN,0,0)}
  ],
  foods:[{cap:'Táo & bánh mì', cls:'', w:32,h:16, fn:g=>{ drawApple(g,0,3); drawBread(g,15,4); }}],
  tile9:[{cap:'9 ô: giữa · 4 cạnh · 4 góc', cls:'good', w:30,h:30, fn:g=>drawTile9(g)}],
  shadow:[
    {cap:'Không bóng → trôi lơ lửng', cls:'bad',  w:20,h:20, fn:g=>drawSphere(g,2,1,16,RAMP_HUE,false)},
    {cap:'Có bóng → dính đất', cls:'good', w:20,h:20, fn:g=>{ drawShadow(g,10,17,7,2,'#2b2231'); drawSphere(g,2,1,16,RAMP_HUE,false); }}
  ],
  house:[{cap:'Dựng khối trước, chi tiết sau', cls:'', w:24,h:19, fn:g=>drawHouse(g,0,0)}],
  parallax:[
    {cap:'Lớp xa — nhạt, ít chi tiết', cls:'', w:32,h:14, fn:g=>drawParallax(g,32,14,0)},
    {cap:'Lớp giữa', cls:'', w:32,h:14, fn:g=>drawParallax(g,32,14,1)},
    {cap:'Lớp gần — đậm, chi tiết', cls:'', w:32,h:14, fn:g=>drawParallax(g,32,14,2)}
  ],
  chibi:[{cap:'Chibi 16×16 — mắt 2 pixel, không mũi miệng', cls:'good', w:16,h:16, fn:g=>art(g,A_CHIBI,0,0)}],
  dirs4:[{cap:'4 hướng — cùng chiều cao đầu, vai, hông', cls:'good', w:64,h:16, fn:g=>{
    art(g,A_CHIBI,0,0); art(g,A_CHIBI_BACK,16,0); art(g,A_CHIBI_SIDE,32,0); artFlip(g,A_CHIBI_SIDE,48,0);
  }}],
  portrait3:[
    {cap:'Bình thường', cls:'', w:16,h:12, fn:g=>drawFace(g,0,'thường')},
    {cap:'Vui', cls:'', w:16,h:12, fn:g=>drawFace(g,0,'vui')},
    {cap:'Giận', cls:'', w:16,h:12, fn:g=>drawFace(g,0,'giận')}
  ],
  idle2:[
    {cap:'Khung 1', cls:'', w:16,h:17, fn:g=>art(g,A_CHIBI,0,0)},
    {cap:'Khung 2 — hạ đúng 1px', cls:'good', w:16,h:17, fn:g=>art(g,A_CHIBI,0,1)}
  ],
  walk4:[
    {cap:'1 chạm đất', cls:'', w:16,h:16, fn:g=>drawWalk(g,0,0,0)},
    {cap:'2 lướt qua', cls:'', w:16,h:16, fn:g=>drawWalk(g,0,0,1)},
    {cap:'3 chạm đất', cls:'', w:16,h:16, fn:g=>drawWalk(g,0,0,2)},
    {cap:'4 lướt qua', cls:'', w:16,h:16, fn:g=>drawWalk(g,0,0,3)}
  ],
  timing:[
    {cap:'Khung đều nhau → mềm oặt', cls:'bad',  w:26,h:10, fn:g=>drawTiming(g,26,10,true)},
    {cap:'Lấy đà lâu, bung 1 khung', cls:'good', w:26,h:10, fn:g=>drawTiming(g,26,10,false)}
  ],
  explode:[
    {cap:'1', cls:'', w:16,h:16, fn:g=>drawBoom(g,0,0,16,0.15)},
    {cap:'3', cls:'', w:16,h:16, fn:g=>drawBoom(g,0,0,16,0.40)},
    {cap:'5', cls:'', w:16,h:16, fn:g=>drawBoom(g,0,0,16,0.70)},
    {cap:'8 — tan thành khói', cls:'good', w:16,h:16, fn:g=>drawBoom(g,0,0,16,1.0)}
  ],
  enemy:[
    {cap:'Nhân vật chính', cls:'', w:16,h:16, fn:g=>art(g,A_CHIBI,0,0)},
    {cap:'Quái — dáng và tông khác hẳn', cls:'good', w:16,h:16, fn:g=>{
      art(g,A_CHIBI,0,0,null,{f:'#7a5a68',F:'#5a3a48',c:'#4a2438',C:'#2a1424',h:'#1a1420',H:'#0f0c14',b:'#3a1f2a',k:'#0a0810'});
      px(g,3,1,'#c94f4f'); px(g,3,2,'#c94f4f'); px(g,12,1,'#c94f4f'); px(g,12,2,'#c94f4f');
      px(g,6,4,'#ff004d'); px(g,8,4,'#ff004d');
    }}
  ],
  palettebar:[{cap:'Một palette dùng chung cho cả bộ asset', cls:'good', w:48,h:8, fn:g=>{
    PALETTES['Nông trại 24 (Kidoku)'].forEach((c,i)=>{ for(let y=0;y<8;y++){ px(g,i*2,y,c); px(g,i*2+1,y,c); } });
  }}],
  pivot:[
    {cap:'Chân lệch hàng → giật khi chạy', cls:'bad', w:34,h:18, fn:g=>{
      for(let x=0;x<34;x++) px(g,x,16,TH.mid);
      art(g,A_CHIBI,0,0); art(g,A_CHIBI_SIDE,17,2);
    }},
    {cap:'Chân cùng một hàng pixel', cls:'good', w:34,h:18, fn:g=>{
      for(let x=0;x<34;x++) px(g,x,16,TH.mid);
      art(g,A_CHIBI,0,1); art(g,A_CHIBI_SIDE,17,1);
    }}
  ],
  softhard:[
    {cap:'Cọ mềm → không phải pixel art', cls:'bad',  w:16,h:16, fn:g=>drawSoft(g,16,true)},
    {cap:'Cọ cứng 1px', cls:'good', w:16,h:16, fn:g=>drawSoft(g,16,false)}
  ],
  parts:[
    {cap:'đầu', cls:'', w:7,h:6, fn:onBg(7,6,g=>art(g,P_HEAD,0,0))},
    {cap:'thân', cls:'', w:6,h:5, fn:onBg(6,5,g=>art(g,P_TORSO,0,0))},
    {cap:'tay gần', cls:'', w:3,h:4, fn:onBg(3,4,g=>art(g,P_ARM,0,0))},
    {cap:'tay xa — tối 1 bậc', cls:'', w:3,h:4, fn:onBg(3,4,g=>art(g,P_ARM,0,0,null,FAR))},
    {cap:'chân gần', cls:'', w:3,h:4, fn:onBg(3,4,g=>art(g,P_LEG,0,0))},
    {cap:'chân xa', cls:'', w:3,h:4, fn:onBg(3,4,g=>art(g,P_LEG,0,0,null,FAR))}
  ],
  assemble:[
    {cap:'Chạm mép → hở khe, lệch trục', cls:'bad',  w:14,h:14, fn:onBg(14,14,g=>drawRig(g,0,0,{hy:-1,hx:-1,ax:2,flx:-2}))},
    {cap:'Chồng 1px ở cổ, vai, hông', cls:'good', w:14,h:14, fn:onBg(14,14,g=>drawRig(g,0,0))}
  ],
  rigpose:[
    {cap:'Đứng — tư thế gốc', cls:'', w:14,h:14, fn:onBg(14,14,g=>drawRig(g,0,0))},
    {cap:'Chỉ tay — chỉ đổi 1 part', cls:'good', w:14,h:14, fn:onBg(14,14,g=>drawRig(g,0,0,{arm:'dia'}))},
    {cap:'Nhún — thân & đầu hạ 2px', cls:'good', w:14,h:14, fn:onBg(14,14,g=>drawRig(g,0,0,{ty:2}))}
  ],
  cutout:[
    {cap:'1 — buông', cls:'', w:14,h:14, fn:onBg(14,14,g=>drawRig(g,0,0))},
    {cap:'2 — chếch', cls:'', w:14,h:14, fn:onBg(14,14,g=>drawRig(g,0,0,{arm:'dia',ty:-1}))},
    {cap:'3 — thẳng lên', cls:'', w:14,h:14, fn:onBg(14,14,g=>drawRig(g,0,0,{arm:'up'}))},
    {cap:'4 — vai đứng yên, bàn tay vạch cung', cls:'good', w:14,h:14, fn:onBg(14,14,g=>drawRig(g,0,0,{arm:'dia',ax:1,ty:-1}))}
  ],
  arc:[
    {cap:'Tay đi đường thẳng → máy móc', cls:'bad',  w:14,h:10, fn:g=>handPath(g,14,10,false)},
    {cap:'Tay đi theo cung → tự nhiên', cls:'good', w:14,h:10, fn:g=>handPath(g,14,10,true)}
  ],
  cleanup:[
    {cap:'Còn viền chia part', cls:'bad',  w:14,h:14, fn:onBg(14,14,g=>drawCleanup(g,0,0,false))},
    {cap:'Đã dọn — viền ngoài liền một đường', cls:'good', w:14,h:14, fn:onBg(14,14,g=>drawCleanup(g,0,0,true))}
  ],
  spacing:[
    {cap:'Khoảng cách đều → trôi đều', cls:'bad',  w:30,h:9, fn:g=>drawSpacing(g,30,9,true)},
    {cap:'Thưa lúc nhanh, dày lúc chậm', cls:'good', w:30,h:9, fn:g=>drawSpacing(g,30,9,false)}
  ],
  overlap:[
    {cap:'Tóc hạ cùng lúc với thân', cls:'bad',  w:14,h:14, fn:onBg(14,14,g=>drawHairLag(g,0,0,false))},
    {cap:'Tóc trễ 1 khung', cls:'good', w:14,h:14, fn:onBg(14,14,g=>drawHairLag(g,0,0,true))}
  ],
  /* --- góc nhìn ngang --- */
  sideprop:[
    {cap:'4 mốc: đỉnh đầu · vai · hông · mặt đất', cls:'', w:20,h:19, fn:onBg(20,19,g=>drawSideProp(g,20,19,true))},
    {cap:'Tư thế thủ — trọng tâm thấp, vai chếch', cls:'good', w:20,h:19, fn:onBg(20,19,g=>drawSideProp(g,20,19,false))}
  ],
  sideidle:[
    {cap:'Khung 1', cls:'', w:16,h:19, fn:onBg(16,19,g=>{for(let x=0;x<16;x++) px(g,x,16,TH.mid); drawRig(g,1,3);})},
    {cap:'Khung 2 — hạ đúng 1px, chân đứng yên', cls:'good', w:16,h:19, fn:onBg(16,19,g=>{for(let x=0;x<16;x++) px(g,x,16,TH.mid); drawRig(g,1,3,{ty:1});})}
  ],
  run8: RUN_POSES.map((pose,i)=>({
    cap:String(i+1)+(i===0?' — chạm đất':(i===2?' — lướt qua':'')), cls:i===0?'good':'',
    w:16,h:19, fn:onBg(16,19,g=>{ for(let x=0;x<16;x++) px(g,x,16,TH.mid); drawRig(g,1,3,pose); })
  })),
  jump5: JUMP_POSES.map((pose,i)=>({
    cap:['1 nhún lấy đà','2 bật lên','3 đỉnh — chậm nhất','4 rơi','5 tiếp đất — nhún lại'][i],
    cls:i===2?'good':'',
    w:16,h:19, fn:onBg(16,19,g=>{ for(let x=0;x<16;x++) px(g,x,16,TH.mid); drawRig(g,1,3,pose); })
  })),
  slash4:[0,1,2,3].map(i=>({
    cap:['1 lấy đà','2 bung + vệt','3 chạm','4 thu về'][i], cls:i===1?'good':'',
    w:20,h:19, fn:onBg(20,19,g=>{ for(let x=0;x<20;x++) px(g,x,16,TH.mid); drawSlash(g,1,3,i); })
  })),
  smear:[
    {cap:'Khung nhanh vẽ nét sạch → hụt lực', cls:'bad',  w:20,h:19, fn:onBg(20,19,g=>drawSmear(g,1,3,false))},
    {cap:'Khung nhanh kéo thành vệt (smear)', cls:'good', w:20,h:19, fn:onBg(20,19,g=>drawSmear(g,1,3,true))}
  ],
  sidetile:[
    {cap:'Hai màu phẳng → như nhìn từ trên xuống', cls:'bad',  w:16,h:16, fn:g=>sideGround(g,0,0,16,16,false)},
    {cap:'Mặt trên mỏng, thân dày dần tối', cls:'good', w:16,h:16, fn:g=>sideGround(g,0,0,16,16,true)}
  ],
  platedge:[
    {cap:'Mép cắt vuông → như miếng gạch', cls:'bad',  w:16,h:10, fn:g=>platformEdge(g,0,0,16,10,false)},
    {cap:'Bo góc, cỏ rủ xuống mép', cls:'good', w:16,h:10, fn:g=>platformEdge(g,0,0,16,10,true)}
  ],
  sidescene:[{cap:'Đất · bệ · dốc bậc · đồi xa — chân nhân vật đúng mốc', cls:'good',
    w:64,h:48, fn:g=>sideScene(g,64,48)}],
  /* --- phong cách Terraria --- */
  terrablock:[
    {cap:'Viền đen kín, ruột phẳng', cls:'bad',  w:16,h:16, fn:g=>terraBlock(g,0,0,16,'stone',true)},
    {cap:'Không viền, sạn dày, sáng trên tối dưới', cls:'good', w:16,h:16, fn:g=>terraBlock(g,0,0,16,'stone')}
  ],
  terraghep:[{cap:'Bốn khối 16×16 kề nhau — mối nối phải biến mất', cls:'good', w:32,h:32, fn:g=>{
    terraGrass(g,0,0,16); terraGrass(g,16,0,16);
    terraBlock(g,0,16,16,'dirt'); terraBlock(g,16,16,16,'dirt');
  }}],
  terrawall:[
    {cap:'Khối đặc — người chơi đứng lên được', cls:'', w:16,h:16, fn:g=>terraBlock(g,0,0,16,'stone')},
    {cap:'Tường lát sau lưng — tối và êm hơn hẳn', cls:'good', w:16,h:16, fn:g=>terraWall(g,0,0,16)}
  ],
  terraore:[
    {cap:'Đá thường', cls:'', w:16,h:16, fn:g=>terraBlock(g,0,0,16,'stone')},
    {cap:'Quặng đồng', cls:'', w:16,h:16, fn:g=>terraOre(g,0,0,16,'copper')},
    {cap:'Quặng vàng — chấm sáng nhất chỉ 1 pixel', cls:'good', w:16,h:16, fn:g=>terraOre(g,0,0,16,'gold')}
  ],
  terraitem:[
    {cap:'Không viền → chìm vào ô túi đồ', cls:'bad',  w:32,h:32, fn:g=>terraSword(g,0,0,32,true)},
    {cap:'Viền đen kín, nằm chéo 45°', cls:'good', w:32,h:32, fn:g=>terraSword(g,0,0,32)}
  ],
  terrabar:[{cap:'Thanh kim loại: đồng · vàng · gỗ', cls:'good', w:46,h:26, fn:g=>{
    terraBar(g,0,0,'copper'); terraBar(g,16,9,'gold'); terraBar(g,32,17,'wood');
  }}],
  terrapal:[{cap:'Dải hang động: đá · đất · cỏ · gỗ · vàng', cls:'good', w:40,h:10, fn:g=>{
    ['stone','dirt','grass','wood','gold'].forEach((k,r)=>{
      TERRA[k].forEach((c,i)=>{ for(let y=0;y<10;y++) for(let x=0;x<2;x++) px(g,r*8+i*2+x,y,c); });
    });
  }}],
  terra16:[
    {cap:'32×32 — phác thoải mái, nhiều sạn', cls:'', w:32,h:32, fn:g=>terraBlock(g,0,0,32,'stone')},
    {cap:'16×16 — khổ thật, mỗi viên sạn 1 pixel', cls:'good', w:16,h:16, fn:g=>terraBlock(g,0,0,16,'stone')}
  ],
  terrawood:[
    {cap:'Ván gỗ — mối ghép so le', cls:'good', w:16,h:16, fn:g=>terraWood(g,0,0,'van',16)},
    {cap:'Thân cây — khối tròn nhìn ngang', cls:'', w:16,h:16, fn:g=>terraWood(g,0,0,'than',16)},
    {cap:'Tán lá — phải có lỗ hở', cls:'good', w:16,h:16, fn:g=>terraWood(g,0,0,'la',16)}
  ],
  terratool:[
    {cap:'Cuốc', cls:'', w:32,h:32, fn:g=>terraTool(g,0,0,32,false)},
    {cap:'Rìu — cùng cán, cùng cỡ', cls:'good', w:32,h:32, fn:g=>terraTool(g,0,0,32,true)}
  ],
  terrachar:[{cap:'Cao khoảng 3 khối, lọt khe 2 khối', cls:'good', w:48,h:48, fn:g=>terraChar(g,48,48)}],
  terrawalk:[0,1,2,3].map(i=>({cap:'Khung '+(i+1), cls:i===0?'good':'', w:48,h:48, fn:g=>terraWalk(g,48,48,i)})),
  terraslime:[
    {cap:'Đứng yên', cls:'', w:24,h:20, fn:g=>terraSlime(g,0,0,24,0)},
    {cap:'Nén trước khi nhảy', cls:'good', w:24,h:20, fn:g=>terraSlime(g,0,0,24,1)},
    {cap:'Kéo dài khi bật', cls:'good', w:24,h:20, fn:g=>terraSlime(g,0,0,24,2)}
  ],
  terrasheet:[{cap:'Sáu ô 16×16, cách nhau đúng 2px', cls:'good', w:56,h:38, fn:g=>terraSheet(g,56,38)}],
  terraset:[{cap:'Cả bộ trên nền hang tối — cái nào chìm thì sửa cái đó', cls:'good', w:78,h:40, fn:g=>terraSet(g,78,40)}],
  /* --- người que --- */
  stickkhop:[
    {cap:'Chín khớp: cổ, hông, hai vai, hai khuỷu, hai gối', cls:'good', w:26,h:34,
     fn:g=>stickman(g,0,0,{khop:true})},
    {cap:'Không chấm khớp — vẫn phải gập đúng chỗ đó', cls:'', w:26,h:34,
     fn:g=>stickman(g,0,0,{})}
  ],
  stickpose:[
    {cap:'Thẳng đơ, đối xứng — không nói được gì', cls:'bad', w:26,h:34, fn:g=>stickPose(g,0,0,'do')},
    {cap:'Vươn lên — trục cong xuyên từ chân tới tay', cls:'good', w:26,h:34, fn:g=>stickPose(g,0,0,'vuon')},
    {cap:'Né người — trục cong ngược lại', cls:'good', w:26,h:34, fn:g=>stickPose(g,0,0,'ne')}
  ],
  stickcuctri:[
    {cap:'Cực trị 1', cls:'good', w:26,h:34, fn:g=>stickman(g,0,0,STICK_PUNCH[0])},
    {cap:'Trung gian — vẽ sau cùng', cls:'', w:26,h:34, fn:g=>stickman(g,0,0,STICK_PUNCH[1])},
    {cap:'Cực trị 2', cls:'good', w:26,h:34, fn:g=>stickman(g,0,0,STICK_PUNCH[2])}
  ],
  stickbong:[
    {cap:'Khoảng cách đều → trôi như bong bóng', cls:'bad',  w:46,h:22, fn:g=>stickBall(g,46,22,true)},
    {cap:'Nhanh lúc rơi, chậm ở đỉnh, bẹt lúc chạm', cls:'good', w:46,h:22, fn:g=>stickBall(g,46,22,false)}
  ],
  sticklac:[
    {cap:'Chia đều góc → máy móc', cls:'bad',  w:34,h:26, fn:g=>stickPendulum(g,34,26,false)},
    {cap:'Chậm ở hai đầu, nhanh ở giữa', cls:'good', w:34,h:26, fn:g=>stickPendulum(g,34,26,true)}
  ],
  sticknang:[
    {cap:'Người nhẹ — bay cao, người vươn dài', cls:'', w:70,h:30, fn:g=>stickWeight(g,70,30,false)},
    {cap:'Người nặng — thấp, lì, thân co lại', cls:'good', w:70,h:30, fn:g=>stickWeight(g,70,30,true)}
  ],
  stickdi:STICK_WALK.map((p,i)=>({
    cap:['1 chạm đất','2 hạ thấp','3 lướt qua','4 vươn lên'][i], cls:i===0?'good':'',
    w:26,h:34, fn:g=>{ stickman(g,0,0,p); for(let x=0;x<26;x++) px(g,x,32,STICK_COL.mo); }
  })),
  stickchay:STICK_RUN.map((p,i)=>({
    cap:'Khung '+(i+1)+(i===0?' — chạm đất':''), cls:i===0?'good':'',
    w:26,h:34, fn:g=>{ stickman(g,0,0,p); for(let x=0;x<26;x++) px(g,x,32,STICK_COL.mo); }
  })),
  sticknhay:STICK_JUMP.map((p,i)=>({
    cap:['1 nhún','2 bật','3 đỉnh — giữ lâu nhất','4 rơi','5 tiếp đất'][i], cls:i===2?'good':'',
    w:26,h:34, fn:g=>{ stickman(g,0,0,p); for(let x=0;x<26;x++) px(g,x,32,STICK_COL.mo); }
  })),
  stickdam:STICK_PUNCH.map((p,i)=>({
    cap:['1 lấy đà','2 bung','3 chạm','4 thu về'][i], cls:i===1?'good':'',
    w:28,h:34, fn:g=>{ stickman(g,0,0,p); for(let x=0;x<28;x++) px(g,x,32,STICK_COL.mo); }
  })),
  stickdap:[
    {cap:'Bộ que — chỉ có tư thế và nhịp', cls:'', w:26,h:34, fn:g=>stickman(g,0,0,{})},
    {cap:'Đắp khối lên đúng bộ que đó', cls:'good', w:26,h:34, fn:g=>{
      stickman(g,0,0,{col:STICK_COL.mo});
      drawRig(g,6,17);
    }}
  ],
  /* --- Minecraft --- */
  mcsang:[
    {cap:'Nướng sẵn bóng đổ → dựng khối là tối hai lần', cls:'bad',  w:16,h:16, fn:g=>mcLit(g,16,true)},
    {cap:'Phẳng đều — để engine lo mặt tối', cls:'good', w:16,h:16, fn:g=>mcLit(g,16,false)}
  ],
  mclat:[
    {cap:'Mép vẽ tay → lát ra thành lưới ca-rô', cls:'bad',  w:48,h:48, fn:g=>mcTile3(g,16,MC.da,2,false)},
    {cap:'Nhiễu cộng vòng → không thấy mối nối', cls:'good', w:48,h:48, fn:g=>mcTile3(g,16,MC.da,2,true)}
  ],
  mcdai:[
    {cap:'Dải quá rộng → texture bẩn, lấn át mọi thứ', cls:'bad',  w:48,h:40, fn:g=>mcRamp(g,48,40,true)},
    {cap:'Bốn sắc độ sát nhau → khối nào ra khối đó', cls:'good', w:48,h:40, fn:g=>mcRamp(g,48,40,false)}
  ],
  mcda:[
    {cap:'Đá', cls:'', w:16,h:16, fn:g=>mcTex(g,0,0,16,MC.da,2,{})},
    {cap:'Đá cuội — cùng vật liệu, nhiễu thô hơn', cls:'good', w:16,h:16, fn:g=>mcTex(g,0,0,16,MC.cuoi,4,{phan:[0.3,0.28,0.26,0.16]})},
    {cap:'Gạch', cls:'', w:16,h:16, fn:g=>mcTex(g,0,0,16,MC.gach,8,{phan:[0.26,0.34,0.26,0.14]})}
  ],
  mcgo:[
    {cap:'Vỏ thân cây — thớ chạy dọc', cls:'good', w:16,h:16, fn:g=>mcLogSide(g,0,0,16,11)},
    {cap:'Mặt cắt — vòng năm', cls:'good', w:16,h:16, fn:g=>mcLogTop(g,0,0,16,1)},
    {cap:'Ván — mối nối so le', cls:'', w:16,h:16, fn:g=>mcPlank(g,0,0,16,7)}
  ],
  mcco:[
    {cap:'Mặt trên', cls:'', w:16,h:16, fn:g=>mcGrassTop(g,0,0,16,3)},
    {cap:'Mặt bên — mép cỏ răng cưa, không kẻ thẳng', cls:'good', w:16,h:16, fn:g=>mcGrassSide(g,0,0,16,5)},
    {cap:'Mặt dưới', cls:'', w:16,h:16, fn:g=>mcTex(g,0,0,16,MC.dat,5,{})}
  ],
  mcquang:[
    {cap:'Sắt', cls:'', w:16,h:16, fn:g=>mcOre(g,0,0,16,'sat',2)},
    {cap:'Vàng', cls:'', w:16,h:16, fn:g=>mcOre(g,0,0,16,'vang',6)},
    {cap:'Kim cương — cụm to, ít, đọc được từ xa', cls:'good', w:16,h:16, fn:g=>mcOre(g,0,0,16,'kimcuong',9)}
  ],
  mcvatpham:[
    {cap:'Nằm chéo, cán ở góc dưới-trái', cls:'good', w:16,h:16, fn:g=>mcItem(g,0,0,'cuoc')}
  ],
  mccongcu:[
    {cap:'Bốn món, một khuôn: đổi đầu, giữ nguyên cán', cls:'good', w:67,h:16, fn:g=>mcTools(g)}
  ],
  mcuv:[
    {cap:'Lưới UV một khối: trên · bốn mặt bên · dưới', cls:'good', w:64,h:48, fn:g=>mcUV(g,16)}
  ],
  mcskin:[
    {cap:'File da 64×32 — mỗi cụm sáu mặt của một hộp', cls:'good', w:64,h:32, fn:g=>mcSkin(g)}
  ],
  mcdong:[
    {cap:'Texture động = dải dọc, mỗi 16px một khung', cls:'good', w:16,h:64, fn:g=>mcAnim(g,16,4)}
  ],
  mcbo:[
    {cap:'Cả bộ cạnh nhau — soi cùng mức nhiễu, cùng biên độ', cls:'good', w:64,h:48, fn:g=>mcSet(g,16)}
  ],
  sizes3:[
    {cap:'8×8 — chỉ còn hình dáng', cls:'', w:8,h:8,   fn:g=>heartShape(g,0,0,8,['#c94f4f','#e88a5a','#8c2f39'])},
    {cap:'16×16 — đủ 3 bậc màu', cls:'', w:16,h:16, fn:g=>heartShape(g,0,0,16,['#c94f4f','#e88a5a','#8c2f39'])},
    {cap:'32×32 — thoải mái chi tiết', cls:'', w:32,h:32, fn:g=>heartShape(g,0,0,32,['#c94f4f','#e88a5a','#8c2f39'])}
  ]
});

/* Vẽ mẫu của một bài ra canvas 1:1 để nạp vào tranh.
   Ưu tiên khung được đánh dấu "đúng", vì đó mới là cái đáng vẽ đè. */
export function demoToCanvas(name){
  const list=DEMOS[name]||[];
  if(!list.length) return null;
  const p = list.find(x=>x.cls==='good') || list[list.length-1];
  const cv=document.createElement('canvas'); cv.width=p.w; cv.height=p.h;
  const g=cv.getContext('2d');
  p.fn(g);                                   // không tô nền: chỉ lấy phần có hình
  return cv;
}
export function renderDemo(name, small){
  const row=document.createElement('div'); row.className='demo'+(small?' sm':'');
  (DEMOS[name]||[]).forEach(p=>{
    const fig=document.createElement('figure'); fig.className=p.cls;
    const cv=document.createElement('canvas'); cv.width=p.w; cv.height=p.h;
    const g=cv.getContext('2d');
    g.fillStyle=TH.demoBg; g.fillRect(0,0,p.w,p.h);
    p.fn(g);
    const cap=document.createElement('figcaption'); cap.textContent=p.cap;
    fig.appendChild(cv); fig.appendChild(cap); row.appendChild(fig);
  });
  return row;
}
