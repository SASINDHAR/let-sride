import {useEffect,useState} from 'react';

import {onAuthStateChanged} from 'firebase/auth';

import {ref,get} from 'firebase/database';

import {subscribeMyRides,saveRealtimeProfile,realtimeAction} from '@/services/realtime';

import {auth,realtime,configured,demoMode,call} from './firebase';

import {demoProfile,demoRides} from './seed';

import {changeRide} from '../functions/domain.mjs';

import type {Profile,Ride} from './types';

import {simulationRide,tickSimulation,simulationEvent} from '@/services/simulation';

const KEY='letsride-demo-v1';

export function useRides(){

 const [rides,setRides]=useState<Ride[]>(demoMode?demoRides:[]),[profile,setProfile]=useState<Profile>(demoMode?demoProfile:{...demoProfile,id:'',name:'Rider',email:'',vehicle:'',phone:'',contactPhone:'',contactName:'',photo:''}),[signedIn,setSignedIn]=useState(!configured),[loading,setLoading]=useState(configured),[error,setError]=useState('');

 useEffect(()=>{if(!configured){if(!demoMode)return;try{const saved=localStorage.getItem(KEY);const initial:Ride[]=saved?JSON.parse(saved):demoRides;const savedProfile=sessionStorage.getItem('letsride-demo-profile');const currentProfile=savedProfile?JSON.parse(savedProfile):demoProfile;if(savedProfile)setProfile(currentProfile);if(!initial.some(r=>r.simulated)){const example=simulationRide(currentProfile);const next=[example,...initial];localStorage.setItem(KEY,JSON.stringify(next));setRides(next);}else setRides(initial);}catch{setError('Saved demo data could not be loaded.');}const changed=(e:StorageEvent)=>{if(e.key===KEY&&e.newValue){try{setRides(JSON.parse(e.newValue));}catch{}}};window.addEventListener('storage',changed);return()=>window.removeEventListener('storage',changed);}let unsub=()=>{};let authGeneration=0;const off=onAuthStateChanged(auth!,async user=>{const generation=++authGeneration;unsub();setSignedIn(!!user);setLoading(!!user);if(!user){setRides([]);setLoading(false);return;}const initial:Profile={id:user.uid,name:user.displayName||'Rider',email:user.email||'',photo:user.photoURL||'',vehicle:'',phone:'',contactName:'',contactPhone:'',relationship:'',sharePhone:false,registration:''};setProfile(initial);try{const p=await get(ref(realtime!,'profiles/'+user.uid));if(generation!==authGeneration)return;if(p.exists())setProfile(p.val() as Profile);else await saveRealtimeProfile(initial);}catch(e){setError(String(e));}if(generation!==authGeneration)return;unsub=subscribeMyRides(user.uid,next=>{setRides(next);setLoading(false);},message=>{setError(message);setLoading(false);});});return()=>{authGeneration++;off();unsub();};},[]);

 function save(next:Ride[]){localStorage.setItem(KEY,JSON.stringify(next));setRides(next);}

 async function act(id:string,action:string,data:Record<string,any>={}){if(configured){await realtimeAction(id,action,data);return;}const latest=JSON.parse(localStorage.getItem(KEY)||JSON.stringify(rides)) as Ride[];const r=latest.find(r=>r.id===id);if(!r)throw new Error('Ride not found.');if(action==='demoRoadRoute'){if(!r.simulated||!Array.isArray(data.path)||data.path.length<2)throw new Error('A demo road route is required.');save(latest.map(x=>x.id===id?{...x,simulationPath:data.path}:x));return;}if(action==='delete'){if(r.hostId!==profile.id)throw new Error('Only the host can delete rides.');save(latest.filter(r=>r.id!==id));return;}save(latest.map(r=>r.id===id?changeRide(r,profile.id,action,data):r));}

 async function create(data:Record<string,any>){if(!configured&&!demoMode)throw new Error('REALTIME BACKEND NOT CONFIGURED. Open setup or choose Demo ride.');if(configured)return await call<{id:string;code:string}>('liveCreateRide',data);const id=crypto.randomUUID(),code=Array.from(crypto.getRandomValues(new Uint8Array(6)),n=>'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[n%31]).join('');const r:Ride={...demoRides[1],...data,id,code,hostId:profile.id,hostName:profile.name,status:'upcoming',memberIds:[profile.id],members:[{id:profile.id,name:profile.name,vehicle:profile.vehicle,ready:false,status:'Not ready',lastUpdated:Date.now()}],messages:[],events:[],stops:data.stops||[],createdAt:Date.now()};save([r,...rides]);return{id,code};}

 async function lookup(code:string){if(!configured&&!demoMode)throw new Error('REALTIME BACKEND NOT CONFIGURED.');if(configured)return await call<Pick<Ride,'id'|'name'|'hostName'|'start'|'destination'|'date'|'departure'>>('liveLookupRide',{code});const r=rides.find(r=>r.code===code);if(!r||r.status==='completed')throw new Error('No open ride matches that code.');return r;}

 async function join(code:string,briefingAccepted=false){if(!briefingAccepted)throw new Error('Read and accept the safety briefing before joining.');if(configured)return await call<{id:string}>('liveJoinRide',{code,briefingAccepted,replayAccepted:briefingAccepted});const r=rides.find(r=>r.code===code);if(!r)throw new Error('Ride not found.');if(r.status==='completed')throw new Error('Ride has ended.');if(!r.memberIds.includes(profile.id)){if(r.members.length>=r.maxRiders)throw new Error('This ride is full.');save(rides.map(x=>x.id===r.id?{...x,memberIds:[...x.memberIds,profile.id],members:[...x.members,{id:profile.id,name:profile.name,vehicle:profile.vehicle,ready:false,status:'Not ready',lastUpdated:Date.now()}]}:x));}return{id:r.id};}

 async function saveProfile(p:Profile){if(!configured&&!demoMode)throw new Error('Connect Firebase before saving a real profile.');if(configured)await saveRealtimeProfile({...p,id:profile.id});else sessionStorage.setItem('letsride-demo-profile',JSON.stringify(p));setProfile(p);}

 function simulate(){if(!demoMode){window.location.assign(import.meta.env.BASE_URL+'?mode=demo');return '';}if(configured)throw new Error('Use the separate demo workspace for simulations.');const r=simulationRide(profile);save([r,...rides]);return r.id;}

 function simulation(id:string,event:string){if(configured)throw new Error('Simulation cannot mutate a connected ride.');const latest=JSON.parse(localStorage.getItem(KEY)||JSON.stringify(rides)) as Ride[];save(latest.map(r=>r.id!==id||!r.simulated?r:event==='tick'?tickSimulation(r):event==='play'?{...r,simulationRunning:true}:event==='pause'?{...r,simulationRunning:false}:simulationEvent(r,event)));}

 return {rides,profile,signedIn,loading,error,setError,act,create,lookup,join,saveProfile,simulate,simulation};

}
