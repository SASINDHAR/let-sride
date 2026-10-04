import {NavigationMap} from './navigation-map';
import type {Ride} from '@/lib/types';

// The preserved lobby uses the same real navigation map as the command center.
export function RideMap({ride,onRoute}:{ride:Ride;onRoute:(v:{distance:string;duration:string})=>void}){
 return <NavigationMap key={ride.id} ride={ride} onRoute={onRoute}/>;
}
