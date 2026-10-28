import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import * as v3 from '../js/genesis-v3.js';
import * as v2 from '../js/genesis.js';
import {paletteApp} from './palette-env.mjs';
import {parsePaletteText,groupColors} from '../js/palgroups.js';
import {makeSpec,GEN_RECIPE_ORDER,generateTerrain,heroSprite,hexToRgba} from '../js/tilegen.js';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const draft=JSON.parse(read('palettes/genesis-v3.json'));

test('v3 registers every supplied Warm Vibrant HEX and becomes default without replacing v2',()=>{
  const expected=[...new Set([...Object.values(draft.common),...Object.values(draft.families).flatMap(f=>f.ramp)].map(h=>h.toLowerCase()))];
  assert.deepEqual(v3.GENESIS_V3_COLORS,expected);
  assert.deepEqual(v3.GENESIS_V3_COMMON,Object.fromEntries(Object.entries(draft.common).map(([key,h])=>[key,h.toLowerCase()])));
  assert.equal(expected.length,121);
  assert.equal(Object.keys(v3.GENESIS_V3_PALETTES).length,25);
  const app=paletteApp();
  assert.equal(app.run('DEFAULT_PAL_NAME'),v3.GENESIS_V3_NAME);
  assert.deepEqual([...app.run('palette')],expected);
  assert.deepEqual([...app.run('PALETTES[GENESIS_NAME]')],v2.GENESIS_COLORS);
  for(const [name,colors] of Object.entries(v3.GENESIS_V3_PALETTES)){
    assert.equal(colors.length,5,name);
    assert.deepEqual([...app.run('PALETTES['+JSON.stringify(name)+']')],colors);
  }
  for(const [id,f] of Object.entries(draft.families)){
    assert.equal(v3.GENESIS_V3_FAMILIES[id].base,f.base.toLowerCase());
    assert.deepEqual(v3.GENESIS_V3_FAMILIES[id].ramp,f.ramp.map(h=>h.toLowerCase()));
  }
});

test('v2 and Master terrain and hero pixels remain identical to commit 21ad8d1',()=>{
  const expected={genesis:'c331db165b0953576ce798a6ef3ec954e899a453837ad101e1e00f8362955e3d',master:'b634180ef575db53fe3649620cb6edf56ce535ea5d25f06e7af9797a05ab7ae4'};
  for(const [palette,digest] of Object.entries(expected)){
    const hash=createHash('sha256');
    for(const id of GEN_RECIPE_ORDER)for(const n of [16,32])for(const px of generateTerrain(makeSpec(id,{palette,seed:1701}),n))
      hash.update(Buffer.from(px.buffer,px.byteOffset,px.byteLength));
    const hero=heroSprite(56,palette).px;
    hash.update(Buffer.from(hero.buffer,hero.byteOffset,hero.byteLength));
    assert.equal(hash.digest('hex'),digest,palette);
  }
});

test('v3 HEX exports and documentation match the source and Common swatches are not duplicated',()=>{
  assert.deepEqual(parsePaletteText(read('palettes/genesis-v3.hex')),v3.GENESIS_V3_COLORS);
  assert.deepEqual(parsePaletteText(read('palettes/genesis-v3/common.hex')),Object.values(v3.GENESIS_V3_COMMON));
  const markdown=read('palettes/genesis-v3.md');
  for(const [id,f] of Object.entries(draft.families)){
    assert.deepEqual(parsePaletteText(read('palettes/genesis-v3/'+id+'.hex')),f.ramp.map(h=>h.toLowerCase()));
    assert.ok(markdown.includes('| '+id+' | '+f.ramp.join(' | ')+' |'),id);
  }
  const app=paletteApp(),groups=groupColors(v3.GENESIS_V3_COLORS,app.run('COLOR_TOKENS'));
  assert.equal(groups.length,25);
  assert.equal(groups[0].colors.length,5);
  assert.equal(new Set(groups.flatMap(g=>g.colors)).size,121);
});

test('terrain uses v3 by default and switches back to fixed v2 when that version is selected',()=>{
  assert.equal(makeSpec('cleanBlock').palette,'genesis-v3');
  for(const [palette,colors,common] of [['genesis',v2.GENESIS_COLORS,v2.GENESIS_COMMON],['genesis-v3',v3.GENESIS_V3_COLORS,v3.GENESIS_V3_COMMON]]){
    const allowed=new Set(colors);
    for(const id of GEN_RECIPE_ORDER){
      const spec=makeSpec(id,{palette});
      assert.equal(spec.colors.ink,common.outline,id);
      assert.ok(allowed.has(spec.sky));
      for(const hex of Object.values(spec.colors))assert.ok(allowed.has(hex),id+' '+hex);
    }
    const allowedPixels=new Set(colors.map(hexToRgba));
    for(const pixel of heroSprite(56,palette).px)if(pixel>>>24)assert.ok(allowedPixels.has(pixel));
  }
  const app=paletteApp(),source=read('js/terrainview.js');
  vm.runInContext(source.slice(source.indexOf('export function toolPaletteKey()'),source.indexOf('const TERRAIN_CREATE_PRESETS=')).replace(/^export /gm,''),app.context);
  for(const [name,key] of [[v2.GENESIS_NAME,'genesis'],['Genesis v2 · Lá non (5 màu)','genesis'],[v3.GENESIS_V3_NAME,'genesis-v3'],['Genesis v3 · Lá non (5 màu)','genesis-v3'],['Master Palette (92 màu)','master']]){
    app.context.appPalette=app.run('PALETTES['+JSON.stringify(name)+']');
    assert.equal(app.run('toolPaletteKey()'),key,name);
  }
  app.run('userPals["Genesis v2 · My custom palette"]=["#123456"];');
  app.context.appPalette=['#123456'];
  assert.equal(app.run('toolPaletteKey()'),'genesis-v3','custom names must not choose a generator version');
});

test('default adoption upgrades untouched v2 while preserving explicit legacy choices and pixels',()=>{
  const app=paletteApp();
  app.saved.set('lo-pixel-default-pal',v2.GENESIS_NAME);
  app.run('setPalette(PALETTES[GENESIS_NAME]); adoptDefaultPalette();');
  assert.deepEqual([...app.run('palette')],v3.GENESIS_V3_COLORS);
  assert.equal(app.run('doc.frames[0][0][0]'),0xff123456);
  for(const original of ['GENESIS_V1_NAME','GENESIS_NAME','MASTER_NAME']){
    const explicit=paletteApp();
    explicit.saved.set('lo-pixel-default-pal',v2.GENESIS_NAME);
    explicit.run('setPalette(PALETTES['+original+']);');
    if(original==='GENESIS_NAME')explicit.saved.set('lo-pixel-default-pal',v3.GENESIS_V3_NAME);
    explicit.run('adoptDefaultPalette();');
    assert.equal(explicit.run('paletteNameOf(palette)'),explicit.run(original),original);
    assert.equal(explicit.context.writes,0);
  }
});
