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
  const view={tool:'pencil',fingerMode:'draw',brush:1,brushEff:1,pri:0xff112233,sec:0xff445566,sel:null,zoom:1};
  let marks=0;
  dom.createElement=element; dom.querySelector=()=>null;
  const context=vm.createContext({doc,view,board,$,document:dom,window:win,Uint32Array,
    activeData:()=>doc.frames[doc.af][doc.al],blank:()=>new Uint32Array(doc.w*doc.h),
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
