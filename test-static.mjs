import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {newSearch,automaticSearch,applyResults,persistentCopy} from '../js/search.js';
import {manualLinks,saveObservation} from '../js/manual.js';
import {serialize,parseImport,validateCase} from '../js/model.js';
import {planBrowserSearch} from '../js/browser-sources.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
let passed=0;
async function test(label,fn){await fn();passed++;console.log('PASS '+label);}
await test('All JavaScript modules parse',()=>{for(const f of fs.readdirSync(path.join(root,'js')))execFileSync(process.execPath,['--check',path.join(root,'js',f)]);});
await test('Relative module imports and static asset paths resolve under a repository subpath',()=>{
 for(const f of fs.readdirSync(path.join(root,'js'))){const code=fs.readFileSync(path.join(root,'js',f),'utf8');for(const m of code.matchAll(/from\s+['"](.+?)['"]/g)){assert(m[1].startsWith('./'));assert(fs.existsSync(path.resolve(root,'js',m[1])));}}
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');for(const m of html.matchAll(/(?:src|href)="(\.\/.+?)"/g))assert(fs.existsSync(path.resolve(root,m[1])));
 assert(fs.existsSync(path.join(root,'.nojekyll')));
});
await test('Manual links never create evidence or graph findings',()=>{const s=newSearch({username:'sample-user'});const links=manualLinks(s);assert.equal(links.filter(l=>l.kind==='Suggested profile address').length,23);assert.equal(s.evidence.length,0);assert.equal(s.entities.length,1);assert(links.every(l=>l.url.startsWith('https://')));});
await test('Quoted name and contextual search links preserve supplied terms',()=>{const s=newSearch({name:'Sample Person',location:'Montreal',organization:'Example Org'});const queries=manualLinks(s).filter(l=>l.source.startsWith('Google')).map(l=>new URL(l.url).searchParams.get('q'));assert.deepEqual(queries,['"Sample Person"','"Sample Person" "Montreal" "Example Org"']);});
await test('Username API collection never fetches manual links or same-origin backend',async()=>{
 const calls=[];const s=newSearch({username:'sample'});const result=await automaticSearch({username:'sample'},null,async(url)=>{calls.push(url);return new Response('{}',{status:404});});applyResults(s,result);assert.equal(calls.length,9);assert(calls.every(u=>/^https:\/\/(api.github.com|public.api.bsky.app|mastodon.social|hacker-news.firebaseio.com|lichess.org|api.chess.com|dev.to|gitlab.com|api.stackexchange.com)\//.test(u)));assert.equal(s.evidence.length,0);assert(s.history.every(h=>h.status==='not-found'));
});
await test('API profile evidence is provisional and source-backed',async()=>{
 const result=await automaticSearch({username:'sample'},null,async(url)=>url.includes('api.github.com')?Response.json({id:1,login:'sample',name:'Sample',bio:'Public bio'}):new Response('{}',{status:404}));const s=applyResults(newSearch({username:'sample'}),result);assert.equal(s.evidence.length,1);assert.equal(s.evidence[0].confidence,'possible');assert.equal(s.evidence[0].source,'GitHub');validateCase(s);
});
await test('CORS/network failures produce unavailable status, not findings',async()=>{const result=await automaticSearch({username:'sample'},null,async()=>{throw new TypeError('Failed to fetch');});assert.equal(result.hits.length,0);assert(result.attempts.every(a=>a.status==='unavailable'));});
await test('Name plans use public reference databases with contextual variants',()=>{const jobs=planBrowserSearch({name:'Sample Person',location:'Montreal',organization:'Example',profiles:''});assert.equal(jobs.length,6);assert(jobs.every(j=>j.url.startsWith('https://')));});
await test('Cancelling a search prevents evidence ingestion',async()=>{const controller=new AbortController();controller.abort();await assert.rejects(()=>automaticSearch({username:'sample'},controller.signal,async()=>{throw new Error('should not call');}),/cancelled/);});
await test('Manual observations require a real check link and nonblank text',()=>{const s=newSearch({username:'sample'});assert.throws(()=>saveObservation(s,{url:'javascript:alert(1)',observation:'test'}));assert.throws(()=>saveObservation(s,{url:manualLinks(s)[0].url,observation:' '}));assert.equal(s.evidence.length,0);});
await test('Manual provenance and graph links survive storage validation and export/import',()=>{const s=newSearch({username:'sample'});saveObservation(s,{url:manualLinks(s)[0].url,observation:'Page displayed this username; identity unknown.'});const restored=parseImport(serialize([persistentCopy(s)]))[0];assert.equal(restored.evidence[0].method,'manual');assert.equal(restored.links[0].confidence,'possible');assert.match(restored.evidence[0].details.provenance,/did not retrieve/);assert.equal(manualLinks(restored).length,manualLinks(s).length);});
await test('Long contextual query observations remain valid saved records',()=>{const s=newSearch({name:'n'.repeat(150),location:'l'.repeat(150),organization:'o'.repeat(150)});const link=manualLinks(s).filter(l=>l.kind==='Search link').at(-1);saveObservation(s,{url:link.url,observation:'Reviewed.'});validateCase(s);});
console.log(`${passed} static checks passed. Browser rendering and live sources remain unverified.`);
