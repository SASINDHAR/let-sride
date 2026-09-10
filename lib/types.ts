export type Location={lat:number;lng:number;at:number};
export type Member={id:string;name:string;vehicle:string;ready:boolean;status:string;location?:Location|null;lastUpdated:number};
export type Message={id:string;sender:string;text:string;type:string;at:number};
export type Emergency={id:string;userId:string;name:string;type:string;status:string;at:number;location:Location|null};
export type Ride={id:string;name:string;hostId:string;hostName:string;code:string;start:string;destination:string;date:string;departure:string;description:string;maxRiders:number;status:string;memberIds:string[];members:Member[];messages:Message[];events:Emergency[];stops:string[];warningDistance:number;criticalDistance:number;delayMinutes:number;createdAt:number;startedAt?:number;endedAt?:number};
export type Profile={id:string;name:string;email:string;vehicle:string;phone:string;contactName:string;contactPhone:string;relationship:string;sharePhone:boolean;registration:string;photo:string};
