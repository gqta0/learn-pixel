## Terrain 56 theo layout 2 của Lò Pixel, đọc từ layout.json — không viết cứng bảng biến thể.
##
## Bộ 56 ô = 47 ô blob (mask 8 hướng chuẩn, N=1 E=2 S=4 W=8 NE=16 SE=32 SW=64 NW=128, xếp theo
## mask tăng dần ở slot 0–46) + 9 biến thể: 47–49 ruột (mask 255), 50–52 sàn (mask 110),
## 53 trần (155), 54 tường trái (55), 55 tường phải (205). layout.json của Lò Pixel khai:
##   "layout": 2, "center_variant_slots": [47,48,49],
##   "edge_variant_masks": {"50":110,"51":110,"52":110,"53":155,"54":55,"55":205},
##   "macro": {"size": 3, "files": {"1": "layer_1/macro.png", ...}}   (tuỳ chọn)
## Layout 3 (Lò Pixel hiện tại) giữ nguyên nghĩa slot của layout 2, chỉ đổi chỗ đặt trong ảnh:
## lưới 7×7 chuẩn cr31 "blob" cho 47 ô + khối 3×3 biến thể bên phải (ảnh 10×7 ô), khai trong
##   "layout": 3, "columns": 10, "rows": 7, "atlas_cells": {"0": [0, 0], ..., "46": [4, 4], ...}
## File layout 2 (không có atlas_cells) vẫn đọc được: ảnh 8×7, slot xếp theo thứ tự.
##
## Dùng:
##   var lay := Terrain56Layout.new()
##   if not lay.load_layout("res://.../layout.json"): push_warning(lay.errors)   # sai thì vẫn chạy bằng ô gốc
##   var slot := lay.slot_for(mask, hash_value)        # hash_value: hàm băm toạ độ sẵn có của game
##   var cell := lay.cell_for(mask, x, y, hash_value, world_width, layer)
##   # cell = {"macro": bool, "slot": int, "coords": Vector2i}  → (nguồn atlas hay nguồn vân lớn, toạ độ ô trong ảnh)
##
## Chọn ô (tất định theo hash): mask có ≥ 2 biến thể (255, 110) → ô gốc và các biến thể chia đều;
## mask có 1 biến thể (155, 55, 205) → biến thể 1/4 cơ hội. Không có biến thể → ô gốc.
class_name Terrain56Layout
extends RefCounted

const SLOT_COUNT := 56
const COLUMNS := 8
const CENTER_MASK := 255

var blob_masks: PackedInt32Array = build_blob_masks()
var center_variants: PackedInt32Array = PackedInt32Array()
var edge_variants: Dictionary = {}      # mask -> PackedInt32Array các slot biến thể
var variant_mask: Dictionary = {}       # slot biến thể -> mask
var macro_size := 0
var macro_files: Dictionary = {}        # "tầng" (String) -> đường dẫn ảnh, tương đối với layout.json
var atlas_cells: Dictionary = {}        # slot -> Vector2i ô trong ảnh atlas (layout 3); trống → thứ tự 8 cột
var atlas_columns := COLUMNS
var copy_cells: Dictionary = {}        # Vector2i ô bản sao trong ảnh (atlas_copies, vd. ô trống ở 3 góc cr31) -> slot
var errors: PackedStringArray = PackedStringArray()
var loaded := false


## Góc chéo chỉ có nghĩa khi hai cạnh kề đều nối.
static func normalize_mask(m: int) -> int:
	m &= 255
	if (m & 1) == 0 or (m & 2) == 0: m &= ~16
	if (m & 4) == 0 or (m & 2) == 0: m &= ~32
	if (m & 4) == 0 or (m & 8) == 0: m &= ~64
	if (m & 1) == 0 or (m & 8) == 0: m &= ~128
	return m


## 47 mask blob, tăng dần — đúng thứ tự slot 0–46 của Lò Pixel.
static func build_blob_masks() -> PackedInt32Array:
	var out := PackedInt32Array()
	for m in 256:
		if normalize_mask(m) == m:
			out.append(m)
	return out


## Hàm băm toạ độ của Lò Pixel (terrainHash trong js/terrain.js), số nguyên 32 bit không dấu.
## Game có hàm băm riêng thì cứ dùng hàm đó cho slot_for; hàm này để bản xem trước khớp từng ô.
static func lo_pixel_hash(x: int, y: int, seed: int = 1701) -> int:
	var n := (seed + _imul(x, 374761393) + _imul(y, 668265263)) & 0xFFFFFFFF
	n = _imul(n ^ (n >> 13), 1274126177)
	return (n ^ (n >> 16)) & 0xFFFFFFFF


static func _imul(a: int, b: int) -> int:
	a &= 0xFFFFFFFF
	b &= 0xFFFFFFFF
	var lo := (a & 0xFFFF) * b
	var hi := ((a >> 16) * b) & 0xFFFF
	return (lo + (hi << 16)) & 0xFFFFFFFF


func load_layout(path: String) -> bool:
	_reset()
	if not FileAccess.file_exists(path):
		return _fail("không thấy file " + path)
	var data = JSON.parse_string(FileAccess.get_file_as_string(path))
	if typeof(data) != TYPE_DICTIONARY:
		return _fail(path + " không phải một JSON object")
	return load_dict(data)


## Nạp và kiểm hợp lệ. Sai chỗ nào thì từ chối cả bảng biến thể (chỉ dùng ô gốc) và ghi lý do vào errors.
func load_dict(data: Dictionary) -> bool:
	_reset()
	var layout := int(data.get("layout", 0))
	if layout != 2 and layout != 3:
		return _fail("cần \"layout\": 2 hoặc 3 (Lò Pixel), gặp " + str(data.get("layout")))
	# chỗ đặt trong ảnh: đọc trước, giữ lại kể cả khi bảng biến thể bên dưới bị từ chối
	if layout == 3 or data.has("atlas_cells"):
		if not _load_cells(data):
			return false
	if data.has("blob_masks"):
		var bm = data["blob_masks"]
		if typeof(bm) != TYPE_ARRAY or bm.size() != 47:
			return _fail("blob_masks phải có đúng 47 mask")
		for i in 47:
			if int(bm[i]) != blob_masks[i]:
				return _fail("blob_masks[%d] = %s, cần %d (47 mask xếp tăng dần)" % [i, str(bm[i]), blob_masks[i]])
	var used := {}
	var cv = data.get("center_variant_slots", [])
	if typeof(cv) != TYPE_ARRAY:
		return _fail("center_variant_slots phải là mảng")
	var centers := PackedInt32Array()
	for v in cv:
		var s := int(v)
		if not _check_slot(s, used):
			return false
		centers.append(s)
	var ev = data.get("edge_variant_masks", {})
	if typeof(ev) != TYPE_DICTIONARY:
		return _fail("edge_variant_masks phải là object {\"slot\": mask}")
	var edges := {}
	var masks := {}
	for key in ev.keys():
		if not str(key).is_valid_int():
			return _fail("khoá \"%s\" trong edge_variant_masks không phải số slot" % str(key))
		var s := int(key)
		var m := int(ev[key])
		if not _check_slot(s, used):
			return false
		if not blob_masks.has(m):
			return _fail("slot %d khai mask %d, không thuộc 47 mask blob" % [s, m])
		if m == CENTER_MASK:
			return _fail("slot %d khai mask 255 — biến thể ruột chỉ khai trong center_variant_slots" % s)
		var list: PackedInt32Array = edges.get(m, PackedInt32Array())
		list.append(s)
		list.sort()
		edges[m] = list
		masks[s] = m
	centers.sort()
	center_variants = centers
	edge_variants = edges
	variant_mask = masks
	for s in centers:
		variant_mask[s] = CENTER_MASK
	if data.has("macro"):
		var mc = data["macro"]
		if typeof(mc) == TYPE_DICTIONARY and int(mc.get("size", 0)) >= 2 and typeof(mc.get("files")) == TYPE_DICTIONARY:
			macro_size = int(mc["size"])
			for k in mc["files"].keys():
				macro_files[str(k)] = str(mc["files"][k])
		else:
			# không chặn cả bảng: chỉ bỏ vân lớn, ô đặc vẫn dùng 46–49
			errors.append("macro sai định dạng (cần {\"size\": ≥2, \"files\": {...}}) — bỏ qua, ô đặc dùng 46–49")
	loaded = true
	return true


func _load_cells(data: Dictionary) -> bool:
	var cells = data.get("atlas_cells")
	var cols := int(data.get("columns", 0))
	var rows := int(data.get("rows", 0))
	if typeof(cells) != TYPE_DICTIONARY or cells.size() != SLOT_COUNT or cols < 1 or rows < 1:
		return _fail("layout 3 cần atlas_cells đủ %d slot cùng columns/rows" % SLOT_COUNT, true)
	var seen := {}
	var out := {}
	for s in SLOT_COUNT:
		var c = cells.get(str(s))
		if typeof(c) != TYPE_ARRAY or c.size() != 2:
			return _fail("atlas_cells thiếu slot %d" % s, true)
		var v := Vector2i(int(c[0]), int(c[1]))
		if v.x < 0 or v.y < 0 or v.x >= cols or v.y >= rows:
			return _fail("atlas_cells[%d] = %s nằm ngoài ảnh %d×%d" % [s, str(v), cols, rows], true)
		if seen.has(v):
			return _fail("atlas_cells: slot %d và %d cùng ô %s" % [seen[v], s, str(v)], true)
		seen[v] = s
		out[s] = v
	var copies := {}
	var ac = data.get("atlas_copies", [])
	if typeof(ac) == TYPE_ARRAY:
		for e in ac:
			if typeof(e) != TYPE_DICTIONARY or typeof(e.get("cell")) != TYPE_ARRAY or e["cell"].size() != 2:
				continue
			var s := int(e.get("slot", -1))
			var v := Vector2i(int(e["cell"][0]), int(e["cell"][1]))
			if s >= 0 and s < SLOT_COUNT and not seen.has(v) and v.x >= 0 and v.y >= 0 and v.x < cols and v.y < rows:
				copies[v] = s
	atlas_cells = out
	copy_cells = copies
	atlas_columns = cols
	return true


func _check_slot(s: int, used: Dictionary) -> bool:
	if s < 0 or s >= SLOT_COUNT:
		return _fail("slot %d nằm ngoài 0–%d" % [s, SLOT_COUNT - 1])
	if s < blob_masks.size():
		return _fail("slot %d là ô blob (0–46), không làm biến thể được" % s)
	if used.has(s):
		return _fail("slot %d khai hai lần" % s)
	used[s] = true
	return true


func _fail(msg: String, cells_too: bool = false) -> bool:
	errors.append(msg)
	if cells_too:
		atlas_cells = {}
		copy_cells = {}
		atlas_columns = COLUMNS
	push_warning("Terrain56Layout: " + msg + " — dùng ô gốc, bỏ biến thể.")
	center_variants = PackedInt32Array()
	edge_variants = {}
	variant_mask = {}
	macro_size = 0
	macro_files = {}
	loaded = false
	return false


func _reset() -> void:
	errors = PackedStringArray()
	atlas_cells = {}
	atlas_columns = COLUMNS
	center_variants = PackedInt32Array()
	edge_variants = {}
	variant_mask = {}
	macro_size = 0
	macro_files = {}
	loaded = false


## Ô blob gốc của một mask (-1 nếu mask không hợp lệ sau khi chuẩn hoá — không xảy ra với 0–255).
func base_slot(mask: int) -> int:
	return blob_masks.find(normalize_mask(mask))


func variants_of(mask: int) -> PackedInt32Array:
	mask = normalize_mask(mask)
	if mask == CENTER_MASK:
		return center_variants
	return edge_variants.get(mask, PackedInt32Array())


## Chọn slot cho một ô, tất định theo hash (số nguyên bất kỳ, nên ≥ 0).
func slot_for(mask: int, hash_value: int) -> int:
	var base := base_slot(mask)
	var vars := variants_of(mask)
	if base < 0 or vars.is_empty():
		return base
	var h := absi(hash_value)
	if vars.size() == 1:
		return vars[0] if h % 4 == 0 else base
	var k := h % (vars.size() + 1)
	return base if k == vars.size() else vars[k]


## Mask mà một slot phục vụ: 0–46 theo bảng blob, biến thể theo layout.json, slot lạ → -1.
func mask_for_slot(slot: int) -> int:
	if slot >= 0 and slot < blob_masks.size():
		return blob_masks[slot]
	return int(variant_mask.get(slot, -1))


## Ô trong ảnh atlas của một slot: theo atlas_cells (layout 3), không có thì thứ tự 8 cột (layout 1–2).
func atlas_coords(slot: int) -> Vector2i:
	if atlas_cells.has(slot):
		return atlas_cells[slot]
	return legacy_coords(slot)


static func legacy_coords(slot: int) -> Vector2i:
	return Vector2i(slot % COLUMNS, int(slot / float(COLUMNS)))


## Ô trong ảnh → slot (ô trống / ô bản sao → -1).
func slot_at_coords(coords: Vector2i) -> int:
	if atlas_cells.is_empty():
		var s := coords.y * COLUMNS + coords.x
		return s if coords.x >= 0 and coords.x < COLUMNS and s >= 0 and s < SLOT_COUNT else -1
	for s in atlas_cells:
		if atlas_cells[s] == coords:
			return s
	return copy_cells.get(coords, -1)


func has_macro(layer = null) -> bool:
	if macro_size < 2:
		return false
	return layer == null or macro_files.has(str(layer))


## Ô con của tấm vân lớn cho ô (x, y). world_width > 0: thế giới cuộn ngang, x lấy posmod trước.
## Liền qua ranh chunk khi chunk chia hết cho size; liền qua mép cuộn khi world_width chia hết
## cho size (xem wrap_seam).
func macro_cell(x: int, y: int, world_width: int = 0) -> Vector2i:
	var xx := posmod(x, world_width) if world_width > 0 else x
	return Vector2i(posmod(xx, macro_size), posmod(y, macro_size))


## true khi mép cuộn có một chỗ đứt vân lớn (độ rộng thế giới không chia hết cho size).
static func wrap_seam(world_width: int, size: int) -> bool:
	return world_width > 0 and size > 1 and world_width % size != 0


## Gộp lại cho WorldView: ô đặc có vân lớn → (nguồn vân lớn, ô con); còn lại → (atlas 56 ô, slot).
func cell_for(mask: int, x: int, y: int, hash_value: int, world_width: int = 0, layer = null) -> Dictionary:
	if normalize_mask(mask) == CENTER_MASK and has_macro(layer):
		return {"macro": true, "slot": -1, "coords": macro_cell(x, y, world_width)}
	var s := slot_for(mask, hash_value)
	return {"macro": false, "slot": s, "coords": atlas_coords(s)}
