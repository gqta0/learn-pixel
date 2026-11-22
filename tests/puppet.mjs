import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {frameAt, keyPose, joints, placements, frameBox, bake, bakeAt, flapPoints, isFlap, blockoutSheet, cellAt, attachPoints, shadeRamp, shadeCell,
  lintSheet, bakeClips, bakeManifest, sheetFileName, partsOf, isFarCell, nearOf, farCellOf, copyNearToFar, OUTLINE, FAR_SHADE, BLOCK_COLORS, oldLayout, upgradeLayer, LIGHTS, SLOT_ZONES} from '../js/puppet.js';
import {GENESIS_FAMILIES, GENESIS_COLORS, GENESIS_TOKENS} from '../js/genesis.js';

const P=JSON.parse(readFileSync(new URL('../data/puppet.json',import.meta.url),'utf8'));
const rgba=(r,g,b,a=255)=>((a<<24)|(b<<16)|(g<<8)|r)>>>0;
const hex=h=>rgba(parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16));
const blank=kind=>{ const [w,h]=P.sheets[kind].size; return {w,h,px:new Uint32Array(w*h)}; };
const fillCell=(sh,rect,v)=>{ for(let y=rect[1];y<rect[3];y++) for(let x=rect[0];x<rect[2];x++) sh.px[y*sh.w+x]=v; };

/* Giá trị tính bằng bản Python gốc (character-animation/tools/bones.py: joints(frame_at(clip, t)))
   chạy trên chính data/puppet.json: B.BONES = puppet["bones"]. [khớp x, khớp y, mút x, mút y]. */
const REF=[
  {"clip":"idle","t":0,"joints":{"pelvis":[1.461,-16.176,1.461,-20.623],"head":[-0.112,-35.445,-1.126422,-49.291891],"near_hand":[-2.50054,-21.264577,0.659664,-20.892779],"far_hand":[3.958277,-20.706191,1.300222,-20.204427],"near_shin":[-1.962492,-8.255064,-3.655121,-2.72218],"far_foot":[3.654271,-2.722285,8.276411,-2.390965]}},
  {"clip":"idle","t":0.5,"joints":{"pelvis":[1.461,-16.0515,1.499807,-20.498331],"head":[0.056212,-35.333493,-1.320333,-49.149085],"near_hand":[-2.696939,-20.940518,0.429631,-20.349181],"far_hand":[4.249504,-20.32777,1.621352,-19.687582],"near_shin":[-1.672165,-8.155423,-3.654415,-2.719572],"far_foot":[3.65426,-2.719443,8.276401,-2.388124]}},
  {"clip":"fly_down","t":0,"joints":{"pelvis":[1.461,-25.789,2.233213,-30.16844],"head":[10.555623,-42.533856,21.316484,-51.307073],"near_hand":[-3.9705,-33.190012,-3.954395,-30.008053],"far_hand":[15.814033,-23.644252,15.657851,-20.943765],"near_shin":[-1.773047,-18.450513,-2.478183,-12.707641],"far_foot":[3.292873,-11.008995,7.926866,-11.000907]}},
  {"clip":"fly_down","t":0.18181818181818182,"joints":{"pelvis":[1.461,-13.33,1.073418,-17.760078],"head":[4.411689,-32.286673,9.57001,-45.17687],"near_hand":[-12.183157,-26.799864,-14.129475,-24.282531],"far_hand":[16.193286,-17.166376,17.732799,-14.942208],"near_shin":[-2.23649,-5.166429,-7.480813,-2.722075],"far_foot":[5.763929,-2.721651,10.386012,-2.389525]}},
  {"clip":"run","t":0,"joints":{"pelvis":[-1.331,-18.658,-0.558787,-23.03744],"head":[3.0325,-37.503562,4.919175,-51.258776],"near_hand":[1.12544,-26.19671,4.146686,-27.195307],"far_hand":[2.999841,-25.299275,3.408535,-22.625328],"near_shin":[-8.35629,-12.442559,-13.511654,-9.81577],"far_foot":[5.130836,-5.31325,9.764829,-5.305162]}},
  {"clip":"run","t":0.2,"joints":{"pelvis":[-1.331,-17.65,-0.406417,-21.999822],"head":[3.184869,-36.465944,4.590346,-50.278623],"near_hand":[-5.493227,-23.663492,-2.650769,-22.233263],"far_hand":[9.371754,-23.685749,11.657935,-22.239927],"near_shin":[0.2216,-12.997215,-4.14515,-9.201258],"far_foot":[-6.83389,-5.815432,-4.051542,-2.109693]}},
  {"clip":"run","t":0.27,"joints":{"pelvis":[-1.331,-18.5992,-0.562609,-22.979312],"head":[2.990793,-37.454786,4.877469,-51.21],"near_hand":[-8.126456,-24.609143,-5.855336,-22.380435],"far_hand":[9.58644,-25.69978,12.103911,-24.710151],"near_shin":[-0.329824,-13.125194,-0.984818,-7.376387],"far_foot":[-8.086942,-8.698227,-7.127435,-4.164652]}},
  {"clip":"jump","t":0.8333333333333334,"joints":{"pelvis":[0.484,-17.365,0.484,-21.812],"head":[-1.089,-36.634,-2.586054,-50.437053],"near_hand":[-13.867653,-37.82571,-16.823948,-39.00276],"far_hand":[12.731736,-38.798941,15.126945,-40.055921],"near_shin":[2.421494,-12.154396,-2.365696,-8.904688],"far_foot":[5.033131,-8.463586,9.263204,-6.571383]}},
  {"clip":"skill_02","t":1.234,"joints":{"pelvis":[0.484,-17.032136,0.860137,-21.4632],"head":[0.845075,-36.368427,0.453535,-50.246905],"near_hand":[-4.934154,-22.242435,-2.116625,-20.763701],"far_hand":[17.087772,-26.466592,19.144302,-24.709405],"near_shin":[-3.547288,-9.423358,-6.782779,-4.626547],"far_foot":[5.338949,-2.738962,9.96109,-2.407643]}},
  {"clip":"fly","t":1.5,"joints":{"pelvis":[0.484,-19.376,1.20112,-23.764798],"head":[2.038893,-38.64647,1.750552,-52.527475],"near_hand":[-3.202402,-24.724563,-0.265815,-23.499172],"far_hand":[3.207309,-23.364326,0.503403,-23.287382],"near_shin":[-5.054116,-12.355315,-8.336334,-7.590355],"far_foot":[-1.310466,-5.480663,1.406783,-1.72693]}}
];

test('the shipped puppet.json is the genesis.puppet.v1 export with both sheets and 14 clips',()=>{
  assert.equal(P.format,'genesis.puppet.v1');
  assert.deepEqual(P.sheets.head.size,[118,79]);                  // khung 2,3 đầu (chibi)
  assert.deepEqual(P.sheets.body.size,[76,99]);
  assert.deepEqual(P.sheets.body.parts.chest.rect,[29,16,47,60]);
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
  // ô tô kín (trường hợp xấu nhất, kể cả miếng dời ½ px khi snap): không pixel màu nào chạm mép, viền còn chỗ
  const full={};
  for(const k of ['head','body']){ full[k]=blank(k); for(const c of Object.values(P.sheets[k].parts)) fillCell(full[k],c.rect,rgba(128,128,128)); }
  for(const clip of Object.values(P.clips)) for(let i=0;i<clip.frames.length;i++){
    const {px}=bakeAt(P,full,clip,i/clip.fps,box), W=box.w, inner=v=>v && v!==OUTLINE;
    for(let y=0;y<box.h;y++){ assert.ok(!inner(px[y*W])); assert.ok(!inner(px[y*W+W-1])); }
    for(let x=0;x<W;x++){ assert.ok(!inner(px[x])); assert.ok(!inner(px[(box.h-1)*W+x])); }
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
  assert.equal(m.height,P.height); assert.equal(m.height,64);
  assert.equal(m.clips.skill_02.frames,18);
});

/* tools/flaps.py points(clip, t) chạy trên data/puppet.json: B.BONES = puppet["bones"], hằng số REST/SHORT/LAG/
   FOLLOW/GROUND/FLAPS lấy từ khối "flaps" (pixel game). [bản lề, khớp, khớp, gấu] của từng vạt. */
const FLAP_REF=[{"clip": "idle", "t": 0, "pts": {"flap_back": [[-1.261, -15.571], [-1.350455, -12.028625], [-1.39928, -8.485456], [-1.419612, -4.94201]], "flap_right": [[3.76, -15.571], [4.603689, -12.371754], [5.221614, -9.121345], [5.606594, -5.835196]], "flap_left": [[0.372, -15.571], [0.282545, -12.028625], [0.23372, -8.485456], [0.213388, -4.94201]]}}, {"clip": "run", "t": 0, "pts": {"flap_back": [[-4.053, -18.053], [-5.009368, -14.926812], [-4.872183, -11.660487], [-5.46907, -8.446234]], "flap_right": [[0.968, -18.053], [2.658704, -15.631234], [3.61931, -12.838266], [3.080055, -9.934366]], "flap_left": [[-2.42, -18.053], [-3.376368, -14.926812], [-3.239183, -11.660487], [-2.711994, -8.43407]]}}, {"clip": "run", "t": 0.27, "pts": {"flap_back": [[-4.053, -17.9942], [-5.858028, -15.741156], [-5.82364, -12.854437], [-6.273264, -10.002741]], "flap_right": [[0.968, -17.9942], [-0.837028, -15.741156], [-0.80264, -12.854437], [-0.339086, -10.004972]], "flap_left": [[-2.42, -17.9942], [-0.385369, -16.200431], [-0.009628, -13.514142], [-0.432077, -10.834801]]}}, {"clip": "sit", "t": 0.7777777777777778, "pts": {"flap_back": [[-2.238, -11.858], [-4.436217, -10.947469], [-5.495966, -8.817173], [-4.8012, -6.541535]], "flap_right": [[2.783, -11.858], [4.981217, -10.947469], [6.730299, -9.334416], [7.809796, -7.214059]], "flap_left": [[-0.605, -11.858], [-2.803217, -10.947469], [-3.862966, -8.817173], [-3.1682, -6.541535]]}}, {"clip": "jump", "t": 0.05, "pts": {"flap_back": [[-1.5541, -14.5816], [-1.665209, -11.04607], [-1.74546, -7.509705], [-1.794848, -3.972774]], "flap_right": [[3.4669, -14.5816], [4.303886, -11.378218], [4.911543, -8.123536], [5.286809, -4.83395]], "flap_left": [[0.0789, -14.5816], [-0.032209, -11.04607], [-0.11246, -7.509705], [-0.161848, -3.972774]]}}, {"clip": "fly", "t": 1.5, "pts": {"flap_back": [[-2.238, -18.771], [-3.220853, -15.662992], [-3.922673, -12.47973], [-4.345544, -9.247564]], "flap_right": [[2.783, -18.771], [1.981945, -15.545833], [1.414414, -12.271494], [1.075484, -8.965664]], "flap_left": [[-0.605, -18.771], [-1.587853, -15.662992], [-2.289673, -12.47973], [-2.712544, -9.247564]]}}, {"clip": "skill_02", "t": 1.234, "pts": {"flap_back": [[-2.238, -16.427136], [-3.024855, -13.193537], [-3.624353, -9.920022], [-3.995317, -6.612804]], "flap_right": [[2.783, -16.427136], [3.607458, -13.216085], [4.205916, -9.955344], [4.575458, -6.6608]], "flap_left": [[-0.605, -16.427136], [-1.391855, -13.193537], [-1.991353, -9.920022], [-2.362317, -6.612804]]}}];

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

test('the sheet guide shows the blockout in far cells too, a step darker, mirroring the near cells',()=>{
  const S=P.sheets.body.parts, plain=blockoutSheet(P,'body'), guide=blockoutSheet(P,'body',{far:true}), w=guide.w;
  const dark=v=>rgba(Math.round((v&255)*FAR_SHADE),Math.round(((v>>8)&255)*FAR_SHADE),Math.round(((v>>16)&255)*FAR_SHADE));
  for(const [far,near] of Object.entries(P.far_parts)){
    const a=S[near].rect, b=S[far].rect;
    let n=0;
    for(let y=0;y<a[3]-a[1];y++) for(let x=0;x<a[2]-a[0];x++){
      const v=plain.px[(a[1]+y)*w+a[0]+x], u=guide.px[(b[1]+y)*w+b[0]+x];
      assert.equal(u, v ? dark(v) : 0, far+' '+x+','+y);          // cùng dáng với ô gần, tối hơn một bậc
      if(u) n++;
    }
    assert.ok(n>10, far+' has a blockout');
  }
  for(let i=0;i<w*guide.h;i++) if(!Object.keys(P.far_parts).some(f=>{ const r=S[f].rect, x=i%w, y=Math.floor(i/w); return x>=r[0]&&y>=r[1]&&x<r[2]&&y<r[3]; }))
    assert.equal(guide.px[i],plain.px[i]);                      // ngoài ô xa: y như khối mẫu thường
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

test('turning parts keeps what is drawn: a 1-px tip, a lone dot and a 1-px notch survive at rest',()=>{
  const body=blank('body'), A=rgba(120,90,160), B=rgba(240,220,90), box=frameBox(P);
  const [x0,y0]=P.sheets.body.parts.chest.rect;
  fillCell(body,[x0+3,y0+15,x0+15,y0+35],A);
  body.px[(y0+14)*body.w+x0+9]=A;          // mũi nhọn: một hàng xóm
  body.px[(y0+25)*body.w+x0+8]=B;          // chấm lẻ
  body.px[(y0+25)*body.w+x0+3]=0;          // khe 1 px ở mép trái: ba hàng xóm
  const rest={_move:[0,0],_pos:{},_scale:{}};   // thân không quay ở tư thế nghỉ
  const {px,who}=bake(P,{body},rest,box,{only:'chest',outline:false});
  const shape=(arr,w,h)=>{ const pts=[]; for(let y=0;y<h;y++) for(let x=0;x<w;x++) if(arr[y*w+x]) pts.push([x,y,arr[y*w+x]]);
    const mx=Math.min(...pts.map(p=>p[0])), my=Math.min(...pts.map(p=>p[1])); return pts.map(([x,y,v])=>`${x-mx},${y-my},${v}`).sort(); };
  assert.deepEqual(shape(px,box.w,box.h),shape(body.px,body.w,body.h));
  px.forEach((v,i)=>assert.equal(!!v,!!who[i]));                // who khớp với pixel
});

test('turned parts leave few stray pixels: spikes per frame over every key frame stay low',()=>{
  const ramps=[{base:BLOCK_COLORS.skin,shadow:rgba(214,150,128),light:rgba(255,222,200)},{base:BLOCK_COLORS.cloth,shadow:rgba(92,78,112),light:rgba(170,156,190)}];
  const sheets={};
  for(const kind of ['head','body']){
    const sh=blockoutSheet(P,kind);
    for(const c of Object.values(P.sheets[kind].parts)){
      for(const r of ramps) sh.px=shadeCell(sh.px,sh.w,c.rect,[-1,-1],r).px;
      // tỉa mũi nhọn 1 px có sẵn trong khối mẫu (bake giữ chúng vì nằm trong bản vẽ): chỉ đếm gai do phép quay sinh ra
      const [x0,y0,x1,y1]=c.rect, on=(x,y)=>x>=x0&&y>=y0&&x<x1&&y<y1&&sh.px[y*sh.w+x];
      for(let y=y0;y<y1;y++) for(let x=x0;x<x1;x++) if(on(x,y) && [on(x-1,y),on(x+1,y),on(x,y-1),on(x,y+1)].filter(Boolean).length<=1) sh.px[y*sh.w+x]=0;
    }
    sheets[kind]=sh;
  }
  const box=frameBox(P), W=box.w; let spikes=0, frames=0;
  for(const clip of Object.values(P.clips)) for(let i=0;i<clip.frames.length;i++){
    const {px,who}=bakeAt(P,sheets,clip,i/clip.fps,box); frames++;
    px.forEach((v,k)=>{ if(!v) assert.equal(who[k],0); });
    for(let y=1;y<box.h-1;y++) for(let x=1;x<W-1;x++){
      const k=y*W+x; if(!px[k]) continue;
      if([px[k-1],px[k+1],px[k-W],px[k+W]].filter(Boolean).length<=1) spikes++;   // gai: chỉ chạm một pixel khác
    }
  }
  assert.ok(spikes/frames<0.5, 'spikes per frame '+(spikes/frames).toFixed(2));    // trước khi snap + dọn: 2.5
});

test('old builds are not migrated; upgradeLayer still grows a sheet and moves listed cells by whole pixels',()=>{
  // khung 2,3 đầu (chibi) đổi hết tỉ lệ: bản vẽ cho khung cũ (Thân 69×112 / 76×112, Đầu 103×69) không dời vào ô mới
  for(const [k,w,h] of [['body',69,112],['body',76,112],['head',103,69]]) assert.equal(oldLayout(k,w,h),null,k+' '+w+'x'+h);
  const L={kind:'body', from:[69,112], to:[76,112], move:[[[14,81,27,111],-8,0],[[28,81,41,111],3,0],[[42,81,55,111],14,0]]};
  const w=69, px=new Uint32Array(w*112), put=(x,y,v)=>{ px[y*w+x]=v; }, C=rgba(1,2,3);
  put(30,20,C);                                                      // ngoài các ô dời: giữ chỗ
  L.move.forEach(([r],i)=>put(r[0]+5,r[1]+7,rgba(10+i,20,30)));
  const out=upgradeLayer(L,px), W=L.to[0];
  assert.equal(out.length,76*112);
  assert.equal(out[20*W+30],C);
  L.move.forEach(([r,dx],i)=>{
    assert.equal(out[(r[1]+7)*W+r[0]+5+dx],rgba(10+i,20,30));
    assert.equal(out[(r[1]+7)*W+r[0]+5],0,'không còn ở chỗ cũ');
  });
  assert.equal(out.filter(Boolean).length,4);
});

test('auto outline off: baked clips add no outline pixel and the manifest says outline null',()=>{
  const body=blank('body'), box=frameBox(P), cloth=rgba(120,90,160);
  for(const part of ['thigh','shin','chest','pelvis']) fillCell(body,P.sheets.body.parts[part].rect,cloth);
  const off=bakeClips(P,{body},box,{outline:false}), on=bakeClips(P,{body},box);
  assert.ok(off.every(b=>!b.px.includes(OUTLINE)), 'không có pixel viền khi tắt');
  assert.ok(off.some(b=>b.px.includes(cloth)), 'vẫn có nét vẽ');
  assert.ok(on.some(b=>b.px.includes(OUTLINE)), 'mặc định của bakeClips vẫn có viền');
  assert.equal(bakeManifest(P,box,off,{},{outline:false}).outline,null);
  assert.equal(bakeManifest(P,box,on).outline,'#251c24');
});

test('auto outline: the near arm adds no dark arc over the body at the shoulder, keeps it elsewhere',()=>{
  const body=blockoutSheet(P,'body'), box=frameBox(P), W=box.w, arm=['upper_arm','forearm','hand'];
  const solid=v=>v && v!==OUTLINE;
  let kept=0;
  for(const [clip,i] of [['idle',0],['jump',5],['run',2],['punch',2]]){
    const f=keyPose(P.clips[clip],i), [jx,jy]=joints(P,f).near_upper_arm, sx=box.fx+jx, sy=box.fy+jy;
    const near=k=>Math.hypot(k%W+0.5-sx,Math.floor(k/W)+0.5-sy)<=4;
    const base=bake(P,{body},f,box,{hide:arm}).px, full=bake(P,{body},f,box).px;
    full.forEach((v,k)=>{
      if(!solid(base[k]) || v!==OUTLINE) return;                 // viền nhóm tay nằm trên chỗ thân đã vẽ
      if(near(k)){ assert.fail(clip+' '+i+': viền tay đè lên thân ở vai ('+(k%W)+','+Math.floor(k/W)+')'); }
      else kept++;
    });
    assert.ok(!bake(P,{body},f,box,{outline:false}).px.includes(OUTLINE));
  }
  assert.ok(kept>0,'xa vai, viền tay vẫn vẽ đè lên thân');
});

test('auto outline: the chest draws no dark line across the hips, keeps its outline elsewhere',()=>{
  // tay xa vẽ riêng ở ô xa, ô tay gần để trống: tay gần (vẽ sau ngực) không có nét nào, chỉ còn viền của ngực
  const body=blockoutSheet(P,'body'), box=frameBox(P), W=box.w, names=partsOf(P), arm=['upper_arm','forearm','hand'];
  for(const p of arm){ body.px=copyNearToFar(P,body.px,body.px,body.w,'far_'+p,GENESIS_COLORS,GENESIS_TOKENS).px; fillCell(body,P.sheets.body.parts[p].rect,0); }
  const later=['head','hair_front','accessory'];                    // nhóm đầu vẽ sau ngực: ẩn
  const lower=new Set(['pelvis','thigh','shin','foot','far_thigh','far_shin','far_foot','flap_left','flap_back','flap_right']);
  let above=0, overFar=0;
  for(const [clip,i] of [['idle',0],['idle',2],['run',2],['jump',0]]){
    const f=keyPose(P.clips[clip],i), fl=flapPoints(P,P.clips[clip],i/P.clips[clip].fps), [wx,wy,nx,ny]=joints(P,f).chest;
    const L=Math.hypot(nx-wx,ny-wy), u=k=>((k%W+0.5-box.fx-wx)*(nx-wx)+(Math.floor(k/W)+0.5-box.fy-wy)*(ny-wy))/L;
    const base=bake(P,{body},f,box,{flaps:fl,hide:[...later,'chest']}), full=bake(P,{body},f,box,{flaps:fl,hide:later}).px;
    full.forEach((v,k)=>{
      if(v!==OUTLINE) return;
      if(base.px[k]===v) return;                                  // viền này có sẵn từ nhóm trước, không phải của ngực
      const id=base.who[k], under=base.px[k] ? (id ? names[id-1] : 'outline') : null;
      const inBand=u(k)<=2;                                       // từ khớp eo trở xuống
      if(inBand && (under==='outline' || lower.has(under))) assert.fail(clip+' '+i+': viền ngực kẻ ngang hông ('+(k%W)+','+Math.floor(k/W)+')');
      if(!under && u(k)>2) above++;
      if(['far_upper_arm','far_forearm','far_hand'].includes(under)) overFar++;   // tay phía xa
    });
    assert.ok(!bake(P,{body},f,box,{flaps:fl,outline:false}).px.includes(OUTLINE));
  }
  assert.ok(above>0,'phía trên dải, ngực vẫn có viền');
  assert.ok(overFar>0,'ngực vẫn có viền đè lên tay phía xa');
});
