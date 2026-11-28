// Run: node --test tests/gestures.mjs — phân loại chạm nhiều ngón trên canvas.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createTapTracker, longPressReady} from '../js/gestures.js';

test('hai ngón chạm nhanh = undo, ba ngón = redo',()=>{
  const g=createTapTracker();
  g.down(1,10,10,0); g.down(2,60,10,20); assert.equal(g.up(1,120),null); assert.equal(g.up(2,140),'undo');
  g.down(1,0,0,0); g.down(2,9,9,5); g.down(3,30,30,10); g.up(1,100); g.up(2,110); assert.equal(g.up(3,120),'redo');
});
test('chụm, giữ lâu, một ngón thì không phải chạm',()=>{
  const g=createTapTracker();
  g.down(1,10,10,0); g.down(2,60,10,0); g.move(2,80,10); g.up(1,100); assert.equal(g.up(2,110),null);
  g.down(1,0,0,0); g.down(2,5,5,0); g.up(1,200); assert.equal(g.up(2,300),null);
  g.down(1,0,0,0); assert.equal(g.up(1,50),null);
});
test('reset bỏ lượt chạm đang dở; nhấc ngón lạ không làm gì',()=>{
  const g=createTapTracker();
  g.down(1,0,0,0); g.down(2,5,0,0); g.reset(); g.up(1,50); assert.equal(g.up(2,60),null);
  assert.equal(g.up(9,10),null);
});
test('bốn ngón không phải undo hay redo',()=>{
  const g=createTapTracker();
  for(let i=1;i<=4;i++) g.down(i,i*10,0,0);
  for(let i=1;i<4;i++) g.up(i,50);
  assert.equal(g.up(4,60),null);
});

test('longPressReady: đủ giờ và chưa lệch',()=>{
  assert.equal(longPressReady({x:0,y:0,t:0},{x:3,y:4,t:400}),true);
  assert.equal(longPressReady({x:0,y:0,t:0},{x:7,y:0,t:900}),false);
  assert.equal(longPressReady({x:0,y:0,t:0},{x:0,y:0,t:399}),false);
});
