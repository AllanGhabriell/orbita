import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";
const window={};vm.runInNewContext(readFileSync(new URL("../smart-date.js",import.meta.url),"utf8"),{window,Date});
const D=window.OrbitaDate,base=new Date(2026,10,24,12);
const samples=[
 ["21112026","2026-11-21"],["21/11/2026","2026-11-21"],["21-11-2026","2026-11-21"],["21.11.2026","2026-11-21"],["2026-11-21","2026-11-21"],
 ["2111","2026-11-21"],["21/11","2026-11-21"],["21","2026-11-21"],["H","2026-11-24"],["A","2026-11-25"],["O","2026-11-23"],
 ["hoje","2026-11-24"],["amanhã","2026-11-25"],["ontem","2026-11-23"],["+3","2026-11-27"],["-2","2026-11-22"],["+1s","2026-12-01"],
 ["31022026",null],["29022028","2028-02-29"],["29022026",null],["",""],[" 21/11/2026 ","2026-11-21"],["0",null],["31/13/2026",null],
 ["31/04/2026",null],["00000000",null],["32",null],["21/11/26",null]
];
for(const [input,expected] of samples)assert.equal(D.parseDate(input,base),expected,input);
assert.equal(D.parseDate("+1",new Date(2026,11,31,12)),"2027-01-01");
assert.equal(D.parse("21112026","datetime-local","2026-11-24T13:45",base),"2026-11-21T13:45");
assert.equal(D.parse("21/11/2026 9:05","datetime-local","",base),"2026-11-21T09:05");
assert.equal(D.parse("21/11/2026 24:00","datetime-local","",base),null);
assert.equal(D.parse("21/11/2026","datetime-local","",base),null);
assert.equal(D.format("2026-11-21"),"21/11/2026");
assert.equal(D.format("2026-11-21T13:45"),"21/11/2026 13:45");
console.log("Datas inteligentes: "+(samples.length+7)+" verificações.");
