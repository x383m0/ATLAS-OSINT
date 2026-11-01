import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
assert(!/<script[^>]+src=/.test(html),'Entry page must not depend on external scripts');
assert(!/<link[^>]+rel="stylesheet"/.test(html),'Styles must be embedded');
assert(!html.includes('./assets/icon.svg'),'Icon must be embedded, including application markup');
assert(!/^import\s/m.test(html),'Generated entry must contain no module imports');
const scripts=Array.from(html.matchAll(/<script>([\s\S]*?)<\/script>/g),m=>m[1]);
assert.equal(scripts.length,2);for(const script of scripts)new Function(script);
console.log('PASS Generated single-file page has all code, styles and icon; scripts parse');
async function startup(indexedDB){
 const app={innerHTML:'<div class="boot">Opening</div>'};const listeners=[];
 const document={documentElement:{dataset:{}},querySelector:s=>s==='#app'?app:null,addEventListener:(...args)=>listeners.push(args)};
 const context=vm.createContext({document,localStorage:{getItem:()=>null},indexedDB,console,URL,URLSearchParams,AbortSignal,fetch,crypto,structuredClone,setTimeout:()=>1,clearTimeout:()=>{},Promise});
 for(const script of scripts)vm.runInContext(script,context);
 for(let i=0;i<20;i++)await Promise.resolve();
 return {app,listeners};
}
const unavailable=await startup(undefined);
assert.match(unavailable.app.innerHTML,/Start with what you know/);
assert.match(unavailable.app.innerHTML,/Browser storage unavailable/);
assert.equal(unavailable.listeners.length,3);
console.log('PASS Actual bundled application opens search form when browser storage is unavailable');
const loaded=await startup({open(){
 const request={};
 queueMicrotask(()=>{
  request.result={transaction(){
   const tx={objectStore(){return {getAll(){
    const result={result:[]};queueMicrotask(()=>tx.oncomplete());return result;
   }};}};
   return tx;
  }};
  request.onsuccess();
 });
 return request;
}});
assert.match(loaded.app.innerHTML,/Start with what you know/);
assert.doesNotMatch(loaded.app.innerHTML,/Browser storage unavailable/);
assert.match(loaded.app.innerHTML,/v0.8.1/);
console.log('PASS Actual bundled application opens with readable history storage');
console.log('3 boot checks passed; DOM harness does not verify browser rendering.');
