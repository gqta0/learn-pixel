import {test} from 'node:test';
import assert from 'node:assert/strict';
import {BLOB_47_MASKS, TERRAIN_TILES, normalizeMask, tileRoles, terrainPixels,
  neighbors, canConnect, terrainSlot, checkSeams, checkColorSeams, edgeIndex,
  terrainConnectorIndices, terrainManifest, terrainGodotManifest,
  TERRAIN_PRESENTATION_GROUPS, TERRAIN_PRESENTATION_ORDER,
  CORE_SLOTS, composeTile, variantBase} from '../js/terrain.js';

test('256 neighborhoods reduce to exactly 47 unique canonical topologies',()=>{
  assert.equal(BLOB_47_MASKS.length,47);
  assert.deepEqual([...new Set(Array.from({length:256},(_,i)=>normalizeMask(i)))].sort((a,b)=>a-b),BLOB_47_MASKS);
  assert.equal(new Set(BLOB_47_MASKS.map((_,s)=>tileRoles(s,16).join(','))).size,47);
  assert.equal(TERRAIN_TILES.length,56);
  assert.deepEqual(TERRAIN_TILES.slice(52).map(t=>t.mask),[110,155,55,205]);
});

test('artist presentation groups cover every stable slot exactly once',()=>{
  assert.deepEqual(TERRAIN_PRESENTATION_GROUPS[0].layout.flat().map(x=>x.slot),[20,31,26,24,46,42,16,38,34]);
  assert.equal(TERRAIN_PRESENTATION_ORDER.length,56);
  assert.deepEqual([...new Set(TERRAIN_PRESENTATION_ORDER)].sort((a,b)=>a-b),Array.from({length:56},(_,i)=>i));
});
test('all generated compatible edges join without alpha gaps at both sizes',()=>{
  for(const n of [16,32]){
    const pixels=TERRAIN_TILES.map(t=>terrainPixels(t.slot,n));
    assert.deepEqual(checkSeams(pixels,n),[]);
    for(const t of TERRAIN_TILES) for(const d of ['N','E','S','W']){
      for(const b of neighbors(t.slot,d)) assert.ok(canConnect(TERRAIN_TILES[b].mask,t.mask,{N:'S',S:'N',E:'W',W:'E'}[d]));
    }
  }
});
test('custom creation colors recolor the body and edge roles without changing topology',()=>{
  const px=terrainPixels(31,16,{base:'#112233',edge:'#d4e5f6'}),roles=tileRoles(31,16);
  const base=0xff332211,edge=0xfff6e5d4;
  assert.ok(Array.from(px).some((p,i)=>roles[i]===1&&p===base));
  assert.ok(Array.from(px).some((p,i)=>roles[i]===2&&p===edge));
  assert.deepEqual(checkSeams(TERRAIN_TILES.map(t=>terrainPixels(t.slot,16,{base:'#112233',edge:'#d4e5f6'})),16),[]);
});
test('neighbor constraints agree with every 4×3 binary terrain patch',()=>{
  const maskAt=(bits,x)=>{
    const at=(a,b)=>!!(bits&(1<<(b*4+a)));
    return normalizeMask(+at(x,0)+2*at(x+1,1)+4*at(x,2)+8*at(x-1,1)+
      16*at(x+1,0)+32*at(x+1,2)+64*at(x-1,2)+128*at(x-1,0));
  };
  for(let bits=0;bits<4096;bits++){
    if(!(bits&(1<<5))||!(bits&(1<<6))) continue;
    assert.ok(canConnect(maskAt(bits,1),maskAt(bits,2),'E'));
  }
  assert.equal(canConnect(255,0,'E'),false);
});
test('variants are extra art with the exact canonical connector pixels',()=>{
  for(const n of [16,32]) for(const t of TERRAIN_TILES.slice(47)){
    const original=terrainPixels(BLOB_47_MASKS.indexOf(t.mask),n),variant=terrainPixels(t.slot,n);
    assert.notDeepEqual(variant,original);
    for(const d of ['N','E','S','W']) for(let p=0;p<n;p++){
      const i=edgeIndex(d,p,n);assert.equal(variant[i],original[i]);
    }
  }
});
test('resolver uses every variant and supports 47-only sheets',()=>{
  const used=new Set();
  for(let x=0;x<60;x++) for(let y=0;y<20;y++) for(const m of BLOB_47_MASKS){
    const slot=terrainSlot(m,x,y,56);used.add(slot);assert.equal(TERRAIN_TILES[slot].mask,m);
    assert.equal(terrainSlot(m,x,y,47),BLOB_47_MASKS.indexOf(m));
  }
  assert.equal(used.size,56);
  assert.equal(terrainSlot(255,0,0,4),-1);
});
test('seam checker locates an erased connector and accepts interior texture edits',()=>{
  const px=TERRAIN_TILES.map(t=>terrainPixels(t.slot,16));
  px[46][8*16+8]=0;assert.deepEqual(checkSeams(px,16),[]);
  px[46][8*16+15]=0;
  const issues=checkSeams(px,16);
  assert.ok(issues.some(i=>i.a===46&&i.direction==='E'&&i.positions.includes(8)));
});
test('color checker catches same-role border changes while connector lock targets the border',()=>{
  const px=TERRAIN_TILES.map(t=>terrainPixels(t.slot,16));
  assert.deepEqual(checkColorSeams(px,16),[]);
  px[46][edgeIndex('E',8,16)]=0xff0000ff;
  assert.ok(checkColorSeams(px,16).some(i=>i.a===46&&i.direction==='E'&&i.positions.includes(8)));
  assert.ok(terrainConnectorIndices(46,16).includes(edgeIndex('E',8,16)));
});
test('mapping covers 8×7 unique slots and preserves every mask and variant',()=>{
  for(const n of [16,32]){
    const m=terrainManifest(n);assert.equal(m.columns*m.rows,56);
    assert.equal(new Set(m.tiles.map(t=>t.x+','+t.y)).size,56);
    assert.ok(m.tiles.every(t=>t.x+n<=8*n&&t.y+n<=7*n));
    assert.deepEqual(m.tiles.map(t=>t.mask),TERRAIN_TILES.map(t=>t.mask));
  }
  const godot=terrainGodotManifest(16);
  assert.equal(godot.format,'godot4-terrain-set-handoff');
  assert.equal(godot.tiles.length,56);
  assert.deepEqual(godot.tiles[46].atlasCoords,[6,5]);
});
test('layout 2 spends the nine variants where the player looks: 3 centers, 3 floors, ceiling, two walls',()=>{
  assert.deepEqual(TERRAIN_TILES.slice(47).map(t=>t.mask),[255,255,255,110,110,110,155,55,205]);
  assert.deepEqual(TERRAIN_TILES.map(t=>t.slot),Array.from({length:56},(_,i)=>i));
  assert.deepEqual(TERRAIN_TILES.slice(47).map(t=>variantBase(t.slot)),[46,46,46,31,31,31,38,24,42]);
  // ba biến thể sàn phải khác nhau thật, không phải ba bản sao
  assert.equal(new Set([50,51,52].map(s=>tileRoles(s,16).join(''))).size,3);
});
test('variant choice has no visible rhythm along a floor or across the fill',()=>{
  const gaps=new Map();
  for(let y=0;y<200;y++){let last=-1;
    for(let x=0;x<200;x++) if(terrainSlot(155,x,y,56)===53){ if(last>=0) gaps.set(x-last,(gaps.get(x-last)||0)+1); last=x; }
  }
  const total=[...gaps.values()].reduce((a,b)=>a+b,0);
  assert.ok(Math.max(...gaps.values())/total<0.45,'một khoảng cách chiếm quá nửa là đang lặp theo nhịp');
  assert.ok(gaps.size>=6);
  // ruột: bốn lựa chọn chia gần đều, và không dính tính chẵn lẻ của (x+y)
  const count=new Map(),parity=[new Set(),new Set()];
  for(let y=0;y<200;y++) for(let x=0;x<200;x++){
    const s=terrainSlot(255,x,y,56);count.set(s,(count.get(s)||0)+1);parity[(x+y)&1].add(s);
  }
  assert.equal(count.size,4);
  for(const n of count.values()) assert.ok(Math.abs(n/40000-0.25)<0.02);
  assert.equal(parity[0].size,4);assert.equal(parity[1].size,4);
});
test('the 47 blob tiles are exactly reproducible from the 13 core tiles',()=>{
  assert.equal(new Set(CORE_SLOTS).size,13);
  assert.deepEqual(CORE_SLOTS.slice(0,9),[20,31,26,24,46,42,16,38,34]);
  for(const n of [16,32]){
    const px=TERRAIN_TILES.map(t=>terrainPixels(t.slot,n));
    // xoá sạch 34 ô không phải lõi để chắc rằng kết quả chỉ đến từ 13 ô lõi
    const only=px.map((p,s)=>CORE_SLOTS.includes(s)?p:new Uint32Array(n*n));
    for(let s=0;s<47;s++) assert.deepEqual(composeTile(only,s,n),px[s],'slot '+s+' @'+n);
    const all=px.slice();for(let s=0;s<47;s++) all[s]=composeTile(only,s,n);
    assert.deepEqual(checkSeams(all,n),[]);
  }
});
test('godot handoff carries all eight peering bits so no two blob tiles collide',()=>{
  const g=terrainGodotManifest(16);
  assert.equal(g.terrainMode,'MATCH_CORNERS_AND_SIDES');
  assert.equal(new Set(g.tiles.slice(0,47).map(t=>JSON.stringify(t.peeringBits))).size,47);
  assert.deepEqual(Object.keys(g.tiles[0].peeringBits),['N','E','S','W','NE','SE','SW','NW']);
  assert.ok(Object.values(g.tiles[46].peeringBits).every(v=>v===0));
  assert.ok(Object.values(g.tiles[0].peeringBits).every(v=>v===-1));
  // biến thể dùng chung bộ bit với ô gốc
  for(const t of g.tiles.slice(47)) assert.deepEqual(t.peeringBits,g.tiles[variantBase(t.slot)].peeringBits);
});
test('flush shape fills every cell yet keeps all 47 topologies distinct and seamless',()=>{
  for(const n of [16,32]){
    // không còn pixel trong suốt nào, kể cả khối rời
    for(const t of TERRAIN_TILES) assert.ok(tileRoles(t.slot,n,'flush').every(r=>r>0),'slot '+t.slot+' @'+n);
    // vẫn đủ 47 dáng khác nhau — mép và góc giờ là dải màu bên trong ô thay vì phần khoét
    assert.equal(new Set(BLOB_47_MASKS.map((_,s)=>tileRoles(s,n,'flush').join(''))).size,47);
    const px=TERRAIN_TILES.map(t=>terrainPixels(t.slot,n,undefined,'flush'));
    assert.deepEqual(checkSeams(px,n,'flush'),[]);
    assert.deepEqual(checkColorSeams(px,n,'flush'),[]);
    // biến thể vẫn là tranh khác, nhưng điểm nối ở biên y hệt ô gốc
    for(const t of TERRAIN_TILES.slice(47)){
      const base=terrainPixels(variantBase(t.slot),n,undefined,'flush'),v=terrainPixels(t.slot,n,undefined,'flush');
      assert.notDeepEqual(v,base);
      for(const d of ['N','E','S','W']) for(let p=0;p<n;p++) assert.equal(v[edgeIndex(d,p,n)],base[edgeIndex(d,p,n)]);
    }
    // ghép 13 → 47 cũng đúng với dáng này
    const only=px.map((p,s)=>CORE_SLOTS.includes(s)?p:new Uint32Array(n*n));
    for(let s=0;s<47;s++) assert.deepEqual(composeTile(only,s,n),px[s]);
  }
  // dáng thụt mặc định không đổi
  assert.deepEqual(tileRoles(31,16),tileRoles(31,16,'inset'));
  assert.equal(terrainManifest(16,'flush').collision.shape,'full');
  assert.equal(terrainGodotManifest(16).collision.insetPx,2);
});
