# Terrain → Trang Tile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every terrain-making feature of the Vẽ page's "Terrain 56" workbench lives in `tile.html` (Trang Tile); the workbench is then removed from `index.html`.

**Architecture:** `tile.html` already edits tilesets (`js/tileset.js` model, `js/layouts.js` layouts, `js/tilepage.js` UI). Blob56 slots are exactly the Terrain 56 slots (`TERRAIN_TILES[i].slot`), so the pure functions of `js/terrain.js` and `js/tilegen.js` work on `slotPixels(ts)` (array of 56 `Uint32Array`, frame 0). New tile-page features go in focused modules that talk to `tilepage.js` through a small **host** object instead of growing `tilepage.js`. Pure helpers that tests need move out of DOM files.

**Tech Stack:** vanilla ES modules, no build, no dependency; tests `node --test tests/*.mjs tests/editor.cjs`; Playwright (pre-installed) for browser checks, serving files via `page.route` (no local server).

**Spec:** user request (2026-11-18, chat): "Đưa các chức năng tạo terrain qua hoàn toàn page mới" + agreed default: port every workbench feature except "Trải 56 ô thành 56 frame", keep old data openable, remove the workbench from the Vẽ page. Feature inventory: section *Inventory* below.

## Global Constraints

- Vietnamese UI copy, same tone as existing pages; no new dependency, no build step.
- `localStorage['lo-pixel-atlas']` is never deleted or rewritten by the new code (old atlases stay importable).
- `js/terrain.js` and `js/tilegen.js` stay pure (no DOM); their exported behaviour does not change.
- Tile page works at 375×812 (touch targets ≥ 44 px on phones, as `css/tile.css` already does).
- Every task ends with all test files passing: `for t in tests/*.mjs tests/editor.cjs; do node --test $t; done`.
- Commit per task on branch `claude/ghep-roi-function-issue-tly4dw`, message ending with the session's Co-Authored-By / Claude-Session lines.

## Inventory (Vẽ page → Trang Tile)

| Feature | Today in tile.html | Task |
|---|---|---|
| Open terrain56 project / pack `.json`; legacy 8×7 atlas (layout 1/2) | no / refused | 1, 2 |
| Create set with Nền/Cạnh colours from Master or Genesis + presets | Genesis family seed only | 3 |
| Pixel guide 3 modes (viền nét / phủ mờ / tắt, H), connector lock 🔒 | on/off only, no lock | 4 |
| Seam check alpha / colour / both, issue list, ◎ next issue, badge | live red marks only | 5 |
| 13-core mode: ⚙ Ghép 34 ô, ⧉ Biến thể ← ô gốc | no | 5 |
| Detail: recipe, legend, tiles that connect, pair preview | role name only | 6 |
| Exports: clean atlas PNG, annotated PNG, Godot mapping JSON, JSON layout, pack, project JSON | Godot ZIP, PNG, tileset json | 7 |
| ⚡ Tạo nhanh (recipes, strata, sliders, preview map, lint, scope / keep edited / lock, apply, decor.png, 6-layer ZIP) | no | 8 |
| Dropped on purpose: 56-frame linking (`doc.terrainLink`), Vẽ-page draw toolbar | — | 9 removes |
| `mapview.js` Soi map on the Vẽ page | stays (also used by non-terrain buttons) | 9 keeps |

## Review Focus

- Old `terrain56-project.json` with an 8×7 (layout 1/2) PNG opened in tile.html → becomes a correct 10×7 blob56 set (slot pixels identical to the source cells). Test in Task 1.
- `importTerrain56` with a legacy 8×7 `lo-pixel-atlas` → imports instead of telling the user to open the Vẽ page. Test in Task 1 (pure converter) + Task 2 browser check.
- Terrain-only tools on a non-blob56 set (sides16, corners16, free) → hidden or disabled with a note, never throw. Covered by each task's browser step.
- ⚡ apply on a set that was hand-drawn (no stamp for this tileset id) → asks before overwriting; locked / hand-edited slots are kept. Test in Task 8 (pure `planApply`).
- Vẽ page after removal: a saved project or library item that still carries `terrainLink` loads without error and the bottom-nav entry leads to tile.html. Test in Task 9.

---

### Task 1: Pure terrain I/O helpers

**Files:**
- Create: `js/terrainio.js`, `tests/terrainio.mjs`
- Modify: `tests/palette.mjs:47-49`, `tests/genesis.mjs:74-82` (read from the new module instead of slicing `terrainview.js`)

**Interfaces:**
- Produces (all pure, no DOM):
  - `slotPixels(ts, frame=0): Uint32Array[]` — 56 entries for blob56 (index = slot), via `frameAt`.
  - `TERRAIN_CREATE_PRESETS` — moved verbatim from `js/terrainview.js:53` (terrainview imports it from here until Task 9).
  - `toolPaletteKey(paletteName, masterName): 'master'|'genesis'` — same rule as `terrainview.js:49`, made pure (arguments instead of globals); terrainview keeps a wrapper until Task 9.
  - `legacySheetTo10x7({w,h,data}, layoutVersion, size): {w,h,data}` — port of `atlas.js` `migrateTerrainLayout` (layout 1/2 = 8×7 with `legacyTerrainCell(slot)`), output arranged with `terrainSlotCells(slot)` (copies included).
  - `parseTerrainFile(obj): {name, size, shape, layout, png}` — accepts `lo-pixel-terrain56-project.v1` and `lo-pixel-terrain56-pack.v1` (read the writers `exportTerrainProject` / `exportPack` in `js/terrainview.js:664-690` for field names); throws `Error('không phải dự án Terrain 56')` otherwise.
  - `terrainProjectJson(ts, pngDataUrl)` / `terrainPackJson(ts, pngDataUrl)` — objects that `parseTerrainFile` reads back and that the old Vẽ page reader (`importTerrainProject`) would also accept.
  - `cleanSheet({w,h,data}): {w,h,data}` — pure port of `cleanTerrainCanvas` (`terrainview.js:623`).

- [ ] **Step 1: Write failing tests** in `tests/terrainio.mjs`:
  - `slotPixels` of a blob56 set returns 56 arrays, entry 46 is `frameAt(ts,46,0)`.
  - `legacySheetTo10x7`: build an 8×7 sheet where cell (c,r) of slot s is filled with colour `s+1`; after conversion, `fromSheet(result,{layout:'blob56',size})` gives every slot filled with `s+1`.
  - `parseTerrainFile(terrainProjectJson(ts,url))` and the pack variant round-trip `{size, shape, png:url}`; `parseTerrainFile({})` throws.
  - `cleanSheet` matches the behaviour of `cleanTerrainCanvas` on a tiny hand-made sheet (read that function to pick the assertion).
  - `toolPaletteKey(MASTER_NAME, MASTER_NAME)==='master'`, any other name → `'genesis'` (same cases `tests/genesis.mjs:74-82` checks today).
- [ ] **Step 2:** run `node --test tests/terrainio.mjs` → FAIL (module missing).
- [ ] **Step 3:** implement `js/terrainio.js`; make `terrainview.js` import `TERRAIN_CREATE_PRESETS` and use `toolPaletteKey` from it; point `tests/palette.mjs` and `tests/genesis.mjs` at the new module.
- [ ] **Step 4:** run every test file → PASS.
- [ ] **Step 5:** commit `feat(tile): pure terrain I/O helpers (legacy atlas, project/pack files, clean sheet)`.

### Task 2: Open old terrain data in Trang Tile

**Files:** Modify `js/tilepage.js` (`importTerrain56` ~556, `#tsOpenJson` handler), `tile.html` (menu label "📂 Mở bộ .json / dự án Terrain").

**Interfaces:** Consumes Task 1 `parseTerrainFile`, `legacySheetTo10x7`; existing `imageData(file)` / `fromSheet`.

- [ ] **Step 1:** `#tsOpenJson`: if `schema===TILESET_SCHEMA` → existing path; else `parseTerrainFile` → decode `png` data URL to `{w,h,data}` → `legacySheetTo10x7` when `layout!==3` → `fromSheet(...,{layout:'blob56',size,shape,name})` → `adopt`.
- [ ] **Step 2:** `importTerrain56`: accept layout 1/2 atlases through `legacySheetTo10x7` (remove the "mở thẻ Terrain ở trang Vẽ" refusal).
- [ ] **Step 3:** browser check (Playwright, `page.route` serving the repo): open a project JSON written by `terrainProjectJson`, and a legacy 8×7 `lo-pixel-atlas` set in localStorage → both create a blob56 set, no page errors.
- [ ] **Step 4:** all tests pass; commit `feat(tile): open Terrain 56 project/pack files and legacy 8×7 atlases`.

### Task 3: New-set dialog — Nền / Cạnh colours

**Files:** Modify `tile.html` (`#newDlg`), `js/tilepage.js` (`syncNewForm`, create handler), `css/tile.css`.

**Interfaces:** Consumes `TERRAIN_CREATE_PRESETS` (Task 1), `seedPixels(layout,slot,size,colors,shape)` (`js/layouts.js:74`), palette groups the way `terrainview.js` `terrainColorGroups` builds them (Master + Genesis v3 via `js/palette.js`/`js/genesis.js` — if importing `palette.js` drags Vẽ-page DOM side effects into tile.html, copy the needed constant lists into `terrainio.js` instead).

- [ ] **Step 1:** dialog gets "Màu" preset select + Nền and Cạnh (group select + colour select + chip), shown for blob56/sides16/corners16, hidden for free; "Không — ô trống" stays possible.
- [ ] **Step 2:** creating a set seeds with `{base, edge}` from the dialog (same mapping `terrainview.js` `create()` passes to `terrainPixels`).
- [ ] **Step 3:** browser check desktop + 375 px: create with preset → tiles are seeded in those two colours; free layout hides the colour block.
- [ ] **Step 4:** tests pass; commit `feat(tile): pick base/edge colours from Master or Genesis when creating a set`.

### Task 4: Editor aids — guide modes and connector lock

**Files:** Modify `js/layouts.js`, `js/tilepage.js` (guide drawing in `drawEditor`, stroke commit), `tile.html` (`#guideBtn`, new `#lockBtn` 🔒), `tests/tileset.mjs` (or a new `tests/layouts.mjs`).

**Interfaces:**
- Produces `connectorIndices(layout, slot, size, shape): number[]` in `js/layouts.js` — blob56 → `terrainConnectorIndices`; sides16 → same via `sidesToBlob`; corners16 / free → `[]`.
- Produces `keepConnectors(before: Uint32Array, after: Uint32Array, idx: number[]): Uint32Array` (pure, in `layouts.js`).
- Guide modes `'wireframe'|'tint'|'off'` drawn like `paintTerrainGuide` (`js/terrain.js:431`) from `layoutRoles`; H cycles; the mode is remembered in `localStorage['lo-pixel-tile-guide']`.

- [ ] **Step 1: failing tests:** `connectorIndices('blob56'…)` equals `terrainConnectorIndices` for slots 0, 46; `connectorIndices` of free is `[]`; `keepConnectors` restores only listed indices.
- [ ] **Step 2:** run → FAIL. **Step 3:** implement + wire: lock on by default for blob56/sides16, applied when a stroke ends (one undo step as today).
- [ ] **Step 4:** browser check: paint over an edge connector with lock on → pixel restored; lock off → kept; H cycles three modes.
- [ ] **Step 5:** tests pass; commit `feat(tile): three guide modes and connector lock in the tile editor`.

### Task 5: "Soi lỗi" tab — seam report and 13-core tools

**Files:** Create `js/tilecheck.js`; modify `tile.html` (new tab `data-pane="check"` with badge), `js/tilepage.js` (host object, multi-slot undo), `css/tile.css`.

**Interfaces:**
- `tilepage.js` exports nothing; it builds `host = {ts:()=>ts, slot:()=>slot, select(s), writeSlots(list:[slot,Uint32Array][]), refresh()}` and calls `mountCheck(host)`. `writeSlots` pushes ONE undo entry for all slots (extend `pushUndo`/`restoreSnap` to accept `{multi:[snap…]}`) and saves.
- `js/tilecheck.js` exports `mountCheck(host)`; uses `checkSeams` / `checkColorSeams` (modes Alpha / Màu / Cả hai, same as `terrainview.js` `inspectSeams`), list rows "#a ↔ #b (E/S) · n px" clickable → `host.select(a)`, "◎ Ô cần sửa" cycles, badge shows the count; core tools: "⚙ Ghép 34 ô" = `composeTile(slotPixels(ts), s, size)` for every slot not in `CORE_SLOTS` and not a variant; "⧉ Biến thể ← ô gốc" = copy `variantBase(s)` into slots 47–55.
- Blob56 only: on other layouts the tab shows a one-line note.

- [ ] **Step 1:** add a pure `seamReport(pixels,size,shape,mode)` to `js/terrainio.js` with a failing test (mode 'alpha' equals `checkSeams` length, 'both' = alpha + colour).
- [ ] **Step 2:** implement report + UI + core tools; Ctrl+Z after "Ghép 34 ô" restores all 34 slots in one step.
- [ ] **Step 3:** browser check: break one edge → badge 1, click row opens that tile, fix → badge clears; compose + undo.
- [ ] **Step 4:** tests pass; commit `feat(tile): seam report, next issue and 13-core compose in Trang Tile`.

### Task 6: "Chi tiết" — recipe, connecting tiles, pair preview

**Files:** Create `js/tiledetail.js`; modify `tile.html` (tab `data-pane="detail"`), `js/tilepage.js` (host gains `onSelect(cb)`), `css/tile.css`.

**Interfaces:** `mountDetail(host)`; for blob56 shows `describeMask` recipe, role legend (`ROLE_COLORS`/`ROLE_NAMES`), the pixel-role canvas with hover read-out, per direction the list of slots from `neighbors(slot,dir)` (click → select), and a pair canvas like `terrainview.js` `drawPair`. Other layouts: legend + role canvas only.

- [ ] **Step 1:** implement; **Step 2:** browser check desktop + phone; **Step 3:** tests pass; commit `feat(tile): detail tab with connecting tiles and pair preview`.

### Task 7: Terrain exports in the ⋯ menu

**Files:** Modify `tile.html` (`#tsMenu`), `js/tilepage.js` (menu actions), using Task 1 helpers.

**Interfaces:** blob56-only items (hidden otherwise): "⬇ Atlas PNG sạch" (`cleanSheet(sheetPixels(ts))`), "⬇ PNG có chú thích" (port `annotationDataUrl`), "⬇ Godot 4 mapping (.json)" (`terrainGodotManifest`), "⬇ JSON layout" (`terrainManifest`), "⬇ Cả bộ một file" (`terrainPackJson`), "⬇ Dự án Terrain (.json)" (`terrainProjectJson`). File names as the Vẽ page used (`terrain56-*.png/json`).

- [ ] **Step 1:** implement; **Step 2:** browser check: each item downloads a non-empty file; re-open the project JSON via Task 2 path → identical slot pixels; **Step 3:** commit `feat(tile): Terrain 56 exports in Trang Tile`.

### Task 8: ⚡ Tạo nhanh in Trang Tile

**Files:** Create `js/tilequick.js` (port of `js/tilegenview.js`), move its markup (`index.html` ⚡ pane, `tq-*` ids) into `tile.html` as tab `data-pane="quick"`, port `.tq` CSS (`css/app.css:1002-1059`) into `css/tile.css` with tile.css tokens; add pure `planApply` to `js/terrainio.js`.

**Interfaces:**
- `mountQuick(host)`; host adds `createFromTiles(size, shape, tiles:Uint32Array[], name) → ts` (new blob56 set, adopted) and `paletteKey()`.
- Replace the terrainview adapter calls: `terrainTarget()`→ current blob56 set (`{id,size,shape}`) or null; `selectedTerrainSlot()`→`host.slot()`; `writeGeneratedTiles(list)`→`host.writeSlots(list)`; `createTerrainFromTiles`→`host.createFromTiles`; `terrainTilePixels()`→`slotPixels(ts)`; `refreshTerrain()`→`host.refresh()`.
- Stamp key stays `lo-pixel-tilegen-stamp` but `atlasId` becomes the tileset id; settings key `lo-pixel-tilegen` unchanged (old settings carry over). Drop the "frames" (56-frame) option.
- `planApply({scopeTest, locks:Set, edited:Set, keepEdited, known}) → {slots:number[], kept:number, ask:boolean}` pure, tested.

- [ ] **Step 1: failing tests** for `planApply`: locked slots never in `slots`; edited kept only when `keepEdited`; `ask` true when `!known`.
- [ ] **Step 2:** port + wire; preview map, recipes, strata, sliders, dice, advanced, role colours, lint, scope, keep edited, lock current slot, apply, decor.png, 6-layer ZIP all work.
- [ ] **Step 3:** browser check desktop + 375 px: pick a recipe → preview renders; apply with no set → new blob56 set; apply again after hand-editing slot 46 with "giữ ô sửa tay" → slot 46 unchanged; ZIP downloads.
- [ ] **Step 4:** tests pass (move the `syncPalette` test in `tests/genesis.mjs:84-96` to read `tilequick.js`); commit `feat(tile): ⚡ Tạo nhanh moves to Trang Tile`.

### Task 9: Remove the workbench from the Vẽ page

**Files:** Delete `js/terrainview.js`, `js/tilegenview.js`; modify `index.html` (remove `#terrainWrap` 492–749, `#terrainDrawTools`/`#terrainSaveState` 169–180, `#atTerrain` 832; bottom-nav `data-view="terrain"` becomes a link "🧱 Tile" to `tile.html`), `css/app.css` (workbench + `.tq` + linked-frame styles), `js/ui.js`, `js/input.js`, `js/render.js`, `js/state.js`, `js/history.js`, `js/storage.js`, `js/frames.js`, `js/atlas.js` (terrain creation / slot writing / terrain edit; keep reading `lo-pixel-atlas` intact), `js/puppetview.js`, `js/content/exercises.js`, `js/mapview.js` (drop imports of removed modules only), `tests/editor.cjs:129-141` (connector-lock + `atlasEdit.terrainSlot` tests go; replaced by Task 4 tests), `README.md` (Terrain 56 section moves under "Trang Tile", describing the new tabs).

**Interfaces:** `applyData` silently ignores `terrainLink` in old saves; `captureUndo` no longer records it.

- [ ] **Step 1: failing test** in `tests/editor.cjs`: `applyData`-style load of a doc carrying `terrainLink` leaves no `doc.terrainLink` and does not throw (or the equivalent in a storage test).
- [ ] **Step 2:** remove code; `grep -rn "terrainview\|tilegenview\|terrainLink\|terrainGuide\|terrainLock\|terrainWrap" js index.html css` returns nothing.
- [ ] **Step 3:** browser check `index.html` desktop + phone: no page errors, bottom-nav Tile opens tile.html, Soi map still opens; `tile.html` unaffected.
- [ ] **Step 4:** all tests pass; commit `refactor: Terrain workbench lives only in Trang Tile`.

### Task 10: Whole-branch review and push

- [ ] Full test run, browser pass over both pages at desktop and 375×812, README read-through, then push the branch.
