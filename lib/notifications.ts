import {getMessaging,getToken,isSupported} from 'firebase/messaging';
import {firebaseApp,call} from './firebase';
export async function enableNotifications(){
 if(!firebaseApp)throw new Error('Connect Firebase to enable group push notifications.');
 if(!await isSupported())throw new Error('Push notifications are not supported in this browser.');
 if(!import.meta.env.VITE_FIREBASE_VAPID_KEY)throw new Error('The web push VAPID key has not been configured.');
 if(await Notification.requestPermission()!=='granted')throw new Error('Notification permission was not granted.');
 const registration=await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}firebase-messaging-sw.js?config=${encodeURIComponent(JSON.stringify(firebaseApp.options))}`);
 await navigator.serviceWorker.ready;
 const token=await getToken(getMessaging(firebaseApp),{vapidKey:import.meta.env.VITE_FIREBASE_VAPID_KEY,serviceWorkerRegistration:registration});
 if(!token)throw new Error('Could not register this device.');await call('liveRegisterPushToken',{token});return token;
}
