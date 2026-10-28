import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as genesis from '../js/genesis.js';
import {paletteApp} from './palette-env.mjs';
import {parsePaletteText, groupColors} from '../js/palgroups.js';
import {makeSpec, GEN_RECIPE_ORDER, GEN_ROLE_KEYS, heroSprite} from '../js/tilegen.js';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const source=parsePaletteText(read('palettes/genesis-v3.hex'));
const V1=source.slice(0,69);      // Genesis v1 cũ = 69 màu đầu của file v3

test('Genesis v3 groups split the source HEX exactly, 4–5 colours each, dark to light',()=>{
  assert.equal(source.length,91);
  assert.deepEqual([...genesis.GENESIS_COLORS].sort(),[...source].sort());
  assert.equal(genesis.GENESIS_NAME,'Genesis v3 (91 màu)');
  for(const [id,f] of Object.entries(genesis.GENESIS_FAMILIES)){
    assert.ok(f.ramp.length>=4 && f.ramp.length<=5,id);
    assert.ok(read('palettes/genesis-v3.md').includes('| '+id+' | '+f.name+' | '+f.ramp.length+' | '+f.ramp.join(' ')+' |'),id);
  }
  const app=paletteApp();
  assert.equal(app.run('DEFAULT_PAL_NAME'),genesis.GENESIS_NAME);
  assert.deepEqual([...app.run('palette')],genesis.GENESIS_COLORS);
  assert.equal(Object.keys(genesis.GENESIS_PALETTES).length,20);
  for(const [name,colors] of Object.entries(genesis.GENESIS_PALETTES))
    assert.deepEqual([...app.run('PALETTES['+JSON.stringify(name)+']')],colors);
  const groups=groupColors(genesis.GENESIS_COLORS,app.run('COLOR_TOKENS'));
  assert.equal(groups.length,20);
  for(const group of groups) assert.ok(group.colors.length>=4 && group.colors.length<=5,group.group);
});

test('old Master / Genesis v1 autosaves adopt v3 once without recoloring; custom and explicit Master stay',()=>{
  for(const old of ['PALETTES[MASTER_NAME]',JSON.stringify(V1)]){
    const app=paletteApp();
    app.run('setPalette('+old+');');
    const pixels=app.run('doc.frames[0][0]');
    app.run('adoptDefaultPalette()');
    assert.deepEqual([...app.run('palette')],genesis.GENESIS_COLORS);
    assert.equal(app.run('doc.frames[0][0]'),pixels);
    assert.equal(pixels[0],0xff123456);
    assert.equal(app.context.writes,1);
  }
  const app=paletteApp();
  app.run('setPalette(["#123456"]); adoptDefaultPalette();');
  assert.deepEqual([...app.run('palette')],['#123456']);
  assert.equal(app.context.writes,0);
  const master=paletteApp();
  master.saved.set('lo-pixel-default-pal','Genesis v1 (69 màu)');
  master.run('setPalette(PALETTES[MASTER_NAME]); adoptDefaultPalette();');
  assert.equal(master.run('paletteNameOf(palette)'),master.run('MASTER_NAME'));
  assert.equal(master.context.writes,0);
});

test('Genesis recipes and hero stay inside v3 and drop stale off-palette saved overrides',()=>{
  const allowed=new Set(genesis.GENESIS_COLORS);
  for(const id of GEN_RECIPE_ORDER){
    const spec=makeSpec(id,{colors:{r0:'#382733',k1:'#63C74D',surprise:'#382733'},sky:'#382733'});
    assert.equal(spec.palette,'genesis');
    assert.equal(spec.colors.ink,genesis.GENESIS_FAMILIES.coal.ramp[0],id);
    assert.equal(spec.colors.k1,'#63c74d');
    assert.ok(allowed.has(spec.sky),id+' sky');
    assert.deepEqual(Object.keys(spec.colors),GEN_ROLE_KEYS);
    for(const hex of Object.values(spec.colors)) assert.ok(allowed.has(hex),id+' '+hex);
  }
  assert.equal(makeSpec('cleanBlock',{palette:'genesis-v3'}).palette,'genesis','old saved key falls back');
  for(const value of heroSprite(56).px){
    if(!(value>>>24)) continue;
    const hex='#'+[value&255,(value>>>8)&255,(value>>>16)&255].map(v=>v.toString(16).padStart(2,'0')).join('');
    assert.ok(allowed.has(hex),'hero '+hex);
  }
});

test('terrain tools use Master only for Master; every other palette uses Genesis v3',()=>{
  const app=paletteApp(),src=read('js/terrainview.js');
  vm.runInContext(src.slice(src.indexOf('export function toolPaletteKey()'),src.indexOf('const TERRAIN_CREATE_PRESETS=')).replace(/^export /gm,''),app.context);
  for(const [name,key] of [[genesis.GENESIS_NAME,'genesis'],['Genesis v3 · Lá (4 màu)','genesis'],['Master Palette (92 màu)','master']]){
    app.context.appPalette=app.run('PALETTES['+JSON.stringify(name)+']');
    assert.equal(app.run('toolPaletteKey()'),key,name);
  }
  app.context.appPalette=['#123456'];
  assert.equal(app.run('toolPaletteKey()'),'genesis');
});

test('reopening the quick generator removes stale colors even when its palette key is unchanged',()=>{
  const src=read('js/tilegenview.js');
  const start=src.indexOf('function syncPalette(){'),end=src.indexOf('export function openQuick()',start);
  const st={palette:'genesis',strata:[{colors:{r0:'#382733',k1:'#63C74D'}}]};
  let saves=0;
  const context=vm.createContext({st,toolPaletteKey:()=> 'genesis',palName:()=> 'v3',
    PALETTES:{v3:genesis.GENESIS_COLORS},save(){saves++;}});
  vm.runInContext(src.slice(start,end),context);
  assert.equal(vm.runInContext('syncPalette()',context),true);
  assert.deepEqual(st.strata[0].colors,{k1:'#63C74D'});
  assert.equal(saves,1);
  assert.equal(vm.runInContext('syncPalette()',context),false);
});

test('copying a legacy localStorage save to IndexedDB does not overwrite its adopted v3 palette',async()=>{
  const app=paletteApp(),c=app.context;
  app.saved.set('test-save',JSON.stringify({palette:V1}));
  let persisted;
  Object.assign(c,{useIdb:true,bootDone:false,SAVE_KEY:'test-save',STORES:{kv:'kv'},
    $:()=>({textContent:''}),idbGet:async()=>null,
    idbSet:async(_store,_key,data)=>{persisted=data.palette;},
    applyData:data=>app.run('setPalette('+JSON.stringify(data.palette)+')'),
    writeSave:()=>{persisted=[...app.run('palette')];}});
  c.localStorage.removeItem=key=>app.saved.delete(key);
  const src=read('js/storage.js');
  vm.runInContext(src.slice(src.indexOf('export async function loadSave()'),src.indexOf('export async function clearSave()')).replace(/^export /gm,''),c);
  assert.equal(await vm.runInContext('loadSave()',c),true);
  assert.deepEqual(persisted,genesis.GENESIS_COLORS);
});
