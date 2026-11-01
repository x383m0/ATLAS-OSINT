import {validateCase} from './model.js';
let db;
export async function openStorage() {
  if (!globalThis.indexedDB) throw new Error('IndexedDB is unavailable. Enable browser storage to use ATLAS.');
  db = await new Promise((resolve,reject)=>{
    const request=indexedDB.open('atlas-osint',1);
    request.onupgradeneeded=()=>request.result.createObjectStore('cases',{keyPath:'id'});
    request.onsuccess=()=>{request.result.onversionchange=()=>request.result.close();resolve(request.result);};
    request.onerror=()=>reject(request.error);
    request.onblocked=()=>reject(new Error('Close other ATLAS tabs to open storage.'));
  });
}
async function transaction(mode, action) {
  if (!db) throw new Error('Local storage is not open.');
  return new Promise((resolve,reject)=>{
    const tx=db.transaction('cases',mode), result=action(tx.objectStore('cases'));
    tx.oncomplete=()=>resolve(result?.result); tx.onerror=()=>reject(tx.error); tx.onabort=()=>reject(tx.error||new Error('Local save failed.'));
  });
}
export async function loadCases() { return (await transaction('readonly',s=>s.getAll())).map(validateCase).map(c=>{if(c.status==='running'){c.status='partial';for(const h of c.history)if(h.status==='running'){h.status='error';h.message='Previous collection was interrupted. Start a new run to continue.';}}return c;}).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)); }
export const saveCase=c=>transaction('readwrite',s=>s.put(validateCase(c)));
export const deleteCase=id=>transaction('readwrite',s=>s.delete(id));
export async function importCases(cases) { const checked=cases.map(validateCase); await transaction('readwrite',s=>{for(const c of checked)s.add(c);}); }
export const clearCases=()=>transaction('readwrite',s=>s.clear());
