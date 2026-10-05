import {GoogleGroupMap} from './google-group-map';
import type {Ride} from '@/lib/types';
export function RideMap({ride,onRoute}:{ride:Ride;onRoute:(v:{distance:string;duration:string})=>void}){return <GoogleGroupMap key={ride.id} ride={ride}/>;}
