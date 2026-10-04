import {distance} from '../functions/domain.mjs';

export type GeoPoint={lat:number;lng:number};
export type Fix=GeoPoint & {at:number;accuracy:number;speed:number|null;heading:number|null};
export type Place=GeoPoint & {name:string};
export type Direction={instruction:string;distance:number;duration:number;start:GeoPoint;end:GeoPoint;type:string;modifier?:string;leg:number;offset:number};
export type RoadRoute={geometry:GeoPoint[];steps:Direction[];distance:number;duration:number;places:Place[];lengths:number[]};
const routingBase=(import.meta.env?.VITE_ROUTING_URL||'https://router.project-osrm.org').replace(/\/$/,'');
const geocodingBase=(import.meta.env?.VITE_GEOCODING_URL||'https://nominatim.openstreetmap.org').replace(/\/$/,'');
let geocodeQueue=Promise.resolve();
let lastGeocode=0;
const cache=new Map<string,Place>();

export function parsePoint(value:string):GeoPoint|null{
 const match=value.trim().match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
 if(!match)return null;
 const lat=Number(match[1]),lng=Number(match[2]);
 return Math.abs(lat)<=90&&Math.abs(lng)<=180?{lat,lng}:null;
}
export function instructionFor(step:{name?:string;ref?:string;destinations?:string;maneuver:{type:string;modifier?:string;exit?:number}}){
 const {type,modifier,exit}=step.maneuver,road=step.name||step.ref;
 const direction=modifier||'straight';
 const verb=type==='arrive'?'Arrive at your stop':modifier==='uturn'?'Make a U-turn':type==='depart'?'Head '+direction:type==='roundabout'||type==='rotary'?`Enter the roundabout${exit?` and take exit ${exit}`:''}`:type==='merge'?`Merge ${direction}`:type==='fork'?`Keep ${direction} at the fork`:type==='end of road'?`At the end of the road, turn ${direction}`:type==='turn'?(direction==='straight'?'Continue straight':`Turn ${direction}`):type==='new name'?'Continue':`Continue ${direction}`;
 return verb+(type!=='arrive'&&road?` on ${road}`:'')+(step.destinations?` toward ${step.destinations}`:'');
}
async function json(url:string,signal?:AbortSignal){
 const r=await fetch(url,{signal:signal?AbortSignal.any([signal,AbortSignal.timeout(20000)]):AbortSignal.timeout(20000)});
 if(!r.ok)throw new Error(r.status===429?'The map service is busy. Please wait before retrying.':'Navigation provider unavailable. Try again or open Google Maps.');
 return r.json();
}
export async function resolvePlace(value:string,signal?:AbortSignal):Promise<Place>{
 const point=parsePoint(value);if(point)return {...point,name:value.trim()};
 const name=value.split('·')[0].trim();if(name.length<2||name.length>180)throw new Error('Enter a city, address, or latitude, longitude.');
 if(cache.has(name))return cache.get(name)!;
 let output:Place|undefined;
 // Explicit submissions only. Cache lookups and serialize requests at less than 1/sec.
 const task=geocodeQueue.then(async()=>{
  if(signal?.aborted)throw new DOMException('Cancelled','AbortError');
  const wait=Math.max(0,1100-(Date.now()-lastGeocode));if(wait)await new Promise(r=>setTimeout(r,wait));
  lastGeocode=Date.now();
  const data=await json(`${geocodingBase}/search?format=jsonv2&limit=1&q=${encodeURIComponent(name)}`,signal);
  if(!data?.[0])throw new Error(`Could not find “${name}”. Use a more specific address or coordinates.`);
  output={lat:Number(data[0].lat),lng:Number(data[0].lon),name:String(data[0].display_name)};
  if(!Number.isFinite(output.lat)||!Number.isFinite(output.lng)||Math.abs(output.lat)>90||Math.abs(output.lng)>180)throw new Error('The place provider returned invalid coordinates.');
  cache.set(name,output);
 });geocodeQueue=task.catch(()=>{});await task;return output!;
}
export async function requestRoute(places:Place[],signal?:AbortSignal):Promise<RoadRoute>{
 if(places.length<2||places.length>12)throw new Error('Choose a destination and at most ten intermediate stops.');
 const coords=places.map(p=>`${p.lng},${p.lat}`).join(';');
 const data=await json(`${routingBase}/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=true`,signal);
 if(data.code!=='Ok'||!data.routes?.[0])throw new Error('No driving route found between these locations.');
 const r=data.routes[0],geometry:GeoPoint[]=r.geometry.coordinates.map((p:number[])=>({lat:p[1],lng:p[0]}));
 let offset=0;const steps:Direction[]=[];
 r.legs.forEach((leg:any,i:number)=>leg.steps.forEach((s:any)=>{const points=s.geometry.coordinates;steps.push({instruction:instructionFor(s),distance:s.distance,duration:s.duration,start:{lat:s.maneuver.location[1],lng:s.maneuver.location[0]},end:{lat:points.at(-1)[1],lng:points.at(-1)[0]},type:s.maneuver.type,modifier:s.maneuver.modifier,leg:i,offset});offset+=s.distance;}));
 const lengths=[0];for(let i=1;i<geometry.length;i++)lengths.push(lengths[i-1]+distance(geometry[i-1],geometry[i]));
 return {geometry,steps,distance:r.distance,duration:r.duration,places,lengths};
}
export function progressAt(route:RoadRoute,point:GeoPoint){
 let best={gap:Infinity,along:0,index:0};
 for(let i=0;i<route.geometry.length-1;i++){
  const a=route.geometry[i],b=route.geometry[i+1],scale=Math.cos(point.lat*Math.PI/180),dx=(b.lng-a.lng)*scale,dy=b.lat-a.lat,px=(point.lng-a.lng)*scale,py=point.lat-a.lat;
  const t=Math.min(1,Math.max(0,(px*dx+py*dy)/(dx*dx+dy*dy||1)));
  const projected={lat:a.lat+dy*t,lng:a.lng+(b.lng-a.lng)*t},gap=distance(point,projected);
  if(gap<best.gap)best={gap,along:route.lengths[i]+(route.lengths[i+1]-route.lengths[i])*t,index:i};
 }
 const geometryLength=route.lengths.at(-1)||1,fraction=Math.min(1,best.along/geometryLength),traveled=fraction*route.distance;
 const next=route.steps.find(s=>s.type!=='depart'&&s.offset>=traveled-12)||route.steps.at(-1);
 return {...best,fraction,traveled,remaining:Math.max(0,route.distance-traveled),next,turnDistance:Math.max(0,(next?.offset||route.distance)-traveled)};
}
export function canReroute(fix:Fix,gap:number,firstOffRoute:number,now:number,lastReroute:number){return fix.accuracy<=60&&now-fix.at<15000&&gap>Math.max(75,fix.accuracy*2)&&firstOffRoute>0&&now-firstOffRoute>=15000&&now-lastReroute>=30000;}
export function meters(value:number){return value<1000?`${Math.round(value/10)*10} m`:`${(value/1000).toFixed(1)} km`;}
export function navigationUrl(destination:string,stops:string[]=[]){const q=new URLSearchParams({api:'1',destination:destination.split('·')[0].trim(),travelmode:'driving',dir_action:'navigate'});if(stops.length)q.set('waypoints',stops.slice(0,3).map(s=>s.split('·')[0].trim()).join('|'));return `https://www.google.com/maps/dir/?${q}`;}
