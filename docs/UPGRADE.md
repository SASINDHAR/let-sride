# LetsRide command center

## Real navigation

The main map now defaults to real OpenStreetMap tiles rendered by Leaflet. `Preview road route` resolves submitted places and fetches actual road geometry and maneuver instructions from OSRM. Review the resolved place names before starting. `Start GPS navigation` asks for explicit permission, then uses `watchPosition` for device location, heading/speed availability, accuracy, map following, next turn and estimated remaining distance/time. The initial route is recalculated from the first accurate actual GPS fix. Reliable off-route readings sustained for 15 seconds can recalculate the remaining stops, at most once every 30 seconds. Stale or inaccurate GPS suspends rerouting. Voice directions are optional. Stopping or leaving the map clears the watch and aborts pending requests. Group simulation stays available in a separate map mode; synthetic riders and hazards never appear on the real map.

Navigation is independent of Firebase and can guide the current device in a browser-local workspace. It does not enable group location sharing. Road calculations send the submitted route coordinates, including current GPS after consent, to the routing provider. Map tiles disclose the viewed area to the tile provider. GPS positions are not persisted by the navigation component. Browser background/locked-screen behavior depends on the operating system; Google Maps handoff supports native navigation from the device location.

Provider defaults are OSM standard tiles, Nominatim geocoding and the OSRM public routing server. This owner-private preview has low usage: geocoding is explicit, cached and serialized below one request per second, with no autocomplete; no tiles are downloaded for offline use or prefetched. For a shared/high-volume deployment, configure dedicated `VITE_MAP_TILE_URL`, `VITE_GEOCODING_URL` and `VITE_ROUTING_URL` services and enforce aggregate limits through a backend. ETA is a driving estimate without live traffic. The app does not claim professional navigation reliability or road-condition guarantees.

The v2 shell preserves the original ride lobby, account flows, join codes, consent-based GPS, Firebase subscriptions and host controls. The command center adds group awareness, role assignment, hazards and votes, private conversations, deliberate SOS cancellation/confirmation, simulated impact checks, route weather, replay, history, analytics and privacy controls.

## Demo and connected modes

Without Firebase configuration, rides are browser-local. Demo migrations preserve existing rides and add a synthetic eight-rider scenario. Simulation events cannot be applied to connected rides. No SMS, emergency call, push notification, sensor feed, live weather or AI model is invoked in demo mode. The assistant uses clearly labelled deterministic answers. Synthetic route geometry is illustrative, never a navigation product. Real ride distance/speed/replay remain unavailable when not recorded.

The existing Firebase adapter uses authenticated callable mutations, App Check, per-user rate limits, Firestore transactions and membership-gated subscriptions. Deploy `functions/`, Firestore rules/indexes and TTL policies separately in the user's Firebase project. Publishing this static Site does not deploy Firebase resources or configure third-party credentials. Configure browser-restricted Maps credentials and Firebase public client identifiers through environment variables; server credentials stay in the backend. Real sensor support remains an adapter contract, not active crash detection.

## Services and realtime

`services/location` handles freshness and distances; `rides` defines the adapter/public projection; `hazards` handles confidence; `emergency` defines the sensor contract; `weather` selects the synthetic or authenticated provider; `notifications` defines event/transport contracts; `analytics` derives only available statistics. `simulation` contains synthetic fixtures and transitions outside UI components.

Firebase is the current realtime transport. A future WebSocket adapter must authenticate every connection, authorize ride membership on subscription and each mutation, validate payloads, rate-limit, and support reconnection by event cursor. Event vocabulary includes rider location/join/leave/offline/separation, hazards, SOS, route updates and lifecycle. The shared mutation reducer persists safety events. GPS separation requires sustained fresh readings exceeding a configurable distance and delay; stale coordinates never prove an emergency. Push delivery is best effort, and notifications disclose no private names or coordinates on lock screens.

## Data and privacy

Firestore uses users, rides, joinCodes, pushTokens, rateLimits, directMessages, publicRides and publicProfiles. Embedded bounded ride records preserve the original schema. Hazard photo strings have a 200 KB total budget per ride to avoid unbounded document growth. Public records use a strict basic-metadata projection. Phone, medical information and contacts remain in private user records; only the leader of an open SOS can obtain consented details. Real positions expire, and end/pause clears them. Direct messages live outside the shared ride document and require participant plus membership authorization. Retention applies to new private messages; TTL cleanup is asynchronous. Demo storage is convenient local testing data, not a security boundary between people using the same browser.

`schema.sql` is a relational migration blueprint with all requested entities, IDs, timestamps and relationships. It is not applied to a database. Add RLS, encrypted contact storage and audited privileged services before adopting PostgreSQL. Public route and exact live location disclosure is deliberately excluded. Ride history remains restricted to members; the personal-history preference controls optional aggregate disclosure through the member-history endpoint, not other members' access to shared ride records.

## Verification

Run `npm test`, `npm run build`, and `node --check functions/index.mjs`. Backend policy/integration validation requires a configured Firebase emulator or project; local reducer tests do not certify deployed access rules. Browser acceptance covers desktop/mobile navigation, form validation, route preview, join briefing, synthetic hazards, separation, SOS cancellation, impact check and report/replay. No real emergency integration is exercised.
