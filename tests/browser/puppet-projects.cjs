const assert = require('node:assert/strict');

module.exports = async function testPuppetProjects(browser, origin) {
  const page = await browser.newPage({viewport:{width:1440,height:900}});
  try {
    page.on('dialog', dialog => dialog.accept());
    await page.goto(origin+'/puppet.html');
    await page.waitForFunction(() => document.querySelector('#rigInfo')?.textContent.includes('14 động tác'));
    await page.locator('#rigNewHead').click();
    const first = await page.locator('#rigSrcHead').inputValue();
    await page.locator('#rigNewHead').click();
    const second = await page.locator('#rigSrcHead').inputValue();
    assert.notEqual(first,second);

    await page.locator('#rigSrcHead').selectOption(first);
    await page.locator('#tab-rigFilesPane').click();
    const selectedAfterTab = await page.locator('#rigSrcHead').inputValue();
    const readProject = () => page.evaluate(async () => {
      const {serialize} = await import('./js/storage.js');
      const {currentId} = await import('./js/library.js');
      const {name,fps,palette} = serialize();
      return {id:currentId(),settings:{name,fps,palette}};
    });
    const original = await readProject();
    const project = await page.evaluate(async () => {
      const {serialize} = await import('./js/storage.js');
      const data = serialize();
      data.name = 'Imported head';
      data.fps = 17;
      data.palette = ['#010203'];
      data.frames[0][0] = [0xffffffff,1,0,data.w*data.h-1];
      return data;
    });
    await page.locator('#impJson').setInputFiles({
      name:'head.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(project))
    });
    await page.waitForFunction(() => document.querySelector('#workspaceTitle').textContent==='Imported head');
    await page.locator('#rigSaveSheet').click();
    await page.waitForFunction(() => !document.querySelector('#rigSaveSheet').disabled);
    const saved = await page.evaluate(async id => {
      const {currentId,getLibraryItems} = await import('./js/library.js');
      const items = getLibraryItems();
      return {
        newEntry:currentId()!==id,
        originalPixel:items[id].data.frames[0][0][0],
        importedPixel:items[currentId()].data.frames[0][0][0]
      };
    },second.slice(4));
    await page.locator('#btnUndo').click();
    assert.deepEqual(await readProject(),original);
    assert.equal(await page.locator('#workspaceTitle').textContent(),original.settings.name);
    await page.locator('#btnRedo').click();
    const redone = await readProject();
    assert.notEqual(redone.id,second.slice(4));
    assert.deepEqual(redone.settings,{name:project.name,fps:17,palette:['#010203']});
    assert.deepEqual({selectionKept:selectedAfterTab===first,...saved},{
      selectionKept:true,newEntry:true,originalPixel:0,importedPixel:0xffffffff
    });
  } finally {
    await page.close();
  }
};
