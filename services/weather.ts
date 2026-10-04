import {call} from '@/lib/firebase';
import type {Ride} from '@/lib/types';
export type WeatherCard={place:string;temperature:number|null;rain:number|null;wind:number|null;visibility:number|null;warning:string;at:string;simulated:boolean};
export async function routeWeather(r:Ride):Promise<WeatherCard[]>{if(r.simulated)return[r.start,...r.stops,r.destination].map((place,i)=>({place,temperature:18-i,rain:i>2?65:15,wind:12+i*2,visibility:i>2?3:10,warning:i>2?'Rain expected near the mountain section':'No warning in this scenario',at:'Simulated arrival '+(12+i)+':20',simulated:true}));return call<WeatherCard[]>('routeWeather',{rideId:r.id});}
