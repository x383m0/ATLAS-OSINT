const normalizeText=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim().replace(/\s+/g,' ');
const containsPhrase=(text,phrase)=>!!phrase&&(' '+text+' ').includes(' '+phrase+' ');
export function assessRelevance(evidence,inputs={}){
 const d=evidence.details||{},reasons=[];
 if(evidence.method==='manual')return {group:'manual',score:70,label:'Manual observation',reasons:['Saved by you after manual review; not independently verified.']};
 // Never score URLs, API queries, provenance or the supplied input itself as returned content.
 const title=normalizeText(evidence.title),summary=normalizeText(evidence.summary),content=[title,summary,normalizeText(d.location),normalizeText(d.organization)].join(' ');
 const name=normalizeText(inputs.name),nameMatched=containsPhrase(title,name)||containsPhrase(summary,name);
 const locationParts=String(inputs.location||'').split(/[,;\n]/).map(normalizeText).filter(Boolean);
 const organization=normalizeText(inputs.employer||inputs.organization);
 const matchedLocation=locationParts.filter(term=>containsPhrase(content,term));
 const orgMatched=containsPhrase(content,organization);
 if(nameMatched)reasons.push('Supplied name appears in the returned title or summary.');
 if(matchedLocation.length)reasons.push('Returned content mentions location text: '+matchedLocation.join(', ')+'.');
 else if(locationParts.length)reasons.push('Supplied location was not found in the returned content; this is not a confirmed mismatch.');
 if(orgMatched)reasons.push('Returned content mentions the supplied organization.');
 else if(organization)reasons.push('Supplied organization was not found in the returned content.');
 if(d.lookupMethod==='Exact username / direct profile')return {group:'profile',score:80+(nameMatched?5:0)+(matchedLocation.length?5:0)+(orgMatched?5:0),label:'Direct profile match',reasons:['Source returned a profile for the queried username. Identity remains unconfirmed.',...reasons]};
 if(nameMatched&&(matchedLocation.length||orgMatched))return {group:'context',score:50+(matchedLocation.length?10:0)+(orgMatched?10:0),label:'Name + context reference',reasons:[...reasons,'Text overlap ranks this reference; it does not verify the same person.']};
 if(!nameMatched&&name)reasons.unshift('The supplied name was not found as a complete phrase in the returned title or summary.');
 if(!name)reasons.unshift('This is a broad reference or non-unique display-name candidate, not a direct username lookup.');
 reasons.push('Kept under broad references so you can review it if useful.');
 return {group:'broad',score:nameMatched?20:10,label:'Broad reference',reasons};
}
export function rankedEvidence(search){
 return search.evidence.map(e=>({e,rank:assessRelevance(e,search.inputs)})).sort((a,b)=>b.rank.score-a.rank.score);
}
export function relevantGraph(search,includeBroad=false){
 if(includeBroad)return search;
 const ids=new Set(rankedEvidence(search).filter(r=>r.rank.group!=='broad').map(r=>r.e.id));
 const entities=search.entities.filter(e=>e.id==='subject'||e.evidenceIds.some(id=>ids.has(id)));
 const nodes=new Set(entities.map(e=>e.id));
 return {...search,entities,links:search.links.filter(l=>nodes.has(l.source)&&nodes.has(l.target))};
}
