import assert from 'node:assert/strict';
import {extraUsernameJob,EXTRA_PROFILE_SOURCES,stackOverflowJob} from '../js/extra-sources.js';
import {automaticSearch,newSearch,applyResults,persistentCopy} from '../js/search.js';
import {parseImport,serialize} from '../js/model.js';
const fixtures={
 'Hacker News':{id:'sample',created:123,about:'<b>Public bio</b>'},
 'Lichess':{id:'sample',username:'Sample',profile:{bio:'Public bio',location:'Example'}},
 'Chess.com':{player_id:123,username:'sample',name:'Sample',location:'Example'},
 'DEV.to':{id:123,username:'sample',name:'Sample',summary:'Public bio'},
 'GitLab':[{id:123,username:'sample',name:'Sample'}]
};
let count=0;
async function test(name,fn){await fn();count++;console.log('PASS '+name);}
for(const source of EXTRA_PROFILE_SOURCES){
 await test(source+' requires a matching username and stable profile identifier',()=>{const job=extraUsernameJob(source,'sample');const hits=job.parse(fixtures[source],job.url);assert.equal(hits.length,1);assert.equal(hits[0].method,'profile');assert.match(hits[0].url,/^https:\/\//);const bad=structuredClone(fixtures[source]);if(Array.isArray(bad))bad[0].username='other';else if(source==='Hacker News')bad.id='Sample';else bad.username='other';assert.throws(()=>job.parse(bad,job.url));});
}
await test('HN missing public activity is not reported as a found account',()=>{assert.throws(()=>extraUsernameJob('Hacker News','sample').parse(null),/public activity/);});
await test('GitLab empty arrays are negative; malformed payloads are uncertain',()=>{assert.throws(()=>extraUsernameJob('GitLab','sample').parse([]),e=>e.code==='not-found');assert.throws(()=>extraUsernameJob('GitLab','sample').parse({}),e=>e.code!=='not-found');});
await test('Stack Overflow candidates keep distinct display-name provenance after export',()=>{const job=stackOverflowJob('Sample Person');const hits=job.parse({items:[{user_id:123,display_name:'Sample Person',location:'Example'}]},job.url);const s=applyResults(newSearch({name:'Sample Person'}),{hits,attempts:[]});const restored=parseImport(serialize([persistentCopy(s)]))[0];assert.match(restored.links[0].label,/display-name/);assert.match(restored.evidence[0].details.lookupMethod,/not unique/);assert.match(restored.evidence[0].details.provenance,/substring/);});
await test('Collection scheduler bounds concurrency and serializes each origin without truncating mixed searches',async()=>{
 let active=0,maximum=0;const origins=new Map(),calls=[];
 const result=await automaticSearch({username:'sample',name:'Sample Person',location:'Example',organization:'Example Org',profiles:'https://lichess.org/@/another\nhttps://www.chess.com/member/another\nhttps://dev.to/another'},null,async url=>{const origin=new URL(url).origin;assert.equal(origins.get(origin)||0,0);origins.set(origin,1);active++;maximum=Math.max(maximum,active);calls.push(url);await new Promise(r=>setTimeout(r,5));origins.set(origin,0);active--;return new Response('{}',{status:404});});
 assert.equal(calls.length,18);assert.equal(result.attempts.length,18);assert(maximum<=4);assert.equal(new Set(result.attempts.map(a=>a.source)).size,14);
});
await test('Successful empty search is not an account-not-found claim',async()=>{const result=await automaticSearch({name:'Sample Person'},null,async url=>Response.json(url.includes('stackexchange')?{items:[]}:url.includes('wikidata')?{search:[]}:{query:{search:[]}}));assert(result.attempts.every(a=>a.status==='no-results'));assert.equal(result.hits.length,0);});
await test('Rate limits pause repeated source calls and do not create evidence',async()=>{let calls=0;const fetcher=async url=>{if(url.includes('lichess')){calls++;return new Response('{}',{status:429});}return new Response('{}',{status:404});};await automaticSearch({username:'sample'},null,fetcher);const result=await automaticSearch({username:'sample'},null,fetcher);assert.equal(calls,1);assert.match(result.attempts.find(a=>a.source==='Lichess').message,/cooling down/);assert.equal(result.hits.length,0);});
await test('Stack Exchange API throttle errors are unavailable and trigger cooldown',async()=>{let calls=0;const fetcher=async url=>{if(url.includes('stackexchange')){calls++;return Response.json({error_id:502,error_name:'throttle_violation',error_message:'back off'});}return new Response('{}',{status:404});};await automaticSearch({name:'Sample Person'},null,fetcher);const result=await automaticSearch({name:'Sample Person'},null,fetcher);assert.equal(calls,1);assert.equal(result.attempts.find(a=>a.source==='Stack Overflow').status,'unavailable');});
console.log(`${count} additional collection checks passed. These are fixtures, not live CORS verification.`);
