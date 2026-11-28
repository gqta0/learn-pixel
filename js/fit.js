/* Bậc phóng nguyên lớn nhất để bản vẽ docW×docH nằm trọn trong khung boxW×boxH (đã trừ pad). Không DOM. */
export function fitScale(docW, docH, boxW, boxH, pad=0, max=28){
  const fit=Math.floor(Math.min((boxW-pad)/docW, (boxH-pad)/docH));
  return Math.max(1, Math.min(max, fit || 1));
}
