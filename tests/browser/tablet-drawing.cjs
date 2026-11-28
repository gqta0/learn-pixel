const assert = require('node:assert/strict');

async function assertStackedIcons(buttons) {
  const stacked=await buttons.evaluateAll(items=>items.map(button=>{
    const icon=button.querySelector('.nav-icon'), label=button.querySelector('.nav-label');
    return !!(icon && label && icon.getBBox().width>0 &&
      icon.getBoundingClientRect().bottom<=label.getBoundingClientRect().top);
  }));
  assert.ok(stacked.length>0 && stacked.every(Boolean),'each visible tab has a rendered icon above its label');
}

module.exports = async function testTabletDrawing(browser, origin) {
  const page = await browser.newPage({
    viewport:{width:800,height:1280}, hasTouch:true, isMobile:true, deviceScaleFactor:2
  });
  try {
    for (const workspace of ['index','puppet']) {
      await page.goto(origin+'/'+workspace+'.html');
      await page.locator('#tools [data-tool]').first().waitFor({state:'attached'});
      await assertStackedIcons(page.locator('#mnav button:visible'));
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
      await page.locator('#mnav [data-view="tools"]').tap();
      assert.equal(await page.locator('.col.left').isVisible(),false,'tapping Cọ again dismisses the drawer');
      await page.locator('#mnav [data-view="colors"]').tap();
      assert.equal(await page.locator('#tab-pColor').getAttribute('aria-selected'),'true');
      assert.ok(await page.locator('#swatches .pal-group').count()>1,'the color drawer presents grouped swatches');
      await page.locator('#mnav [data-view="file"]').tap();
      const expected=workspace==='index'?'pFile':'rigPartsPane';
      assert.equal(await page.locator('#tab-'+expected).getAttribute('aria-selected'),'true');
      if(workspace==='index'){
        await page.locator('#mnav [data-view="layers"]').tap();
        assert.equal(await page.locator('#tab-pLayers').getAttribute('aria-selected'),'true');
        assert.equal(await page.locator('#editorPanel .tabs').isVisible(),false);
      }else{
        await page.locator('#tab-pColor').tap();
        assert.equal(await page.locator('#mnav [data-view="colors"]').getAttribute('aria-current'),'true');
      }
    }
    await page.setViewportSize({width:1280,height:800});
    await page.goto(origin+'/tile.html');
    await page.locator('#emptyNew').click();
    await page.locator('#newDlg button[value=ok]').click();
    const ed=page.locator('#ed');
    assert.equal(await page.locator('[data-ctx=single]').getAttribute('aria-checked'),'true');
    const fitted=await ed.boundingBox();
    await page.locator('#tileZoomIn').click();
    assert.ok((await ed.boundingBox()).width>fitted.width,'zoom enlarges the pixel canvas');
    await page.locator('#tileZoomFit').click();
    assert.equal((await ed.boundingBox()).width,fitted.width);
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
    await page.locator('[data-tool=line]').tap();
    await event('pointerdown','pen',4,1);
    await event('pointerup','pen',4,0);
    assert.notEqual(await thumb(),initial,'a pen tap places a one-pixel line');
    await page.setViewportSize({width:800,height:1280});
    const drawerY=(await page.locator('#tileDrawer').boundingBox()).y;
    await page.locator('#tileDrawerMap').tap();
    assert.equal(await page.locator('#tab-paneMap').getAttribute('aria-selected'),'true');
    await assertStackedIcons(page.locator('.tile-drawer-controls button:visible'));
    assert.ok(Math.abs((await page.locator('#tileDrawer').boundingBox()).y-drawerY)<2,'the navigation stays at the bottom when the map opens');
    assert.equal(await page.locator('.tp-tabs').isVisible(),false,'the drawer has one row of navigation');
    await page.locator('#tileDrawer').tap();
    assert.equal(await page.locator('#tab-paneGrid').getAttribute('aria-selected'),'true');
    await page.locator('#tileDrawer').tap();
    assert.equal(await page.locator('#tilePanel').getAttribute('data-drawer'),'closed');
    await page.locator('#tileDrawerQuick').tap();
    await page.locator('#tab-paneMap').tap();
    assert.equal(await page.locator('#tileDrawerMap').getAttribute('aria-expanded'),'true');
    await page.locator('#tileDrawerMap').tap();
    await page.locator('.tp-palette summary').tap();
    assert.ok(await page.locator('#pal .tp-color-group').count()>1,'Tile palettes are split into color families');
  } finally {
    await page.close();
  }
};
