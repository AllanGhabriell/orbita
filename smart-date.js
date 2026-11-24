/* Órbita v5.22 — entrada de data brasileira, sem alterar contratos de formulário. */
(function(root){
"use strict";
const pad=n=>String(n).padStart(2,"0");
const iso=d=>String(d.getFullYear()).padStart(4,"0")+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate());
function validDate(y,m,d){
 if(!Number.isInteger(y)||y<1||y>9999||m<1||m>12||d<1||d>31)return null;
 const x=new Date(0);x.setHours(12,0,0,0);x.setFullYear(y,m-1,d);
 return x.getFullYear()===y&&x.getMonth()===m-1&&x.getDate()===d?x:null;
}
function addDays(d,n){const x=new Date(d.getTime());x.setDate(x.getDate()+n);return x.getFullYear()>=1&&x.getFullYear()<=9999?x:null;}
function parseDate(raw,base=new Date()){
 const s=String(raw??"").trim().toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g,"");
 if(!s)return "";
 if(["h","hoje","a","amanha","o","ontem"].includes(s)){const d=addDays(base,["a","amanha"].includes(s)?1:["o","ontem"].includes(s)?-1:0);return d?iso(d):null;}
 const rel=s.match(/^([+-])(\d{1,5})(s)?$/);
 if(rel){const d=addDays(base,(rel[1]==="-"?-1:1)*Number(rel[2])*(rel[3]?7:1));return d?iso(d):null;}
 let y=base.getFullYear(),m=base.getMonth()+1,d,parts;
 if((parts=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))){y=+parts[1];m=+parts[2];d=+parts[3];}
 else if(/^\d{8}$/.test(s)){d=+s.slice(0,2);m=+s.slice(2,4);y=+s.slice(4);}
 else if(/^\d{4}$/.test(s)){d=+s.slice(0,2);m=+s.slice(2,4);}
 else if((parts=s.match(/^(\d{1,2})(?:([/.-])(\d{1,2})(?:\2(\d{4}))?)?$/))){d=+parts[1];if(parts[3])m=+parts[3];if(parts[4])y=+parts[4];}
 else return null;
 const date=validDate(y,m,d);return date?iso(date):null;
}
function format(value){
 const m=String(value||"").match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?))?$/);
 return m?m[3]+"/"+m[2]+"/"+m[1]+(m[4]?" "+m[4]:""):"";
}
function parse(raw,kind="date",current="",base=new Date()){
 const text=String(raw??"").trim();if(!text)return "";
 if(kind!=="datetime-local")return parseDate(text,base);
 const parts=text.match(/^(.+?)[T ]+(\d{1,2}):(\d{2})(?::(\d{2})(\.\d{1,3})?)?$/i);
 let day,time;
 if(parts){day=parseDate(parts[1],base);const h=+parts[2],m=+parts[3],sec=parts[4]==null?null:+parts[4];if(h>23||m>59||sec!==null&&sec>59)return null;time=pad(h)+":"+pad(m)+(sec!==null?":"+pad(sec)+(parts[5]||""):"");}
 else {day=parseDate(text,base);time=String(current||"").split("T")[1];}
 return day&&time?day+"T"+time:null;
}
root.OrbitaDate={parseDate,parse,format,addDays,iso};
if(typeof document==="undefined")return;
const selector='input[type="date"],input[type="datetime-local"]';
const entries=new WeakMap(),textEntries=new WeakMap();
let serial=0;
const now=()=>new Date();
const event=(type)=>new Event(type,{bubbles:true});
function inactive(n){return n.disabled||n.readOnly||!!n.closest("[hidden]");}
function labelFor(n){
 return n.getAttribute("aria-label")||Array.from(n.labels||[]).map(x=>x.textContent.trim()).filter(Boolean).join(" ")||n.parentElement?.querySelector("label")?.textContent.trim()||"Data";
}
function errorFor(n,value){
 if(value===null)return n.type==="datetime-local"?"Informe uma data e um horário válidos.":"Informe uma data válida.";
 if(!value&&n.required)return "Informe a data.";
 if(!value)return "";
 if(n.min&&value<n.min)return "Data mínima: "+format(n.min)+".";
 if(n.max&&value>n.max)return "Data máxima: "+format(n.max)+".";
 return "";
}
function setError(e,message,show=true){
 e.text.setCustomValidity(message);e.error.textContent=show?message:"";e.error.hidden=!message||!show;
 if(message&&show)e.text.setAttribute("aria-invalid","true");else e.text.removeAttribute("aria-invalid");
}
function sync(e,force=false){
 const n=e.native,off=inactive(n);
 e.text.disabled=n.disabled||!!n.closest("[hidden]");e.text.readOnly=n.readOnly;e.button.disabled=off;
 if(off){setError(e,"");return;}
 if(force||!e.dirty){e.text.value=format(n.value);e.initial=n.value;e.dirty=false;setError(e,"");}
 else check(e,false);
}
function check(e,show=true){
 const n=e.native;if(inactive(n)){setError(e,"");return true;}
 const value=parse(e.text.value,n.type,e.initial,now());
 let message=errorFor(n,value);
 if(!message){
  n.value=value;
  if(value&&!n.value)message="Informe uma data válida.";
  else if(n.validity.stepMismatch)message="Data ou horário fora do intervalo permitido.";
 }
 setError(e,message,show);
 return !message;
}
function commit(e,show=true,emit=true){
 if(inactive(e.native))return true;
 if(!e.dirty){sync(e);return true;}
 if(!check(e,show))return false;
 const n=e.native,changed=n.value!==e.initial;
 e.text.value=format(n.value);e.initial=n.value;e.dirty=false;setError(e,"");
 if(changed&&emit){n.dispatchEvent(event("input"));n.dispatchEvent(event("change"));}
 return true;
}
function setDraft(e,value,confirm=false){
 e.text.value=value;e.dirty=true;check(e,confirm);
 if(confirm)return commit(e);return true;
}
function enhance(n){
 if(entries.has(n)){sync(entries.get(n));return;}
 if(!n.parentNode)return;
 const label=labelFor(n),wrap=document.createElement("span"),row=document.createElement("span"),text=document.createElement("input"),button=document.createElement("button"),error=document.createElement("small");
 const id="orb-date-text-"+(++serial);
 wrap.className="orb-smart-date";row.className="orb-date-row";text.className="orb-date-text";text.type="text";text.id=id;text.autocomplete="off";text.spellcheck=false;text.placeholder=n.type==="datetime-local"?"DD/MM/AAAA HH:MM":"DD/MM/AAAA";text.setAttribute("aria-label",label);text.setAttribute("aria-describedby",id+"-error");text.title="Cole uma data ou digite H (hoje), A (amanhã), O (ontem), +3, 21112026. Setas: mudar um dia.";
 button.type="button";button.className="orb-date-calendar";button.title="Abrir calendário";button.setAttribute("aria-label","Abrir calendário: "+label);
 button.innerHTML='<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 10h18M8 14h2m4 0h2m-8 4h2"/></svg>';
 error.className="orb-date-error";error.id=id+"-error";error.hidden=true;error.setAttribute("aria-live","polite");
 // Keep original name, ID, min/max, required, disabled, and date type.
 const labels=Array.from(n.labels||[]);n.parentNode.insertBefore(wrap,n);wrap.append(row,error);row.append(text,button,n);
 n.classList.add("orb-date-native");n.tabIndex=-1;n.setAttribute("aria-label",label+" (calendário)");
 for(const l of labels)if(l.htmlFor&&l.htmlFor===n.id)l.htmlFor=id;
 const e={native:n,text,button,error,initial:n.value,dirty:false};entries.set(n,e);textEntries.set(text,e);sync(e,true);
 text.addEventListener("focus",()=>{if(!e.dirty)sync(e,true);});
 text.addEventListener("input",()=>{e.dirty=true;check(e,false);});
 text.addEventListener("blur",()=>commit(e));
 text.addEventListener("paste",ev=>{
  const pasted=ev.clipboardData?.getData("text/plain");if(pasted==null)return;
  // Recognize an entire pasted date even if only a date segment was selected.
  if(parse(pasted,n.type,e.initial,now())!==null&&pasted.trim()){ev.preventDefault();setDraft(e,pasted,true);if(text.isConnected)text.select();}
  // Other text can still be edited; invalid drafts are never saved.
 });
 text.addEventListener("keydown",ev=>{
  if(ev.ctrlKey||ev.metaKey||ev.altKey||ev.isComposing)return;
  const k=ev.key.toLowerCase();
  if(["h","a","o"].includes(k)&&!ev.shiftKey||["H","A","O"].includes(ev.key)){
   ev.preventDefault();ev.stopPropagation();setDraft(e,k,true);if(text.isConnected)text.select();return;
  }
  if(ev.key==="ArrowUp"||ev.key==="ArrowDown"){
   ev.preventDefault();const value=parse(text.value,n.type,e.initial,now());const base=value?.slice(0,10)||iso(now());const [y,m,d]=base.split("-").map(Number);const date=validDate(y,m,d);const next=date&&addDays(date,ev.key==="ArrowUp"?1:-1);if(!next)return;
   const nextValue=iso(next)+(n.type==="datetime-local"&&value?.includes("T")?"T"+value.split("T")[1]:"");setDraft(e,nextValue,true);return;
  }
  if(ev.key==="Enter"){ev.preventDefault();ev.stopPropagation();commit(e);return;}
  if(ev.key==="Escape"&&e.dirty){ev.preventDefault();ev.stopPropagation();n.value=e.initial;e.dirty=false;sync(e,true);return;}
 });
 n.addEventListener("input",()=>{if(!e.dirty)sync(e,true);});
 n.addEventListener("change",()=>{e.dirty=false;sync(e,true);});
 button.addEventListener("mousedown",ev=>ev.preventDefault());
 button.addEventListener("click",()=>{
  if(inactive(n))return;
  if(e.dirty&&!commit(e,true)){n.value=e.initial;e.dirty=false;sync(e,true);}
  if(!n.isConnected)return;
  try{if(typeof n.showPicker==="function"){n.showPicker();return;}}catch{}
  n.classList.add("orb-date-native-fallback");n.tabIndex=0;n.focus();n.click();
 });
 n.addEventListener("blur",()=>{n.classList.remove("orb-date-native-fallback");n.tabIndex=-1;});
}
function scan(scope=document){if(scope.matches?.(selector))enhance(scope);for(const n of scope.querySelectorAll?.(selector)||[])enhance(n);}
function start(){
 scan();
 // Render functions replace HTML and dynamically show/hide conditional fields.
 const observer=new MutationObserver(records=>{
  for(const r of records){
   if(r.type==="childList"){for(const node of r.addedNodes)if(node.nodeType===1)scan(node);}
   else if(r.target.nodeType===1){scan(r.target);}
  }
 });
 observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:["disabled","readonly","required","min","max","hidden","value","type"]});
}
document.addEventListener("submit",ev=>{
 const form=ev.target;if(!form?.querySelectorAll)return;
 for(const n of form.querySelectorAll(selector)){
  const e=entries.get(n);if(!e||inactive(n))continue;
  if(!commit(e,true,false)){ev.preventDefault();ev.stopImmediatePropagation();e.text.focus();e.text.reportValidity();return;}
 }
},true);
document.addEventListener("invalid",ev=>{
 const e=entries.get(ev.target)||textEntries.get(ev.target);if(!e||inactive(e.native))return;
 ev.preventDefault();if(!e.dirty){e.text.value=format(e.native.value);e.dirty=true;}
 check(e,true);e.text.focus();
},true);
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});else start();
})(typeof window!=="undefined"?window:globalThis);
