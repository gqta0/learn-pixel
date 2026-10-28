/* Tạo nhanh Terrain 56 từ một "công thức" — vẽ bằng thuật toán, ra pixel thật ở đúng khổ ô
   (không phóng to 16 → 32) và không lộ lưới ô vuông. Thuần dữ liệu, không DOM, để kiểm thử
   bằng Node; tilegenview.js lo giao diện, xem trước và đưa vào atlas.

   Ba ý chính để ghép đâu cũng liền:
   1. Phần ruột là một tấm vân LẶP VÒNG đúng bằng một ô: cạnh phải ô nào cũng chạy tiếp sang
      cạnh trái ô nào, nên đá to được phép vắt qua mép ô — mắt không còn bắt được lưới.
   2. Mặt trên / tường / trần là dải đá cuội tính theo toạ độ trong ô và khoảng cách tới khoảng
      trống (dU, dD, dL, dR). Hai ô nối nhau nhìn thấy cùng khoảng cách ở mép chung, nên luôn
      cùng một dải. Khe giữa hai viên cuội không bao giờ rơi đúng cột/hàng biên.
   3. Biến thể giữ nguyên vành ngoài của ô gốc (đá chạm vành giữ lại, chỉ rải lại đá bên trong),
      nên #47–#55 thay được cho ô gốc ở bất cứ chỗ nào.

   Mọi thứ vẽ ra là CHỈ SỐ VAI TRÒ màu (ink, m0…f1) chứ không phải mã màu: đổi màu một vai là
   tô lại cả bộ trong tích tắc, và kiểm được "chỉ dùng màu trong bảng" ngay từ cấu trúc. */
import { TERRAIN_TILES, tileRoles, terrainHash, terrainSlot, shapeInset, checkSeams, checkColorSeams, variantBase } from './terrain.js';
import { GENESIS_COMMON, GENESIS_FAMILIES, GENESIS_COLORS } from './genesis.js';
import { GENESIS_V3_COMMON, GENESIS_V3_FAMILIES, GENESIS_V3_COLORS } from './genesis-v3.js';

/* ---------------- vai trò màu ---------------- */
export const GEN_ROLE_KEYS=['ink','m0','m1','m2','r0','r1','r2','r3','c0','c1','c2','c3','kd','k0','k1','k2','g0','g1','g2','w0','w1','f0','f1'];
export const GEN_ROLE_LABELS={
  ink:'Viền — màu viền duy nhất', m0:'Nền · khe tối', m1:'Nền', m2:'Nền · hạt',
  r0:'Đá · bóng', r1:'Đá · thân', r2:'Đá · sáng', r3:'Đá · điểm sáng',
  c0:'Mặt trên · bóng', c1:'Mặt trên · thân', c2:'Mặt trên · sáng', c3:'Mặt trên · bắt nắng',
  kd:'Lớp phủ · mép dưới', k0:'Lớp phủ · tối', k1:'Lớp phủ', k2:'Lớp phủ · sáng',
  g0:'Linh khí · quầng', g1:'Linh khí', g2:'Linh khí · lõi',
  w0:'Rễ · tối', w1:'Rễ', f0:'Hoa', f1:'Nhuỵ hoa'
};
export const GEN_ROLE_GROUPS=[
  ['Viền & nền',['ink','m0','m1','m2']], ['Đá trong nền',['r0','r1','r2','r3']],
  ['Mặt trên / tường / trần',['c0','c1','c2','c3']], ['Lớp phủ',['kd','k0','k1','k2']],
  ['Linh khí',['g0','g1','g2']], ['Rễ & hoa',['w0','w1','f0','f1']]
];
const RI={}; GEN_ROLE_KEYS.forEach((k,i)=>{ RI[k]=i+1; });
const {ink:INK,m0:M0,m1:M1,m2:M2,r0:R0,r1:R1,r2:R2,r3:R3,c0:C0,c1:C1,c2:C2,c3:C3,
  kd:KD,k0:K0,k1:K1,k2:K2,g0:G0,g1:G1,g2:G2,w0:W0,w1:W1,f0:F0,f1:F1}=RI;
const CAP=[C0,C1,C2,C3], ROCK=[R0,R1,R2,R3];
/* bậc tối hơn một nấc trên cùng dải — đổ bóng dưới gờ, đá tối, mặt tường khuất */
const DARKER=new Uint8Array(GEN_ROLE_KEYS.length+1);
[[INK,INK],[M0,INK],[M1,M0],[M2,M0],[R0,M0],[R1,R0],[R2,R1],[R3,R2],[C0,R0],[C1,C0],[C2,C1],[C3,C2],
 [KD,M0],[K0,KD],[K1,K0],[K2,K1],[G0,M0],[G1,G0],[G2,G1],[W0,INK],[W1,W0],[F0,F0],[F1,F1]].forEach(([a,b])=>{ DARKER[a]=b; });
const BACKGROUND=new Set([M0,M1,M2]);

/* ---------------- công thức ----------------
   Mỗi công thức = kiểu vẽ + thông số mặc định + bảng vai trò màu cho TỪNG bảng màu gốc:
   genesis (Genesis v2), genesis-v3 (mặc định) và master. Màu nào cũng lấy đúng mã trong
   bảng đó, nên bộ ô sinh ra luôn nằm trọn trong bảng anh đang vẽ. */
export const GEN_PALETTES={genesis:'Genesis v2','genesis-v3':'Genesis v3',master:'Master Palette'};
const M_INK='#0d171f';
/* Gán vai trò từ các bậc HEX đã duyệt, không pha hay nội suy thêm màu. */
function genesisPalettes({rock='stone',cap=rock,cover='leaf',glow='jade',background='coal',sky}={}){
  return Object.fromEntries([
    ['genesis',GENESIS_COMMON,GENESIS_FAMILIES],['genesis-v3',GENESIS_V3_COMMON,GENESIS_V3_FAMILIES]
  ].map(([key,common,families])=>{
    const R=families[rock].ramp,C=families[cap].ramp,K=families[cover].ramp,
      G=families[glow].ramp,B=families[background].ramp,W=families.wood.ramp;
    return [key,{sky:sky?families[sky].base:common.deep_shadow,colors:{ink:common.outline,m0:B[0],m1:B[1],m2:B[2],
      r0:R[1],r1:R[2],r2:R[3],r3:R[4],c0:C[1],c1:C[2],c2:C[3],c3:C[4],
      kd:K[0],k0:K[1],k1:K[2],k2:K[3],g0:G[0],g1:G[2],g2:G[4],
      w0:W[0],w1:W[2],f0:families.pink.base,f1:families.gold.base}}];
  }));
}
export const GEN_RECIPES={
  cleanBlock:{title:'Đá khối sạch · cỏ',note:'Khối đá xếp so le, mạch vữa rõ, cỏ phủ mép trên — sạch, ít nhiễu',
    interior:'block',capStyle:'block',crustType:'grass',dripType:'none',hangType:'vine',
    params:{size:.5,density:.5,crust:.5,drip:0,glow:0,capH:.5,cracks:.25,pebbles:0,roots:0,deco:.35},
    props:['tuft','sprout','flower','tuft','pebble','sprout','hang','hang'],
    palettes:{
      ...genesisPalettes({rock:'slate'}),
      master:{sky:'#162331',colors:{ink:'#2e4659',m0:'#0d171f',m1:'#162331',m2:'#223344',r0:'#7a95a7',r1:'#99b0bf',r2:'#b4c5d1',r3:'#d0dde4',
        c0:'#7a95a7',c1:'#99b0bf',c2:'#b4c5d1',c3:'#d0dde4',kd:'#245c2c',k0:'#4a873c',k1:'#7cb759',k2:'#b1dc74',
        g0:'#0f5c50',g1:'#2fb688',g2:'#7fe8b4',w0:'#41261c',w1:'#694635',f0:'#ec89ae',f1:'#f5cb53'}}}},
  cleanMoss:{title:'Đá khối rêu · rễ',note:'Khối đá nâu đất, rêu phủ mép, dây rêu rủ và rễ luồn qua mạch vữa',
    interior:'block',capStyle:'block',crustType:'moss',dripType:'vine',hangType:'vine',
    params:{size:.5,density:.5,crust:.45,drip:.35,glow:0,capH:.5,cracks:.3,pebbles:0,roots:.45,deco:.4},
    props:['sprout','tuft','flower','sprout','pebble','tuft','hang','hang'],
    palettes:{
      ...genesisPalettes({rock:'wood',cover:'moss'}),
      master:{sky:'#0d171f',colors:{ink:'#223344',m0:'#0d171f',m1:'#162331',m2:'#223344',r0:'#5f4b4e',r1:'#7c6d6c',r2:'#ac9c8d',r3:'#cabcad',c0:'#5f4b4e',c1:'#7c6d6c',c2:'#ac9c8d',c3:'#e6e0d3',kd:'#173d2a',k0:'#245c2c',k1:'#4a873c',k2:'#7cb759',g0:'#0f5c50',g1:'#2fb688',g2:'#7fe8b4',w0:'#41261c',w1:'#694635',f0:'#ec89ae',f1:'#f5cb53'}}}},
  cleanDeep:{title:'Đá khối sâu · mạch ngọc',note:'Khối đá tím than tối, rêu xám mỏng, mạch vữa ánh linh khí ngọc',
    interior:'block',capStyle:'block',crustType:'moss',dripType:'vine',hangType:'stalactite',
    params:{size:.5,density:.5,crust:.3,drip:.15,glow:.35,capH:.5,cracks:.4,pebbles:0,roots:.1,deco:.3},
    props:['pebble','sprout','shard','pebble','crystal','tuft','hang','hang'],
    palettes:{
      ...genesisPalettes({cover:'moss',background:'void'}),
      master:{sky:'#0d171f',colors:{ink:'#0d171f',m0:'#0d171f',m1:'#162331',m2:'#223344',r0:'#2e4659',r1:'#435d73',r2:'#5e788c',r3:'#7a95a7',c0:'#2e4659',c1:'#435d73',c2:'#5e788c',c3:'#7a95a7',kd:'#283b3a',k0:'#3a5647',k1:'#527059',k2:'#6e896f',g0:'#004264',g1:'#08919b',g2:'#01cbd3',w0:'#41261c',w1:'#694635',f0:'#c4f0de',f1:'#5dffc0'}}}},
  cleanQi:{title:'Đá khối mạch lam',note:'Khối đá xám lam, băng tinh thể trên mép, mạch vữa sáng linh khí lam',
    interior:'block',capStyle:'block',crustType:'crystal',dripType:'icicle',hangType:'icicle',
    params:{size:.5,density:.5,crust:.3,drip:.25,glow:.55,capH:.5,cracks:.3,pebbles:0,roots:0,deco:.4},
    props:['crystal','shard','crystal','pebble','shard','crystal','hang','hang'],
    palettes:{
      ...genesisPalettes({rock:'slate',cover:'ice',glow:'blue'}),
      master:{sky:'#223344',colors:{ink:'#0d171f',m0:'#0d171f',m1:'#162331',m2:'#223344',r0:'#5e788c',r1:'#7a95a7',r2:'#99b0bf',r3:'#b4c5d1',c0:'#5e788c',c1:'#7a95a7',c2:'#99b0bf',c3:'#d0dde4',kd:'#004264',k0:'#08919b',k1:'#01cbd3',k2:'#6cf2ff',g0:'#004264',g1:'#01cbd3',g2:'#6cf2ff',w0:'#41261c',w1:'#694635',f0:'#6cf2ff',f1:'#d9efff'}}}},
  cleanCrystal:{title:'Đá khối hang tinh thể',note:'Khối đá lam tối, cụm tinh thể mọc xiên, mạch vữa rực linh khí',
    interior:'block',capStyle:'block',crustType:'crystal',dripType:'icicle',hangType:'icicle',
    params:{size:.5,density:.5,crust:.35,drip:.35,glow:.85,capH:.5,cracks:.25,pebbles:0,roots:0,deco:.5},
    props:['crystal','crystal','shard','pebble','shard','crystal','hang','hang'],
    palettes:{
      ...genesisPalettes({cap:'slate',cover:'ice',glow:'ice'}),
      master:{sky:'#223344',colors:{ink:'#0d171f',m0:'#0d171f',m1:'#162331',m2:'#223344',r0:'#2e4659',r1:'#435d73',r2:'#5e788c',r3:'#7a95a7',c0:'#2e4659',c1:'#435d73',c2:'#5e788c',c3:'#b4c5d1',kd:'#004264',k0:'#08919b',k1:'#01cbd3',k2:'#6cf2ff',g0:'#004264',g1:'#01cbd3',g2:'#6cf2ff',w0:'#41261c',w1:'#694635',f0:'#6cf2ff',f1:'#d9efff'}}}},
  cleanViolet:{title:'Đá khối linh thạch tím',note:'Khối đá tím than, tinh thể tím mọc xiên, mạch vữa sáng linh khí tím',
    interior:'block',capStyle:'block',crustType:'crystal',dripType:'icicle',hangType:'icicle',
    params:{size:.5,density:.5,crust:.35,drip:.3,glow:.9,capH:.5,cracks:.25,pebbles:0,roots:0,deco:.5},
    props:['crystal','crystal','shard','pebble','shard','crystal','hang','hang'],
    palettes:{
      ...genesisPalettes({rock:'void',cap:'purple',cover:'purple',glow:'purple'}),
      master:{sky:'#162331',colors:{ink:'#0d171f',m0:'#0d171f',m1:'#162331',m2:'#223344',r0:'#2e4659',r1:'#435d73',r2:'#5e788c',r3:'#7a95a7',c0:'#2e4659',c1:'#435d73',c2:'#5e788c',c3:'#b4c5d1',kd:'#5e419e',k0:'#7c5bc4',k1:'#9a7de0',k2:'#b99cff',g0:'#5e419e',g1:'#9a7de0',g2:'#b99cff',w0:'#41261c',w1:'#694635',f0:'#b99cff',f1:'#ffd0df'}}}},
  warmLedge:{title:'Đá ấm · cỏ',note:'Gờ cuội ấm, cỏ non; đá tảng nằm trong nền tối',
    interior:'boulder',capStyle:'cobble',crustType:'grass',dripType:'vine',hangType:'stalactite',
    params:{size:.65,density:.3,crust:.4,drip:.25,glow:0,capH:.5,cracks:.35,pebbles:.55,roots:0,deco:.55},
    props:['tuft','tuft','flower','sprout','pebble','tuft','flower','hang'],
    palettes:{
      ...genesisPalettes({rock:'wood',cap:'earth'}),
      master:{sky:'#223344',colors:{ink:M_INK,m0:'#0d171f',m1:'#162331',m2:'#413e49',r0:'#5f4b4e',r1:'#7c6d6c',r2:'#ac9c8d',r3:'#cabcad',
        c0:'#7c6d6c',c1:'#ac9c8d',c2:'#cabcad',c3:'#e6e0d3',kd:'#245c2c',k0:'#4a873c',k1:'#7cb759',k2:'#b1dc74',
        g0:'#14866a',g1:'#2fb688',g2:'#7fe8b4',w0:'#41261c',w1:'#694635',f0:'#f4efe3',f1:'#f5cb53'}}}},
  mossCobble:{title:'Cuội rêu · rễ',note:'Đá cuội xếp kín, rêu xanh rủ, rễ cây đâm xuống',
    interior:'cobble',capStyle:'cobble',crustType:'moss',dripType:'vine',hangType:'vine',
    params:{size:.55,density:.6,crust:.55,drip:.6,glow:0,capH:.45,cracks:.2,pebbles:.3,roots:.5,deco:.5},
    props:['sprout','sprout','tuft','tuft','flower','pebble','hang','hang'],
    palettes:{
      ...genesisPalettes({rock:'slate',cover:'moss'}),
      master:{sky:'#0d171f',colors:{ink:M_INK,m0:'#0d171f',m1:'#223344',m2:'#2e4659',r0:'#435d73',r1:'#5e788c',r2:'#7a95a7',r3:'#99b0bf',
        c0:'#435d73',c1:'#5e788c',c2:'#7a95a7',c3:'#99b0bf',kd:'#245c2c',k0:'#4a873c',k1:'#7cb759',k2:'#b1dc74',
        g0:'#0f5c50',g1:'#2fb688',g2:'#7fe8b4',w0:'#41261c',w1:'#694635',f0:'#ec89ae',f1:'#f5cb53'}}}},
  crystalCave:{title:'Hang tinh thể lam',note:'Nền hang sẫm, cuội xám, băng tinh thể và gân linh khí lam',
    interior:'boulder',capStyle:'cobble',crustType:'crystal',dripType:'icicle',hangType:'icicle',
    params:{size:.55,density:.35,crust:.3,drip:.45,glow:.75,capH:.4,cracks:.25,pebbles:.35,roots:0,deco:.5},
    props:['crystal','crystal','shard','pebble','shard','crystal','hang','hang'],
    palettes:{
      ...genesisPalettes({rock:'slate',cover:'ice',glow:'ice'}),
      master:{sky:'#223344',colors:{ink:M_INK,m0:'#0d171f',m1:'#162331',m2:'#223344',r0:'#5e788c',r1:'#7a95a7',r2:'#99b0bf',r3:'#b4c5d1',
        c0:'#7a95a7',c1:'#99b0bf',c2:'#b4c5d1',c3:'#d0dde4',kd:'#004264',k0:'#08919b',k1:'#01cbd3',k2:'#6cf2ff',
        g0:'#004264',g1:'#01cbd3',g2:'#6cf2ff',w0:'#41261c',w1:'#694635',f0:'#6cf2ff',f1:'#d9efff'}}}},
  snowIce:{title:'Băng tuyết',note:'Cuội trắng lạnh xếp kín, tuyết phủ dày, nhũ băng',
    interior:'cobble',capStyle:'cobble',crustType:'snow',dripType:'icicle',hangType:'icicle',
    params:{size:.5,density:.7,crust:.6,drip:.35,glow:.1,capH:.5,cracks:.4,pebbles:.2,roots:0,deco:.35},
    props:['snow','snow','shard','pebble','snow','pebble','hang','hang'],
    palettes:{
      ...genesisPalettes({rock:'slate',cap:'ice',cover:'ice',glow:'ice',background:'slate'}),
      master:{sky:'#0d171f',colors:{ink:M_INK,m0:'#435d73',m1:'#5e788c',m2:'#7a95a7',r0:'#7a95a7',r1:'#99b0bf',r2:'#b4c5d1',r3:'#d0dde4',
        c0:'#7a95a7',c1:'#b4c5d1',c2:'#d0dde4',c3:'#d9efff',kd:'#7a95a7',k0:'#99b0bf',k1:'#d0dde4',k2:'#f4efe3',
        g0:'#53accc',g1:'#91d2ec',g2:'#d9efff',w0:'#41261c',w1:'#694635',f0:'#d9efff',f1:'#91d2ec'}}}},
  villagePath:{title:'Đường làng lát đá',note:'Mặt đường đá phiến lớn, nền đất tối, cỏ và dây leo',
    interior:'boulder',capStyle:'slab',crustType:'grass',dripType:'vine',hangType:'vine',
    params:{size:.75,density:.55,crust:.25,drip:.45,glow:0,capH:.6,cracks:.15,pebbles:.2,roots:.2,deco:.6},
    props:['tuft','flower','tuft','sprout','pebble','flower','hang','hang'],
    palettes:{
      ...genesisPalettes({cap:'slate',sky:'blue'}),
      master:{sky:'#6faeef',colors:{ink:M_INK,m0:'#0d171f',m1:'#162331',m2:'#223344',r0:'#162331',r1:'#223344',r2:'#2e4659',r3:'#435d73',
        c0:'#5e788c',c1:'#7a95a7',c2:'#99b0bf',c3:'#b4c5d1',kd:'#173d2a',k0:'#245c2c',k1:'#4a873c',k2:'#7cb759',
        g0:'#0f5c50',g1:'#2fb688',g2:'#7fe8b4',w0:'#41261c',w1:'#694635',f0:'#f4efe3',f1:'#f5cb53'}}}},
  deepStone:{title:'Đá sâu · mạch lam',note:'Đá lạnh tối, rêu xám, mạch linh khí lam mảnh',
    interior:'boulder',capStyle:'cobble',crustType:'moss',dripType:'vine',hangType:'stalactite',
    params:{size:.55,density:.55,crust:.25,drip:.3,glow:.35,capH:.45,cracks:.45,pebbles:.4,roots:.15,deco:.35},
    props:['pebble','sprout','shard','pebble','crystal','tuft','hang','hang'],
    palettes:{
      ...genesisPalettes({cap:'slate',cover:'moss',glow:'blue'}),
      master:{sky:'#0d171f',colors:{ink:M_INK,m0:'#0d171f',m1:'#162331',m2:'#223344',r0:'#2e4659',r1:'#435d73',r2:'#5e788c',r3:'#7a95a7',
        c0:'#435d73',c1:'#5e788c',c2:'#7a95a7',c3:'#99b0bf',kd:'#283b3a',k0:'#3a5647',k1:'#527059',k2:'#6e896f',
        g0:'#004264',g1:'#08919b',g2:'#01cbd3',w0:'#41261c',w1:'#694635',f0:'#c4f0de',f1:'#5dffc0'}}}},
  violetSpirit:{title:'Linh thạch tím',note:'Đá xanh than, tinh thể và gân linh khí tím',
    interior:'boulder',capStyle:'cobble',crustType:'crystal',dripType:'icicle',hangType:'icicle',
    params:{size:.5,density:.5,crust:.3,drip:.4,glow:.85,capH:.4,cracks:.3,pebbles:.3,roots:0,deco:.5},
    props:['crystal','crystal','shard','pebble','shard','crystal','hang','hang'],
    palettes:{
      ...genesisPalettes({rock:'void',cap:'purple',cover:'purple',glow:'purple'}),
      master:{sky:'#162331',colors:{ink:M_INK,m0:'#0d171f',m1:'#162331',m2:'#223344',r0:'#2e4659',r1:'#435d73',r2:'#5e788c',r3:'#7a95a7',
        c0:'#5e788c',c1:'#7a95a7',c2:'#99b0bf',c3:'#b4c5d1',kd:'#5e419e',k0:'#5e419e',k1:'#7c5bc4',k2:'#b99cff',
        g0:'#5e419e',g1:'#9a7de0',g2:'#b99cff',w0:'#41261c',w1:'#694635',f0:'#b99cff',f1:'#ffd0df'}}}}
};
export const GEN_RECIPE_ORDER=['cleanBlock','cleanMoss','cleanDeep','cleanQi','cleanCrystal','cleanViolet','warmLedge','mossCobble','crystalCave','snowIce','villagePath','deepStone','violetSpirit'];

/* thanh trượt: 5 thanh chính + mục Nâng cao. Mọi giá trị trong khoảng 0..1. */
export const GEN_PARAMS=[
  {key:'size',label:'Cỡ đá',main:true,hint:'Đá nhỏ li ti ↔ tảng lớn vắt qua mép ô'},
  {key:'density',label:'Mật độ đá',main:true,hint:'Thưa, nhiều nền tối ↔ đá xếp sát nhau'},
  {key:'crust',label:'Lớp phủ',main:true,hint:'Độ dày cỏ / rêu / tuyết / tinh thể trên mặt'},
  {key:'drip',label:'Rủ xuống',main:true,hint:'Rêu, dây leo, nhũ băng rủ từ mép trên'},
  {key:'glow',label:'Linh khí',main:true,hint:'Gân phát sáng, đốm linh thạch, cụm tinh thể'},
  {key:'capH',label:'Độ dày mặt trên',hint:'Dải cuội ở mép trên, tường, trần'},
  {key:'cracks',label:'Vết nứt',hint:'Tỉ lệ tảng đá có vết nứt'},
  {key:'pebbles',label:'Sỏi nhỏ',hint:'Sỏi 1–2 px rải trong nền'},
  {key:'roots',label:'Rễ cây',hint:'Rễ đâm xuống từ mặt trên'},
  {key:'deco',label:'Trang trí trên bản đồ',hint:'Mật độ cỏ, hoa, tinh thể đặt lên mặt đất khi xem trước'}
];
export const GEN_CRUSTS={grass:'Cỏ',moss:'Rêu',snow:'Tuyết',crystal:'Tinh thể',none:'Không phủ'};
export const GEN_DRIPS={vine:'Rêu / dây leo',icicle:'Nhũ băng',none:'Không rủ'};
export const GEN_INTERIORS={block:'Đá khối xếp so le (sạch)',boulder:'Tảng đá trong nền tối',cobble:'Cuội xếp kín'};
export const GEN_CAPS={block:'Không viền — khối đá chạy thẳng lên mặt',cobble:'Cuội bo tròn',slab:'Đá phiến vuông'};
export const GEN_SEED_GROUPS=[['rock','Đá trong'],['cap','Mặt trên'],['crust','Phủ & rủ'],['vein','Linh khí']];

/* ---------------- sáu tầng đất ----------------
   Tầng 1 là mặt đất, tầng 6 sâu nhất. Đi xuống: cỏ mỏng dần, linh khí đậm dần, lam rồi tím. */
export const GEN_STRATA=[
  {title:'Mặt đất',recipe:'cleanBlock',params:{crust:.5,glow:0}},
  {title:'Tầng rễ',recipe:'cleanMoss',params:{}},
  {title:'Đá sâu',recipe:'cleanDeep',params:{}},
  {title:'Mạch linh thạch',recipe:'cleanQi',params:{}},
  {title:'Hang tinh thể',recipe:'cleanCrystal',params:{}},
  {title:'Linh thạch tím',recipe:'cleanViolet',params:{}}
];

export function randomSeed(){ return (Math.random()*0x7fffffff)>>>0 || 1; }
export function makeSeeds(seed){
  return {rock:terrainHash(seed,1,91)>>>1, cap:terrainHash(seed,2,92)>>>1, crust:terrainHash(seed,3,93)>>>1, vein:terrainHash(seed,4,94)>>>1};
}
/* công thức + phần chỉnh → bản thông số đầy đủ để sinh */
export function makeSpec(recipeId, patch={}){
  const r=GEN_RECIPES[recipeId]||GEN_RECIPES.cleanBlock;
  const seed=Number.isInteger(patch.seed)?patch.seed:1701;
  const palette=Object.hasOwn(r.palettes,patch.palette)?patch.palette:'genesis-v3', base=r.palettes[palette];
  const allowed=palette==='genesis'?GENESIS_COLORS:GENESIS_V3_COLORS;
  const colors={...base.colors},sky=String(patch.sky||'').toLowerCase();
  for(const key of GEN_ROLE_KEYS){
    const hex=patch.colors?.[key]?.toLowerCase?.();
    if(hex && (palette==='master'||allowed.includes(hex))) colors[key]=hex;
  }
  return {
    recipe:GEN_RECIPES[recipeId]?recipeId:'cleanBlock', palette,
    interior:patch.interior||r.interior, capStyle:patch.capStyle||r.capStyle,
    crustType:patch.crustType||r.crustType, dripType:patch.dripType||r.dripType, hangType:r.hangType,
    light:patch.light==='tr'?'tr':'tl',
    params:{...r.params,...(patch.params||{})},
    colors,
    sky:sky && (palette==='master'||allowed.includes(sky))?sky:base.sky,
    props:r.props.slice(),
    seed, seeds:{...makeSeeds(seed),...(patch.seeds||{})}
  };
}
/* nội suy thông số số học giữa hai tầng (t = 0..1); kiểu vẽ và màu giữ theo tầng đích */
export function lerpParams(a,b,t){
  const out={};
  for(const {key} of GEN_PARAMS) out[key]=Math.round(((a[key]??0)+((b[key]??0)-(a[key]??0))*t)*100)/100;
  return out;
}

/* ---------------- tiện ích ngẫu nhiên ---------------- */
function rng(seed){
  let a=(seed>>>0)||1;
  return ()=>{ a=(a+0x6D2B79F5)|0; let t=Math.imul(a^(a>>>15),1|a); t=(t+Math.imul(t^(t>>>7),61|t))^t; return ((t^(t>>>14))>>>0)/4294967296; };
}
const h01=(x,y,s)=>terrainHash(x,y,s)/4294967296;
const wrap=(v,n)=>((v%n)+n)%n;
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
function torusDist(ax,ay,bx,by,n){
  let dx=Math.abs(ax-bx), dy=Math.abs(ay-by);
  if(dx>n/2) dx=n-dx; if(dy>n/2) dy=n-dy;
  return Math.hypot(dx,dy);
}

/* ---------------- hình học từng ô ----------------
   Khoảng cách tới khoảng trống theo bốn hướng, nhìn xuyên sang ô hàng xóm: hướng nào nối thì
   coi hàng xóm là đất liền, hướng nào hở thì là không khí. Không phụ thuộc thông số nên chỉ
   tính một lần cho mỗi cặp khổ ô + dáng mép. */
const geoCache=new Map();
export function tileGeometry(n,shape='inset'){
  const key=n+':'+shape;
  if(geoCache.has(key)) return geoCache.get(key);
  const geo=TERRAIN_TILES.map(t=>{
    const roles=tileRoles(t.slot,n,shape), mask=t.mask;
    const solid=(x,y)=>{
      if(x>=0&&y>=0&&x<n&&y<n) return roles[y*n+x]>0;
      const dx=x<0?-1:x>=n?1:0, dy=y<0?-1:y>=n?1:0;
      if(dx&&dy) return false;
      return !!(mask&(dx<0?8:dx>0?2:dy<0?1:4));
    };
    const dU=new Uint8Array(n*n), dD=new Uint8Array(n*n), dL=new Uint8Array(n*n), dR=new Uint8Array(n*n);
    for(let y=0;y<n;y++) for(let x=0;x<n;x++){
      const i=y*n+x; if(!roles[i]) continue;
      let k=0; while(k<n && solid(x,y-k-1)) k++; dU[i]=k;
      k=0; while(k<n && solid(x,y+k+1)) k++; dD[i]=k;
      k=0; while(k<n && solid(x-k-1,y)) k++; dL[i]=k;
      k=0; while(k<n && solid(x+k+1,y)) k++; dR[i]=k;
    }
    return {roles,dU,dD,dL,dR};
  });
  geoCache.set(key,geo);
  return geo;
}

/* ---------------- tấm vân ruột (lặp vòng n×n) ---------------- */
function bands(n,P,capStyle){
  const T=clamp(Math.round(n*((capStyle==='slab'?.27:.23)+(P.capH??.5)*.16)),3,Math.floor(n*.45));
  return {T, Wt:Math.max(2,T-1), Ct:Math.max(2,Math.round(T*.6))};
}
function background(n,seed){
  const px=new Uint8Array(n*n);
  for(let y=0;y<n;y++) for(let x=0;x<n;x++){
    const h=h01(x,y,seed);
    px[y*n+x]=h<.1?M0:h<.17?M2:M1;
  }
  return px;
}
function sprinklePebbles(px,n,P,seed){
  const p=.004+(P.pebbles??0)*.028;
  for(let y=0;y<n;y++) for(let x=0;x<n;x++){
    if(h01(x,y,seed)>=p) continue;
    const a=y*n+x, b=y*n+wrap(x+1,n), c=wrap(y+1,n)*n+x;
    if(!BACKGROUND.has(px[a])||!BACKGROUND.has(px[b])||!BACKGROUND.has(px[c])) continue;
    px[a]=R2; if(h01(x,y,seed^77)<.6) px[b]=R1; px[c]=R0;
  }
}
/* một tảng đá: hình bầu méo nhẹ, viền mực 1 px, ba bậc sáng theo hướng nắng */
function stampBoulder(px,n,b,L,opt){
  const R=rng(b.seed), p1=R()*6.283, p2=R()*6.283, th=(R()-.5)*.9, co=Math.cos(th), si=Math.sin(th), pw=2+R()*.8;
  const ex0=Math.max(b.rx,b.ry)*1.2+2, ey0=ex0;
  const x0=Math.floor(b.cx-ex0), y0=Math.floor(b.cy-ey0), W=Math.ceil(b.cx+ex0)-x0+1, H=Math.ceil(b.cy+ey0)-y0+1;
  const inside=new Uint8Array(W*H);
  for(let j=0;j<H;j++) for(let i=0;i<W;i++){
    const wx=x0+i+.5-b.cx, wy=y0+j+.5-b.cy;
    const ex=(wx*co+wy*si)/b.rx, ey=(-wx*si+wy*co)/b.ry, a=Math.atan2(ey,ex);
    // siêu elip (mũ 2–2.8): từ bầu tròn tới hòn đá vuông vức; đáy hơi bẹt
    const d=(Math.pow(Math.abs(ex),pw)+Math.pow(Math.abs(ey)*(wy>0?1.08:1),pw))*(1+.12*Math.sin(3*a+p1)+.06*Math.sin(5*a+p2));
    inside[j*W+i]=d<=1?1:0;
  }
  const ins=(i,j)=>i>=0&&j>=0&&i<W&&j<H&&inside[j*W+i]===1;
  const put=(i,j,v)=>{ px[wrap(y0+j,n)*n+wrap(x0+i,n)]=v; };
  for(let j=0;j<H;j++) for(let i=0;i<W;i++)
    if(!ins(i,j) && (ins(i-1,j)||ins(i+1,j)||ins(i,j-1)||ins(i,j+1))) put(i,j,INK);
  const shift=b.dark?1:0;
  let best=-1,bi=-1,bj=-1;
  for(let j=0;j<H;j++) for(let i=0;i<W;i++){
    if(!ins(i,j)) continue;
    const ra=(b.rx+b.ry)/2, ex=(x0+i+.5-b.cx)/ra, ey=(y0+j+.5-b.cy)/ra, lit=ex*L[0]+ey*L[1];
    const rim=!ins(i-1,j)||!ins(i+1,j)||!ins(i,j-1)||!ins(i,j+1);
    let lv=lit>.42?2:lit>-.3?1:0;
    if(rim && lit>.25) lv=3;
    if(rim && (ey>.45 || lit<-.35)) lv=0;
    put(i,j,ROCK[clamp(lv-shift,0,3)]);
    // điểm bắt sáng: điểm trong thân gần phía nắng nhất
    const s=lit-.6*Math.hypot(ex+L[0]*.45,ey+L[1]*.45);
    if(!rim && s>best){ best=s; bi=i; bj=j; }
  }
  if(bi>=0 && b.rx>=2) put(bi,bj,shift?R2:R3);
  if(b.crack){
    const dir=R()<.5?1:-1; let i=Math.round(b.cx-x0-dir*b.rx*.3), j=Math.round(b.cy-y0-b.ry*.25);
    const len=Math.max(2,Math.round(Math.min(b.rx,b.ry)*1.3));
    for(let s=0;s<len;s++){
      if(ins(i,j)&&ins(i-1,j)&&ins(i+1,j)&&ins(i,j+1)) put(i,j,R0);
      j++; if(R()<.55) i+=dir;
    }
  }
  if(opt.moss>0){
    for(let j=0;j<H;j++) for(let i=0;i<W;i++){
      if(!ins(i,j) || ins(i,j-1)) continue;
      if(R()<opt.moss){ put(i,j,K1); if(ins(i,j+1) && R()<.4) put(i,j+1,K0); }
    }
  }
}
/* rải tảng đá không chồng nhau (Poisson đơn giản) trên mặt lặp vòng, hoặc chỉ trong ô cửa sổ */
function scatterBoulders(n,P,seed,keep=[],win=null,extra=null){
  const R=rng(seed), sc=n/16, list=keep.slice();
  const rMin=(1+P.size*.8)*sc, rMax=(1.5+P.size*2.6)*sc, gap=(.3+(1-P.density)*1.6)*sc;
  // độ phủ đá tối đa: thưa thì chừa nhiều nền tối cho mắt nghỉ, dày thì đá xếp sát
  // biến thể: đá giữ lại từ ô gốc nằm phần lớn ngoài cửa sổ, nên ngân sách chỉ tính đá mới rải
  const cover=(.2+P.density*.42)*(win?(win[1]-win[0])**2*.75:n*n);
  let used=win?0:list.reduce((a,b)=>a+Math.PI*b.rx*b.ry,0);
  const tries=Math.round((90+P.density*170)*sc*sc);
  const rad=b=>(b.rx+b.ry)/2;
  const fits=b=>{
    if(win){
      const ex=Math.max(b.rx,b.ry)*1.15+1.6, ey=ex;
      if(b.cx-ex<win[0]||b.cx+ex>win[1]||b.cy-ey<win[0]||b.cy+ey>win[1]) return false;
    }
    return list.every(o=>torusDist(o.cx,o.cy,b.cx,b.cy,n)>=rad(o)+rad(b)+gap+1);
  };
  const make=(r,cx,cy)=>({cx,cy,rx:r*(.85+R()*.45),ry:r*(.7+R()*.45),seed:(R()*0x7fffffff)>>>0,
    crack:R()<(P.cracks??0)*.7 && r>=1.8*sc, dark:R()<.22});
  if(extra){ const b=make(extra.r,extra.cx,extra.cy); b.crack=extra.crack??b.crack; if(fits(b)){ list.push(b); used+=Math.PI*b.rx*b.ry; } }
  // ba lớp cỡ: vài tảng lớn làm điểm nhấn, đá vừa, rồi đá nhỏ lấp kẽ — mỗi lớp một phần ngân sách
  // độ phủ, nên luôn có đủ cả ba cỡ thay vì toàn đá vừa giống nhau
  const tiers=[[rMax*1.25,rMax*.95,.42],[rMax*.85,(rMax+rMin)/2,.75],[rMin*1.3,rMin*.85,1]];
  const lo=win?win[0]:0, hi=win?win[1]:n;
  for(const [ra,rb,share] of tiers){
    for(let t=0;t<tries/3;t++){
      const r=rb+(ra-rb)*R();
      const b=make(r,lo+R()*(hi-lo),lo+R()*(hi-lo));
      if(used+Math.PI*b.rx*b.ry>cover*share) continue;
      if(fits(b)){ list.push(b); used+=Math.PI*b.rx*b.ry; }
    }
  }
  return list;
}
const touchesRing=(b,n,w)=>{
  const ex=Math.max(b.rx,b.ry)*1.15+1.6, ey=ex;
  return b.cx-ex<w || b.cx+ex>n-w || b.cy-ey<w || b.cy+ey>n-w;
};
/* mạch linh khí: vết nứt phát sáng nằm gọn trong lòng ô (không chạm vành), nên không thành
   vạch kẻ lặp lại mỗi n px như khi cho nó chạy vòng qua mép ô */
function vein(px,n,P,seed,win){
  const R=rng(seed), len=Math.round((win[1]-win[0])*(.55+R()*.4));
  let x=win[0]+1+Math.floor(R()*(win[1]-win[0]-2)), y=win[0]+Math.floor(R()*(win[1]-win[0])*.3);
  for(let s=0;s<len && y<win[1] && x>=win[0] && x<win[1];s++){
    const i=y*n+x;
    if(BACKGROUND.has(px[i])){
      px[i]=R()<.2+P.glow*.25?G2:G1;
      for(const dx of [-1,1]){ const j=i+dx; if(x+dx>=win[0]&&x+dx<win[1]&&BACKGROUND.has(px[j]) && R()<.4) px[j]=G0; }
    }
    if(R()<.7) y++;
    if(R()<.45) x+=R()<.5?-1:1;
  }
}
/* đốm linh thạch hình thoi: tâm sáng, bốn cánh */
function sparkle(px,n,x,y,wrapIt=true){
  const at=(dx,dy)=>wrapIt?wrap(y+dy,n)*n+wrap(x+dx,n):(y+dy)*n+x+dx;
  if(!BACKGROUND.has(px[at(0,0)])) return;
  px[at(0,0)]=G2;
  for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) if(BACKGROUND.has(px[at(dx,dy)])) px[at(dx,dy)]=G1;
}
function sparkles(px,n,count,seed,win){
  const R=rng(seed^0x51);
  for(let k=0;k<count;k++) sparkle(px,n,win[0]+1+Math.floor(R()*(win[1]-win[0]-2)),win[0]+1+Math.floor(R()*(win[1]-win[0]-2)),false);
}
/* cụm tinh thể cắm trong đá: hai ba lăng trụ nhọn, mặt trái sáng, viền mực */
function crystalCluster(px,n,cx,base,h,R,wrapIt=false){
  /* tinh thể mọc xiên: cây giữa hơi lệch, hai cây bên xoè ra hai phía như mọc từ một gốc.
     Mỗi cây là một lăng trụ bị trượt ngang theo độ dốc s (x lệch round(j·s) ở hàng j) —
     nét nghiêng kiểu bậc thang, giữ được pixel sắc. Mặt trái sáng, giữa trung, phải tối. */
  const sc=n/16, layer=new Map(), lean=R()<.5?-1:1;
  const wMain=Math.max(3,Math.round(3*sc)|1), wSide=Math.max(3,Math.round(2.5*sc)|1);
  const prisms=[
    {dx:0,h:h,w:wMain,s:lean*(.18+R()*.17)},
    {dx:-Math.round(1.5*sc),h:Math.round(h*.62),w:wSide,s:-(.5+R()*.25)},
    {dx:Math.round(1.5*sc),h:Math.round(h*.72),w:wSide,s:.5+R()*.25}];
  const order=[prisms[1],prisms[2],prisms[0]];
  for(const p of order){
    if(R()<.15 && p!==prisms[0]) continue;
    const half=(p.w-1)/2;
    for(let j=0;j<p.h;j++){
      const y=base-j, tip=p.h-1-j, x0=cx+p.dx-half+Math.round(j*p.s);
      for(let i=0;i<p.w;i++){
        if(tip<half && Math.abs(i-half)>tip) continue;   // đầu nhọn
        const v=i<half?G2:i===half?(j%3===1?G2:G1):G0;
        layer.set((x0+i)+','+y,v);
      }
    }
  }
  const at=(x,y)=>wrapIt?wrap(y,n)*n+wrap(x,n):y*n+x;
  for(const key of layer.keys()){
    const [x,y]=key.split(',').map(Number);
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const k=(x+dx)+','+(y+dy);
      if(!layer.has(k) && (wrapIt||(x+dx>=0&&x+dx<n&&y+dy>=0&&y+dy<n))) px[at(x+dx,y+dy)]=INK;
    }
  }
  for(const [key,v] of layer){ const [x,y]=key.split(',').map(Number); if(wrapIt||(x>=0&&x<n&&y>=0&&y<n)) px[at(x,y)]=v; }
}
/* đoạn rễ vùi trong đất (biến thể ruột): đi chéo, có nhánh */
function rootFragment(px,n,win,R){
  const len=Math.round((win[1]-win[0])*(.7+R()*.3)), dir=R()<.5?1:-1;
  let x=dir>0?win[0]+1:win[1]-2, y=win[0]+Math.floor(R()*3);
  const put=(xx,yy,v)=>{ if(xx>=win[0]&&xx<win[1]&&yy>=win[0]&&yy<win[1]) px[yy*n+xx]=v; };
  for(let s=0;s<len;s++){
    put(x,y,W1); if(s<len*.45) put(x,y+1,W0);           // gốc dày, ngọn mảnh
    if(s===Math.floor(len*.35)||s===Math.floor(len*.7)){ let bx=x,by=y; for(let k=0;k<3;k++){ by++; bx-=dir; put(bx,by,W0); } }
    if(R()<.6) x+=dir; if(R()<.55) y++;
  }
}
/* cuội xếp kín (kiểu Voronoi lặp vòng): mỗi điểm là một viên, khe tối giữa các viên */
function cobblePoints(n,P,seed,keep=[],win=null,guard=null){
  const R=rng(seed), sc=n/16, sp=(3.2+P.size*4.6)*sc, list=keep.slice();
  for(let t=0;t<400*sc*sc;t++){
    const lo=win?win[0]:0, hi=win?win[1]:n;
    const p={x:lo+R()*(hi-lo),y:lo+R()*(hi-lo),tone:R()<.2?-1:R()<.18?1:0,moss:R(),crack:R()<(P.cracks??0)*.5};
    if(list.some(o=>torusDist(o.x,o.y,p.x,p.y,n)<sp)) continue;
    if(guard && !guard(p)) continue;
    list.push(p);
  }
  return list;
}
function cobbleField(n,pts){
  const id=new Int16Array(n*n), d1=new Float32Array(n*n), d2=new Float32Array(n*n);
  for(let y=0;y<n;y++) for(let x=0;x<n;x++){
    let a=1e9,b=1e9,ai=-1;
    for(let k=0;k<pts.length;k++){
      let dx=Math.abs(x+.5-pts[k].x), dy=Math.abs(y+.5-pts[k].y);
      if(dx>n/2) dx=n-dx; if(dy>n/2) dy=n-dy;
      const d=Math.hypot(dx*.85,dy);
      if(d<a){ b=a; a=d; ai=k; } else if(d<b) b=d;
    }
    const i=y*n+x; id[i]=ai; d1[i]=a; d2[i]=b;
  }
  return {id,d1,d2};
}
function cobbleTexture(n,P,spec,pts,field){
  const px=background(n,spec.seeds.rock), gapW=.55+(1-P.density)*1.1;
  const flip=spec.light==='tr';
  const cell=(x,y)=>{ const i=wrap(y,n)*n+wrap(x,n); return field.d2[i]-field.d1[i]<gapW?-1:field.id[i]; };
  for(let y=0;y<n;y++) for(let x=0;x<n;x++){
    const i=y*n+x, c=cell(x,y);
    if(c<0){ px[i]=field.d2[i]-field.d1[i]<gapW*.45?M0:px[i]===M2?M2:M1; continue; }
    const p=pts[c], up=cell(x,y-1)!==c, dn=cell(x,y+1)!==c, lf=cell(x-1,y)!==c, rt=cell(x+1,y)!==c;
    const litSide=flip?rt:lf, darkSide=flip?lf:rt;
    let lv=1;
    if(dn||darkSide) lv=0;
    else if(up) lv=litSide?3:2;
    else if(litSide) lv=2;
    if(!up&&!dn&&!lf&&!rt && h01(x,y,spec.seeds.rock^3)<.08) lv=lv===1?0:lv;
    px[i]=ROCK[clamp(lv+p.tone,0,3)];
    if(p.crack && !up&&!dn&&!lf&&!rt && Math.abs((x+.5-p.x)-(y+.5-p.y)*.6)<.5) px[i]=R0;
    if(spec.crustType==='moss' && p.moss<.3 && (up||h01(x,y,spec.seeds.rock^11)<.3) && !dn) px[i]=h01(x,y,7)<.5?K0:K1;
  }
  return px;
}
/* ---------------- đá khối xếp so le (kiểu tile "sạch") ----------------
   Mỗi hàng gạch cao courseH, hàng cuối là mạch vữa. Mạch đứng chỉ nằm cách cột biên ≥ 5–6 px (blockJointRange):
   cột biên của ô luôn rơi vào giữa một viên đá nên mọi ô cùng chung một cột biên. Hàng gạch
   đầu (chạm hàng biên trên) giữ nguyên ở mọi biến thể; các hàng dưới thì xếp lại tự do.
   Đổ sáng chỉ sát mạch như ảnh mẫu: mép trên + mép trái sáng một đoạn ngắn, mép phải + đáy tối,
   bốn góc viên bo bằng màu vữa. Mặt viên là một màu phẳng. */
/* mạch đứng chỉ được nằm cách cột biên hơn đoạn sáng/bóng sát mạch (3 px ở khổ 16, 4 px ở khổ 32),
   để cột biên luôn là mặt viên phẳng — ô nào, tấm vân lớn nào cũng chung một vành */
const blockJointRange=n=>{ const hl=n>=32?4:3; return [hl+2, n-hl-3]; };
function blockCourseH(n,P){ return n>=32 && (P.size??.5)<.35 ? 8 : n/2; }
function blockLayout(n,P,seed,keep=null){
  const R=rng(seed), H=blockCourseH(n,P), courses=n/H, [lo,hi]=blockJointRange(n), gap=Math.max(6,Math.round(6*n/16));
  const bw=(6+(P.size??.5)*10)*(n/16), want=clamp(Math.round(n/bw),1,Math.floor((hi-lo)/gap)+1);
  const out=[];
  for(let c=0;c<courses;c++){
    if(keep && keep[c]){ out.push(keep[c]); continue; }
    const prev=out[c-1], joints=[];
    for(let t=0;t<80 && joints.length<want;t++){
      let x=lo+Math.floor(R()*(hi-lo+1));
      // so le với hàng trên: tránh đặt mạch ngay dưới mạch cũ
      if(prev && prev.some(j=>Math.abs(j-x)<3)) continue;
      if(joints.some(j=>Math.abs(j-x)<gap)) continue;
      joints.push(x);
    }
    if(!joints.length) joints.push(prev && Math.abs(prev[0]-lo)<3 ? hi : lo);
    out.push(joints.sort((a,b)=>a-b));
  }
  return {H,courses:out};
}
function blockTexture(n,spec,layout,W=n,Ht=n){
  const px=new Uint8Array(W*Ht), flip=spec.light==='tr', {H,courses}=layout, hl=n>=32?4:3;
  for(let y=0;y<Ht;y++){
    const c=Math.floor(y/H), v=y%H, J=courses[c], last=H-2;   // v = H-1 là hàng vữa
    for(let x=0;x<W;x++){
      const i=y*W+x;
      if(v===H-1 || J.includes(x)){ px[i]=INK; continue; }
      let jl=-Infinity, jr=Infinity;
      for(const j of J){ if(j<x) jl=Math.max(jl,j); if(j>x) jr=Math.min(jr,j); }
      if(jl===-Infinity) jl=J[J.length-1]-W;
      if(jr===Infinity) jr=J[0]+W;
      const w=jr-jl-1; let u=x-jl-1;
      if(flip) u=w-1-u;
      let t=R1;
      if((v===0||v===last) && (u===0||u===w-1)) t=INK;                 // góc bo
      else if(v===0 && u<=hl) t=R3;                                     // mép trên sáng
      else if(u===0 && v<=last-3) t=R3;                                 // mép trái sáng
      else if(u===w-1 && v>=Math.floor(last/2)) t=R0;                   // mép phải tối
      else if(v===last && u>=w-1-hl) t=R0;                              // đáy tối
      px[i]=t;
    }
  }
  return px;
}
/* mạch vữa phát sáng: một đoạn mạch (màu viền) đổi sang màu linh khí, chạy theo đường vữa,
   đầu đoạn mờ dần — kiểu đá khối sạch không có nền tối để vẽ gân, nên linh khí đi trong vữa */
function glowSeam(px,n,P,seed,win){
  const R=rng(seed), sc=n/16, isM=(x,y)=>x>=win[0]&&y>=win[0]&&x<win[1]&&y<win[1]&&px[y*n+x]===INK;
  let cur=null;
  for(let t=0;t<120 && !cur;t++){ const x=win[0]+Math.floor(R()*(win[1]-win[0])), y=win[0]+Math.floor(R()*(win[1]-win[0])); if(isM(x,y)) cur=[x,y]; }
  if(!cur) return;
  const len=Math.round((4+(P.glow??.5)*9)*sc), path=[], seen=new Set();
  let dir=[1,0];
  for(let k=0;k<len && cur;k++){
    path.push(cur); seen.add(cur+'');
    const opts=[dir,[dir[1],dir[0]],[-dir[1],-dir[0]],[-dir[0],-dir[1]]].filter(([dx,dy])=>isM(cur[0]+dx,cur[1]+dy)&&!seen.has([cur[0]+dx,cur[1]+dy]+''));
    if(!opts.length) break;
    dir=R()<.75?opts[0]:opts[Math.floor(R()*opts.length)];
    cur=[cur[0]+dir[0],cur[1]+dir[1]];
  }
  path.forEach(([x,y],k)=>{ px[y*n+x]=k===0||k===path.length-1?G0:R()<.25?G2:G1; });
}
/* chi tiết riêng của biến thể đá khối: vết nứt, mẻ góc, viên sáng hơn, rêu trên mép — chỉ ở hàng
   gạch thứ hai trở đi và cách biên ≥ 2 px, để vành ô y hệt ô gốc */
function blockDetails(px,n,spec,v,layout){
  const R=rng(spec.seeds.rock+v*6113), {H}=layout, y0=H, green=['grass','moss'].includes(spec.crustType);
  const inner=(x,y)=>x>=2&&y>=y0&&x<n-2&&y<n-2;
  const pick=test=>{ for(let t=0;t<80;t++){ const x=2+Math.floor(R()*(n-4)), y=y0+Math.floor(R()*(n-y0-2)); if(inner(x,y)&&test(x,y)) return [x,y]; } return null; };
  const P=spec.params;
  const jobs=v===1?['crack','chip']:v===2?['moss','crack']:['light','chip'];
  // biến thể thêm theo tầng: dây rêu rủ (tầng nông), mạch vữa phát sáng (tầng có linh khí)
  if(green && (P.drip??0)>.15) jobs.push('vine');
  if((P.glow??0)>.15) jobs.push('seam');
  for(const job of jobs){
    if(job==='crack'){
      const s=pick((x,y)=>px[y*n+x]===R1 && px[(y+1)*n+x]===R1); if(!s) continue;
      let [x,y]=s; const dir=R()<.5?1:-1;
      for(let k=0;k<Math.round(3+R()*2)*(n/16);k++){ if(!inner(x,y)||px[y*n+x]!==R1) break; px[y*n+x]=R0; y++; if(R()<.6) x+=dir; }
    } else if(job==='chip'){
      const s=pick((x,y)=>px[y*n+x]===R3 && px[(y-1)*n+x]===INK); if(s) px[s[1]*n+s[0]]=INK;
    } else if(job==='moss'){
      for(let y=y0;y<n-2;y++) for(let x=2;x<n-2;x++){ const i=y*n+x; if((px[i]===R3||px[i]===R1) && px[i-n]===INK && R()<.5) px[i]=green?K1:R0; }
    } else if(job==='vine'){
      // dây rêu rủ từ một hàng vữa xuống, lá so le hai bên
      const s=pick((x,y)=>px[y*n+x]===INK && px[(y+1)*n+x]!==INK && y<n-5); if(!s) continue;
      let [x,y]=s; const len=Math.round((3+R()*4)*(n/16));
      for(let k=1;k<=len && y+k<n-2;k++){ const i=(y+k)*n+x; px[i]=k%2?K0:K1; if(k%3===2){ const sx=x+(k%2?1:-1); if(sx>=2&&sx<n-2) px[(y+k)*n+sx]=K1; } }
    } else if(job==='seam'){
      glowSeam(px,n,P,spec.seeds.vein+v*131,[2,n-2]);
    } else if(job==='light'){
      const s=pick((x,y)=>px[y*n+x]===R1); if(!s) continue;
      // tô sáng cả viên chứa điểm này (loang trong mặt viên, không qua mạch)
      const stack=[s], seen=new Set();
      while(stack.length){ const [x,y]=stack.pop(), k=y*n+x; if(seen.has(k)||!inner(x,y)||px[k]!==R1) continue; seen.add(k); px[k]=R2;
        stack.push([x+1,y],[x-1,y],[x,y+1],[x,y-1]); }
    }
  }
}
function interiorTextures(n,spec,extra=0){
  const P=spec.params, S=spec.seeds, L=spec.light==='tr'?[.6,-.8]:[-.6,-.8];
  const win=[2,n-2], moss=spec.crustType==='moss'?.12:0, sc=n/16;
  const glowOk=P.glow>=.4, out={base:null,variants:[],plain:[],more:[]};
  /* gân và đốm sáng chỉ nằm trong biến thể (không ở ô gốc): ô gốc là tấm nền êm nhất, lặp nhiều
     nhất; nét sáng đặt ở đó sẽ thành hoa văn đều tăm tắp */
  const glowDetails=(tex,v,plain)=>{
    if(P.glow<.08) return;
    if(spec.interior==='block'){ if(plain && v===2 && P.glow>.45) glowSeam(tex,n,P,S.vein+v*71,win); return; }
    const sp=Math.round(P.glow*P.glow*(plain?1.2:3)*sc*sc);
    if(!plain && v>=2 || plain && v===2 && P.glow>.45) vein(tex,n,P,S.vein+v*17,win);
    sparkles(tex,n,sp,S.vein+v*29,win);
  };
  let texOf, extraDetails=()=>{};
  if(spec.interior==='block'){
    const base=blockLayout(n,P,S.rock);
    out.base=blockTexture(n,spec,base);
    // ô mép chỉ đổi chỗ mạch (sạch); vết nứt, mẻ góc, rêu là nét riêng của biến thể ruột
    const lays={};
    texOf=v=>{ lays[v]=blockLayout(n,P,S.rock+v*7919,{0:base.courses[0]}); return blockTexture(n,spec,lays[v]); };
    extraDetails=(tex,v)=>blockDetails(tex,n,spec,v,lays[v]);
  } else if(spec.interior==='cobble'){
    const base=cobblePoints(n,P,S.rock);
    const bf=cobbleField(n,base);
    out.base=cobbleTexture(n,P,spec,base,bf);
    // giữ những viên quyết định màu của vành 2 px (gần nhất và gần nhì); viên mới không được chen vào
    const ring=2, ringPx=[], keepIds=new Set();
    for(let y=0;y<n;y++) for(let x=0;x<n;x++) if(x<ring||y<ring||x>=n-ring||y>=n-ring){
      let a=1e9,b=1e9,ai=-1,bi=-1;
      base.forEach((p,k)=>{ let dx=Math.abs(x+.5-p.x),dy=Math.abs(y+.5-p.y); if(dx>n/2)dx=n-dx; if(dy>n/2)dy=n-dy;
        const d=Math.hypot(dx*.85,dy); if(d<a){b=a;bi=ai;a=d;ai=k;} else if(d<b){b=d;bi=k;} });
      keepIds.add(ai); if(bi>=0) keepIds.add(bi);
      ringPx.push([x,y,b]);
    }
    const kept=base.filter((_,k)=>keepIds.has(k));
    const guard=p=>ringPx.every(([x,y,d2])=>{ let dx=Math.abs(x+.5-p.x),dy=Math.abs(y+.5-p.y); if(dx>n/2)dx=n-dx; if(dy>n/2)dy=n-dy; return Math.hypot(dx*.85,dy)>d2+1.6; });
    /* viên không chạm vành: xê dịch chỗ, đổi sắc độ, rêu, vết nứt theo hạt của biến thể;
       rồi chen thêm viên mới vào chỗ trống nếu còn */
    texOf=v=>{
      const R=rng(S.rock+v*7919), free=base.filter((_,k)=>!keepIds.has(k)).map(p=>{
        const q={...p,tone:R()<.25?-1:R()<.2?1:0,moss:R(),crack:R()<(P.cracks??0)*.6};
        const j={...q,x:q.x+(R()-.5)*3*(n/16),y:q.y+(R()-.5)*3*(n/16)};
        return guard(j)?j:q;
      });
      const pts=cobblePoints(n,P,S.rock+v*7919,[...kept,...free],win,guard), field=cobbleField(n,pts);
      const tex=cobbleTexture(n,P,spec,pts,field);
      cobbleDetails(tex,n,spec,v,field,pts);
      return tex;
    };
  } else {
    const paint=list=>{
      const px=background(n,S.rock);
      sprinklePebbles(px,n,P,S.rock^0x2f);
      list.forEach(b=>stampBoulder(px,n,b,L,{moss}));
      return px;
    };
    const base=scatterBoulders(n,P,S.rock);
    out.base=paint(base);
    // chỉ giữ đá chạm vành 1 px ngoài cùng; phần còn lại rải lại hết
    const kept=base.filter(b=>touchesRing(b,n,1));
    texOf=v=>{
      const R=rng(S.rock+v*104729);
      const big=v===1&&!glowOk ? {r:(1.6+P.size*2.6)*sc,cx:n/2+(R()-.5)*n*.2,cy:n/2+(R()-.5)*n*.2,crack:true} :
        v===2&&!(P.roots>0) ? {r:(1.3+P.size*1.8)*sc,cx:n/2+(R()-.5)*n*.25,cy:n/2+(R()-.5)*n*.25,crack:true} : null;
      const tex=paint(scatterBoulders(n,P,S.rock+v*7919,kept,[1,n-1],big));
      boulderDetails(tex,n,spec,v);
      return tex;
    };
  }
  for(let v=1;v<=3;v++){
    // tấm cho ô mép dùng hạt riêng: khác cả ô gốc lẫn biến thể ruột, để vân lớn có đủ 9 ô con khác nhau
    const tex=texOf(v), plain=texOf(v+10);
    glowDetails(plain,v,true); out.plain.push(plain);
    extraDetails(tex,v); glowDetails(tex,v,false); rareFeature(tex,n,spec,v,win,glowOk); out.variants.push(tex);
  }
  // thêm tấm cho vân lớn (macro): cùng vành, chi tiết riêng, không có nét hiếm
  for(let v=4;v<4+extra;v++){ const tex=texOf(v); extraDetails(tex,v); glowDetails(tex,v,false); out.more.push(tex); }
  // lưới an toàn: vành 1 px của biến thể luôn y hệt ô gốc
  for(const tex of [...out.variants,...out.plain,...out.more]) for(let i=0;i<n;i++) for(const k of [i,(n-1)*n+i,i*n,i*n+n-1]) tex[k]=out.base[k];
  return out;
}
/* chi tiết riêng của biến thể kiểu cuội xếp kín: ở khổ 16 viên nào cũng chạm vành nên không
   xếp lại được — thay vào đó vẽ thêm vết nứt, mảng rêu, viên sẫm, chỉ trong lòng ô (cách biên ≥ 2 px) */
function cobbleDetails(px,n,spec,v,field,pts){
  const R=rng(spec.seeds.rock+v*4421), gapW=.55+(1-spec.params.density)*1.1;
  const cellAt=(x,y)=>{ const i=y*n+x; return field.d2[i]-field.d1[i]<gapW?-1:field.id[i]; };
  const inner=(x,y)=>x>=2&&y>=2&&x<n-2&&y<n-2;
  const cells=[...new Set(Array.from({length:(n-4)*(n-4)},(_,k)=>cellAt(2+k%(n-4),2+Math.floor(k/(n-4)))).filter(c=>c>=0))];
  const pick=()=>cells[Math.floor(R()*cells.length)];
  const greenTop=['moss','grass'].includes(spec.crustType);
  const jobs=v===1?['crack','moss','dark']:v===2?['moss','crack','crack']:['dark','moss','chip'];
  for(const job of jobs){
    const c=pick(); if(c==null) continue;
    for(let y=2;y<n-2;y++) for(let x=2;x<n-2;x++){
      if(cellAt(x,y)!==c) continue;
      const i=y*n+x, top=cellAt(x,y-1)!==c, edge=top||cellAt(x,y+1)!==c||cellAt(x-1,y)!==c||cellAt(x+1,y)!==c;
      if(job==='dark' && !edge) px[i]=DARKER[px[i]];
      else if(job==='moss' && top) px[i]=greenTop?(R()<.5?K1:K0):R1;
      else if(job==='crack' && !edge && Math.abs((x+.5-pts[c].x)+(y+.5-pts[c].y)*.7)<.6) px[i]=R0;
      else if(job==='chip' && !edge && R()<.18) px[i]=R3;
    }
  }
}
/* chi tiết riêng của biến thể kiểu tảng đá: vết nứt, cụm sỏi, rêu trên đỉnh đá — luôn có, để
   biến thể khác ô gốc cả khi đá chạm vành phủ kín ô 16 px không còn chỗ rải lại */
function boulderDetails(px,n,spec,v){
  const R=rng(spec.seeds.rock+v*5153), inner=(x,y)=>x>=2&&y>=2&&x<n-2&&y<n-2;
  const rock=v=>v===R1||v===R2||v===R3, sc=n/16, greenTop=['moss','grass'].includes(spec.crustType);
  const spots=[]; for(let y=2;y<n-2;y++) for(let x=2;x<n-2;x++) spots.push([x,y]);
  const any=(test)=>{ for(let t=0;t<60;t++){ const s=spots[Math.floor(R()*spots.length)]; if(test(...s)) return s; } return null; };
  const jobs=v===1?['crack','pebbles','crack']:v===2?['moss','pebbles','crack']:['pebbles','pebbles','moss'];
  for(const job of jobs){
    if(job==='crack'){
      const s=any((x,y)=>rock(px[y*n+x])); if(!s) continue;
      let [x,y]=s, dir=R()<.5?1:-1;
      for(let k=0;k<Math.round((3+R()*3)*sc);k++){ if(!inner(x,y)||!rock(px[y*n+x])) break; px[y*n+x]=R0; y++; if(R()<.5) x+=dir; }
    } else if(job==='pebbles'){
      for(let k=0;k<Math.round((2+R()*2)*sc);k++){
        const s=any((x,y)=>inner(x+1,y+1)&&BACKGROUND.has(px[y*n+x])&&BACKGROUND.has(px[y*n+x+1])&&BACKGROUND.has(px[(y+1)*n+x])); if(!s) break;
        const [x,y]=s; px[y*n+x]=R2; px[y*n+x+1]=R1; px[(y+1)*n+x]=R0;
      }
    } else if(job==='moss'){
      for(let y=2;y<n-2;y++) for(let x=2;x<n-2;x++){
        const i=y*n+x; if(rock(px[i]) && px[i-n]===INK && R()<.45) px[i]=greenTop?K1:R3;
      }
    }
  }
}
/* nét riêng của từng biến thể ruột — để khi game rải ngẫu nhiên, mắt có chỗ dừng */
function rareFeature(px,n,spec,v,win,glowOk){
  const P=spec.params, R=rng(spec.seeds.rock+v*31337), sc=n/16;
  if(v===1 && glowOk){
    const h=Math.round(n*(.5+P.glow*.12)), cx=Math.round(n/2+(R()-.5)*n*.15);
    // đá khối: cụm tinh thể mọc từ mạch vữa dưới, xiên lên trên mặt viên
    const base=spec.interior==='block' ? n-3 : Math.round(n*.68+R()*n*.08);
    crystalCluster(px,n,cx,Math.min(base,win[1]-2),Math.min(h,base-win[0]-1),R);
  } else if(v===2 && P.roots>0){
    rootFragment(px,n,[win[0]+1,win[1]-1],R);
  } else if(v===3){
    if(P.glow>0) for(let k=0;k<2+Math.round(P.glow*3*sc);k++)
      sparkle(px,n,win[0]+2+Math.floor(R()*(win[1]-win[0]-4)),win[0]+2+Math.floor(R()*(win[1]-win[0]-4)),false);
    else for(let k=0;k<Math.round(5*sc*sc);k++){
      const x=win[0]+1+Math.floor(R()*(win[1]-win[0]-3)), y=win[0]+1+Math.floor(R()*(win[1]-win[0]-3)), i=y*n+x;
      if(BACKGROUND.has(px[i])&&BACKGROUND.has(px[i+1])&&BACKGROUND.has(px[i+n])){ px[i]=R2; px[i+1]=R1; px[i+n]=R0; }
    }
  }
}

/* ---------------- dải cuội ở mép ----------------
   Chia chu kỳ n thành các viên; viên đầu vắt qua biên (khe không bao giờ nằm ở cột 0 hay n-1).
   Biến thể chỉ chia lại phần giữa, giữ viên vắt biên. */
function partition(n,seed,wMin,wMax,variant=0){
  // viên vắt biên rộng ≥ 5 và bắt đầu ở -3 trở về trước: khe (u=0) và góc bo (u=1, u=w-1)
  // đều nằm trong khoảng cột 1..n-2, không bao giờ đụng cột biên
  const R=rng(seed), w0=Math.max(5,Math.round(wMin+(wMax-wMin)*R()));
  const tone=f=>f<.22?-1:f>.88?1:0;            // vài viên tối hơn / sáng hơn cho đỡ đều
  const s=-(3+Math.floor(R()*Math.max(1,w0-4))), e=s+w0, segs=[[s,e,tone(R())]];
  const V=variant?rng(seed+variant*6007):R;
  let at=e, end=s+n;
  while(at<end){
    const left=end-at;
    let w=Math.round(wMin+(wMax-wMin)*V());
    if(left-w<wMin) w=left<=wMax?left:Math.round(left/2);
    segs.push([at,at+w,tone(V())]); at+=w;
  }
  const look=new Array(n);
  for(let x=0;x<n;x++) for(const [a,b,t] of segs) for(const xx of [x,x-n]) if(xx>=a&&xx<b) look[x]=[xx-a,b-a,t];
  return look;     // look[x] = [vị trí trong viên, bề rộng viên, sắc độ riêng]
}
/* bậc sáng của một pixel trong viên cuội: u dọc dải, v tính từ mặt hở vào trong */
function cobbleLevel(u,w,v,T,slab,flip,big=false){
  if(u===0) return -1;
  if(big && !slab && v===0 && (u===1||u===w-1)) return -1;      // khổ 32: bo thêm một nấc ở góc trên
  if(v===T-1) return 0;
  const lit=flip?w-1:1, dark=flip?1:w-1;
  let lv=v<=1?3:v===2?2:1;
  if(u===dark) lv-=1;
  else if(u===lit && v>0) lv+=1;
  if(!slab && v===0 && (u===1||u===w-1)) lv=Math.min(lv,2);
  return clamp(lv,0,3);
}

/* ---------------- sinh cả bộ 56 ô ----------------
   trả về 56 mảng chỉ số vai trò (Uint8Array n*n, 0 = trong suốt) */
export function generateTerrainRoles(spec,n=16,shape='inset'){
  const P=spec.params, S=spec.seeds, geo=tileGeometry(n,shape), r=shapeInset(shape,n);
  const {T,Wt,Ct}=bands(n,P,spec.capStyle), slab=spec.capStyle==='slab', flip=spec.light==='tr';
  const tex=interiorTextures(n,spec);
  const sc=n/16, wMin=Math.round((slab?6:3)*sc), wMax=Math.round((slab?10:6.4)*sc);
  const capParts=[0,1,2,3].map(v=>partition(n,S.cap,wMin,wMax,v));
  const ceilParts=[0,1].map(v=>partition(n,S.cap^0x5bd1,wMin,wMax,v));
  const wallParts=[0,1].map(v=>partition(n,S.cap^0x2c9b,Math.max(3,wMin-1),wMax,v));
  const crustOn=spec.crustType!=='none' && P.crust>.02;
  // kiểu sạch: không dải cuội, khối đá chạy thẳng lên mặt; lớp phủ là một dải đều 3 bậc + giọt mép
  const clean=spec.capStyle==='block';
  const kBase=!crustOn?0:clean?Math.max(2,Math.round(P.crust*n*.36)):Math.max(1,Math.round(P.crust*T*(spec.crustType==='snow'?.6:.42)));
  // lớp phủ dày theo từng cột; biến thể sàn chỉ đổi các cột giữa
  const colSeed=(x,variant)=>variant && x>=2 && x<=n-3 ? S.crust+variant*911 : S.crust;
  const crustK=(x,variant)=>{
    if(!crustOn) return 0;
    if(clean) return kBase;
    const h=h01(x,0,colSeed(x,variant));
    let k=kBase+(h>.78?1:0);
    if(spec.crustType==='snow'){ const [u,w]=capParts[0][x]; k=kBase+(u>0&&u<w-1?1:0)+(h>.85?1:0); }
    return clamp(k,1,T);
  };
  // dây rủ / rễ chỉ mọc ở các cột giữa: cột sát biên lặp y hệt ở mọi ô sàn, thành hàng rào đều tăm tắp
  const drips=(x,variant)=>{
    const s=colSeed(x,variant), h=h01(x,1,s), out=[];
    if(x<2 || x>n-3) return out;
    if(spec.dripType!=='none' && P.drip>.02 && h<.05+P.drip*.3)
      out.push({type:spec.dripType,len:Math.max(2,Math.round((1.5+h01(x,2,s)*P.drip*9)*sc)),side:h01(x,3,s)<.5?-1:1});
    if(P.roots>.02 && h01(x,4,s)<P.roots*.075)
      out.push({type:'root',len:Math.round((2.5+h01(x,5,s)*h01(x,6,s)*9)*sc),seed:terrainHash(x,6,s)});
    return out;
  };
  const tiles=[];
  for(const t of TERRAIN_TILES){
    // biến thể mép có khía 1 px ở giữa cạnh (gợi ý cho người vẽ tay); bộ sinh tự làm gồ ghề bằng
    // khe cuội, nên dùng hình học của ô gốc — nếu không khía ấy bị hiểu thành một mặt đất mới
    const G=geo[t.slot>=50?variantBase(t.slot):t.slot], out=new Uint8Array(n*n), clear=new Uint8Array(n*n);
    // ô giữa và biến thể ruột có nét riêng; ô mép lấy một trong bốn tấm vân cùng vành (không nét riêng)
    // để hàng đá ngay dưới mặt sàn không lặp y hệt nhau ở mọi ô
    const texture=t.slot===46 ? tex.base : t.slot>=47&&t.slot<=49 ? tex.variants[t.variant-1] :
      [tex.base,...tex.plain][terrainHash(t.slot,5,S.rock)%4];
    const floorVar=t.kind==='edge'&&t.mask===110 ? t.variant : 0;
    const capP=capParts[floorVar], ceilP=ceilParts[t.slot===53?1:0];
    const wallLP=wallParts[t.slot===54?1:0], wallRP=wallParts[t.slot===55?1:0];
    for(let y=0;y<n;y++) for(let x=0;x<n;x++){
      const i=y*n+x; if(!G.roles[i]) continue;
      const u=G.dU[i], d=G.dD[i], l=G.dL[i], rr=G.dR[i];
      let v=texture[i];
      if(clean){
        // mép hở: trên và phía nắng sáng một hàng, phía khuất và đáy là màu vữa
        if(u===0) v=C3;
        if(l===0) v=flip?INK:C3;
        if(rr===0) v=flip?C3:INK;
        if(d===0) v=INK;
        out[i]=v; continue;
      }
      if(u===T) v=INK; else if(u===T+1) v=DARKER[v];
      if(d===Ct) v=INK;
      if(l===Wt||rr===Wt) v=v===INK?INK:DARKER[v];
      let notch=false;
      if(d<Ct){
        const [cu,cw,ct]=ceilP[x], lv=cobbleLevel(cu,cw,Ct-1-d,Ct,slab,flip);
        v=lv<0?(d===0?INK:C0):CAP[clamp(lv-2+ct,0,3)];
        if(d===0) v=lv<0?INK:C0;
        if(lv<0&&d===0) notch=true;
      }
      const wall=l<Wt?{u:wallLP[y],v:l,lit:!flip}:rr<Wt?{u:wallRP[y],v:rr,lit:flip}:null;
      if(wall){
        const [wu,ww,wt]=wall.u, lv=cobbleLevel(wu,ww,wall.v,Wt,slab,false,n>=32);
        v=lv<0?(wall.v===Wt-1?INK:C0):CAP[clamp(lv-(wall.lit?1:2)+wt,0,3)];
        notch=lv<0&&wall.v===0;
      }
      if(u<T){
        const [cu,cw,ct]=capP[x], lv=cobbleLevel(cu,cw,u,T,slab,flip,n>=32);
        v=lv<0?(u===0?C0:INK):CAP[clamp(lv+(lv===3&&ct>0?0:ct),0,3)];
        notch=lv<0&&u===0;
      }
      out[i]=v;
      if(notch && !crustOn) clear[i]=1;
    }
    // lớp phủ trên mặt
    if(crustOn) for(let y=0;y<n;y++) for(let x=0;x<n;x++){
      const i=y*n+x; if(!G.roles[i]) continue;
      const u=G.dU[i], k=crustK(x,floorVar);
      if(clean){
        const h=h01(x,y,S.crust^0x3d);
        if(u<k) out[i]=u===0?(h<.35?K2:K1):u===k-1?KD:(h<.18?K1:K0);
        else if(u===k && h01(x,9,colSeed(x,floorVar))<.3) out[i]=KD;                 // giọt rủ một pixel
        else if(n>=32 && u===k+1 && h01(x,9,colSeed(x,floorVar))<.12) out[i]=KD;
        continue;
      }
      if(u<k){
        if(spec.crustType==='crystal') out[i]=u===0?(h01(x,y,S.crust^8)<.3?K2:K1):h01(x,y,S.crust)<.5?K0:out[i];
        else out[i]=u===0?K2:u===k-1?K0:K1;
      } else if(u===k && h01(x,9,colSeed(x,floorVar))<.2 && spec.crustType!=='crystal') out[i]=K0;
    }
    // rủ xuống: dây rêu, nhũ băng, rễ — dừng trước hàng cuối và trước dải trần
    for(let x=0;x<n;x++){
      const k=crustK(x,floorVar);
      for(const dr of drips(x,floorVar)){
        let cx=x;
        const R=dr.seed?rng(dr.seed):null;
        for(let s=0;s<dr.len;s++){
          let y=-1;
          for(let yy=0;yy<n;yy++){ const i=yy*n+cx; if(G.roles[i] && G.dU[i]===k+s){ y=yy; break; } }
          if(y<0 || y>n-2) break;
          const i=y*n+cx; if(G.dD[i]<=Ct) break;
          if(dr.type==='vine'){
            out[i]=s===dr.len-1?K1:s%2?K0:K1;
            if(s%3===1){ const sx=cx+dr.side*(s%2?1:-1); if(sx>=0&&sx<n&&G.roles[y*n+sx]) out[y*n+sx]=h01(sx,y,5)<.5?K2:K1; }
          } else if(dr.type==='icicle'){
            const tipping=s>=dr.len/2;
            out[i]=s===dr.len-1?G2:flip?K1:K2;
            if(!tipping){ const sx=cx+(flip?-1:1); if(sx>=0&&sx<n&&G.roles[y*n+sx]) out[y*n+sx]=flip?K2:K1; }
          } else if(dr.type==='root'){
            out[i]=W1; if(cx+1<n-1 && G.roles[i+1]) out[i+1]=W0;
            if(R()<.45 && cx>1 && cx<n-3) cx+=R()<.5?-1:1;
          }
        }
      }
    }
    // bo tròn góc lồi: pixel có khoảng trống ngay trên/dưới và ngay trái/phải
    for(let y=0;y<n;y++) for(let x=0;x<n;x++){
      const i=y*n+x; if(!G.roles[i]) continue;
      const vU=G.dU[i]===0, vD=G.dD[i]===0, hL=G.dL[i]===0, hR=G.dR[i]===0;
      const big=n>=32 && ((G.dU[i]+G.dL[i]<=1&&(G.dU[i]===0||G.dL[i]===0)&&G.dU[i]<=1&&G.dL[i]<=1) ||
        (G.dU[i]+G.dR[i]<=1&&G.dU[i]<=1&&G.dR[i]<=1));
      if(((vU||vD)&&(hL||hR)) || big) clear[i]=1;
    }
    // trang trí trong khoảng thụt (không chạm hàng/cột biên — giữ mối nối alpha)
    if(r>=2) for(let y=1;y<n-1;y++) for(let x=1;x<n-1;x++){
      const i=y*n+x; if(G.roles[i]) continue;
      let h=1; while(y+h<n && !G.roles[(y+h)*n+x] && h<=r) h++;
      if(y+h<n && G.roles[(y+h)*n+x] && G.dU[(y+h)*n+x]===0 && !clear[(y+h)*n+x] && crustOn){
        if(clean) continue;                    // kiểu sạch: không cọng cỏ lơ thơ trong phần thụt
        const s=colSeed(x,floorVar), want=Math.floor(h01(x,7,s)*(r)*Math.min(1,P.crust*1.6+.2));
        if(spec.crustType==='grass'||spec.crustType==='moss'){ if(h<=want) out[i]=h===want?K2:K1; }
        else if(spec.crustType==='crystal'){ if(h<=want && h01(x,8,s)<.45) out[i]=h===want?K2:K1; }
        else if(spec.crustType==='snow'){ if(h===1 && h01(x,8,s)<.55) out[i]=K2; }
        continue;
      }
      let a=1; while(y-a>=0 && !G.roles[(y-a)*n+x] && a<=r) a++;
      if(y-a>=0 && G.roles[(y-a)*n+x] && G.dD[(y-a)*n+x]===0 && !clear[(y-a)*n+x]){
        const s=S.crust^0x77, want=Math.floor(h01(x,7,s)*r*Math.min(1,P.drip*1.6+.15));
        if(a<=want){
          out[i]=spec.hangType==='icicle'?(a===want?G2:K2):spec.hangType==='vine'?(a===want?K2:K1):(a===want?C1:C0);
        }
      }
    }
    for(let i=0;i<n*n;i++) if(clear[i]) out[i]=0;
    tiles.push(out);
  }
  return tiles;
}

/* ---------------- màu ---------------- */
export const hexToRgba=hex=>{
  const n=parseInt(hex.slice(1),16);
  return ((n>>16)|((n>>8)&255)<<8|(n&255)<<16|0xff000000)>>>0;
};
export function colorLut(colors){
  const lut=new Uint32Array(GEN_ROLE_KEYS.length+1);
  GEN_ROLE_KEYS.forEach((k,i)=>{ lut[i+1]=hexToRgba(colors[k]||'#ff00ff'); });
  return lut;
}
export function colorize(roleTiles,colors){
  const lut=colorLut(colors);
  return roleTiles.map(t=>Uint32Array.from(t,v=>lut[v]));
}
export function generateTerrain(spec,n=16,shape='inset'){
  return colorize(generateTerrainRoles(spec,n,shape),spec.colors);
}

/* ---------------- vân lớn (macro) ----------------
   Tấm size×size ô (mặc định 3×3 = 48×48 ở khổ 16) cho các ô đặc mask 255: game lấy ô con
   (x mod size, y mod size) thay cho #46–#49, nên mặt đá lớn không còn nhịp lặp mỗi ô.
   Tấm lặp vòng bốn phía. Vành 1 px của MỖI ô con trùng vành ô ruột #46, để chỗ vân lớn gặp
   ô có mép (sàn, tường, trần) vẫn liền như hai ô ruột cạnh nhau.
   - Đá khối: viên đá được dài vắt qua ranh ô con (cột biên luôn là giữa viên), hàng gạch đầu
     của mỗi hàng ô con theo ô gốc; các hàng dưới xếp lại trên cả bề rộng 3 ô.
   - Kiểu khác: 9 ô con là 9 tấm ruột khác nhau cùng vành (ô gốc, 3 biến thể, 3 ô mép, 2 tấm thêm).
   Trả về Uint8Array (size·n)² chỉ số vai trò. */
export function generateMacroRoles(spec,n=16,size=3){
  const W=size*n, P=spec.params, S=spec.seeds;
  if(spec.interior==='block'){
    const base=blockLayout(n,P,S.rock), H=base.H, per=n/H, R=rng(S.rock^0x6d6163);
    const gap=Math.max(6,Math.round(6*n/16)), bw=(6+(P.size??.5)*10)*(n/16)*1.5, want=Math.max(2,Math.round(W/bw));
    const [jlo,jhi]=blockJointRange(n), ok=x=>{ const m=((x%n)+n)%n; return m>=jlo && m<=jhi; };
    const dist=(a,b)=>{ const d=Math.abs(a-b)%W; return Math.min(d,W-d); };
    const courses=[];
    for(let c=0;c<size*per;c++){
      if(c%per===0){ courses.push(Array.from({length:size},(_,k)=>base.courses[0].map(j=>j+k*n)).flat().sort((a,b)=>a-b)); continue; }
      // số mạch mỗi hàng thay đổi: có hàng viên dài vắt qua hai ô con, có hàng viên ngắn
      const prev=courses[c-1], J=[], wantC=Math.max(1,want-1+Math.floor(R()*3));
      for(let t=0;t<400 && J.length<wantC;t++){
        const x=Math.floor(R()*W);
        if(!ok(x) || prev.some(j=>dist(j,x)<3) || J.some(j=>dist(j,x)<gap)) continue;
        J.push(x);
      }
      if(!J.length) J.push(jlo);
      courses.push(J.sort((a,b)=>a-b));
    }
    const px=blockTexture(n,spec,{H,courses},W,W);
    // vài ô con có thêm vết nứt / mẻ góc / rêu (chỉ trong lòng ô con)
    const order=[0,1,2,3,4,5,6,7,8].sort(()=>R()-.5).slice(0,6);
    order.forEach((cell,k)=>{
      const ox=(cell%size)*n, oy=Math.floor(cell/size)*n, t=new Uint8Array(n*n);
      for(let y=0;y<n;y++) for(let x=0;x<n;x++) t[y*n+x]=px[(oy+y)*W+ox+x];
      blockDetails(t,n,{...spec,seeds:{...S,rock:S.rock+k*977}},1+k%3,{H});
      for(let y=0;y<n;y++) for(let x=0;x<n;x++) px[(oy+y)*W+ox+x]=t[y*n+x];
    });
    return px;
  }
  const tex=interiorTextures(n,spec,Math.max(0,size*size-7));
  const pool=[tex.base,...tex.variants,...tex.plain,...tex.more];
  const R=rng(S.rock^0x4d41), order=pool.map((_,i)=>i).sort(()=>R()-.5);
  const px=new Uint8Array(W*W);
  for(let c=0;c<size*size;c++){
    const t=pool[order[c%pool.length]], ox=(c%size)*n, oy=Math.floor(c/size)*n;
    for(let y=0;y<n;y++) px.set(t.subarray(y*n,y*n+n),(oy+y)*W+ox);
  }
  return px;
}
export function generateMacro(spec,n=16,size=3){
  const lut=colorLut(spec.colors);
  return {size,n,w:size*n,px:Uint32Array.from(generateMacroRoles(spec,n,size),v=>lut[v])};
}

/* ---------------- trang trí rời (props) ----------------
   Cỏ, hoa, mầm, tinh thể, sỏi, nhũ… vẽ thành ô riêng để game rải lên mặt đất. Ô đặt lên
   đất thì neo đáy (anchor bottom), ô treo dưới trần thì neo đỉnh (anchor top). */
export const PROP_NAMES={tuft:'Cụm cỏ',flower:'Hoa',sprout:'Mầm non',crystal:'Cụm tinh thể',shard:'Mảnh tinh thể',
  pebble:'Đá cuội',snow:'Ụ tuyết',hang:'Treo dưới trần'};
function outlineLayer(px,n){
  const out=px.slice();
  for(let y=0;y<n;y++) for(let x=0;x<n;x++){
    const i=y*n+x; if(px[i]) continue;
    if((x>0&&px[i-1])||(x<n-1&&px[i+1])||(y>0&&px[i-n])||(y<n-1&&px[i+n])) out[i]=INK;
  }
  return out;
}
function propRoles(kind,n,spec,seed){
  const R=rng(seed), px=new Uint8Array(n*n), sc=n/16, B=n-1;
  const set=(x,y,v)=>{ if(x>=0&&y>=0&&x<n&&y<n) px[y*n+x]=v; };
  const blades=(count,hMax,cols=[K0,K1,K2])=>{
    for(let b=0;b<count;b++){
      let x=Math.round(n/2+(R()-.5)*n*.55); const h=Math.max(2,Math.round(hMax*(.45+R()*.55))), lean=R()<.5?-1:1;
      for(let j=0;j<h;j++){ set(x,B-j,j===h-1?cols[2]:j<1?cols[0]:cols[1]); if(j>h*.55 && R()<.35) x+=lean; }
    }
  };
  if(kind==='tuft'){
    if(spec.crustType==='snow') kind='snow';
    else if(spec.crustType==='crystal') kind='shard';
    else blades(Math.round(4+R()*3),n*.42);
  }
  if(kind==='flower'){
    const x=Math.round(n/2+(R()-.5)*n*.2), h=Math.round(n*(.32+R()*.15));
    for(let j=0;j<h;j++) set(x,B-j,j<2?K0:K1);
    set(x-1,B-Math.round(h*.4),K1); set(x+1,B-Math.round(h*.55),K2);
    const cy=B-h;
    for(const [dx,dy] of [[0,-1],[1,0],[-1,0],[0,1]]) set(x+dx,cy+dy,F0);
    if(sc>=2) for(const [dx,dy] of [[0,-2],[2,0],[-2,0],[1,-1],[-1,-1]]) set(x+dx,cy+dy,F0);
    set(x,cy,F1);
    blades(2,n*.2);
  }
  if(kind==='sprout'){
    const x=Math.round(n/2), h=Math.round(n*(.22+R()*.12));
    for(let j=0;j<h;j++) set(x,B-j,j<1?K0:K1);
    const t=B-h;
    for(let k=1;k<=Math.max(2,Math.round(2*sc));k++){ set(x-k,t-Math.floor(k/2),k===1?K1:K2); set(x+k,t-Math.floor(k/2),K1); }
  }
  if(kind==='crystal'){
    const cl=new Uint8Array(n*n);
    crystalCluster(cl,n,Math.round(n/2),B-1,Math.round(n*(.55+R()*.2)),R);
    for(let i=0;i<n*n;i++) if(cl[i]) px[i]=cl[i];
    return px;
  }
  if(kind==='shard'){
    // mảnh tinh thể mọc xiên về một phía
    const x=Math.round(n/2+(R()-.5)*n*.2), h=Math.round(n*(.25+R()*.18)), sl=(R()<.5?-1:1)*(.45+R()*.25);
    for(let j=0;j<h;j++){ const xx=x+Math.round(j*sl); set(xx,B-1-j,j===h-1?G2:K2); if(j<h-2) set(xx+1,B-1-j,K1); }
    set(x-1,B-1,K1); set(x+2,B-1,K0);
  }
  if(kind==='pebble'){
    const ry=n*(.12+R()*.05), b={cx:n/2+(R()-.5)*n*.2,cy:B-ry*1.2-1,rx:n*(.17+R()*.08),ry,seed:(R()*1e9)>>>0,crack:R()<.3,dark:false};
    const tmp=new Uint8Array(n*n).fill(0), L=spec.light==='tr'?[.6,-.8]:[-.6,-.8];
    // vẽ trên nền tạm rồi bỏ nền: đá cuội đứng một mình trên mặt đất
    const T=new Uint8Array(n*n).fill(M1); stampBoulder(T,n,b,L,{moss:spec.crustType==='moss'?.25:0});
    for(let i=0;i<n*n;i++) if(T[i]!==M1) tmp[i]=T[i];
    // dời xuống cho đáy viên đá chạm đáy ô: đá ngồi lên mặt đất, không lơ lửng
    let low=0; for(let i=0;i<n*n;i++) if(tmp[i]) low=Math.floor(i/n);
    const shift=B-low, out=new Uint8Array(n*n);
    for(let i=0;i<n*n;i++) if(tmp[i]){ const y=Math.floor(i/n)+shift; if(y>=0&&y<n) out[y*n+i%n]=tmp[i]; }
    return out;
  }
  if(kind==='snow'){
    const w=Math.round(n*(.35+R()*.2)), x0=Math.round((n-w)/2), h=Math.max(2,Math.round(n*(.14+R()*.08)));
    for(let j=0;j<h;j++){ const inset=Math.round(Math.max(0,j-h+3)*.9); for(let i=x0+inset;i<x0+w-inset;i++) set(i,B-j,j===h-1||i===x0+inset?K2:j<1?K0:K1); }
  }
  if(kind==='hang'){
    const type=spec.hangType, len=Math.round(n*(.4+R()*.35));
    let x=Math.round(n/2+(R()-.5)*n*.2);
    for(let j=0;j<len;j++){
      if(type==='icicle'){ set(x,j,j===len-1?G2:K2); if(j<len*.6) set(x+1,j,K1); if(j<len*.3) set(x-1,j,K1); }
      else if(type==='vine'){ set(x,j,j%2?K0:K1); if(j%3===1) set(x+(j%2?1:-1),j,K2); if(R()<.15) x+=R()<.5?-1:1; }
      else { const w=Math.max(0,Math.round((1-j/len)*2.2*sc)); for(let i=-w;i<=w;i++) set(x+i,j,i<0?C2:i===0?C1:C0); }
    }
  }
  return outlineLayer(px,n);
}
export function generateProps(spec,n=16){
  return spec.props.map((kind,i)=>{
    const roles=propRoles(kind,n,spec,terrainHash(i,kind.length,spec.seeds.crust));
    return {kind,name:PROP_NAMES[kind]||kind,anchor:kind==='hang'?'top':'bottom',roles};
  });
}

/* ---------------- bản đồ xem trước ----------------
   Lưới ô: 0 = trống, 1..6 = đất của bộ ô thứ mấy (bản đồ cắt lớp dùng 6 bộ). */
export const PREVIEW_LAYOUTS={stairs:'Bậc thang',cave:'Hang',island:'Đảo bay',strata:'Cắt lớp 6 tầng'};
export function previewLayout(kind,seed=7){
  const R=rng(seed);
  if(kind==='strata'){
    const w=26, h=21, g=new Uint8Array(w*h);
    const surf=x=>2+Math.round(Math.sin(x*.45+R()*.2)*1.1+1);
    for(let x=0;x<w;x++){ const s=surf(x); for(let y=s;y<h;y++) g[y*w+x]=Math.min(6,1+Math.floor(Math.max(0,y-3)/3)); }
    for(let b=0;b<6;b++){
      const y0=4+b*3, x0=2+Math.floor(R()*(w-9)), cw=3+Math.floor(R()*4);
      for(let y=y0;y<y0+2&&y<h;y++) for(let x=x0;x<x0+cw;x++) g[y*w+x]=0;
    }
    return {w,h,cells:g,hero:{x:5}};
  }
  if(kind==='cave'){
    const w=26, h=14, g=new Uint8Array(w*h).fill(1);
    for(let x=2;x<w-2;x++){
      const top=3+Math.round(1+Math.sin(x*.7)*1.2), bot=10+Math.round(Math.sin(x*.5+1)*1.1);
      for(let y=top;y<bot;y++) g[y*w+x]=0;
    }
    for(let y=5;y<9;y++) g[y*w+13]=1;                     // cột đá giữa hang
    for(let x=17;x<21;x++) g[7*w+x]=1;                    // gờ lơ lửng
    return {w,h,cells:g,hero:{x:7}};
  }
  if(kind==='island'){
    const w=26, h=13, g=new Uint8Array(w*h);
    const isl=(x0,y0,iw,depth)=>{ for(let d=0;d<depth;d++){ const cut=Math.floor(d*1.2); for(let x=x0+cut;x<x0+iw-cut;x++) if(x>=0&&x<w&&y0+d<h) g[(y0+d)*w+x]=1; } };
    isl(1,4,7,4); isl(10,7,10,5); isl(21,3,5,3); isl(14,2,4,1);
    return {w,h,cells:g,hero:{x:14},open:true};
  }
  // bậc thang đi xuống, như ảnh tham khảo: mỗi bậc 4–5 ô, cuối có một gờ nổi và một hốc
  const w=26, h=12, g=new Uint8Array(w*h);
  let top=2, x=0;
  while(x<w){ const run=4+Math.floor(R()*2); for(let k=0;k<run&&x<w;k++,x++) for(let y=top;y<h;y++) g[y*w+x]=1; top=Math.min(h-3,top+1); }
  for(let y=9;y<11;y++) for(let x2=4;x2<9;x2++) g[y*w+x2]=0;   // hốc dưới đất: thấy trần và sàn trong
  return {w,h,cells:g,hero:{x:8}};
}
function cellMask(map,x,y){
  const {w,h,cells}=map;
  const solid=(cx,cy)=>{
    if(cy<0) return 0;
    if(cy>=h) return map.open?0:1;
    if(cx<0||cx>=w){ if(map.open) return 0; cx=clamp(cx,0,w-1); }
    return cells[cy*w+cx]?1:0;
  };
  const N=solid(x,y-1),E=solid(x+1,y),S=solid(x,y+1),W=solid(x-1,y);
  return N|E<<1|S<<2|W<<3|(N&&E&&solid(x+1,y-1))<<4|(S&&E&&solid(x+1,y+1))<<5|(S&&W&&solid(x-1,y+1))<<6|(N&&W&&solid(x-1,y-1))<<7;
}
/* nhân vật mẫu để so tỉ lệ — vẽ bằng khối, cao đúng chiều cao nhân vật trong game */
const HERO_COLORS={
  'genesis-v3':{hair:GENESIS_V3_COMMON.outline,skin:GENESIS_V3_FAMILIES.skin.base,skinD:GENESIS_V3_FAMILIES.skin.ramp[1],
    robe:GENESIS_V3_FAMILIES.ivory.ramp[4],robeD:GENESIS_V3_FAMILIES.ivory.ramp[3],belt:GENESIS_V3_FAMILIES.red.base,
    pants:GENESIS_V3_FAMILIES.void.base,ink:GENESIS_V3_COMMON.outline},
  genesis:{hair:GENESIS_COMMON.outline,skin:GENESIS_FAMILIES.skin.base,skinD:GENESIS_FAMILIES.skin.ramp[1],
    robe:GENESIS_FAMILIES.ivory.ramp[4],robeD:GENESIS_FAMILIES.ivory.ramp[3],belt:GENESIS_FAMILIES.red.base,
    pants:GENESIS_FAMILIES.void.base,ink:GENESIS_COMMON.outline},
  master:{hair:'#1f1e1c',skin:'#e8ad83',skinD:'#d08a66',robe:'#d8d1c2',robeD:'#b5aea1',belt:'#c2362c',pants:'#4c4944',ink:M_INK}
};
export function heroSprite(H,palette='genesis-v3'){
  const h=Math.max(16,Math.round(H)), w=Math.max(9,Math.round(h*.46)), px=new Uint32Array(w*h);
  const C=Object.fromEntries(Object.entries(HERO_COLORS[palette]||HERO_COLORS['genesis-v3']).map(([k,v])=>[k,hexToRgba(v)]));
  const rect=(x0,y0,x1,y1,c)=>{ for(let y=Math.max(0,y0);y<Math.min(h,y1);y++) for(let x=Math.max(0,x0);x<Math.min(w,x1);x++) px[y*w+x]=c; };
  const headH=Math.round(h*.3), bodyT=headH, legT=Math.round(h*.76), cx=Math.floor(w/2), hw=Math.round(w*.36);
  rect(cx-hw,1,cx+hw+1,headH,C.skin);
  rect(cx-hw,1,cx+hw+1,Math.round(headH*.42),C.hair);
  rect(cx-hw,1,cx-hw+2,Math.round(headH*.8),C.hair);
  rect(cx-1,0,cx+2,2,C.hair);
  const ey=Math.round(headH*.6); px[ey*w+cx+1]=C.ink; px[ey*w+cx+Math.max(2,Math.round(hw*.6))]=C.ink;
  const bw=Math.round(w*.38);
  rect(cx-bw,bodyT,cx+bw+1,legT,C.robe); rect(cx+Math.round(bw*.3),bodyT,cx+bw+1,legT,C.robeD);
  rect(cx-bw,Math.round(h*.52),cx+bw+1,Math.round(h*.52)+Math.max(1,Math.round(h*.04)),C.belt);
  rect(cx-bw-1,bodyT+2,cx-bw+1,Math.round(h*.6),C.robeD); rect(cx+bw,bodyT+2,cx+bw+2,Math.round(h*.6),C.robeD);
  const lw=Math.max(2,Math.round(w*.18));
  rect(cx-lw-1,legT,cx-1,h-1,C.pants); rect(cx+1,legT,cx+lw+1,h-1,C.pants);
  rect(cx-lw-2,h-2,cx-1,h,C.hair); rect(cx+1,h-2,cx+lw+2,h,C.hair);
  const out=px.slice();
  for(let y=0;y<h;y++) for(let x=0;x<w;x++){
    const i=y*w+x; if(px[i]) continue;
    if((x>0&&px[i-1])||(x<w-1&&px[i+1])||(y>0&&px[i-w])||(y<h-1&&px[i+w])) out[i]=C.ink;
  }
  return {w,h,px:out};
}
/* sets: [{tiles: 56 Uint32Array, props:[{anchor,px}], sky}] → ảnh RGBA của cả bản đồ */
export function renderPreview(map,sets,{n=16,shape='inset',deco=.5,heroH=0,seed=1701,palette='genesis-v3'}={}){
  const W=map.w*n, H=map.h*n, img=new Uint32Array(W*H).fill(hexToRgba(sets[0].sky||'#162331'));
  const r=shapeInset(shape,n);
  const blit=(src,sw,sh,dx,dy)=>{
    for(let y=0;y<sh;y++){ const ty=dy+y; if(ty<0||ty>=H) continue;
      for(let x=0;x<sw;x++){ const tx=dx+x; if(tx<0||tx>=W) continue; const v=src[y*sw+x]; if(v>>>24) img[ty*W+tx]=v; } }
  };
  for(let y=0;y<map.h;y++) for(let x=0;x<map.w;x++){
    const c=map.cells[y*map.w+x]; if(!c) continue;
    const set=sets[Math.min(sets.length,c)-1], mask=cellMask(map,x,y);
    if(mask===255 && set.macro){                          // ô đặc lấy ô con của tấm vân lớn theo toạ độ
      const M=set.macro, ox=(x%M.size)*n, oy=(y%M.size)*n;
      for(let yy=0;yy<n;yy++) for(let xx=0;xx<n;xx++){ const v=M.px[(oy+yy)*M.w+ox+xx]; if(v>>>24) img[(y*n+yy)*W+x*n+xx]=v; }
      continue;
    }
    const slot=terrainSlot(mask,x,y,56,seed);
    if(slot>=0) blit(set.tiles[slot],n,n,x*n,y*n);
  }
  // trang trí: mặt đất có khoảng trống phía trên, trần có khoảng trống phía dưới
  for(let y=0;y<map.h;y++) for(let x=0;x<map.w;x++){
    const c=map.cells[y*map.w+x]; if(!c) continue;
    const set=sets[Math.min(sets.length,c)-1], ground=set.props.filter(p=>p.anchor==='bottom'), hang=set.props.filter(p=>p.anchor==='top');
    const h=terrainHash(x,y,seed^0x99)/4294967296, pick=terrainHash(x,y,seed^0x3)>>>0;
    if(y>0 && !map.cells[(y-1)*map.w+x] && ground.length && h<deco*.6)
      blit(ground[pick%ground.length].px,n,n,x*n,y*n+r-n);
    if(y<map.h-1 && !map.cells[(y+1)*map.w+x] && hang.length && h<deco*.35)
      blit(hang[pick%hang.length].px,n,n,x*n,(y+1)*n-r);
  }
  if(heroH>0 && map.hero){
    // đứng trên mặt đất có đủ khoảng trống phía trên cho cả người, gần cột đã định nhất
    const hero=heroSprite(heroH,palette), need=Math.ceil((hero.h-r)/n);
    let best=null;
    for(let x=0;x<map.w;x++) for(let y=1;y<map.h;y++){
      if(!map.cells[y*map.w+x] || map.cells[(y-1)*map.w+x]) continue;
      let room=0; while(room<need && y-1-room>=0 && !map.cells[(y-1-room)*map.w+x]) room++;
      const fitsTop=y*n+r-hero.h>=0;
      if(room>=need && fitsTop){ const d=Math.abs(x-map.hero.x); if(!best||d<best.d) best={x,y,d}; }
    }
    if(best) blit(hero.px,hero.w,hero.h,best.x*n+Math.round((n-hero.w)/2),best.y*n+r-hero.h);
  }
  return {w:W,h:H,px:img};
}

/* ---------------- soi bộ vừa sinh ----------------
   Màu ngoài bảng, pixel lơ lửng (có màu mà bốn ô kề đều trống), mối nối alpha và màu/vân. */
export function lintTerrain(tiles,n,shape,allowedHex){
  const allowed=new Set((allowedHex||[]).map(h=>hexToRgba(h.toLowerCase())));
  const used=new Set(); let floating=0;
  for(const t of tiles) for(let y=0;y<n;y++) for(let x=0;x<n;x++){
    const v=t[y*n+x]; if(!(v>>>24)) continue;
    used.add(v);
    const op=(xx,yy)=>xx>=0&&yy>=0&&xx<n&&yy<n&&(t[yy*n+xx]>>>24);
    // pixel ở biên ô có thể nối sang ô bên cạnh — chỉ đếm pixel lơ lửng nằm trong lòng ô
    if(x>0&&y>0&&x<n-1&&y<n-1 && !op(x-1,y)&&!op(x+1,y)&&!op(x,y-1)&&!op(x,y+1)) floating++;
  }
  const off=allowedHex?[...used].filter(v=>!allowed.has(v)):[];
  const toHex=v=>'#'+[v&255,(v>>8)&255,(v>>16)&255].map(c=>c.toString(16).padStart(2,'0')).join('');
  return {colors:used.size, offPalette:off.map(toHex), floating,
    alpha:checkSeams(tiles,n,shape).length, color:checkColorSeams(tiles,n,shape).length};
}
