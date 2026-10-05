import {useState} from 'react';

import {Navigation,Play} from 'lucide-react';

import {NavigationMap} from './navigation-map';

import {DemoRoadMap} from './demo-road-map';

import {GoogleGroupMap} from './google-group-map';

import type {Ride,Member} from '@/lib/types';

export function RideMapSwitch({ride,onRider,onHazard,onDemoRoute}:{ride:Ride;onRider:(m:Member)=>void;onHazard:()=>void;onDemoRoute?:(path:{lat:number;lng:number}[])=>void}){

 const [demo,setDemo]=useState(!!ride.simulated);

 return <div className="ride-map-switch"><div className="map-mode-switch" role="group" aria-label="Map mode"><button aria-pressed={!demo} onClick={()=>setDemo(false)}><Navigation size={16}/>Live group map</button>{ride.simulated&&<button aria-pressed={demo} onClick={()=>setDemo(true)}><Play size={16}/>Group simulation</button>}</div>{demo&&ride.simulated?<DemoRoadMap ride={ride} onRider={onRider} onRoute={path=>onDemoRoute?.(path)}/>:<GoogleGroupMap key={ride.id} ride={ride} onRider={onRider} onHazard={onHazard}/>}</div>;

}
