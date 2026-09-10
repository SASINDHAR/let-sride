export const kinds=['Medical emergency','Bike breakdown','Accident','Out of fuel','Lost / separated','Other emergency'];
export function text(value,max=120){if(typeof value!=='string'||!value.trim()||value.length>max)throw new Error('Please check the required fields.');return value.trim();}
export function number(value,min,max){if(!Number.isFinite(value)||value<min||value>max)throw new Error('Value outside the allowed range.');return value;}
export function coordinates(value,now=Date.now()){if(!value)return null;return {lat:number(value.lat,-90,90),lng:number(value.lng,-180,180),at:now};}
export function distance(a,b){const rad=x=>x*Math.PI/180;const dlat=rad(b.lat-a.lat),dlng=rad(b.lng-a.lng);return 6371000*2*Math.asin(Math.sqrt(Math.min(1,Math.sin(dlat/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dlng/2)**2)));}
export function changeRide(original,uid,action,data={},now=Date.now()){
 const r=structuredClone(original),member=r.members.find(m=>m.id===uid);if(!member)throw new Error('Join this ride first.');
 const host=()=>{if(r.hostId!==uid)throw new Error('Only the host can do this.');};
 const ongoing=()=>{if(r.status==='completed')throw new Error('This ride is complete.');};
 const system=t=>r.messages.push({id:`system-${now}`,sender:'Ride update',text:t,type:'system',at:now});
 switch(action){
 case 'start':host();if(!['upcoming','paused'].includes(r.status))throw new Error('Ride cannot be started.');if(r.members.some(m=>!m.ready)&&!data.confirmUnready)throw new Error('Some riders are not ready.');r.status='active';r.startedAt??=now;system('The ride has started. Stay with the group and ride safely.');break;
 case 'pause':host();if(r.status!=='active')throw new Error('Ride is not active.');r.status='paused';r.members.forEach(m=>m.location=null);system('Ride paused. Stop in a safe location.');break;
 case 'end':host();if(!['active','paused'].includes(r.status))throw new Error('Ride is not in progress.');r.status='completed';r.endedAt=now;r.members.forEach(m=>m.location=null);r.events.forEach(e=>e.location=null);system('Ride completed. Thank you for riding together.');break;
 case 'ready':ongoing();member.ready=!!data.ready;if(!r.events.some(e=>e.userId===uid&&e.status!=='Resolved')&&r.status==='upcoming')member.status=member.ready?'Ready':'Not ready';member.lastUpdated=now;break;
 case 'status':ongoing();if(r.events.some(e=>e.userId===uid&&e.status!=='Resolved'))throw new Error('The host must resolve your open emergency first.');if(!['Riding','Stopped','Delayed','Offline'].includes(data.status))throw new Error('Invalid rider status.');member.status=data.status;member.statusSince=now;member.lastUpdated=now;break;
 case 'location':if(r.status!=='active'&&data.location)throw new Error('Location sharing requires an active ride.');member.location=coordinates(data.location,now);member.lastUpdated=now;break;
 case 'message':ongoing();if(data.type==='announcement')host();r.messages.push({id:`message-${now}-${uid}`,sender:member.name,text:text(data.text,2000),type:data.type==='announcement'?'announcement':'text',at:now});break;
 case 'sos':if(r.status!=='active'&&r.status!=='paused')throw new Error('SOS requires an active ride.');if(!kinds.includes(data.type))throw new Error('Select an emergency type.');if(r.events.some(e=>e.userId===uid&&e.status!=='Resolved'))throw new Error('Your SOS is already open.');r.events.push({id:`sos-${now}-${uid}`,userId:uid,name:member.name,type:data.type,status:'Reported',at:now,location:coordinates(data.location,now)});member.status='Emergency';system(`Emergency reported by ${member.name}.`);break;
 case 'respond':host();{const e=r.events.find(e=>e.id===data.eventId);if(!e)throw new Error('Emergency not found.');const transitions={'Reported':['Acknowledged','Help on the way','Resolved'],'Acknowledged':['Help on the way','Resolved'],'Help on the way':['Resolved']};if(!transitions[e.status]?.includes(data.status))throw new Error('Invalid emergency transition.');e.status=data.status;if(data.status==='Resolved'){e.resolvedAt=now;e.location=null;const m=r.members.find(m=>m.id===e.userId);if(m)m.status='Stopped';}system(`${e.name}: ${data.status}.`);}break;
 case 'settings':host();ongoing();r.warningDistance=number(data.warningDistance,100,10000);r.criticalDistance=number(data.criticalDistance,r.warningDistance,20000);r.delayMinutes=number(data.delayMinutes,1,30);break;
 case 'stop':host();ongoing();if(r.stops.length>=15)throw new Error('Maximum 15 stops.');r.stops.push(text(data.stop));break;
 case 'leave':if(r.hostId===uid)throw new Error('Hosts must delete the ride instead.');r.members=r.members.filter(m=>m.id!==uid);r.memberIds=r.memberIds.filter(id=>id!==uid);r.events=r.events.filter(e=>e.userId!==uid);break;
 case 'remove':host();if(data.userId===uid)throw new Error('You cannot remove the host.');r.members=r.members.filter(m=>m.id!==data.userId);r.memberIds=r.memberIds.filter(id=>id!==data.userId);r.events=r.events.filter(e=>e.userId!==data.userId);break;
 default:throw new Error('Unknown action.');
 }r.messages=r.messages.slice(-150);return r;
}
