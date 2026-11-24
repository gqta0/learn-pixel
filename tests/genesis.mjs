import { V4_NAME, V4_COLORS, V4_RAMPS } from '../js/genesis-v4.js';
import { buildMaterialRamp, materialRampDefault } from '../js/material-ramp.js';
import { rampHueProfile, buildRamp, hexToInt, rgbToHsl } from '../js/color.js';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as genesis from '../js/genesis.js';
import {toolPaletteKey} from '../js/terrainio.js';
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
  assert.equal(app.run('DEFAULT_PAL_NAME'),V4_NAME);
  assert.deepEqual([...app.run('palette')],V4_COLORS);
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
  const app=paletteApp(), MASTER=app.run('MASTER_NAME');
  app.context.toolPaletteKey=()=>toolPaletteKey(app.run('paletteNameOf(appPalette)'),MASTER);
  for(const [name,key] of [[genesis.GENESIS_NAME,'genesis'],['Genesis v3 · Lá (4 màu)','genesis'],['Master Palette (92 màu)','master']]){
    app.context.appPalette=app.run('PALETTES['+JSON.stringify(name)+']');
    assert.equal(app.run('toolPaletteKey()'),key,name);
  }
  app.context.appPalette=['#123456'];
  assert.equal(app.run('toolPaletteKey()'),'genesis');
});

// Trang Tile (tilequick.js): bảng theo bộ đang mở (host.paletteKey).
test('Tile page quick generator removes stale colors even when its palette key is unchanged',()=>{
  const src=read('js/tilequick.js').replace(/\r\n/g,'\n');
  const start=src.indexOf('function syncPalette(){'),end=src.indexOf('\n}\n',start)+3;
  assert.ok(start>0 && end>start);
  const st={palette:'genesis',strata:[{colors:{r0:'#382733',k1:'#63C74D'}}]};
  let saves=0, key='genesis';
  const context=vm.createContext({st,paletteKey:()=>key,palName:()=>st.palette==='master'?'m':'v3',
    PALETTES:{v3:genesis.GENESIS_COLORS,m:['#63c74d']},save(){saves++;}});
  vm.runInContext(src.slice(start,end),context);
  assert.equal(vm.runInContext('syncPalette()',context),true);
  assert.deepEqual(st.strata[0].colors,{k1:'#63C74D'});
  assert.equal(saves,1);
  assert.equal(vm.runInContext('syncPalette()',context),false);
  key='master';
  assert.equal(vm.runInContext('syncPalette()',context),true);
  assert.equal(st.palette,'master');
  assert.deepEqual(st.strata[0].colors,{k1:'#63C74D'});
});

test('copying a legacy localStorage save preserves the source and adopts v3 in the drawing draft',async()=>{
  const app=paletteApp(),c=app.context;
  app.saved.set('test-save',JSON.stringify({palette:V1}));
  let persisted;
  Object.assign(c,{useIdb:true,bootDone:false,saveFailed:false,SAVE_KEY:'test-save',draftKey:'test-save-draw',workspace:'draw',
    drawingWorkspace:()=> 'draw',STORES:{kv:'kv'},saveStatus(){},adoptCurrent(){},idbGet:async()=>null,
    applyData:data=>app.run('setPalette('+JSON.stringify(data.palette)+')'),
    queueSave:async()=>{persisted=[...app.run('palette')]; return true;}});
  c.localStorage.removeItem=key=>app.saved.delete(key);
  const src=read('js/storage.js');
  vm.runInContext(src.slice(src.indexOf('async function readDraft('),src.indexOf('export async function clearSave()')).replace(/^export /gm,''),c);
  assert.equal(await vm.runInContext('loadSave()',c),true);
  assert.deepEqual(persisted,genesis.GENESIS_COLORS);
  assert.deepEqual(JSON.parse(app.saved.get('test-save')).palette,V1);
});

test('green presets retain the hue steps between adjacent Genesis colors',()=>{
  const expected={olive:3.7,leaf:38.7,jade:10.4,sage:24.9};
  for(const [key,percent] of Object.entries(expected)){
    const colors=genesis.GENESIS_FAMILIES[key].ramp, profile=rampHueProfile(colors);
    assert.equal(profile.percent,percent,key);
    const ramp=buildRamp(profile.base,colors.length,percent*0.6,'Lá / cỏ',profile);
    const hues=ramp.map(hex=>{
      const rgb=hexToInt(hex);
      return rgbToHsl(rgb&255,(rgb>>8)&255,(rgb>>16)&255)[0];
    });
    for(const [i,delta] of profile.deltas.entries()){
      assert.ok(Math.abs(hues[i+1]-hues[i]-delta)<3,key+' bậc '+(i+1));
    }
  }
});

test('Genesis v4 matches the 218-color board and preserves the center HEX for each material ramp',()=>{
  assert.equal(V4_RAMPS.length,41);
  assert.equal(V4_COLORS.length,218);
  assert.deepEqual(parsePaletteText(read('palettes/genesis-v4.hex')),V4_COLORS);
  for(const {colors} of V4_RAMPS){
    for(const material of ['Gỗ','Đá','Kim loại','Gốm / đất nung','Da người','Lửa / năng lượng']){
      const ramp=buildMaterialRamp(colors[2],5,materialRampDefault(material),material);
      assert.equal(ramp[2],colors[2]);
      assert.equal(new Set(ramp).size,5);
    }
  }
});
