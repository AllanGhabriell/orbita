import assert from "node:assert/strict";
import {readFileSync,statSync} from "node:fs";
import vm from "node:vm";

const read=file=>readFileSync(new URL("../"+file,import.meta.url),"utf8");
const db=new Map(),els=new Map(),handlers={};
function node(id){
 if(!els.has(id))els.set(id,{
 id,innerHTML:"",textContent:"",title:"",scrollTop:0,dataset:{},style:{},isConnected:true,hidden:false,
 classList:{add(){},remove(){},toggle(){}},setAttribute(){},removeAttribute(){},
 addEventListener(){},focus(){},querySelector(){return null}
 });
 return els.get(id);
}
const document={
 body:{dataset:{},classList:{toggle(){}}},
 getElementById:node,querySelectorAll:()=>[],querySelector:()=>({content:""}),
 addEventListener(type,cb){(handlers[type]??=[]).push(cb);}
};
const localStorage={getItem:k=>db.get(k)??null,setItem:(k,v)=>db.set(k,v),removeItem:k=>db.delete(k)};
const location={hash:"#inicio",origin:"https://allanghabriell.github.io",pathname:"/orbita/"};
const window={matchMedia:()=>({matches:false}),addEventListener(){}};
const context={document,window,location,localStorage,
 history:{replaceState(_a,_b,h){location.hash=h}},
 navigator:{onLine:true},URL,Math,JSON,Object,Array,Date,Intl,structuredClone,
 console,crypto:{randomUUID:(()=>{let i=0;return()=>String(++i)})()},
 requestAnimationFrame(){},setTimeout(){return 1},clearTimeout(){},queueMicrotask(){},
 FormData:class{},Blob:class{}};
vm.createContext(context);
vm.runInContext(read("app.js"),context,{filename:"app.js"});
vm.runInContext(read("stage2.js"),context,{filename:"stage2.js"});
vm.runInContext(read("stage3.js"),context,{filename:"stage3.js"});
vm.runInContext(read("stage4.js"),context,{filename:"stage4.js"});
window.OrbitaStorage={
 supportsIndexedDB:true,
 onSave(){},async replaceDocument(){},async persistNow(){},async clearDocument(){}
};
vm.runInContext(read("stage5.js"),context,{filename:"stage5.js"});
const S=window.OrbitaStage5.inspect;
const good={url:"https://example.supabase.co",key:"sb_publishable_ABCdef_123"};
assert.equal(S.isConfigured(good),true);
assert.equal(S.isConfigured({...good,key:"sb_secret_NOT_ALLOWED"}),false);
assert.equal(S.isConfigured({...good,url:"http://example.supabase.co"}),false);
assert.equal(S.isConfigured({...good,url:"https://example.supabase.co.evil.com"}),false);
assert.equal(S.isConfigured({...good,key:""}),false);
assert.equal(S.mode,"unconfigured");
assert.ok(window.OrbitaCore.state.goals.length===0,"não gera usuário falso");

const x={schema:1,firstAccess:"2026-11-02",goals:[],settings:{theme:"dark"},evolution:{closed:{"2026-11-01":{date:"2026-11-01",confirmed:"2026-11-02"}}}};
const y={settings:{theme:"dark"},evolution:{closed:{"2026-11-01":{confirmed:"2026-11-02",date:"2026-11-01"}}},goals:[],schema:1,firstAccess:"2026-11-02"};
assert.equal(S.checksum(x),S.checksum(y),"ordem das chaves não gera conflitos");
assert.equal(S.checkFrozenCompatibility(y,x),true);
const z=structuredClone(x);z.evolution.closed["2026-11-01"].confirmed="muda";
assert.equal(S.checkFrozenCompatibility(z,x),false,"não substitui dia finalizado");
const both=S.mergeClosures(
 {schema:1,firstAccess:"2026-11-02",planner:{closedDays:["2026-11-02"]},evolution:{closed:{"2026-11-02":{date:"2026-11-02",confirmed:"A"}}}},
 {schema:1,firstAccess:"2026-11-01",planner:{closedDays:["2026-11-01"]},evolution:{closed:{"2026-11-01":{date:"2026-11-01",confirmed:"B"}}}}
);
assert.deepEqual(Object.keys(both.evolution.closed).sort(),["2026-11-01","2026-11-02"],"fechamentos dos dois dispositivos preservados");
assert.equal(both.firstAccess,"2026-11-01","histórico mais antigo acessível");
assert.deepEqual(Array.from(both.planner.closedDays),["2026-11-01","2026-11-02"]);
assert.throws(()=>S.mergeClosures(x,z),/mesmo dia foi finalizado/,"dias divergentes não são sobrescritos");
assert.equal(S.meaningful(x),true);
assert.equal(S.meaningful({goals:[],planner:{entries:[]},studies:{cycles:[]},evolution:{closed:{}}}),false);

const manifest=JSON.parse(read("manifest.webmanifest"));
assert.equal(manifest.display,"standalone");
assert.equal(manifest.scope,"./");
assert.ok(manifest.icons.some(i=>i.sizes==="192x192"));
assert.ok(manifest.icons.some(i=>i.sizes==="512x512"));
assert.ok(statSync(new URL("../assets/icon-192.png",import.meta.url)).size>100);
assert.ok(statSync(new URL("../assets/icon-512.png",import.meta.url)).size>100);
const png192=readFileSync(new URL("../assets/icon-192.png",import.meta.url));
assert.equal(png192.readUInt32BE(16),192,"PNG 192px real");
const png512=readFileSync(new URL("../assets/icon-512.png",import.meta.url));
assert.equal(png512.readUInt32BE(16),512,"PNG 512px real");

const sql=read("supabase/migrations/20261102_000001_orbita.sql");
assert.match(sql,/enable row level security/i);
assert.match(sql,/create policy orbita_documents_owner_read/i);
assert.match(sql,/auth\.uid\(\)/);
assert.match(sql,/security definer/i);
assert.match(sql,/p_expected_version bigint/);
assert.match(sql,/orbita_closed_days/);
assert.match(sql,/revoke all on public\.orbita_documents from public, anon, authenticated/i);
assert.doesNotMatch(sql,/sb_secret_[A-Za-z0-9_-]{15,}/,"nenhuma chave real no SQL");
assert.match(read("sw.js"),/caches\.open/);
assert.match(read("boot.js"),/indexedDB\.open/);
console.log("Etapa 5: configuração, isolamento de backups, hashes canônicos, manifesto, ícones, offline e controles SQL verificados estaticamente.");
