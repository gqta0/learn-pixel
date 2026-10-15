## Kiểm Terrain56Layout. Chạy (Godot 4.3+), từ thư mục chứa project.godot:
##   godot --headless --path <project> --script res://<đường dẫn>/test_terrain56_layout.gd
## In "ALL OK" và thoát 0 khi qua; mỗi lỗi in "FAIL ..." và thoát 1.
extends SceneTree

const Layout := preload("terrain56_layout.gd")
var fails := 0
var here := ""


func check(cond: bool, what: String) -> void:
	if not cond:
		fails += 1
		printerr("FAIL ", what)


func _init() -> void:
	here = get_script().resource_path.get_base_dir()
	test_masks()
	test_layout2()
	test_distribution()
	test_bad_layouts()
	test_macro()
	test_hash()
	print("ALL OK" if fails == 0 else "%d FAIL" % fails)
	quit(1 if fails else 0)


func test_masks() -> void:
	var seen := {}
	for m in 256:
		seen[Layout.normalize_mask(m)] = true
	check(seen.size() == 47, "256 tổ hợp → %d mask, cần 47" % seen.size())
	var bm := Layout.build_blob_masks()
	check(bm.size() == 47 and bm[0] == 0 and bm[46] == 255 and bm[31] == 110, "bảng 47 mask tăng dần, #31 = 110, #46 = 255")


func test_layout2() -> void:
	var lay := Layout.new()
	check(lay.load_layout(here + "/fixtures/layout.json"), "đọc layout.json của Lò Pixel: " + str(lay.errors))
	check(lay.center_variants == PackedInt32Array([47, 48, 49]), "ruột 47–49")
	check(lay.variants_of(110) == PackedInt32Array([50, 51, 52]), "sàn 50–52")
	check(lay.variants_of(155) == PackedInt32Array([53]) and lay.variants_of(55) == PackedInt32Array([54]) and lay.variants_of(205) == PackedInt32Array([55]), "trần 53, tường 54/55")
	for pair in [[46, 255], [47, 255], [49, 255], [31, 110], [50, 110], [52, 110], [53, 155], [54, 55], [55, 205], [0, 0]]:
		check(lay.mask_for_slot(pair[0]) == pair[1], "mask_for_slot(%d) = %d" % pair)
	check(lay.mask_for_slot(56) == -1, "slot 56 không có")
	check(lay.has_macro("1") and lay.macro_size == 3, "đọc macro size 3")


func test_distribution() -> void:
	var lay := Layout.new()
	lay.load_layout(here + "/fixtures/layout.json")
	var expect := {255: [46, 47, 48, 49], 110: [31, 50, 51, 52], 155: [38, 53], 55: [24, 54], 205: [42, 55], 38: [20]}
	for mask in expect:
		var count := {}
		for x in 400:
			for y in 10:
				var s := lay.slot_for(mask, Layout.lo_pixel_hash(x, y))
				count[s] = count.get(s, 0) + 1
		var slots: Array = count.keys()
		slots.sort()
		check(slots == expect[mask], "mask %d ra %s, cần %s" % [mask, str(slots), str(expect[mask])])
		var n := 4000.0
		if expect[mask].size() == 4:
			for s in expect[mask]:
				check(absf(count[s] / n - 0.25) < 0.04, "mask %d: slot %d chiếm %.3f, cần ~0.25" % [mask, s, count[s] / n])
		elif expect[mask].size() == 2:
			check(absf(count[expect[mask][1]] / n - 0.25) < 0.04, "mask %d: biến thể chiếm %.3f, cần ~0.25" % [mask, count[expect[mask][1]] / n])
	# ruột chỉ ra 46–49
	for h in 1000:
		var s := lay.slot_for(255, h * 7919)
		check(s >= 46 and s <= 49, "ruột ra slot %d" % s)


func test_bad_layouts() -> void:
	var good: Dictionary = JSON.parse_string(FileAccess.get_file_as_string(here + "/fixtures/layout.json"))
	var cases := {
		"layout 1": func(d): d["layout"] = 1,
		"slot trùng": func(d): d["center_variant_slots"] = [47, 47, 49],
		"slot ngoài 0–55": func(d): d["edge_variant_masks"]["60"] = 110,
		"slot là ô blob": func(d): d["center_variant_slots"] = [12, 48, 49],
		"mask không thuộc 47": func(d): d["edge_variant_masks"]["53"] = 16,
		"ruột khai ở mép": func(d): d["edge_variant_masks"]["53"] = 255,
		"blob_masks sai": func(d): d["blob_masks"][5] = 99,
	}
	for name in cases:
		var d: Dictionary = good.duplicate(true)
		cases[name].call(d)
		var lay := Layout.new()
		check(not lay.load_dict(d), "phải từ chối: " + name)
		check(lay.errors.size() > 0, "có lý do khi từ chối: " + name)
		# từ chối rõ ràng và dùng ô gốc
		check(lay.slot_for(255, 3) == 46 and lay.slot_for(110, 0) == 31 and lay.slot_for(155, 0) == 38, "về ô gốc sau khi từ chối: " + name)
		check(not lay.has_macro(), "không dùng macro khi bảng hỏng: " + name)
	var lay2 := Layout.new()
	check(not lay2.load_layout(here + "/fixtures/khong-co.json"), "thiếu file thì từ chối")
	# macro hỏng chỉ bỏ macro, bảng biến thể vẫn dùng
	var d2: Dictionary = good.duplicate(true)
	d2["macro"] = {"size": 1}
	var lay3 := Layout.new()
	check(lay3.load_dict(d2) and not lay3.has_macro() and lay3.center_variants.size() == 3, "macro hỏng: bỏ macro, giữ biến thể")


func test_macro() -> void:
	var lay := Layout.new()
	lay.load_layout(here + "/fixtures/layout.json")
	var w := 240                                   # thế giới cuộn rộng 10 chunk × 24 ô
	check(not Layout.wrap_seam(w, 3) and Layout.wrap_seam(250, 3), "wrap_seam: 240 liền, 250 đứt")
	# ô ruột → ô con theo toạ độ
	var c := lay.cell_for(255, 7, 5, 0, w, "1")
	check(c["macro"] and c["coords"] == Vector2i(1, 2), "ô (7,5) → ô con (1,2): " + str(c))
	# liền qua ranh chunk 24 và qua mép cuộn: x tăng 1 thì cột ô con tăng 1 (mod 3)
	for x in [22, 23, 24, 25, 47, 48, 238, 239, 240, 241, -1, -2]:
		var a: Vector2i = lay.macro_cell(x, 0, w)
		var b: Vector2i = lay.macro_cell(x + 1, 0, w)
		check(b.x == (a.x + 1) % 3, "macro liền giữa x=%d và x=%d (%d → %d)" % [x, x + 1, a.x, b.x])
	for y in [-4, -1, 0, 2, 3, 23, 24]:
		check(lay.macro_cell(0, y + 1, w).y == (lay.macro_cell(0, y, w).y + 1) % 3, "macro liền theo y tại %d" % y)
	# ô có mép không lấy macro; tầng không có macro → cách cũ
	check(not lay.cell_for(110, 7, 5, 0, w, "1")["macro"], "ô sàn vẫn dùng blob")
	var old := lay.cell_for(255, 7, 5, 0, w, "4")
	check(not old["macro"] and old["slot"] >= 46 and old["slot"] <= 49, "tầng thiếu macro → 46–49: " + str(old))
	check(Layout.slot_coords(46) == Vector2i(6, 5) and Layout.slot_coords(55) == Vector2i(7, 6), "toạ độ atlas 8 cột")


func test_hash() -> void:
	var pts = JSON.parse_string(FileAccess.get_file_as_string(here + "/fixtures/hash.json"))
	for p in pts:
		var h := Layout.lo_pixel_hash(int(p["x"]), int(p["y"]), int(p["seed"]))
		check(h == int(p["hash"]), "hash(%d,%d) = %d, Lò Pixel ra %d" % [p["x"], p["y"], h, p["hash"]])
