import { initTabs } from './tabs.js';
import { bindDrawerDrag } from './drawer.js';
import { popover } from './popup.js';

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
  // bảng đang kéo lên đầy màn hình mà bút chạm canvas: thu về 40% để thấy chỗ vừa vẽ
  get('#wrap').addEventListener('pointerdown',e=>{
    if(e.pointerType==='pen' && panel.classList.contains('expanded')) setExpanded(false);
  });

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
  bindPhoneMenus(mode);
  bindPhoneFrames(mode);
}

const PHONE=matchMedia('(max-width: 679px) and (orientation: portrait)');
/* Điện thoại dọc: dải khung thu về một hàng 44px (⌃ mở dải ảnh nhỏ), ô xem trước nổi trên canvas,
   kéo để dời (nhớ vị trí), chạm để chạy / dừng. Ghép rối đã có rối nổi nên không có ô này. */
function bindPhoneFrames(mode){
  const strip=get('#editorFrames'), toggle=get('#frameToggle');
  const KEY_OPEN='lo-pixel-frames-open', KEY_POS='lo-pixel-preview-pos';
  const setOpen=open=>{
    strip.classList.toggle('mini-open',open);
    toggle.setAttribute('aria-expanded',String(open));
    toggle.textContent=open?'⌄':'⌃';
  };
  try{ setOpen(localStorage.getItem(KEY_OPEN)==='1'); }catch(_){ setOpen(false); }
  toggle.addEventListener('click',()=>{
    const open=!strip.classList.contains('mini-open');
    setOpen(open);
    try{ localStorage.setItem(KEY_OPEN,open?'1':'0'); }catch(_){}
  });

  const area=get('.canvasarea'), scroll=get('.preview-scroll'), home=scroll.parentElement;
  const box=create('div',{class:'float-preview',role:'button',tabindex:'0','aria-label':'Ô xem trước: chạm để chạy hoặc dừng, kéo để dời'});
  box.hidden=true;
  area.append(box);
  const clamp=(x,y)=>{
    const a=area.getBoundingClientRect(), b=box.getBoundingClientRect();
    return [Math.min(Math.max(0,x),Math.max(0,a.width-b.width)), Math.min(Math.max(0,y),Math.max(0,a.height-b.height))];
  };
  const put=(x,y)=>{ [x,y]=clamp(x,y); box.style.left=x+'px'; box.style.top=y+'px'; box.style.right='auto'; };
  const tagCtl=get('#tagCtl'), tagHome=tagCtl.parentElement, tagAfter=get('#playBtn'), gap=get('.frame-mini-gap');
  const place=()=>{
    const float=PHONE.matches && mode!=='puppet';
    if(float){ box.append(scroll); box.hidden=false; }
    else { home.prepend(scroll); box.hidden=true; }
    if(PHONE.matches) gap.before(tagCtl); else tagAfter.after(tagCtl);
  };
  PHONE.addEventListener('change',place);
  place();
  try{ const p=JSON.parse(localStorage.getItem(KEY_POS)); if(p) requestAnimationFrame(()=>put(p.x,p.y)); }catch(_){}
  let drag=null;
  box.addEventListener('pointerdown',e=>{
    const a=area.getBoundingClientRect(), b=box.getBoundingClientRect();
    drag={x:e.clientX,y:e.clientY,ox:b.left-a.left,oy:b.top-a.top,moved:false};
    box.setPointerCapture?.(e.pointerId);
  });
  box.addEventListener('pointermove',e=>{
    if(!drag) return;
    const dx=e.clientX-drag.x, dy=e.clientY-drag.y;
    if(!drag.moved && Math.hypot(dx,dy)<6) return;
    drag.moved=true; put(drag.ox+dx,drag.oy+dy);
  });
  box.addEventListener('pointerup',()=>{
    if(!drag) return;
    const moved=drag.moved; drag=null;
    if(!moved){ get('#miniPlay').click(); return; }
    try{ localStorage.setItem(KEY_POS,JSON.stringify({x:parseFloat(box.style.left),y:parseFloat(box.style.top)})); }catch(_){}
  });
  box.addEventListener('pointercancel',()=>{ drag=null; });
  box.addEventListener('keydown',e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); get('#miniPlay').click(); } });
}

/* Điện thoại dọc: thanh trên chỉ còn một hàng. ≡ gom trang, thư viện, sáng/tối;
   ⋯ thả thanh khổ / lưới / Thêm xuống đè lên canvas, chạm lần nữa thì thu. */
function bindPhoneMenus(mode){
  const ws=get('#wsMenuBtn'), stage=get('#stageMenuBtn');
  ws?.addEventListener('click',()=>{
    const pages=[...document.querySelectorAll('.workspace-nav a')].map(a=>({
      label:a.textContent.trim(), on:a.getAttribute('aria-current')==='page', fn:()=>{ location.href=a.href; }
    }));
    const extra=[['#libBtn','📁 Thư viện bản vẽ'],['#themeBtn','☀ Nền sáng / tối']];
    if(mode==='puppet') extra.unshift(['#rigSaveSheet','💾 Lưu sheet vào thư viện']);
    popover(ws,'Lò Pixel',[...pages,{heading:'Khác'},
      ...extra.filter(([sel])=>get(sel)).map(([sel,label])=>({label,fn:()=>get(sel).click()}))]);
  });
  stage?.addEventListener('click',()=>{
    const open=document.body.classList.toggle('stage-open');
    stage.setAttribute('aria-expanded',String(open));
  });
}
