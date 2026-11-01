import {runBrowserSources,PROFILE_SOURCES,NAME_SOURCES} from './browser-sources.js';
import {uid,now,clean,safeUrl,escape} from './model.js';
export function normalizeSearch(raw){
 const v={};for(const k of ['username','name','location','organization','email','profiles','notes'])v[k]=clean(raw[k],1000);
 v.name=clean(v.name,160);
 v.username=v.username.replace(/^@/,'');
 if(v.username&&!/^[a-z\d_.-]{1,100}$/i.test(v.username))throw new Error('Enter one username without spaces, or paste a URL under More information.');
 if(![v.username,v.name,v.email,v.profiles].some(Boolean))throw new Error('Enter a username, a name or a public profile link.');
 if(v.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email))throw new Error('Enter a valid public professional email.');
 if(v.profiles.split('\n').filter(Boolean).some(x=>!safeUrl(x.trim())))throw new Error('Use http:// or https:// for profile links.');
 return v;
}
export function newSearch(raw){
 const input=normalizeSearch(raw),at=now();return {id:uid(),title:input.name||input.username||input.email||'Profile search',type:'person',inputs:{name:input.name,usernames:input.username,location:input.location,employer:input.organization,email:input.email,profiles:input.profiles,notes:input.notes},createdAt:at,updatedAt:at,status:'running',entities:[{id:'subject',type:'person',label:input.name||input.username||'Search subject',confidence:'possible',details:{provenance:'Search input; not independently verified'},evidenceIds:[]}],links:[],evidence:[],history:[],branches:[]};
}
export function applyResults(search,result){
 if(!Array.isArray(result.hits)||!Array.isArray(result.attempts))throw new Error('The search service returned an invalid response.');
 const seen=new Set();
 for(const hit of result.hits.slice(0,60)){
  const url=safeUrl(hit.url);if(!url||seen.has(url))continue;seen.add(url);
  const id=uid(),node='reference:'+uid(),source=clean(hit.source,200),title=clean(hit.title,500)||url;
  const detail={url,lookupMethod:hit.method==='profile'?'Exact username / direct profile':hit.method==='display-name'?'Display-name search (not unique)':'Name / public-reference search',username:clean(hit.username),location:clean(hit.location),organization:clean(hit.organization),provenance:hit.provenance|| (hit.method==='index'?'Search-index snippet; original page not fetched.':'Public profile API response; self-reported fields.')};
  const comparison=['location','organization'].filter(k=>detail[k]&&(k==='organization'?search.inputs.employer:search.inputs.location)).map(k=>{const known=k==='organization'?search.inputs.employer:search.inputs.location;return k+': '+(known.toLowerCase()===detail[k].toLowerCase()?'matches supplied text':'differs from supplied text');}).join('; ');
  search.evidence.push({id,title,source,url:safeUrl(hit.apiUrl)||url,retrievedAt:hit.retrievedAt&&Number.isFinite(Date.parse(hit.retrievedAt))?new Date(hit.retrievedAt).toISOString():now(),confidence:'possible',method:'api',summary:clean(hit.summary,4000)||'Public profile returned. No biography supplied.',details:{...detail,comparison,transient:hit.method==='index'?'true':'false',cache:hit.cached?'reused':'fresh'}});
  search.entities.push({id:node,type:hit.entityType==='document'?'document':'profile',label:title,confidence:'possible',details:{...detail,source,comparison},evidenceIds:[id]});
  search.links.push({id:uid(),source:'subject',target:node,label:hit.method==='profile'?'username match':hit.method==='display-name'?'display-name candidate':'name reference',confidence:'possible',evidenceIds:[id],explanation:'This reference matches a search identifier. It does not confirm the same person.',reviewedAt:null});
 }
 search.history=result.attempts.slice(0,60).map(a=>({id:uid(),at:now(),connector:clean(a.source,100),target:search.title,status:clean(a.status,100),message:clean(a.message,2000)}));
 if(result.collection)search.history.push({id:uid(),at:now(),connector:'ATLAS collection',target:search.title,status:'complete',message:Number(result.collection.requests||0)+' source request(s); '+Number(result.collection.reused||0)+' response(s) reused from temporary cache. Source retrieval dates are preserved.'});
 const incomplete=search.history.some(h=>['unavailable','not-configured','unsupported','cancelled'].includes(h.status));search.status=incomplete?'partial':'complete';search.updatedAt=now();return search;
}
export function persistentCopy(search){
 const copy=structuredClone(search),transient=new Set(copy.evidence.filter(e=>e.details.transient==='true').map(e=>e.id));
 copy.evidence=copy.evidence.filter(e=>!transient.has(e.id));copy.entities=copy.entities.filter(e=>!e.evidenceIds.some(id=>transient.has(id)));const ids=new Set(copy.entities.map(e=>e.id));copy.links=copy.links.filter(l=>ids.has(l.source)&&ids.has(l.target));return copy;
}
export async function serviceStatus(){return {sources:PROFILE_SOURCES,nameSources:NAME_SOURCES};}
export async function automaticSearch(values,signal,fetcher=fetch){return runBrowserSources(normalizeSearch(values),signal,fetcher);}
