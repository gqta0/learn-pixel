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
  {"clip":"idle","t":0,"joints":{"pelvis":[1.62,-17.43,1.62,-22.269],"head":[0.047,-38.398,-0.852639,-50.67809],"near_hand":[-2.181985,-22.983399,0.978219,-22.611601],"far_hand":[3.930232,-22.374703,1.272177,-21.872939],"near_shin":[-1.825534,-8.845004,-3.698659,-2.722112],"far_foot":[3.697953,-2.721646,8.320094,-2.390327]}},
  {"clip":"idle","t":0.5,"joints":{"pelvis":[1.62,-17.296,1.662228,-22.134816],"head":[0.230038,-38.276928,-0.990748,-50.529261],"near_hand":[-2.39498,-22.628476,0.731591,-22.037139],"far_hand":[4.246673,-21.968583,1.618521,-21.328394],"near_shin":[-1.504489,-8.735555,-3.698119,-2.720042],"far_foot":[3.69831,-2.71954,8.320451,-2.388221]}},
  {"clip":"fly_down","t":0,"joints":{"pelvis":[1.62,-27.652,2.460284,-32.417485],"head":[11.622817,-45.78412,21.166067,-53.564632],"near_hand":[-3.879942,-35.390185,-3.863836,-32.208226],"far_hand":[16.911492,-25.604452,16.75531,-22.903965],"near_shin":[-1.590916,-19.649491,-2.371245,-13.294218],"far_foot":[3.348811,-11.610266,7.982804,-11.602178]}},
  {"clip":"fly_down","t":0.18181818181818182,"joints":{"pelvis":[1.62,-14.252,1.198253,-19.072586],"head":[4.962041,-34.834974,9.536689,-46.266622],"near_hand":[-12.716741,-28.746516,-14.66306,-26.229183],"far_hand":[17.241839,-18.574036,18.781352,-16.349868],"near_shin":[-2.146998,-5.42765,-7.950559,-2.722638],"far_foot":[6.011691,-2.721157,10.633831,-2.389838]}},
  {"clip":"run","t":0,"joints":{"pelvis":[-1.331,-19.982,-0.490716,-24.747485],"head":[3.54759,-40.441785,5.220785,-52.640571],"near_hand":[1.837206,-28.106501,4.858452,-29.105098],"far_hand":[2.970255,-27.29355,3.378949,-24.619603],"near_shin":[-8.737435,-13.222326,-14.44255,-10.315425],"far_foot":[5.521643,-5.528349,10.155636,-5.520261]}},
  {"clip":"run","t":0.2,"joints":{"pelvis":[-1.331,-18.897,-0.324915,-23.630256],"head":[3.713391,-39.324556,4.959835,-51.574305],"near_hand":[-5.356228,-25.351807,-2.51377,-23.921578],"far_hand":[9.896767,-25.558203,12.182948,-24.11238],"near_shin":[0.759097,-13.85363,-4.073308,-9.652884],"far_foot":[-7.707978,-6.125226,-4.92563,-2.419487]}},
  {"clip":"run","t":0.27,"joints":{"pelvis":[-1.331,-19.9187,-0.494875,-24.684916],"head":[3.50233,-40.389735,5.175525,-52.588521],"near_hand":[-8.213014,-26.38787,-5.941894,-24.159162],"far_hand":[10.12697,-27.721832,12.644441,-26.732203],"near_shin":[0.14485,-13.97978,-0.579991,-7.617939],"far_foot":[-9.106237,-9.276207,-8.14673,-4.742632]}},
  {"clip":"jump","t":0.8333333333333334,"joints":{"pelvis":[0.484,-18.707,0.484,-23.546],"head":[-1.089,-39.675,-2.41666,-51.916213],"near_hand":[-14.599759,-40.95736,-17.556053,-42.13441],"far_hand":[13.382549,-42.014635,15.777758,-43.271614],"near_shin":[2.96995,-13.121354,-2.327731,-9.525108],"far_foot":[5.16977,-9.113626,9.399844,-7.221423]}},
  {"clip":"skill_02","t":1.234,"joints":{"pelvis":[0.484,-18.266786,0.893293,-23.088445],"head":[1.01485,-39.293512,0.667614,-51.601615],"near_hand":[-4.900121,-23.900993,-2.082592,-22.422259],"far_hand":[18.117987,-28.581869,20.174518,-26.824681],"near_shin":[-3.621292,-9.997718,-7.201805,-4.68939],"far_foot":[5.531294,-2.735696,10.153435,-2.404377]}},
  {"clip":"fly","t":1.5,"joints":{"pelvis":[0.484,-20.9335,1.264334,-25.709167],"head":[2.312873,-41.880733,2.057158,-54.191078],"near_hand":[-3.021203,-26.688534,-0.084616,-25.463143],"far_hand":[3.048483,-25.354148,0.344578,-25.277204],"near_shin":[-5.278199,-13.287317,-8.910422,-8.014238],"far_foot":[-1.804225,-5.867071,0.913024,-2.113338]}}
];

test('the shipped puppet.json is the genesis.puppet.v1 export with both sheets and 14 clips',()=>{
  assert.equal(P.format,'genesis.puppet.v1');
  assert.deepEqual(P.sheets.head.size,[109,73]);                  // khung chibi, đầu 38%
  assert.deepEqual(P.sheets.body.size,[88,109]);                   // thân rộng thêm 2 px mỗi miếng, hàng vạt nới rộng
  assert.deepEqual(P.sheets.body.parts.chest.rect,[31,18,51,65]);
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
const FLAP_REF=[{"clip": "idle", "t": 0, "pts": {"flap_back": [[-1.102, -16.825], [-1.199945, -12.922142], [-1.253295, -9.018421], [-1.275424, -5.114397]], "flap_right": [[3.919, -16.825], [4.80734, -13.275283], [5.45819, -9.674445], [5.863882, -6.037818]], "flap_left": [[0.531, -16.825], [0.433055, -12.922142], [0.379705, -9.018421], [0.357576, -5.114397]]}}, {"clip": "run", "t": 0, "pts": {"flap_back": [[-4.053, -19.377], [-5.10664, -15.93285], [-4.955502, -12.33431], [-5.613098, -8.793138]], "flap_right": [[0.968, -19.377], [2.830665, -16.708918], [3.888973, -13.63188], [3.294871, -10.432626]], "flap_left": [[-2.42, -19.377], [-3.47364, -15.93285], [-3.322502, -12.33431], [-2.741692, -8.779737]]}}, {"clip": "run", "t": 0.27, "pts": {"flap_back": [[-4.053, -19.3137], [-6.041616, -16.831501], [-6.003731, -13.651176], [-6.499085, -10.509436]], "flap_right": [[0.968, -19.3137], [-1.020616, -16.831501], [-0.982731, -13.651176], [-0.472029, -10.511894]], "flap_left": [[-2.42, -19.3137], [-0.178428, -17.337489], [0.235529, -14.377979], [-0.229887, -11.426125]]}}, {"clip": "sit", "t": 0.7777777777777778, "pts": {"flap_back": [[-2.238, -11.843], [-4.659796, -10.839859], [-5.795589, -8.477368], [-4.959288, -5.99302]], "flap_right": [[2.783, -11.843], [5.204796, -10.839859], [7.157052, -9.090549], [8.416331, -6.791505]], "flap_left": [[-0.605, -11.843], [-3.026796, -10.839859], [-4.162589, -8.477368], [-3.326288, -5.99302]]}}, {"clip": "jump", "t": 0.05, "pts": {"flap_back": [[-1.4428, -15.7186], [-1.564603, -11.82328], [-1.652578, -7.92705], [-1.70672, -4.030202]], "flap_right": [[3.5782, -15.7186], [4.458742, -12.164218], [5.097696, -8.558567], [5.492154, -4.918047]], "flap_left": [[0.1902, -15.7186], [0.068397, -11.82328], [-0.019578, -7.92705], [-0.07372, -4.030202]]}}, {"clip": "fly", "t": 1.5, "pts": {"flap_back": [[-2.238, -20.3285], [-3.320818, -16.904379], [-4.09402, -13.39735], [-4.559901, -9.836444]], "flap_right": [[2.783, -20.3285], [1.900471, -16.775304], [1.275217, -13.167935], [0.901814, -9.525871]], "flap_left": [[-0.605, -20.3285], [-1.687818, -16.904379], [-2.46102, -13.39735], [-2.926901, -9.836444]]}}, {"clip": "skill_02", "t": 1.234, "pts": {"flap_back": [[-2.238, -17.661786], [-3.104886, -14.099301], [-3.765358, -10.492838], [-4.174052, -6.849247]], "flap_right": [[2.783, -17.661786], [3.691313, -14.124141], [4.350639, -10.531754], [4.757767, -6.902125]], "flap_left": [[-0.605, -17.661786], [-1.471886, -14.099301], [-2.132358, -10.492838], [-2.541052, -6.849247]]}}];

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

for(const [from,n] of [[[76,103],18],[[82,109],18]]) test('a body sheet drawn on '+from.join('x')+' carries over to the current body sheet: every cell moves by its offset, side flaps arrive whole',()=>{
  const L=oldLayout('body',...from);
  assert.ok(L); assert.deepEqual(L.to,P.sheets.body.size); assert.equal(L.move.length,n);
  const [w,h]=from, cells=P.sheets.body.parts, name=Object.keys(cells), W=L.to[0];
  L.move.forEach(([,,,to],i)=>assert.deepEqual(to,cells[name[i]].rect,name[i]));      // ô đích là ô hiện tại
  // một pixel ở tâm và một ở bốn góc của mỗi ô cũ: tất cả tới đúng chỗ cũ + độ dời, không mất pixel nào
  const px=new Uint32Array(w*h), want=[];
  L.move.forEach(([r,dx,dy],i)=>{
    for(const [x,y] of [[Math.floor((r[0]+r[2])/2),Math.floor((r[1]+r[3])/2)],[r[0],r[1]],[r[2]-1,r[1]],[r[0],r[3]-1],[r[2]-1,r[3]-1]]){
      const v=rgba(10+i,20+want.length%200,30); px[y*w+x]=v; want.push([x+dx,y+dy,v]);
    }
  });
  px[0]=rgba(9,9,9); want.push([0,0,rgba(9,9,9)]);                                      // góc sheet, ngoài mọi ô: giữ chỗ
  const out=upgradeLayer(L,px);
  assert.equal(out.length,L.to[0]*L.to[1]);
  for(const [x,y,v] of want) assert.equal(out[y*W+x],v,x+','+y);
  assert.equal(out.filter(Boolean).length,want.length);
});

test('old builds are not migrated; upgradeLayer still grows a sheet and moves listed cells by whole pixels',()=>{
  // khung 2,3 đầu (chibi) đổi hết tỉ lệ: bản vẽ cho khung cũ (Thân 69×112 / 76×112, Đầu 103×69) không dời vào ô mới
  for(const [k,w,h] of [['body',69,112],['body',76,112],['head',103,69],['head',118,79],['body',76,99]]) assert.equal(oldLayout(k,w,h),null,k+' '+w+'x'+h);
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

test('auto outline: the chest adds no dark line over the far arm at the far shoulder (cast 5)',()=>{
  // tay xa vẽ riêng ở ô xa, ô tay gần để trống; nhóm đầu vẽ sau ngực: ẩn
  const body=blockoutSheet(P,'body'), box=frameBox(P), W=box.w, arm=['upper_arm','forearm','hand'], later=['head','hair_front','accessory'];
  for(const p of arm){ body.px=copyNearToFar(P,body.px,body.px,body.w,'far_'+p,GENESIS_COLORS,GENESIS_TOKENS).px; fillCell(body,P.sheets.body.parts[p].rect,0); }
  for(const [clip,i] of [['cast',5],['cast',6],['jab',8]]){
    const f=keyPose(P.clips[clip],i), [jx,jy]=joints(P,f).far_upper_arm, sx=box.fx+jx, sy=box.fy+jy;
    const base=bake(P,{body},f,box,{hide:[...later,'chest']}).px, full=bake(P,{body},f,box,{hide:later}).px;
    let seam=0;
    full.forEach((v,k)=>{
      if(v!==OUTLINE || !base[k] || base[k]===OUTLINE) return;      // viền ngực nằm trên tay xa
      if(Math.hypot(k%W+0.5-sx,Math.floor(k/W)+0.5-sy)<=4) seam++;
    });
    assert.equal(seam,0,clip+' '+i+': viền ngực cắt ngang vai tay xa');
  }
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
