import {test} from 'node:test';
import assert from 'node:assert/strict';
import {GENESIS_COLORS,GENESIS_FAMILIES} from '../js/genesis.js';
import {TERRAIN_TILES, checkSeams, checkColorSeams, edgeIndex, terrainPixels, variantBase, maskToCr31} from '../js/terrain.js';
import {GEN_RECIPES, GEN_RECIPE_ORDER, GEN_STRATA, GEN_PARAMS, GEN_ROLE_KEYS, makeSpec, lerpParams,
  generateTerrain, generateTerrainRoles, generateProps, colorize, previewLayout, renderPreview, heroSprite,
  lintTerrain, hexToRgba} from '../js/tilegen.js';

// bản sao danh sách Master trong palette.js (palette.js cần DOM nên không nạp thẳng được ở đây)
import {readFileSync} from 'node:fs';
const src=readFileSync(new URL('../js/palette.js',import.meta.url),'utf8');
const block=src.slice(src.indexOf('[MASTER_NAME]: ['),src.indexOf('],',src.indexOf('[MASTER_NAME]: [')));
const MASTER=new Set(block.match(/#[0-9a-f]{6}/gi).map(h=>h.toLowerCase()));
const GENESIS=new Set(GENESIS_COLORS);
const SETS={genesis:GENESIS,master:MASTER};

test('every recipe has a Genesis and a Master colour set, each colour (and preview sky) from that palette',()=>{
  assert.equal(GEN_RECIPE_ORDER.length,Object.keys(GEN_RECIPES).length);
  assert.equal(GENESIS.size,91);
  for(const id of GEN_RECIPE_ORDER){
    const r=GEN_RECIPES[id];
    for(const [pal,set] of Object.entries(SETS)){
      const c=r.palettes[pal];
      for(const k of GEN_ROLE_KEYS) assert.ok(set.has(c.colors[k]),id+'.'+pal+'.'+k+' '+c.colors[k]+' không có trong bảng');
      assert.ok(set.has(c.sky),id+'.'+pal+'.sky');
    }
    for(const p of GEN_PARAMS) assert.ok(r.params[p.key]>=0 && r.params[p.key]<=1,id+'.'+p.key);
  }
  for(const s of GEN_STRATA) assert.ok(GEN_RECIPES[s.recipe],s.title);
});

test('generated tiles show their cr31 blob index: land exactly at the yellow edges/corners, centre always land',()=>{
  const W={N:1,NE:2,E:4,SE:8,S:16,SW:32,W:64,NW:128};
  for(const id of GEN_RECIPE_ORDER) for(const n of [16,32]){
    const tiles=generateTerrainRoles(makeSpec(id,{seed:11}),n,'inset');
    for(let slot=0;slot<56;slot++){
      const i=maskToCr31(TERRAIN_TILES[slot].mask), R=tiles[slot], a=(x,y)=>R[y*n+x]!==0, h=n>>1, e=n-1;
      const got={N:a(h,0),NE:a(e,0),E:a(e,h),SE:a(e,e),S:a(h,e),SW:a(0,e),W:a(0,h),NW:a(0,0)};
      for(const k in W) assert.equal(got[k],!!(i&W[k]),`${id} ${n}px slot ${slot} cr31 ${i} ${k}`);
      assert.ok(a(h,h),`${id} ${n}px slot ${slot} tâm`);
    }
  }
});
test('every recipe tiles seamlessly at 16 and 32 px, both edge shapes, with and without a crust, in both palettes',()=>{
  for(const id of GEN_RECIPE_ORDER) for(const n of [16,32]) for(const shape of ['inset','flush']) for(const crustType of [undefined,'none']){
    for(const [seed,palette] of [[7,'genesis'],[1701,'master']]){
      const spec=makeSpec(id,{seed,crustType,palette}), tiles=generateTerrain(spec,n,shape);
      const tag=[id,n,shape,crustType||'crust',seed,palette].join(' ');
      assert.equal(tiles.length,56,tag);
      assert.deepEqual(checkSeams(tiles,n,shape),[],'alpha '+tag);
      assert.deepEqual(checkColorSeams(tiles,n,shape),[],'màu/vân '+tag);
      const L=lintTerrain(tiles,n,shape,[...SETS[palette]]);
      assert.equal(L.floating,0,'pixel lơ lửng '+tag);
      assert.deepEqual(L.offPalette,[],'màu ngoài bảng '+tag);
    }
  }
});

test('the same recipe and seed always give the same tiles; another seed gives other tiles',()=>{
  const a=generateTerrainRoles(makeSpec('warmLedge',{seed:42}),16), b=generateTerrainRoles(makeSpec('warmLedge',{seed:42}),16);
  assert.deepEqual(a,b);
  const c=generateTerrainRoles(makeSpec('warmLedge',{seed:43}),16);
  assert.notDeepEqual(a[46],c[46]);
  // đổi riêng hạt "Mặt trên" thì ruột giữ nguyên, sàn đổi
  const base=makeSpec('warmLedge',{seed:42}), cap=makeSpec('warmLedge',{seed:42,seeds:{cap:99}});
  const x=generateTerrainRoles(base,16), y=generateTerrainRoles(cap,16);
  assert.deepEqual(x[46],y[46]);
  assert.notDeepEqual(x[31],y[31]);
});

test('variants are different art that keeps the base tile’s outer ring',()=>{
  for(const id of GEN_RECIPE_ORDER) for(const n of [16,32]){
    const roles=generateTerrainRoles(makeSpec(id,{seed:1701}),n);
    for(const slot of [47,48,49]){
      assert.notDeepEqual(roles[slot],roles[46],id+' #'+slot+' trùng #46');
      for(const d of ['N','E','S','W']) for(let p=0;p<n;p++)
        assert.equal(roles[slot][edgeIndex(d,p,n)],roles[46][edgeIndex(d,p,n)],id+' #'+slot+' vành '+d+p);
    }
    for(const slot of [50,51,52]) assert.notDeepEqual(roles[slot],roles[31],id+' #'+slot+' trùng #31');
    for(const t of TERRAIN_TILES.slice(47)) for(const d of ['E','W','S']) if(t.mask&{E:2,W:8,S:4}[d])
      for(let p=0;p<n;p++) assert.equal(roles[t.slot][edgeIndex(d,p,n)],roles[variantBase(t.slot)][edgeIndex(d,p,n)],id+' #'+t.slot+' '+d);
  }
});

test('generated art is real pixel art at 32 px, not a 2× blow-up of 16 px',()=>{
  const t=generateTerrainRoles(makeSpec('warmLedge',{seed:3}),32)[46];
  let lone=0;
  for(let y=0;y<32;y+=2) for(let x=0;x<32;x+=2){
    const v=t[y*32+x];
    if(t[y*32+x+1]!==v||t[(y+1)*32+x]!==v||t[(y+1)*32+x+1]!==v) lone++;
  }
  assert.ok(lone>64,'khối 2×2 gần như đồng màu → vẫn là ảnh phóng to');
});

test('props: one tile per recipe entry, ground props sit on the bottom row, hanging ones start at the top',()=>{
  for(const id of GEN_RECIPE_ORDER) for(const n of [16,32]){
    const spec=makeSpec(id,{seed:5}), props=generateProps(spec,n);
    assert.equal(props.length,GEN_RECIPES[id].props.length);
    for(const p of props){
      assert.equal(p.roles.length,n*n);
      assert.ok(p.roles.some(Boolean),id+' '+p.kind+' trống');
      const rows=[...Array(n).keys()].filter(y=>p.roles.slice(y*n,y*n+n).some(Boolean));
      if(p.anchor==='top') assert.ok(rows[0]<=1,id+' '+p.kind+' phải treo từ đỉnh ô');
      else assert.ok(rows[rows.length-1]>=n-2,id+' '+p.kind+' phải chạm đáy ô');
    }
    // màu của trang trí cũng nằm trong bảng
    for(const px of colorize(props.map(p=>p.roles),spec.colors)) for(const v of px)
      if(v>>>24) assert.ok([...GENESIS].some(h=>hexToRgba(h)===v));
  }
});

test('preview maps render every layout, and the hero always has room to stand',()=>{
  const spec=makeSpec('crystalCave',{seed:9}), n=16, tiles=generateTerrain(spec,n);
  const props=generateProps(spec,n).map(p=>({anchor:p.anchor,px:colorize([p.roles],spec.colors)[0]}));
  const hero=heroSprite(56);
  for(const kind of ['stairs','cave','island','strata']){
    const map=previewLayout(kind,7), sets=Array.from({length:kind==='strata'?6:1},()=>({tiles,props,sky:spec.sky}));
    const img=renderPreview(map,sets,{n,heroH:56});
    assert.equal(img.w,map.w*n); assert.equal(img.h,map.h*n);
    const skin=hexToRgba(GENESIS_FAMILIES.skin.ramp[2]);
    let top=-1; for(let i=0;i<img.px.length&&top<0;i++) if(img.px[i]===skin) top=Math.floor(i/img.w);
    assert.ok(top>0,kind+': không thấy nhân vật');
    assert.ok(top>=Math.round(hero.h*.3)-hero.h*.3,kind);   // đầu nhân vật không bị cắt ở mép trên
  }
});

test('stratum interpolation runs evenly from layer 1 to layer 6',()=>{
  const a={...GEN_RECIPES.warmLedge.params,glow:0}, b={...GEN_RECIPES.violetSpirit.params,glow:1};
  assert.equal(lerpParams(a,b,0).glow,0); assert.equal(lerpParams(a,b,1).glow,1);
  assert.equal(lerpParams(a,b,.4).glow,.4);
});

test('the colour/texture seam check now follows edge siblings, not raw neighbour columns',()=>{
  // tấm vân lặp vòng: cột cuối ô A khác cột đầu ô B nhưng vẫn liền → không báo
  const tiles=generateTerrain(makeSpec('mossCobble',{seed:11}),16);
  assert.notDeepEqual([0,1,2,3].map(p=>tiles[46][edgeIndex('E',p,16)]),[0,1,2,3].map(p=>tiles[46][edgeIndex('W',p,16)]));
  assert.deepEqual(checkColorSeams(tiles,16),[]);
  // một ô lệch khỏi các ô cùng dáng cạnh → báo đúng ô, đúng hướng
  const bad=tiles.map(t=>t.slice()); bad[24][edgeIndex('E',7,16)]^=0x00ffffff;
  assert.ok(checkColorSeams(bad,16).some(i=>i.a===24&&i.direction==='E'&&i.positions.includes(7)));
  // mẫu phẳng mặc định vẫn sạch
  assert.deepEqual(checkColorSeams(TERRAIN_TILES.map(t=>terrainPixels(t.slot,16)),16),[]);
});

test('clean stone blocks: staggered courses, joints never on the tile border, first course shared by every variant',()=>{
  for(const n of [16,32]){
    const spec=makeSpec('cleanBlock',{seed:21}), roles=generateTerrainRoles(spec,n,'flush');
    const INK=GEN_ROLE_KEYS.indexOf('ink')+1, R1=GEN_ROLE_KEYS.indexOf('r1')+1;
    const t=roles[46];
    // mặt viên phẳng: phần lớn pixel là một màu đá, viền là màu vữa
    const fill=[...t].filter(v=>v===R1).length;
    assert.ok(fill>n*n*.5,'mặt đá phải phẳng, ít nhiễu');
    // hàng cuối là mạch vữa liền
    for(let x=0;x<n;x++) assert.equal(t[(n-1)*n+x],INK);
    // cột biên là giữa viên đá: không có mạch đứng ở cột 0 / n-1 ngoài các hàng vữa
    const H0=n>=32?n/2:8;
    for(let y=0;y<n;y++){
      if(y%H0===H0-1) continue;                                   // hàng vữa
      assert.notEqual(t[y*n],INK,'mạch đứng ở cột 0, hàng '+y);
      assert.notEqual(t[y*n+n-1],INK,'mạch đứng ở cột '+(n-1)+', hàng '+y);
    }
    // biến thể giữ nguyên hàng gạch đầu (chạm hàng biên trên)
    for(const s of [47,48,49]) for(let i=0;i<H0*n;i++) assert.equal(roles[s][i],t[i],'#'+s+' đổi hàng gạch đầu');
  }
});

test('macro 3×3: every sub-tile keeps the #46 ring, so it joins edge tiles with no seam; sub-tiles differ',async()=>{
  const {generateMacroRoles}=await import('../js/tilegen.js');
  for(const id of GEN_RECIPE_ORDER) for(const n of [16,32]){
    const spec=makeSpec(id,{seed:5}), roles=generateTerrainRoles(spec,n,'inset'), M=generateMacroRoles(spec,n,3), W=3*n;
    assert.equal(M.length,W*W);
    const cells=[];
    for(let c=0;c<9;c++){
      const ox=(c%3)*n, oy=Math.floor(c/3)*n, t=new Uint8Array(n*n);
      for(let y=0;y<n;y++) for(let x=0;x<n;x++) t[y*n+x]=M[(oy+y)*W+ox+x];
      for(const d of ['N','E','S','W']) for(let p=0;p<n;p++)
        assert.equal(t[edgeIndex(d,p,n)],roles[46][edgeIndex(d,p,n)],id+' '+n+' ô con '+c+' vành '+d+p);
      // đặt ô con vào chỗ #46: cả bộ vẫn nối liền
      const tiles=colorize(roles.map((r,s)=>s===46?t:r),spec.colors);
      assert.deepEqual(checkSeams(tiles,n,'inset'),[],id+' '+n+' ô con '+c);
      assert.deepEqual(checkColorSeams(tiles,n,'inset'),[],id+' '+n+' ô con '+c);
      cells.push(t.join());
    }
    assert.ok(new Set(cells).size>=(id==='cleanBlock'&&n===16?5:8),id+' '+n+': ô con trùng nhau quá nhiều');
  }
});
