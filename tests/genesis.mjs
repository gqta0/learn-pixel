import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as genesis from '../js/genesis.js';
import {GENESIS_V3_NAME,GENESIS_V3_COLORS} from '../js/genesis-v3.js';
import {paletteApp} from './palette-env.mjs';
import {parsePaletteText, groupColors} from '../js/palgroups.js';
import {makeSpec, GEN_RECIPE_ORDER, GEN_ROLE_KEYS, heroSprite} from '../js/tilegen.js';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const draft=JSON.parse(read('palettes/genesis-v2.json'));
const lower=object=>Object.fromEntries(Object.entries(object).map(([key,hex])=>[key,hex.toLowerCase()]));

test('Genesis v2 keeps every approved Draft 2.0 HEX and registers 25 separate five-color palettes',()=>{
  assert.deepEqual(genesis.GENESIS_COMMON,lower(draft.common));
  assert.equal(Object.keys(genesis.GENESIS_FAMILIES).length,24);
  for(const [id,family] of Object.entries(draft.families)){
    assert.equal(genesis.GENESIS_FAMILIES[id].base,family.base.toLowerCase());
    assert.deepEqual(genesis.GENESIS_FAMILIES[id].ramp,family.ramp.map(h=>h.toLowerCase()));
  }
  const expected=[...new Set([...Object.values(draft.common),...Object.values(draft.families).flatMap(f=>f.ramp)].map(h=>h.toLowerCase()))];
  assert.deepEqual(genesis.GENESIS_COLORS,expected);
  assert.equal(expected.length,122);
  assert.equal(Object.keys(genesis.GENESIS_PALETTES).length,25);
  const app=paletteApp();
  assert.equal(app.run('DEFAULT_PAL_NAME'),GENESIS_V3_NAME);
  assert.deepEqual([...app.run('palette')],GENESIS_V3_COLORS);
  for(const [name,colors] of Object.entries(genesis.GENESIS_PALETTES)){
    assert.equal(colors.length,5,name);
    assert.deepEqual([...app.run('PALETTES['+JSON.stringify(name)+']')],colors);
  }
  assert.deepEqual([...app.run('PALETTES[GENESIS_V1_NAME]')],parsePaletteText(read('palettes/genesis-v1.hex')));
});

test('Genesis groups and HEX exports retain shared Common colors without duplicate swatches',()=>{
  assert.deepEqual(parsePaletteText(read('palettes/genesis-v2.hex')),genesis.GENESIS_COLORS);
  for(const [id,family] of Object.entries(genesis.GENESIS_FAMILIES))
    assert.deepEqual(parsePaletteText(read('palettes/genesis-v2/'+id+'.hex')),family.ramp);
  assert.deepEqual(parsePaletteText(read('palettes/genesis-v2/common.hex')),Object.values(genesis.GENESIS_COMMON));
  const app=paletteApp(), groups=groupColors(genesis.GENESIS_COLORS,app.run('COLOR_TOKENS'));
  assert.equal(groups.length,25);
  assert.equal(groups[0].colors.length,5);
  for(const group of groups) assert.ok(group.colors.length>=4 && group.colors.length<=5,group.group);
  assert.equal(new Set(groups.flatMap(g=>g.colors)).size,122);
});

test('old default autosaves adopt v3 once without recoloring pixels; custom palettes stay intact',()=>{
  for(const original of ['GENESIS_V1_NAME','MASTER_NAME']){
    const app=paletteApp();
    app.run('setPalette(PALETTES['+original+']);');
    const pixels=app.run('doc.frames[0][0]');
    app.run('adoptDefaultPalette()');
    assert.deepEqual([...app.run('palette')],GENESIS_V3_COLORS);
    assert.equal(app.run('doc.frames[0][0]'),pixels);
    assert.equal(pixels[0],0xff123456);
    assert.equal(app.context.writes,1);
    app.run('setPalette(PALETTES[GENESIS_V1_NAME]); adoptDefaultPalette();');
    assert.equal(app.run('paletteNameOf(palette)'),app.run('GENESIS_V1_NAME'));
  }
  const app=paletteApp();
  app.run('setPalette(["#123456"]); adoptDefaultPalette();');
  assert.deepEqual([...app.run('palette')],['#123456']);
  assert.equal(app.context.writes,0);
  const master=paletteApp();
  master.saved.set('lo-pixel-default-pal',master.run('GENESIS_V1_NAME'));
  master.run('setPalette(PALETTES[MASTER_NAME]); adoptDefaultPalette();');
  assert.equal(master.run('paletteNameOf(palette)'),master.run('MASTER_NAME'));
  assert.equal(master.context.writes,0);
});

test('all Genesis recipes use the shared outline and reject stale off-palette saved overrides',()=>{
  const allowed=new Set(genesis.GENESIS_COLORS);
  for(const id of GEN_RECIPE_ORDER){
    const spec=makeSpec(id,{palette:'genesis',colors:{r0:'#251c24',k1:'#63C74D',surprise:'#251c24'},sky:'#251c24'});
    assert.equal(spec.colors.ink,genesis.GENESIS_COMMON.outline,id);
    assert.equal(spec.colors.k1,'#63c74d');
    assert.ok(allowed.has(spec.sky),id+' sky');
    assert.deepEqual(Object.keys(spec.colors),GEN_ROLE_KEYS);
    for(const hex of Object.values(spec.colors)) assert.ok(allowed.has(hex),id+' '+hex);
  }
  const hero=heroSprite(56,'genesis');
  for(const value of hero.px){
    if(!(value>>>24)) continue;
    const hex='#'+[value&255,(value>>>8)&255,(value>>>16)&255].map(v=>v.toString(16).padStart(2,'0')).join('');
    assert.ok(allowed.has(hex),'hero '+hex);
  }
});

test('reopening the quick generator removes stale colors even when its palette key is unchanged',()=>{
  const source=read('js/tilegenview.js');
  const start=source.indexOf('function syncPalette(){'),end=source.indexOf('export function openQuick()',start);
  const st={palette:'genesis',strata:[{colors:{r0:'#251c24',k1:'#63C74D'}}]};
  let saves=0;
  const context=vm.createContext({st,toolPaletteKey:()=> 'genesis',palName:()=> 'v2',
    PALETTES:{v2:genesis.GENESIS_COLORS},save(){saves++;}});
  vm.runInContext(source.slice(start,end),context);
  assert.equal(vm.runInContext('syncPalette()',context),true);
  assert.deepEqual(st.strata[0].colors,{k1:'#63C74D'});
  assert.equal(saves,1);
  assert.equal(vm.runInContext('syncPalette()',context),false);
});

test('copying a legacy localStorage save to IndexedDB does not overwrite its adopted v3 palette',async()=>{
  const app=paletteApp(),c=app.context;
  const legacy={palette:[...app.run('PALETTES[GENESIS_V1_NAME]')]};
  app.saved.set('test-save',JSON.stringify(legacy));
  let persisted;
  Object.assign(c,{useIdb:true,bootDone:false,SAVE_KEY:'test-save',STORES:{kv:'kv'},
    $:()=>({textContent:''}),idbGet:async()=>null,
    idbSet:async(_store,_key,data)=>{persisted=data.palette;},
    applyData:data=>app.run('setPalette('+JSON.stringify(data.palette)+')'),
    writeSave:()=>{persisted=[...app.run('palette')];}});
  c.localStorage.removeItem=key=>app.saved.delete(key);
  const source=read('js/storage.js');
  vm.runInContext(source.slice(source.indexOf('export async function loadSave()'),source.indexOf('export async function clearSave()')).replace(/^export /gm,''),c);
  assert.equal(await vm.runInContext('loadSave()',c),true);
  assert.deepEqual(persisted,GENESIS_V3_COLORS);
});
