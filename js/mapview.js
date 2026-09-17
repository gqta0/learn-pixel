/* Cửa sổ xem trước bản đồ (Map Preview):
   Dựng một lát cắt hang động chuẩn 24×16 ô theo đúng đặc tả genesis.tileset.preview.v1
   để kiểm tra khớp nối (seams), tính lặp lại (repetition), autotile 47/56 ô và độ dễ nhìn
   của tile khi ghép vào màn chơi game thật. */

import { $ } from './dom.js';
import { doc, view } from './state.js';
import { frameToCanvas } from './raster.js';
import { download } from './storage.js';

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

let mapGrid = new Uint8Array(MAP_PRESET.w * MAP_PRESET.h);
let mapZoom = 2;
let mapGridVisible = true;
let mapSource = 'auto'; // 'auto' | 'canvas' | 'atlas'
let mapBg = 'cave';     // 'cave' | 'sky' | 'checker'

export function resetMapGrid() {
  mapGrid.fill(0);
  const W = MAP_PRESET.w;
  MAP_PRESET.solid_regions.forEach(r => {
    for (let y = r.y; y < r.y + r.h; y++) {
      for (let x = r.x; x < r.x + r.w; x++) {
        mapGrid[y * W + x] = 1;
      }
    }
  });
  MAP_PRESET.air_cutouts.forEach(c => {
    for (let y = c.y; y < c.y + c.h; y++) {
      for (let x = c.x; x < c.x + c.w; x++) {
        mapGrid[y * W + x] = 0;
      }
    }
  });
}
resetMapGrid();

function cellMask(x, y) {
  const W = MAP_PRESET.w, H = MAP_PRESET.h;
  const isSolid = (cx, cy) => {
    if (cx < 0 || cx >= W) return 1; // vách ngoài
    if (cy >= H) return 1;          // đáy sâu
    if (cy < 0) return 0;           // vòm trời
    return mapGrid[cy * W + cx] ? 1 : 0;
  };

  const N = isSolid(x, y - 1);
  const E = isSolid(x + 1, y);
  const S = isSolid(x, y + 1);
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

export function openMapView(forceSource) {
  if (forceSource) {
    mapSource = forceSource;
    const sel = $('#mapSrcSel');
    if (sel) sel.value = forceSource;
  }
  const wrap = $('#mapWrap');
  if (wrap) wrap.hidden = false;
  paintMap();
}

export function closeMapView() {
  const wrap = $('#mapWrap');
  if (wrap) wrap.hidden = true;
}

export function paintMap() {
  const cv = $('#mapCv');
  if (!cv) return;
  const g = cv.getContext('2d');

  // Đọc atlas nếu có
  let atlasData = null;
  try {
    const raw = localStorage.getItem('lo-pixel-atlas');
    if (raw) atlasData = JSON.parse(raw);
  } catch (_) {}

  // Xác định nguồn tile
  const hasAt = !!atlasData && !!atlasData.png;
  const useAtlas = (mapSource === 'atlas' && hasAt) || (mapSource === 'auto' && hasAt);

  let tw = 16, th = 16, pad = 0, off = 0;
  const canvasTile = document.createElement('canvas');
  frameToCanvas(doc.af, canvasTile, 1);

  if (useAtlas) {
    tw = atlasData.tw || 16;
    th = atlasData.th || 16;
    pad = atlasData.pad || 0;
    off = atlasData.off || 0;
  } else {
    tw = doc.w;
    th = doc.h;
  }

  const GW = MAP_PRESET.w, GH = MAP_PRESET.h;
  const pxW = GW * tw, pxH = GH * th;
  const z = mapZoom;

  cv.width = pxW * z;
  cv.height = pxH * z;
  g.imageSmoothingEnabled = false;

  // Vẽ nền
  if (mapBg === 'sky') {
    const grad = g.createLinearGradient(0, 0, 0, cv.height);
    grad.addColorStop(0, '#2c488f');
    grad.addColorStop(0.6, '#53accc');
    grad.addColorStop(1, '#cdf1f4');
    g.fillStyle = grad;
    g.fillRect(0, 0, cv.width, cv.height);
  } else if (mapBg === 'cave') {
    g.fillStyle = '#0d171f'; // ink-950
    g.fillRect(0, 0, cv.width, cv.height);
  } else {
    g.clearRect(0, 0, cv.width, cv.height);
  }

  // Hàm phụ vẽ từng ô lên bản đồ
  const drawTileCell = (im) => {
    const cols = im ? Math.max(1, Math.floor((im.width - off + pad) / (tw + pad))) : 1;
    const rows = im ? Math.max(1, Math.floor((im.height - off + pad) / (th + pad))) : 1;
    const totalSlots = cols * rows;

    for (let gy = 0; gy < GH; gy++) {
      for (let gx = 0; gx < GW; gx++) {
        if (!mapGrid[gy * GW + gx]) continue; // Không khí

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
          // Dùng tile từ bản vẽ hiện tại
          g.drawImage(canvasTile, 0, 0, canvasTile.width, canvasTile.height, dx, dy, tw * z, th * z);
        }
      }
    }

    // Vẽ lưới ô nếu bật
    if (mapGridVisible) {
      g.strokeStyle = 'rgba(255,255,255,0.18)';
      g.lineWidth = 1;
      g.beginPath();
      for (let x = 0; x <= GW; x++) {
        const px = Math.round(x * tw * z) + 0.5;
        g.moveTo(px, 0); g.lineTo(px, cv.height);
      }
      for (let y = 0; y <= GH; y++) {
        const py = Math.round(y * th * z) + 0.5;
        g.moveTo(0, py); g.lineTo(cv.width, py);
      }
      g.stroke();
    }

    // Cập nhật thông số hiển thị
    const info = $('#mapInfo');
    if (info) {
      const srcText = useAtlas ? ('Atlas: ' + atlasData.name) : ('Bản vẽ: ' + doc.w + '×' + doc.h);
      info.textContent = GW + '×' + GH + ' ô (' + pxW + '×' + pxH + ' px) · Tile ' + tw + '×' + th + ' · ' + srcText;
    }
  };

  if (useAtlas) {
    const im = new Image();
    im.onload = () => drawTileCell(im);
    im.onerror = () => drawTileCell(null);
    im.src = atlasData.png;
  } else {
    drawTileCell(null);
  }
}

// Bấm chuột để đục hang hoặc đặt thêm đất/khối trực tiếp trên map
function onMapClick(ev) {
  const cv = $('#mapCv');
  if (!cv) return;
  const b = cv.getBoundingClientRect();
  const GW = MAP_PRESET.w, GH = MAP_PRESET.h;
  const cellW = b.width / GW;
  const cellH = b.height / GH;
  const gx = Math.floor((ev.clientX - b.left) / cellW);
  const gy = Math.floor((ev.clientY - b.top) / cellH);
  if (gx < 0 || gx >= GW || gy < 0 || gy >= GH) return;

  mapGrid[gy * GW + gx] = mapGrid[gy * GW + gx] ? 0 : 1;
  paintMap();
}

export function exportMapPng() {
  const cv = $('#mapCv');
  if (!cv) return;
  download('map_preview_24x16.png', cv.toDataURL('image/png'));
}

export function bindMapView() {
  const cv = $('#mapCv');
  if (cv) {
    cv.addEventListener('click', onMapClick);
  }
  const btnClose = $('#mapClose');
  if (btnClose) btnClose.addEventListener('click', closeMapView);

  const btnReset = $('#mapReset');
  if (btnReset) btnReset.addEventListener('click', () => { resetMapGrid(); paintMap(); });

  const btnPng = $('#mapPng');
  if (btnPng) btnPng.addEventListener('click', exportMapPng);

  const btnZoomIn = $('#mapZoomIn');
  if (btnZoomIn) btnZoomIn.addEventListener('click', () => {
    mapZoom = Math.min(6, mapZoom + 1);
    const lbl = $('#mapZoomLbl');
    if (lbl) lbl.textContent = '×' + mapZoom;
    paintMap();
  });

  const btnZoomOut = $('#mapZoomOut');
  if (btnZoomOut) btnZoomOut.addEventListener('click', () => {
    mapZoom = Math.max(1, mapZoom - 1);
    const lbl = $('#mapZoomLbl');
    if (lbl) lbl.textContent = '×' + mapZoom;
    paintMap();
  });

  const btnGrid = $('#mapGridBtn');
  if (btnGrid) btnGrid.addEventListener('click', e => {
    mapGridVisible = !mapGridVisible;
    e.currentTarget.classList.toggle('on', mapGridVisible);
    paintMap();
  });

  const selBg = $('#mapBgSel');
  if (selBg) selBg.addEventListener('change', e => {
    mapBg = e.target.value;
    paintMap();
  });

  const selSrc = $('#mapSrcSel');
  if (selSrc) selSrc.addEventListener('change', e => {
    mapSource = e.target.value;
    paintMap();
  });
}
