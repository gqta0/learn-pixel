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
let selectTab, setMode;

export function setEditorView(view) {
  setMode?.(view);
}

export function showEditorTab(id) {
  selectTab?.(id);
}

export function layoutEditor(mode) {
  const panel = get('.col.right');
  panel.id = 'editorPanel';
  get('.col.left').id = 'editorTools';
  get('.stage').id = 'editorStage';
  const navButtons = Array.from(get('#mnav').querySelectorAll('button'));
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
    else setEditorView('draw');
  });
  panel.prepend(expand);

  const strip=get('.filmstrip');
  strip.id='editorFrames';
  const compact=matchMedia('(pointer: coarse) and (min-width: 680px) and (max-width: 1600px)').matches;
  if(compact) strip.classList.add('collapsed');
  const stripToggle=create('button',{type:'button',class:'btn tiny frame-strip-toggle','aria-controls':strip.id,'aria-expanded':String(!compact)},'Khung hình');
  get('#zoomFit').after(stripToggle);
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
    addTab('pColor','Màu',[get('.color-block'),get('#rampBlock')]);
    get('#mnav [data-view="learn"]').hidden = true;
    get('#mnav [data-view="layers"]').hidden = true;
    const puppetTab=get('#mnav [data-view="file"]');
    puppetTab.querySelector('.nav-label').textContent = 'Ghép rối';
    puppetTab.querySelector('use').setAttribute('href','icons/navigation.svg#puppet');
    selected = 'rigPartsPane';
  } else if (mode === 'atlas') {
    const links = create('div', {class:'block atlas-links'});
    appendLink(links, 'tile.html', 'Bộ tile');
    links.append(create('button',{type:'button',id:'workspaceAtlas',class:'btn tiny'},'Mở Atlas'));
    appendLink(links, 'tile.html?panel=map', 'Soi map nâng cao');
    panel.prepend(links);
    addTab('pLayers', 'Lớp & khung', [get('#pFile > .block')]);
    addTab('pColor', 'Màu', [get('.color-block'), get('#rampBlock')]);
    addTab('pFile', 'Tệp');
    get('#mnav [data-view="learn"]').hidden = true;
    selected = 'pLayers';
  } else {
    const progress=get('.prog');
    progress.hidden=false;
    get('#pHoc > .block').append(progress);
    addTab('pLayers', 'Lớp & khung', [get('#pFile > .block')]);
    addTab('pColor', 'Màu', [get('.color-block'), get('#rampBlock')]);
    addTab('pHoc', 'Học vẽ');
    addTab('pFile', 'Tệp');
    const atlas = get('#atOpen');
    atlas.hidden = true;
    appendLink(atlas.parentElement, 'tile.html?panel=atlas', 'Mở Atlas');
    selected = 'pLayers';
  }
  for(const pane of panel.querySelectorAll(':scope > .pane')){
    pane.hidden=true;
    pane.classList.remove('on');
  }
  const paneByView={colors:'pColor',layers:'pLayers',learn:'pHoc',file:mode==='puppet'?'rigPartsPane':'pFile'};
  const markView=view=>{
    document.body.dataset.view=view;
    for(const b of navButtons){
      const active=String(b.dataset.view===view);
      b.setAttribute('aria-current',active);
      if(b.hasAttribute('aria-expanded')) b.setAttribute('aria-expanded',active);
    }
    window.dispatchEvent(new CustomEvent('viewchange',{detail:{view}}));
  };
  const notifyTab=id=>window.dispatchEvent(new CustomEvent('editor-tab',{detail:id}));
  selectTab=initTabs(tabList,id=>{
    if(paneByView[document.body.dataset.view]){
      const view=Object.keys(paneByView).find(view=>paneByView[view]===id) || 'file';
      markView(view);
    }
    panel.scrollTop=0;
    notifyTab(id);
  },selected);
  setMode=view=>{
    if(view!==document.body.dataset.view){
      setExpanded(false);
      if(view==='tools') get('#editorTools').scrollTop=0;
      panel.scrollTop=0;
    }
    const pane=paneByView[view];
    if(pane) selectTab(pane);
    markView(view);
    if(pane) notifyTab(pane);
  };
  for(const b of navButtons) b.addEventListener('click',()=>{
    const view=b.dataset.view;
    setEditorView(view===document.body.dataset.view?'draw':view);
  });
}
