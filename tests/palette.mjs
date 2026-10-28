// Run: node --test tests/palette.mjs — kiểm tra các quy tắc của Master Palette ghi trong README.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {GENESIS_NAME, GENESIS_COLORS} from '../js/genesis.js';

const src=readFileSync(new URL('../js/palette.js', import.meta.url),'utf8');
const masterName=src.match(/export const MASTER_NAME = '([^']+)'/)[1];
const master=[...src.split('[MASTER_NAME]: [')[1].split('],')[0].matchAll(/'(#[0-9a-f]{6})'/g)].map(m=>m[1]);
const tokenSrc=src.split('export const PALETTES')[0];
const tokens=Object.fromEntries([...tokenSrc.matchAll(/'(#[0-9a-f]{6})': \{ group: '([^']+)', token: '([^']+)'/g)]
  .map(m=>[m[1],{group:m[2],token:m[3]}]));

const lin=c=>{ c/=255; return c<=0.04045 ? c/12.92 : ((c+0.055)/1.055)**2.4; };
function oklab(hex){
  const [r,g,b]=[1,3,5].map(i=>lin(parseInt(hex.slice(i,i+2),16)));
  const l=Math.cbrt(0.4122214708*r+0.5363325363*g+0.0514459929*b);
  const m=Math.cbrt(0.2119034982*r+0.6806995451*g+0.1073969566*b);
  const s=Math.cbrt(0.0883024619*r+0.2817188376*g+0.6299787005*b);
  return [0.2104542553*l+0.7936177850*m-0.0040720468*s, 1.9779984951*l-2.4285922050*m+0.4505937099*s,
          0.0259040371*l+0.7827717662*m-0.8086757660*s];
}
const dist=(a,b)=>Math.hypot(...oklab(a).map((v,i)=>v-oklab(b)[i]));

test('Master name matches its colour count, every colour is unique and has a token',()=>{
  assert.equal(masterName, `Master Palette (${master.length} màu)`);
  assert.equal(new Set(master).size, master.length);
  for(const c of master) assert.ok(tokens[c], c+' has no token');
  const names=master.map(c=>tokens[c].token);
  assert.equal(new Set(names).size, names.length, 'token names must be unique');
});
test('no two Master colours are closer than ΔE OKLab 0.035',()=>{
  let worst=[1,'',''];
  for(let i=0;i<master.length;i++) for(let j=i+1;j<master.length;j++){
    const d=dist(master[i],master[j]); if(d<worst[0]) worst=[d,master[i],master[j]];
  }
  assert.ok(worst[0]>=0.035, `${worst[1]} and ${worst[2]} are only ${worst[0].toFixed(4)} apart`);
});
test('the Warm stone ramp rises in lightness and shares its ledge colour with Silk',()=>{
  const own=master.filter(c=>tokens[c].group==='Warm stone');
  assert.equal(own.length, 7);
  const ramp=[...own.slice(0,6), '#d8d1c2', own[6]];          // bậc 7 dùng chung mã Silk
  ramp.slice(1).forEach((c,i)=>assert.ok(oklab(c)[0]>oklab(ramp[i])[0], c+' is not lighter than '+ramp[i]));
  assert.equal(ramp[6], '#d8d1c2');
  assert.equal(tokens['#d8d1c2'].group, 'Silk');
});
test('Terrain create presets: the Genesis set uses Genesis colours, the Master set Master colours',()=>{
  const tv=readFileSync(new URL('../js/terrainview.js', import.meta.url),'utf8');
  const block=tv.split('const TERRAIN_CREATE_PRESETS={')[1].split('\n};')[0];
  const part=k=>[...block.split(k+':{')[1].split('\n  }')[0].matchAll(/'(#[0-9a-f]{6})'/g)].map(m=>m[1]);
  const genesis=GENESIS_COLORS;
  assert.ok(part('master').includes('#7c6d6c'), 'warm stone preset present');
  for(const c of part('master')) assert.ok(master.includes(c), c+' is not in the Master palette');
  assert.equal(part('genesis').length,14);
  for(const c of part('genesis')) assert.ok(genesis.includes(c), c+' is not in Genesis v2');
});

const gen=[...src.split('[GENESIS_V1_NAME]: [')[1].split('],')[0].matchAll(/'(#[0-9a-f]{6})'/g)].map(m=>m[1]);
test('Genesis v2 is the default while the original 69-color Genesis v1 remains available',()=>{
  assert.equal(GENESIS_NAME, 'Genesis v2 (122 màu)');
  assert.equal(gen.length, 69);
  assert.equal(new Set(gen).size, 69);
  assert.deepEqual([gen[0],gen[10],gen[55],gen[68]], ['#251c24','#f1edf2','#ffffff','#fcc8da']);
  assert.match(src, /export const DEFAULT_PAL_NAME = GENESIS_NAME;/);
  assert.match(src, /export let palette = PALETTES\[DEFAULT_PAL_NAME\]\.slice\(\);/);
  const grouped=[...src.split('const GENESIS_V1_GROUPS = [')[1].split('];')[0].matchAll(/'([0-9a-f ]{6,})'\]/g)].flatMap(m=>m[1].split(' ').map(h=>'#'+h));
  assert.deepEqual(grouped, gen);
  for(const c of gen) assert.ok(!master.includes(c), c+' trùng mã Master — token Master sẽ đè nhóm Genesis');
});
test('palette files: Lospec .hex, GIMP .gpl and loose #hex text all parse, duplicates dropped',async()=>{
  const {parsePaletteText}=await import('../js/palgroups.js');
  assert.deepEqual(parsePaletteText('251c24\r\n25232F\n\n251c24\n'), ['#251c24','#25232f']);
  assert.deepEqual(parsePaletteText('GIMP Palette\nName: x\nColumns: 4\n#\n 37  28  36\tdark\n255 255 255 white\n'), ['#251c24','#ffffff']);
  assert.deepEqual(parsePaletteText('; comment\nbg = #0d171fff, fg #E6E0D3'), ['#0d171f','#e6e0d3']);
  assert.deepEqual(parsePaletteText(readFileSync(new URL('../palettes/genesis-v1.hex', import.meta.url),'utf8')), gen);
});
