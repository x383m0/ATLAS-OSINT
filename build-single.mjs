import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const strip=s=>s.replace(/^import .*?;\r?\n/gm,'').replace(/^export /gm,'');
let html=read('source-index.html');
const modules=['model','storage','profile-links','manual','extra-sources','browser-sources','search','graph','app'];
const code=modules.map(name=>{
 let s=strip(read('js/'+name+'.js'));
 if(name==='app')s='const esc=escape;const storage={openStorage,loadCases,saveCase,deleteCase,importCases,clearCases};\n'+s;
 return '// '+name+'\n'+s;
}).join('\n');
const failure=`function showBootFailure(error){const app=document.querySelector('#app');if(!app?.querySelector('.boot'))return;const box=document.createElement('div');box.className='notice';box.style.margin='40px';const title=document.createElement('h1');title.textContent='ATLAS could not start';const text=document.createElement('p');text.textContent='Reload the page. If this continues, upload the complete index.html again. '+String(error?.message||error||'');box.append(title,text);app.replaceChildren(box);}`;
const script=failure+'\nvoid (async()=>{\n'+code+'\n})().catch(showBootFailure);';
new Function(script);
html=html.replace('<script src="./js/theme-init.js"></script>','<script>'+read('js/theme-init.js')+'</script>')
 .replace('<link rel="stylesheet" href="./styles.css">','<style>'+read('styles.css')+'</style>')
 .replace('<script type="module" src="./js/app.js"></script>','<script>'+script.replaceAll('</script','<\\/script')+'</script>')
 .replaceAll('./assets/icon.svg','data:image/svg+xml;base64,'+fs.readFileSync(path.join(root,'assets/icon.svg')).toString('base64'));
fs.writeFileSync(path.join(root,'index.html'),html);
console.log('Built self-contained index.html; no external application files required.');
