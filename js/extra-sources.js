const plain=v=>String(v||'').replace(/<[^>]*>/g,' ').slice(0,4000);
const missing=message=>{const e=new Error(message||'No matching public profile returned.');e.code='not-found';throw e;};
const exact=(a,b)=>typeof a==='string'&&a.toLowerCase()===b.toLowerCase();
export const EXTRA_PROFILE_SOURCES=['Hacker News','Lichess','Chess.com','DEV.to','GitLab'];
export function extraUsernameJob(source,handle){
 const encoded=encodeURIComponent(handle);
 const hit=(username,title,url,data={})=>({source,username,title,url,method:'profile',...data});
 if(source==='Hacker News')return {source,allowNull:true,url:'https://hacker-news.firebaseio.com/v0/user/'+encoded+'.json',parse(data,url){
  if(data===null)missing('No public activity record returned; this does not prove the account is absent.');
  if(data.id!==handle||!Number.isFinite(data.created))throw new Error('Unexpected Hacker News profile response.');
  return [hit(data.id,data.id,'https://news.ycombinator.com/user?id='+encoded,{apiUrl:url,summary:plain(data.about),provenance:'Hacker News public activity profile. Usernames are case-sensitive; inactive accounts may not be returned. Identity unconfirmed.'})];
 }};
 if(source==='Lichess')return {source,url:'https://lichess.org/api/user/'+encoded,parse(data,url){
  if(!exact(data.username,handle)||!data.id)throw new Error('Unexpected Lichess profile response.');
  return [hit(data.username,data.username,'https://lichess.org/@/'+encoded,{apiUrl:url,summary:plain(data.profile?.bio),location:plain(data.profile?.location)})];
 }};
 if(source==='Chess.com')return {source,url:'https://api.chess.com/pub/player/'+encoded,parse(data,url){
  if(!exact(data.username,handle)||!data.player_id)throw new Error('Unexpected Chess.com profile response.');
  return [hit(data.username,data.name||data.username,'https://www.chess.com/member/'+encoded,{apiUrl:url,summary:'Public player profile'+(data.title?' · '+data.title:''),location:plain(data.location),provenance:'Chess.com Published Data API profile; upstream data may be cached. Identity unconfirmed. ATLAS is not affiliated with Chess.com.'})];
 }};
 if(source==='DEV.to')return {source,url:'https://dev.to/api/users/by_username?url='+encoded,parse(data,url){
  if(!exact(data.username,handle)||!data.id)throw new Error('Unexpected DEV.to profile response.');
  return [hit(data.username,data.name||data.username,'https://dev.to/'+encoded,{apiUrl:url,summary:plain(data.summary),location:plain(data.location)})];
 }};
 if(source==='GitLab')return {source,url:'https://gitlab.com/api/v4/users?username='+encoded+'&per_page=5',parse(data,url){
  if(!Array.isArray(data))throw new Error('Unexpected GitLab user response.');
  if(!data.length)missing();
  const rows=data.filter(r=>exact(r.username,handle)&&r.id);if(!rows.length)throw new Error('Returned usernames do not match the query.');
  return rows.map(r=>hit(r.username,r.name||r.username,'https://gitlab.com/'+encodeURIComponent(r.username),{apiUrl:url,summary:'Public user profile returned by exact username lookup.'}));
 }};
 return null;
}
export function stackOverflowJob(term){
 const params=new URLSearchParams({site:'stackoverflow',inname:term,pagesize:'5',order:'desc',sort:'reputation'});
 return {source:'Stack Overflow',url:'https://api.stackexchange.com/2.3/users?'+params,parse(data,url){
  if(!Array.isArray(data.items))throw new Error('Unexpected Stack Exchange response.');
  return data.items.filter(r=>Number.isInteger(r.user_id)&&typeof r.display_name==='string').map(r=>({source:'Stack Overflow',title:plain(r.display_name),url:'https://stackoverflow.com/users/'+r.user_id,apiUrl:url,summary:'Public display-name search result. Display names are not unique usernames.',location:plain(r.location),method:'display-name',provenance:'Stack Exchange API display-name substring search for '+term+'. Up to five results, ranked by reputation; not exhaustive. No exact username or identity match is claimed.'}));
 }};
}
