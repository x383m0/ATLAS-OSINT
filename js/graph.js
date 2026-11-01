import {escape} from './model.js';
const SVG='http://www.w3.org/2000/svg';
export function mountGraph(container, c, {filter='all',onSelect=()=>{}}={}) {
  const visible=c.entities.filter(e=>filter==='all'||e.type===filter).slice(0,160), ids=new Set(visible.map(e=>e.id));
  const links=c.links.filter(l=>ids.has(l.source)&&ids.has(l.target)).slice(0,400);
  const positions=new Map();
  visible.forEach((e,i)=>{
    const radius=i===0?0:Math.min(400,140+Math.floor((i-1)/12)*95),angle=(i-1)*2.39996;
    positions.set(e.id,{x:550+Math.cos(angle)*radius,y:330+Math.sin(angle)*radius*.68});
  });
  const svg=document.createElementNS(SVG,'svg');svg.setAttribute('viewBox','0 0 1100 660');svg.setAttribute('aria-label','Public reference graph. Use tab to inspect nodes and relationships.');svg.setAttribute('role','group');svg.classList.add('network');
  container.replaceChildren(svg);
  if(!visible.length){container.insertAdjacentHTML('beforeend','<div class="graph-empty">No entities match this filter.</div>');return {dispose(){},exportSVG(){return null;},zoom(){},fit(){}};}
  const world=document.createElementNS(SVG,'g');svg.append(world);let zoom=1,pan={x:0,y:0},drag=null,moved=false;
  const linkNodes=links.map(l=>{
    const group=document.createElementNS(SVG,'g'),line=document.createElementNS(SVG,'line'),label=document.createElementNS(SVG,'text');
    line.classList.add('graph-link');line.dataset.confidence=l.confidence;line.setAttribute('tabindex','0');line.setAttribute('role','button');line.setAttribute('aria-label',l.label+' relationship, '+l.confidence);
    label.classList.add('edge-label');label.textContent=l.label;group.append(line,label);world.append(group);
    const select=()=>onSelect({kind:'link',item:l});line.addEventListener('click',select);line.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();select();}});
    return {l,line,label};
  });
  const nodeGroups=new Map();
  visible.forEach(e=>{
    const group=document.createElementNS(SVG,'g');group.classList.add('graph-node');group.dataset.type=e.type;group.dataset.confidence=e.confidence;group.setAttribute('tabindex','0');group.setAttribute('role','button');group.setAttribute('aria-label',e.label+', '+e.type+', '+e.confidence);
    const title=document.createElementNS(SVG,'title');title.textContent=e.label;
    const circle=document.createElementNS(SVG,'circle');circle.setAttribute('r',e.id==='subject'?'31':'23');
    const mark=document.createElementNS(SVG,'text');mark.classList.add('node-mark');mark.textContent=({person:'P',domain:'D',profile:'@',ip:'IP',repository:'R',website:'W',record:'DNS'})[e.type]||'•';mark.setAttribute('y','5');
    const text=document.createElementNS(SVG,'text');text.setAttribute('y',e.id==='subject'?'52':'44');text.textContent=e.label.length>26?e.label.slice(0,24)+'…':e.label;
    group.append(title,circle,mark,text);world.append(group);nodeGroups.set(e.id,group);
    const select=()=>{world.querySelectorAll('.selected').forEach(n=>n.classList.remove('selected'));group.classList.add('selected');onSelect({kind:'entity',item:e});};
    group.addEventListener('click',()=>{if(!moved)select();});
    group.addEventListener('keydown',ev=>{if(ev.key==='Enter'||ev.key===' '){ev.preventDefault();select();}});
    group.addEventListener('pointerdown',event=>{event.stopPropagation();moved=false;drag={id:e.id,start:point(event),position:{...positions.get(e.id)}};svg.setPointerCapture(event.pointerId);});
  });
  function paint(){
    world.setAttribute('transform',`translate(${pan.x} ${pan.y}) scale(${zoom})`);
    nodeGroups.forEach((g,id)=>{const p=positions.get(id);g.setAttribute('transform',`translate(${p.x} ${p.y})`);});
    linkNodes.forEach(({l,line,label})=>{const a=positions.get(l.source),b=positions.get(l.target);line.setAttribute('x1',a.x);line.setAttribute('y1',a.y);line.setAttribute('x2',b.x);line.setAttribute('y2',b.y);label.setAttribute('x',(a.x+b.x)/2);label.setAttribute('y',(a.y+b.y)/2-7);});
  }
  function point(event){const p=svg.createSVGPoint();p.x=event.clientX;p.y=event.clientY;return p.matrixTransform(svg.getScreenCTM().inverse());}
  svg.addEventListener('pointerdown',event=>{moved=false;drag={id:null,start:point(event),position:{...pan}};svg.setPointerCapture(event.pointerId);});
  svg.addEventListener('pointermove',event=>{if(!drag)return;const p=point(event),dx=p.x-drag.start.x,dy=p.y-drag.start.y;if(Math.abs(dx)+Math.abs(dy)>3)moved=true;if(drag.id)positions.set(drag.id,{x:drag.position.x+dx/zoom,y:drag.position.y+dy/zoom});else pan={x:drag.position.x+dx,y:drag.position.y+dy};paint();});
  svg.addEventListener('pointerup',()=>drag=null);svg.addEventListener('pointercancel',()=>drag=null);
  function setZoom(next,center={x:550,y:330}){next=Math.max(.25,Math.min(4,next));pan={x:center.x-(center.x-pan.x)*next/zoom,y:center.y-(center.y-pan.y)*next/zoom};zoom=next;paint();}
  svg.addEventListener('wheel',event=>{event.preventDefault();setZoom(zoom*Math.exp(-event.deltaY*.0015),point(event));},{passive:false});
  paint();
  return {
    dispose(){container.replaceChildren();},zoom(factor){setZoom(zoom*factor);},fit(){zoom=1;pan={x:0,y:0};paint();},
    exportSVG(){
      const style=getComputedStyle(document.documentElement),accent=style.getPropertyValue('--accent').trim(),bg=style.getPropertyValue('--bg').trim(),text=style.getPropertyValue('--text').trim(),border=style.getPropertyValue('--border').trim();
      const clone=svg.cloneNode(true);clone.setAttribute('xmlns',SVG);clone.setAttribute('width','1100');clone.setAttribute('height','660');
      const css=document.createElementNS(SVG,'style');css.textContent=`svg{background:${bg}}circle{fill:${bg};stroke:${accent};stroke-width:2}text{fill:${text};font:12px sans-serif;text-anchor:middle}.node-mark{font-size:13px;font-weight:bold}.graph-link{stroke:${border};stroke-width:2}.graph-link[data-confidence=possible]{stroke-dasharray:5 5}.edge-label{font-size:10px}.graph-node[data-confidence=rejected]{opacity:.4}`;clone.prepend(css);
      return '<?xml version="1.0" encoding="UTF-8"?>\n'+new XMLSerializer().serializeToString(clone);
    },counts:{visible:visible.length,total:c.entities.length,links:links.length}
  };
}
