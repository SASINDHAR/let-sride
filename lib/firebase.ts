import {initializeApp} from 'firebase/app';
import {getAuth,GoogleAuthProvider,signInWithPopup,signInWithEmailAndPassword,createUserWithEmailAndPassword,signOut} from 'firebase/auth';
import {getFirestore} from 'firebase/firestore';
import {getDatabase} from 'firebase/database';
import {getFunctions,httpsCallable} from 'firebase/functions';
import {initializeAppCheck,ReCaptchaV3Provider} from 'firebase/app-check';
const env=import.meta.env;
export const demoMode=new URLSearchParams(window.location.search).get('mode')==='demo';
export const backendConfigured=Boolean(env.VITE_FIREBASE_API_KEY&&env.VITE_FIREBASE_PROJECT_ID&&env.VITE_FIREBASE_APP_ID&&env.VITE_FIREBASE_DATABASE_URL);
export const configured=backendConfigured&&!demoMode;
const app=configured?initializeApp({apiKey:env.VITE_FIREBASE_API_KEY,authDomain:env.VITE_FIREBASE_AUTH_DOMAIN,projectId:env.VITE_FIREBASE_PROJECT_ID,appId:env.VITE_FIREBASE_APP_ID,databaseURL:env.VITE_FIREBASE_DATABASE_URL,messagingSenderId:env.VITE_FIREBASE_MESSAGING_SENDER_ID,storageBucket:env.VITE_FIREBASE_STORAGE_BUCKET}):null;
if(app&&env.VITE_FIREBASE_APPCHECK_SITE_KEY)initializeAppCheck(app,{provider:new ReCaptchaV3Provider(env.VITE_FIREBASE_APPCHECK_SITE_KEY),isTokenAutoRefreshEnabled:true});
export const auth=app?getAuth(app):null;
export const db=app?getFirestore(app):null;
export const realtime=app?getDatabase(app):null;
const fns=app?getFunctions(app,env.VITE_FIREBASE_REGION||'europe-west3'):null;
const liveFns=app?getFunctions(app,env.VITE_FIREBASE_LIVE_REGION||'europe-west1'):null;
export async function call<T=any>(action:string,data:Record<string,unknown>={}){const service=action.startsWith('live')?liveFns:fns;if(!service)throw new Error('Connect Firebase to use this service.');return (await httpsCallable(service,action)(data)).data as T;}
export async function login(email:string,password:string,register=false){if(!auth)throw new Error('Firebase sign-in is not configured.');return register?createUserWithEmailAndPassword(auth,email,password):signInWithEmailAndPassword(auth,email,password);}
export async function googleLogin(){if(!auth)throw new Error('Firebase sign-in is not configured.');return signInWithPopup(auth,new GoogleAuthProvider());}
export async function logout(){if(auth)await signOut(auth);}
export const firebaseApp=app;
