import {useEffect,useRef,useState} from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {ArrowUpRight,Compass,Flag,LocateFixed,MapPin,Navigation,OctagonX,Route,Volume2,VolumeX} from 'lucide-react';
import type {Ride,Member} from '@/lib/types';
import {fresh} from '@/services/location';
import {canReroute,meters,navigationUrl,progressAt,requestRoute,resolvePlace,type Fix,type Place,type RoadRoute} from '@/services/navigation';

function label(text:string){const span=document.createElement('span');span.textContent=text;return span;}
function markerIcon(text:string,color:string){const el=document.createElement('div');el.className='real-map-marker';el.style.backgroundColor=color;el.textContent=text;return L.divIcon({html:el,className:'real-map-marker-shell',iconSize:[30,30],iconAnchor:[15,15]});}

export function NavigationMap({ride,onRider,onRoute}:{ride:Ride;onRider?:(m:Member)=>void;onRoute?:(v:{distance:string;duration:string})=>void}){
 const node=useRef<HTMLDivElement>(null),map=useRef<L.Map|null>(null),routeLayer=useRef<L.LayerGroup|null>(null),crewLayer=useRef<L.LayerGroup|null>(null),you=useRef<L.CircleMarker|null>(null),accuracy=useRef<L.Circle|null>(null);
 const [route,setRoute]=useState<RoadRoute|null>(null),[plannedKey,setPlannedKey]=useState(''),[fix,setFix]=useState<Fix|null>(null),[tracking,setTracking]=useState(false),[consent,setConsent]=useState(false),[follow,setFollow]=useState(true),[voice,setVoice]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[tileError,setTileError]=useState(false),[directions,setDirections]=useState(false),[destination,setDestination]=useState(ride.destination),[start,setStart]=useState(ride.start),[includeStops,setIncludeStops]=useState(true),[clock,setClock]=useState(Date.now());
 const alive=useRef(false),watch=useRef<number|null>(null),request=useRef<AbortController|null>(null),routeRef=useRef<RoadRoute|null>(null),fixRef=useRef<Fix|null>(null),followRef=useRef(true),voiceRef=useRef(false),offSince=useRef(0),lastReroute=useRef(0),spoken=useRef(''),running=useRef(false),revision=useRef(0),routing=useRef(false),initialRoute=useRef(false);
 const routeKey=JSON.stringify([start,destination,includeStops,ride.stops]);
 const progress=route&&fix?progressAt(route,fix):null;
 const stale=!!fix&&clock-fix.at>15000,poor=!!fix&&fix.accuracy>60,off=!!progress&&progress.gap>Math.max(75,(fix?.accuracy||0)*2);
 useEffect(()=>{alive.current=true;const timer=setInterval(()=>setClock(Date.now()),1000);return()=>{alive.current=false;clearInterval(timer);if(watch.current!==null)navigator.geolocation.clearWatch(watch.current);watch.current=null;running.current=false;request.current?.abort();if(typeof speechSynthesis!=='undefined')speechSynthesis.cancel();};},[]);
 useEffect(()=>{followRef.current=follow;},[follow]);useEffect(()=>{voiceRef.current=voice;},[voice]);
 useEffect(()=>{
  if(!node.current)return;
  const instance=L.map(node.current,{zoomControl:true,scrollWheelZoom:false}).setView([48.75,8.65],9);map.current=instance;
  L.tileLayer(import.meta.env.VITE_MAP_TILE_URL||'https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',detectRetina:false}).on('tileerror',()=>setTileError(true)).addTo(instance);
  routeLayer.current=L.layerGroup().addTo(instance);crewLayer.current=L.layerGroup().addTo(instance);
  instance.on('dragstart',()=>setFollow(false));
  const observer=new ResizeObserver(()=>instance.invalidateSize());observer.observe(node.current);
  return()=>{observer.disconnect();instance.remove();map.current=null;};
 },[]);
 useEffect(()=>{
  const layer=crewLayer.current;layer?.clearLayers();if(!layer||ride.simulated)return;
  for(const m of ride.members.filter(m=>fresh(m,clock))){const color=m.status==='Emergency'?'#e96868':m.id===ride.hostId?'#84b7f9':m.id===ride.sweepId?'#c89af0':m.status==='Stopped'?'#e9c670':'#c3e69d';L.marker([m.location!.lat,m.location!.lng],{icon:markerIcon(m.name.slice(0,2).toUpperCase(),color),title:m.name}).bindTooltip(label(`${m.name} · ${m.status}`)).on('click',()=>onRider?.(m)).addTo(layer);}
  for(const h of (ride.hazards||[]).filter(h=>!h.simulated)){L.marker([h.location.lat,h.location.lng],{icon:markerIcon('!','#e6bf69')}).bindPopup(label(`${h.type} · reported, ${h.confirmations.length} confirmations`)).addTo(layer);}
  for(const e of ride.events.filter(e=>e.location&&!['Resolved','Cancelled'].includes(e.status))){L.marker([e.location!.lat,e.location!.lng],{icon:markerIcon('SOS','#ec7972')}).bindPopup(label(`${e.name} · ${e.type} · ${e.status}`)).addTo(layer);}
 },[ride.members,ride.hazards,ride.events,ride.sweepId,clock]);
 function draw(next:RoadRoute,fit=true){
  routeRef.current=next;setRoute(next);onRoute?.({distance:meters(next.distance),duration:`${Math.round(next.duration/60)} min`});const layer=routeLayer.current,instance=map.current;if(!layer||!instance)return;layer.clearLayers();
  const line=L.polyline(next.geometry.map(p=>[p.lat,p.lng] as L.LatLngTuple),{color:'#286ad6',weight:6,opacity:.9}).addTo(layer);
  next.places.forEach((p,i)=>L.marker([p.lat,p.lng],{icon:markerIcon(i===0?'A':i===next.places.length-1?'B':String(i),'#d5edb8'),title:p.name}).bindPopup(label(p.name)).addTo(layer));
  if(fit)instance.fitBounds(line.getBounds(),{padding:[32,32],maxZoom:16});
 }
 async function plan(){
  if(running.current){stop();}setBusy(true);setError('');setFix(null);fixRef.current=null;routeRef.current=null;setRoute(null);routeLayer.current?.clearLayers();you.current?.remove();accuracy.current?.remove();you.current=null;accuracy.current=null;
  const seq=++revision.current;request.current?.abort();const controller=new AbortController();request.current=controller;
  try{const values=[start,...(includeStops?ride.stops:[]),destination];if(values.length>12)throw new Error('Use at most ten planned stops, or turn off intermediate stops.');const places:Place[]=[];for(const value of values)places.push(await resolvePlace(value,controller.signal));const next=await requestRoute(places,controller.signal);if(alive.current&&seq===revision.current){draw(next);setPlannedKey(routeKey);}}
  catch(e){if(alive.current&&seq===revision.current&&(e as Error).name!=='AbortError')setError((e as Error).message);}
  finally{if(alive.current&&seq===revision.current)setBusy(false);}
 }
 function stop(){running.current=false;routing.current=false;revision.current++;if(watch.current!==null)navigator.geolocation.clearWatch(watch.current);watch.current=null;request.current?.abort();setTracking(false);setBusy(false);setConsent(false);if(typeof speechSynthesis!=='undefined')speechSynthesis.cancel();}
 async function reroute(position:Fix,remaining:Place[]){
  if(routing.current||!remaining.length)return;routing.current=true;const seq=++revision.current;request.current?.abort();const controller=new AbortController();request.current=controller;lastReroute.current=Date.now();setBusy(true);
  try{const next=await requestRoute([{lat:position.lat,lng:position.lng,name:'Your current GPS position'},...remaining],controller.signal);if(alive.current&&running.current&&seq===revision.current){draw(next,false);initialRoute.current=false;setError('');offSince.current=0;spoken.current='';}}
  catch(e){if(alive.current&&running.current&&seq===revision.current&&(e as Error).name!=='AbortError')setError('Route update failed. '+(e as Error).message);}
  finally{if(seq===revision.current){routing.current=false;if(alive.current)setBusy(false);}}
 }
 function receive(p:GeolocationPosition){
  if(!alive.current||!running.current)return;
  const position:Fix={lat:p.coords.latitude,lng:p.coords.longitude,accuracy:p.coords.accuracy,at:p.timestamp,speed:p.coords.speed==null?null:Math.max(0,p.coords.speed*3.6),heading:p.coords.heading};
  fixRef.current=position;setFix(position);const instance=map.current;
  if(instance){if(!you.current){you.current=L.circleMarker([position.lat,position.lng],{radius:9,color:'#fff',weight:3,fillColor:'#2878e1',fillOpacity:1}).bindTooltip('Your actual GPS position').addTo(instance);accuracy.current=L.circle([position.lat,position.lng],{radius:position.accuracy,color:'#2878e1',weight:1,fillOpacity:.08}).addTo(instance);}else{you.current.setLatLng([position.lat,position.lng]);accuracy.current?.setLatLng([position.lat,position.lng]).setRadius(position.accuracy);}if(followRef.current)instance.setView([position.lat,position.lng],Math.max(instance.getZoom(),16),{animate:false});}
  const current=routeRef.current;if(!current)return;const status=progressAt(current,position),now=Date.now();
  if(position.accuracy>60||now-position.at>15000){offSince.current=0;return;}
  if(initialRoute.current){if(!lastReroute.current||now-lastReroute.current>=30000)void reroute(position,current.places.slice(1));return;}
  if(status.gap>Math.max(75,position.accuracy*2)){offSince.current ||=now;if(canReroute(position,status.gap,offSince.current,now,lastReroute.current))void reroute(position,current.places.slice((status.next?.leg||0)+1));}
  else offSince.current=0;
  if(voiceRef.current&&typeof speechSynthesis!=='undefined'&&status.next&&status.turnDistance<350&&status.gap<75&&spoken.current!==String(status.next.offset)+status.next.instruction){spoken.current=String(status.next.offset)+status.next.instruction;const speech=new SpeechSynthesisUtterance(`In ${meters(status.turnDistance)}, ${status.next.instruction}`);speech.lang='en-GB';speechSynthesis.speak(speech);}
 }
 function startGps(){
  if(running.current)return;setConsent(false);setError('');if(!navigator.geolocation){setError('GPS is unavailable on this device. Open Google Maps for navigation.');return;}if(!routeRef.current){setError('Preview and review your route first.');return;}
  running.current=true;initialRoute.current=true;setTracking(true);setFollow(true);followRef.current=true;lastReroute.current=0;offSince.current=0;
  watch.current=navigator.geolocation.watchPosition(receive,e=>{if(!alive.current||!running.current)return;setError(e.code===1?'Location permission denied. Allow location for this site in your browser settings.':e.code===2?'GPS unavailable. Move outdoors or use Google Maps.':'Waiting for GPS. Retry at a safe stop.');if(e.code===1)stop();},{enableHighAccuracy:true,maximumAge:0,timeout:15000});
 }
 const remaining=progress?.remaining??route?.distance,minutes=route?Math.round(route.duration*(1-(progress?.fraction||0))/60):null,arrived=!!route&&!!fix&&!stale&&!poor&&progress!=null&&progress.remaining<35&&progress.gap<50;
 return <section className="real-navigation" aria-label="Real-time navigation">
  <div className="navigation-heading"><div><span className="eyebrow">REAL STREET MAP · ACTUAL DEVICE GPS</span><h2><Navigation size={18}/>Live navigation</h2></div><span className={'gps-pill '+(tracking&&!stale&&!poor&&fix?'connected':'')}>{tracking?fix?(stale?'GPS stale':poor?'GPS accuracy low':'GPS live'):'Waiting for GPS':'GPS off'}</span></div>
  <div className="real-map-wrap"><div className="real-map-canvas" ref={node} aria-label="OpenStreetMap road map"/><div className="real-map-overlay"><span><Compass size={14}/>North up</span><button aria-label="Recenter on my GPS location" disabled={!fix} onClick={()=>{setFollow(true);followRef.current=true;if(fix)map.current?.setView([fix.lat,fix.lng],16);}}><LocateFixed size={19}/></button>{route&&<button aria-label="Show entire road route" onClick={()=>{setFollow(false);map.current?.fitBounds(L.latLngBounds(route.geometry.map(p=>[p.lat,p.lng] as L.LatLngTuple)),{padding:[28,28]});}}><Route size={19}/></button>}</div>{tileError&&<div className="map-service-note">Some map tiles could not load. Check your connection.</div>}</div>
  <div className="navigation-panel">
   <div className="next-turn" aria-live="polite"><span className="turn-icon"><Navigation size={26}/></span><div><small>{arrived?'DESTINATION NEARBY':tracking&&fix&&!stale&&!poor?(off?'OFF ROUTE · REVIEW AT A SAFE STOP':'NEXT DIRECTION'):route?'ROUTE PREVIEW':'CHOOSE YOUR ROUTE'}</small><h3>{arrived?'You are near your final destination':stale?'Waiting for a fresh GPS update':poor?'Waiting for a more accurate GPS fix':tracking&&progress?.next?progress.next.instruction:route?route.steps[0]?.instruction:'Preview a road route, then enable GPS'}</h3>{tracking&&progress&&!stale&&!poor&&!off&&<b>{meters(progress.turnDistance)}</b>}</div></div>
   {route&&<div className="navigation-stats"><div><span>{tracking?'Remaining':'Route distance'}</span><b>{remaining==null?'—':meters(remaining)}</b></div><div><span>Estimated time</span><b>{minutes} min</b></div><div><span>GPS speed</span><b>{fix?.speed!=null&&!stale?`${Math.round(fix.speed)} km/h`:'—'}</b></div><div><span>GPS accuracy</span><b>{fix?`±${Math.round(fix.accuracy)} m`:'—'}</b></div></div>}
   <div className="navigation-actions">{tracking?<button className="button" onClick={stop}><OctagonX size={17}/>Stop GPS navigation</button>:<button className="button primary" disabled={!route||busy||plannedKey!==routeKey} onClick={()=>setConsent(true)}><Navigation size={17}/>Start GPS navigation</button>}{tracking&&<button className="button" aria-pressed={follow} onClick={()=>{setFollow(!follow);followRef.current=!follow;}}><LocateFixed size={17}/>{follow?'Following':'Follow me'}</button>}<a className="button" href={navigationUrl(destination,includeStops?ride.stops:[])} target="_blank" rel="noreferrer"><ArrowUpRight size={17}/>Navigate in Google Maps</a>{route&&<button className="button" onClick={()=>setDirections(!directions)}><Route size={17}/>{directions?'Hide':'Show'} directions</button>}{typeof speechSynthesis!=='undefined'&&<button className="icon-button" aria-label={voice?'Mute voice directions':'Enable voice directions'} aria-pressed={voice} onClick={()=>{setVoice(!voice);if(voice)speechSynthesis.cancel();}}>{voice?<Volume2 size={19}/>:<VolumeX size={19}/>}</button>}</div>
   {consent&&<div className="gps-consent" role="region" aria-label="GPS navigation consent"><h3>Navigate from your real location?</h3><p>Your browser will ask for location permission. Your GPS coordinates and destination are sent to the road-routing service to calculate directions. This does not enable location sharing with the ride group.</p><p>GPS updates while this map is open. Your browser may pause tracking when locked or backgrounded.</p><div className="actions"><button className="button primary" onClick={startGps}>Allow GPS & start navigation</button><button className="button" onClick={()=>setConsent(false)}>Cancel</button></div></div>}
   {error&&<p className="error" role="alert">{error}</p>}{busy&&<p className="navigation-loading" role="status">{tracking?'Updating route from your GPS position…':'Finding places and calculating road directions…'}</p>}
   {!tracking&&<form className="navigation-form" onSubmit={e=>{e.preventDefault();void plan();}}><label><MapPin size={15}/>Starting point<input value={start} required maxLength={180} onChange={e=>setStart(e.target.value)}/></label><label><Flag size={15}/>Destination<input value={destination} required maxLength={180} onChange={e=>setDestination(e.target.value)}/></label>{ride.stops.length>0&&<label className="navigation-check"><input type="checkbox" checked={includeStops} onChange={e=>setIncludeStops(e.target.checked)}/>Include {ride.stops.length} planned stops</label>}<button className="button" disabled={busy}><Route size={17}/>{route?'Update road route':'Preview road route'}</button></form>}
   {route&&<p className="resolved-route"><b>Review selected places:</b> {route.places.map(p=>p.name).join(' → ')}</p>}
   {directions&&route&&<ol className="turn-list">{route.steps.map((s,i)=><li key={i} className={progress?.next===s?'current':''}><span>{i+1}</span><div><b>{s.instruction}</b><small>{meters(s.distance)} · Stop {s.leg+1}</small></div></li>)}</ol>}
   <p className="navigation-source">Road directions: OSRM · Driving route estimates exclude live traffic. {ride.simulated?'Synthetic riders and hazards are hidden on this real map.':'Shared riders appear only with fresh, consented locations.'} {includeStops&&ride.stops.length>3?'Google Maps handoff includes the first three stops; this map includes all planned stops. ':''} {fix&&`Last GPS update ${Math.max(0,Math.floor((clock-fix.at)/1000))}s ago.`}</p>
  </div>
 </section>;
}
