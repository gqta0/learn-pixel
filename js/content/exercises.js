/* Nội dung: hai lộ trình bài tập tách biệt — 11 chặng chung và 5 phần Terraria. */
import { $ } from './../dom.js';
import { doc, view } from './../state.js';
import { pushUndo } from './../history.js';
import { invalidateBuf } from './../raster.js';
import { fitZoom } from './../render.js';
import { autosave } from './../storage.js';
import { syncAll } from './../ui.js';
import { keepBeforeReplace } from './../library.js';
import { runLint } from './../lint.js';
import { paintDaily } from './../daily.js';
import { DEMOS, renderDemo, demoToCanvas } from './demos.js';

export const PHASES = [
  {n:'Chặng 0', t:'Điều khiển từng pixel', d:'Tay nghề cơ bản: đường, cong, hình khối sạch.'},
  {n:'Chặng 1', t:'Bóng dáng & độ dễ đọc', d:'Vẽ được vật thể nhận ra ngay ở 16px.'},
  {n:'Chặng 2', t:'Ánh sáng & màu', d:'Dải màu, khối, chất liệu, tán sắc.'},
  {n:'Chặng 3', t:'Vật phẩm game', d:'Asset thật dùng được: cây trồng, vũ khí, hòm, món ăn.'},
  {n:'Chặng 4', t:'Tile & khung cảnh', d:'Nền lặp không lộ mối, props, nhà cửa.'},
  {n:'Chặng 5', t:'Nhân vật', d:'Từ chibi 16px tới nhân vật 48px 4 hướng và chân dung.'},
  {n:'Chặng 6', t:'Bộ phận & lắp ghép', d:'Vẽ rời từng part, ghép thành nhân vật, tạo tư thế và chuyển động bằng cách dịch part.'},
  {n:'Chặng 7', t:'Chuyển động', d:'Idle, đi, đánh, hiệu ứng — và cách làm cho mượt.'},
  {n:'Chặng 8', t:'Nhìn ngang: nhân vật hành động', d:'Bộ động tác platformer: đứng, chạy 8 khung, nhảy, combo chém có vệt, ngã.'},
  {n:'Chặng 9', t:'Nhìn ngang: tile & cảnh nền', d:'Mặt đất có mặt trên và thân, bệ, dốc, vách, nền lùi xa.'},
  {n:'Chặng 10', t:'Hero — bộ asset hoàn chỉnh', d:'Một tay làm ra cả bộ asset đồng nhất.'},

  /* --- lộ trình riêng: asset kiểu Terraria --- */
  {tr:'terraria', n:'Phần 0', t:'Luật chơi của Terraria', d:'Vì sao khối thì không viền mà vật phẩm thì viền kín, và palette hang động.'},
  {tr:'terraria', n:'Phần 1', t:'Khối và tường', d:'Đá, đất, cỏ, quặng, gỗ — thứ chiếm 90% màn hình.'},
  {tr:'terraria', n:'Phần 2', t:'Vật phẩm', d:'Thanh kim loại, kiếm, cuốc, thuốc — đọc được trong ô túi đồ.'},
  {tr:'terraria', n:'Phần 3', t:'Nhân vật và quái', d:'Sprite nhìn ngang đúng tỉ lệ, khung đi, slime.'},
  {tr:'terraria', n:'Phần 4', t:'Xuất và cắm vào game', d:'Tilesheet đúng lưới, và soi cả bộ trên nền hang tối.'}
];

export const EXERCISES = [
/* --- Chặng 0 --- */
{p:0,size:16,t:'Đường thẳng và đường 45°',time:'10 phút', art:'lines',
 goal:'Tay quen với chuột/bút, hiểu thế nào là nét "sạch".',
 steps:['Vẽ 3 đường ngang, 3 đường dọc dài 12px, cách nhau đúng 2px.',
        'Vẽ 2 đường chéo 45° (mỗi bước xuống 1px sang 1px) chạm 2 góc canvas.',
        'Vẽ 2 đường chéo tỉ lệ 2:1 (mỗi bước 2 pixel ngang, 1 pixel dọc) — đây là góc chuẩn cho mái nhà, isometric.'],
 tips:['Bấm giữ và kéo một hơi, đừng vẽ từng nhấp.','Dùng dụng cụ Đường thẳng (L) để đối chiếu nét tay của mình.'],
 trap:'Nét bị "răng cưa lộn xộn": các đoạn bậc dài ngắn khác nhau (3-1-4-2). Bậc phải đều.'},

{p:0,size:16,t:'Đường cong bằng cụm giảm dần',time:'15 phút', art:'curve',
 goal:'Vẽ cong mượt bằng quy tắc cụm 4-3-2-1.',
 steps:['Vẽ 1/4 cung tròn từ giữa mép trên xuống giữa mép phải.',
        'Đếm lại: cụm pixel phải giảm dần đều (ví dụ 4-3-2-1-1), không được 4-1-4.',
        'Vẽ thêm 1 cung lượn hình chữ S.'],
 tips:['Vẽ thô trước, rồi sửa từng pixel cho cụm giảm dần.','Zoom nhỏ lại (×6) để kiểm tra cảm giác tổng thể.'],
 trap:'Cụm nhảy bậc (2-5-1) khiến đường cong trông gãy khúc.'},

{p:0,size:32,t:'Hình cơ bản chuẩn pixel',time:'20 phút', art:'shapes',
 goal:'Tay vẽ được vuông, tròn, tam giác cân đối trong khung hẹp.',
 steps:['Vẽ hình vuông 16×16 và hình chữ nhật 20×12 (dùng U rồi vẽ lại bằng tay để so).',
        'Vẽ vòng tròn đường kính 16 bằng tay, so với dụng cụ Ê-líp (O).',
        'Vẽ tam giác đều và tam giác vuông với cạnh chéo bậc đều.'],
 tips:['Bật Trục giữa để canh đối xứng.','Bật Gương X khi vẽ nửa trái của vòng tròn.'],
 trap:'Vòng tròn nhỏ bị "vuông góc": ở 16px, viền tròn nên theo cụm 5-3-2-1-1.'},

{p:0,size:16,t:'Bộ icon 8×8 trong khung 16',time:'20 phút', art:'uiicons8',
 goal:'Làm quen giới hạn cực hẹp — mỗi pixel là một quyết định.',
 steps:['Vẽ 4 icon 8×8 trong 4 góc canvas: dấu +, mũi tên, trái tim, ngôi sao.',
        'Mỗi icon chỉ 2 màu.',
        'Zoom ×4 để kiểm tra: còn nhận ra được không?'],
 tips:['Ở 8px, hãy bỏ chi tiết và giữ hình dáng tổng.','Mũi tên nên dùng góc 45° cho sắc nét.'],
 trap:'Cố nhồi chi tiết vào 8px → thành đám pixel nhiễu.'},

{p:0,size:32,t:'Kiểm soát độ dày nét',time:'15 phút', art:'thickness',
 goal:'Hiểu vì sao nét pixel art phải dày nhất quán 1px.',
 steps:['Vẽ một khung chữ nhật viền 1px, bên trong vẽ một khung viền 2px.',
        'Vẽ một hình lá hoặc giọt nước có viền 1px đều tuyệt đối.',
        'Tìm và xoá mọi chỗ viền bị dày thành 2px do vẽ trùng.'],
 tips:['Cỡ bút luôn để 1 khi đi viền.','Dùng Hút màu (I) để lấy lại đúng màu viền.'],
 trap:'Viền chỗ dày chỗ mỏng làm sprite trông "bẩn" ngay cả khi hình đẹp.'},

/* --- Chặng 1 --- */
{p:1,size:16,t:'Bóng dáng một màu: 4 vật phẩm',time:'25 phút', art:'silhouette',
 goal:'Hình nhận ra được khi chỉ có duy nhất một màu đen.',
 steps:['Chỉ dùng 1 màu, vẽ silhouette: thanh kiếm, chai thuốc, chìa khoá, cái búa (mỗi cái một lần, xoá rồi vẽ tiếp).',
        'Với mỗi cái, tự hỏi: nhìn 1 giây có gọi đúng tên không?',
        'Xuất PNG ×1 và nhìn ở kích thước thật.'],
 tips:['Nghiêng vật thể 45° thường dễ đọc hơn để thẳng.','Phóng đại đặc trưng: lưỡi kiếm dài, cán ngắn, nút chai to.'],
 trap:'Silhouette đối xứng hoàn hảo thường vô hồn — lệch một chút sẽ sống hơn.'},

{p:1,size:16,t:'Hình có lỗ và khoảng âm',time:'20 phút', art:'negative',
 goal:'Dùng khoảng trống làm thông tin.',
 steps:['Vẽ silhouette cái vòng, cái nhẫn có đá, cái xô có tay cầm.',
        'Đảm bảo lỗ ở giữa ít nhất 2px để không bị bít khi thu nhỏ.',
        'Đổi màu nền sang màu khác để kiểm tra lỗ có thật sự hở.'],
 tips:['Khoảng âm cũng phải có hình dáng đẹp.','Tay cầm 1px thường biến mất — cho nó 2px.'],
 trap:'Chi tiết mảnh 1px kẹp giữa hai vùng đặc sẽ "dính" lại thành khối.'},

{p:1,size:16,t:'Bộ 4 icon UI 16×16',time:'30 phút', art:'uiicons16',
 goal:'Asset dùng được thật cho HUD game.',
 steps:['Vẽ: trái tim (máu), túi tiền, cái túi đồ, bánh răng cài đặt.',
        'Chỉ dùng 3 màu mỗi icon: viền tối, thân, điểm sáng.',
        'Xuất spritesheet 4 khung để dùng trong game.'],
 tips:['Cùng bộ thì cùng độ dày viền và cùng góc sáng.','Icon UI nên "mập" hơn thực tế để dễ đọc.'],
 trap:'Mỗi icon một phong cách → HUD trông chắp vá.'},

{p:1,size:32,t:'Phép thử nhoè mắt',time:'15 phút', art:'squint',
 goal:'Học cách tự kiểm tra độ dễ đọc.',
 steps:['Vẽ một cái cây 32×32 với đủ chi tiết.',
        'Zoom về ×2, nheo mắt (hoặc nhìn qua khe ngón tay): còn thấy 3 khối rõ (tán, thân, bóng) không?',
        'Sửa cho tới khi 3 khối tách bạch.'],
 tips:['Nếu nhoè thành một cục xám → thiếu tương phản độ sáng.','Tương phản độ sáng quan trọng hơn tương phản màu.'],
 trap:'Đánh giá sprite khi đang zoom ×20 — trong game người chơi không bao giờ thấy nó to như vậy.'},

/* --- Chặng 2 --- */
{p:2,size:32,t:'Dải màu 5 bậc có lệch tông',time:'25 phút', art:'ramp5',
 goal:'Tự tạo dải màu chuyên nghiệp thay vì kéo tối/sáng đơn thuần.',
 steps:['Chọn một màu thân (ví dụ đỏ), dùng panel Dải màu theo chất liệu với lệch tông 25–35°, bấm Đưa dải vào bảng màu.',
        'Vẽ 2 hình cầu cạnh nhau: một tô bằng dải không lệch tông (tự pha), một bằng dải có lệch tông.',
        'So sánh: cái nào "có không khí" hơn?'],
 tips:['Bóng tối kéo về lam/tím, vùng sáng kéo về vàng.','Giảm độ tươi ở hai đầu dải để bớt gắt.'],
 trap:'Chỉ giảm độ sáng cùng một tông → màu chết, xám xịt.'},

{p:2,size:32,t:'Một nguồn sáng, ba hình khối',time:'30 phút', art:'solids',
 goal:'Hiểu cầu / trụ / hộp phản ứng với sáng thế nào.',
 steps:['Chọn hướng sáng trên-trái và giữ nguyên cho cả bài.',
        'Vẽ hình cầu, hình trụ, hình hộp cùng một dải 5 màu.',
        'Thêm bóng đổ xuống mặt đất cho cả ba.'],
 tips:['Hộp: mỗi mặt một giá trị phẳng. Cầu: chuyển dần. Trụ: chuyển dần theo một trục.','Bóng đổ tối và bám sát chân vật thể (ambient occlusion).'],
 trap:'Pillow shading — tô sáng ở giữa, tối quanh viền theo hình vành khăn. Khối sẽ bị bẹt.'},

{p:2,size:32,t:'Chống dải sọc (banding)',time:'20 phút', art:'banding',
 goal:'Nhận ra và sửa lỗi banding.',
 steps:['Cố ý vẽ một mặt nghiêng với 4 bậc màu, mỗi bậc là một sọc chéo dày đều 4px.',
        'Sửa lại: làm các bậc dày mỏng khác nhau, viền bậc gãy khúc chứ không song song.',
        'Đối chiếu với hình minh hoạ ở thẻ Lý thuyết.'],
 tips:['Không để hai đường ranh giới màu chạy song song sát nhau.','Cho ranh giới lượn theo hình khối.'],
 trap:'Sọc song song đều nhau tạo cảm giác cầu vồng nhựa.'},

{p:2,size:32,t:'Tán sắc (dithering) làm nền trời',time:'25 phút', art:'dither',
 goal:'Chuyển màu mượt bằng 2 màu.',
 steps:['Chọn 2 màu trời (đậm trên, nhạt dưới).',
        'Ở vùng giao, dùng hoa văn bàn cờ, rồi thưa dần thành hoa văn 25%.',
        'Vẽ thêm một dải chuyển bằng 3 màu cho mượt hơn.'],
 tips:['Tán sắc chỉ nên xuất hiện ở vùng chuyển, không rải khắp hình.','Hoa văn phải đều đặn — mắt rất nhạy với hoa văn hỏng.'],
 trap:'Tán sắc lên sprite nhân vật nhỏ → trông nhiễu, mất sạch.'},

{p:2,size:32,t:'Năm chất liệu',time:'40 phút', art:'materials',
 goal:'Cùng một hình khối, đổi chất liệu chỉ bằng cách tô.',
 steps:['Vẽ 5 viên đá cùng hình dạng, tô thành: kim loại, gỗ, đá, vải, thuỷ tinh.',
        'Kim loại: tương phản gắt + vệt sáng nhỏ. Vải: tương phản êm, không đốm sáng.',
        'Thuỷ tinh: sáng ở viền, trong ở giữa.'],
 tips:['Chất liệu = độ tương phản + vị trí đốm sáng + vân bề mặt.','Gỗ cần vân dọc thớ, đá cần đốm ngẫu nhiên.'],
 trap:'Dùng cùng một cách tô cho mọi chất liệu → mọi thứ trông như nhựa.'},

/* --- Chặng 3 --- */
{p:3,size:32,t:'Chuỗi sinh trưởng cây trồng (5 khung)',time:'60 phút',frames:5, art:'crop5',
 goal:'Asset kiểu Stardew: hạt → mầm → cây → ra hoa → thu hoạch.',
 steps:['Khung 1: mầm 2 lá nhỏ ở đáy canvas. Khung 5: cây có quả chín.',
        'Giữ nguyên vị trí gốc cây ở mọi khung để trong game không bị "nhảy".',
        'Xuất spritesheet 5 khung ngang.'],
 tips:['Mỗi khung phải khác rõ ở dáng tổng, không chỉ khác một chiếc lá.','Chừa 2px trống ở đáy làm chỗ tiếp đất.'],
 trap:'Vẽ khung 5 trước rồi cắt bớt dần → các khung đầu trông thiếu tự nhiên.'},

{p:3,size:32,t:'Bộ 3 vũ khí',time:'45 phút', art:'weapons',
 goal:'Vật phẩm dài, chéo, có phần kim loại.',
 steps:['Vẽ kiếm, cung, gậy phép — cùng đặt chéo 45°.',
        'Dùng chung 1 dải kim loại và 1 dải gỗ cho cả bộ.',
        'Thêm một đốm sáng duy nhất trên lưỡi kiếm.'],
 tips:['Đường chéo 45° cho nét kiếm sắc nhất.','Cán và lưỡi cần khác giá trị rõ để đọc được ở HUD.'],
 trap:'Kiếm mảnh 1px trông như que tăm; cho lưỡi ít nhất 2–3px.'},

{p:3,size:32,t:'Ba lọ thuốc bằng cách đổi màu',time:'30 phút',frames:3, art:'potions3',
 goal:'Tái sử dụng asset — kỹ năng sống còn khi làm game một mình.',
 steps:['Vẽ 1 lọ thuốc thật đẹp ở khung 1.',
        'Nhân bản sang khung 2, 3 và chỉ đổi dải màu nước thuốc (đỏ / xanh / vàng).',
        'Thêm điểm khác biệt nhỏ (nút chai, nhãn) để 3 lọ không đơn điệu.'],
 tips:['Giữ nguyên viền và thuỷ tinh, chỉ đổi phần chất lỏng.','Đây chính là quy trình recolor bằng palette swap.'],
 trap:'Đổi cả viền theo màu nước → mất tính đồng bộ của bộ.'},

{p:3,size:32,t:'Hòm đóng / hòm mở',time:'35 phút',frames:2, art:'chest2',
 goal:'Hai trạng thái của cùng một vật thể.',
 steps:['Khung 1: hòm đóng. Khung 2: hòm mở, thấy lòng trong tối và ánh vàng.',
        'Giữ đúng phần thân hòm không đổi giữa 2 khung.',
        'Bật Bóng khung trước để canh cho khớp.'],
 tips:['Lòng hòm phải tối hơn nhiều so với mặt ngoài.','Nắp mở nên nghiêng theo phối cảnh nhẹ, đừng dựng đứng.'],
 trap:'Thân hòm bị xê dịch 1px giữa hai khung → trong game thấy giật.'},

{p:3,size:32,t:'Bốn món ăn',time:'40 phút', art:'foods',
 goal:'Vật thể mềm, tròn, nhiều màu.',
 steps:['Vẽ: bát phở, bánh mì, quả xoài, ly trà đá (hoặc món bạn thích).',
        'Mỗi món tối đa 8 màu, cùng hướng sáng.',
        'Kiểm tra bằng phép thử nhoè mắt.'],
 tips:['Món ăn cần một điểm nhấn màu tươi để "ngon mắt".','Hơi nóng / đá lạnh có thể gợi bằng 2–3 pixel.'],
 trap:'Nhiều màu tươi cạnh nhau ngang giá trị → rối, không đọc được.'},

/* --- Chặng 4 --- */
{p:4,size:16,t:'Tile cỏ lặp không lộ mối',time:'35 phút', art:'tile',
 goal:'Nền game cơ bản.',
 steps:['Vẽ tile cỏ 16×16, dùng 3 sắc xanh.',
        'Kiểm tra ghép: xuất PNG rồi ghép 3×3 trong tool ảnh hoặc tự dán bằng tay.',
        'Sửa cho các mảng cỏ chạy vắt qua mép tile.'],
 tips:['Không vẽ chi tiết nổi bật ở giữa tile — mắt sẽ thấy ngay hoa văn lặp.','Vẽ chi tiết chạm mép thì phải chạm cả mép đối diện tương ứng.'],
 trap:'Viền tile bị tối hơn phần giữa → hiện ra lưới ô vuông.'},

{p:4,size:16,t:'Bộ tile đường đất 9 ô',time:'60 phút',frames:9, art:'tile9',
 goal:'Hiểu tile góc/cạnh — nền tảng autotile.',
 steps:['9 khung: 4 góc, 4 cạnh, 1 giữa của một vạt đất giữa cỏ.',
        'Mọi mép nối nhau phải liền mạch tuyệt đối.',
        'Xuất spritesheet và thử ghép thành một vũng đất tròn.'],
 tips:['Vẽ ô giữa trước, rồi làm cạnh, cuối cùng làm góc.','Đặt tên khi xuất: dirt_c, dirt_n, dirt_ne… cho đỡ lẫn.'],
 trap:'Làm góc trước → cạnh không khớp, phải vẽ lại từ đầu.'},

{p:4,size:32,t:'Props có bóng đổ: cây, bụi, đá',time:'45 phút',frames:3, art:'shadow',
 goal:'Vật thể đứng trên nền, gắn được vào thế giới.',
 steps:['Mỗi khung một prop, cùng hướng sáng, cùng loại bóng đổ ê-líp dưới chân.',
        'Chừa đúng vị trí chân prop ở đáy canvas để pivot thống nhất.',
        'Bóng đổ dùng màu tối cùng tông với nền, không dùng đen thuần.'],
 tips:['Bóng đổ là thứ khiến prop "dính đất" thay vì trôi lơ lửng.','Cây nên có tán chia 2–3 cụm, đừng một cục tròn.'],
 trap:'Bóng đen 100% làm prop như dán trên nền, mất chiều sâu.'},

{p:4,size:48,t:'Căn nhà nhỏ 48×48',time:'70 phút', art:'house',
 goal:'Kiến trúc pixel + phối cảnh nhẹ nhìn từ trên xuống chéo.',
 steps:['Dựng khối: mái, thân, cửa, cửa sổ — chỉ bằng silhouette trước.',
        'Tô 3 vật liệu: mái ngói, tường gỗ/đất, khung cửa.',
        'Thêm chi tiết cuối: bậc cửa, đèn, khói bếp.'],
 tips:['Mái dùng độ dốc 2:1 cho gọn pixel.','Giữ tổng số màu ≤ 16 để nhà hoà với tile nền.'],
 trap:'Nhồi chi tiết trước khi khối lớn đúng → sửa rất tốn công.'},

{p:4,size:48,t:'Ba lớp nền cho parallax',time:'50 phút',frames:3, art:'parallax',
 goal:'Chiều sâu bằng tương phản và độ chi tiết.',
 steps:['Khung 1: núi xa (ít chi tiết, nhạt, ngả lam). Khung 2: rừng giữa. Khung 3: bụi cây gần (đậm, chi tiết).',
        'Lớp xa dùng ít màu và ít tương phản hơn lớp gần.',
        'Xuất 3 PNG để chồng trong engine.'],
 tips:['Đây là phối cảnh không khí: càng xa càng nhạt và càng ngả về màu trời.','Lớp gần được phép cắt cụt ngoài khung.'],
 trap:'Lớp xa quá chi tiết → mắt không biết nhìn đâu.'},

/* --- Chặng 5 --- */
{p:5,size:16,t:'Nhân vật chibi 16×16 nhìn thẳng',time:'40 phút', art:'chibi',
 goal:'Nhân vật nhỏ nhất còn đọc được.',
 steps:['Tỉ lệ: đầu 6–7px, thân 5px, chân 3px.',
        'Mắt là 2 pixel đen, không vẽ mũi/miệng.',
        'Silhouette phải rõ: tóc, vai, chân tách bạch.'],
 tips:['Ở 16px, tóc và trang phục làm nên tính cách, không phải mặt.','Bật Gương X để dựng đối xứng rồi phá đối xứng một chút.'],
 trap:'Vẽ đủ mắt-mũi-miệng ở 16px → mặt thành đám bùn.'},

{p:5,size:32,t:'Nhân vật 32×32 bốn hướng',time:'90 phút',frames:4, art:'dirs4',
 goal:'Bộ hướng đi chuẩn cho game top-down.',
 steps:['Khung 1 mặt trước, khung 2 mặt sau, khung 3 nhìn ngang trái, khung 4 lật gương thành phải.',
        'Chiều cao đầu, vai, hông phải bằng nhau tuyệt đối ở cả 4 hướng.',
        'Mặt sau: không mắt, chỉ tóc và cổ áo.'],
 tips:['Vẽ trước mặt trước, rồi copy sang các khung và sửa.','Kẻ 3 đường mốc (đỉnh đầu, vai, hông) trên một lớp riêng rồi ẩn đi.'],
 trap:'Mỗi hướng lệch chiều cao vài pixel → nhân vật "co giãn" khi quay.'},

{p:5,size:48,t:'Nhân vật 48×48 với 12 màu',time:'90 phút', art:'palettebar',
 goal:'Đủ chỗ cho chi tiết nhưng phải kỷ luật màu.',
 steps:['Chốt palette đúng 12 màu trước khi vẽ và không thêm.',
        'Chia vùng: da (3 màu), tóc (3), áo (3), phụ kiện (3).',
        'Tô khối theo một nguồn sáng, thêm viền chọn lọc.'],
 tips:['Giới hạn màu buộc bạn dùng lại màu ở chỗ khác — đó là cách palette trở nên hoà.','Viền chọn lọc: viền tối ở phía tối, bỏ viền ở phía sáng.'],
 trap:'Thêm màu mỗi khi thấy bí → 40 màu, nhân vật rời rạc.'},

{p:5,size:48,h:64,t:'Chân dung ba biểu cảm',time:'70 phút',frames:3, art:'portrait3',
 goal:'Portrait kiểu hộp thoại (Stardew/visual novel).',
 steps:['Khung 1 bình thường, khung 2 vui, khung 3 tức giận.',
        'Chỉ đổi mắt, miệng, mày — giữ nguyên khối đầu và tóc.',
        'Bật Bóng khung trước để các khung khớp nhau.'],
 tips:['Mày là bộ phận diễn cảm mạnh nhất ở cỡ nhỏ.','Đổi tối đa 6–10 pixel là đủ để đổi hẳn cảm xúc.'],
 trap:'Vẽ lại cả đầu cho mỗi biểu cảm → ba người khác nhau.'},

/* --- Chặng 6: bộ phận & lắp ghép --- */
{p:6,size:32,t:'Bảng bộ phận: cắt nhân vật thành 6 part',time:'50 phút', art:'parts',
 layers:['Tay xa','Chân xa','Chân gần','Thân','Đầu','Tay gần'],
 goal:'Có một bộ part rời dùng lại được cho mọi tư thế, thay vì vẽ lại cả người mỗi lần.',
 steps:['Tạo 6 lớp, đặt tên: đầu, thân, tay-gần, tay-xa, chân-gần, chân-xa.',
        'Mỗi lớp vẽ đúng một part, vẽ ở tư thế đứng thẳng trung tính (không nghiêng, không co).',
        'Part nào bị part khác che thì vẫn vẽ trọn phần bị che — sau này dịch ra sẽ không bị cụt.',
        'Ẩn/hiện từng lớp để kiểm tra: mỗi part tách ra có tự đứng được không?'],
 tips:['Tay và chân "xa" (phía bên kia thân) tô tối hơn 1 bậc — mắt hiểu ngay chiều sâu.',
       'Vẽ part ở tư thế trung tính, đừng vẽ sẵn tư thế đẹp: tư thế là việc của bước lắp.',
       'Giữ mỗi part gọn trong một khối chữ nhật nhỏ, đừng để pixel lẻ bay ra xa.'],
 trap:'Vẽ dính part vào nhau trên cùng một lớp — tới lúc muốn cử động thì phải tẩy và vẽ lại từ đầu.'},

{p:6,size:32,t:'Khớp nối và thứ tự chồng',time:'45 phút', art:'assemble',
 layers:['Tay xa','Chân xa','Chân gần','Thân','Đầu','Tay gần','Điểm khớp'],
 goal:'Ghép 6 part thành một nhân vật liền lạc, không hở khe, không lệch.',
 steps:['Dùng Dịch lớp (M) đưa từng part vào đúng chỗ. Thứ tự từ dưới lên: tay-xa → chân-xa → chân-gần → thân → đầu → tay-gần.',
        'Chỗ hai part gặp nhau (cổ, vai, hông) phải chồng lên nhau ít nhất 1px — chồng thì liền, chạm thì hở.',
        'Đánh dấu điểm khớp: 1 pixel màu chói trên một lớp riêng ở vai và hông, dùng xong thì ẩn lớp đó.',
        'Xong thì gộp thử xuống một lớp (⤓) để xem tổng thể, rồi Ctrl+Z để giữ lại các lớp rời.'],
 tips:['Part nào ở gần người xem thì nằm trên: tay-gần luôn là lớp trên cùng.',
       'Nhìn ở ×4 để bắt khe hở 1px — ở ×20 mắt sẽ bỏ qua.',
       'Bật Trục giữa để canh thân và đầu cùng một trục.'],
 trap:'Part chỉ chạm mép nhau: khi động đậy 1px là hiện ra khe trắng giữa cổ và thân.'},

{p:6,size:32,t:'Ba tư thế từ một bộ part',time:'60 phút',frames:3, art:'rigpose',
 layers:['Tay xa','Chân xa','Chân gần','Thân','Đầu','Tay gần'],
 goal:'Hiểu sức mạnh của bộ part: đổi tư thế mà không vẽ lại.',
 steps:['Khung 1 đứng yên. Nhân bản sang khung 2 và 3.',
        'Khung 2 — chỉ tay: chỉ vẽ lại mỗi lớp tay-gần thành dáng chếch lên, vai giữ nguyên chỗ cũ. Khung 3 — nhún người: hạ thân 2px và hạ đầu theo thân, chân đứng yên.',
        'Mỗi khung tự hỏi: đầu, vai, hông có còn thẳng hàng hợp lý không?',
        'Chạy xem trước ở 3 fps để thấy ba tư thế nối nhau.'],
 tips:['Dùng ⇋ Lật ngang cho tay/chân thay vì vẽ lại phía đối diện.',
       'Đầu hạ theo thân, nếu quên thì nhân vật thành "cổ cao su".',
       'Tư thế đọc được là tư thế mà silhouette đã kể xong câu chuyện.'],
 trap:'Dịch part mà quên dịch phần nối — hở cổ, hở nách, thấy rất rõ khi chạy animation.'},

{p:6,size:32,t:'Vẫy tay 6 khung bằng cách dịch part',time:'70 phút',frames:6, art:'cutout',
 layers:['Tay xa','Chân xa','Chân gần','Thân','Đầu','Tay gần'],
 goal:'Animation đầu tiên làm hoàn toàn bằng dịch part (cutout animation).',
 steps:['Nhân bản tư thế đứng thành 6 khung.',
        'Mỗi khung chỉ dịch/lật lớp tay-gần theo một cung: xuống → ngang → chếch lên → lên → chếch lên → ngang.',
        'Thêm 1px nhấp nhô cho thân ở khung 3 và 5 để cả người cùng tham gia.',
        'Chạy 10 fps, bật Bóng khung trước để chỉnh cho bàn tay đi theo đường cong đều.'],
 tips:['Bàn tay phải đi theo một cung tròn, không đi theo đường thẳng gãy.',
       'Khoảng cách giữa hai khung liên tiếp = tốc độ. Cách xa thì nhanh, sát nhau thì chậm.',
       'Khung đầu và khung cuối phải nối được vào nhau nếu muốn lặp.'],
 trap:'Chỉ tay động, cả người còn lại đứng chết cứng → trông như hình cắt giấy.'},

{p:6,size:32,t:'Dọn nét: từ lắp ghép sang vẽ tay',time:'60 phút',frames:3, art:'cleanup',
 goal:'Biến bản lắp ghép thô thành sprite hoàn chỉnh — bước mà đa số người mới bỏ qua.',
 steps:['Lấy 3 khung của bài vẫy tay, gộp mỗi khung xuống một lớp.',
        'Trên từng khung: xoá viền thừa chỗ hai part chồng nhau, nối liền viền ngoài thành một đường duy nhất.',
        'Sửa vai và nách cho biến dạng theo tay — khớp thật thì da và áo phải kéo theo.',
        'So lại bằng cách chạy animation: có khung nào giật lên không?'],
 tips:['Sau khi dọn, silhouette phải là một khối liền, không thấy dấu vết part.',
       'Chỗ nào khi động đậy trông "cứng như gỗ" thì chỗ đó cần vẽ tay lại.',
       'Giữ file bản lắp ghép (còn lớp rời) tách khỏi bản đã dọn — sau này sửa tư thế còn dùng lại được.'],
 trap:'Coi bản lắp ghép là bản cuối. Cutout chỉ là bộ khung; sprite mượt luôn cần một lượt vẽ tay.'},

/* --- Chặng 7 --- */
{p:7,size:32,t:'Idle 4 khung (thở)',time:'50 phút',frames:4, art:'idle2',
 goal:'Nhân vật đứng yên mà vẫn sống.',
 steps:['Lấy nhân vật 32×32 đã vẽ, nhân bản thành 4 khung.',
        'Khung 2 và 4: hạ thân xuống 1px, vai hạ 1px. Khung 3: về gốc.',
        'Chạy ở 6 fps và tinh chỉnh.'],
 tips:['Dịch 1px là đủ. Đây là biên độ nhỏ nhất mà mắt vẫn thấy.','Tóc và áo có thể trễ 1 khung so với thân (secondary motion).'],
 trap:'Dịch cả sprite lên xuống 2–3px → trông như nhảy lò cò.'},

{p:7,size:32,t:'Vòng đi 4 khung nhìn ngang',time:'90 phút',frames:4, art:'walk4',
 goal:'Walk cycle — bài kiểm tra lớn nhất của animation pixel.',
 steps:['4 khung: chân trái trước (contact), giữa (passing), chân phải trước, giữa.',
        'Đầu nhấp nhô 1px: cao ở khung passing, thấp ở khung contact.',
        'Chạy 8 fps, kiểm tra không bị "trượt băng".'],
 tips:['Vẽ chân trước, thân sau, tay cuối cùng (tay ngược pha với chân).','Nếu chân trông trượt: bước chân cần dài hơn hoặc fps thấp hơn.'],
 trap:'Cả 4 khung chân bước cùng độ dài → mất nhịp, trông như trôi.'},

{p:7,size:48,t:'Đòn chém 5 khung',time:'90 phút',frames:5, art:'timing',
 goal:'Hành động có lực: lấy đà, bung, giữ.',
 steps:['Khung 1–2: lấy đà ngược hướng (anticipation). Khung 3: bung nhanh với vệt mờ (smear).',
        'Khung 4: khung va chạm, có thể phóng to nhân vật 1px hoặc rung.',
        'Khung 5: thu về.'],
 tips:['Khung smear được phép vẽ méo, dài, phi thực tế — chỉ hiện 1/12 giây.','Dành nhiều khung cho lấy đà hơn cho bung.'],
 trap:'Chia đều thời gian mọi khung → đòn đánh mềm oặt, không có cú "đập".'},

{p:7,size:32,t:'Hiệu ứng nổ 8 khung',time:'70 phút',frames:8, art:'explode',
 goal:'VFX loop dùng được cho mọi game.',
 steps:['Khung 1–2: lõi sáng nhỏ, trắng. Khung 3–5: bung to, chuyển vàng → cam.',
        'Khung 6–8: tan thành khói xám, thu nhỏ và loãng dần.',
        'Chạy 12 fps.'],
 tips:['Nổ = sáng → nóng → nguội → tan. Đổi cả màu, không chỉ đổi kích thước.','Hình dáng nên bất đối xứng và khác nhau ở từng khung.'],
 trap:'Vòng tròn to dần đều → trông như bong bóng, không phải nổ.'},

{p:7,size:32,t:'Giãn cách khung: quả bóng nảy',time:'50 phút',frames:6, art:'spacing',
 goal:'Thứ quyết định "mượt" không phải số khung, mà là khoảng cách giữa các khung.',
 steps:['6 khung một quả bóng rơi xuống rồi nảy lên.',
        'Lúc rơi nhanh: hai khung cách nhau xa (6–8px). Lúc lên tới đỉnh: cách nhau gần (1–2px).',
        'Khung chạm đất: bẹt quả bóng lại (squash). Khung ngay sau đó: kéo dài ra (stretch).',
        'Chạy 12 fps. Nếu trông đều đều như máy thì khoảng cách của bạn còn đang đều.'],
 tips:['Vật thể luôn chậm ở hai đầu chuyển động và nhanh ở giữa — đó là easing.',
       'Squash & stretch phải giữ nguyên khối lượng: bẹt ngang thì phải cao lên tương ứng.',
       'Đo bằng mắt trên onion skin: nhìn dãy vệt của tâm quả bóng có thưa-dày đúng không.'],
 trap:'Chia đều khoảng cách mọi khung → chuyển động trôi đều, không có trọng lực.'},

{p:7,size:32,t:'Chuyển động phụ: tóc và áo trễ khung',time:'50 phút',frames:4, art:'overlap',
 goal:'Mẹo rẻ nhất để một animation trông "sống": phần mềm đi sau phần cứng.',
 steps:['Lấy lại idle hoặc vẫy tay 4 khung, tách tóc (và vạt áo) ra một lớp riêng.',
        'Ở mỗi khung, dịch lớp tóc theo thân nhưng <b>trễ một khung</b>: thân đã lên rồi tóc mới lên.',
        'Khung thân dừng hẳn: cho tóc đi quá đà 1px rồi mới về (follow through).',
        'Chạy 8 fps và so với bản không có trễ.'],
 tips:['Càng mềm càng trễ nhiều: đuôi áo choàng có thể trễ 2 khung, tóc ngắn chỉ 1.',
       'Đừng cho mọi thứ trễ cùng nhau — chọn 1–2 chi tiết thôi.',
       'Đây cũng là cách làm khăn, đuôi, dây lưng, lá cờ.'],
 trap:'Mọi bộ phận chuyển động cùng lúc, cùng biên độ → cứng như con rối gỗ.'},

/* --- Chặng 8: nhìn ngang, nhân vật hành động --- */
{p:8,size:48,t:'Tư thế thủ nhìn ngang',time:'60 phút', art:'sideprop',
 layers:['Phác khối','Nét chính','Tô khối'],
 goal:'Một tư thế đứng nói được nhân vật này làm nghề gì — mốc gốc của cả bộ động tác.',
 steps:['Kẻ 4 đường mốc trên lớp Phác khối: đỉnh đầu, vai, hông, mặt đất. Nhân vật cao 4 đầu, đầu chiếm 1/4 — tỉ lệ của dòng action platformer.',
        'Vẽ silhouette một màu: chân hơi tách, trọng tâm hạ thấp, vai xoay chếch về phía người xem, vũ khí cầm ở tay gần.',
        'Đưa 2px trống dưới chân làm mốc tiếp đất, và ghi nhớ con số đó — mọi khung sau đều phải dùng đúng mốc này.',
        'Tô khối theo một nguồn sáng, dùng tối đa 16 màu.'],
 tips:['Nhìn ngang thì mặt chỉ còn một con mắt và một đường mũi — đừng vẽ hai mắt.',
       'Tóc, khăn, vạt áo choàng là nơi kể chuyển động sau này: cho chúng nhô ra khỏi silhouette.',
       'Chân hơi mở tạo thế đứng vững; chân sát nhau trông như đang đứng nghiêm.'],
 trap:'Vẽ tư thế đứng thẳng đơ như hình mẫu giải phẫu — không dùng lại được cho khung nào khác.'},

{p:8,size:48,t:'Idle 4 khung: thở và lắc áo',time:'50 phút',frames:4, art:'sideidle',
 goal:'Đứng yên mà vẫn sống, không tốn khung.',
 steps:['Nhân bản tư thế thủ thành 4 khung.',
        'Khung 2 và 4 hạ thân 1px; khung 3 về gốc. Bàn chân tuyệt đối không nhúc nhích.',
        'Tóc và vạt áo trễ 1 khung so với thân.',
        'Chạy 6 fps.'],
 tips:['Vai hạ theo thân nhưng chỉ 1px, đầu gần như đứng yên.','Nếu thấy giật, kiểm tra xem có khung nào chân bị lệch 1px không.'],
 trap:'Cho cả người nhấp nhô 2–3px → thành nhún nhảy chứ không phải thở.'},

{p:8,size:48,t:'Chạy 8 khung nhìn ngang',time:'2 giờ',frames:8, art:'run8',
 goal:'Bài khó nhất của game hành động 2D — và là thứ người xem đánh giá đầu tiên.',
 steps:['8 khung theo vòng: chạm đất → hạ thấp → lướt qua → vươn lên, rồi lặp lại với chân kia.',
        'Thân nhấp nhô 2px: thấp nhất ở khung hạ, cao nhất ở khung vươn.',
        'Tay ngược pha với chân. Áo choàng và tóc bay ngược hướng chạy, trễ 1 khung.',
        'Chạy 12–14 fps, kiểm tra bàn chân có bị "trượt băng" không.'],
 tips:['Vẽ 4 khung cực trị trước (2 chạm đất, 2 lướt qua), 4 khung còn lại chỉ là trung gian.',
       'Bước chân dài hơn bạn tưởng: gót chân sau phải rời khỏi mặt đất rõ ràng.',
       'Bật Bóng khung trước và nhìn quỹ đạo đỉnh đầu — phải là một đường sóng đều.'],
 trap:'Chỉ đổi chân mà thân đứng yên → nhân vật trượt trên băng chứ không chạy.'},

{p:8,size:48,t:'Bộ nhảy 5 khung',time:'70 phút',frames:5, art:'jump5',
 goal:'Nhảy trong game không phải một animation liền — nó là 5 trạng thái engine gọi riêng.',
 steps:['Khung 1 nhún lấy đà (giữ 2–3 khung thời gian). Khung 2 bật lên, người vươn dài.',
        'Khung 3 đỉnh: co chân, giữ lâu nhất — đây là lúc người chơi thấy rõ nhất.',
        'Khung 4 rơi: chân duỗi xuống đón đất, áo bay ngược lên.',
        'Khung 5 tiếp đất: nhún sâu rồi mới về tư thế thủ.'],
 tips:['Lên nhanh, đỉnh chậm, xuống nhanh — đó là trọng lực.',
       'Người vươn dài khi bật và co lại khi ở đỉnh: squash & stretch đúng chỗ.',
       'Trong engine: khung 3 lặp khi còn bay, khung 4 lặp khi rơi.'],
 trap:'Chia đều 5 khung → cú nhảy nhẹ bẫng, không có sức nặng.'},

{p:8,size:48,t:'Combo chém 3 đòn có vệt',time:'2 giờ',frames:6, art:'slash4',
 goal:'Đòn đánh có lực: lấy đà, bung kèm vệt, khung chạm, rồi thu.',
 steps:['Đòn 1 (khung 1–2): lấy đà ngược hướng rồi bung ngang, vệt kiếm là một cung sáng 2 màu.',
        'Đòn 2 (khung 3–4): chém ngược lại, vệt đi theo hướng ngược.',
        'Đòn 3 (khung 5–6): đâm hoặc chém xoay, vệt to nhất, thân lao tới trước 2–3px.',
        'Mỗi đòn phải trở về được tư thế thủ để engine nối combo.'],
 tips:['Vệt kiếm sáng ở mép ngoài, mờ dần vào trong — và chỉ tồn tại 1–2 khung.',
       'Khung chạm: đẩy cả nhân vật tới trước 2px, đó là cảm giác "va" mà người chơi thấy.',
       'Lưỡi kiếm ở khung nhanh nhất được phép biến mất, chỉ còn vệt.'],
 trap:'Vẽ vệt kiếm kéo dài qua 4–5 khung → trông như cầm que phát sáng, mất cảm giác chém.'},

{p:8,size:48,t:'Khung nhoè (smear) và trúng đòn',time:'60 phút',frames:3, art:'smear',
 goal:'Hai khung rẻ tiền nhất nhưng làm game "đã tay" hẳn.',
 steps:['Khung 1: khung smear của đòn chém — kéo lưỡi kiếm thành vệt méo, phi thực tế.',
        'Khung 2: nhân vật trúng đòn — ngả người về sau, đầu hất ra, toàn thân phủ một lớp trắng.',
        'Khung 3: ngã gục — đổ nghiêng, kiếm rời tay, tóc và áo đổ theo trọng lực.'],
 tips:['Khung phủ trắng chỉ hiện 1–2 khung, engine thường tự làm nhưng vẽ tay vẫn đẹp hơn.',
       'Khi ngã, silhouette phải đổi hẳn sang phương ngang để đọc được ngay.'],
 trap:'Khung smear vẽ quá đẹp và quá lâu → hết tác dụng, vì mắt kịp nhìn thấy nó méo.'},

/* --- Chặng 9: nhìn ngang, tile & cảnh nền --- */
{p:9,size:16,t:'Tile đất nhìn ngang: mặt trên và thân',time:'50 phút', art:'sidetile',
 goal:'Hiểu khác biệt gốc rễ: top-down nhìn xuống mặt đất, side view nhìn vào vách cắt của nó.',
 steps:['Vẽ tile 16×16: 1px cỏ sáng trên cùng, 2px cỏ tối, phần còn lại là thân đất.',
        'Thân đất tối dần xuống dưới — đó là ánh sáng trời chiếu từ trên.',
        'Rắc vài viên sạn sáng hơn, nhưng đừng rắc ở giữa tile (mắt sẽ thấy hoa văn lặp).',
        'Bật Lặp 3×3 để kiểm tra mối nối.'],
 tips:['Ranh giới cỏ–đất phải gãy khúc ngẫu nhiên, không được là một đường thẳng.',
       'Tile thân (nằm sâu dưới đất) vẽ riêng, không có cỏ.'],
 trap:'Tô đất một màu phẳng rồi kẻ cỏ lên trên → nhìn như nhìn từ trên xuống, không có chiều sâu.'},

{p:9,size:32,t:'Bộ tile nền: giữa, mép, góc, dốc',time:'90 phút',frames:6, art:'platedge',
 goal:'Đủ để dựng một màn platformer thật.',
 steps:['6 khung: ô giữa, mép trái, mép phải, góc trên-trái, góc trên-phải, dốc 45°.',
        'Mép bên là vách cắt: tối hơn mặt trước một bậc, có vân đá dọc.',
        'Bo tròn hai góc trên của bệ và cho vài túm cỏ rủ xuống mép.',
        'Xuất spritesheet và ghép thử một bệ 3 ô, một bệ 1 ô.'],
 tips:['Dốc dùng bậc 2:1 hoặc 1:1, và phải khớp được với ô giữa ở cả hai đầu.',
       'Cỏ rủ xuống mép là chi tiết rẻ nhất để bệ hết trông như viên gạch.'],
 trap:'Làm mép trước ô giữa → ghép vào thấy vênh, phải vẽ lại cả bộ.'},

{p:9,size:32,h:64,t:'Vách đá và lớp phủ',time:'70 phút',frames:2, art:'sidescene',
 goal:'Cho khối đất có chiều sâu thay vì là một mảng đặc.',
 steps:['Khung 1: một vách đá cao, chia mảng lớn nhỏ khác nhau, càng xuống sâu càng tối và càng ít chi tiết.',
        'Khung 2: lớp phủ đặt đè lên vách — dây leo, rễ cây, vệt rêu, đá lồi.',
        'Lớp phủ phải phá được đường thẳng đứng của vách.'],
 tips:['Chi tiết dồn ở phần trên (nơi mắt nhìn), phần dưới để trống cho đỡ rối.',
       'Rêu và dây leo dùng màu của cỏ ở tile đất để cả màn cùng một palette.'],
 trap:'Rải chi tiết đều khắp vách → mắt không có chỗ nghỉ, nhân vật bị chìm vào nền.'},

{p:9,size:64,h:32,t:'Ba lớp nền lùi xa cho màn ngang',time:'80 phút',frames:3, art:'parallax',
 goal:'Chiều sâu bằng tương phản, không bằng chi tiết.',
 steps:['Khung 1: trời + núi xa, nhạt, ngả màu trời, gần như không chi tiết.',
        'Khung 2: rừng hoặc mái nhà tầm trung, tối hơn một bậc.',
        'Khung 3: lớp tiền cảnh — cành cây, bụi cỏ cắt ngang mép dưới màn hình, tối nhất.',
        'Xếp chồng 3 lớp và tự hỏi: nhân vật có nổi lên khỏi nền không?'],
 tips:['Lớp nào càng xa thì càng ít tương phản và càng ngả về màu trời.',
       'Tiền cảnh nên tối gần như silhouette — nó chỉ để tạo khung, không để nhìn.'],
 trap:'Nền vẽ đẹp ngang nhân vật → người chơi không biết nhìn vào đâu.'},

{p:9,size:64,t:'Ghép một khung cảnh hoàn chỉnh',time:'2 giờ', art:'sidescene',
 goal:'Kiểm tra cuối: nhân vật, tile, nền có thuộc về cùng một thế giới không.',
 steps:['Dựng một cảnh 64×64: mặt đất, một bệ lơ lửng, một dốc, nền lùi xa, và nhân vật đứng đúng mốc chân.',
        'Kiểm tra: cùng palette? cùng hướng sáng? nhân vật có tách khỏi nền không?',
        'Thêm bóng đổ dưới chân nhân vật và dưới bệ.',
        'Nhìn ở ×2 và nheo mắt — còn phân biệt được nhân vật với nền không?'],
 tips:['Nhân vật nên là chỗ tương phản mạnh nhất màn hình.',
       'Bóng đổ dưới bệ giúp người chơi biết bệ đang lơ lửng chứ không dán vào nền.'],
 trap:'Nhân vật và tile vẽ ở hai mức chi tiết khác nhau — lỗi lộ ra ngay khi ghép cảnh.'},


/* ===================== LỘ TRÌNH RIÊNG: ASSET KIỂU TERRARIA =====================
   Số thật của Terraria: khối là 16×16 pixel, xếp trong tilesheet cách nhau 2px
   (bước 18px). Ở đây luyện tại 32×32 cho dễ nhìn và dễ sửa tay; bài cuối Phần 0
   cho vẽ lại đúng 16×16 để quen con số thật. Vật phẩm và quái thì 32×32 là cỡ
   dùng được luôn. ============================================================= */

/* --- Phần 0 --- */
{tr:'terraria',p:11,size:16,t:'Đọc vị phong cách Terraria',time:'30 phút', art:'terrablock',
 goal:'Hiểu luật số 1: khối thì KHÔNG viền, vật phẩm thì viền đen kín.',
 steps:['Mở Terraria (hoặc ảnh chụp trên wiki), phóng to một khối đá và một cây kiếm trong túi đồ.',
        'Với mỗi cái, tự trả lời: có viền đen không? đếm được mấy màu? sáng đến từ đâu?',
        'Vẽ lại một khối đá 16×16 theo đúng nhận xét vừa rút ra: không viền, sạn dày, mép trên sáng.',
        'Đặt bốn bản sao khối đó cạnh nhau và nhìn: có thấy lưới ô vuông không?'],
 tips:['Khối nào trong game cũng kề khối khác — vẽ viền đen quanh khối là cả màn hình thành lưới ca-rô.',
       'Vật phẩm thì ngược lại: nó nằm trên nền bất kỳ (túi đồ, đất, nước) nên cần viền để bật ra.',
       'Nền hang rất tối, nên khối phải sáng hơn cảm giác ban đầu của bạn.'],
 trap:'Bê nguyên thói quen viền đen kín từ vẽ vật phẩm sang vẽ khối — lỗi số một của người mới làm mod.'},

{tr:'terraria',p:11,size:32,t:'Dải màu hang động dùng chung',time:'40 phút', art:'terrapal',
 goal:'Năm dải bốn bậc cho đá, đất, cỏ, gỗ, quặng — xương sống màu của cả bộ.',
 steps:['Dùng panel Dải màu theo chất liệu: Đá cho đá, Gỗ cho gỗ và đất, Lá cho cỏ, Vàng cho quặng.',
        'Mỗi dải để 4 bậc, lệch tông 20–25°. Đưa từng dải vào bảng màu.',
        'Bấm PNG bảng màu để lưu lại — mọi bài sau đều lấy màu từ đúng file này.',
        'Vẽ thử năm ô vuông cạnh nhau, mỗi ô một vật liệu, để so tương quan sáng tối.'],
 tips:['Đá và đất phải khác nhau rõ ở độ sáng, không chỉ khác tông — trong hang tối chỉ độ sáng còn đọc được.',
       'Bốn bậc là đủ cho một khối. Năm bậc trở lên bắt đầu rối và khó lặp.',
       'Quặng phải là thứ tươi nhất bảng, vì nó là phần thưởng người chơi đi tìm.'],
 trap:'Mỗi khối chọn màu riêng theo cảm hứng → cả hang trông như ghép từ ba game khác nhau.'},

{tr:'terraria',p:11,size:16,t:'Phác ở 32 rồi rút về khổ thật 16',time:'30 phút',size:32,frames:2, art:'terra16',
 goal:'Quen khổ thật của Terraria trước khi làm cả bộ.',
 steps:['Khung 1: phác một khối đá thoải mái ở khổ 32×32 — cứ nhiều sạn, nhiều vết nứt.',
        'Đổi khổ về 16×16 rồi vẽ lại chính khối đó ở khung 2 — lần này mỗi viên sạn chỉ được 1 pixel.',
        'Bật Lặp 3×3 để soi mối nối ở cỡ thật.',
        'So hai khung: chi tiết nào buộc phải bỏ? Ghi lại — đó là danh sách những thứ không đáng vẽ ở khổ thật.'],
 tips:['Ở 16×16 một viên sạn chỉ còn 1 pixel; đừng vẽ sạn ba màu.',
       'Mod Terraria thật (tModLoader) cần đúng 16×16, và tilesheet chừa 2px giữa các ô.',
       'Từ Phần 1 trở đi mọi khối đều vẽ thẳng ở 16×16 — đúng khổ game dùng.'],
 trap:'Vẽ ở 32 rồi thu nhỏ xuống 16 bằng máy — pixel nhoè hết, phải vẽ tay lại từ đầu.'},

/* --- Phần 1 --- */
{tr:'terraria',p:12,size:16,t:'Khối đá và ba biến thể',time:'60 phút',frames:4, art:'terrablock',
 goal:'Khối nền tảng, lặp kín màn hình mà mắt không thấy hoa văn lặp.',
 steps:['Khung 1: khối đá gốc. Sáng ở 3–4 hàng trên, tối dần xuống đáy.',
        'Rắc sạn: vài pixel sáng hơn và tối hơn một bậc, rải ngẫu nhiên, tránh dồn cụm ở giữa.',
        'Khung 2–4: ba biến thể — đổi chỗ đám sạn, thêm một vết nứt, một hõm tối. Giữ nguyên bố cục sáng-tối.',
        'Bật Lặp 3×3 ở từng khung để chắc không lộ mối.'],
 tips:['Trong game engine sẽ rải ngẫu nhiên 3–4 biến thể — đó là cách phá cảm giác lặp mà không tốn công.',
       'Đừng để chi tiết nào chạm sát mép trừ khi bạn cố ý cho nó nối sang khối bên.',
       'Vết nứt nên đi chéo, không đi thẳng đứng.'],
 trap:'Ba biến thể khác nhau quá nhiều về độ sáng → nhìn thành ba loại đá chứ không phải một.'},

{tr:'terraria',p:12,size:16,t:'Khối đất có cỏ phủ',time:'60 phút',frames:3, art:'terraghep',
 goal:'Khối hai vật liệu — chỗ người mới hay để lộ mối nối nhất.',
 steps:['Khung 1: khối đất trơn. Khung 2: khối đất có cỏ phủ mép trên.',
        'Viền cỏ phải nhấp nhô ngẫu nhiên (dày 2–4 pixel tuỳ cột), không được là một đường thẳng.',
        'Cho vài sợi cỏ rủ xuống thân đất, và vài hạt đất nhô lên trên.',
        'Khung 3: khối cỏ ở mép trái — cỏ phủ cả cạnh trên lẫn cạnh trái.',
        'Ghép hai khối cỏ cạnh nhau và kiểm tra: đường cỏ có chạy liền không?'],
 tips:['Chỗ giao cỏ–đất là nơi kể chuyện: cho nó lởm chởm thì cả hang trông tự nhiên hơn.',
       'Cỏ tối hơn ở chỗ giáp đất, sáng nhất ở đỉnh.'],
 trap:'Đường cỏ thẳng băng ngang khối → nhìn như dán băng dính xanh lên viên gạch.'},

{tr:'terraria',p:12,size:16,t:'Tường lát phía sau',time:'45 phút',frames:2, art:'terrawall',
 goal:'Cùng vật liệu nhưng phải lùi hẳn ra sau lưng người chơi.',
 steps:['Khung 1: khối đá đặc. Khung 2: tường đá — cùng tông nhưng tối hơn 2 bậc và tương phản thấp hẳn.',
        'Bỏ hết chi tiết sắc; giữ lại một đường lát mờ chia ô.',
        'Đặt cạnh nhau và nheo mắt: tường phải chìm, khối phải nổi.'],
 tips:['Tường chiếm diện tích lớn nhất màn hình nên nó phải là thứ ít gây chú ý nhất.',
       'Quy tắc nhanh: tường = khối đó giảm sáng 40% và giảm tương phản một nửa.'],
 trap:'Tường vẽ đẹp và rõ ngang khối → người chơi không phân biệt được chỗ nào đứng được, chỗ nào rơi.'},

{tr:'terraria',p:12,size:16,t:'Quặng nhúng trong đá',time:'50 phút',frames:3, art:'terraore',
 goal:'Phần thưởng của người chơi — bắt mắt từ xa mà vẫn thuộc về khối đá.',
 steps:['Nhân bản khối đá gốc ra 3 khung.',
        'Mỗi khung rắc 3–4 cụm quặng, mỗi cụm 3–5 pixel, có đúng một pixel sáng nhất làm ánh kim.',
        'Ba loại: đồng (cam), bạc (xám sáng), vàng (vàng tươi). Chỉ đổi dải màu, giữ nguyên vị trí cụm.',
        'Nhìn ở ×2: còn nhận ra loại quặng không?'],
 tips:['Cụm quặng nên bám vào chỗ tối của đá để tương phản mạnh hơn.',
       'Dùng Thay màu phụ → chính để đổi loại quặng trong một nốt nhạc.'],
 trap:'Rắc quặng kín mặt khối → mất cảm giác đá có lẫn quặng, thành khối kim loại đặc.'},

{tr:'terraria',p:12,size:16,t:'Gỗ, thân cây và lá',time:'60 phút',frames:3, art:'terrawood',
 goal:'Vật liệu xây nhà và cây trong rừng.',
 steps:['Khung 1: khối gỗ ván — vân dọc, hai đường ghép ngang, đầu ván sáng hơn.',
        'Khung 2: thân cây — vân dọc, mép trái sáng mép phải tối.',
        'Khung 3: tán lá — cụm lá 2 bậc xanh, mép lởm chởm, có vài lỗ hở thấy nền.',
        'Ghép thân và tán rồi soi silhouette.'],
 tips:['Ván gỗ trong game xếp so le, nên đừng để mối ghép nằm chính giữa khối.',
       'Tán lá phải có lỗ hở, nếu không nó thành một cục xanh đặc.'],
 trap:'Vân gỗ vẽ đều tăm tắp như kẻ dòng → trông như tôn sóng chứ không phải gỗ.'},

/* --- Phần 2 --- */
{tr:'terraria',p:13,size:32,t:'Thanh kim loại bốn loại',time:'50 phút',frames:4, art:'terrabar',
 goal:'Vật phẩm chế tạo cơ bản nhất — và bài palette swap hoàn hảo.',
 steps:['Khung 1: một thanh kim loại nhìn chéo — mặt trên sáng, mặt bên tối, viền đen kín.',
        'Khung 2–4: đồng, bạc, vàng. Chỉ đổi dải màu, giữ nguyên từng pixel hình dáng.',
        'Kiểm tra trên nền tối và nền sáng: viền có giữ được hình không?'],
 tips:['Mặt trên của thanh là chỗ sáng nhất; cạnh dưới cùng gần như đen.',
       'Bốn màu là đủ cho một thanh: viền, tối, thân, sáng.'],
 trap:'Đổi cả màu viền theo kim loại → bộ vật phẩm mất tính đồng bộ.'},

{tr:'terraria',p:13,size:32,t:'Kiếm nằm chéo 45°',time:'70 phút', art:'terraitem',
 goal:'Dáng chuẩn của mọi vũ khí cầm tay trong Terraria.',
 steps:['Vẽ kiếm chạy chéo từ góc dưới-trái lên góc trên-phải, đúng 45° (mỗi bước 1 ngang 1 dọc).',
        'Lưỡi rộng 2–3 pixel, có một dải sáng chạy dọc sống kiếm.',
        'Chắn tay và cán bằng vật liệu khác (vàng, gỗ) để tách khối.',
        'Viền đen kín toàn bộ. Đặt lên nền đá vừa vẽ để kiểm tra độ nổi.'],
 tips:['45° cho nét sắc nhất; góc khác sẽ ra bậc thang lởm chởm.',
       'Chuôi chiếm khoảng 1/3 chiều dài — cán ngắn quá thì trông như dao găm.',
       'Một đốm sáng duy nhất gần mũi kiếm là đủ để nó ánh thép.'],
 trap:'Lưỡi kiếm dày 1 pixel → trong túi đồ nhìn như que tăm.'},

{tr:'terraria',p:13,size:32,t:'Cuốc và rìu',time:'60 phút',frames:2, art:'terratool',
 goal:'Công cụ hai vật liệu — kim loại gắn vào cán gỗ.',
 steps:['Khung 1: cuốc — đầu kim loại nhọn hai bên, cán gỗ chéo 45°.',
        'Khung 2: rìu — lưỡi bản rộng một bên, đối trọng nhỏ bên kia.',
        'Chỗ kim loại ôm cán phải thấy được đai buộc (2–3 pixel tối).',
        'Dùng lại đúng dải kim loại và dải gỗ của bài trước.'],
 tips:['Cán gỗ và lưỡi kim loại phải khác hẳn độ sáng, không chỉ khác tông.',
       'Đầu công cụ nên chiếm nửa trên khung, cán chạy xuống góc dưới-trái.'],
 trap:'Vẽ cuốc và rìu ở hai cỡ khác nhau → xếp trong túi đồ thấy ngay cái lệch.'},

{tr:'terraria',p:13,size:32,t:'Lọ thuốc và vật phẩm phát sáng',time:'50 phút',frames:3, art:'potions3',
 goal:'Vật phẩm trong suốt và vật phẩm tự phát sáng.',
 steps:['Khung 1–2: hai lọ thuốc khác màu nước, giữ nguyên thuỷ tinh và nút bần.',
        'Khung 3: một vật phẩm phát sáng (đuốc hoặc tinh thể) — sáng nhất ở lõi, toả ra 2 bậc.',
        'Vật phát sáng thì bỏ viền đen ở phía sáng nhất, để nó như đang rọi ra.'],
 tips:['Thuỷ tinh: sáng ở viền, trong ở giữa, một vệt chéo trắng.',
       'Vật phát sáng là ngoại lệ duy nhất được phá luật viền kín.'],
 trap:'Cho vật phát sáng một quầng mờ nhiều bậc → hết là pixel art, thành ảnh blur.'},

/* --- Phần 3 --- */
{tr:'terraria',p:14,size:32,h:48,t:'Nhân vật nhìn ngang',time:'90 phút', art:'terrachar',
 layers:['Phác khối','Nét chính','Tô khối'],
 goal:'Nhân vật cao khoảng 3 khối, đứng lọt hành lang 2 khối.',
 steps:['Kẻ mốc: nhân vật cao 40–44 pixel trong khung 32×48, tức khoảng 2,5–3 ô khối 16px.',
        'Đầu to hơn tỉ lệ thật một chút, thân gọn, chân ngắn — dáng đọc được ở cỡ nhỏ.',
        'Nhìn ngang: một mắt, tóc che nửa mặt, tay gần vẽ đè lên thân.',
        'Viền tối chọn lọc quanh người, đen kín ở chỗ giáp nền sáng.'],
 tips:['Nhân vật phải lọt qua khe cao 2 khối — đó là ràng buộc thiết kế của Terraria.',
       'Quần áo là chỗ kể tính cách; mặt ở cỡ này gần như không nói được gì.'],
 trap:'Vẽ cao 4–5 khối cho oai → không chui lọt hang do chính mình đào.'},

{tr:'terraria',p:14,size:32,h:48,t:'Bảng khung đi bốn khung',time:'90 phút',frames:4, art:'terrawalk',
 goal:'Vòng đi tối thiểu, chân không trượt.',
 steps:['4 khung: chạm đất, hạ thấp, lướt qua, vươn lên.',
        'Thân nhấp nhô đúng 1–2 pixel. Bàn chân giữ nguyên hàng pixel dưới cùng.',
        'Tay ngược pha với chân.',
        'Chạy 10 fps, bật Bóng khung trước để canh.'],
 tips:['Dùng Soi bài để kiểm mốc chân — nó báo ngay khung nào lệch.',
       'Nhân vật Terraria đi khá nhanh nên biên độ chân phải rộng.'],
 trap:'Đầu nhấp nhô cùng pha với chân → trông như đang nhún nhảy chứ không phải đi.'},

{tr:'terraria',p:14,size:32,t:'Quái slime',time:'60 phút',frames:3, art:'terraslime',
 goal:'Quái đầu tiên của mọi người chơi — thân trong suốt, có vật thể bên trong.',
 steps:['Khung 1: slime đứng yên — khối tròn hơi bẹt, đáy rộng.',
        'Khung 2: nén xuống trước khi nhảy. Khung 3: kéo dài lên khi bật.',
        'Thân trong suốt: đáy tối hơn, viền sáng, một đốm sáng lệch trên-trái.',
        'Thả một vật thể nhỏ bên trong (đồng xu, hạt gel) cho vui mắt.'],
 tips:['Giữ nguyên khối lượng: bẹt ngang thì phải thấp xuống tương ứng.',
       'Trong suốt nghĩa là thấy được nền phía sau ở phần thân, chỉ viền là đặc.'],
 trap:'Vẽ slime đặc như quả bóng cao su → mất hẳn đặc trưng của nó.'},

/* --- Phần 4 --- */
{tr:'terraria',p:15,size:16,t:'Dựng tilesheet đúng lưới',time:'60 phút',frames:6, art:'terrasheet',
 goal:'File xuất ra cắm được vào engine mà không phải cắt tay.',
 steps:['Đưa 6 khối đã vẽ vào 6 khung theo đúng thứ tự bạn muốn trong sheet.',
        'Xuất PNG spritesheet ở nhân 1.',
        'Mở file và kiểm: mỗi ô có đúng bằng nhau không? có ô nào lệch 1 pixel không?',
        'Ghi chú quy ước đặt tên: dat_giua, dat_trai, dat_goc_tren_trai…'],
 tips:['Terraria chừa 2px giữa các ô trong tilesheet để tránh rỉ màu khi phóng to; sheet ở đây xuất khít nhau, nên khi đưa vào tModLoader phải chèn khoảng đệm đó.',
       'Luôn giữ file .json gốc; PNG chỉ là bản dùng.'],
 trap:'Xuất ở nhân 4 rồi đưa thẳng vào game — engine sẽ hiểu sai kích thước ô.'},

{tr:'terraria',p:15,size:32,t:'Bộ 12 asset và phép thử hang tối',time:'3 giờ',frames:12, art:'terraset',
 goal:'Sản phẩm cuối: một bộ dùng được, đồng nhất, đã thử ở đúng bối cảnh.',
 steps:['12 khung: 3 khối nền, 1 tường, 2 quặng, 3 vật phẩm, 1 nhân vật, 2 quái.',
        'Chốt: cùng bảng màu, cùng hướng sáng từ trên, khối không viền, vật phẩm viền kín.',
        'Đổi nền canvas sang màu hang tối rồi soi lại từng cái: có cái nào biến mất không?',
        'Chạy Soi bài trên vài khung để bắt màu lạc và pixel lạc.'],
 tips:['Cái nào lệch thì sửa cái đó, đừng đổi palette chung.',
       'Nhìn cả 12 cạnh nhau ở ×2 mới thấy được cái nào lạc điệu.'],
 trap:'Chỉ soi asset trên nền xám của trình vẽ — vào game nền tối thì nửa số asset chìm nghỉm.'},

/* --- Chặng 10 --- */
{p:10,size:48,t:'Kẻ địch và trùm',time:'90 phút',frames:2, art:'enemy',
 goal:'Thiết kế hình để người chơi đọc được mức nguy hiểm.',
 steps:['Khung 1: quái thường. Khung 2: bản trùm — to hơn, thêm 1 đặc điểm đe doạ (gai, sừng, mắt đỏ).',
        'Dùng cùng palette với nhân vật chính nhưng dồn về tông tối/lạnh.',
        'Đảm bảo silhouette khác hẳn nhân vật chính.'],
 tips:['Người chơi phải phân biệt bạn/địch trong 1/4 giây.','Màu đỏ tươi nên để dành cho điểm nguy hiểm.'],
 trap:'Quái cùng bảng màu, cùng dáng với nhân vật → gây nhầm lẫn khi chơi.'},

{p:10,size:32,t:'Bộ asset nhỏ dùng chung palette',time:'3–4 giờ',frames:12, art:'palettebar',
 goal:'Sản phẩm thật đầu tiên: 12 asset đồng nhất.',
 steps:['Chốt 1 palette ≤ 24 màu và 1 hướng sáng cho toàn bộ.',
        '12 khung: 1 nhân vật, 3 tile nền, 4 vật phẩm, 2 props, 2 icon UI.',
        'Xuất spritesheet, dán vào Godot và xem cùng nhau trên một màn hình.'],
 tips:['Xem tất cả cạnh nhau mới thấy cái nào lệch tông.','Cái nào lệch thì sửa cái đó, đừng đổi palette chung.'],
 trap:'Vẽ từng asset riêng lẻ nhiều ngày → cuối cùng không cái nào hợp cái nào.'},

{p:10,size:48,t:'Vòng soát đồng nhất',time:'2 giờ', art:'pivot',
 goal:'Kỹ năng của người làm asset chuyên nghiệp: pass kiểm tra cuối.',
 steps:['Mở lại toàn bộ asset đã vẽ, lập bảng kiểm: cùng palette? cùng hướng sáng? cùng độ dày viền? cùng mức chi tiết?',
        'Sửa mọi chỗ lệch, kể cả phải vẽ lại từ đầu 1–2 asset.',
        'Lưu palette ra một PNG dải màu để dùng cho các asset sau.'],
 tips:['Mức chi tiết là thứ hay bị lệch nhất: một asset quá mịn sẽ tố cáo các asset còn lại.','Lưu file .json làm bản gốc, xuất PNG làm bản dùng.'],
 trap:'Bỏ qua pass này — game sẽ luôn trông "chắp vá" dù từng asset đều đẹp.'}
];

/* Tiến độ lưu theo TÊN BÀI, không theo số thứ tự: chèn bài mới vào giữa lộ trình
   là số thứ tự lệch hết, còn tên thì không. */
/* Hai lộ trình tách biệt: lộ trình chung, và bộ asset kiểu Terraria.
   Bộ chọn ở đầu thẻ Bài tập lọc cả danh sách bài lẫn danh sách lý thuyết. */
export const TRACKS={core:'Lộ trình chung', terraria:'Bộ Terraria'};
export let track='core';
export function setTrack(t){ track = TRACKS[t] ? t : 'core'; }
export const inTrack = o => (o.tr||'core')===track;

export const doneSet = new Set();
export const exKey = ex => ex.t;
/* bản lưu cũ ghi số thứ tự — chỉ bài thuộc Chặng 0–5 mới còn đúng vị trí,
   vì mọi lần chèn về sau đều nằm sau chúng */
export function migrateDone(list){
  const safe = EXERCISES.filter(e=>e.p<=5).length;
  let mat=0, mat2=0;
  doneSet.clear();
  list.forEach(v=>{
    if(typeof v==='string'){ doneSet.add(v); mat2++; return; }
    if(v<safe && EXERCISES[v]){ doneSet.add(exKey(EXERCISES[v])); mat++; }
  });
  return {cu:mat, moi:mat2, bo:list.length-mat-mat2};
}
export function setupExercise(ex){
  const nf = ex.frames||1;
  const W=ex.size, H=ex.h||ex.size;
  if(!confirm('Dựng khung '+W+'×'+H+(nf>1?' • '+nf+' khung hình':'')+
              '\n\nBản đang vẽ sẽ được cất vào thư viện trước, không mất đi đâu.')) return;
  if(!keepBeforeReplace()) return;
  pushUndo();
  doc.w=W; doc.h=H;
  const names = ex.layers || ['Phác thảo','Nét chính'];
  doc.layers=names.map(n=>({name:n,vis:true}));
  doc.frames=[]; doc.dur=[];
  view.sel=null;                       // bài mới thì bắt đầu sạch, không nhốt nét vẽ trong vùng chọn cũ
  for(let i=0;i<nf;i++) doc.frames.push(doc.layers.map(()=>new Uint32Array(W*H)));
  doc.af=0; doc.al = ex.layers ? doc.layers.length-1 : Math.min(1, doc.layers.length-1);
  invalidateBuf(); fitZoom(); syncAll();
}
/* Đổ mẫu tham khảo thành pixel mờ vào một lớp riêng, canh giữa canvas.
   Mẫu to hơn khung thì cắt bớt — vẫn đủ để lấy dáng. */
export function loadDemoLayer(name){
  const cv=demoToCanvas(name);
  if(!cv) return;
  const g=cv.getContext('2d');
  const src=new Uint32Array(g.getImageData(0,0,cv.width,cv.height).data.buffer);
  pushUndo();
  let li=doc.layers.findIndex(l=>l.name==='Mẫu');
  if(li<0){
    doc.layers.unshift({name:'Mẫu',vis:true});
    doc.frames.forEach(f=>f.unshift(new Uint32Array(doc.w*doc.h)));
    li=0; doc.al=Math.min(doc.al+1, doc.layers.length-1);
  }
  const dst=doc.frames[doc.af][li];
  dst.fill(0);
  const ox=Math.floor((doc.w-cv.width)/2), oy=Math.floor((doc.h-cv.height)/2);
  for(let y=0;y<cv.height;y++) for(let x=0;x<cv.width;x++){
    const v=src[y*cv.width+x];
    if(((v>>>24)&255)===0) continue;
    const px=ox+x, py=oy+y;
    if(px<0||py<0||px>=doc.w||py>=doc.h) continue;
    dst[py*doc.w+px] = (v & 0x00ffffff) | (110<<24);      // giữ màu, hạ độ đục để vẽ đè
  }
  syncAll();
}
export function buildExercises(){
  const box=$('#exList'); box.innerHTML='';
  PHASES.forEach((ph,pi)=>{
    if(!inTrack(ph)) return;
    const list = EXERCISES.filter(e=>e.p===pi);
    const det=document.createElement('details'); det.className='phase'; if(pi===0) det.open=true;
    const sum=document.createElement('summary');
    const doneN = list.filter(e=>doneSet.has(exKey(e))).length;
    sum.innerHTML = '<span class="pn">'+ph.n+'</span><span>'+ph.t+'</span><span class="pc">'+doneN+'/'+list.length+'</span>';
    det.appendChild(sum);
    const intro=document.createElement('div');
    intro.className='body'; intro.style.paddingTop='0';
    intro.innerHTML='<p class="kbd" style="margin:0 0 4px">'+ph.d+'</p>';
    det.appendChild(intro);

    list.forEach(ex=>{
      const gi=exKey(ex);
      const wrap=document.createElement('div');
      wrap.className='ex'+(doneSet.has(gi)?' done':'');
      wrap.dataset.k=gi;
      const num=list.indexOf(ex)+1;
      wrap.innerHTML =
        '<div class="exhead">'+
          '<label class="tick"><input type="checkbox" '+(doneSet.has(gi)?'checked':'')+' aria-label="Đánh dấu bài này đã xong"></label>'+
          '<div><div class="extitle">'+num+'. '+ex.t+'</div>'+
          '<div class="exmeta">'+ex.size+'×'+(ex.h||ex.size)+(ex.frames?' · '+ex.frames+' khung':'')+' · '+ex.time+'</div></div>'+
        '</div>'+
        '<p class="exgoal"><b>Đích đến:</b> '+ex.goal+'</p>'+
        '<ol>'+ex.steps.map(s=>'<li>'+s+'</li>').join('')+'</ol>'+
        '<ul>'+ex.tips.map(s=>'<li>'+s+'</li>').join('')+'</ul>'+
        '<p class="extrap"><b>Bẫy thường gặp:</b> '+ex.trap+'</p>';
      if(ex.art){
        const fig=renderDemo(ex.art, true);
        wrap.insertBefore(fig, wrap.children[1]);
        const lab=document.createElement('p'); lab.className='exart'; lab.textContent='Mẫu tham khảo';
        wrap.insertBefore(lab, fig);
      }
      const note=document.createElement('p'); note.className='exlint'; note.hidden=true;
      wrap.appendChild(note);
      const btns=document.createElement('div'); btns.className='exbtns';
      const b1=document.createElement('button'); b1.className='btn tiny'; b1.textContent='Dựng khung '+ex.size+'×'+(ex.h||ex.size)+(ex.frames?' ×'+ex.frames:'');
      b1.addEventListener('click', ()=>setupExercise(ex));
      btns.appendChild(b1);
      if(ex.art && DEMOS[ex.art]){
        const b2=document.createElement('button'); b2.className='btn tiny';
        b2.textContent='Nạp mẫu để vẽ đè';
        b2.title='Đổ mẫu tham khảo thành pixel mờ vào một lớp riêng, để vẽ đè lên';
        b2.addEventListener('click', ()=>loadDemoLayer(ex.art));
        btns.appendChild(b2);
      }
      wrap.appendChild(btns);
      wrap.querySelector('input').addEventListener('change', e=>{
        if(e.target.checked) doneSet.add(gi); else doneSet.delete(gi);
        wrap.classList.toggle('done', e.target.checked);
        sum.querySelector('.pc').textContent = list.filter(x=>doneSet.has(exKey(x))).length+'/'+list.length;
        updateProgress(); paintDaily();
        if(e.target.checked){                       // vừa xong thì soi luôn, đúng lúc muốn biết mình sai đâu
          const n=runLint(true);
          note.textContent = n>0
            ? '⚠ Soi nhanh: '+n+' điều nên xem lại — mở thẻ Lớp & xuất để đọc chi tiết.'
            : (n===0 ? '✓ Soi nhanh: không thấy lỗi nào ở khung đang mở.' : '');
          note.hidden = !note.textContent;
        } else note.hidden = true;
      });
      det.appendChild(wrap);
    });
    box.appendChild(det);
  });
}
export function updateProgress(){
  const list=EXERCISES.filter(inTrack);
  const xong=list.filter(e=>doneSet.has(exKey(e))).length;
  $('#progText').textContent = xong+'/'+list.length;
  autosave();
}
