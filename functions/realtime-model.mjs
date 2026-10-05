import {distance} from './domain.mjs';
export const values=value=>Array.isArray(value)?value:Object.values(value||{});
export function decodeRide(id,raw){
 const members=values(raw.members).map(m=>{const p=raw.locations?.[m.id];return {...m,status:p&&['Not ready','Ready','Riding','Stopped','Offline'].includes(m.status)?p.status:m.status,location:p?{lat:p.latitude,lng:p.longitude,at:p.timestamp,accuracy:p.accuracy,heading:p.heading??null,speed:p.speed??null,altitude:p.altitude??null}:null,lastUpdated:p?.timestamp||m.lastUpdated||m.joinedAt||0,speed:p?.speed!=null?Math.round(p.speed*3.6):undefined,battery:raw.presence?.[m.id]?.battery,connected:raw.presence?.[m.id]?.connected??false,gps:p?`${Math.round(p.accuracy)} m accuracy`:'Unavailable'};});
 return {...raw,id,hostId:raw.leaderId||raw.hostId,memberIds:members.map(m=>m.id),members,messages:values(raw.messages),events:values(raw.incidents),hazards:values(raw.hazards).map(h=>({...h,confirmations:values(h.confirmations),disputes:values(h.disputes)})),timeline:values(raw.timeline),stops:values(raw.stops),meetingPoints:values(raw.meetingPoints),replay:values(raw.replay),simulated:false};
}
export function encodeRide(ride,previous={}){
 const map=items=>Object.fromEntries((items||[]).map(item=>[item.id,item]));
 const {members,events,memberIds,locations,...rest}=ride;
 const publicMembers=members.map(({location,speed,battery,gps,connected,...member})=>member);
 const result={...previous,...rest,leaderId:ride.hostId,members:map(publicMembers),messages:map(ride.messages),incidents:map(events),hazards:map(ride.hazards),timeline:map(ride.timeline)};
 result.locations=Object.fromEntries(Object.entries(previous.locations||{}).filter(([uid])=>memberIds.includes(uid)));
 result.presence=Object.fromEntries(Object.entries(previous.presence||{}).filter(([uid])=>memberIds.includes(uid)));
 result.sharedRoute=ride.sharedRoute||null;
 if(ride.status!=='active'){result.locations={};result.presence={};}
 return JSON.parse(JSON.stringify(result));
}
export function validateFix(point,previous,now=Date.now()){
 if(!point||!Number.isFinite(point.latitude)||Math.abs(point.latitude)>90||!Number.isFinite(point.longitude)||Math.abs(point.longitude)>180)throw new Error('Invalid GPS coordinates.');
 if(!Number.isFinite(point.timestamp)||point.timestamp>now+2000||point.timestamp<now-15000)throw new Error('GPS timestamp is not current.');
 if(!Number.isFinite(point.accuracy)||point.accuracy<0||point.accuracy>100)throw new Error('Location accuracy is currently low.');
 for(const key of ['speed','heading','altitude'])if(point[key]!=null&&!Number.isFinite(point[key]))throw new Error('Invalid GPS telemetry.');
 if(point.speed!=null&&(point.speed<0||point.speed>100))throw new Error('GPS_ANOMALY: implausible speed.');
 if(point.heading!=null&&(point.heading<0||point.heading>=360))throw new Error('Invalid GPS heading.');
 if(previous){const elapsed=(point.timestamp-previous.timestamp)/1000;if(elapsed<=0)throw new Error('GPS timestamp must advance.');const gap=distance({lat:point.latitude,lng:point.longitude},{lat:previous.latitude,lng:previous.longitude});if(gap>100*elapsed+point.accuracy+previous.accuracy)throw new Error('GPS_ANOMALY: keeping previous valid position.');}
 return point;
}
export function locationState(member,now=Date.now(),staleMs=20000,offlineMs=60000){if(!member.location)return 'UNAVAILABLE';const age=now-member.location.at;if(age< -2000)return 'GPS_ANOMALY';return member.connected===false||age>=offlineMs?'OFFLINE':age>=staleMs?'STALE':member.location.accuracy>60?'WEAK GPS':'LIVE';}
