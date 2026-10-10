// Run: node --test tests/editor.cjs (no dependencies).
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {join} = require('node:path');
const vm = require('node:vm');

function editor(){
  const element=()=>({
    listeners:{}, style:{}, width:32, height:32, scrollLeft:0, scrollTop:0,
    addEventListener(type,fn){ (this.listeners[type]??=[]).push(fn); },
    classList:{add(){},remove(){}}, focus(){}, setPointerCapture(){},
    contains(el){ return el===this; }, matches(){ return false; },
    getBoundingClientRect(){ return {left:0,top:0,width:32,height:32}; },
    getContext(){ return {createImageData(w,h){return {data:new Uint8ClampedArray(w*h*4)};},putImageData(){}}; }
  });
  const nodes=new Map(), board=element(), win=element(), dom=element();
  const $=id=>{if(!nodes.has(id)) nodes.set(id,element()); return nodes.get(id);};
  const doc={w:32,h:32,af:0,al:0,layers:[{name:'Test',vis:true}],frames:[[new Uint32Array(1024)]],dur:[0]};
  const view={tool:'pencil',fingerMode:'draw',brush:1,brushEff:1,pri:0xff112233,sec:0xff445566,sel:null,zoom:1,terrainLock:true};
  let marks=0;
  dom.createElement=element; dom.querySelector=()=>null;
  const context=vm.createContext({doc,view,board,$,document:dom,window:win,Uint32Array,
    activeData:()=>doc.frames[doc.af][doc.al],blank:()=>new Uint32Array(doc.w*doc.h),
    terrainConnectorIndices:()=>[2],tileRoles:()=>new Uint8Array(doc.w*doc.h),ROLE_NAMES:[],
    rgba:(r,g,b,a)=>(r|(g<<8)|(b<<16)|(a<<24))>>>0,
    render(){},syncAll(){},paintThumbs(){},paintSwatches(){},syncColors(){},syncFingerBtn(){},
    markToday(){marks++;},shadeStep:v=>v,setZoom:z=>{view.zoom=z;}
  });
  for(const file of ['history','raster','input']){
    const source=readFileSync(join(__dirname,'../js',file+'.js'),'utf8')
      .replace(/^import\s[\s\S]*?;\s*$/gm,'')
      .replace(/^export\s*\{[^}]*\};/gm,'').replace(/\bexport\s+/g,'');
    vm.runInContext(source,context,{filename:file+'.js'});
  }
  const run=source=>vm.runInContext(source,context);
  function event(type,id,x=2,y=2,pointerType='mouse',extra={}){
    const e={pointerId:id,pointerType,clientX:x+.5,clientY:y+.5,button:0,buttons:type==='pointerup'?0:1,
      target:board,preventDefault(){},stopImmediatePropagation(){},...extra};
    for(const fn of $('#wrap').listeners[type]||[]) fn(e);
  }
  const stroke=(x=2,y=2)=>{event('pointerdown',1,x,y);event('pointerup',1,x,y);};
  return {doc,view,run,event,stroke,wrap:$('#wrap'),dom,win,marks:()=>marks,pixel:(x,y)=>doc.frames[0][0][y*32+x]};
}

test('one stroke commits once; undo and redo restore pixels',()=>{
  const e=editor();e.event('pointerdown',1);e.event('pointermove',1,7,2);e.event('pointerup',1,7,2);
  assert.equal(e.marks(),1);assert.notEqual(e.pixel(7,2),0);
  e.run('undo()');assert.equal(e.pixel(2,2),0);assert.equal(e.pixel(7,2),0);
  e.run('redo()');assert.notEqual(e.pixel(7,2),0);
});
test('pinch during selection never undoes the previous stroke',()=>{
  const e=editor();e.stroke();e.view.tool='select';
  e.event('pointerdown',2,4,4,'touch');e.event('pointermove',2,6,6,'touch');
  e.event('pointerdown',3,10,10,'touch');e.event('pointerup',2,6,6,'touch');e.event('pointerup',3,10,10,'touch');
  assert.notEqual(e.pixel(2,2),0);assert.equal(e.view.sel,null);
  e.run('undo()');assert.equal(e.pixel(2,2),0);
});
test('palm up/move cannot finish a pen stroke',()=>{
  const e=editor();e.event('pointerdown',1,2,2,'pen');
  e.event('pointerdown',2,8,8,'touch');e.event('pointermove',2,9,9,'touch');e.event('pointerup',2,9,9,'touch');
  assert.equal(e.view.drawing,true);assert.equal(e.marks(),0);
  e.event('pointermove',1,7,2,'pen');e.event('pointerup',1,7,2,'pen');
  assert.notEqual(e.pixel(7,2),0);assert.equal(e.pixel(9,9),0);assert.equal(e.marks(),1);
});
test('cancel restores pixels and preserves the redo branch',()=>{
  const e=editor();e.stroke();e.run('undo()');
  e.event('pointerdown',1,7,7);e.event('pointercancel',1,7,7);
  assert.equal(e.pixel(7,7),0);e.run('redo()');assert.notEqual(e.pixel(2,2),0);
});
test('second finger rolls back fill without adding history',()=>{
  const e=editor();e.stroke();e.view.tool='fill';
  e.event('pointerdown',2,8,8,'touch');assert.notEqual(e.pixel(8,8),0);
  e.event('pointerdown',3,12,12,'touch');assert.equal(e.pixel(8,8),0);
  assert.equal(e.marks(),1);e.run('undo()');assert.equal(e.pixel(2,2),0);
});
test('painting the same pixel is not an extra undo step',()=>{
  const e=editor();e.stroke();e.stroke();assert.equal(e.marks(),1);
  e.run('undo()');assert.equal(e.pixel(2,2),0);
});
test('selection move preserves outside pixels and undo restores selection',()=>{
  const e=editor();e.stroke(2,2);e.stroke(20,20);
  e.view.sel={x:2,y:2,w:2,h:2};e.view.tool='move';
  e.event('pointerdown',1,2,2);e.event('pointermove',1,5,5);e.event('pointerup',1,5,5);
  assert.equal(e.pixel(2,2),0);assert.notEqual(e.pixel(5,5),0);assert.notEqual(e.pixel(20,20),0);
  assert.equal(e.view.sel.x,5);e.run('undo()');assert.equal(e.view.sel.x,2);assert.notEqual(e.pixel(2,2),0);
});
test('selection move clamps to canvas; cancelled move restores it',()=>{
  const e=editor();e.stroke();e.view.sel={x:2,y:2,w:2,h:2};e.view.tool='move';
  e.event('pointerdown',1,2,2);e.event('pointermove',1,40,40);
  assert.equal(e.view.sel.x,30);assert.notEqual(e.pixel(30,30),0);
  e.event('pointercancel',1,40,40);assert.equal(e.view.sel.x,2);assert.equal(e.pixel(30,30),0);
});
test('flip affects only the selected rectangle',()=>{
  const e=editor();e.stroke(2,2);e.stroke(20,20);e.view.sel={x:2,y:2,w:3,h:2};
  e.run('flipData(activeData(),true)');assert.equal(e.pixel(2,2),0);assert.notEqual(e.pixel(4,2),0);
  assert.notEqual(e.pixel(20,20),0);
  e.run('flipData(activeData(),false)');assert.equal(e.pixel(4,2),0);assert.notEqual(e.pixel(4,3),0);
});
test('lost pointer capture cancels an unfinished shape',()=>{
  const e=editor();e.view.tool='rect';e.event('pointerdown',1);e.event('pointermove',1,8,8);
  e.event('lostpointercapture',1);assert.equal(e.pixel(2,2),0);assert.equal(e.marks(),0);
  assert.equal(e.view.drawing,false);
});
test('middle-button pan does not paint or create undo history',()=>{
  const e=editor();e.wrap.scrollLeft=32;e.wrap.scrollTop=32;
  e.event('pointerdown',1,2,2,'mouse',{button:1});e.event('pointermove',1,7,9);
  e.event('pointerup',1,7,9);assert.equal(e.wrap.scrollLeft,27);assert.equal(e.wrap.scrollTop,25);
  assert.equal(e.pixel(2,2),0);assert.equal(e.marks(),0);
});
test('pinch scales continuously and does not mark drawing activity',()=>{
  const e=editor();e.event('pointerdown',1,2,2,'touch');e.event('pointerdown',2,12,2,'touch');
  e.event('pointermove',2,22,2,'touch');assert.equal(e.view.zoom,2);
  assert.equal(e.pixel(2,2),0);assert.equal(e.marks(),0);
});
test('Escape cancels the active stroke before editor shortcuts',()=>{
  const e=editor();e.event('pointerdown',1);let stopped=false;
  e.win.listeners.keydown[0]({key:'Escape',preventDefault(){},stopImmediatePropagation(){stopped=true;}});
  assert.equal(stopped,true);assert.equal(e.pixel(2,2),0);assert.equal(e.view.drawing,false);
});
test('palm contact on toolbar cannot change the active pen stroke',()=>{
  const e=editor();e.event('pointerdown',1,2,2,'pen');let blocked=0;
  const contact={target:{},pointerType:'touch',preventDefault(){},stopImmediatePropagation(){blocked++;}};
  e.dom.listeners.pointerdown[0](contact);e.dom.listeners.click[0](contact);
  assert.equal(blocked,2);assert.equal(e.view.drawing,true);
  e.event('pointerup',1,2,2,'pen');assert.equal(e.marks(),1);
});
test('terrain connector lock restores an existing border pixel after a stroke',()=>{
  const e=editor();e.doc.atlasEdit={atlasId:'terrain-test',terrainSlot:46,w:32,h:32};
  e.doc.frames[0][0][2]=0xff010203;
  e.stroke(2,0);
  assert.equal(e.pixel(2,0),0xff010203);
  e.view.terrainLock=false;e.stroke(2,0);
  assert.equal(e.pixel(2,0),e.view.pri);
});
test('undo restores the atlas slot together with its pixels',()=>{
  const e=editor();e.doc.atlasEdit={atlasId:'terrain-test',terrainSlot:46,x:96,y:80,w:16,h:16,c:6,r0:5};
  e.run('pushUndo()');e.doc.atlasEdit={...e.doc.atlasEdit,terrainSlot:47};
  e.run('undo()');assert.equal(e.doc.atlasEdit.terrainSlot,46);
  e.run('redo()');assert.equal(e.doc.atlasEdit.terrainSlot,47);
});
test('Shift+click with the pencil draws a straight line from the previous stroke end',()=>{
  const e=editor();e.stroke(2,2);
  e.event('pointerdown',1,9,2,'mouse',{shiftKey:true});e.event('pointerup',1,9,2);
  for(let x=2;x<=9;x++) assert.notEqual(e.pixel(x,2),0);
  assert.equal(e.marks(),2);e.run('undo()');assert.equal(e.pixel(5,2),0);assert.notEqual(e.pixel(2,2),0);
});
test('Shift+fill replaces every pixel of that colour, connected or not',()=>{
  const e=editor();e.stroke(2,2);e.stroke(20,20);e.view.tool='fill';e.view.pri=0xff0000ff;
  e.event('pointerdown',1,2,2,'mouse',{shiftKey:true});e.event('pointerup',1,2,2);
  assert.equal(e.pixel(2,2),0xff0000ff);assert.equal(e.pixel(20,20),0xff0000ff);assert.equal(e.pixel(0,0),0);
});
test('Alt+click picks a colour without painting; right-click picker fills the secondary',()=>{
  const e=editor();e.doc.frames[0][0][2*32+2]=0xff0a0b0c;
  e.event('pointerdown',1,2,2,'mouse',{altKey:true});e.event('pointerup',1,2,2);
  assert.equal(e.view.pri,0xff0a0b0c);assert.equal(e.marks(),0);
  e.doc.frames[0][0][3*32+3]=0xff0d0e0f;e.view.tool='picker';
  e.event('pointerdown',1,3,3,'mouse',{button:2,buttons:2});
  assert.equal(e.view.sec,0xff0d0e0f);assert.equal(e.view.pri,0xff0a0b0c);
});
test('wrap move carries pixels across the opposite edge',()=>{
  const e=editor();e.stroke(31,5);e.view.tool='move';e.view.wrapMove=true;
  e.event('pointerdown',1,10,10);e.event('pointermove',1,12,10);e.event('pointerup',1,12,10);
  assert.equal(e.pixel(31,5),0);assert.notEqual(e.pixel(1,5),0);
});
test('paste without a selection lands where it was copied and selects the pasted block',()=>{
  const e=editor();e.stroke(10,12);e.view.sel={x:9,y:11,w:3,h:3};
  e.run('copySel(activeData())');e.run('clearSel(activeData())');e.view.sel=null;
  e.run('pasteClip(activeData())');
  assert.notEqual(e.pixel(10,12),0);assert.deepEqual({...e.view.sel},{x:9,y:11,w:3,h:3});
});
test('outline wraps solid pixels in 4 directions, corners only on request',()=>{
  const e=editor();e.stroke(10,10);
  assert.equal(e.run('outlineData(activeData(),0xff000001)'),4);
  assert.equal(e.pixel(9,10),0xff000001);assert.equal(e.pixel(9,9),0);
  const f=editor();f.stroke(10,10);
  assert.equal(f.run('outlineData(activeData(),0xff000001,true)'),8);assert.equal(f.pixel(9,9),0xff000001);
});
test('rotate turns a square block 90° and refuses non-square selections',()=>{
  const e=editor();e.stroke(2,0);e.view.sel={x:0,y:0,w:4,h:4};
  assert.equal(e.run('rotateData(activeData(),true)'),true);
  assert.equal(e.pixel(2,0),0);assert.notEqual(e.pixel(3,2),0);
  e.run('rotateData(activeData(),false)');assert.notEqual(e.pixel(2,0),0);
  e.view.sel={x:0,y:0,w:4,h:3};assert.equal(e.run('rotateData(activeData(),true)'),false);
});
test('semi-transparent paint keeps its colour over an empty pixel',()=>{
  const e=editor();
  assert.equal(e.run('blendOver(0, 0x80ff8040)'),0x80ff8040);
  assert.equal(e.run('blendOver(0xff000000, 0xffffffff)'),0xffffffff);
});

test('layer length is the last frame where that layer still has pixels',()=>{
  const e=editor();
  e.doc.layers.push({name:'Đánh',vis:true});
  e.doc.frames=[0,1,2,3].map(()=>[new Uint32Array(1024),new Uint32Array(1024)]);
  e.doc.frames[1][0][5]=0xff0000ff;                            // lớp 0 dài 2 khung
  e.doc.frames[3][1][5]=0xff00ff00;                            // lớp 1 dài 4 khung
  assert.equal(e.run('layerLength(0)'),2); assert.equal(e.run('layerLength(1)'),4);
  e.doc.frames[3][1][5]=0; assert.equal(e.run('layerLength(1)'),0);
});
