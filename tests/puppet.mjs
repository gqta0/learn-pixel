import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {frameAt, keyPose, joints, placements, frameBox, bake, bakeAt, flapPoints, isFlap, blockoutSheet, cellAt, attachPoints, shadeRamp, shadeCell,
  lintSheet, bakeClips, bakeManifest, sheetFileName, partsOf, isFarCell, nearOf, farCellOf, copyNearToFar, OUTLINE, FAR_SHADE, LIGHTS, SLOT_ZONES} from '../js/puppet.js';
import {GENESIS_FAMILIES, GENESIS_COLORS, GENESIS_TOKENS} from '../js/genesis.js';

const P=JSON.parse(readFileSync(new URL('../data/puppet.json',import.meta.url),'utf8'));
const rgba=(r,g,b,a=255)=>((a<<24)|(b<<16)|(g<<8)|r)>>>0;
const hex=h=>rgba(parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16));
const blank=kind=>{ const [w,h]=P.sheets[kind].size; return {w,h,px:new Uint32Array(w*h)}; };
const fillCell=(sh,rect,v)=>{ for(let y=rect[1];y<rect[3];y++) for(let x=rect[0];x<rect[2];x++) sh.px[y*sh.w+x]=v; };

/* Giá trị tính bằng bản Python gốc (character-animation/tools/bones.py: joints(frame_at(clip, t)))
   chạy trên chính data/puppet.json: B.BONES = puppet["bones"]. [khớp x, khớp y, mút x, mút y]. */
const REF=[
  {"clip":"idle","t":0,"joints":{"pelvis":[0.484,-23.617,0.678376,-27.32591],"head":[-0.244549,-39.771268,-1.084641,-51.238537],"near_hand":[-5.392117,-23.635331,-2.944243,-21.602344],"far_hand":[11.597253,-24.176623,12.283211,-21.560044],"near_shin":[-5.540279,-12.486803,-9.06235,-3.907637],"far_foot":[7.562954,-3.871788,11.313839,-1.150609]}},
  {"clip":"run","t":0,"joints":{"pelvis":[-1.331,-27.429,-0.686071,-31.086576],"head":[2.070002,-43.257968,3.632448,-54.649314],"near_hand":[-0.666263,-32.591704,2.354983,-33.590301],"far_hand":[2.482779,-31.381651,2.891473,-28.707703],"near_shin":[-10.510742,-18.1356,-18.773937,-13.925293],"far_foot":[7.340612,-7.818222,11.271752,-5.364635]}},
  {"clip":"run","t":0.2,"joints":{"pelvis":[-1.331,-25.918,-0.558816,-29.55084],"head":[2.197257,-41.722233,3.361199,-53.161168],"near_hand":[-7.935679,-29.441411,-5.093221,-28.011182],"far_hand":[9.279264,-29.333469,11.565445,-27.887647],"near_shin":[3.261489,-19.057374,-3.737688,-12.973082],"far_foot":[-11.774394,-8.785163,-11.368098,-4.169009]}},
  {"clip":"run","t":0.27,"joints":{"pelvis":[-1.331,-27.3408,-0.689263,-30.998937],"head":[2.034936,-43.177503,3.597382,-54.56885],"near_hand":[-10.697322,-30.768357,-8.426203,-28.539648],"far_hand":[9.620318,-31.889214,12.137789,-30.899586],"near_shin":[2.354926,-19.238561,1.30508,-10.024176],"far_foot":[-13.847446,-13.247908,-15.426286,-8.891164]}},
  {"clip":"jump","t":0.8333333333333334,"joints":{"pelvis":[0.484,-26.158,0.224924,-29.862953],"head":[-2.207829,-42.103069,-3.04792,-53.570338],"near_hand":[-19.953854,-34.204469,-22.451356,-32.232768],"far_hand":[16.478655,-37.550616,18.981168,-36.523751],"near_shin":[2.789999,-15.833379,-6.225488,-13.658964],"far_foot":[5.120799,-12.781214,6.24422,-8.285451]}},
  {"clip":"skill_02","t":1.234,"joints":{"pelvis":[0.484,-25.142704,0.798138,-28.843395],"head":[0.527818,-41.319999,0.203565,-52.813426],"near_hand":[-7.142393,-27.585168,-4.324864,-26.106434],"far_hand":[17.789343,-32.107815,19.845873,-30.350627],"near_shin":[-3.964815,-13.80014,-9.15077,-6.111645],"far_foot":[6.427113,-3.853092,10.177523,-1.131258]}},
  {"clip":"fly","t":1.5,"joints":{"pelvis":[0.484,-29.574,1.082917,-33.239391],"head":[1.526895,-45.711024,1.288105,-57.206544],"near_hand":[-5.464739,-32.285826,-2.528152,-31.060435],"far_hand":[2.442345,-30.699062,-0.26156,-30.622118],"near_shin":[-6.320327,-19.016056,-11.581179,-11.378615],"far_foot":[-4.100471,-9.059001,-3.774799,-4.436459]}}
];

test('the shipped puppet.json is the genesis.puppet.v1 export with both sheets and 14 clips',()=>{
  assert.equal(P.format,'genesis.puppet.v1');
  assert.deepEqual(P.sheets.head.size,[103,69]);
  assert.deepEqual(P.sheets.body.size,[69,112]);
  assert.deepEqual(P.sheets.body.parts.chest.rect,[25,15,44,60]);
  // bố cục có nghĩa: tay, chân gần ở bên trái thân, ô xa ở bên phải, đối xứng qua cột giữa
  const S=P.sheets.body.parts;
  for(const [far,near] of Object.entries(P.far_parts)) assert.ok(S[near].rect[2]<=S.chest.rect[0] && S[far].rect[0]>=S.chest.rect[2], far);              // ô ngực cao tới gần mắt cá: vẽ được áo dài
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

test('hidden parts are left out on both sides; the rest of the figure is unchanged',()=>{
  const body=blank('body'), box=frameBox(P), f=keyPose(P.clips.run,2), green=rgba(10,200,10), blue=rgba(20,20,220);
  fillCell(body,P.sheets.body.parts.thigh.rect,green);
  fillCell(body,P.sheets.body.parts.shin.rect,blue);
  const all=bake(P,{body},f,box,{outline:false}).px, noThigh=bake(P,{body},f,box,{outline:false,hide:['thigh']}).px;
  const far=v=>rgba(Math.round((v&255)*FAR_SHADE),Math.round(((v>>8)&255)*FAR_SHADE),Math.round(((v>>16)&255)*FAR_SHADE));
  assert.ok(all.includes(green) && all.includes(far(green)));
  assert.ok(!noThigh.includes(green) && !noThigh.includes(far(green)));      // cả đùi gần lẫn đùi xa
  assert.ok(noThigh.includes(blue) && noThigh.includes(far(blue)));          // cẳng chân vẫn còn
  assert.deepEqual(bake(P,{body},f,box,{hide:[]}).px,bake(P,{body},f,box).px);
  // ẩn miếng thì chạm vào rối không trúng nó
  assert.ok(!bake(P,{body},f,box,{hide:['thigh']}).who.includes(partsOf(P).indexOf('thigh')+1));
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
  assert.ok(Math.abs(k[0])<1e-9 && Math.abs(k[1]-P.bones.find(b=>b.name==='near_thigh').length)<1e-9);
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
const FLAP_REF=[{"clip": "idle", "t": 0, "pts": {"flap_back": [[-2.238, -23.012], [-3.626676, -17.564406], [-4.634618, -12.033695], [-5.256984, -6.446445]], "flap_right": [[2.783, -23.012], [5.502971, -18.718562], [7.51883, -14.052926], [8.781079, -9.129657]], "flap_left": [[-0.605, -23.012], [-1.993676, -17.564406], [-3.001618, -12.033695], [-3.623984, -6.446445]]}}, {"clip": "run", "t": 0, "pts": {"flap_back": [[-4.053, -26.824], [-5.673922, -21.525509], [-5.441411, -15.989506], [-6.453059, -10.541757]], "flap_right": [[0.968, -26.824], [3.833529, -22.719415], [5.461633, -17.985691], [4.547665, -13.06395]], "flap_left": [[-2.42, -26.824], [-4.040922, -21.525509], [-3.808411, -15.989506], [-2.914892, -10.52114]]}}, {"clip": "run", "t": 0.27, "pts": {"flap_back": [[-4.053, -26.7358], [-7.112293, -22.917178], [-7.05401, -18.024557], [-7.816065, -13.191295]], "flap_right": [[0.968, -26.7358], [-2.091293, -22.917178], [-2.03301, -18.024557], [-1.247344, -13.195077]], "flap_left": [[-2.42, -26.7358], [1.028441, -23.695591], [1.665273, -19.142673], [0.949276, -14.601532]]}}, {"clip": "sit", "t": 0.7777777777777778, "pts": {"flap_back": [[-2.238, -8.832], [-5.963698, -7.288765], [-7.376968, -3.511853], [-3.840974, -1.573]], "flap_right": [[2.783, -8.832], [6.508698, -7.288765], [9.793248, -4.949079], [12.501523, -1.961162]], "flap_left": [[-0.605, -8.832], [-4.330698, -7.288765], [-5.743968, -3.511853], [-2.207974, -1.573]]}}, {"clip": "jump", "t": 0.05, "pts": {"flap_back": [[-2.238, -22.9394], [-3.626676, -17.491806], [-4.634618, -11.961095], [-5.256984, -6.373845]], "flap_right": [[2.783, -22.9394], [5.502971, -18.645962], [7.51883, -13.980326], [8.781079, -9.057057]], "flap_left": [[-0.605, -22.9394], [-1.993676, -17.491806], [-3.001618, -11.961095], [-3.623984, -6.373845]]}}, {"clip": "fly", "t": 1.5, "pts": {"flap_back": [[-2.238, -28.969], [-3.903811, -23.701323], [-5.093306, -18.306099], [-5.810019, -12.827991]], "flap_right": [[2.783, -28.969], [1.425314, -23.502754], [0.463422, -17.953166], [-0.111022, -12.350205]], "flap_left": [[-0.605, -28.969], [-2.270811, -23.701323], [-3.460306, -18.306099], [-4.177019, -12.827991]]}}, {"clip": "skill_02", "t": 1.234, "pts": {"flap_back": [[-2.238, -24.537704], [-3.57162, -19.057166], [-4.587692, -13.508975], [-5.216428, -7.903662]], "flap_right": [[2.783, -24.537704], [4.180351, -19.095382], [5.194661, -13.568842], [5.820988, -7.98501]], "flap_left": [[-0.605, -24.537704], [-1.93862, -19.057166], [-2.954692, -13.508975], [-3.583428, -7.903662]]}}];

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

test('far cells mirror the near layout and each maps to the near part it stands in for',()=>{
  const S=P.sheets.body.parts;
  assert.equal(Object.keys(P.far_parts).length,6);
  for(const [far,near] of Object.entries(P.far_parts)){
    assert.ok(isFarCell(P,far) && !isFarCell(P,near) && nearOf(P,far)===near && farCellOf(P,near)===far);
    const a=S[near], b=S[far];
    assert.deepEqual([b.rect[2]-b.rect[0],b.rect[3]-b.rect[1]],[a.rect[2]-a.rect[0],a.rect[3]-a.rect[1]]);
    assert.ok(Math.abs((b.joint[0]-b.rect[0])-(a.joint[0]-a.rect[0]))<1e-9 && Math.abs((b.joint[1]-b.rect[1])-(a.joint[1]-a.rect[1]))<1e-9);
    assert.deepEqual(attachPoints(P,far),attachPoints(P,near));
  }
  const bo=blockoutSheet(P,'body'), t=S.far_thigh;                 // ô xa không có khối mờ: hiện như khung trống
  for(let y=t.rect[1];y<t.rect[3];y++) for(let x=t.rect[0];x<t.rect[2];x++) assert.equal(bo.px[y*bo.w+x],0);
});

test('a painted far cell replaces the darkened near art; an empty one falls back to it',()=>{
  const box=frameBox(P), red=rgba(200,40,40), blue=rgba(40,60,200), f=keyPose(P.clips.run,0);
  const darkRed=rgba(Math.round(200*FAR_SHADE),Math.round(40*FAR_SHADE),Math.round(40*FAR_SHADE));
  const body=blank('body');
  fillCell(body,P.sheets.body.parts.thigh.rect,red);
  const before=bake(P,{body},f,box).px;
  assert.ok(before.includes(red) && before.includes(darkRed));        // ô xa trống: đùi xa = đùi gần tối đi
  fillCell(body,P.sheets.body.parts.far_thigh.rect,blue);
  const {px,who}=bake(P,{body},f,box);
  assert.ok(px.includes(red) && px.includes(blue) && !px.includes(darkRed));   // ô xa đã vẽ: dùng y nguyên, không tối
  const names=partsOf(P), ids=new Set([...who].filter(Boolean).map(i=>names[i-1]));
  assert.deepEqual([...ids].sort(),['far_thigh','thigh']);
  // chỉ xem ô xa: chỉ chi phía xa · chỉ xem ô gần: chỉ chi phía gần (phía xa đã có nét riêng)
  const farOnly=bake(P,{body},f,box,{only:'far_thigh'}).px, nearOnly=bake(P,{body},f,box,{only:'thigh'}).px;
  assert.ok(farOnly.includes(blue) && !farOnly.includes(red));
  assert.ok(nearOnly.includes(red) && !nearOnly.includes(blue));
  // ô xa còn trống mà chọn nó: vẫn thấy chi phía xa (nét gần tối đi)
  const only2=bake(P,{body:(()=>{ const b=blank('body'); fillCell(b,P.sheets.body.parts.thigh.rect,red); return b; })()},f,box,{only:'far_thigh'}).px;
  assert.ok(only2.includes(darkRed) && !only2.includes(red));
  assert.ok(!bake(P,{body},f,box,{hide:['far_thigh']}).px.includes(blue));
});

test('copy near to far darkens one ramp step, replaces the far cell, and lint is quiet on empty far cells',()=>{
  const S=P.sheets.body.parts, body=blank('body'), skin=GENESIS_FAMILIES.skin.ramp;
  assert.equal(lintSheet(P,'body',(()=>{ const b=blank('body'); fillCell(b,S.thigh.rect,hex('#806f95')); return b.px; })(),GENESIS_COLORS).filter(r=>r[0]==='warn').length,0);
  fillCell(body,S.thigh.rect,hex(skin[2]));
  body.px[S.thigh.rect[1]*body.w+S.thigh.rect[0]]=rgba(10,200,250);     // màu ngoài bảng: tối đi kiểu thường
  body.px[S.far_thigh.rect[1]*body.w+S.far_thigh.rect[2]-1]=rgba(1,1,1); // nét cũ trong ô xa bị thay
  const {px,n}=copyNearToFar(P,body.px,body.px,body.w,'far_thigh',GENESIS_COLORS,GENESIS_TOKENS);
  const cnt=v=>px.filter(x=>x===v).length, area=(S.thigh.rect[2]-S.thigh.rect[0])*(S.thigh.rect[3]-S.thigh.rect[1]);
  assert.equal(n,area);
  assert.equal(cnt(hex(skin[1])),area-1);
  assert.equal(cnt(rgba(8,160,200)),1);
  assert.equal(cnt(rgba(1,1,1)),0);
  assert.equal(px[S.thigh.rect[1]*body.w+S.thigh.rect[0]+1],hex(skin[2]));   // ô gần không đổi
});
