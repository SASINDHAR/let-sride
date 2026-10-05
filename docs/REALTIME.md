# Real-time group navigation

LetsRide preserves the existing rides, safety briefing, hazard confirmation, deliberate SOS countdown, profiles and demo tools. Real rides now use Firebase Authentication, Firebase Realtime Database and Google Maps. The frontend remains React, TypeScript, Vite and Tailwind.

## Supplied Android configuration

The provided google-services JSON belongs to `lets-ride-app-481919` and the Android app `com.sasi.letsride`. Its reusable public project identifiers were imported into ignored `.env.local`. Its Android app ID cannot replace a Firebase web app ID. The verified web configuration was subsequently retrieved from the project's public Firebase Hosting initialization endpoint, imported locally, and saved as repository Actions variables. Its web app ID is `1:89934218088:web:75733a95f2a3f987684cdd`. That configuration has no Database URL. Realtime Database, Maps and App Check activation remain pending; the web API key must also have browser-compatible restrictions.

## Deployment prerequisites

Copy the public Firebase web configuration and restricted Maps browser key into `.env.local` for local builds, or into GitHub repository **Actions variables** with the same `VITE_*` names as `.env.example`. The Pages workflow consumes these variables at build time. Do not commit `.env.local`, Admin keys, service-account files, or private server API keys.

Create Realtime Database in **europe-west1 (Belgium)**. Copy its actual database URL; the URL is not inferred. Enable Email/Password authentication and optionally Google. Add `sasindhar.github.io` and approved preview domains to Firebase Authentication and reCAPTCHA/App Check. Callable live Functions enforce App Check. Register a reCAPTCHA v3 provider and set `VITE_FIREBASE_APPCHECK_SITE_KEY` before testing mutations.

Enable Maps JavaScript API and Routes API, create a JavaScript map ID, and restrict the browser key to `https://sasindhar.github.io/*` and explicitly approved localhost/preview referrers. Apply API restrictions for the APIs actually used. Full directions open Google Maps; the embedded map is a shared route and group-tracking interface, not an invented turn-by-turn navigator.

Firebase backend deployment requires an authenticated Firebase CLI and a Blaze project. Select the exact project yourself, then deploy the Database rules and the live Functions. Deploying GitHub Pages does not deploy these resources:

```sh
npm --prefix functions ci
firebase deploy --project YOUR_PROJECT_ID --only database,functions:liveCreateRide,functions:liveLookupRide,functions:liveJoinRide,functions:liveRideAction,functions:liveEmergencyContact,functions:liveDirectMessage,functions:liveRegisterPushToken,functions:liveLocationRecorded,functions:livePresenceEvent,functions:liveScheduleSos,functions:liveEscalateSos,functions:liveReplayRetention,functions:liveMessageRetention,functions:liveMemberHistory,functions:liveRouteWeather,functions:liveRideWeather
```

The live functions run in europe-west1. Existing Firestore functions are retained for legacy compatibility but are not used by the new real ride workspace. A scheduled retention function and task queue require the corresponding Cloud Scheduler and Cloud Tasks APIs/IAM setup. Give the runtime identity permission to enqueue the SOS task queue and invoke its task function as described in [Firebase task queue documentation](https://firebase.google.com/docs/functions/task-functions).

## Data and authorization

- `profiles/{uid}`: private profile, email, emergency contacts and preferences; owner-only browser access.
- `userRides/{uid}/{rideId}`: server-managed membership index, visible only to that user.
- `rides/{rideId}`: member-only metadata, user-keyed members, shared route, locations, presence, hazards, incidents, messages and timestamped events.
- `liveJoinCodes/{code}`: server-only code index. Authenticated, rate-limited invitation preview returns limited information; it does not expose a live map.
- `liveInboxes/{uid}/{rideId}`: private messages visible only to the recipient while they remain a member. Retention uses the shorter of the two participants' preferences; a daily cleanup removes expired entries.
- `rideReplays/{rideId}`: private, consented samples kept outside live ride subscriptions for performance. Access expires seven days after completion. A daily cleanup removes expired samples, so physical removal may occur up to 24 hours later.

Only a rider can write their own location and presence. Database rules reject invalid coordinates, wrong identities/ride IDs, future or old timestamps, excessive frequency and large coordinate jumps. The client also validates geodesic movement and keeps its last reliable point on `GPS_ANOMALY`; the backend validates accepted fixes and restores the previous record on an anomaly. Leader-only callable mutations manage the route, sweep role, membership, announcements and lifecycle. A rider can trigger/cancel their own SOS; the leader coordinates resolution. Contact access requires an open SOS and the rider's consent/privacy preference. Administrative credentials never run in the browser; platform administration remains restricted to trusted Firebase/Cloud IAM operators.

## Location behavior

Explicit **Share live GPS** consent starts `watchPosition`. Accepted GPS writes occur at most approximately every three seconds. Records include user and ride IDs, latitude, longitude, accuracy, speed (m/s), heading, altitude where available, timestamp and status. The client uses Firebase's server clock offset. Updates use realtime listeners, not page refresh or backend polling.

GPS accuracy over 100 m is rejected; over 60 m is labelled weak and excluded from reliable separation checks. Positions become stale after 20 seconds and offline after 60 seconds, or immediately when presence disconnects. Disconnects preserve the last known point with an offline label; explicit stop, leaving, pausing and completion clear live sharing. Reconnection resumes only while the rider's sharing consent remains enabled in the active ride. The browser may suspend GPS while locked/backgrounded; no native background tracking guarantee is made.

Separation is sustained relative to other fresh, accurate riders' group center, using the configured distance and delay. The shared event is recorded server-side. Group health displays the underlying conditions, not a safety score. Map markers are reused and interpolate between accepted points. Follow controls include self, group, selected rider and fit all. SOS centers the map only when an actual incident location is available. No unknown rider is assigned a static location.

## Routes, hazards, SOS and replay

The leader explicitly computes and publishes a route through the current Google Maps Routes library. Members receive the same geometry/revision. Changing destination or adding a stop invalidates the previous route until the leader publishes its replacement. The next planned waypoint and provider route estimate are displayed; Google Maps handles supported turn-by-turn navigation. Regrouping proposes a route point; the leader must verify an appropriate, safe place to stop. It does not certify road shoulders or parking availability.

Hazards are member reports with independent confirmations/disputes, not guaranteed road facts. SOS is visible to all authorized members immediately after countdown and confirmation. Configurable Cloud Tasks reminders target leader/sweep/group at nominal 10/20/30 seconds. Queue execution and FCM delivery are best effort; pending/failed notifications are never described as emergency-service contact. Lock-screen notifications omit exact GPS and medical/contact details. Resolving/cancelling an SOS suppresses subsequent reminders.

Private replay is opt-in when creating and joining a ride. Samples are limited to one frame per ten seconds, up to 2,160 frames, and are not public. Ending stops sharing but retains consented replay under the limited retention policy. Reported distance/speed come from available leader GPS samples; no competitive rider speed ranking is shown. Unknown metrics remain unavailable.

The contextual safety helper uses current ride data deterministically and labels itself as a context helper rather than claiming an AI model produced the result. It never fabricates a rider location. Live model integration remains optional and separate from location synchronization.

## Clearly separated modes

The default workspace is **REAL RIDE**. Missing Firebase configuration shows **REALTIME BACKEND NOT CONFIGURED**. Missing a restricted Maps key/map ID shows **MAP API NOT CONFIGURED**. There is no automatic fake-coordinate fallback.

`?mode=demo` opens an isolated browser-local demo with eight synthetic riders. Its map clearly labels synthetic GPS and uses OpenStreetMap; loading a real OSRM road route lets simulated riders move along actual road geometry. It never writes into a real Firebase ride or requests actual rider GPS. Demo controls cover pause, separation, hazard, SOS, offline and completion.

## Verification

```sh
npm test
npm run test:rules
npm run build -- --base=/let-sride/
```

The Database emulator test exercises two independent authenticated clients with the live callable handlers: creation, invitation lookup, join, GPS listener synchronization in both directions, route publication, hazard, SOS and completion. Additional rules tests deny outsiders, cross-rider GPS writes, role/route/SOS forgery and invalid records. This is an emulator acceptance flow with supplied test coordinates, not a completed two-phone GPS/Google Maps production test.

Final activation requires deployed Firebase resources, configured/restricted Google Maps, and two real devices. Use the setup page's acceptance checklist to test actual GPS movement, route revisions, separation, hazard propagation, SOS centering, reconnection and tracking shutdown. Do not run interaction tests while riding.
