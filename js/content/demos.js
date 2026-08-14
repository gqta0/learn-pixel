/* Bảng hình minh hoạ: tên demo → các khung "sai / đúng" đặt cạnh nhau.
   Bài tập và bài lý thuyết chỉ nhắc tới tên demo, không biết chúng được vẽ thế nào. */
import { TH } from './../state.js';
import { buildRamp } from './../color.js';
import { PALETTES } from './../palette.js';
import {
  AA_SOFT, A_ARROW, A_BAG, A_CHEST, A_CHEST_OPEN, A_CHIBI, A_CHIBI_BACK, A_CHIBI_SIDE, A_COIN,
  A_KEY, A_PLUS, A_STAFF, A_STAR, A_SWORD, A_TREE, CURVE_BAD, CURVE_GOOD, FAR, JUMP_POSES,
  P_ARM, P_HEAD, P_LEG, P_TORSO, RUN_POSES, art, artFlip, drawApple, drawBands, drawBoom,
  drawBox, drawBread, drawCleanup, drawCrop, drawCyl, drawFace, drawFrame, drawGradient,
  drawHairLag, drawHouse, drawMap, drawMaterial, drawParallax, drawPotion, drawRig, drawShadow,
  drawSideProp, drawSlash, drawSmear, drawSoft, drawSpacing, drawSphere, drawTile, drawTile9,
  drawTiming, drawWalk, handPath, heartShape, onBg, platformEdge, px, ringShape, runsLine,
  sideGround, sideScene
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
