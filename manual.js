import {PROFILE_LINKS} from './profile-links.js';
import {safeUrl,clean,uid,now} from './model.js';

export function manualLinks(search){
 const i=search?.inputs||{},links=[],seen=new Set();
 const add=(source,url,kind)=>{url=safeUrl(url);if(url&&!seen.has(url)){seen.add(url);links.push({source,url,kind});}};
 const handle=clean(i.usernames,100);
 if(handle){
  for(const row of PROFILE_LINKS)add(row.source,row.template.replaceAll('{account}',encodeURIComponent(handle)),'Suggested profile address');
  add('GitHub','https://github.com/'+encodeURIComponent(handle),'Suggested profile address');
  add('Bluesky','https://bsky.app/profile/'+encodeURIComponent(handle.includes('.')?handle:handle+'.bsky.social'),'Suggested profile address');
  add('Mastodon.social','https://mastodon.social/@'+encodeURIComponent(handle),'Suggested profile address');
 }
 const quote=s=>'"'+clean(s,200).replaceAll('"',' ')+'"';
 const queries=[];
 if(handle)queries.push(quote(handle));
 if(i.name){queries.push(quote(i.name));const context=[i.location,i.employer].filter(Boolean).map(quote);if(context.length)queries.push([quote(i.name),...context].join(' '));}
 for(const terms of queries){
  add('Google: '+terms,'https://www.google.com/search?q='+encodeURIComponent(terms),'Search link');
  add('Bing: '+terms,'https://www.bing.com/search?q='+encodeURIComponent(terms),'Search link');
 }
 for(const raw of String(i.profiles||'').split('\n').slice(0,10)){const url=safeUrl(raw.trim());if(url)add(new URL(url).hostname,url,'Supplied link');}
 return links;
}

export function saveObservation(search,values){
 const url=safeUrl(values.url),link=manualLinks(search).find(l=>l.url===url);
 const observation=clean(values.observation,4000);
 if(!link||!observation)throw new Error('Choose a supplied check link and describe what you observed.');
 const at=now(),id=uid(),node='reference:'+uid(),title=clean(link.source,160);
 const detail={url,lookupMethod:'Manual review',provenance:'User-recorded observation. ATLAS did not retrieve or verify this page.'};
 search.evidence.push({id,title,source:clean(link.source,200),url,retrievedAt:at,confidence:'possible',method:'manual',summary:observation,details:detail});
 search.entities.push({id:node,type:link.kind==='Search link'?'document':'profile',label:title,confidence:'possible',details:detail,evidenceIds:[id]});
 search.links.push({id:uid(),source:'subject',target:node,label:'manual observation',confidence:'possible',evidenceIds:[id],explanation:'Saved by the user after manual review. The same identity has not been confirmed.',reviewedAt:at});
 search.updatedAt=at;
 return search;
}
