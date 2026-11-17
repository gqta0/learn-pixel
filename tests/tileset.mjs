import {test} from 'node:test';
import assert from 'node:assert/strict';
import {getLayout, LAYOUT_IDS, pickSlot, contextSlots, layoutRoles, seedPixels, sidesToBlob,
  layoutGodotTres, layoutJson} from '../js/layouts.js';
import {createTileset, layoutOf, addFrame, removeFrame, moveFrame, setDuration, animations, sheetPixels,
  fromSheet, toJSON, fromJSON, toStore, cloneTileset, remapColors, frameCount, frameAt} from '../js/tileset.js';
import {BLOB_47_MASKS, TERRAIN_TILES} from '../js/terrain.js';

const COLORS={base:'#5e788c',edge:'#b4c5d1'};

test('every layout lists each slot once and every slot has its own atlas cell inside the grid',()=>{
  for(const id of LAYOUT_IDS){
    const L=getLayout(id,{cols:3,rows:2});
    assert.equal(new Set(L.slots.map(t=>t.slot)).size,L.slots.length,id);
    const cells=L.slots.map(t=>L.cells[t.slot].join(','));
    assert.equal(new Set(cells).size,cells.length,id+': two slots share a cell');
    for(const t of L.slots){ const [c,r]=L.cells[t.slot]; assert.ok(c>=0&&c<L.cols&&r>=0&&r<L.rows,id+' slot '+t.slot); }
  }
  assert.equal(getLayout('blob56').slots.length,56);
  assert.equal(getLayout('sides16').slots.length,16);
  assert.equal(getLayout('corners16').slots.length,16);
  assert.equal(getLayout('free',{cols:3,rows:2}).slots.length,6);
  assert.throws(()=>getLayout('nope'));
});

test('sides16 reuses blob topology: each 4-bit mask maps to a canonical blob mask with the same sides',()=>{
  for(let m=0;m<16;m++){
    const b=sidesToBlob(m);
    assert.ok(BLOB_47_MASKS.includes(b));
    assert.equal(b&15,m);
  }
  const roles=layoutRoles(getLayout('sides16'),15,16);
  assert.ok(roles.every(r=>r===1),'fully connected side tile is all body');
});

test('pickSlot: map neighborhood chooses the right tile for every layout',()=>{
  // một hàng ngang 3 ô: trái nối phải, giữa nối hai bên, phải nối trái
  const row=(x,y)=>y===0&&x>=0&&x<3;
  const sides=getLayout('sides16');
  assert.deepEqual([0,1,2].map(x=>pickSlot(sides,row,x,0)),[2,10,8]);
  assert.equal(pickSlot(sides,row,5,0),-1);
  const blob=getLayout('blob56');
  const mid=pickSlot(blob,row,1,0);
  assert.equal(TERRAIN_TILES[mid].mask&15,10);
  // khối đặc 3×3: ô giữa là ruột (mask 255) — có thể là ô gốc hoặc biến thể ruột
  const solid=(x,y)=>x>=0&&x<3&&y>=0&&y<3;
  assert.equal(TERRAIN_TILES[pickSlot(blob,solid,1,1)].mask,255);
  // nối góc: ô (0,0) của lưới đối ngẫu lấy bốn góc từ bốn ô quanh đỉnh
  const corners=getLayout('corners16');
  const one=(x,y)=>x===1&&y===1;
  assert.equal(pickSlot(corners,one,0,0),4);   // ô map (1,1) nằm ở góc dưới-phải
  assert.equal(pickSlot(corners,one,1,1),1);   // và ở góc trên-trái của ô (1,1)
  assert.equal(pickSlot(corners,solid,0,0),15);
  assert.equal(pickSlot(getLayout('free',{cols:2,rows:2}),one,1,1),0);
});

test('contextSlots: centre is the slot being drawn and neighbours agree with its connections',()=>{
  const sides=getLayout('sides16');
  // ô nối trái+phải (10): trái/phải có hàng xóm nối vào nó, trên/dưới trống
  const c=contextSlots(sides,10);
  assert.equal(c[4],10);
  assert.equal(c[1],-1); assert.equal(c[7],-1);
  assert.ok(c[3]&2 && c[5]&8,'side neighbours connect back');
  const blob=getLayout('blob56');
  for(const t of blob.slots){
    const ctx=contextSlots(blob,t.slot);
    assert.equal(ctx[4],t.slot);
    [[1,1],[5,2],[7,4],[3,8]].forEach(([i,bit])=>assert.equal(ctx[i]>=0,!!(t.mask&bit),'slot '+t.slot+' cell '+i));
  }
  const corners=getLayout('corners16');
  for(let m=0;m<16;m++){
    const ctx=contextSlots(corners,m);
    assert.equal(ctx[4],m);
    // ô bên phải chung cạnh phải: góc trên-trái của nó = góc trên-phải của ô giữa
    assert.equal(!!(ctx[5]&1),!!(m&2)); assert.equal(!!(ctx[5]&8),!!(m&4));
  }
});

test('seedPixels gives every layout a usable starting tile',()=>{
  for(const id of ['blob56','sides16','corners16']){
    const L=getLayout(id);
    for(const t of L.slots){
      const px=seedPixels(L,t.slot,16,COLORS);
      assert.equal(px.length,256);
      const solid=px.some(v=>v>>>24===255);
      if(id==='corners16' && t.mask===0) assert.ok(!solid);
      else assert.ok(solid,id+' slot '+t.slot+' has art');
    }
  }
});

test('frames: add / move / remove keep durations aligned; animations() lists only animated tiles',()=>{
  const ts=createTileset({layout:'sides16',size:16,colors:COLORS});
  assert.equal(addFrame(ts,5,0),1);
  setDuration(ts,5,0,80); setDuration(ts,5,1,'200');
  ts.tiles[5].frames[1][0]=0xff0000ff;
  assert.deepEqual(animations(ts),{5:[80,200]});
  assert.ok(moveFrame(ts,5,1,0));
  assert.equal(ts.tiles[5].frames[0][0],0xff0000ff); assert.deepEqual(ts.tiles[5].dur,[200,80]);
  assert.ok(removeFrame(ts,5,0)); assert.ok(!removeFrame(ts,5,0),'last frame stays');
  assert.deepEqual(animations(ts),{});
  setDuration(ts,5,0,-3); assert.equal(ts.tiles[5].dur[0],0);
});

test('sheetPixels lays frame k of every tile in block k; fromSheet reads block 0 back',()=>{
  const ts=createTileset({layout:'blob56',size:16,colors:COLORS});
  addFrame(ts,0,0); ts.tiles[0].frames[1].fill(0xff00ff00);
  assert.equal(frameCount(ts),2);
  const L=layoutOf(ts), sh=sheetPixels(ts,{blocks:2});
  assert.equal(sh.w,L.cols*16*2); assert.equal(sh.h,L.rows*16);
  const [c,r]=L.cells[0], at=(b,x,y)=>sh.data[(r*16+y)*sh.w+b*L.cols*16+c*16+x];
  assert.equal(at(1,3,3),0xff00ff00);
  assert.equal(at(0,3,3),ts.tiles[0].frames[0][3*16+3]);
  // ô 0 có bản sao: bản sao mang cùng tranh
  const cp=L.copies[0].cell; assert.equal(sh.data[(cp[1]*16+3)*sh.w+cp[0]*16+3],ts.tiles[0].frames[0][51]);
  // tile 1 khung trong khối 1 lặp lại khung 0
  const [c1,r1]=L.cells[7]; assert.equal(sh.data[(r1*16+8)*sh.w+L.cols*16+c1*16+8],ts.tiles[7].frames[0][8*16+8]);
  const back=fromSheet(sheetPixels(ts),{layout:'blob56',size:16});
  for(const t of L.slots) assert.deepEqual(back.tiles[t.slot].frames[0],ts.tiles[t.slot].frames[0]);
  assert.throws(()=>fromSheet({w:16,h:16,data:new Uint32Array(256)},{layout:'blob56',size:16}));
});

test('toJSON → fromJSON and toStore → fromJSON round-trip pixels, frames and durations',()=>{
  const ts=createTileset({name:'Đá',layout:'corners16',size:16,colors:COLORS,palette:['#112233']});
  addFrame(ts,3,0); setDuration(ts,3,1,120); ts.tiles[3].frames[1][9]=0xff123456;
  for(const copy of [fromJSON(JSON.parse(JSON.stringify(toJSON(ts)))),fromJSON(toStore(ts))]){
    assert.equal(copy.name,'Đá'); assert.equal(copy.layout,'corners16'); assert.deepEqual(copy.palette,['#112233']);
    assert.deepEqual(copy.tiles[3].dur,[0,120]);
    for(const slot of Object.keys(ts.tiles)) assert.deepEqual(copy.tiles[slot].frames,ts.tiles[slot].frames);
  }
  assert.throws(()=>fromJSON({schema:'x'}));
  assert.throws(()=>fromJSON({...toJSON(ts),size:7}));
  assert.throws(()=>fromJSON({...toJSON(ts),tiles:{3:{frames:[[1,5]]}}}),/RLE/);
  const twin=cloneTileset(ts,{name:'Đá 2'});
  assert.notEqual(twin.id,ts.id); twin.tiles[3].frames[0][0]=1; assert.notEqual(ts.tiles[3].frames[0][0],1);
});

test('remapColors swaps a colour in every frame of every tile',()=>{
  const ts=createTileset({layout:'sides16',size:8});
  ts.tiles[0].frames[0][0]=0xff0000ff; addFrame(ts,0,0);
  assert.equal(remapColors(ts,new Map([[0xff0000ff,0xff00ff00]])),2);
  assert.equal(frameAt(ts,0,1)[0],0xff00ff00);
});

test('Godot .tres: terrain mode, peering bits and animation follow the layout',()=>{
  const sides=layoutGodotTres(getLayout('sides16'),16,{anim:{6:[100,250]}});
  assert.match(sides,/terrain_set_0\/mode = 2/);
  assert.match(sides,/^2:1\/0\/terrains_peering_bit\/right_side = 0$/m);      // ô 6 = phải + dưới, ở ô [2,1]
  assert.match(sides,/^2:1\/0\/terrains_peering_bit\/bottom_side = 0$/m);
  assert.doesNotMatch(sides,/^2:1\/0\/terrains_peering_bit\/top_side/m);
  assert.match(sides,/^2:1\/animation_separation = Vector2i\(3, 0\)$/m);
  assert.match(sides,/^2:1\/animation_frame_1\/duration = 0.25$/m);
  const corners=layoutGodotTres(getLayout('corners16'),16);
  assert.match(corners,/terrain_set_0\/mode = 1/);
  assert.match(corners,/^1:0\/0\/terrains_peering_bit\/top_left_corner = 0$/m);
  assert.doesNotMatch(corners,/^0:0\/0\/terrain_set/m,'empty corner tile carries no terrain');
  const blob=layoutGodotTres(getLayout('blob56'),16);
  assert.match(blob,/terrain_set_0\/mode = 0/);
  assert.equal((blob.match(/\/0 = 0$/gm)||[]).length,56);
  const free=layoutGodotTres(getLayout('free',{cols:2,rows:1}),16);
  assert.doesNotMatch(free,/terrain_set/);
  const j=layoutJson(getLayout('sides16'),16,{anim:{6:[100,250]},frames:2});
  assert.equal(j.tiles.length,16); assert.deepEqual(j.tiles[6].frames_ms,[100,250]); assert.equal(j.frame_blocks,2);
});
