// Run: node --test tests/terrainio.mjs — phần I/O thuần của Terrain 56.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {slotPixels,legacySheetTo10x7,terrainSheetTo10x7,parseTerrainFile,terrainProjectJson,terrainPackJson,cleanSheet,toolPaletteKey,TERRAIN_CREATE_PRESETS} from '../js/terrainio.js';
import {createTileset,frameAt,fromSheet,sheetPixels} from '../js/tileset.js';
import {legacyTerrainCell,TERRAIN_TILES,ATLAS_COLS,ATLAS_ROWS,tileRoles,terrainSlotCells} from '../js/terrain.js';

const URL='data:image/png;base64,AAAA';
test('slotPixels returns 56 slot frames',()=>{
  const ts=createTileset({layout:'blob56',size:16,colors:{base:'#5e788c',edge:'#b4c5d1',palette:['#5e788c','#b4c5d1']}});
  const px=slotPixels(ts);
  assert.equal(px.length,56);
  assert.equal(px[46],frameAt(ts,46,0));
});
test('legacySheetTo10x7 moves every slot to its cr31 cell',()=>{
  const n=8; for(const layout of [1,2]){
    const w=n*8,h=n*7,data=new Uint32Array(w*h);
    for(const t of TERRAIN_TILES){
      const [c,r]=legacyTerrainCell(t.slot);
      for(let y=0;y<n;y++)for(let x=0;x<n;x++)data[(r*n+y)*w+c*n+x]=t.slot+1;
    }
    const out=legacySheetTo10x7({w,h,data},layout,n);
    assert.equal(out.w,n*ATLAS_COLS); assert.equal(out.h,n*ATLAS_ROWS);
    const ts=fromSheet(out,{layout:'blob56',size:n});
    for(const t of TERRAIN_TILES){
      const want=layout<2&&(t.slot===50||t.slot===51)?32:t.slot+1;
      assert.ok(frameAt(ts,t.slot,0).every(v=>v===want),'slot '+t.slot+' layout '+layout);
    }
    assert.equal(data[0],1,'input untouched');
  }
});
test('project and pack files round-trip',()=>{
  for(const shape of ['inset','flush']){
    const ts=createTileset({layout:'blob56',size:32,shape});
    for(const j of [terrainProjectJson(ts,URL),terrainPackJson(ts,URL)]){
      const r=parseTerrainFile(JSON.parse(JSON.stringify(j)));
      assert.equal(r.size,32); assert.equal(r.shape,shape); assert.equal(r.png,URL);
    }
  }
  assert.throws(()=>parseTerrainFile({}),/không phải dự án Terrain 56/);
  assert.throws(()=>parseTerrainFile(null),/không phải dự án Terrain 56/);
});
test('cleanSheet clears transparent-role border pixels only',()=>{
  const n=16,ts=createTileset({layout:'blob56',size:n}),sheet=sheetPixels(ts);
  sheet.data.fill(0xffabcdef);
  const out=cleanSheet(sheet,n,'inset');
  const t=TERRAIN_TILES[0],roles=tileRoles(t.slot,n,'inset'),[c,r]=terrainSlotCells(t.slot)[0];
  let cleared=0;
  for(let i=0;i<roles.length;i++){
    const x=i%n,y=Math.floor(i/n),v=out.data[(r*n+y)*out.w+c*n+x];
    const edge=x===0||y===0||x===n-1||y===n-1;
    if(!roles[i]&&edge){cleared++;assert.equal(v>>>24,0);assert.equal(v&0xffffff,0xabcdef);}
    else assert.equal(v,0xffabcdef);
  }
  assert.ok(cleared>0);
  assert.equal(sheet.data[0],0xffabcdef,'input untouched');
});
test('cleanSheet honours flush and fails loudly on bad args',()=>{
  const n=16,ts=createTileset({layout:'blob56',size:n}),sheet=sheetPixels(ts);
  sheet.data.fill(0xffabcdef);
  const a=cleanSheet(sheet,n,'inset'),b=cleanSheet(sheet,n,'flush');
  const cleared=o=>o.data.reduce((k,v)=>k+((v>>>24)===0),0);
  assert.notEqual(cleared(a),cleared(b));
  assert.throws(()=>cleanSheet(sheet,n),/shape/);
  assert.throws(()=>cleanSheet(sheet,undefined,'inset'),/khổ ô/);
  assert.throws(()=>cleanSheet(sheet,1.5,'inset'),/khổ ô/);
});
test('toolPaletteKey: Master only for Master',()=>{
  assert.equal(toolPaletteKey('M','M'),'master');
  assert.equal(toolPaletteKey('x','M'),'genesis');
  assert.equal(toolPaletteKey('','M'),'genesis');
  assert.ok(TERRAIN_CREATE_PRESETS.master.stone.base);
});

test('terrainSheetTo10x7 decides by sheet size',()=>{
  const n=16, mk=(c,r)=>({w:c*n,h:r*n,data:new Uint32Array(c*n*r*n).fill(0xff112233)});
  const cur=mk(10,7);
  assert.equal(terrainSheetTo10x7(cur,undefined,n),cur);
  assert.equal(terrainSheetTo10x7(cur,1,n),cur);
  for(const lv of [1,2]){ const o=terrainSheetTo10x7(mk(8,7),lv,n); assert.equal(o.w,10*n); assert.equal(o.h,7*n); }
  assert.throws(()=>terrainSheetTo10x7(mk(9,7),2,n),/lưới/);
  assert.throws(()=>terrainSheetTo10x7(mk(10,6),undefined,n),/lưới/);
});
