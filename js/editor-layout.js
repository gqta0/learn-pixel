import { initTabs } from './tabs.js';
import { bindDrawerDrag } from './drawer.js';

const get = selector => document.querySelector(selector);
const create = (tag, attrs, text) => {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  if (text) node.textContent = text;
  return node;
};
const appendLink = (where, href, label) => where.append(create('a', {class:'btn tiny', href}, label));
let selectTab;

export function showEditorTab(id) {
  selectTab?.(id);
}

export function layoutEditor(mode) {
  const panel = get('.col.right');
  panel.id = 'editorPanel';
  const tabList = panel.querySelector('.tabs');
  tabList.setAttribute('aria-label', 'Bảng điều khiển');
  const addTab = (id, label, content = []) => {
    const pane = document.getElementById(id) ?? create('div', {class:'pane', id});
    if (!pane.parentNode) panel.append(pane);
    pane.append(...content);
    tabList.append(create('button', {type:'button', class:'tab', role:'tab', 'data-pane':id}, label));
    return pane;
  };
  const rig = get('#pRig');
  const status = get('#workspaceSave');
  status.textContent = '';
  const mobilePanel = get('#mnav [data-view="file"]');
  mobilePanel.addEventListener('click', event => {
    if (document.body.dataset.view === 'file') {
      event.stopImmediatePropagation();
      get('#mnav [data-view="draw"]').click();
    }
  });
  addEventListener('viewchange', () => {
    mobilePanel.setAttribute('aria-expanded', String(document.body.dataset.view === 'file'));
  });
  tabList.replaceChildren();
  const expand = create('button', {type:'button', class:'btn tiny drawer-expand', 'aria-expanded':'false'}, 'Mở rộng bảng');
  const setExpanded=open=>{
    panel.classList.toggle('expanded',open);
    expand.setAttribute('aria-expanded', String(open));
    expand.textContent = open ? 'Thu bảng' : 'Mở rộng bảng';
  };
  expand.addEventListener('click',()=>setExpanded(!panel.classList.contains('expanded')));
  bindDrawerDrag(expand,direction=>{
    if(direction==='up') setExpanded(true);
    else if(panel.classList.contains('expanded')) setExpanded(false);
    else get('#mnav [data-view="draw"]').click();
  });
  panel.prepend(expand);

  const strip=get('.filmstrip');
  strip.id='editorFrames';
  const stripToggle=create('button',{type:'button',class:'btn tiny frame-strip-toggle','aria-controls':strip.id,'aria-expanded':'true'},'Khung hình');
  get('.stagebar').append(stripToggle);
  stripToggle.addEventListener('click',()=>{
    const collapsed=strip.classList.toggle('collapsed');
    stripToggle.setAttribute('aria-expanded',String(!collapsed));
  });

  let selected;
  if (mode === 'puppet') {
    const [setup, preview, parts, guides, lint, bundle] = Array.from(rig.children);
    const head = get('#rigSrcHead').parentElement;
    const body = get('#rigSrcBody').parentElement;
    const sources = create('div', {class:'block rig-sources'});
    sources.append(head, body);
    tabList.before(sources);
    for(const kind of ['Head','Body']){
      const select=get('#rigSrc'+kind);
      select.after(create('button',{type:'button',id:'rigEdit'+kind,class:'btn tiny'},'Mở sheet'));
    }

    const characterActions = get('#rigCharSave').parentElement;
    const characterNote = get('#rigCharNote');
    const shade = create('div', {class:'block'});
    const shadeStart = get('#rigLight').previousElementSibling;
    const shadeEnd = get('#rigShadeInfo').nextElementSibling;
    for (let node = shadeStart; node !== shadeEnd;) {
      const next = node.nextElementSibling;
      shade.append(node);
      node = next;
    }
    preview.querySelector('p:last-child').textContent = 'Ẩn miếng chỉ áp dụng khi xem. Viền tự động áp dụng cả khi xuất.';
    rig.hidden = true;
    addTab('rigPartsPane', 'Miếng', [setup, parts, guides, get('#pFile > .block')]);
    addTab('rigPreviewPane', 'Xem rối', [preview]);
    addTab('rigShadePane', 'Soi & đổ bóng', [lint, shade]);
    const files = addTab('rigFilesPane', 'Nhân vật & xuất', [characterActions, characterNote, bundle]);
    files.append(get('#expJson').parentElement);
    get('#mnav [data-view="learn"]').hidden = true;
    get('#mnav [data-view="colors"]').remove();
    get('#mnav [data-view="tools"]').textContent = 'Cọ & màu';
    selected = 'rigPartsPane';
  } else if (mode === 'atlas') {
    const links = create('div', {class:'block atlas-links'});
    appendLink(links, 'tile.html', 'Bộ tile');
    links.append(create('button',{type:'button',id:'workspaceAtlas',class:'btn tiny'},'Mở Atlas'));
    appendLink(links, 'tile.html?panel=map', 'Soi map nâng cao');
    panel.prepend(links);
    addTab('pLayers', 'Lớp & khung', [get('#pFile > .block')]);
    addTab('pColor', 'Màu', [get('.color-block'), get('#rampBlock')]);
    addTab('pFile', 'File');
    get('#mnav [data-view="learn"]').hidden = true;
    selected = 'pLayers';
  } else {
    const progress=get('.prog');
    progress.hidden=false;
    get('#pHoc > .block').append(progress);
    addTab('pLayers', 'Lớp & khung', [get('#pFile > .block')]);
    addTab('pColor', 'Màu', [get('.color-block'), get('#rampBlock')]);
    addTab('pHoc', 'Học vẽ');
    addTab('pFile', 'File');
    const atlas = get('#atOpen');
    atlas.hidden = true;
    appendLink(atlas.parentElement, 'tile.html?panel=atlas', 'Mở Atlas');
    selected = 'pLayers';
  }
  for(const pane of panel.querySelectorAll(':scope > .pane')){
    pane.hidden=true;
    pane.classList.remove('on');
  }
  selectTab = initTabs(tabList, id => {
    window.dispatchEvent(new CustomEvent('editor-tab', {detail:id}));
  }, selected);
}
