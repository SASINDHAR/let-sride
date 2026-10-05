import {ref,onValue,set,remove,onDisconnect,serverTimestamp} from 'firebase/database';
import {realtime,auth,call} from '@/lib/firebase';
import {decodeRide,validateFix} from '../functions/realtime-model.mjs';
import type {Ride,Profile} from '@/lib/types';
export type LiveFix={userId:string;rideId:string;latitude:number;longitude:number;accuracy:number;heading:number|null;speed:number|null;altitude:number|null;timestamp:number;status:string};
export function subscribeMyRides(uid:string,receive:(rides:Ride[])=>void,onError:(message:string)=>void){
 const snapshots=new Map<string,Ride>(),listeners=new Map<string,()=>void>();
 const stop=onValue(ref(realtime!,`userRides/${uid}`),snapshot=>{const ids=new Set(Object.keys(snapshot.val()||{}));for(const [id,off] of listeners)if(!ids.has(id)){off();listeners.delete(id);snapshots.delete(id);}for(const id of ids)if(!listeners.has(id))listeners.set(id,onValue(ref(realtime!,`rides/${id}`),s=>{if(s.exists())snapshots.set(id,decodeRide(id,s.val()) as Ride);else snapshots.delete(id);receive([...snapshots.values()].sort((a,b)=>b.createdAt-a.createdAt));},e=>{snapshots.delete(id);receive([...snapshots.values()]);onError(e.message);}));receive([...snapshots.values()]);},e=>onError(e.message));
 return()=>{stop();listeners.forEach(off=>off());snapshots.clear();};
}
export function subscribeConnection(receive:(connected:boolean)=>void){return onValue(ref(realtime!,'.info/connected'),s=>receive(s.val()===true));}
export async function saveRealtimeProfile(profile:Profile){if(profile.id!==auth?.currentUser?.uid)throw new Error('Sign in before saving your profile.');await set(ref(realtime!,`profiles/${profile.id}`),JSON.parse(JSON.stringify(profile)));}
export async function realtimeAction(rideId:string,action:string,data:Record<string,unknown>={}){return call('liveRideAction',{rideId,action,...data});}
export async function publishFix(fix:LiveFix,previous?:LiveFix,now=Date.now()){if(auth?.currentUser?.uid!==fix.userId)throw new Error('Only your own location can be shared.');validateFix(fix,previous,now);await set(ref(realtime!,`rides/${fix.rideId}/locations/${fix.userId}`),fix);}
export async function clearFix(rideId:string,uid:string){await remove(ref(realtime!,`rides/${rideId}/locations/${uid}`));}
export async function connectPresence(rideId:string,uid:string,battery?:number){const presence=ref(realtime!,`rides/${rideId}/presence/${uid}`),location=ref(realtime!,`rides/${rideId}/locations/${uid}`);await onDisconnect(presence).set({connected:false,lastSeen:serverTimestamp()});await set(presence,{connected:true,lastSeen:serverTimestamp(),...(battery!=null?{battery}:{})});return async()=>{await Promise.allSettled([remove(location),set(presence,{connected:false,lastSeen:serverTimestamp()})]);await Promise.allSettled([onDisconnect(presence).cancel(),onDisconnect(location).cancel()]);};}
