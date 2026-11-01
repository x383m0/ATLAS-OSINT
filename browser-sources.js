import {EXTRA_PROFILE_SOURCES,extraUsernameJob,stackOverflowJob} from './extra-sources.js';
import {safeUrl} from './model.js';
export const PROFILE_SOURCES=['GitHub','Bluesky','Mastodon.social',...EXTRA_PROFILE_SOURCES];
export const NAME_SOURCES=['Wikidata','Wikipedia (EN/FR)','Stack Overflow display names'];
const cooldown=new Map();
class BrowserSourceError extends Error{constructor(message,code='unavailable'){super(message);this.code=code;}}
export async function browserJSON(url,signal,fetcher=fetch,allowNull=false){
 try{
  if(signal?.aborted)throw new BrowserSourceError('Search cancelled.','cancelled');
  const response=await fetcher(url,{credentials:'omit',referrerPolicy:'no-referrer',signal:signal?AbortSignal.any([signal,AbortSignal.timeout(12000)]):AbortSignal.timeout(12000),headers:{Accept:'application/json'}});
  if(response.status===404)throw new BrowserSourceError('No public profile returned.','not-found');
  if(response.status===429||(response.status===403&&response.headers.get('x-ratelimit-remaining')==='0'))throw new BrowserSourceError('Source rate limited. Try again later.','rate-limit');
  if(!response.ok)throw new BrowserSourceError('Source returned HTTP '+response.status+'.');
  const data=await response.json();if(data===null&&allowNull)return null;if(data?.error_id)throw new BrowserSourceError('Source returned an API error: '+String(data.error_message||data.error_name||data.error_id),data.error_name==='throttle_violation'?'rate-limit':'unavailable');if(!data||typeof data!=='object'||data.error)throw new BrowserSourceError('Source rejected the request or returned an invalid response.');return data;
 }catch(error){
  if(signal?.aborted)throw new BrowserSourceError('Search cancelled.','cancelled');
  if(error instanceof BrowserSourceError)throw error;
  throw new BrowserSourceError(error.name==='TimeoutError'?'Source timed out.':'Source blocked or unreachable from this browser (network or cross-origin restriction).');
 }
}
function usernameJob(source,handle){
 const extra=extraUsernameJob(source,handle);if(extra)return extra;
 const patterns={'GitHub':/^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i,'Bluesky':/^[a-z\d][a-z\d.-]{0,99}$/i,'Mastodon.social':/^[a-z\d_]{1,30}$/i};
 if(!patterns[source].test(handle))return {source,skip:'This username format is not supported by this source.'};
 const encoded=encodeURIComponent(handle),actor=handle.includes('.')?handle:handle+'.bsky.social';
 if(source==='GitHub')return {source,url:'https://api.github.com/users/'+encoded,parse(data,url){
  if(typeof data.login!=='string'||data.login.toLowerCase()!==handle.toLowerCase()||!data.id)throw new Error('Unexpected profile response.');
  return [{source,title:data.name||data.login,url:'https://github.com/'+encoded,apiUrl:url,username:data.login,summary:data.bio||'',location:data.location||'',organization:data.company||'',method:'profile'}];
 }};
 if(source==='Bluesky')return {source,url:'https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor='+encodeURIComponent(actor),parse(data,url){
  if(typeof data.handle!=='string'||data.handle.toLowerCase()!==actor.toLowerCase()||!data.did)throw new Error('Unexpected profile response.');
  return [{source,title:data.displayName||data.handle,url:'https://bsky.app/profile/'+encodeURIComponent(actor),apiUrl:url,username:data.handle,summary:data.description||'',method:'profile'}];
 }};
 return {source,url:'https://mastodon.social/api/v1/accounts/lookup?acct='+encoded,parse(data,url){
  if(typeof data.acct!=='string'||data.acct.toLowerCase()!==handle.toLowerCase()||!data.id)throw new Error('Unexpected profile response.');
  return [{source,title:data.display_name||handle,url:'https://mastodon.social/@'+encoded,apiUrl:url,username:handle,summary:String(data.note||'').replace(/<[^>]*>/g,' '),method:'profile'}];
 }};
}
export function planBrowserSearch(values){
 const jobs=[],seen=new Set();
 function add(job){const key=job.source+'|'+(job.url||job.skip);if(!seen.has(key)){jobs.push(job);seen.add(key);}}
 if(values.username)for(const source of PROFILE_SOURCES)add(usernameJob(source,values.username));
 for(const term of new Set([values.username,values.name].filter(Boolean)))add(stackOverflowJob(term));
 for(const raw of values.profiles.split('\n').filter(Boolean).slice(0,3)){
  const url=new URL(raw.trim()),parts=url.pathname.split('/').filter(Boolean);
  if(url.hostname==='github.com'&&parts.length===1)add(usernameJob('GitHub',parts[0]));
  else if(url.hostname==='bsky.app'&&parts.length===2&&parts[0]==='profile')add(usernameJob('Bluesky',parts[1]));
  else if(url.hostname==='mastodon.social'&&parts.length===1&&parts[0].startsWith('@'))add(usernameJob('Mastodon.social',parts[0].slice(1)));
  else if(['gitlab.com','dev.to'].includes(url.hostname)&&parts.length===1)add(usernameJob(url.hostname==='gitlab.com'?'GitLab':'DEV.to',decodeURIComponent(parts[0])));
  else if(url.hostname==='lichess.org'&&parts.length===2&&parts[0]==='@')add(usernameJob('Lichess',decodeURIComponent(parts[1])));
  else if(url.hostname==='www.chess.com'&&parts.length===2&&parts[0]==='member')add(usernameJob('Chess.com',decodeURIComponent(parts[1])));
  else if(url.hostname==='news.ycombinator.com'&&url.pathname==='/user'&&url.searchParams.get('id'))add(usernameJob('Hacker News',url.searchParams.get('id')));
  else add({source:url.hostname,skip:'This website does not have a supported direct browser collector. Its link is retained as supplied context.'});
 }
 if(values.name){
  const params=new URLSearchParams({action:'wbsearchentities',search:values.name,language:'en',uselang:'en',limit:'5',type:'item',format:'json',origin:'*'});
  add({source:'Wikidata',url:'https://www.wikidata.org/w/api.php?'+params,parse(data,url){
   if(!Array.isArray(data.search))throw new Error('Invalid Wikidata response.');
   return data.search.filter(row=>/^Q\d+$/.test(row.id)).slice(0,5).map(row=>({source:'Wikidata',title:row.label||row.id,url:'https://www.wikidata.org/wiki/'+row.id,apiUrl:url,summary:row.description||'No description returned.',method:'knowledge',entityType:'document',provenance:'Wikidata label search; may match people or other subjects. No personal identity has been verified.'}));
  }});
  const quoteTerm=value=>'"'+value.replaceAll('"',' ')+'"';
  const exactName=quoteTerm(values.name),context=[values.location,values.organization].filter(Boolean).map(quoteTerm).join(' ');
  const variations=context?[exactName,exactName+' '+context]:[exactName];
  for(const lang of ['en','fr'])for(const terms of variations){
   const params=new URLSearchParams({action:'query',list:'search',srsearch:terms,srlimit:'5',srprop:'snippet',format:'json',origin:'*'});
   add({source:'Wikipedia ('+lang.toUpperCase()+(terms===exactName?'':', context')+')',url:'https://'+lang+'.wikipedia.org/w/api.php?'+params,parse(data,url){
    if(!Array.isArray(data.query?.search))throw new Error('Invalid Wikipedia response.');
    return data.query.search.filter(row=>typeof row.title==='string'&&Number.isInteger(row.pageid)).slice(0,5).map(row=>({source:'Wikipedia ('+lang.toUpperCase()+')',title:row.title,url:'https://'+lang+'.wikipedia.org/?curid='+row.pageid,apiUrl:url,summary:String(row.snippet||'').replace(/<[^>]*>/g,' '),method:'knowledge',entityType:'document',provenance:'Public-reference search for '+terms+'. Mentioning a name does not establish the same identity; full article not fetched.'}));
   }});
  }
 }
 if(!jobs.length)add({source:'Search coverage',skip:'Enter a username or name, or a supported public profile URL. Email alone cannot be searched by these browser sources.'});
 return jobs.slice(0,32);
}
export async function runBrowserSources(values,signal,fetcher=fetch){
 const jobs=planBrowserSearch(values),results=new Array(jobs.length),origins=new Map();
 async function run(job){
  const attempt={source:job.source,status:'unavailable',message:''};
  if(job.skip)return {attempt:{...attempt,status:'unsupported',message:job.skip},hits:[]};
  if((cooldown.get(job.source)||0)>Date.now())return {attempt:{...attempt,message:'Source is cooling down after a rate limit.'},hits:[]};
  try{
   const data=await browserJSON(job.url,signal,fetcher,job.allowNull);
   if(Number(data?.backoff)>0)cooldown.set(job.source,Date.now()+Math.max(60,Number(data.backoff))*1000);
   if(signal?.aborted)throw new BrowserSourceError('Search cancelled.','cancelled');
   const hits=job.parse(data,job.url).filter(hit=>safeUrl(hit.url));return {hits,attempt:{...attempt,status:hits.length?'complete':'no-results',message:hits.length?hits.length+' public reference(s) returned. Identity unconfirmed.':'No references returned by this query; coverage may be incomplete.'}};
  }catch(error){if(error.code==='rate-limit')cooldown.set(job.source,Date.now()+60000);return {hits:[],attempt:{...attempt,status:error.code==='not-found'?'not-found':error.code==='cancelled'?'cancelled':'unavailable',message:error.message}};}
 }
 let cursor=0;
 async function worker(){while(cursor<jobs.length){const i=cursor++,job=jobs[i],origin=job.url?new URL(job.url).origin:job.source,previous=origins.get(origin)||Promise.resolve();const pending=previous.catch(()=>{}).then(()=>run(job));origins.set(origin,pending);results[i]=await pending;}}
 await Promise.all(Array.from({length:Math.min(4,jobs.length)},()=>worker()));
 if(signal?.aborted)throw new BrowserSourceError('Search cancelled.','cancelled');
 return {hits:results.flatMap(r=>r.hits),attempts:results.map(r=>r.attempt)};
}
