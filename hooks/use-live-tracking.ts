import {useEffect,useRef,useState} from 'react';
import {ref,onValue} from 'firebase/database';
import {configured,realtime} from '@/lib/firebase';
import {publishFix,connectPresence,subscribeConnection,type LiveFix} from '@/services/realtime';
import {validateFix} from '../functions/realtime-model.mjs';
import type {Ride} from '@/lib/types';
export function useLiveTracking(ride:Ride|undefined,uid:string){
 const [sharing,setSharing]=useState(false),[connected,setConnected]=useState(false),[message,setMessage]=useState(''),[fix,setFix]=useState<LiveFix|null>(null),[lastSynced,setLastSynced]=useState(0),[battery,setBattery]=useState<number|undefined>();const serverOffset=useRef(0);
 useEffect(()=>{if(!configured)return;const off=subscribeConnection(setConnected),clock=onValue(ref(realtime!,'.info/serverTimeOffset'),s=>{serverOffset.current=s.val()||0;});return()=>{off();clock();};},[]);
 useEffect(()=>{let active=true;const batteryApi=navigator as Navigator&{getBattery?:()=>Promise<{level:number;addEventListener:(name:string,fn:()=>void)=>void;removeEventListener:(name:string,fn:()=>void)=>void}>};let cleanup=()=>{};batteryApi.getBattery?.().then(b=>{const update=()=>{if(active)setBattery(Math.round(b.level*100));};update();b.addEventListener('levelchange',update);cleanup=()=>b.removeEventListener('levelchange',update);}).catch(()=>{});return()=>{active=false;cleanup();};},[]);
 useEffect(()=>{setSharing(false);setFix(null);setLastSynced(0);},[ride?.id,ride?.status,uid]);
 useEffect(()=>{
  if(!sharing||!configured||!connected||!ride||ride.simulated||ride.status!=='active'||!ride.memberIds.includes(uid))return;
  if(!navigator.geolocation){setMessage('GPS unavailable on this device.');setSharing(false);return;}
  let alive=true,inFlight=false,lastWrite=0,previous:LiveFix|undefined,disconnect:(()=>Promise<void>)|undefined;const rideId=ride.id;
  connectPresence(rideId,uid,battery).then(stop=>{if(alive)disconnect=stop;else void stop();}).catch(e=>{if(alive)setMessage(e.message);});
  const watch=navigator.geolocation.watchPosition(async position=>{
   if(!alive)return;const now=Date.now()+serverOffset.current;const point:LiveFix={userId:uid,rideId,latitude:position.coords.latitude,longitude:position.coords.longitude,accuracy:position.coords.accuracy,speed:position.coords.speed,heading:position.coords.heading,altitude:position.coords.altitude,timestamp:Math.floor(position.timestamp+serverOffset.current),status:(position.coords.speed||0)>.8?'Riding':'Stopped'};
   try{validateFix(point,previous,now);}catch(e){setMessage((e as Error).message);return;}setFix(point);
   if(inFlight||Date.now()-lastWrite<3000)return;inFlight=true;
   try{await publishFix(point,previous,now);if(alive){previous=point;lastWrite=Date.now();setLastSynced(Date.now());setMessage('');}}catch(e){if(alive)setMessage((e as Error).message);}finally{inFlight=false;}
  },error=>{if(alive){setMessage(error.code===1?'Location permission denied. Enable it in browser settings to share.':'GPS unavailable. Last known positions will be marked stale.');if(error.code===1)setSharing(false);}},{enableHighAccuracy:true,maximumAge:0,timeout:15000});
  return()=>{alive=false;navigator.geolocation.clearWatch(watch);if(disconnect)void disconnect();};
 },[sharing,connected,ride?.id,ride?.status,uid]);
 return{sharing,setSharing,connected,message,fix,lastSynced,battery};
}
