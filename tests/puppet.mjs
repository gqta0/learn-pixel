import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {frameAt, keyPose, joints, placements, frameBox, bake, bakeAt, flapPoints, isFlap, blockoutSheet, cellAt, attachPoints, shadeRamp, shadeCell,
  lintSheet, bakeClips, bakeManifest, sheetFileName, OUTLINE, FAR_SHADE, LIGHTS, SLOT_ZONES} from '../js/puppet.js';
import {GENESIS_FAMILIES, GENESIS_COLORS, GENESIS_TOKENS} from '../js/genesis.js';

const P=JSON.parse(readFileSync(new URL('../data/puppet.json',import.meta.url),'utf8'));
const rgba=(r,g,b,a=255)=>((a<<24)|(b<<16)|(g<<8)|r)>>>0;
const hex=h=>rgba(parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16));
const blank=kind=>{ const [w,h]=P.sheets[kind].size; return {w,h,px:new Uint32Array(w*h)}; };
const fillCell=(sh,rect,v)=>{ for(let y=rect[1];y<rect[3];y++) for(let x=rect[0];x<rect[2];x++) sh.px[y*sh.w+x]=v; };

/* Giá trị tính bằng bản Python gốc (character-animation/tools/bones.py: joints(frame_at(clip, t)))
   chạy trên chính data/puppet.json: B.BONES = puppet["bones"]. [khớp x, khớp y, mút x, mút y]. */
const REF=[
  {clip:'idle',t:0,joints:{pelvis:[0.484,-19.236,0.673927,-22.860027],head:[-0.263757,-35.023771,-1.291915,-49.05816],near_hand:[-5.258653,-19.387393,-2.810778,-17.354407],near_shin:[-5.599712,-10.409057,-8.800158,-4.475112],far_foot:[7.562228,-3.870813,11.312639,-1.148979]}},
  {clip:'run',t:0,joints:{pelvis:[-1.331,-22.661,-0.700831,-26.234867],head:[1.958792,-38.141266,3.871015,-52.082736],near_hand:[1.014614,-29.104001,4.03586,-30.102598],near_shin:[-9.267522,-15.144601,-15.274687,-12.083797],far_foot:[6.11169,-7.183265,10.04283,-4.729677]}},
  {clip:'run',t:0.2,joints:{pelvis:[-1.331,-21.413,-0.576488,-24.962698],head:[2.083135,-36.869097,3.507642,-50.86881],near_hand:[-6.162837,-25.694884,-3.320379,-24.264654],near_shin:[1.506456,-15.826418,-3.581796,-11.403268],far_foot:[-8.568637,-7.71595,-8.16234,-3.099796]}},
  {clip:'run',t:0.27,joints:{pelvis:[-1.331,-22.5882,-0.70395,-26.162616],head:[1.924493,-38.075937,3.836716,-52.017407],near_hand:[-8.618076,-26.876462,-6.346957,-24.647753],near_shin:[0.804837,-16.002719,0.041621,-9.304057],far_foot:[-10.053158,-11.134092,-11.631997,-6.777348]}},
  {clip:'jump',t:5/6,joints:{pelvis:[0.484,-21.777,0.230854,-25.39716],head:[-2.182228,-37.355963,-3.210387,-51.390352],near_hand:[-19.573677,-29.682127,-22.07118,-27.710426],near_shin:[-0.251558,-12.404169,-6.224706,-9.277499],far_foot:[5.123369,-8.400026,6.246789,-3.904263]}},
  {clip:'skill_02',t:1.234,joints:{pelvis:[0.484,-20.607642,0.790949,-24.223637],head:[0.491151,-36.419787,0.09431,-50.48619],near_hand:[-6.675041,-23.068151,-3.857512,-21.589417],near_shin:[-3.724301,-11.420416,-7.494379,-5.831044],far_foot:[5.835142,-3.873163,9.585553,-1.15133]}},
  {clip:'fly',t:1.5,joints:{pelvis:[0.484,-25.193,1.06921,-28.774504],head:[1.467713,-40.967827,1.175467,-55.036792],near_hand:[-5.044966,-27.970988,-2.108379,-26.745597],near_shin:[-5.589894,-16.677064,-9.414421,-11.124807],far_foot:[-2.225485,-8.944078,-1.899813,-4.321536]}}
];

test('the shipped puppet.json is the genesis.puppet.v1 export with both sheets and 14 clips',()=>{
  assert.equal(P.format,'genesis.puppet.v1');
  assert.deepEqual(P.sheets.head.size,[80,81]);
  assert.deepEqual(P.sheets.body.size,[64,87]);
  assert.deepEqual(P.sheets.body.parts.chest.rect,[1,1,20,40]);              // ô ngực cao tới gần mắt cá: vẽ được áo dài
  assert.equal(Object.keys(P.clips).length,14);
  assert.equal(P.bones.length,15);
});

test('the foot is drawn above the shin in both legs (character.py GROUPS: thigh, shin, foot)',()=>{
  for(const g of P.draw_order){
    const parts=g.map(e=>e.part);
    if(parts.includes('foot')) assert.ok(parts.indexOf('foot')>parts.indexOf('shin'), JSON.stringify(parts));
  }
});

test('joint positions match the Python reference (frame_at + joints), tweened and looping',()=>{
  for(const r of REF){
    const j=joints(P,frameAt(P.clips[r.clip],r.t));
    for(const [bone,want] of Object.entries(r.joints))
      want.forEach((v,k)=>assert.ok(Math.abs(j[bone][k]-v)<1e-5, r.clip+' t='+r.t+' '+bone+'['+k+']: '+j[bone][k]+' ≠ '+v));
  }
});

test('every part turns so its sheet direction lines up with its bone',()=>{
  const f=keyPose(P.clips.run,2), pose=joints(P,f);
  for(const p of placements(P,f)){
    const [jx,jy,tx,ty]=pose[p.bone], a=Math.atan2(ty-jy,tx-jx)*180/Math.PI;
    const d=((p.turn+P.part_angle[p.part]-a)%360+540)%360-180;
    assert.ok(Math.abs(d)<1e-9, p.part+' on '+p.bone);
  }
  // ở tư thế nghỉ (idle không xoay gì) thân và hông nằm đúng hướng trên sheet: không quay
  const idle={_move:[0,0],_pos:{},_scale:{}};
  const chest=placements(P,idle).find(p=>p.part==='chest');
  assert.ok(Math.abs(chest.turn)<1e-9);
});

test('one frame box fits every part of every clip, with the feet inside it',()=>{
  const box=frameBox(P);
  assert.ok(box.w>=40 && box.w<=128 && box.h>=64 && box.h<=128, JSON.stringify(box));
  assert.ok(box.fx>0 && box.fx<box.w && box.fy>0 && box.fy<=box.h);
  const full={head:blockoutSheet(P,'head'), body:blockoutSheet(P,'body')};
  for(const clip of Object.values(P.clips)) for(let i=0;i<clip.frames.length;i++){
    const {px}=bakeAt(P,full,clip,i/clip.fps,box), W=box.w;
    for(let y=0;y<box.h;y++){ assert.equal(px[y*W],0); assert.equal(px[y*W+W-1],0); }     // còn chừa mép: không miếng nào bị cắt
    for(let x=0;x<W;x++){ assert.equal(px[x],0); assert.equal(px[(box.h-1)*W+x],0); }
  }
});

test('a colour in the thigh cell shows on both legs: near as drawn, far darkened, outlined per group',()=>{
  const body=blank('body'), red=rgba(200,40,40);
  fillCell(body,P.sheets.body.parts.thigh.rect,red);
  const box=frameBox(P), {px,who}=bake(P,{body},keyPose(P.clips.run,0),box);
  const colours=new Map(); px.forEach(v=>{ if(v) colours.set(v,(colours.get(v)||0)+1); });
  const far=rgba(Math.round(200*FAR_SHADE),Math.round(40*FAR_SHADE),Math.round(40*FAR_SHADE));
  assert.deepEqual([...colours.keys()].sort(),[red,far,OUTLINE].sort());   // xoay láng giềng gần: không sinh màu mới
  assert.ok(colours.get(red)>40 && colours.get(far)>40);
  // pixel nào của đùi cũng được viền: không có ô màu nào chạm ô trống
  const W=box.w;
  px.forEach((v,i)=>{ if(v===red||v===far) for(const j of [i-1,i+1,i-W,i+W]) assert.notEqual(px[j],0); });
  const ids=new Set(who); ids.delete(0);
  assert.equal(ids.size,1);
  // khác khung thì chân ở chỗ khác
  const other=bake(P,{body},keyPose(P.clips.run,4),box).px;
  assert.notDeepEqual(other,px);
});

test('only-this-part, blockout fill for empty cells, and no outline on request',()=>{
  const body=blank('body'), box=frameBox(P), f=keyPose(P.clips.idle,0);
  fillCell(body,P.sheets.body.parts.thigh.rect,rgba(10,200,10));
  const fill={head:blockoutSheet(P,'head'),body:blockoutSheet(P,'body')};
  const all=bake(P,{body},f,box,{fill}).px, solo=bake(P,{body},f,box,{fill,only:'shin'}).px;
  const n=a=>a.reduce((s,v)=>s+(v?1:0),0);
  assert.ok(n(all)>n(solo) && n(solo)>0);
  assert.ok(!solo.includes(rgba(10,200,10)));                     // đùi đã vẽ không hiện khi chỉ xem cẳng chân
  assert.ok(all.includes(rgba(10,200,10)) && all.some(v=>v===fill.body.px.find(Boolean)));
  assert.ok(!bake(P,{body},f,box,{outline:false}).px.includes(OUTLINE));
});

test('a part at 0 degrees is copied pixel for pixel, whatever the fraction of its joint',()=>{
  const body=blank('body'), c=P.sheets.body.parts.chest, box=frameBox(P);
  for(let y=c.rect[1];y<c.rect[3];y++) for(let x=c.rect[0];x<c.rect[2];x++) body.px[y*body.w+x]=rgba(x*8,y*8,100);
  const idle={_move:[0,0],_pos:{},_scale:{}};
  const {px}=bake(P,{body},idle,box,{only:'chest',outline:false});
  const got=new Set(px.filter(Boolean)), want=new Set();
  for(let y=c.rect[1];y<c.rect[3];y++) for(let x=c.rect[0];x<c.rect[2];x++) want.add(rgba(x*8,y*8,100));
  assert.deepEqual(got,want);
  assert.equal(px.filter(Boolean).length,want.size);
});

test('guides: cells, joints, child attachments and slot zones line up with the sheet',()=>{
  const t=P.sheets.body.parts.thigh;
  assert.equal(cellAt(P,'body',t.rect[0],t.rect[1]),'thigh');
  assert.equal(cellAt(P,'body',0,0),null);
  assert.equal(cellAt(P,'head',50,50),'accessory');
  const [k]=attachPoints(P,'thigh');                               // đầu gối: thẳng xuống, cách khớp đúng chiều dài xương đùi
  assert.ok(Math.abs(k[0])<1e-9 && Math.abs(k[1]-7.819)<1e-9);
  assert.equal(attachPoints(P,'chest').length,3);
  assert.deepEqual(Object.keys(SLOT_ZONES),['hair_back','hair_front','accessory']);
  const bo=blockoutSheet(P,'body');
  assert.ok(bo.px[Math.floor(t.joint[1]+3)*bo.w+Math.floor(t.joint[0])]);   // khối mờ phủ thân đùi
  assert.equal(bo.px[0],0);
});

test('shading takes the neighbouring steps of the base colour\'s ramp and lights the upper-left side',()=>{
  const skin=GENESIS_FAMILIES.skin.ramp, base=hex(skin[2]);
  const r=shadeRamp(base,GENESIS_COLORS,GENESIS_TOKENS);
  assert.equal(r.shadow,hex(skin[1])); assert.equal(r.light,hex(skin[3]));
  // màu không có trong bảng: vẫn ra một bậc tối hơn và một bậc sáng hơn
  const odd=shadeRamp(rgba(120,60,200),GENESIS_COLORS,GENESIS_TOKENS), L=v=>0.299*(v&255)+0.587*((v>>8)&255)+0.114*((v>>16)&255);
  assert.ok(L(odd.shadow)<L(rgba(120,60,200)) && L(odd.light)>L(rgba(120,60,200)));
  const body=blank('body'), c=P.sheets.body.parts.thigh;
  const capsule=blockoutSheet(P,'body').px.map(v=>v?base:0);
  const {px,changed}=shadeCell(capsule,body.w,c.rect,LIGHTS['↖'],r);
  assert.ok(changed>0);
  let sx=0,sn=0,lx=0,ln=0;
  for(let y=c.rect[1];y<c.rect[3];y++) for(let x=c.rect[0];x<c.rect[2];x++){
    const v=px[y*body.w+x];
    if(v===r.shadow){ sx+=x; sn++; } if(v===r.light){ lx+=x; ln++; }
  }
  assert.ok(sn>0 && ln>0 && sx/sn>lx/ln, 'bóng nằm bên phải, sáng bên trái');
  // ngoài ô không đổi
  assert.equal(px.filter((v,i)=>v!==capsule[i] && cellAt(P,'body',i%body.w,Math.floor(i/body.w))!=='thigh').length,0);
});

test('lint names the problems of a body sheet',()=>{
  const body=blank('body'), c=P.sheets.body.parts.thigh;
  const ok=()=>lintSheet(P,'body',body.px,GENESIS_COLORS).filter(r=>r[0]==='warn').map(r=>r[1]).join('\n');
  assert.equal(ok(),'');
  fillCell(body,[c.rect[0]+2,c.rect[1]+9,c.rect[2]-2,c.rect[3]-1],hex('#806f95'));     // đùi mà khớp hông trống
  assert.match(ok(),/Khớp trống.*Đùi/);
  fillCell(body,c.rect,hex('#806f95'));
  assert.doesNotMatch(ok(),/Khớp trống/);
  body.px[0]=hex('#806f95');
  assert.match(ok(),/1 pixel<\/b> nằm ngoài/);
  body.px[0]=0;
  for(let y=c.rect[1];y<c.rect[3];y++){ body.px[y*body.w+c.rect[0]]=hex('#251c24'); }
  assert.match(ok(),/viền tay.*Đùi/);
  body.px[c.rect[1]*body.w+c.rect[0]+3]=rgba(1,2,3);
  assert.match(ok(),/ngoài bảng màu/);
});

test('export bakes one row per clip, named the way the game reads sheets',()=>{
  const body=blank('body');
  fillCell(body,P.sheets.body.parts.thigh.rect,rgba(200,40,40));
  const box=frameBox(P), baked=bakeClips(P,{body},box);
  assert.equal(baked.length,14);
  const run=baked.find(b=>b.clip==='run');
  assert.equal(run.file,'run_'+box.w+'x'+box.h+'_8f.png');
  assert.equal(run.file,sheetFileName('run',box,8));
  assert.deepEqual([run.w,run.h,run.n,run.fps,run.loop],[box.w*8,box.h,8,15,true]);
  const m=bakeManifest(P,box,baked,{body:'Thân'});
  assert.deepEqual(m.feet,{x:box.fx,y:box.fy});
  assert.equal(m.clips.skill_02.frames,18);
});

/* tools/flaps.py points(clip, t) chạy trên data/puppet.json: B.BONES = puppet["bones"], hằng số REST/SHORT/LAG/
   FOLLOW/GROUND/FLAPS lấy từ khối "flaps" (pixel game). [bản lề, khớp, khớp, gấu] của từng vạt. */
const FLAP_REF=[{"clip": "idle", "t": 0, "pts": {"flap_back": [[-2.238, -18.631], [-3.640809, -14.518981], [-4.662767, -10.296166], [-5.295356, -5.997747]], "flap_right": [[2.783, -18.631], [5.073426, -15.339188], [6.778056, -11.709268], [7.848398, -7.844499]], "flap_left": [[-0.605, -18.631], [-2.007809, -14.518981], [-3.029767, -10.296166], [-3.662356, -5.997747]]}}, {"clip": "run", "t": 0, "pts": {"flap_back": [[-4.053, -22.056], [-5.335175, -17.86481], [-5.151255, -13.485744], [-5.951484, -9.176489]], "flap_right": [[0.968, -22.056], [3.262517, -18.769333], [4.566189, -14.978895], [3.834347, -11.037906]], "flap_left": [[-2.42, -22.056], [-3.702175, -17.86481], [-3.518255, -13.485744], [-2.811467, -9.160181]]}}, {"clip": "run", "t": 0.27, "pts": {"flap_back": [[-4.053, -21.9832], [-6.509773, -18.916646], [-6.462969, -14.987614], [-7.074939, -11.106251]], "flap_right": [[0.968, -21.9832], [-1.488773, -18.916646], [-1.441969, -14.987614], [-0.811038, -11.109288]], "flap_left": [[-2.42, -21.9832], [0.372113, -19.521621], [0.88774, -15.835241], [0.308016, -12.158396]]}}, {"clip": "sit", "t": 0.7777777777777778, "pts": {"flap_back": [[-2.238, -8.832], [-5.311747, -7.558812], [-6.555279, -4.472948], [-4.924564, -1.573]], "flap_right": [[2.783, -8.832], [5.856747, -7.558812], [8.516829, -5.560589], [10.616662, -2.979964]], "flap_left": [[-0.605, -8.832], [-3.678747, -7.558812], [-4.922279, -4.472948], [-3.291564, -1.573]]}}, {"clip": "jump", "t": 0.05, "pts": {"flap_back": [[-2.238, -18.5584], [-3.640809, -14.446381], [-4.662767, -10.223566], [-5.295356, -5.925147]], "flap_right": [[2.783, -18.5584], [5.073426, -15.266588], [6.778056, -11.636668], [7.848398, -7.771899]], "flap_left": [[-0.605, -18.5584], [-2.007809, -14.446381], [-3.029767, -10.223566], [-3.662356, -5.925147]]}}, {"clip": "fly", "t": 1.5, "pts": {"flap_back": [[-2.238, -24.588], [-3.556124, -20.41979], [-4.497348, -16.150654], [-5.064469, -11.815934]], "flap_right": [[2.783, -24.588], [1.711053, -20.272181], [0.951601, -15.89056], [0.498054, -11.466798]], "flap_left": [[-0.605, -24.588], [-1.923124, -20.41979], [-2.864348, -16.150654], [-3.431469, -11.815934]]}}, {"clip": "skill_02", "t": 1.234, "pts": {"flap_back": [[-2.238, -20.002642], [-3.290774, -15.676245], [-4.092872, -11.296442], [-4.589204, -6.871547]], "flap_right": [[2.783, -20.002642], [3.886564, -15.704543], [4.68762, -11.339934], [5.182264, -6.930078]], "flap_left": [[-0.605, -20.002642], [-1.657774, -15.676245], [-2.459872, -11.296442], [-2.956204, -6.871547]]}}];

test('robe flap points match the Python reference (lag, follow, short length, ground)',()=>{
  for(const r of FLAP_REF){
    const got=flapPoints(P,P.clips[r.clip],r.t);
    for(const [flap,pts] of Object.entries(r.pts)) pts.forEach((pt,i)=>pt.forEach((v,k)=>
      assert.ok(Math.abs(got[flap][i][k]-v)<1e-5, r.clip+' t='+r.t+' '+flap+'['+i+']['+k+']: '+got[flap][i][k]+' ≠ '+v)));
  }
  // vạt phụ thuộc thời gian chứ không chỉ khung: ở khung đầu của clip lặp, độ trễ nhìn về cuối clip;
  // cùng khung đó mà clip không lặp thì nhìn về khung đầu — tư thế khung như nhau, vạt khác chỗ
  const run=P.clips.run, once={...run,loop:false};
  assert.deepEqual(joints(P,frameAt(run,0)),joints(P,frameAt(once,0)));
  assert.notDeepEqual(flapPoints(P,run,0).flap_left, flapPoints(P,once,0).flap_left);
  for(const pts of Object.values(flapPoints(P,P.clips.sit,7/9))) for(const [,y] of pts) assert.ok(y<=P.flaps.ground+1e-9);
});

test('flaps are drawn as three bands along their chain; an empty flap cell means no robe',()=>{
  const box=frameBox(P), body=blank('body'), c=P.sheets.body.parts.flap_left, cloth=rgba(230,225,210);
  assert.ok(isFlap(P,'flap_left') && !isFlap(P,'thigh'));
  const fill={head:blockoutSheet(P,'head'),body:blockoutSheet(P,'body')};
  const bare=bakeAt(P,{body},P.clips.run,0,box,{fill}).px;
  assert.ok(!bare.includes(cloth));
  fillCell(body,c.rect,cloth);
  const a=bakeAt(P,{body},P.clips.run,0,box), b=bakeAt(P,{body},P.clips.run,2/P.clips.run.fps,box);
  const n=x=>x.px.filter(v=>v===cloth).length;
  assert.ok(n(a)>30, 'vạt trái hiện ra');
  assert.notDeepEqual(a.px,b.px);
  // vạt trái không bị tối; ba dải nối liền thành một mảnh (không hở giữa các dải)
  const W=box.w, seen=new Set(), st=[a.px.indexOf(cloth)];
  while(st.length){ const i=st.pop(); if(seen.has(i)||a.px[i]!==cloth) continue; seen.add(i); st.push(i-1,i+1,i-W,i+W); }
  assert.equal(seen.size,n(a));
  // chỉ xem vạt này
  const solo=bakeAt(P,{body},P.clips.run,0,box,{only:'flap_left'}).px;
  assert.equal(solo.filter(v=>v===cloth).length,n(a));
  // vạt phải và vạt sau dùng chung kiểu tối đi như phía xa
  const right=blank('body'); fillCell(right,P.sheets.body.parts.flap_right.rect,cloth);
  const rp=bakeAt(P,{body:right},P.clips.idle,0,box).px;
  assert.ok(!rp.includes(cloth) && rp.includes(rgba(Math.round(230*0.8),Math.round(225*0.8),Math.round(210*0.8))));
  // không có điểm vạt (tư thế trần, không biết thời điểm) thì không vẽ vạt
  assert.ok(!bake(P,{body},keyPose(P.clips.run,0),box).px.includes(cloth));
});

test('lint accepts empty flap cells and checks drawn flaps like any part',()=>{
  const body=blank('body');
  fillCell(body,P.sheets.body.parts.thigh.rect,hex('#806f95'));
  assert.equal(lintSheet(P,'body',body.px,GENESIS_COLORS).filter(r=>r[0]==='warn').length,0);
  fillCell(body,P.sheets.body.parts.flap_back.rect,hex('#806f95'));
  assert.equal(lintSheet(P,'body',body.px,GENESIS_COLORS).filter(r=>r[0]==='warn').length,0);
  assert.equal(cellAt(P,'body',P.sheets.body.parts.flap_back.rect[0],P.sheets.body.parts.flap_back.rect[1]),'flap_back');
});
