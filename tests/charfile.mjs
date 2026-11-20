// Run: node --test tests/charfile.mjs — file .json nhân vật của Ghép rối (sheet Đầu + sheet Thân).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CHARACTER_SCHEMA, characterJson, parseCharacter} from '../js/charfile.js';

// một bản vẽ dạng thư viện (serialize, version 2: mỗi lớp nén RLE [màu, số lần, …])
const sheet=(kind,w,h,{color=0xff3355aa,name='Sheet '+kind}={})=>({
  app:'lo-pixel', version:2, name, w, h, af:0, al:0,
  layers:[{name:'Miếng',vis:true}], palette:['#aa5533'],
  frames:[[[color,3,0,w*h-3]]], dur:[], puppet:kind
});
const head=()=>({name:'Đầu Lý', data:sheet('head',8,6)});
const body=()=>({name:'Thân áo xanh', data:sheet('body',6,9)});

test('a character file carries both sheets and reads back unchanged',()=>{
  const file=characterJson({name:'Lý Tiểu Long',head:head(),body:body()});
  assert.equal(file.schema,CHARACTER_SCHEMA);
  const back=parseCharacter(JSON.parse(JSON.stringify(file)));
  assert.equal(back.name,'Lý Tiểu Long');
  assert.deepEqual(back.head,head());
  assert.deepEqual(back.body,body());
});

test('one sheet is enough; none is refused',()=>{
  const onlyBody=parseCharacter(characterJson({name:'Áo',head:null,body:body()}));
  assert.equal(onlyBody.head,null);
  assert.equal(onlyBody.body.name,'Thân áo xanh');
  assert.throws(()=>characterJson({name:'Rỗng',head:null,body:null}),/ít nhất một sheet/);
  assert.throws(()=>parseCharacter({schema:CHARACTER_SCHEMA,name:'x',head:null,body:null}),/ít nhất một sheet/);
});

test('writing does not alias the library data',()=>{
  const h=head(), file=characterJson({name:'A',head:h,body:null});
  file.head.data.frames[0][0][1]=99;
  assert.equal(h.data.frames[0][0][1],3);
});

test('the name falls back to the sheet names, then to a default',()=>{
  assert.equal(parseCharacter({...characterJson({name:'A',head:head(),body:body()}),name:''}).name,'Đầu Lý + Thân áo xanh');
  assert.equal(parseCharacter({...characterJson({name:'A',head:null,body:body()}),name:'  '}).name,'Thân áo xanh');
  const noNames=characterJson({name:'',head:{name:'',data:sheet('head',8,6)},body:null});
  assert.equal(parseCharacter(noNames).name,'Nhân vật');
});

test('other files and broken sheets are refused with a reason',()=>{
  assert.throws(()=>parseCharacter(null),/không phải file nhân vật/);
  assert.throws(()=>parseCharacter({app:'lo-pixel',version:2,w:8,h:6}),/không phải file nhân vật/);   // một bản vẽ thường
  const swap=characterJson({name:'A',head:head(),body:body()});
  swap.head.data.puppet='body';
  assert.throws(()=>parseCharacter(swap),/Đầu.*không phải sheet Đầu/);
  const big=characterJson({name:'A',head:head(),body:null}); big.head.data.w=5000;
  assert.throws(()=>parseCharacter(big),/Đầu.*khổ/);
  const short=characterJson({name:'A',head:null,body:body()}); short.body.data.frames[0][0]=[0xff000000,5];
  assert.throws(()=>parseCharacter(short),/Thân.*pixel/);
  const layers=characterJson({name:'A',head:null,body:body()}); layers.body.data.frames[0].push([0,54]);
  assert.throws(()=>parseCharacter(layers),/Thân.*lớp/);
  const pal=characterJson({name:'A',head:head(),body:null}); pal.head.data.palette=['red'];
  assert.throws(()=>parseCharacter(pal),/Đầu.*bảng màu/);
});

test('an uncompressed (version 1) sheet is accepted when its pixel count is right',()=>{
  const v1={...sheet('head',2,2),version:1,frames:[[[0,0,0xff112233,0]]]};
  assert.equal(parseCharacter(characterJson({name:'A',head:{name:'v1',data:v1},body:null})).head.data.version,1);
  const bad={...v1,frames:[[[0,0,0]]]};
  assert.throws(()=>parseCharacter(characterJson({name:'A',head:{name:'v1',data:bad},body:null})),/Đầu.*pixel/);
});
