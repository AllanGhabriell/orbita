import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
const read=name=>fs.readFileSync(new URL("../"+name,import.meta.url),"utf8");

async function scenario(query,{fetchError=false,existingSession=false}={}){
 const store=new Map(),elements=new Map(),handlers={};
 let seq=0,exchangeCalls=0,authEvent=null;
 let session=existingSession?{user:{id:"test-user",email:"estudante@example.com",user_metadata:{name:"Pessoa de teste"}}}:null;
 const origin="https://allanghabriell.github.io",pathname="/orbita/";
 const location={origin,pathname,search:query,hash:"#configuracoes",href:origin+pathname+query+"#configuracoes",protocol:"https:"};
 const document={
  body:{dataset:{},classList:{toggle(){}}},
  getElementById(id){
   if(!elements.has(id))elements.set(id,{id,innerHTML:"",textContent:"",title:"",dataset:{},style:{},hidden:false,isConnected:true,
    classList:{add(){},remove(){},toggle(){}},setAttribute(){},removeAttribute(){},
    addEventListener(){},focus(){},querySelector(){return null}});
   return elements.get(id);
  },querySelectorAll(){return []},querySelector(){return {content:""}},addEventListener(name,callback){(handlers[name]??=[]).push(callback);}
 };
 const history={state:null,replaceState(_s,_t,uri){
  const url=new URL(uri,origin);location.search=url.search;location.hash=url.hash;location.href=url.href;
 }};
 const window={location,history,matchMedia:()=>({matches:false}),addEventListener(){},
  ORBITA_SUPABASE:{url:"https://example.supabase.co",key:"sb_publishable_FAKEonly"}};
 const client={
  auth:{
   onAuthStateChange(callback){authEvent=callback;return{data:{subscription:{unsubscribe(){}}}};},
   async exchangeCodeForSession(code){
    exchangeCalls++;
    assert.equal(code,"auth-code");
    session={user:{id:"test-user",email:"estudante@example.com",user_metadata:{name:"Pessoa de teste"}}};
    authEvent?.("SIGNED_IN",session);
    return {data:{session},error:null};
   },
   async getSession(){return{data:{session},error:null}},
   async signInWithOAuth(){return{error:null}},
   async signOut(){session=null;authEvent?.("SIGNED_OUT",null);return{error:null}}
  },
  from(){return{select(){return{eq(){return{async maybeSingle(){
   return fetchError?{data:null,error:{message:"Network blocked"}}:{data:null,error:null};
  }}}}}}},
  async rpc(){return {data:{status:"ok",version:1},error:null}}
 };
 window.__mockSupabase={createClient(){return client}};
 const storage={supportsIndexedDB:true,onSave(){},async replaceDocument(){},async clearDocument(){},async markSynced(){},async persistNow(){}};
 window.OrbitaStorage=storage;
 const context={document,window,location,history,
  localStorage:{getItem:key=>store.get(key)??null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)},
  console,Date,Intl,URL,URLSearchParams,Math,JSON,Object,Array,structuredClone,
  navigator:{onLine:true},crypto:{randomUUID:()=>("id-"+(++seq))},
  setTimeout(){return 1},clearTimeout(){},queueMicrotask,requestAnimationFrame(){},FormData:class{},Blob:class{}};
 vm.createContext(context);
 for(const file of ["app.js","stage2.js","stage3.js","stage4.js"])
  vm.runInContext(read(file),context,{filename:file});
 let stage5=read("stage5.js");
 assert.match(stage5,/detectSessionInUrl:false/,"o SDK não disputa o código com outra troca");
 stage5=stage5.replace('await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.87.3/+esm")','window.__mockSupabase');
 vm.runInContext(stage5,context,{filename:"stage5.js"});
 for(let i=0;i<12;i++)await new Promise(resolve=>setImmediate(resolve));
 const app=window.OrbitaStage5.inspect;
 return {app,window,document,location,exchangeCalls,code:read("stage5.js")};
}
{
 const s=await scenario("?code=auth-code");
 assert.equal(s.exchangeCalls,1,"troca o código de autorização uma única vez");
 assert.equal(s.app.user?.email,"estudante@example.com","conta autenticada após o retorno");
 assert.equal(s.app.mode,"ready","sincronização nova criada sem falhas");
 assert.equal(s.location.search,"","remove o código OAuth após consumi-lo");
 s.window.OrbitaCore.go("configuracoes");
 assert.match(s.document.getElementById("view").innerHTML,/Pessoa de teste/);
 assert.doesNotMatch(s.document.getElementById("view").innerHTML,/Continuar com Google/);
}
{
 const s=await scenario("?code=auth-code",{fetchError:true});
 assert.equal(s.app.user?.id,"test-user","um erro de sincronização não apaga a autenticação");
 assert.equal(s.app.mode,"error");
 s.window.OrbitaCore.go("configuracoes");
 const html=s.document.getElementById("view").innerHTML;
 assert.match(html,/Pessoa de teste/);
 assert.match(html,/Network blocked/);
 assert.doesNotMatch(html,/Continuar com Google/);
}
{
 const s=await scenario("?error=access_denied&error_description=Login+recusado");
 assert.equal(s.app.user,null);
 assert.equal(s.app.mode,"error");
 assert.equal(s.location.search,"","limpa a falha OAuth da URL");
 s.window.OrbitaCore.go("configuracoes");
 assert.match(s.document.getElementById("view").innerHTML,/Login recusado/);
}
{
 const s=await scenario("",{existingSession:true});
 assert.equal(s.app.user?.id,"test-user","sessão existente carregada sem repetir OAuth");
 assert.equal(s.exchangeCalls,0);
}
console.log("OAuth: troca PKCE explícita, sessão persistida, erro de callback visível, erro de banco não desconecta e retorno limpo.");
