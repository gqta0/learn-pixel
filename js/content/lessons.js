/* Nội dung: 22 bài lý thuyết, mỗi bài gọi hình minh hoạ theo tên trong DEMOS. */
import { $ } from './../dom.js';
import { renderDemo } from './demos.js';

export const LESSONS=[
{t:'Pixel art là gì — và luật số 1', b:[
 {p:'Pixel art không phải "ảnh độ phân giải thấp". Nó là hình được đặt <b>từng pixel một cách có chủ ý</b>. Điều đó dẫn tới luật số 1: bạn phải kiểm soát được mọi pixel, nên phần mềm không được tự sinh pixel thay bạn.'},
 {ul:['Không dùng cọ mềm, không blur, không gradient tool, không bút có độ mờ.',
      'Không phóng to ảnh bằng phép nội suy — chỉ nhân nguyên (×2, ×3, ×4).',
      'Không xoay tự do một sprite đã vẽ; xoay xong phải vẽ lại tay.',
      'Một tác phẩm pixel art thường có <b>ít màu</b> và <b>ít pixel</b> hơn bạn tưởng.']},
 {demo:'softhard'},
 {note:'Nghịch lý dễ chịu: càng ít pixel càng dễ vẽ đẹp, vì bạn không phải quyết định nhiều. 32×32 là chỗ ngọt cho người mới.'}
]},

{t:'Chọn khổ canvas và tỉ lệ', b:[
 {p:'Khổ canvas quyết định phong cách và cả khối lượng công việc. Chọn xong thì gắn bó, vì mọi asset trong game phải cùng "mật độ pixel".'},
 {ul:['<b>16×16</b>: tile nền, icon UI, nhân vật chibi kiểu NES.',
      '<b>32×32</b>: cỡ vàng cho vật phẩm và nhân vật top-down (Stardew ở khoảng này).',
      '<b>48×48</b>: nhân vật có chi tiết mặt, quái, chân dung nhỏ.',
      '<b>64×64+</b>: trùm, key art, portrait lớn.']},
 {demo:'sizes3'},
 {p:'Quan trọng hơn khổ là <b>tỉ lệ nhân vật so với tile</b>. Nếu tile 16px và nhân vật cao 32px, nhân vật cao 2 ô — hãy giữ đúng con số đó cho mọi nhân vật.'},
 {note:'Mật độ pixel phải nhất quán: một sprite 64px đặt cạnh tile 16px sẽ trông như đến từ game khác, dù cả hai đều đẹp.'}
]},

{t:'Đường nét: răng cưa và quy tắc cụm', b:[
 {p:'Trên lưới vuông, đường chéo bắt buộc thành bậc thang. Nét trông "sạch" khi các bậc <b>đều</b> hoặc <b>giảm dần theo trật tự</b>. Nét trông bẩn khi bậc dài ngắn lộn xộn — dân trong nghề gọi là jaggies.'},
 {demo:'lines'},
 {p:'Với đường cong, dùng <b>quy tắc cụm giảm dần</b>: các đoạn thẳng liên tiếp phải là 4-3-2-1-1 chứ không phải 4-1-3-2.'},
 {demo:'curve'},
 {ul:['Góc đẹp nhất trong pixel art: 45° (1:1) và 2:1 — dùng cho mái nhà, isometric, lưỡi kiếm.',
      'Nét luôn dày 1px. Chỗ nào dày 2px là chỗ đó "béo" lên trong mắt người xem.',
      'Tránh <b>doubles</b>: một pixel lẻ nhô ra khỏi cụm làm gãy đường.']}
]},

{t:'Bóng dáng và độ dễ đọc', b:[
 {p:'Ở cỡ nhỏ, <b>silhouette là 80% chất lượng sprite</b>. Người chơi nhận ra vật thể bằng đường bao, không bằng chi tiết bên trong.'},
 {demo:'silhouette'},
 {ul:['Vẽ silhouette một màu trước. Nếu chưa đọc được thì tô màu cũng vô ích.',
      '<b>Phép thử nhoè mắt</b>: nheo mắt hoặc zoom nhỏ. Còn 2–3 khối rõ ràng là tốt.',
      'Phóng đại đặc trưng: mũ to hơn thực tế, lưỡi kiếm dài hơn, quả to hơn cành.',
      'Khoảng âm (lỗ, kẽ) cần ít nhất 2px để không bị bít.',
      'Đặt vật thể nghiêng 45° thường dễ đọc hơn đặt thẳng.']},
 {demo:'squint'},
 {note:'Trong game top-down, người chơi nhìn sprite của bạn ở kích thước thật, đang di chuyển, giữa hàng chục thứ khác. Dễ đọc quan trọng hơn đẹp.'}
]},

{t:'Viền — ba kiểu và khi nào dùng', b:[
 {demo:'outline'},
 {ul:['<b>Viền đen kín</b>: đọc rõ nhất trên mọi nền, phong cách hoạt hoạ. Nhược: sprite trông tách rời khỏi nền, "dán lên".',
      '<b>Viền chọn lọc</b>: chỉ để viền tối ở phía tối, bỏ viền phía sáng. Sprite mềm và có khối hơn. Đây là kiểu Stardew/Terraria hay dùng.',
      '<b>Viền theo màu</b>: viền là bản tối của màu vùng đó. Dịu nhất, phù hợp cảnh nhiều màu.']},
 {p:'Chọn một kiểu và giữ cho cả game. Trộn kiểu viền là lỗi đồng nhất bị nhìn thấy nhanh nhất.'}
]},

{t:'Màu: HSL, dải màu và palette', b:[
 {p:'Đừng nghĩ theo RGB. Nghĩ theo <b>tông (hue) — độ tươi (saturation) — độ sáng (lightness)</b>. Tô khối nghĩa là đi trên một <b>dải màu</b>: chuỗi 3–5 màu từ tối tới sáng của cùng một vùng.'},
 {p:'Bí quyết làm dải màu sống: <b>lệch tông</b>. Bóng tối kéo tông về lam/tím, vùng sáng kéo về vàng. Đồng thời giảm độ tươi ở hai đầu để bớt gắt.'},
 {demo:'hue'},
 {ul:['3 màu/vùng là đủ cho 16–32px. 5 màu cho 48px+.',
      'Giới hạn tổng số màu (16–32 cho cả bộ asset) — chính giới hạn tạo nên sự hoà hợp.',
      'Dùng lại màu giữa các vùng: màu sáng nhất của da có thể là màu tối nhất của áo.',
      'Tránh đen tuyệt đối #000 và trắng tuyệt đối #fff; dùng đen ngả lam và trắng ngả vàng.',
      'Panel <b>Tạo dải màu</b> bên trái sinh dải lệch tông sẵn — bấm "Đưa dải vào bảng màu".']},
 {demo:'ramp5'}
]},

{t:'Tô khối: một nguồn sáng', b:[
 {p:'Chọn một hướng sáng (thường trên-trái) và <b>giữ nguyên cho toàn bộ game</b>. Mọi asset chung một hướng sáng là điều kiện để chúng trông như một thế giới.'},
 {demo:'solids'},
 {ul:['Vùng sáng nhất là chỗ mặt hướng thẳng về nguồn sáng.',
      '<b>Core shadow</b>: dải tối nhất không nằm ở mép mà hơi lùi vào — vì mép còn nhận sáng phản chiếu.',
      '<b>Ambient occlusion</b>: chỗ hai bề mặt gặp nhau (chân vật thể, kẽ áo) luôn tối nhất.',
      '<b>Bóng đổ</b> dán vật thể xuống đất. Không dùng đen thuần, dùng màu tối cùng tông với nền.',
      'Đốm sáng (specular) chỉ 1–3 pixel và chỉ trên vật liệu bóng.']},
 {demo:'shadow'},
 {note:'Dụng cụ <b>◐ Tô khối (S)</b> đi đúng trên dải màu đang hiện: bấm để sáng lên 1 bậc, chuột phải (hoặc nút bên S-Pen) để tối đi. Đây là cách tô khối nhanh nhất mà vẫn không đẻ ra màu lạ ngoài palette.'}
]},

{t:'Hai lỗi kinh điển: pillow shading & banding', b:[
 {p:'<b>Pillow shading</b>: tô sáng ở giữa và tối quanh viền, không theo hướng sáng nào. Kết quả là hình bẹt như cái gối.'},
 {demo:'shading'},
 {p:'<b>Banding</b>: hai ranh giới màu chạy song song sát nhau tạo thành sọc rõ rệt, làm bề mặt trông như dán decal.'},
 {demo:'banding'},
 {ul:['Chữa pillow shading: xác định hướng sáng, đẩy vùng sáng lệch về một phía.',
      'Chữa banding: cho bậc dày mỏng khác nhau, ranh giới gãy khúc, hoặc chèn tán sắc.']}
]},

{t:'Tán sắc (dithering)', b:[
 {p:'Tán sắc là xen kẽ hai màu theo hoa văn để mắt thấy màu trung gian. Đây là cách chuyển màu mượt khi palette bị giới hạn.'},
 {demo:'dither'},
 {ul:['Dùng cho: nền trời, mặt nước, sương, bề mặt lớn.',
      'Không dùng cho: sprite nhân vật nhỏ, icon UI — sẽ trông nhiễu.',
      'Hoa văn phải đều: bàn cờ 50%, hoặc thưa 25%. Hoa văn ngẫu nhiên = bẩn.',
      'Tán sắc chỉ nên xuất hiện ở <b>vùng chuyển</b>, không rải toàn hình.']}
]},

{t:'Khử răng cưa chọn lọc', b:[
 {p:'AA trong pixel art là tự tay đặt vài pixel trung gian tại chỗ đường cong đổi hướng, để mắt thấy nét mượt hơn.'},
 {demo:'aa'},
 {ul:['Chỉ AA ở nơi cần: cung tròn lớn, chữ, đường chéo dài.',
      'Màu AA nằm giữa màu nét và màu nền phía sau nó.',
      'Không AA viền ngoài của sprite game — vì nền sau sprite sẽ đổi, pixel AA sẽ thành quầng bẩn.']}
]},

{t:'Chất liệu', b:[
 {p:'Chất liệu không nằm ở hình dáng mà ở <b>độ tương phản</b>, <b>vị trí đốm sáng</b> và <b>vân bề mặt</b>.'},
 {ul:['<b>Kim loại</b>: tương phản gắt, đốm sáng nhỏ và sắc, có phản chiếu ngược ở mép dưới.',
      '<b>Gỗ</b>: tương phản trung bình, vân dọc thớ, màu ấm.',
      '<b>Đá</b>: tương phản thấp, đốm nhiễu ngẫu nhiên, mép sứt.',
      '<b>Vải</b>: chuyển êm, không đốm sáng, nếp gấp theo hướng kéo.',
      '<b>Thuỷ tinh / nước</b>: sáng ở viền, trong ở giữa, một vệt sáng chéo.']},
 {demo:'materials'},
 {note:'Panel <b>Dải màu theo chất liệu</b> bên trái sinh sẵn dải cho từng chất: kim loại trải rộng và ngả lạnh ở vùng sáng, da người trải hẹp và ngả hồng ở vùng tối, vàng/đồng ngả cam… Chọn chất liệu, chọn màu thân, bấm "Đưa dải vào bảng màu".'}
]},

{t:'Tile và nền lặp', b:[
 {p:'Tile là ảnh lặp vô hạn. Sai một pixel ở mép là cả màn hình hiện lưới ô vuông.'},
 {demo:'tile'},
 {ul:['Chi tiết chạm mép phải chạm mép đối diện tương ứng để nối liền.',
      'Không đặt chi tiết nổi bật ở tâm tile — mắt bắt ngay hoa văn lặp.',
      'Giữ độ sáng đồng đều toàn tile; mép tối hơn giữa là nguyên nhân số 1 gây lộ lưới.',
      'Bộ tile tối thiểu: 1 ô giữa + 4 cạnh + 4 góc = 9 ô (nền tảng autotile).',
      'Làm 2–3 biến thể ô giữa và rải ngẫu nhiên để phá cảm giác lặp.']},
 {demo:'tile9'}
]},

{t:'Vẽ theo bộ phận (part)', b:[
 {p:'Người mới vẽ cả nhân vật thành một khối. Tới lúc cần tư thế thứ hai thì phải vẽ lại từ đầu. Người làm game chia nhân vật thành <b>bộ phận rời</b>, mỗi part một lớp, rồi lắp lại — sửa một part là mọi tư thế được sửa theo.'},
 {demo:'parts'},
 {ul:['Bộ part tối thiểu cho nhân vật nhìn ngang: <b>đầu, thân, tay gần, tay xa, chân gần, chân xa</b>. Thêm tóc/khăn/vũ khí nếu chúng cần cử động riêng.',
      'Vẽ part ở <b>tư thế trung tính</b>: đứng thẳng, tay buông. Tư thế đẹp là việc của bước lắp, không phải bước vẽ part.',
      'Part bị che vẫn phải vẽ trọn phần bị che — dịch ra mới không cụt.',
      'Part phía xa tô <b>tối hơn 1 bậc</b> trong dải màu: mắt đọc ngay ra chiều sâu mà không tốn pixel nào.',
      'Mỗi part gọn trong một khối chữ nhật nhỏ, không có pixel lẻ bay ra xa — dịch lớp sẽ dễ canh hơn nhiều.']},
 {note:'Bộ part chính là bản gốc của bạn. Lưu file .json còn nguyên các lớp rời; PNG xuất ra chỉ là bản dùng.'}
]},

{t:'Lắp part thành nhân vật', b:[
 {p:'Lắp ghép có hai luật: <b>thứ tự chồng</b> và <b>khớp nối</b>. Sai luật nào cũng lộ ra ngay khi nhân vật động đậy.'},
 {demo:'assemble'},
 {ul:['Thứ tự từ dưới lên: tay-xa → chân-xa → chân-gần → thân → đầu → tay-gần. Cái gì gần người xem thì nằm trên.',
      'Chỗ hai part gặp nhau phải <b>chồng lên nhau ít nhất 1px</b>. Chỉ chạm mép là sẽ hở khe khi dịch.',
      'Điểm khớp (vai, hông, cổ) nên đánh dấu bằng 1 pixel màu chói trên một lớp riêng, xong thì ẩn lớp đó đi.',
      'Đầu, vai, hông phải nằm đúng trục — bật <b>Trục giữa</b> để canh.',
      'Kiểm tra ở ×4, đừng kiểm tra ở ×20: khe hở 1px chỉ hiện ra ở cỡ thật.']},
 {demo:'rigpose'},
 {p:'Đổi tư thế = dịch và lật part, không vẽ lại. Dụng cụ <b>Dịch lớp (M)</b> và <b>⇋ Lật ngang</b> là hai nút bạn sẽ dùng nhiều nhất ở bước này.'}
]},

{t:'Chuyển động', b:[
 {p:'Animation pixel art dựa vào ít khung và biên độ nhỏ. Ở 32px, dịch <b>1 pixel</b> là một chuyển động thấy rõ.'},
 {demo:'walk4'},
 {ul:['<b>Idle</b>: 2–4 khung, thân hạ 1px, ~6 fps.',
      '<b>Đi</b>: 4 khung (contact – passing – contact – passing), 8–10 fps. Đầu nhấp nhô 1px.',
      '<b>Đánh</b>: 4–6 khung, dành nhiều khung cho <b>lấy đà</b>, một khung <b>bung</b> có vệt mờ (smear), một khung <b>va chạm</b>.',
      '<b>Hiệu ứng</b>: 6–10 khung, đổi cả màu theo thời gian (trắng → vàng → cam → khói).',
      '<b>Giãn cách không đều</b> tạo lực: khung lấy đà giữ lâu, khung bung chỉ 1/24 giây.',
      '<b>Chuyển động phụ</b>: tóc, áo, đuôi trễ 1 khung so với thân.']},
 {demo:'timing'},
 {note:'Bật "Bóng khung trước" (onion skin) khi vẽ khung tiếp theo — đây là công cụ quan trọng nhất của animation.'}
]},

{t:'Làm cho chuyển động mượt', b:[
 {p:'"Mượt" không đến từ việc thêm khung. Một walk cycle 4 khung có thể mượt hơn hẳn một cái 12 khung, nếu 4 khung đó đặt đúng chỗ. Mượt đến từ bốn thứ: <b>giãn cách</b>, <b>cung chuyển động</b>, <b>chuyển động phụ</b> và <b>squash & stretch</b>.'},
 {p:'<b>1. Giãn cách (spacing).</b> Khoảng cách giữa hai khung liên tiếp chính là tốc độ. Vật thể luôn chậm ở hai đầu và nhanh ở giữa — chia đều khoảng cách là cách chắc chắn nhất để có một animation máy móc.'},
 {demo:'spacing'},
 {p:'<b>2. Cung chuyển động (arc).</b> Không có gì trong tự nhiên đi theo đường thẳng gãy khúc. Bàn tay, đầu, quả bóng, lưỡi kiếm — tất cả đều vạch một đường cong.'},
 {demo:'arc'},
 {p:'<b>3. Chuyển động phụ (overlap / follow through).</b> Phần mềm đi sau phần cứng: thân dừng rồi tóc mới dừng, và còn đi quá đà 1px trước khi về chỗ.'},
 {demo:'overlap'},
 {ul:['<b>4. Squash & stretch</b>: lúc chạm đất thì bẹt xuống, lúc bật lên thì kéo dài ra — nhưng phải giữ nguyên khối lượng.',
      '<b>Anticipation</b>: muốn bung về phía trước thì lấy đà về phía sau trước đã.',
      '<b>Smear</b>: khung nhanh nhất được phép vẽ méo và dài, vì mắt chỉ thấy nó 1/12 giây.',
      'Sửa "trượt băng" khi đi: bàn chân chạm đất phải lùi lại đúng bằng quãng đường nhân vật tiến lên.',
      'Vẽ khung <b>cực trị</b> (đầu, cuối, chỗ đổi hướng) trước; khung ở giữa vẽ sau cùng.']},
 {p:'<b>Cutout hay vẽ tay?</b> Dịch part là cách nhanh để tìm ra tư thế và nhịp. Nhưng sprite cuối cùng luôn cần một lượt <b>vẽ tay lại</b>: nối viền ngoài thành một đường duy nhất, cho vai và nách biến dạng theo tay.'},
 {demo:'cleanup'},
 {note:'Quy trình gọn nhất: dựng bộ part → lắp tư thế cực trị → chỉnh giãn cách bằng onion skin → vẽ tay dọn nét → chạy ở fps thật.'}
]},

{t:'Góc nhìn ngang khác top-down chỗ nào', b:[
 {p:'Top-down: máy quay treo trên cao, bạn nhìn <b>xuống mặt đất</b>. Góc nhìn ngang: máy quay đứng ngang tầm mắt, bạn nhìn vào <b>vách cắt</b> của thế giới. Đổi một chữ thôi nhưng mọi luật vẽ đổi theo.'},
 {ul:['Trọng lực có thật và luôn hướng xuống mép dưới màn hình — mọi vật đều phải <b>đứng trên</b> hoặc <b>treo vào</b> một thứ gì đó.',
      'Mặt đất không còn là một mảng cỏ trải rộng, mà là <b>một dải mỏng ở trên</b> cộng với <b>thân đất dày</b> bên dưới.',
      'Nhân vật chỉ có hai hướng: trái và phải, lật gương cho nhau. Không có mặt sau.',
      'Nhìn ngang thì mặt chỉ còn <b>một con mắt</b>, một đường mũi, một tai.',
      'Pivot nằm ở <b>giữa hai bàn chân</b>, không phải giữa sprite — engine dùng đúng điểm đó để đặt nhân vật lên mặt đất.']},
 {demo:'sidetile'},
 {p:'Chỗ người mới sai nhiều nhất: vẽ tile đất theo thói quen top-down — một mảng nâu phẳng có cỏ ở trên. Nhìn ngang thì thân đất phải <b>tối dần xuống dưới</b>, vì ánh sáng trời rọi từ trên, và phần sâu dưới lòng đất thì không nhận được gì.'},
 {demo:'sidescene'},
 {note:'Cùng một palette, cùng một nhân vật, chỉ đổi cách tô mặt đất là cả thế giới đổi từ Stardew sang Hollow Knight.'}
]},

{t:'Nhân vật hành động nhìn ngang', b:[
 {p:'Dòng art trong các game hành động 2D (kiểu samurai/ninja sidescroller) thường ở <b>48–64px</b>, tỉ lệ khoảng <b>4 đầu</b>: đủ chỗ cho nét mặt và nếp áo, nhưng vẫn giữ được cái đáng yêu của tỉ lệ rút gọn.'},
 {demo:'sideprop'},
 {ul:['<b>Tư thế thủ</b> là gốc của cả bộ: trọng tâm thấp, chân tách, vai xoay chếch về phía người xem để thân không bị dẹt.',
      '<b>Vải là bạn</b>: áo choàng, khăn, đuôi tóc nhô ra khỏi silhouette. Chúng vừa làm dáng đẹp vừa là chỗ kể chuyển động mà không phải vẽ lại thân.',
      '<b>Viền chọn lọc</b>: viền tối phía dưới và phía sau, bỏ viền phía trên nơi ánh sáng chiếu vào. Viền đen kín sẽ làm nhân vật dán lên nền.',
      '<b>Ánh sáng viền (rim light)</b> một bên: 1px sáng dọc mép lưng hoặc mép vai — mẹo rẻ nhất để nhân vật bật khỏi nền tối.',
      '<b>Giới hạn 16–24 màu</b> cho cả nhân vật: 4 màu da, 4 tóc, 4 áo, 3 kim loại, 2 viền.']},
 {p:'Vẽ nhân vật ở tư thế thủ trước, rồi tách thành part như Chặng 6. Mọi khung sau đó là dịch và vẽ lại part, không bao giờ vẽ lại cả người.'}
]},

{t:'Bộ động tác chuẩn của game hành động 2D', b:[
 {p:'Engine không gọi "một animation dài". Nó gọi <b>từng trạng thái riêng</b>, và mỗi trạng thái phải nối được vào các trạng thái kia. Đây là bộ tối thiểu để một nhân vật chơi được:'},
 {ul:['<b>Idle</b> 4 khung, 6 fps — thân hạ 1px, chân đứng yên.',
      '<b>Chạy</b> 8 khung, 12–14 fps — 4 khung cực trị + 4 trung gian.',
      '<b>Nhảy</b> 5 trạng thái rời: nhún · bật · đỉnh (lặp) · rơi (lặp) · tiếp đất.',
      '<b>Đánh</b> 3 đòn, mỗi đòn 4–6 khung, và đòn nào cũng phải quay về được tư thế thủ.',
      '<b>Trúng đòn</b> 2 khung · <b>Ngã</b> 4–6 khung — silhouette đổi hẳn sang phương ngang.']},
 {demo:'run8'},
 {p:'Vòng chạy vẽ theo thứ tự: hai khung <b>chạm đất</b> trước (bước dài nhất), rồi hai khung <b>lướt qua</b> (chân chồng nhau, thân cao nhất), cuối cùng mới điền 4 khung trung gian. Đỉnh đầu phải vạch một đường sóng đều — kiểm bằng onion skin.'},
 {demo:'jump5'},
 {p:'Cú nhảy có sức nặng nhờ giãn cách: lên nhanh, <b>giữ lâu ở đỉnh</b>, xuống nhanh, và bắt buộc có khung nhún khi tiếp đất. Bỏ khung tiếp đất là lỗi làm cú nhảy nhẹ bẫng phổ biến nhất.'},
 {demo:'slash4'},
 {ul:['Đòn chém: nhiều khung cho <b>lấy đà</b>, đúng <b>một khung</b> cho lúc bung.',
      '<b>Vệt kiếm</b> chỉ sống 1–2 khung, sáng ở mép ngoài và mờ dần vào trong.',
      'Khung chạm: đẩy cả nhân vật tới trước 2px — đó chính là cảm giác "va".']},
 {demo:'smear'},
 {note:'Khung nhoè (smear) được phép vẽ xấu, méo, phi lý. Nếu người xem kịp nhìn thấy nó méo thì nghĩa là bạn đã giữ nó quá lâu.'}
]},

{t:'Tile và cảnh nền nhìn ngang', b:[
 {p:'Tile platformer khác tile top-down ở chỗ nó có <b>mặt trước</b> và <b>mép</b>. Bộ tối thiểu để dựng được một màn: ô giữa, mép trái, mép phải, hai góc trên, và một ô dốc.'},
 {demo:'platedge'},
 {ul:['Mép bệ nên <b>bo góc</b> và có <b>cỏ rủ xuống</b> — nếu không, bệ trông y hệt viên gạch dán lơ lửng.',
      'Vách bên là mặt cắt: tối hơn mặt trước một bậc, vân chạy dọc.',
      'Dốc dùng bậc 1:1 hoặc 2:1, và phải khớp được với ô giữa ở cả hai đầu.',
      'Chi tiết dồn ở phần trên của khối đất, phần sâu để trống cho mắt nghỉ.',
      'Bóng đổ dưới bệ cho người chơi biết nó đang lơ lửng.']},
 {p:'Nền lùi xa theo luật <b>phối cảnh không khí</b>: càng xa càng nhạt, càng ít tương phản, càng ngả về màu trời. Lớp tiền cảnh thì ngược lại — gần như silhouette, chỉ để tạo khung.'},
 {demo:'parallax'},
 {note:'Phép thử cuối cùng của một màn ngang: nheo mắt nhìn. Nhân vật phải là chỗ tương phản mạnh nhất màn hình. Nếu nền tranh mất sự chú ý với nhân vật, hãy làm nền nhạt đi chứ đừng làm nhân vật gắt lên.'}
]},

{t:'Quy trình làm asset cho game', b:[
 {p:'Vẽ đẹp là một nửa. Nửa còn lại là để asset dùng được trong engine mà không phải sửa.'},
 {ul:['Chốt trước: khổ tile, chiều cao nhân vật, palette chung, hướng sáng. Viết ra một file và tuân thủ.',
      'Pivot nhất quán: chân nhân vật luôn ở cùng một hàng pixel trong mọi khung, mọi hướng.',
      'Đặt tên có hệ thống: <code>hero_walk_side_01.png</code>, <code>tile_dirt_ne.png</code>.',
      'Xuất spritesheet đều ô (mọi khung cùng kích thước) để engine cắt tự động.',
      'Lưu bản gốc (.json ở đây, hoặc .aseprite) tách khỏi bản xuất (.png).']},
 {demo:'pivot'},
 {p:'<b>Godot 4:</b> Project Settings → Rendering → Textures → Default Texture Filter = <code>Nearest</code>; tắt Mipmaps; Camera2D bật <code>Snap 2D Transforms to Pixel</code>; Stretch Mode <code>viewport</code> + Aspect <code>keep</code>; chỉ phóng theo số nguyên.'},
 {p:'<b>Minecraft / Stardew:</b> mật độ pixel bị game ấn định (16×16 cho block, 16×16 cho vật phẩm Stardew) — vẽ đúng khổ đó, đừng vẽ to rồi thu nhỏ.'}
]},

{t:'Luyện tập thế nào cho lên tay', b:[
 {ul:['<b>Mỗi ngày 1 asset nhỏ</b> tốt hơn mỗi tuần một tác phẩm lớn. 30 ngày = 30 asset và một tay nghề khác hẳn.',
      '<b>Sao chép để học</b>: mở một sprite bạn thích làm Ảnh mẫu, vẽ lại từng pixel, rồi tự phân tích họ dùng bao nhiêu màu, viền kiểu gì. Chỉ dùng để học, không đưa vào game.',
      '<b>Giới hạn có chủ ý</b>: 3 màu, hoặc 16×16, hoặc 30 phút. Giới hạn dạy nhanh hơn tự do.',
      '<b>Vẽ lại bài cũ</b> sau mỗi chặng. Sự khác biệt chính là bằng chứng bạn tiến bộ.',
      '<b>Xem ở kích thước thật</b> và trong game càng sớm càng tốt.']},
 {note:'Khi đã qua Chặng 4, nên chuyển sang Aseprite (~15$) hoặc LibreSprite (miễn phí) cho các dự án thật: có timeline, tile mode, palette gốc. Tool này để học, hiểu và luyện; công cụ chuyên dụng để sản xuất. Bảng màu tham khảo: Lospec.'}
]}
];

export function buildTheory(){
  const box=$('#thList'); box.innerHTML='';
  LESSONS.forEach((L,i)=>{
    const det=document.createElement('details'); det.className='lesson'; if(i===0) det.open=true;
    const sum=document.createElement('summary');
    sum.innerHTML='<span class="ln">'+String(i+1).padStart(2,'0')+'</span><span class="lt">'+L.t+'</span>';
    det.appendChild(sum);
    const body=document.createElement('div'); body.className='body';
    L.b.forEach(item=>{
      if(item.p){ const e=document.createElement('p'); e.innerHTML=item.p; body.appendChild(e); }
      if(item.ul){ const e=document.createElement('ul'); e.innerHTML=item.ul.map(x=>'<li>'+x+'</li>').join(''); body.appendChild(e); }
      if(item.note){ const e=document.createElement('div'); e.className='note'; e.innerHTML=item.note; body.appendChild(e); }
      if(item.demo){ body.appendChild(renderDemo(item.demo)); }
    });
    det.appendChild(body);
    box.appendChild(det);
  });
}
