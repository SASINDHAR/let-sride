import test from 'node:test';
import assert from 'node:assert/strict';
import {parsePoint,instructionFor,requestRoute,progressAt,canReroute,navigationUrl} from '../services/navigation.ts';

test('navigation accepts geographic coordinates and rejects invalid destinations',()=>{
 assert.deepEqual(parsePoint('48.775, 9.182'),{lat:48.775,lng:9.182});
 assert.equal(parsePoint('91, 0'),null);assert.equal(parsePoint('0, 181'),null);assert.equal(parsePoint('Stuttgart'),null);
});
test('turn directions use actual provider maneuvers',()=>{
 assert.equal(instructionFor({name:'B500',maneuver:{type:'turn',modifier:'right'}}),'Turn right on B500');
 assert.equal(instructionFor({maneuver:{type:'roundabout',exit:3}}),'Enter the roundabout and take exit 3');
 assert.equal(instructionFor({maneuver:{type:'arrive'}}),'Arrive at your stop');
 assert.equal(instructionFor({name:'B27',maneuver:{type:'continue',modifier:'uturn'}}),'Make a U-turn on B27');
});
test('route adapter preserves road geometry, stop legs and navigation steps',async()=>{
 const original=globalThis.fetch;let url;
 globalThis.fetch=async value=>{url=value;return {ok:true,json:async()=>({code:'Ok',routes:[{distance:1112,duration:120,geometry:{coordinates:[[8,48],[8,48.01]]},legs:[{steps:[{distance:1112,duration:120,name:'Test road',geometry:{coordinates:[[8,48],[8,48.01]]},maneuver:{type:'depart',modifier:'north',location:[8,48]}},{distance:0,duration:0,name:'',geometry:{coordinates:[[8,48.01]]},maneuver:{type:'arrive',location:[8,48.01]}}]}]}]})};};
 try{const route=await requestRoute([{lat:48,lng:8,name:'A'},{lat:48.01,lng:8,name:'B'}]);assert.match(url,/8,48;8,48.01/);assert.match(url,/steps=true/);assert.deepEqual(route.geometry[1],{lat:48.01,lng:8});const p=progressAt(route,{lat:48.005,lng:8});assert.ok(p.fraction>.49&&p.fraction<.51);assert.ok(p.gap<1);assert.equal(p.next.type,'arrive');assert.ok(p.remaining>550&&p.remaining<565);assert.ok(progressAt(route,{lat:48.005,lng:8.003}).gap>200);}
 finally{globalThis.fetch=original;}
});
test('provider errors do not become invented routes',async()=>{
 const original=globalThis.fetch;globalThis.fetch=async()=>({ok:true,json:async()=>({code:'NoRoute'})});try{await assert.rejects(()=>requestRoute([{lat:0,lng:0,name:'A'},{lat:1,lng:1,name:'B'}]),/No driving route/);}finally{globalThis.fetch=original;}
});
test('rerouting requires reliable fresh fixes, sustained deviation and a cooldown',()=>{
 const fix={lat:48,lng:8,accuracy:10,at:100000,speed:null,heading:null};
 assert.equal(canReroute(fix,120,80000,100000,0),true);
 assert.equal(canReroute({...fix,accuracy:100},300,80000,100000,0),false);
 assert.equal(canReroute({...fix,at:50000},120,80000,100000,0),false);
 assert.equal(canReroute(fix,120,99000,100000,0),false);
 assert.equal(canReroute(fix,120,80000,100000,90000),false);
 assert.equal(canReroute(fix,20,80000,100000,0),false);
});
test('native navigation starts from the device location and escapes destination text',()=>{
 const url=new URL(navigationUrl('Berlin & Potsdam',['Calw · fuel']));assert.equal(url.searchParams.get('origin'),null);assert.equal(url.searchParams.get('destination'),'Berlin & Potsdam');assert.equal(url.searchParams.get('dir_action'),'navigate');assert.equal(url.searchParams.get('waypoints'),'Calw');
});
