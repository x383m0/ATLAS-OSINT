import {escape as esc,clean,safeUrl,uid,serialize,parseImport} from './model.js';
import * as storage from './storage.js';
import {newSearch,applyResults,persistentCopy,automaticSearch} from './search.js';
import {manualLinks,saveObservation} from './manual.js';
import {mountGraph} from './graph.js';
const glyphs={new:'M12 4v16M4 12h16',graph:'M5 5l14 14M5 19 19 5M5 5v14M19 5v14',evidence:'M5 3h10l4 4v14H5zM9 11h6M9 15h6',history:'M3 11a9 9 0 1 1 2 7M3 4v7h7M12 7v5l3 2',settings:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2',search:'M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14M15 15l6 6'};
const icon=name=>`<svg viewBox="0 0 24 24" class="icon" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="${glyphs[name]||glyphs.search}"/></svg>`;
const NAV=[['new','New search'],['graph','Graph explorer'],['evidence','Evidence library'],['history','History'],['settings','Settings']];

let saved=[],current=null,view='new',graph=null,filter='all',query='',busy=null,saveError='';
const app=document.querySelector('#app');
function toast(text){const el=document.querySelector('#toast');el.textContent=text;el.className='show';clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.className='',7000);}
const when=at=>new Date(at).toLocaleString();
const sourceLink=(url,label='Original source')=>safeUrl(url)?`<a target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer" href="${esc(safeUrl(url))}">${esc(label)} ↗</a>`:'';
function go(next){if(busy)return;if(next==='new'){current=null;query='';filter='all';}view=next;render();}
function render(){
 graph?.dispose();graph=null;
 app.innerHTML=`<header class="header"><button class="brand" data-nav="new" ${busy?'disabled':''}><img src="./assets/icon.svg" alt="">ATLAS</button><nav aria-label="Main navigation">${NAV.map(([id,label])=>`<button data-nav="${id}" title="${label}" aria-label="${label}" ${view===id?'aria-current="page"':''} ${busy||(['graph','evidence'].includes(id)&&!current)?'disabled':''}>${icon(id)}<span>${label}</span></button>`).join('')}</nav></header><main>${saveError?`<div class="notice">${esc(saveError)}</div>`:''}${busy?loading():pages[view]()}</main><footer>Public profiles. Source-backed results.<span>ATLAS · v0.8.1 · Static</span></footer><dialog id="detail"></dialog><input type="file" id="import" accept=".json,application/json" hidden>`;
 if(view==='graph'&&current&&!busy)graph=mountGraph(document.querySelector('#graph'),current,{filter,onSelect:inspect});
}
const heading=(title,text,extra='')=>`<div class="heading"><div><h1>${title}</h1><p>${text}</p></div>${extra}</div>`;
const empty=(text)=>`<div class="empty">${icon('search')}<p>${text}</p></div>`;
function loading(){return `<section class="loading"><span class="spinner"></span><h1>Searching public sources…</h1><p>Checking browser-accessible sources and preparing links for manual review.</p><button class="secondary" data-action="cancel">Cancel search</button></section>`;}
function resultSummary(){return `<div class="summary"><span>${current.evidence.filter(e=>e.method!=='manual').length} automatic result(s)</span><span>${current.evidence.length} reference${current.evidence.length===1?'':'s'}</span><span>${current.status==='partial'?'Some sources could not be searched':current.status==='cancelled'?'Search cancelled':'Search finished'}</span><button class="text-button" data-action="refresh">Refresh sources</button><details><summary>Source status</summary>${current.history.map(h=>`<div class="source-status"><strong>${esc(h.connector)}</strong><span>${esc(h.status)}</span><p>${esc(h.message)}</p></div>`).join('')}</details></div>`;}
const pages={
 new(){return `<section class="search-home"><div class="eyebrow">PUBLIC PROFILE SEARCH</div><h1>Start with what you know.</h1><p>A username, a name, or a little more context.</p><form id="search-form"><div class="main-inputs"><label>Username<input name="username" placeholder="Enter username" maxlength="100" autocomplete="off"></label><span class="or">or</span><label>Name<input name="name" placeholder="Enter name" maxlength="160" autocomplete="off"></label></div><details class="more"><summary>More information <span>Optional</span></summary><div class="input-grid"><label>City or country<input name="location" maxlength="160" placeholder="Context for comparing results"></label><label>Organization<input name="organization" maxlength="160" placeholder="Employer or organization"></label><label>Public professional email (context only)<input name="email" type="email" maxlength="200"></label><label>Public profile links<textarea name="profiles" rows="2" placeholder="One https:// URL per line"></textarea></label></div><label>Notes<textarea name="notes" rows="2" maxlength="1000" placeholder="Context you want to keep with the results"></textarea></label></details><div id="form-error" role="alert"></div><button class="primary search-submit">${icon('search')}Search</button><small class="coverage-note">Username: 8 automatic profile sources · Name: Wikipedia, Wikidata &amp; Stack Overflow</small><small class="search-note">Public references are possible matches. A shared name does not confirm an identity.</small></form></section>`;},
 graph(){if(!current)return empty('Start a new search.');return heading(esc(current.title),'Explore the public references found by your search.')+resultSummary()+manualPanel()+`<div class="graph-layout"><section class="panel"><div class="graph-toolbar"><label>Show <select id="graph-filter"><option value="all">All references</option><option value="profile" ${filter==='profile'?'selected':''}>Profiles</option><option value="document" ${filter==='document'?'selected':''}>Public references</option><option value="person" ${filter==='person'?'selected':''}>Search subject</option></select></label><div><button data-action="out" aria-label="Zoom out">−</button><button data-action="fit">Fit</button><button data-action="in" aria-label="Zoom in">+</button></div></div><div id="graph" class="graph-canvas"></div><div class="graph-hint">Drag to move · Scroll to zoom · Select a reference for its source</div></section><aside class="panel" id="inspector"><div class="empty"><p>Select a reference to inspect its source and details.</p></div></aside></div>`;},
 evidence(){if(!current)return empty('Start a new search.');const rows=current.evidence.filter(e=>(e.title+' '+e.source+' '+e.summary).toLowerCase().includes(query.toLowerCase()));return heading('Evidence library',esc(current.title))+manualPanel()+`<form id="filter-evidence" class="filter"><input name="query" aria-label="Filter evidence" placeholder="Find a reference…" value="${esc(query)}"><button class="secondary">Filter</button></form><div class="evidence-grid">${rows.length?rows.map(e=>`<article class="panel evidence"><div class="source-label">${esc(e.source)}<span>${e.method==='manual'?'Manual observation':'Possible match'}</span></div><h2>${esc(e.title)}</h2><p>${esc(e.summary)}</p>${e.details.comparison?`<p class="comparison">${esc(e.details.comparison)}</p>`:''}<small>${esc(e.details.provenance||'Source record')}<br>${when(e.retrievedAt)}</small><div class="evidence-actions">${sourceLink(e.details.url||e.url)}<button class="text-button" data-evidence="${esc(e.id)}">Details</button></div></article>`).join(''):empty('No references match this view.')}</div>`;},
 history(){return heading('History','Your previous searches, saved in this browser.')+`<div class="panel history-list">${saved.length?saved.map(s=>`<button class="history-row" data-open="${esc(s.id)}"><span class="history-symbol">${icon('history')}</span><span><strong>${esc(s.title)}</strong><small>${when(s.createdAt)}</small></span><span class="history-count">${s.evidence.length} saved references →</span></button>`).join(''):empty('Your searches will appear here automatically.')}</div>`;},
 settings(){const theme=document.documentElement.dataset.theme;return heading('Settings','Appearance and search availability.')+`<section class="panel settings"><h2>Appearance</h2><div class="themes">${[['arctic','Arctic Steel'],['midnight','Midnight Intelligence'],['gold','Obsidian Gold']].map(([id,name])=>`<button class="theme ${theme===id?'chosen':''}" data-theme-choice="${id}" aria-pressed="${theme===id}"><div class="theme-preview" data-preview="${id}"><i></i><span><b></b><em></em><em></em></span></div><strong>${name}</strong>${id==='arctic'?'<small>Default</small>':''}</button>`).join('')}</div></section><section class="panel settings"><h2>Search coverage</h2><p>Username checks: GitHub, Bluesky, Mastodon.social, Hacker News, Lichess, Chess.com, DEV.to and GitLab. Stack Overflow adds display-name candidates for usernames and names. Name references also come from Wikidata and Wikipedia EN/FR. All automatic requests run directly from your browser. Other profile sites and Google/Bing searches are provided as links for manual review. ATLAS is not affiliated with Chess.com.</p><p>These sources do not cover the whole web. City and organization refine reference queries and search links. Professional email and notes are context only. A blocked source is shown as unavailable. Manual profile URL templates adapted from WhatsMyName (Micah Hoffman and contributors), CC BY-SA 4.0; attribution and revision are in README.md.</p></section><section class="panel settings"><h2>History data</h2><p>Search results and evidence are saved on this browser and can be reopened from History. Export a backup to move them between devices or website addresses.</p><div class="settings-actions"><button class="secondary" data-action="export">Export history</button><button class="secondary" data-action="import">Import history</button></div></section>`;}
};
function inspect(selection){
 const {kind,item}=selection,el=document.querySelector('#inspector');if(!el)return;
 const records=current.evidence.filter(e=>item.evidenceIds.includes(e.id));
 el.innerHTML=`<div class="inspect"><div class="eyebrow">${kind==='link'?'CONNECTION':'PUBLIC REFERENCE'}</div><h2>${esc(item.label)}</h2><span class="badge">Possible match</span>${kind==='link'?`<p>${esc(item.explanation)}</p>`:`<dl>${Object.entries(item.details).filter(([k,v])=>v&&k!=='url').map(([k,v])=>`<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>${sourceLink(item.details.url)}`}<h3>Supporting evidence</h3>${records.map(e=>`<article><strong>${esc(e.source)}</strong><p>${esc(e.summary)}</p>${sourceLink(e.url)}<small>${when(e.retrievedAt)}</small></article>`).join('')||'<p>This is the information entered for the search.</p>'}</div>`;
}
function exportFile(text){const u=URL.createObjectURL(new Blob([text],{type:'application/json'})),a=document.createElement('a');a.href=u;a.download='ATLAS-history.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),2000);}
async function save(search){await storage.saveCase(persistentCopy(search));saved=await storage.loadCases();}
document.addEventListener('click',async event=>{
 const b=event.target.closest('button');if(!b)return;
 try{
  if(b.dataset.nav)go(b.dataset.nav);
  if(b.dataset.open){current=saved.find(s=>s.id===b.dataset.open);view='graph';query='';filter='all';render();}
  if(b.dataset.themeChoice){document.documentElement.dataset.theme=b.dataset.themeChoice;try{localStorage.setItem('atlas-theme',b.dataset.themeChoice);}catch{toast('Theme applied for this session.');}render();}
  if(b.dataset.evidence){const e=current.evidence.find(e=>e.id===b.dataset.evidence),d=document.querySelector('#detail');d.innerHTML=`<div class="dialog-head"><h2>${esc(e.title)}</h2><button data-action="close" aria-label="Close details">×</button></div><div class="inspect"><p>${esc(e.summary)}</p><dl>${Object.entries(e.details).filter(([k,v])=>v).map(([k,v])=>`<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>${sourceLink(e.url)}<small>${when(e.retrievedAt)}</small></div>`;d.showModal();}
  if(b.dataset.review){
   const link=manualLinks(current).find(l=>l.url===b.dataset.review);if(!link)return;
   const d=document.querySelector('#detail');
   d.innerHTML=`<div class="dialog-head"><h2>Save your observation</h2><button data-action="close" aria-label="Close">×</button></div><form id="observation-form" class="inspect"><p>${esc(link.source)} · ${sourceLink(link.url,'Open page')}</p><p>Open and inspect the page first. Record only what you observed. This does not verify a person’s identity.</p><input type="hidden" name="url" value="${esc(link.url)}"><input type="hidden" name="source" value="${esc(link.source)}"><label>Your observation<textarea name="observation" maxlength="4000" required rows="4" placeholder="What did the page actually show?"></textarea></label><button class="primary" style="margin-top:20px">Save observation</button></form>`;d.showModal();
  }
  const action=b.dataset.action;
  if(action==='cancel')busy?.abort();if(action==='in')graph?.zoom(1.25);if(action==='out')graph?.zoom(.8);if(action==='fit')graph?.fit();if(action==='close')document.querySelector('#detail').close();
  if(action==='refresh'&&current&&!busy){const i=current.inputs;await executeSearch({username:i.usernames||'',name:i.name||'',location:i.location||'',organization:i.employer||'',email:i.email||'',profiles:i.profiles||'',notes:i.notes||''},true);}
  if(action==='export')exportFile(serialize(saved));if(action==='import')document.querySelector('#import').click();

 }catch(e){toast(e.message);}
});
async function executeSearch(values,force=false){
 if(busy)return;
 let search;
 try{search=newSearch(values);}catch(error){toast(error.message);return;}
 const controller=new AbortController();busy=controller;render();
 try{applyResults(search,await automaticSearch(values,controller.signal));}
 catch(error){search.status=controller.signal.aborted?'cancelled':'partial';search.history.push({id:uid(),at:new Date().toISOString(),connector:'Search service',target:search.title,status:'unavailable',message:controller.signal.aborted?'Search cancelled.':error.message});}
 finally{busy=null;current=search;view='graph';try{await save(search);}catch(error){saveError='History could not be saved: '+error.message;}render();}
}
document.addEventListener('submit',async event=>{
 event.preventDefault();const form=event.target,values=Object.fromEntries(new FormData(form));
 if(form.id==='observation-form'){
  try{saveObservation(current,values);await save(current);render();toast('Observation saved. Identity remains unconfirmed.');}catch(error){toast(error.message);}return;
 }
 if(form.id==='filter-evidence'){query=clean(values.query);render();return;}
 if(form.id!=='search-form'||busy)return;
 await executeSearch(values);
});
document.addEventListener('change',async event=>{

 if(event.target.id==='graph-filter'){filter=event.target.value;render();}
 if(event.target.id==='import')try{const file=event.target.files[0];if(!file)return;if(file.size>15_000_000)throw new Error('History file is too large.');const rows=parseImport(await file.text()),existing=new Set(saved.map(s=>s.id));for(const s of rows)if(existing.has(s.id))s.id=uid();await storage.importCases(rows.map(persistentCopy));saved=await storage.loadCases();view='history';render();toast('History imported.');}catch(error){toast(error.message);}
});
try{await Promise.race([(async()=>{await storage.openStorage();saved=await storage.loadCases();})(),new Promise((_,reject)=>setTimeout(()=>reject(new Error('Browser storage took too long to open.')),5000))]);}catch(error){saveError='Browser storage unavailable. Results can be viewed but history cannot be saved.';}
render();

function manualPanel(){
 const links=manualLinks(current);
 return `<details class="panel manual-panel" ><summary>Manual checks <span>${links.length} links · not checked automatically</span></summary><p>These are suggested addresses and searches, not found profiles or evidence. Open a page to inspect it; you can then save your own observation.</p><div class="manual-grid">${links.map(l=>`<article><div><strong>${esc(l.source)}</strong><small>${esc(l.kind)} · Not checked</small></div>${sourceLink(l.url,'Open')}<button class="text-button" data-review="${esc(l.url)}">Record observation</button></article>`).join('')||'<p>Add a username, name or profile link to prepare checks.</p>'}</div></details>`;
}
