import {test} from 'node:test';
import assert from 'node:assert/strict';
import {BLOB_47_MASKS, TERRAIN_TILES, normalizeMask, tileRoles, terrainPixels,
  neighbors, canConnect, terrainSlot, checkSeams, checkColorSeams, edgeIndex,
  terrainConnectorIndices, terrainManifest, terrainGodotManifest,
  TERRAIN_PRESENTATION_GROUPS, TERRAIN_PRESENTATION_ORDER} from '../js/terrain.js';

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
test('resolver uses all six centers, all four edge variants, and supports 47-only sheets',()=>{
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
