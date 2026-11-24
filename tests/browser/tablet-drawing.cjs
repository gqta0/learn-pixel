const assert = require('node:assert/strict');

module.exports = async function testTabletDrawing(browser, origin) {
  const page = await browser.newPage({
    viewport:{width:800,height:1280}, hasTouch:true, isMobile:true, deviceScaleFactor:2
  });
  try {
    for (const workspace of ['index','puppet']) {
      await page.goto(origin+'/'+workspace+'.html');
      await page.locator('#tools [data-tool]').first().waitFor({state:'attached'});
      await page.locator('#mnav [data-view="tools"]').click();
      const panel=await page.locator('.col.left').boundingBox();
      const canvas=await page.locator('#wrap').boundingBox();
      assert.ok(panel.height>=44 && panel.y>=canvas.y+canvas.height-1,
        workspace+' must keep the open brush drawer reachable below the canvas in portrait');
      const lastTool=await page.locator('#tools [data-tool]').last().boundingBox();
      assert.ok(lastTool.y+lastTool.height<=panel.y+panel.height,'the full tool grid fits the tablet drawer');
      const quick=await page.locator('#quickbar').boundingBox();
      const pencil=await page.locator('#quickbar [data-q=pencil]').boundingBox();
      assert.ok(pencil.y+pencil.height<=quick.y+quick.height,'the quick bar shows a complete pen button');
      await page.locator('#tools [data-tool="eraser"]').click();
    }
    await page.setViewportSize({width:1280,height:800});
    await page.goto(origin+'/tile.html');
    await page.locator('#emptyNew').click();
    await page.locator('#newDlg button[value=ok]').click();
    await page.locator('[data-ctx="single"]').click();
    const ed=page.locator('#ed');
    const bounds=await ed.boundingBox();
    const point={clientX:bounds.x+bounds.width/2,clientY:bounds.y+bounds.height/2};
    const event=(type,pointerType,pointerId,buttons)=>ed.dispatchEvent(type,{
      ...point,bubbles:true,pointerType,pointerId,buttons,button:0
    });
    const thumb=()=>page.locator('#grid button[aria-current=true] canvas').evaluate(c=>c.toDataURL());
    const initial=await thumb();
    await event('pointerdown','pen',1,1);
    const slotTitle=await page.locator('#slotTitle').textContent();
    await page.locator('#slotNext').tap();
    assert.equal(await page.locator('#slotTitle').textContent(),slotTitle,'a palm on the toolbar must not switch tiles mid-stroke');
    await event('pointercancel','touch',2,0);
    await event('pointerup','pen',1,0);
    assert.notEqual(await thumb(),initial,'cancelling a palm contact must preserve the pen stroke');
    await page.locator('#undoBtn').click();
    assert.equal(await thumb(),initial);
    await event('pointerdown','touch',2,1);
    await event('pointerup','touch',2,0);
    assert.equal(await thumb(),initial,'a resting palm after a pen stroke must leave the tile untouched');
    await page.locator('#tileFinger').click();
    await event('pointerdown','touch',3,1);
    await event('pointerup','touch',3,0);
    assert.notEqual(await thumb(),initial,'finger painting must be available on demand');
    await page.locator('#undoBtn').click();
    await ed.click({button:'middle'});
    assert.equal(await thumb(),initial,'the middle mouse button must leave the tile untouched');
  } finally {
    await page.close();
  }
};
