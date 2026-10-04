import {useState} from 'react';
import {Navigation,Play} from 'lucide-react';
import {NavigationMap} from './navigation-map';
import {CommandMap} from './command-map';
import type {Ride,Member} from '@/lib/types';
export function RideMapSwitch({ride,onRider,onHazard}:{ride:Ride;onRider:(m:Member)=>void;onHazard:()=>void}){
 const [demo,setDemo]=useState(false);
 return <div className="ride-map-switch"><div className="map-mode-switch" role="group" aria-label="Map mode"><button aria-pressed={!demo} onClick={()=>setDemo(false)}><Navigation size={16}/>Real navigation</button>{ride.simulated&&<button aria-pressed={demo} onClick={()=>setDemo(true)}><Play size={16}/>Group simulation</button>}</div>{demo&&ride.simulated?<CommandMap ride={ride} onRider={onRider} onHazard={onHazard}/>:<NavigationMap key={ride.id} ride={ride} onRider={onRider}/>}</div>;
}
