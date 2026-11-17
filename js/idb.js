/* Kho lưu IndexedDB cho thư viện bản vẽ và bản tự lưu.
   localStorage chỉ được khoảng 5 triệu ký tự cho cả trang — bảy clip hoạt ảnh ở cỡ ~93 px
   đã chiếm gần nửa. IndexedDB được hàng trăm MB và lưu thẳng mảng, không phải chuỗi JSON.
   Trình duyệt chặn IndexedDB (một số chế độ riêng tư) thì mọi hàm trả về lỗi để nơi gọi
   quay về localStorage như cũ. */
const DB='lo-pixel', VER=2;                       // 2: thêm kho tilesets cho trang Tile
export const STORES={projects:'projects', kv:'kv', tilesets:'tilesets'};
let dbp=null;

export function idbAvailable(){
  try{ return typeof indexedDB!=='undefined' && !!indexedDB; }catch(_){ return false; }
}
function open(){
  if(!idbAvailable()) return Promise.reject(new Error('trình duyệt không có IndexedDB'));
  if(!dbp) dbp=new Promise((ok,fail)=>{
    const req=indexedDB.open(DB,VER);
    req.onupgradeneeded=()=>{
      const db=req.result;
      for(const s of Object.values(STORES)) if(!db.objectStoreNames.contains(s)) db.createObjectStore(s);
    };
    req.onsuccess=()=>{
      const db=req.result;
      // trang kia (Vẽ / Tile) cần nâng phiên bản: nhả kết nối để nó không bị chặn, lần sau mở lại
      db.onversionchange=()=>{ db.close(); dbp=null; };
      ok(db);
    };
    req.onerror=()=>{ dbp=null; fail(req.error||new Error('không mở được IndexedDB')); };
    // tab cũ (bản trước) còn giữ kết nối phiên bản 1: chờ nó nhả ra thay vì hỏng luôn — lời mở tự chạy tiếp
    // khi tab đó đóng hoặc tải lại. Báo cho trang biết để nhắc người dùng.
    req.onblocked=()=>{ try{ globalThis.dispatchEvent?.(new CustomEvent('idbblocked')); }catch(_){} };
  });
  return dbp;
}
function tx(store,mode,fn){
  return open().then(db=>new Promise((ok,fail)=>{
    const t=db.transaction(store,mode), s=t.objectStore(store);
    let out;
    const r=fn(s);
    if(r) r.onsuccess=()=>{ out=r.result; };
    t.oncomplete=()=>ok(out);
    t.onerror=()=>fail(t.error||new Error('lỗi IndexedDB'));
    t.onabort=()=>fail(t.error||new Error('IndexedDB huỷ giao dịch (có thể hết chỗ)'));
  }));
}
export const idbGet=(store,key)=>tx(store,'readonly',s=>s.get(key));
export const idbSet=(store,key,val)=>tx(store,'readwrite',s=>s.put(val,key));
export const idbDel=(store,key)=>tx(store,'readwrite',s=>s.delete(key));
/* toàn bộ cặp khoá → giá trị của một kho */
export function idbAll(store){
  return open().then(db=>new Promise((ok,fail)=>{
    const out={}, t=db.transaction(store,'readonly'), req=t.objectStore(store).openCursor();
    req.onsuccess=()=>{ const c=req.result; if(c){ out[c.key]=c.value; c.continue(); } };
    t.oncomplete=()=>ok(out);
    t.onerror=()=>fail(t.error);
  }));
}
/* Xin trình duyệt giữ dữ liệu lâu dài (không tự xoá khi máy thiếu chỗ). Gọi một lần là đủ. */
let asked=false;
export function askPersist(){
  if(asked) return; asked=true;
  try{ navigator.storage?.persist?.(); }catch(_){}
}
/* dung lượng đã dùng / hạn mức, tính bằng MB — để người dùng thấy còn bao nhiêu chỗ */
export async function storageUsage(){
  try{
    const e=await navigator.storage?.estimate?.();
    if(!e) return null;
    return {used:(e.usage||0)/1048576, quota:(e.quota||0)/1048576};
  }catch(_){ return null; }
}
