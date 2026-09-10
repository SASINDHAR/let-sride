/* Firebase configuration contains public project identifiers only. */
importScripts('https://www.gstatic.com/firebasejs/12.19.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.19.0/firebase-messaging-compat.js');
const config=JSON.parse(new URL(self.location.href).searchParams.get('config')||'null');
if(config){firebase.initializeApp(config);firebase.messaging();}
