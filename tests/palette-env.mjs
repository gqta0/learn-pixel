import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as v4 from '../js/genesis-v4.js';
import * as material from '../js/material-ramp.js';
import * as color from '../js/color.js';
import * as genesis from '../js/genesis.js';
import * as masterpal from '../js/masterpal.js';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
export function paletteApp(){
  const saved=new Map();
  const context=vm.createContext({...genesis,...masterpal,...color,...v4,...material,localStorage:{getItem:k=>saved.get(k)||null,setItem:(k,v)=>saved.set(k,v)},
    doc:{frames:[[new Uint32Array([0xff123456])]]},view:{},$(){return null;},writes:0,
    syncPalSelect(){},queueSave(){context.writes++;}});
  const source=read('js/palette.js').replace(/^import\s[\s\S]*?;\s*$/gm,'')
    .replace(/^export\s*\{[^}]*\}(?:\s*from\s*'[^']+')?;/gm,'').replace(/\bexport\s+/g,'');
  vm.runInContext(source+'\npaintSwatches=()=>{};',context);
  const storage=read('js/storage.js');
  vm.runInContext(storage.slice(storage.indexOf("const DEFAULT_PAL_KEY="),storage.indexOf('export async function loadSave')),context);
  return {context,saved,run:code=>vm.runInContext(code,context)};
}
