import assert from 'node:assert/strict';
import {assessRelevance,rankedEvidence,relevantGraph} from '../js/relevance.js';
import {newSearch,applyResults,persistentCopy} from '../js/search.js';
import {serialize,parseImport} from '../js/model.js';
let count=0;
const inputs={name:'Anthony',location:'Montreal, Canada',employer:''};
const record=(title,summary='',details={})=>({title,summary,method:'api',details});
function test(name,fn){fn();count++;console.log('PASS '+name);}
test('The broad Anthony Hopkins example is separated without deleting it',()=>{const r=assessRelevance(record('Anthony Hopkins','Welsh actor'),inputs);assert.equal(r.group,'broad');assert(r.reasons.some(r=>r.includes('not found')));});
test('Accented Montreal context ranks actual returned content higher',()=>{const r=assessRelevance(record('Anthony Housefather','Politician in Montréal, Canada'),inputs);assert.equal(r.group,'context');assert(r.score>assessRelevance(record('Anthony Hopkins','Welsh actor'),inputs).score);});
test('Query and provenance cannot manufacture context matches',()=>{const r=assessRelevance(record('Anthony','Actor',{url:'https://example.com/?q=Montreal+Canada',provenance:'Query Anthony Montreal Canada'}),inputs);assert.equal(r.group,'broad');});
test('Whole phrases avoid partial-name false positives',()=>{assert.equal(assessRelevance(record('Anthony','Montreal'),{name:'Tony',location:'Montreal'}).group,'broad');assert.equal(assessRelevance(record('Anthony Hopkins','Montreal'),{name:'Anthony Saulnier',location:'Montreal'}).group,'broad');});
test('Returned organization can support a name reference',()=>{const r=assessRelevance(record('Anthony','Engineer at Example Labs'),{name:'Anthony',employer:'Example Labs'});assert.equal(r.group,'context');});
test('A direct username lookup stays distinct from display-name candidates',()=>{const direct=assessRelevance(record('sample','',{lookupMethod:'Exact username / direct profile'}),{});const display=assessRelevance(record('sample','',{lookupMethod:'Display-name search (not unique)'}),{});assert.equal(direct.group,'profile');assert.equal(display.group,'broad');assert(direct.score>display.score);});
test('Unobserved location is not described as a confirmed mismatch',()=>{const r=assessRelevance(record('sample','',{lookupMethod:'Exact username / direct profile'}),inputs);assert(r.reasons.some(x=>x.includes('not a confirmed mismatch')));});
test('Manual observations remain separate and do not imply verification',()=>{assert.equal(assessRelevance({...record('Page','Observation'),method:'manual'},inputs).group,'manual');});
const s=applyResults(newSearch({name:'Anthony',location:'Montreal, Canada'}),{hits:[
 {source:'Example',title:'Anthony Hopkins',summary:'Welsh actor',url:'https://example.com/broad',method:'knowledge',entityType:'document'},
 {source:'Example',title:'Anthony Housefather',summary:'Montréal politician',url:'https://example.com/context',method:'knowledge',entityType:'document'},
 {source:'Example',title:'sample',username:'sample',url:'https://example.com/profile',method:'profile'}
],attempts:[]});
test('Relevant graph hides only broad records and their links',()=>{const graph=relevantGraph(s);assert.equal(graph.entities.length,3);assert.equal(graph.links.length,2);assert(!graph.entities.some(e=>e.label==='Anthony Hopkins'));assert.equal(relevantGraph(s,true).entities.length,4);assert.equal(s.entities.length,4);assert.equal(s.evidence.length,3);});
test('Ranking puts direct profiles before contextual references and broad results',()=>{assert.deepEqual(rankedEvidence(s).map(r=>r.rank.group),['profile','context','broad']);});
test('Old history export/import keeps all references, evidence links and confidence',()=>{const before=serialize([s]);const ranked=rankedEvidence(s);assert(ranked.length);assert.equal(serialize([s]).replace(/"exportedAt":.*\n/,''),before.replace(/"exportedAt":.*\n/,''));const restored=parseImport(serialize([persistentCopy(s)]))[0];assert.equal(restored.evidence.length,3);assert.equal(restored.links.length,3);assert(restored.evidence.every(e=>e.confidence==='possible'));assert.deepEqual(rankedEvidence(restored).map(r=>r.rank.group),['profile','context','broad']);});
console.log(`${count} relevance checks passed.`);
