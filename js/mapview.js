/* Cửa sổ xem trước bản đồ (Map Preview):
   Dựng một lát cắt hang động chuẩn 24×16 ô theo đúng đặc tả genesis.tileset.preview.v1
   để kiểm tra khớp nối (seams), tính lặp lại (repetition), autotile 47/56 ô và độ dễ nhìn
   của tile khi ghép vào màn chơi game thật. */

import { $ } from './dom.js';
import { doc } from './state.js';
import { frameToCanvas } from './raster.js';
import { download } from './storage.js';
import { getAtlas } from './atlas.js';
import { getLibraryItems, renderLibraryProject } from './library.js';

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

// 47 canonical blob autotile bitmasks (N=1, E=2, S=4, W=8, NE=16, SE=32, SW=64, NW=128)
export const BLOB_47_MASKS = [];
for (let m = 0; m < 256; m++) {
  const N = (m & 1) ? 1 : 0, E = (m & 2) ? 1 : 0, S = (m & 4) ? 1 : 0, W = (m & 8) ? 1 : 0;
  const NE = (m & 16) ? 1 : 0, SE = (m & 32) ? 1 : 0, SW = (m & 64) ? 1 : 0, NW = (m & 128) ? 1 : 0;
  if (NE && (!N || !E)) continue;
  if (SE && (!S || !E)) continue;
  if (SW && (!S || !W)) continue;
  if (NW && (!N || !W)) continue;
  BLOB_47_MASKS.push(m);
}

const TOTAL_CELLS = MAP_PRESET.w * MAP_PRESET.h;
let terrainGrid = new Uint8Array(TOTAL_CELLS);
let stampGrid = new Array(TOTAL_CELLS).fill(null);

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
let paintButton = 0;

export function resetMapGrid() {
  terrainGrid.fill(0);
  stampGrid.fill(null);
  const W = MAP_PRESET.w;
  MAP_PRESET.solid_regions.forEach(r => {
    for (let y = r.y; y < r.y + r.h; y++) {
      for (let x = r.x; x < r.x + r.w; x++) {
        terrainGrid[y * W + x] = 1;
      }
    }
  });
  MAP_PRESET.air_cutouts.forEach(c => {
    for (let y = c.y; y < c.y + c.h; y++) {
      for (let x = c.x; x < c.x + c.w; x++) {
        terrainGrid[y * W + x] = 0;
      }
    }
  });
}
resetMapGrid();

export function clearAllMap() {
  terrainGrid.fill(0);
  stampGrid.fill(null);
  paintMap();
}

function cellMask(x, y) {
  const W = MAP_PRESET.w, H = MAP_PRESET.h;
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

function getSlot(mask, x, y) {
  let idx = BLOB_47_MASKS.indexOf(mask);
  if (idx === -1) idx = 46;
  if (mask === 255) {
    // Center variants slot 47..51
    const r = ((MAP_PRESET.seed + x * 374761393 + y * 668265263) >>> 0) % 5;
    return 47 + r;
  }
  return idx;
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
  const W = MAP_PRESET.w, H = MAP_PRESET.h;
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

export function openMapView(forceSource) {
  if (forceSource) {
    mapSource = forceSource;
    const sel = $('#mapSrcSel');
    if (sel) sel.value = forceSource;
  }
  const wrap = $('#mapWrap');
  if (wrap) wrap.hidden = false;

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

  const GW = MAP_PRESET.w, GH = MAP_PRESET.h;
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

  // 2. Lớp Địa hình (Terrain) - autotile 47 ô
  const im = atlasImage || (atlasSrc && atlasSrc.cv) || null;
  const cols = im ? Math.max(1, Math.floor((im.width - off + pad) / (tw + pad))) : 1;
  const rows = im ? Math.max(1, Math.floor((im.height - off + pad) / (th + pad))) : 1;
  const totalSlots = cols * rows;

  for (let gy = 0; gy < GH; gy++) {
    for (let gx = 0; gx < GW; gx++) {
      const idx = gy * GW + gx;
      if (!terrainGrid[idx]) continue;

      const mask = cellMask(gx, gy);
      const slot = getSlot(mask, gx, gy);
      const dx = gx * tw * z, dy = gy * th * z;

      if (useAtlas && im && totalSlots > 1) {
        const s = slot % totalSlots;
        const sc = s % cols, sr = Math.floor(s / cols);
        const sx = off + sc * (tw + pad);
        const sy = off + sr * (th + pad);
        g.drawImage(im, sx, sy, tw, th, dx, dy, tw * z, th * z);
      } else {
        g.drawImage(canvasTile, 0, 0, canvasTile.width, canvasTile.height, dx, dy, tw * z, th * z);
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
    info.textContent = GW + '×' + GH + ' ô (' + pxW + '×' + pxH + ' px) · Tile ' + tw + '×' + th + ' · ' + srcText;
  }
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
  const GW = MAP_PRESET.w, GH = MAP_PRESET.h;
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
  const W = MAP_PRESET.w, H = MAP_PRESET.h;
  if (gx >= 0 && gx < W && gy >= 0 && gy < H) {
    const idx = gy * W + gx;
    if (!isRight && activeBrush.type === 'auto' && terrainGrid[idx] === 1 && !stampGrid[idx]) {
      terrainGrid[idx] = 0;
    } else {
      applyBrushAt(gx, gy, isRight);
    }
    lastPaintedCell = { gx, gy };
    paintMap();
  }
}

function onPointerMove(ev) {
  const cv = $('#mapCv');
  if (!cv) return;

  const { gx, gy } = getCellFromPointer(ev, cv);
  hoverCell = { gx, gy };

  if (isPainting && !compareActive) {
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
