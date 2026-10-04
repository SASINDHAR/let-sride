export const emergencyCategories=['Crash','Medical emergency','Mechanical failure','Unsafe road','Personal safety','Other'];
export const checkInItems=['Helmet','Vehicle ready','Phone charged','Emergency contact available','Fuel sufficient','License / required documents'];
export type SensorEvent={id:string;source:'simulation'|'phone'|'watch'|'vehicle';at:number;speedBefore:number;deceleration:number;confidence:number};
export interface IncidentSensor{start(onEvent:(event:SensorEvent)=>void):()=>void;}
// This adapter never reads sensors or sends SOS. A device adapter can implement the same interface.
export class SimulatedIncidentSensor implements IncidentSensor{private callback:((e:SensorEvent)=>void)|null=null;start(fn:(e:SensorEvent)=>void){this.callback=fn;return()=>{this.callback=null;};}trigger(){this.callback?.({id:crypto.randomUUID(),source:'simulation',at:Date.now(),speedBefore:48,deceleration:7.8,confidence:.65});}}
