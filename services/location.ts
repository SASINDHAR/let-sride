import {distance} from '../functions/domain.mjs';
import type {Member,Ride,Location} from '@/lib/types';
export {distance};
export const fresh=(m:Member,now=Date.now())=>!!m.location&&now-m.location.at<120000&&m.status!=='Offline';
export function awareness(ride:Ride,now=Date.now()){
 const valid=ride.members.filter(m=>fresh(m,now));const center=valid.length?{lat:valid.reduce((s,m)=>s+m.location!.lat,0)/valid.length,lng:valid.reduce((s,m)=>s+m.location!.lng,0)/valid.length}:null;
 const leader=ride.members.find(m=>m.id===ride.hostId),sweep=ride.members.find(m=>m.id===ride.sweepId);
 return ride.members.map((m,i)=>{const validLocation=fresh(m,now);const measure=(p?:Member)=>validLocation&&p&&fresh(p,now)?distance(m.location!,p.location!):null;const fromCenter=validLocation&&center?distance(m.location!,center):null;const sos=ride.events.some(e=>e.userId===m.id&&!['Resolved','Cancelled'].includes(e.status));const state=sos?'SOS':m.status==='Safe'?'SAFE':!validLocation&&ride.status==='active'?'OFFLINE':m.status==='Separated'?'SEPARATED':m.status==='Stopped'?'STOPPED':ride.status==='upcoming'?'NOT STARTED':ride.status==='paused'?'STOPPED':ride.status==='completed'?'FINISHED':'ACTIVE';return{...m,state,age:Math.max(0,Math.floor((now-m.lastUpdated)/1000)),fromCenter,fromLeader:measure(leader),fromSweep:measure(sweep),fromPrevious:measure(ride.members[i-1]),fresh:validLocation};});
}
export function currentPosition():Promise<Location>{return new Promise((resolve,reject)=>{if(!navigator.geolocation)return reject(new Error('GPS is unavailable on this device.'));navigator.geolocation.getCurrentPosition(p=>resolve({lat:p.coords.latitude,lng:p.coords.longitude,at:Date.now()}),e=>reject(new Error(e.code===1?'Location permission denied. You can enter coordinates manually.':'GPS unavailable. Please try outdoors or enter a known location.')),{timeout:15000,maximumAge:10000});});}
