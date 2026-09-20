/* Cửa sổ xem trước bản đồ (Map Preview):
   Dựng một lát cắt hang động chuẩn 24×16 ô theo đúng đặc tả genesis.tileset.preview.v1
   để kiểm tra khớp nối (seams), tính lặp lại (repetition), autotile 47/56 ô và độ dễ nhìn
   của tile khi ghép vào màn chơi game thật. */

import { $ } from './dom.js';
import { doc } from './state.js';
import { frameToCanvas } from './raster.js';
import { download } from './storage.js';
import { getAtlas, editAtlasSlot } from './atlas.js';
import { getLibraryItems, renderLibraryProject } from './library.js';
import { setView } from './tools.js';
import { BLOB_47_MASKS, TERRAIN_TILES, describeMask, terrainPixels, terrainSlot } from './terrain.js';
export { BLOB_47_MASKS };

// Cấu hình lát cắt hang động chuẩn theo đặc tả genesis.tileset.preview.v1
export const MAP_PRESET = {
  w: 24,
  h: 16,
  seed: 1701,
  solid_regions: [
    { x: 0, y: 8, w: 24, h: 8 },
    { x: 3, y: 6, w: 18, h: 2 },
    { x: 6, y: 4, w: 12, h: 2 },
    { x: 9, y: 3, w: 6, h: 1 }
  ],
  air_cutouts: [
    { x: 4, y: 9, w: 4, h: 3 },
    { x: 15, y: 9, w: 5, h: 2 },
    { x: 10, y: 6, w: 3, h: 2 },
    { x: 19, y: 12, w: 3, h: 3 }
  ]
};

// Các recipe cố định giúp soi những hình ghép thường gặp mà không phải dựng tay
// lại từ đầu. Chúng dùng cùng resolver autotile với mẫu Natural.
export const MAP_RECIPES = [
  {
    id: 'room', title: 'Phòng vuông', seed: 2301,
    solid_regions: [{ x: 2, y: 3, w: 20, h: 10 }],
    air_cutouts: [{ x: 6, y: 5, w: 12, h: 6 }]
  },
  {
    id: 'l-corridor', title: 'Hành lang chữ L', seed: 2302,
    solid_regions: [
      { x: 2, y: 3, w: 6, h: 11 },
      { x: 2, y: 10, w: 18, h: 4 }
    ],
    air_cutouts: []
  },
  {
    id: 't-corridor', title: 'Hành lang chữ T', seed: 2303,
    solid_regions: [
      { x: 9, y: 2, w: 6, h: 12 },
      { x: 3, y: 8, w: 18, h: 6 }
    ],
    air_cutouts: []
  },
  {
    id: 'platforms', title: 'Bậc / nhánh', seed: 2304,
    solid_regions: [
      { x: 2, y: 12, w: 20, h: 2 },
      { x: 3, y: 8, w: 6, h: 2 },
      { x: 15, y: 6, w: 6, h: 2 },
      { x: 8, y: 3, w: 7, h: 2 }
    ],
    air_cutouts: []
  }
];

// 47 canonical blob autotile bitmasks (N=1, E=2, S=4, W=8, NE=16, SE=32, SW=64, NW=128)

const TOTAL_CELLS = MAP_PRESET.w * MAP_PRESET.h;
let terrainGrid = new Uint8Array(TOTAL_CELLS);
let stampGrid = new Array(TOTAL_CELLS).fill(null);
let coverageSlots = new Int16Array(TOTAL_CELLS);
coverageSlots.fill(-1);
let mapMode = 'natural'; // natural | coverage | recipe
let mapRecipe = 'room';
let activePreset = MAP_PRESET;

const COVERAGE_POSITIONS = Array.from({ length: 56 }, (_, slot) => ({
  slot,
  x: (slot % 8) * 3,
  y: 1 + Math.floor(slot / 8) * 2
}));

let mapZoom = 2;
let mapGridVisible = true;
let mapSource = 'auto'; // 'auto' | 'canvas' | 'atlas'
let mapBg = 'cave';     // 'cave' | 'sky' | 'checker'

// Cọ vẽ & Mẫu ghim
let activeBrush = { type: 'auto' };
let pinnedTile = null;

// Đối chiếu & Snapshot
let snapshotCv = null;
let hasSnapshot = false;
let compareActive = false;
let ghostVisible = false;
let ghostOpacity = 0.4;

// Trạng thái kéo vẽ chuột
let isPainting = false;
let lastPaintedCell = null;
let hoverCell = { gx: -1, gy: -1 };
let selectedMapCell = { gx: -1, gy: -1, slot: -1, mask: 0 };
let paintButton = 0;

function fillPreset(preset) {
  activePreset = preset;
  terrainGrid.fill(0);
  stampGrid.fill(null);
  coverageSlots.fill(-1);
  const W = preset.w;
  preset.solid_regions.forEach(r => {
    for (let y = r.y; y < r.y + r.h; y++) {
      for (let x = r.x; x < r.x + r.w; x++) {
        terrainGrid[y * W + x] = 1;
      }
    }
  });
  preset.air_cutouts.forEach(c => {
    for (let y = c.y; y < c.y + c.h; y++) {
      for (let x = c.x; x < c.x + c.w; x++) {
        terrainGrid[y * W + x] = 0;
      }
    }
  });
}

function buildCoverageBoard() {
  activePreset = MAP_PRESET;
  terrainGrid.fill(0);
  stampGrid.fill(null);
  coverageSlots.fill(-1);
  COVERAGE_POSITIONS.forEach(({ slot, x, y }) => {
    coverageSlots[y * MAP_PRESET.w + x] = slot;
  });
}

function currentRecipe() {
  return MAP_RECIPES.find(recipe => recipe.id === mapRecipe) || MAP_RECIPES[0];
}

function applyMapMode() {
  if (mapMode === 'coverage') buildCoverageBoard();
  else if (mapMode === 'recipe') fillPreset(currentRecipe());
  else fillPreset(MAP_PRESET);
  compareActive = false;
  hasSnapshot = false;
  snapshotCv = null;
  syncMapModeControls();
}

function syncMapModeControls() {
  const mode = $('#mapModeSel');
  const recipe = $('#mapRecipeSel');
  if (mode) mode.value = mapMode;
  if (recipe) {
    recipe.value = mapRecipe;
    recipe.hidden = mapMode !== 'recipe';
  }
}

export function resetMapGrid() {
  applyMapMode();
}
resetMapGrid();

export function clearAllMap() {
  terrainGrid.fill(0);
  stampGrid.fill(null);
  coverageSlots.fill(-1);
  paintMap();
}

function cellMask(x, y) {
  const W = activePreset.w, H = activePreset.h;
  const isSolid = (cx, cy) => {
    if (cx < 0 || cx >= W) return 1; // vách ngoài
    if (cy >= H) return 1;          // đáy sâu
    if (cy < 0) return 0;           // vòm trời
    return terrainGrid[cy * W + cx] ? 1 : 0;
  };

  const N  = isSolid(x, y - 1);
  const E  = isSolid(x + 1, y);
  const S  = isSolid(x, y + 1);
  const W_ = isSolid(x - 1, y);
  const NE = (N && E && isSolid(x + 1, y - 1)) ? 1 : 0;
  const SE = (S && E && isSolid(x + 1, y + 1)) ? 1 : 0;
  const SW = (S && W_ && isSolid(x - 1, y + 1)) ? 1 : 0;
  const NW = (N && W_ && isSolid(x - 1, y - 1)) ? 1 : 0;

  return N * 1 + E * 2 + S * 4 + W_ * 8 + NE * 16 + SE * 32 + SW * 64 + NW * 128;
}


function bresenham(x0, y0, x1, y1, callback) {
  const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  let x = x0, y = y0;
  while (true) {
    callback(x, y);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x += sx; }
    if (e2 < dx) { err += dx; y += sy; }
  }
}

function applyBrushAt(gx, gy, isErase) {
  const W = activePreset.w, H = activePreset.h;
  if (gx < 0 || gx >= W || gy < 0 || gy >= H) return;
  const idx = gy * W + gx;

  if (isErase || activeBrush.type === 'erase') {
    terrainGrid[idx] = 0;
    stampGrid[idx] = null;
  } else if (activeBrush.type === 'auto') {
    terrainGrid[idx] = 1;
    stampGrid[idx] = null;
  } else if (activeBrush.type === 'tile') {
    stampGrid[idx] = activeBrush;
  }
}

function getAtlasSource() {
  const at = getAtlas();
  if (at && at.cv) {
    return { cv: at.cv, name: at.name, tw: at.tw || 16, th: at.th || 16, pad: at.pad || 0, off: at.off || 0 };
  }
  try {
    const raw = localStorage.getItem('lo-pixel-atlas');
    if (raw) {
      const d = JSON.parse(raw);
      if (d && d.png) {
        return { png: d.png, name: d.name, tw: d.tw || 16, th: d.th || 16, pad: d.pad || 0, off: d.off || 0 };
      }
    }
  } catch (_) {}
  return null;
}

function atlasSlotCount(atlasSrc){
  if(!atlasSrc?.cv) return 0;
  const tw=atlasSrc.tw||16,th=atlasSrc.th||16,pad=atlasSrc.pad||0,off=atlasSrc.off||0;
  const cols=Math.max(1,Math.floor((atlasSrc.cv.width-off+pad)/(tw+pad)));
  const rows=Math.max(1,Math.floor((atlasSrc.cv.height-off+pad)/(th+pad)));
  return cols*rows;
}
function selectMapCell(gx,gy){
  const idx=gy*activePreset.w+gx, atlasSrc=getAtlasSource(), total=mapSource==='canvas'?0:atlasSlotCount(atlasSrc);
  const coverageSlot=mapMode==='coverage'?coverageSlots[idx]:-1;
  const solid=mapMode==='coverage'?coverageSlot>=0:!!terrainGrid[idx];
  const mask=mapMode==='coverage'&&coverageSlot>=0
    ? (TERRAIN_TILES[coverageSlot]?.mask ?? 0)
    : cellMask(gx,gy);
  const slot=coverageSlot>=0?coverageSlot:(solid&&total>1?terrainSlot(mask,gx,gy,total,activePreset.seed):-1);
  selectedMapCell={gx,gy,slot,mask};
  const info=$('#mapCellInfo'),edit=$('#mapEditTile');
  if(info) info.textContent=!solid?'Cell '+gx+','+gy+' · rỗng':
    selectedMapCell.slot>=0?'Cell '+gx+','+gy+' · tile #'+String(selectedMapCell.slot).padStart(2,'0')+' · '+TERRAIN_TILES[selectedMapCell.slot]?.title+' · mask '+mask:
    'Cell '+gx+','+gy+' · '+describeMask(mask).title+' · mask '+mask;
  if(edit) edit.disabled=selectedMapCell.slot<0 || !getAtlas();
}
function editSelectedMapTile(){
  if(selectedMapCell.slot<0 || !getAtlas()) return;
  closeMapView();
  if(editAtlasSlot(selectedMapCell.slot)) setView('draw');
}

export function openMapView(forceSource) {
  if (forceSource) {
    mapSource = forceSource;
    const sel = $('#mapSrcSel');
    if (sel) sel.value = forceSource;
  }
  const wrap = $('#mapWrap');
  if (wrap) wrap.hidden = false;

  syncMapModeControls();
  populateTileTray();
  paintMap();
}

export function closeMapView() {
  const wrap = $('#mapWrap');
  if (wrap) wrap.hidden = true;
  compareActive = false;
  isPainting = false;
  hoverCell = { gx: -1, gy: -1 };
}

/* Đổ các tile khả dụng vào khay chọn tile */
export function populateTileTray() {
  const list = $('#mapTileList');
  if (!list) return;
  list.innerHTML = '';

  const createItem = (title, cv, brushData, badgeText) => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'maptile-item';
    item.title = title + ' (Chuột phải để ghim đối chiếu)';

    const thumb = document.createElement('canvas');
    thumb.width = cv.width;
    thumb.height = cv.height;
    thumb.getContext('2d').drawImage(cv, 0, 0);
    item.appendChild(thumb);

    if (badgeText) {
      const b = document.createElement('span');
      b.className = 'badge';
      b.textContent = badgeText;
      item.appendChild(b);
    }

    item.addEventListener('click', () => {
      setBrush({ type: 'tile', ...brushData, title, canvas: thumb });
    });

    item.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      pinTile({ ...brushData, canvas: thumb, title });
    });

    list.appendChild(item);
    return item;
  };

  // 1. Tile từ bản vẽ hiện tại (doc)
  const cvDoc = document.createElement('canvas');
  frameToCanvas(doc.af, cvDoc, 1);
  createItem('Bản vẽ hiện tại (' + doc.w + '×' + doc.h + ')', cvDoc, { src: 'canvas', id: 'current' }, 'Vẽ');

  // 2. Các ô từ Atlas
  const atlasSrc = getAtlasSource();
  if (atlasSrc) {
    const loadAtlasTiles = (im) => {
      const tw = atlasSrc.tw, th = atlasSrc.th;
      const pad = atlasSrc.pad, off = atlasSrc.off;
      const cols = Math.max(1, Math.floor((im.width - off + pad) / (tw + pad)));
      const rows = Math.max(1, Math.floor((im.height - off + pad) / (th + pad)));
      const total = Math.min(56, cols * rows);

      for (let s = 0; s < total; s++) {
        const sc = s % cols, sr = Math.floor(s / cols);
        const sx = off + sc * (tw + pad), sy = off + sr * (th + pad);
        const tileCv = document.createElement('canvas');
        tileCv.width = tw;
        tileCv.height = th;
        const tg = tileCv.getContext('2d');
        tg.imageSmoothingEnabled = false;
        tg.drawImage(im, sx, sy, tw, th, 0, 0, tw, th);

        createItem('Atlas: ' + atlasSrc.name + ' (ô #' + s + ')', tileCv, {
          src: 'atlas',
          slot: s,
          name: atlasSrc.name
        }, '#' + s);
      }
    };

    if (atlasSrc.cv) {
      loadAtlasTiles(atlasSrc.cv);
    } else if (atlasSrc.png) {
      const im = new Image();
      im.onload = () => loadAtlasTiles(im);
      im.src = atlasSrc.png;
    }
  }

  // 3. Các bản vẽ từ Thư viện (Library)
  const libItems = getLibraryItems();
  Object.keys(libItems).forEach(id => {
    const p = libItems[id];
    try {
      const pCv = renderLibraryProject(p);
      if (pCv) {
        createItem('Thư viện: ' + p.name, pCv, { src: 'library', id: id, name: p.name }, p.name.slice(0, 3));
      }
    } catch (_) {}
  });
}

function setBrush(b) {
  activeBrush = b;
  const btnAuto = $('#mapBrushAuto');
  const btnErase = $('#mapBrushErase');
  if (btnAuto) btnAuto.classList.toggle('on', b.type === 'auto');
  if (btnErase) btnErase.classList.toggle('on', b.type === 'erase');

  const items = document.querySelectorAll('#mapTileList .maptile-item');
  items.forEach(el => el.classList.remove('active'));

  if (b.type === 'tile' && b.canvas) {
    items.forEach(el => {
      const img = el.querySelector('canvas');
      if (img && img.toDataURL() === b.canvas.toDataURL()) {
        el.classList.add('active');
      }
    });
  }

  const note = $('#mapStatusNote');
  if (note) {
    if (b.type === 'auto') note.textContent = 'Đang chọn: Cọ Autotile địa hình';
    else if (b.type === 'erase') note.textContent = 'Đang chọn: Cọ Tẩy ô';
    else note.textContent = 'Đang chọn: ' + (b.title || 'Tile vẽ tay');
  }
}

function pinTile(tile) {
  pinnedTile = tile;
  const box = $('#mapPinnedBox');
  const cv = $('#mapPinnedCv');
  if (!box || !cv) return;
  box.hidden = false;
  cv.width = tile.canvas.width;
  cv.height = tile.canvas.height;
  const g = cv.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.clearRect(0, 0, cv.width, cv.height);
  g.drawImage(tile.canvas, 0, 0);

  const note = $('#mapStatusNote');
  if (note) note.textContent = 'Đã ghim mẫu đối chiếu: ' + (tile.title || 'Tile');
}

/* Chụp mẫu bản đồ hiện tại (Snapshot) */
export function takeSnapshot() {
  const cv = $('#mapCv');
  if (!cv) return;

  if (!snapshotCv) snapshotCv = document.createElement('canvas');
  snapshotCv.width = cv.width;
  snapshotCv.height = cv.height;

  // Vẽ bản đồ sạch (không dính lưới hay ghost cursor) sang snapshot
  renderToCanvas(snapshotCv, false);
  hasSnapshot = true;

  const badge = $('#mapSnapBadge');
  if (badge) badge.hidden = false;

  const note = $('#mapStatusNote');
  if (note) note.textContent = '📸 Đã lưu mẫu bản đồ đối chiếu!';
}

/* So sánh A/B nhấp nháy (Flicker compare) */
export function toggleCompare(force) {
  if (!hasSnapshot || !snapshotCv) {
    takeSnapshot();
  }
  compareActive = (typeof force === 'boolean') ? force : !compareActive;
  const btn = $('#mapDiffBtn');
  if (btn) btn.classList.toggle('on', compareActive);
  paintMap();
}

const templateTileCache = new Map();
function templateTileCanvas(slot, tw) {
  const key = slot + ':' + tw;
  if (templateTileCache.has(key)) return templateTileCache.get(key);
  const cv = document.createElement('canvas');
  cv.width = tw;
  cv.height = tw;
  const pixels = terrainPixels(slot, tw);
  const g = cv.getContext('2d');
  const image = g.createImageData(tw, tw);
  new Uint32Array(image.data.buffer).set(pixels);
  g.putImageData(image, 0, 0);
  templateTileCache.set(key, cv);
  return cv;
}

function drawTerrainSlot(g, slot, im, tw, th, pad, off, cols, rows, z, dx, dy) {
  if (slot < 0 || slot >= cols * rows) {
    const fallback = templateTileCanvas(slot, tw);
    g.drawImage(fallback, 0, 0, tw, tw, dx, dy, tw * z, th * z);
    return;
  }
  const sc = slot % cols, sr = Math.floor(slot / cols);
  const sx = off + sc * (tw + pad);
  const sy = off + sr * (th + pad);
  g.drawImage(im, sx, sy, tw, th, dx, dy, tw * z, th * z);
}

function collectMapCoverage(totalSlots) {
  const used = new Set();
  const resolveTotal = Math.max(56, totalSlots || 0);
  for (let gy = 0; gy < activePreset.h; gy++) {
    for (let gx = 0; gx < activePreset.w; gx++) {
      const idx = gy * activePreset.w + gx;
      if (mapMode === 'coverage') {
        if (coverageSlots[idx] >= 0) used.add(coverageSlots[idx]);
      } else if (terrainGrid[idx]) {
        used.add(terrainSlot(cellMask(gx, gy), gx, gy, resolveTotal, activePreset.seed));
      }
      const stamp = stampGrid[idx];
      if (stamp?.src === 'atlas' && Number.isInteger(stamp.slot)) used.add(stamp.slot);
    }
  }
  return used;
}

function updateMapCoverage(totalSlots) {
  const el = $('#mapCoverage');
  if (!el) return;
  const used = collectMapCoverage(totalSlots);
  if (mapMode === 'coverage') el.textContent = 'Coverage ' + used.size + '/56 · bảng kiểm slot';
  else if (mapMode === 'recipe') el.textContent = 'Recipe · ' + used.size + '/56 tile';
  else el.textContent = 'Natural · ' + used.size + '/56 tile';
  el.title = 'Số slot terrain 56 đang xuất hiện trong preview này';
}

/* Dựng bản đồ ra một canvas đích */
function renderToCanvas(targetCv, includeOverlays, atlasImage) {
  const g = targetCv.getContext('2d');
  const atlasSrc = getAtlasSource();

  const hasAt = !!atlasSrc && (!!atlasSrc.cv || !!atlasSrc.png);
  const useAtlas = (mapSource === 'atlas' && hasAt) || (mapSource === 'auto' && hasAt);

  let tw = 16, th = 16, pad = 0, off = 0;
  const canvasTile = document.createElement('canvas');
  frameToCanvas(doc.af, canvasTile, 1);

  if (useAtlas) {
    tw = atlasSrc.tw || 16;
    th = atlasSrc.th || 16;
    pad = atlasSrc.pad || 0;
    off = atlasSrc.off || 0;
  } else {
    tw = doc.w;
    th = doc.h;
  }

  const GW = activePreset.w, GH = activePreset.h;
  const pxW = GW * tw, pxH = GH * th;
  const z = mapZoom;

  targetCv.width = pxW * z;
  targetCv.height = pxH * z;
  g.imageSmoothingEnabled = false;

  // 1. Nền
  if (mapBg === 'sky') {
    const grad = g.createLinearGradient(0, 0, 0, targetCv.height);
    grad.addColorStop(0, '#2c488f');
    grad.addColorStop(0.6, '#53accc');
    grad.addColorStop(1, '#cdf1f4');
    g.fillStyle = grad;
    g.fillRect(0, 0, targetCv.width, targetCv.height);
  } else if (mapBg === 'cave') {
    g.fillStyle = '#0d171f';
    g.fillRect(0, 0, targetCv.width, targetCv.height);
  } else {
    g.clearRect(0, 0, targetCv.width, targetCv.height);
  }

  // 2. Lớp Địa hình (Terrain) - resolver 47 topology + 9 biến thể = 56 slot
  const im = atlasImage || (atlasSrc && atlasSrc.cv) || null;
  const cols = im ? Math.max(1, Math.floor((im.width - off + pad) / (tw + pad))) : 1;
  const rows = im ? Math.max(1, Math.floor((im.height - off + pad) / (th + pad))) : 1;
  const totalSlots = cols * rows;

  if (mapMode === 'coverage') {
    for (let gy = 0; gy < GH; gy++) {
      for (let gx = 0; gx < GW; gx++) {
        const slot = coverageSlots[gy * GW + gx];
        if (slot < 0) continue;
        const dx = gx * tw * z, dy = gy * th * z;
        if (useAtlas && im && totalSlots > 1) drawTerrainSlot(g, slot, im, tw, th, pad, off, cols, rows, z, dx, dy);
        else {
          const fallback = templateTileCanvas(slot, tw);
          g.drawImage(fallback, 0, 0, tw, tw, dx, dy, tw * z, th * z);
        }
        if (includeOverlays) {
          g.fillStyle = 'rgba(0,0,0,.72)';
          g.fillRect(dx, dy + th * z - 12, 24, 12);
          g.fillStyle = '#fff';
          g.font = 'bold 9px ui-monospace, monospace';
          g.fillText('#' + String(slot).padStart(2, '0'), dx + 2, dy + th * z - 3);
        }
      }
    }
  } else {
    for (let gy = 0; gy < GH; gy++) {
      for (let gx = 0; gx < GW; gx++) {
        const idx = gy * GW + gx;
        if (!terrainGrid[idx]) continue;

        const mask = cellMask(gx, gy);
        const slot = terrainSlot(mask, gx, gy, totalSlots, activePreset.seed);
        const dx = gx * tw * z, dy = gy * th * z;

        if (useAtlas && im && totalSlots > 1) {
          if (slot < 0) continue; // thiếu topology: để hở, không lấy nhầm ô bằng modulo
          drawTerrainSlot(g, slot, im, tw, th, pad, off, cols, rows, z, dx, dy);
        } else {
          g.drawImage(canvasTile, 0, 0, canvasTile.width, canvasTile.height, dx, dy, tw * z, th * z);
        }
      }
    }
  }

  // 3. Lớp Tile vẽ tay (Manual Stamps)
  for (let gy = 0; gy < GH; gy++) {
    for (let gx = 0; gx < GW; gx++) {
      const idx = gy * GW + gx;
      const stamp = stampGrid[idx];
      if (!stamp || !stamp.canvas) continue;

      const dx = gx * tw * z, dy = gy * th * z;
      g.drawImage(stamp.canvas, 0, 0, stamp.canvas.width, stamp.canvas.height, dx, dy, tw * z, th * z);
    }
  }

  if (!includeOverlays) return;

  // 4. Lớp Bóng ma đối chiếu (Ghost overlay)
  if (ghostVisible && hasSnapshot && snapshotCv && ghostOpacity > 0) {
    g.save();
    g.globalAlpha = ghostOpacity;
    g.drawImage(snapshotCv, 0, 0, targetCv.width, targetCv.height);
    g.restore();
  }

  // 5. Lưới ô
  if (mapGridVisible) {
    g.strokeStyle = 'rgba(255,255,255,0.18)';
    g.lineWidth = 1;
    g.beginPath();
    for (let x = 0; x <= GW; x++) {
      const px = Math.round(x * tw * z) + 0.5;
      g.moveTo(px, 0); g.lineTo(px, targetCv.height);
    }
    for (let y = 0; y <= GH; y++) {
      const py = Math.round(y * th * z) + 0.5;
      g.moveTo(0, py); g.lineTo(targetCv.width, py);
    }
    g.stroke();
  }

  // 6. Con trỏ xem trước (Hover preview)
  if (hoverCell.gx >= 0 && hoverCell.gx < GW && hoverCell.gy >= 0 && hoverCell.gy < GH && !compareActive) {
    const hx = hoverCell.gx * tw * z, hy = hoverCell.gy * th * z;
    g.save();
    if (activeBrush.type === 'tile' && activeBrush.canvas) {
      g.globalAlpha = 0.6;
      g.drawImage(activeBrush.canvas, 0, 0, activeBrush.canvas.width, activeBrush.canvas.height, hx, hy, tw * z, th * z);
    }
    g.strokeStyle = activeBrush.type === 'erase' ? 'rgba(255, 70, 70, 0.85)' : 'rgba(255, 204, 0, 0.85)';
    g.lineWidth = 2;
    g.strokeRect(hx + 1, hy + 1, tw * z - 2, th * z - 2);
    g.restore();
  }

  // Cập nhật thông số hiển thị
  const info = $('#mapInfo');
  if (info) {
    const srcText = useAtlas ? ('Atlas: ' + (atlasSrc ? atlasSrc.name : '')) : ('Bản vẽ: ' + doc.w + '×' + doc.h);
    const modeText = mapMode === 'coverage' ? 'Coverage 56' : mapMode === 'recipe' ? 'Recipe: ' + currentRecipe().title : 'Natural';
    info.textContent = modeText + ' · ' + GW + '×' + GH + ' ô (' + pxW + '×' + pxH + ' px) · Tile ' + tw + '×' + th + ' · ' + srcText;
  }
  updateMapCoverage(totalSlots);
}

export function paintMap() {
  const cv = $('#mapCv');
  if (!cv) return;

  // Nếu đang bật chế độ soi mẫu cũ (Flicker compare)
  if (compareActive && snapshotCv) {
    cv.width = snapshotCv.width;
    cv.height = snapshotCv.height;
    const g = cv.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.drawImage(snapshotCv, 0, 0);

    // Tag thông báo đang soi mẫu
    g.fillStyle = 'rgba(235, 172, 53, 0.9)';
    g.font = 'bold 12px ui-monospace, monospace';
    g.fillText('👁 ĐANG SOI MẪU CŨ (FLICKER)', 10, 20);
    return;
  }

  const atlasSrc = getAtlasSource();
  if (atlasSrc && atlasSrc.png && !atlasSrc.cv) {
    const im = new Image();
    im.onload = () => renderToCanvas(cv, true, im);
    im.onerror = () => renderToCanvas(cv, true, null);
    im.src = atlasSrc.png;
  } else {
    renderToCanvas(cv, true, atlasSrc ? atlasSrc.cv : null);
  }
}

export function exportMapPng() {
  const cleanCv = document.createElement('canvas');
  renderToCanvas(cleanCv, false);
  download('map_preview_24x16.png', cleanCv.toDataURL('image/png'));
}

/* Tương tác chuột / cảm ứng kéo rê trên bản đồ */
function getCellFromPointer(ev, cv) {
  const b = cv.getBoundingClientRect();
  const GW = activePreset.w, GH = activePreset.h;
  const cellW = b.width / GW;
  const cellH = b.height / GH;
  const gx = Math.floor((ev.clientX - b.left) / cellW);
  const gy = Math.floor((ev.clientY - b.top) / cellH);
  return { gx, gy };
}

function onPointerDown(ev) {
  const cv = $('#mapCv');
  if (!cv || compareActive) return;
  cv.setPointerCapture(ev.pointerId);

  isPainting = true;
  paintButton = ev.button; // 0 = left, 2 = right
  const isRight = ev.button === 2;

  const { gx, gy } = getCellFromPointer(ev, cv);
  const W = activePreset.w, H = activePreset.h;
  if (gx >= 0 && gx < W && gy >= 0 && gy < H) {
    selectMapCell(gx,gy);
    if (mapMode === 'coverage') {
      isPainting = false;
      lastPaintedCell = null;
      paintMap();
      return;
    }
    const idx = gy * W + gx;
    if (!isRight && activeBrush.type === 'auto' && terrainGrid[idx] === 1 && !stampGrid[idx]) {
      terrainGrid[idx] = 0;
    } else {
      applyBrushAt(gx, gy, isRight);
    }
    lastPaintedCell = { gx, gy };
    paintMap();
    selectMapCell(gx,gy);
  }
}

function onPointerMove(ev) {
  const cv = $('#mapCv');
  if (!cv) return;

  const { gx, gy } = getCellFromPointer(ev, cv);
  hoverCell = { gx, gy };

  if (isPainting && !compareActive && mapMode !== 'coverage') {
    const isRight = paintButton === 2;
    if (lastPaintedCell && (lastPaintedCell.gx !== gx || lastPaintedCell.gy !== gy)) {
      bresenham(lastPaintedCell.gx, lastPaintedCell.gy, gx, gy, (bx, by) => {
        applyBrushAt(bx, by, isRight);
      });
      lastPaintedCell = { gx, gy };
    } else {
      applyBrushAt(gx, gy, isRight);
      lastPaintedCell = { gx, gy };
    }
  }

  paintMap();
}

function onPointerUp(ev) {
  const cv = $('#mapCv');
  if (!cv) return;
  try { cv.releasePointerCapture(ev.pointerId); } catch (_) {}
  isPainting = false;
  lastPaintedCell = null;
  paintMap();
}

function onPointerLeave() {
  hoverCell = { gx: -1, gy: -1 };
  if (!isPainting) paintMap();
}

export function bindMapView() {
  const cv = $('#mapCv');
  if (cv) {
    cv.addEventListener('pointerdown', onPointerDown);
    cv.addEventListener('pointermove', onPointerMove);
    cv.addEventListener('pointerup', onPointerUp);
    cv.addEventListener('pointercancel', onPointerUp);
    cv.addEventListener('pointerleave', onPointerLeave);
    cv.addEventListener('contextmenu', e => e.preventDefault());
  }

  $('#mapClose').addEventListener('click', closeMapView);
  $('#mapEditTile').addEventListener('click', editSelectedMapTile);
  $('#mapReset').addEventListener('click', () => { resetMapGrid(); paintMap(); });
  $('#mapClearAll').addEventListener('click', clearAllMap);
  $('#mapPng').addEventListener('click', exportMapPng);

  $('#mapZoomIn').addEventListener('click', () => {
    mapZoom = Math.min(6, mapZoom + 1);
    $('#mapZoomLbl').textContent = '×' + mapZoom;
    paintMap();
  });
  $('#mapZoomOut').addEventListener('click', () => {
    mapZoom = Math.max(1, mapZoom - 1);
    $('#mapZoomLbl').textContent = '×' + mapZoom;
    paintMap();
  });

  $('#mapGridBtn').addEventListener('click', e => {
    mapGridVisible = !mapGridVisible;
    e.currentTarget.classList.toggle('on', mapGridVisible);
    paintMap();
  });

  $('#mapBgSel').addEventListener('change', e => {
    mapBg = e.target.value;
    paintMap();
  });

  $('#mapModeSel').addEventListener('change', e => {
    mapMode = e.target.value;
    applyMapMode();
    paintMap();
  });

  $('#mapRecipeSel').addEventListener('change', e => {
    mapRecipe = e.target.value;
    if (mapMode === 'recipe') {
      applyMapMode();
      paintMap();
    }
  });

  $('#mapSrcSel').addEventListener('change', e => {
    mapSource = e.target.value;
    populateTileTray();
    paintMap();
  });

  // Nút công cụ cọ
  $('#mapBrushAuto').addEventListener('click', () => setBrush({ type: 'auto' }));
  $('#mapBrushErase').addEventListener('click', () => setBrush({ type: 'erase' }));

  // Cụm đối chiếu & Snapshot
  $('#mapSnapBtn').addEventListener('click', takeSnapshot);

  const btnDiff = $('#mapDiffBtn');
  btnDiff.addEventListener('click', () => toggleCompare());
  btnDiff.addEventListener('pointerdown', () => toggleCompare(true));
  btnDiff.addEventListener('pointerup', () => toggleCompare(false));

  const btnGhost = $('#mapGhostBtn');
  btnGhost.addEventListener('click', e => {
    if (!hasSnapshot) takeSnapshot();
    ghostVisible = !ghostVisible;
    e.currentTarget.classList.toggle('on', ghostVisible);
    paintMap();
  });

  const rangeGhost = $('#mapGhostRange');
  rangeGhost.addEventListener('input', e => {
    ghostOpacity = +e.target.value / 100;
    $('#mapGhostLbl').textContent = e.target.value + '%';
    if (ghostVisible) paintMap();
  });

  // Phím Space để chớp mắt soi mẫu cũ khi cửa sổ mapview đang mở
  window.addEventListener('keydown', e => {
    const mw = $('#mapWrap');
    if (!mw || mw.hidden) return;
    if (e.code === 'Space' && !e.repeat && hasSnapshot && !e.target.matches('input,select,textarea')) {
      e.preventDefault();
      toggleCompare(true);
    }
  });

  window.addEventListener('keyup', e => {
    const mw = $('#mapWrap');
    if (!mw || mw.hidden) return;
    if (e.code === 'Space' && hasSnapshot && !e.target.matches('input,select,textarea')) {
      e.preventDefault();
      toggleCompare(false);
    }
  });
}
