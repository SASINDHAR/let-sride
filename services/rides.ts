import type {Ride} from '@/lib/types';
export interface RideService {list():Promise<Ride[]>;subscribe(rideId:string,receive:(ride:Ride)=>void):()=>void;action(rideId:string,action:string,data?:Record<string,unknown>):Promise<void>;}
export function publicRide(r:Ride){return{id:r.id,name:r.name,date:r.date,difficulty:r.difficulty||'Moderate',riderCount:r.members.length,capacity:r.maxRiders};}
export const briefingText=['Follow the leader’s route and agreed communication signals.','If separated, stop safely and send a message. Never chase the group at unsafe speeds.','For an emergency, stop safely, alert your group and use your phone to call local emergency services.','SOS in this app does not automatically call or text emergency services.'];
