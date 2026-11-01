export const VERSION = 2;
export const CONFIDENCES = ['possible', 'probable', 'verified', 'rejected'];
export const ENTITY_TYPES = ['person','username','profile','organization','website','domain','ip','repository','record','document'];
export const uid = () => crypto.randomUUID();
export const now = () => new Date().toISOString();
export const clean = (v, max = 2000) => typeof v === 'string' ? v.trim().slice(0, max) : '';
export const escape = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function safeUrl(value) {
  try { const u = new URL(value); return ['https:', 'http:'].includes(u.protocol) && !u.username && !u.password ? u.href : ''; } catch { return ''; }
}
function iso(v) { if (!v || !Number.isFinite(Date.parse(v))) throw new Error('Invalid timestamp in import.'); return new Date(v).toISOString(); }
function array(v,max,label) { if (!Array.isArray(v) || v.length>max) throw new Error('Invalid or oversized '+label+'.'); return v; }
function txt(v,max=2000) { if (typeof v !== 'string' || v.length>max) throw new Error('Invalid text in import.'); return v; }
function confidence(v) { if (!CONFIDENCES.includes(v)) throw new Error('Invalid confidence in import.'); return v; }
function details(v) {
  if (!v || typeof v!=='object' || Array.isArray(v)) return {};
  const out = Object.create(null);
  for (const [k,x] of Object.entries(v).slice(0,40)) if (!['__proto__','constructor','prototype'].includes(k) && ['string','number','boolean'].includes(typeof x)) out[k.slice(0,100)] = String(x).slice(0,6000);
  return out;
}
export function validateCase(raw) {
  if (!raw || !['person','cyber'].includes(raw.type)) throw new Error('Invalid investigation type.');
  const c = {id:txt(raw.id,160),title:txt(raw.title,160),type:raw.type,inputs:{},createdAt:iso(raw.createdAt),updatedAt:iso(raw.updatedAt),status:['ready','running','manual','complete','partial','cancelled'].includes(raw.status)?raw.status:'ready'};
  if (!c.id || !c.title) throw new Error('Case ID and title are required.');
  for (const k of ['name','aliases','usernames','email','location','employer','profiles','website','notes','domain']) c.inputs[k] = clean(raw.inputs?.[k], k==='notes'?6000:2000);
  c.entities=array(raw.entities,3000,'entities').map(e=>({id:txt(e.id,500),label:txt(e.label,2000),type:ENTITY_TYPES.includes(e.type)?e.type:'document',confidence:confidence(e.confidence),details:details(e.details),evidenceIds:array(e.evidenceIds,3000,'evidence references').map(x=>txt(x,160))}));
  c.evidence=array(raw.evidence,10000,'evidence').map(e=>({id:txt(e.id,160),title:txt(e.title,2000),source:txt(e.source,200),url:safeUrl(txt(e.url,4000)),retrievedAt:iso(e.retrievedAt),confidence:confidence(e.confidence),method:e.method==='manual'?'manual':'api',summary:txt(e.summary,16000),details:details(e.details)}));
  const ids=new Set(c.entities.map(e=>e.id)), evidenceIds=new Set(c.evidence.map(e=>e.id));
  if (ids.size!==c.entities.length || evidenceIds.size!==c.evidence.length) throw new Error('Duplicate entity or evidence identifiers.');
  const refs=v=>array(v,3000,'references').map(x=>{txt(x,160);if(!evidenceIds.has(x))throw new Error('Evidence reference is missing.');return x;});
  c.entities.forEach(e=>refs(e.evidenceIds));
  c.links=array(raw.links,10000,'links').map(l=>{if(!ids.has(l.source)||!ids.has(l.target))throw new Error('Graph link points to a missing entity.');return {id:txt(l.id,160),source:l.source,target:l.target,label:txt(l.label,200),confidence:confidence(l.confidence),evidenceIds:refs(l.evidenceIds),explanation:txt(l.explanation||'',4000),reviewedAt:l.reviewedAt?iso(l.reviewedAt):null};});
  if (new Set(c.links.map(l=>l.id)).size!==c.links.length) throw new Error('Duplicate relationship identifiers.');
  c.history=array(raw.history,10000,'history').map(h=>({id:txt(h.id,160),at:iso(h.at),connector:txt(h.connector,100),target:txt(h.target,500),status:txt(h.status,100),message:txt(h.message||'',2000)}));
  c.branches=array(raw.branches||[],3000,'branches').map(b=>({id:txt(b.id,160),connector:txt(b.connector,100),target:txt(b.target,500),reason:txt(b.reason,2000),status:['proposed','approved','dismissed','completed'].includes(b.status)?b.status:'proposed',depth:Math.min(2,Math.max(1,Number(b.depth)||1)),evidenceId:b.evidenceId && evidenceIds.has(b.evidenceId)?b.evidenceId:null}));
  return c;
}
export function parseImport(text) {
  if (text.length>15_000_000) throw new Error('Import exceeds the 15 MB limit.');
  const raw=JSON.parse(text); if(raw.app!=='ATLAS' || raw.version!==VERSION)throw new Error('Choose an ATLAS history export (schema version 2).');
  const cases=array(raw.cases,200,'investigations').map(validateCase);
  if(new Set(cases.map(c=>c.id)).size!==cases.length)throw new Error('Duplicate investigation identifiers.');
  return cases;
}
export function serialize(cases) { return JSON.stringify({app:'ATLAS',version:VERSION,exportedAt:now(),cases},null,2); }
