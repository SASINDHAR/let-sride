import assert from 'node:assert/strict';
import test,{before,after,beforeEach} from 'node:test';
import {readFile} from 'node:fs/promises';
import {initializeTestEnvironment,assertSucceeds,assertFails} from '@firebase/rules-unit-testing';
import {ref,get,set,remove,onValue} from 'firebase/database';
import {initializeApp,deleteApp} from 'firebase-admin/app';
import {liveCreateRide,liveLookupRide,liveJoinRide,liveRideAction,liveDirectMessage} from './realtime-backend.mjs';
let env,admin;
before(async()=>{process.env.FIREBASE_DATABASE_EMULATOR_HOST='127.0.0.1:9000';admin=initializeApp({projectId:'demo-letsride-v2',databaseURL:'https://demo-letsride-v2.firebaseio.com'});env=await initializeTestEnvironment({projectId:'demo-letsride-v2',database:{host:'127.0.0.1',port:9000,rules:await readFile(new URL('../database.rules.json',import.meta.url),'utf8')}});});
after(async()=>{await env?.cleanup();await deleteApp(admin);});
beforeEach(async()=>{await env.clearDatabase();await env.withSecurityRulesDisabled(async context=>{await set(ref(context.database()),{rides:{trip:{leaderId:'leader',status:'active',members:{leader:{id:'leader'},rider:{id:'rider'}},locations:{},replay:{'1':{at:1,positions:[{id:'rider',lat:48,lng:9}]}}}},userRides:{rider:{trip:true}},profiles:{leader:{id:'leader',name:'Leader',email:'leader@example.test',sharePhone:true,contactPhone:'private'}},liveJoinCodes:{'LR-ABCDE':{rideId:'trip'}}});});});
const database=uid=>uid?env.authenticatedContext(uid).database():env.unauthenticatedContext().database();
const fix=(uid='rider',extra={})=>({userId:uid,rideId:'trip',latitude:48,longitude:9,accuracy:8,heading:90,speed:10,timestamp:Date.now(),status:'Riding',...extra});
test('only joined riders can read live rides and private replay',async()=>{await assertSucceeds(get(ref(database('rider'),'rides/trip')));await assertFails(get(ref(database('outsider'),'rides/trip')));await assertFails(get(ref(database(),'rides/trip')));await assertFails(get(ref(database('rider'),'rides')));});
test('riders can publish only their own GPS',async()=>{await assertSucceeds(set(ref(database('rider'),'rides/trip/locations/rider'),fix()));await assertFails(set(ref(database('rider'),'rides/trip/locations/leader'),fix('leader')));await assertFails(set(ref(database('outsider'),'rides/trip/locations/outsider'),fix('outsider')));});
test('invalid coordinates, wrong identities and future timestamps are denied',async()=>{for(const extra of [{latitude:91},{longitude:181},{userId:'leader'},{rideId:'wrong'},{timestamp:Date.now()+20000},{accuracy:200},{speed:1000},{extra:'unknown'}])await assertFails(set(ref(database('rider'),'rides/trip/locations/rider'),fix('rider',extra)));});
test('impossible jumps and excessive update frequency are rejected',async()=>{const old=fix('rider',{timestamp:Date.now()-3000});await assertSucceeds(set(ref(database('rider'),'rides/trip/locations/rider'),old));await assertFails(set(ref(database('rider'),'rides/trip/locations/rider'),{...old,timestamp:old.timestamp+1000}));await assertFails(set(ref(database('rider'),'rides/trip/locations/rider'),fix('rider',{latitude:50})));});
test('paused rides deny location sharing but permit removing your own location',async()=>{await env.withSecurityRulesDisabled(c=>set(ref(c.database(),'rides/trip/status'),'paused'));await assertFails(set(ref(database('rider'),'rides/trip/locations/rider'),fix()));await assertSucceeds(remove(ref(database('rider'),'rides/trip/locations/rider')));});
test('clients cannot self-assign roles, change routes or forge SOS records',async()=>{for(const path of ['members/rider/role','sharedRoute','incidents/forged','leaderId','status'])await assertFails(set(ref(database('rider'),'rides/trip/'+path),'forged'));});
test('private profiles and invitation indexes cannot be enumerated',async()=>{await assertFails(get(ref(database('rider'),'profiles/leader')));await assertFails(get(ref(database('rider'),'liveJoinCodes')));await assertSucceeds(get(ref(database('rider'),'userRides/rider')));await assertFails(get(ref(database('leader'),'userRides/rider')));});
test('presence is writable only by its rider',async()=>{await assertSucceeds(set(ref(database('rider'),'rides/trip/presence/rider'),{connected:true,lastSeen:Date.now(),battery:74}));await assertFails(set(ref(database('rider'),'rides/trip/presence/leader'),{connected:true,lastSeen:Date.now()}));});
test('two clients create, join, receive GPS changes, share routes, hazards, SOS and end a real-mode ride',async()=>{
 await env.withSecurityRulesDisabled(async c=>{await set(ref(c.database(),'profiles/leader'),{id:'leader',name:'Leader',email:'leader@example.test',sharePhone:false});await set(ref(c.database(),'profiles/rider'),{id:'rider',name:'Rider',email:'rider@example.test',sharePhone:false});});
 const invoke=(fn,uid,data)=>fn.run({auth:{uid,token:{}},data});
 const created=await invoke(liveCreateRide,'leader',{name:'Device acceptance',start:'Albstadt',destination:'Baden-Baden',date:'2026-10-05',departure:'09:00',maxRiders:8,stops:[],recordReplay:false});
 const preview=await invoke(liveLookupRide,'rider',{code:created.code});if(preview.name!=='Device acceptance')throw new Error('Wrong invitation.');
 await invoke(liveJoinRide,'rider',{code:created.code,briefingAccepted:true});await invoke(liveRideAction,'leader',{rideId:created.id,action:'start',confirmUnready:true});
 const receive=(uid,predicate)=>new Promise((resolve,reject)=>{let off=()=>{};const timer=setTimeout(()=>{off();reject(new Error('Realtime listener did not receive the update.'));},8000);off=onValue(ref(database(uid),'rides/'+created.id),snapshot=>{if(predicate(snapshot.val())){clearTimeout(timer);off();resolve(snapshot.val());}},reject);});
 const riderReceives=receive('rider',r=>r?.locations?.leader?.latitude===48);await set(ref(database('leader'),`rides/${created.id}/locations/leader`),{...fix('leader'),rideId:created.id});await riderReceives;
 const leaderReceives=receive('leader',r=>r?.locations?.rider?.latitude===48.001);await set(ref(database('rider'),`rides/${created.id}/locations/rider`),{...fix('rider',{latitude:48.001}),rideId:created.id});await leaderReceives;
 await invoke(liveRideAction,'leader',{rideId:created.id,action:'sharedRoute',route:{path:[{lat:48,lng:9},{lat:48.2,lng:9.2}],distanceMeters:35000,durationSeconds:2500}});await assertFails(set(ref(database('rider'),`rides/${created.id}/sharedRoute`),{}));
 await invoke(liveRideAction,'rider',{rideId:created.id,action:'hazard',type:'Pothole',severity:'Moderate',description:'Test observation',direction:'Along route',location:{lat:48.001,lng:9}});
 await invoke(liveRideAction,'rider',{rideId:created.id,action:'sos',type:'Mechanical failure',location:{lat:48.001,lng:9}});
 const current=(await get(ref(database('leader'),'rides/'+created.id))).val();if(Object.values(current.hazards||{}).length!==1||Object.values(current.incidents||{}).length!==1||current.sharedRoute.distanceMeters!==35000)throw new Error('Ride changes were not synchronized.');
 await invoke(liveRideAction,'leader',{rideId:created.id,action:'end'});const ended=(await get(ref(database('rider'),'rides/'+created.id))).val();if(ended.locations||ended.status!=='completed')throw new Error('End did not clear GPS.');await assertFails(set(ref(database('rider'),`rides/${created.id}/locations/rider`),{...fix(),rideId:created.id}));
});

test('private replay denies outsiders and expires at the retention deadline',async()=>{
 await env.withSecurityRulesDisabled(async c=>{await set(ref(c.database(),'rideReplays/trip'),{frames:{one:{at:Date.now()}}});await set(ref(c.database(),'rides/trip/recordingExpiresAt'),Date.now()+60000);});
 await assertSucceeds(get(ref(database('rider'),'rideReplays/trip')));await assertFails(get(ref(database('outsider'),'rideReplays/trip')));await assertFails(set(ref(database('rider'),'rideReplays/trip/frames/forged'),{}));
 await env.withSecurityRulesDisabled(c=>set(ref(c.database(),'rides/trip/recordingExpiresAt'),Date.now()-1));await assertFails(get(ref(database('rider'),'rideReplays/trip')));
});
test('direct messages are private to the two participating riders',async()=>{
 await env.withSecurityRulesDisabled(c=>set(ref(c.database(),'profiles/rider'),{id:'rider',name:'Rider',email:'rider@example.test',sharePhone:false}));
 await liveDirectMessage.run({auth:{uid:'leader',token:{}},data:{rideId:'trip',to:'rider',text:'Private test'}});
 await assertSucceeds(get(ref(database('rider'),'liveInboxes/rider/trip')));await assertFails(get(ref(database('leader'),'liveInboxes/rider/trip')));await assertFails(get(ref(database('outsider'),'liveInboxes/rider/trip')));
 await assert.rejects(liveDirectMessage.run({auth:{uid:'outsider',token:{}},data:{rideId:'trip',to:'rider',text:'Forbidden'}}));
});
test('recorded rides require explicit replay consent to join',async()=>{
 await env.withSecurityRulesDisabled(async c=>{await set(ref(c.database(),'profiles/rider'),{id:'rider',name:'Rider',email:'rider@example.test',sharePhone:false});await remove(ref(c.database(),'rides/trip/members/rider'));await set(ref(c.database(),'rides/trip/maxRiders'),8);await set(ref(c.database(),'rides/trip/recordReplay'),true);});
 await assert.rejects(liveJoinRide.run({auth:{uid:'rider',token:{}},data:{code:'LR-ABCDE',briefingAccepted:true}}));
 await liveJoinRide.run({auth:{uid:'rider',token:{}},data:{code:'LR-ABCDE',briefingAccepted:true,replayAccepted:true}});await assertSucceeds(get(ref(database('rider'),'rides/trip')));
});
