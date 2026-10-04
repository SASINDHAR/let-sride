import type {Hazard} from '@/lib/types';
export const hazardTypes=['Pothole','Accident','Road construction','Slippery road','Debris','Animal','Traffic','Poor visibility','Flooding','Sharp turn','Road closure','Police / traffic control'];
export function confidence(h:Hazard){const n=h.confirmations.length-h.disputes.length;return n>=3?'Corroborated':n>=1?'Reported':'Disputed';}
export function visibleHazards(h:Hazard[],now=Date.now()){return h.filter(x=>now-x.at<86400000);}
