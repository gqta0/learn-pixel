// Run with a static server and Playwright installed. The Chromium path is optional.
const assert = require('node:assert/strict');
const {readFile} = require('node:fs/promises');
const {join} = require('node:path');
const {chromium} = require('playwright');
const testPuppetProjects = require('./puppet-projects.cjs');
const testTabletDrawing = require('./tablet-drawing.cjs');
const testPhoneLayout = require('./phone-layout.cjs');

const origin = process.env.LEARN_PIXEL_URL || 'http://127.0.0.1:8123';
const countPixels = page => page.evaluate(async () => {
  const {activeData} = await import(new URL('js/state.js',location.href));
  return activeData().filter(Boolean).length;
});

async function run() {
  const browser = await chromium.launch({executablePath:process.env.LEARN_PIXEL_CHROMIUM});
  try {
    await testPuppetProjects(browser, origin);
    await testTabletDrawing(browser, origin);
    await testPhoneLayout(browser, origin);
    const page = await browser.newPage({viewport:{width:1440,height:900}});
    page.setDefaultTimeout(12000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('dialog', dialog => dialog.accept(dialog.type()==='prompt' ? 'Audit character' : undefined));
    await page.addInitScript(() => {
      if (localStorage.getItem('lo-pixel-save')) return;
      localStorage.setItem('lo-pixel-save', JSON.stringify({
        app:'lo-pixel',version:2,name:'Bản cũ',w:32,h:32,
        layers:[{name:'Lớp cũ',vis:true}],frames:[[[0xff215785,1,0,1023]]]
      }));
    });
    await page.goto(origin+'/index.html');
    await page.waitForFunction(() => document.querySelector('#workspaceSave')?.textContent==='Đã mở bản lưu');
    assert.equal(await countPixels(page),1);
    await page.locator('#board').click();
    assert.equal(await countPixels(page),2);
    await page.locator('#btnUndo').click();
    assert.equal(await countPixels(page),1);
    await page.locator('#btnRedo').click();
    assert.equal(await countPixels(page),2);
    await page.locator('#tab-pLayers').focus();
    await page.keyboard.press('ArrowRight');
    // màn ≥ 1180px: khối Màu nằm luôn dưới danh sách lớp, thẻ Màu ẩn nên mũi tên đi tới Học vẽ
    assert.equal(await page.locator('#tab-pHoc').getAttribute('aria-selected'),'true');
    await page.getByRole('navigation',{name:'Nhóm chức năng'}).getByText('Ghép rối').click();
    await page.waitForURL('**/puppet.html');
    await page.waitForFunction(() => document.querySelector('#rigInfo')?.textContent.includes('14 động tác'));
    assert.equal(await countPixels(page),0);
    assert.equal(await page.locator('#pHoc').isVisible(),false);
    assert.equal(await page.locator('#rigPartsPane').isVisible(),true);
    await page.locator('#rigNewHead').click();
    await page.waitForFunction(async () => (await import(new URL('js/state.js',location.href))).doc.puppet==='head');
    await page.locator('#tab-rigPreviewPane').click();
    await page.waitForFunction(() => document.querySelector('#rigBig').width>0);
    await page.locator('#tab-rigFilesPane').click();
    await page.locator('#rigCharSave').click();
    const character = await page.locator('#rigCharNote a').evaluate(async link => (await fetch(link.href)).json());
    assert.equal(character.schema,'lo-pixel.character.v1');
    assert.equal(character.head.data.w,109);
    await page.locator('#rigExport').click();
    const bake = await page.locator('#rigNote a').evaluate(async link => new TextDecoder().decode(await (await fetch(link.href)).arrayBuffer()));
    assert.ok(bake.includes('puppet_bake.json'));
    await page.locator('#rigCharOpen').setInputFiles(join(__dirname,'../../data/samples/mau-de-tu-ao-lam.nhanvat.json'));
    await page.waitForFunction(async () => {
      const {doc} = await import(new URL('js/state.js',location.href));
      return doc.puppet==='head' && doc.w===103;
    });
    await page.locator('#tab-rigShadePane').click();
    await page.waitForFunction(() => document.querySelector('#rigLint').textContent.includes('khung xương cũ'));

    await page.getByRole('navigation',{name:'Nhóm chức năng'}).getByText('Vẽ thường').click();
    await page.waitForURL('**/index.html');
    await page.waitForFunction(() => document.querySelector('#workspaceSave')?.textContent==='Đã mở bản lưu');
    assert.equal(await countPixels(page),2);
    const legacySize = await page.evaluate(() => JSON.parse(localStorage.getItem('lo-pixel-save')).frames[0][0][1]);
    assert.equal(legacySize,1);
    await page.locator('#mapPrevBtn').click();
    await page.waitForURL('**/tile.html?panel=map&source=canvas');
    await page.locator('#mapWrap').waitFor();
    await page.locator('[title^="Bản vẽ hiện tại (32×32)"]').first().waitFor({state:'attached'});
    await page.locator('#mapClose').click();

    await page.evaluate(() => {
      const image=document.createElement('canvas');
      image.width=38;
      image.height=14;
      const context=image.getContext('2d');
      context.fillStyle='#123456';
      context.fillRect(2,2,16,10);
      context.fillStyle='#876543';
      context.fillRect(20,2,16,10);
      localStorage.setItem('lo-pixel-atlas', JSON.stringify({
        id:'test-atlas',name:'Atlas thử',tw:16,th:10,pad:2,off:2,png:image.toDataURL()
      }));
    });
    await page.goto(origin+'/tile.html?panel=atlas');
    await page.locator('#atCv').click({position:{x:8,y:8}});
    await page.locator('#atEdit').click();
    await page.locator('#atlasSave').waitFor();
    await page.locator('#board').click();
    await page.locator('#atlasSave').click();
    await page.waitForFunction(() => document.querySelector('#atNote').textContent.includes('Đã cất'));
    const atlasPixels = await page.evaluate(async () => {
      const saved=JSON.parse(localStorage.getItem('lo-pixel-atlas'));
      const image=new Image();
      image.src=saved.png;
      await image.decode();
      const canvas=document.createElement('canvas');
      canvas.width=38;canvas.height=14;
      const context=canvas.getContext('2d');
      context.drawImage(image,0,0);
      const count=(x,color)=>{
        const pixels=context.getImageData(x,2,16,10).data;
        let matching=0;
        for(let i=0;i<pixels.length;i+=4)
          if(color.every((value,j)=>pixels[i+j]===value)) matching++;
        return matching;
      };
      return [count(2,[18,52,86,255]),count(20,[135,101,67,255])];
    });
    assert.equal(atlasPixels[0],159);
    assert.equal(atlasPixels[1],160);

    await page.getByRole('navigation',{name:'Nhóm chức năng'}).getByText('Vẽ tile').click();
    await page.waitForURL('**/tile.html');
    await page.locator('#emptyNew').click();
    await page.locator('#newDlg input[name="name"]').fill('Terrain thử');
    await page.locator('#newDlg button[value="ok"]').click();
    await page.locator('#tpMain').waitFor();
    assert.equal(await page.locator('#grid button').count(),56);
    await page.locator('#tab-paneGrid').focus();
    await page.keyboard.press('ArrowRight');
    assert.equal(await page.locator('#tab-paneMap').getAttribute('aria-selected'),'true');
    await page.keyboard.press('ArrowLeft');
    await page.locator('#grid button[data-slot="46"]').click();
    await page.locator('[data-ctx="single"]').click();
    const tileImage = () => page.locator('#grid button[data-slot="46"] canvas').evaluate(canvas=>canvas.toDataURL());
    const before = await tileImage();
    await page.locator('#ed').click();
    assert.notEqual(await tileImage(),before);
    await page.locator('#undoBtn').click();
    assert.equal(await tileImage(),before);
    const [download] = await Promise.all([page.waitForEvent('download'),page.locator('#tsGodot').click()]);
    const zip = await readFile(await download.path());
    for(const name of ['tileset.png','tileset.tres','layout.json']) assert.ok(zip.includes(Buffer.from(name)));
    await page.reload();
    await page.locator('#tpMain').waitFor();
    assert.match(await page.locator('#tsSel option:checked').textContent(),/Terrain thử/);
    await page.setViewportSize({width:390,height:844});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await page.locator('#tileDrawer').click();
    await page.locator('#tileDrawerExpand').click();
    assert.equal(await page.locator('#tilePanel').getAttribute('data-drawer'),'expanded');
    await page.locator('#tileDrawer').click();
    assert.equal(await page.locator('#tilePanel').getAttribute('data-drawer'),'closed');
    const handle=await page.locator('#tileDrawer').boundingBox();
    await page.mouse.move(handle.x+handle.width/2,handle.y+handle.height/2);
    await page.mouse.down();
    await page.mouse.move(handle.x+handle.width/2,handle.y-60);
    await page.mouse.up();
    assert.equal(await page.locator('#tilePanel').getAttribute('data-drawer'),'half');
    await page.goto(origin+'/index.html');
    await page.locator('#mnav [data-view=file]').click();
    await page.locator('.drawer-expand').click();
    assert.equal(await page.locator('.drawer-expand').getAttribute('aria-expanded'),'true');
    await page.locator('#mnav [data-view=file]').click();
    await page.locator('#board').waitFor();
    for(const [width,height] of [[1440,900],[1024,768],[768,1024],[390,844],[844,390]]){
      await page.setViewportSize({width,height});
      for(const path of ['index.html','puppet.html','tile.html']){
        await page.goto(origin+'/'+path);
        const nav=page.getByRole('navigation',{name:'Nhóm chức năng'});
        // điện thoại dọc ở trang Vẽ / Ghép rối: chọn trang nằm sau ≡ để thanh trên còn một hàng
        if(width<680 && height>width && path!=='tile.html'){
          await page.locator('#wsMenuBtn').waitFor();
          assert.equal(await nav.isVisible(),false,path+' at '+width);
          assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,path+' at '+width);
          continue;
        }
        await nav.waitFor();
        assert.equal(await nav.locator('a[aria-current=page]').count(),1);
        assert.ok(await nav.evaluate(node=>node.getBoundingClientRect().right<=innerWidth),path+' at '+width);
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,path+' at '+width);
      }
    }
    assert.deepEqual(errors,[]);
    console.log('PASS: drawing draft, tabs, puppet export, atlas/map handoff, tile edits, Godot ZIP, mobile panel');
  } finally { await browser.close(); }
}

run().catch(error=>{ console.error(error); process.exitCode=1; });
