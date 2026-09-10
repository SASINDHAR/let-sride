# Let’s Ride

A responsive React + TypeScript group-riding application with a usable local demo and a Firebase/Google Cloud backend implementation.

## Run locally

Requires Node 22.13 or later.

```sh
npm install --ignore-scripts
npm run dev
```

The static Vite configuration avoids the scaffold’s Cloudflare `workerd` dependency, which does not support Windows ARM. On Windows, the scripts use Vite’s runner configuration loader. Unused server-scaffold dependencies were removed to avoid shipping unrelated vulnerable packages.

Without Firebase configuration the app opens in **Demo workspace**. This is explicitly browser-local data, not a remote multiuser service. Create a ride, copy its code, toggle readiness, start/pause/end it, chat, report a demo SOS, and acknowledge/resolve the event. In My profile, switch between the demo host and rider; the rider can join with `RIDE7X`. Separate tabs share demo rides through storage events. Profiles are tab-local. Do not rely on the demo for actual emergencies.

## Connect Firebase and Google Cloud

1. Create a Firebase project with Firestore in your chosen region, Email/Password and Google Authentication, Cloud Storage, and the Blaze billing plan for backend services.
2. Copy `.env.example` to `.env.local` and fill the public Firebase web-app identifiers. The app does not switch to Firebase mode until API key, project ID, and app ID are present. Add the deployed hostname and localhost to Firebase Authentication authorized domains.
3. Register a web app in Firebase App Check using reCAPTCHA v3 and fill `VITE_FIREBASE_APPCHECK_SITE_KEY`. Callable functions enforce App Check. Configure authorized domains and token exchange before using the backend. Never put a service-account private key in a Vite variable.
4. Enable Maps JavaScript API, Places API and Directions API for the map implementation. Set a browser/referrer-restricted `VITE_GOOGLE_MAPS_API_KEY` and API restrictions. Enable billing. The Maps key is public by design. Without a key the app shows a clearly labelled route diagram and external navigation links, never simulated GPS.
5. Enable Vertex AI. Give the Functions runtime service account Vertex AI User access. Configure `VERTEX_LOCATION` and `GEMINI_MODEL` using `functions/.env.example`. Verify the selected model is available in your project. AI calls run on the backend.
6. Enable Firebase Cloud Messaging web push and put its public VAPID key in `VITE_FIREBASE_VAPID_KEY`. Riders opt in from My profile. Push payloads omit names, coordinates, and message bodies from lock screens. Delivery is best effort and must not be treated as guaranteed emergency response.
7. Install Firebase CLI, authenticate, select the project, install backend dependencies, and deploy:

```sh
npm --prefix functions install
firebase use --add
firebase deploy --only firestore,storage,functions
npm run build
firebase deploy --only hosting
```

Functions v2 runs on Google Cloud Run infrastructure in `europe-west3`. Match `VITE_FIREBASE_REGION`. Firebase Hosting and Sites can both serve the static frontend. A private Sites preview does not deploy Firebase resources. Vite configuration is compiled at build time: fill `.env.local` and rebuild to enable connected mode.

8. Sign in, save your rider profile, then create a ride. Check with two real accounts on separate devices before inviting a riding group. Verify Firestore and Storage rules with the Firebase Emulator Suite and validate App Check, push delivery, GPS permissions, routing, and data deletion in the real project.

## Architecture and API

Browser → Firebase Authentication + App Check → callable Cloud Functions → Firestore transactions. The browser subscribes to `rides` using `memberIds array-contains auth.uid`. Every write to rides goes through the server. Direct client writes to rides and join-code enumeration are denied.

| Callable | Request | Result / authorization |
| --- | --- | --- |
| `createRide` | name, start, destination, date, departure, maxRiders, description, stops | Creates host membership and a unique six-character code atomically |
| `lookupRide` | code | Limited invitation metadata; authenticated and rate limited |
| `joinRide` | code | Atomic capacity check and membership creation |
| `rideAction` | rideId, action, action fields | Validated mutation; host-only controls enforced server-side |
| `emergencyContact` | rideId, eventId | Host only, open emergency only, rider consent required |
| `registerPushToken` | token | Registers this signed-in user’s push token |
| `rideAssistant` | rideId, question | Member-only Vertex AI advice with bounded inputs and rate limit |
| `rideWeather` | rideId | Current destination conditions from Open-Meteo, never AI-generated |

Supported ride actions: `start`, `pause`, `end`, `ready`, `status`, `location`, `message`, `sos`, `respond`, `settings`, `stop`, `leave`, `remove`, `delete`.

## Database

| Collection | Contents | Access |
| --- | --- | --- |
| `users/{uid}` | Private profile, phone, emergency contact and consent | Owner only; backend exposes contacts narrowly for an open emergency |
| `rides/{rideId}` | Route addresses, schedule, host, status, member IDs, bounded members/messages/events, thresholds | Current ride members only |
| `joinCodes/{code}` | rideId | Backend only; deleted on completion/deletion |
| `pushTokens/{uid}` | Web push tokens | Backend only |
| `rateLimits/{uid_bucket}` | Request window and count | Backend only; TTL configured |

This implementation embeds the bounded member list, last 150 messages, and up to 100 emergency events inside a ride document to keep transitions atomic. Rides are limited to 50 members and 15 stops. It intentionally differs from the proposed separate `rideMembers`, `messages`, and `emergencyEvents` collections. For larger groups or high-frequency updates, migrate them to per-ride subcollections, add pagination and notification fan-out, and load-test before scaling. The current shared ride document is not a high-scale telemetry store.

## Location and safety behavior

- GPS requires explicit consent. Updates are throttled to 15 seconds and are sent only while the active ride screen is mounted. Pause/end/unmount stops the watch. Ending removes current rider and emergency coordinates. No continuous route history is recorded.
- Location older than two minutes is excluded from the live map. A scheduled backend sweep removes stale locations every five minutes and expires emergency coordinates after 24 hours.
- Separation warnings use configurable distance and time relative to the center of fresh group positions, computed while the screen is open. These are deterministic warnings, not an AI danger classifier. They do not call emergency services.
- SOS supports six types, optional current coordinates, duplicate-open-event prevention, and host acknowledgement / help-on-the-way / resolution. Manual status cannot clear an unresolved emergency.
- Browsers can suspend GPS and push when backgrounded or locked. This is a responsive web app, not native Android/iOS background tracking. A native companion and on-device testing are required for dependable locked-screen tracking.
- External navigation launches Google Maps. In an urgent emergency, use the phone’s emergency-call capability. Automatic calling and a worldwide emergency-number resolver are not implemented.

## Validation

```sh
npm run build
npm test
node --check functions/index.mjs
```

Tests cover unauthorized mutations, host-only controls, readiness confirmation, start/pause/end transitions, coordinate validation, SOS response order, membership removal, and distance calculations. Cloud deployment, Firebase rules emulator tests, real-device GPS, push notifications and provider integration tests require a configured project and have not been run. WebMCP read/open tools are feature-detected; no supported WebMCP execution context was available for contract verification.

## Remaining scope before production use

This is a working MVP implementation, not a certification of production readiness. Native background tracking, route optimization, place autocomplete/map selection, approval queues, photo upload UI, phone authentication, per-stop weather/official severe-weather alerts, advanced analytics, durable server-side separation notifications, and full real-device end-to-end tests remain. Weather geocoding uses the first matching city and should be upgraded to the host’s exact selected destination coordinates. Obtain operational monitoring, cost controls, backups and project-specific privacy/retention settings before launch.

Hero photograph: Yulian Alexeyev / Unsplash, [Schwarzwaldhochstraße](https://unsplash.com/de/fotos/wald-aus-der-vogelperspektive-eXLE2b2Zqis).

Integration references: [Firestore realtime listeners](https://firebase.google.com/docs/firestore/query-data/listen), [Firestore transactions](https://firebase.google.com/docs/firestore/manage-data/transactions), [Vertex AI quickstart](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/start/quickstart).

