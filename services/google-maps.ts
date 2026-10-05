let loading:Promise<void>|undefined;
export const mapsConfigured=Boolean(import.meta.env.VITE_GOOGLE_MAPS_API_KEY&&import.meta.env.VITE_GOOGLE_MAPS_MAP_ID);
export function loadGoogleMaps(){
 if(typeof window.google!=='undefined'&&window.google.maps)return Promise.resolve();
 if(loading)return loading;
 loading=new Promise<void>((resolve,reject)=>{
  const key=import.meta.env.VITE_GOOGLE_MAPS_API_KEY;if(!key){reject(new Error('MAP API NOT CONFIGURED'));return;}
  const script=document.createElement('script'),callback='letsRideMapsLoaded';const global=window as unknown as Record<string,unknown>;
  const timer=setTimeout(()=>{reject(new Error('Google Maps could not load. Check connectivity and domain restrictions.'));},20000);
  global[callback]=()=>{clearTimeout(timer);resolve();delete global[callback];};global.gm_authFailure=()=>{clearTimeout(timer);reject(new Error('Google Maps authorization failed. Check browser-key restrictions, billing, map ID, and enabled APIs.'));};
  script.src=`https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly&loading=async&callback=${callback}`;script.async=true;script.onerror=()=>{clearTimeout(timer);loading=undefined;reject(new Error('Google Maps is unavailable. No substitute coordinates are used.'));};document.head.append(script);
 });return loading;
}
export type SharedRoute={path:google.maps.LatLngLiteral[];waypoints?:google.maps.LatLngLiteral[];distanceMeters:number;durationSeconds:number;provider:'google';updatedAt:number;revision:number};
export async function googleRoute(start:string,destination:string,stops:string[]):Promise<SharedRoute>{
 await loadGoogleMaps();const {Route}=await google.maps.importLibrary('routes') as google.maps.RoutesLibrary;
 const {routes}=await Route.computeRoutes({origin:start,destination,intermediates:stops.map(s=>({location:s.split('·')[0].trim()})),travelMode:'DRIVING',fields:['path','distanceMeters','durationMillis','legs']});
 const route=routes?.[0];if(!route?.path?.length||route.distanceMeters==null||route.durationMillis==null)throw new Error('Google Maps did not return a usable route.');
 const path=route.path.map(p=>({lat:p.lat,lng:p.lng}));
 return{path,waypoints:route.legs?.map(leg=>leg.endLocation?.toJSON()).filter(Boolean) as google.maps.LatLngLiteral[]||[],distanceMeters:route.distanceMeters,durationSeconds:route.durationMillis/1000,provider:'google',updatedAt:Date.now(),revision:0};
}
