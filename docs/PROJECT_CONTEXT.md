# Project Context: Raipur Driver Console

This document is a handoff brief for developers and AI assistants working on this repository. It records the project purpose, current architecture, important behavior contracts, and development workflow.

## Project at a glance

Raipur Driver Console is a demo last-mile delivery app for a driver completing a fixed route in Raipur, Chhattisgarh. It covers:

- Driver sign-in, local profile registration, and profile editing.
- A fixed route manifest, active stop workflow, arrival capture, and pickup confirmation.
- Proof of delivery using an OTP, optional photo, drawn signature, and hold-and-slide confirmation.
- Failed-delivery exceptions with reason and optional notes.
- Local activity/event queue with online synchronization to Neon through the Express API.
- Demo earnings of ₹45 per completed customer stop.

This is a demonstration, not a production logistics or authentication system. Driver profiles, passcodes, customer addresses, OTPs, route fixtures, earnings, and the simulated GPS path are sample data.

## Current frontend and backend

### Browser frontend

- Plain HTML, CSS, and browser-native JavaScript ES modules; there is no React or JSX runtime.
- `frontend/` contains all HTML pages together, page-specific scripts, shared route fixtures, and CSS assets.
- `frontend/index.html` loads `frontend/src/main.js` into the `#root` element.
- `frontend/src/main.js` contains application state, DOM templates, delegated DOM event handlers, browser API integrations, local persistence, and API synchronization.
- `frontend/src/route.js` exports the fixed route, default driver, delivery exception choices, event display labels, local-storage keys, and shared helpers.
- `frontend/assets/css/` contains shared console and account-page styles. Keep existing classes when changing markup unless a visual redesign is intended.
- Vite remains the development server and production bundler. It is a build tool, not a frontend framework.

### API

- `backend/index.js` is an Express API backed by `pg` and a Neon/PostgreSQL database.
- `vite.config.js` proxies `/api` and `/driver` requests to `http://localhost:3001` during development.
- `DATABASE_URL`, `NEON_DRIVER_USER_ID`, and `NEON_ROUTE_ID` are server-only environment variables in the git-ignored local `.env`. This project intentionally has no committed `.env.example`; never expose connection credentials to browser code or commit them.
- `database/schema.sql` defines the normalized Neon schema. `database/demo-seed.sql` adds demo-specific columns/tables and fixtures to that schema.
- Authentication and driver-scoped delivery/earnings endpoints are implemented; the route event-sync endpoints remain fixed-demo endpoints.

## Source map

| Path | Purpose |
| --- | --- |
| `frontend/*.html` | Route console, login, registration, and earnings pages |
| `frontend/src/main.js` | Main frontend controller, templates, events, local persistence, API calls |
| `frontend/src/route.js` | Fixed route and profile fixtures, local-storage keys, helper functions |
| `frontend/assets/css/` | Shared console and account-page styles |
| `backend/index.js` | Express API bootstrap and demo route/event endpoints |
| `backend/controllers/` | Auth, deliveries, and earnings handlers |
| `backend/routes/` | API modules |
| `vite.config.js` | Development proxy configuration |
| `database/schema.sql` | Normalized PostgreSQL schema |
| `database/demo-seed.sql` | Repeatable demo seed for a development Neon branch |
| `docs/PROJECT_CONTEXT.md` | Developer handoff and behavior contracts |
| `README.md` | User-facing setup and workflow documentation |

## Main user journey

1. Sign in with a local profile ID or phone number and its four-digit demo passcode. Built-in credentials: `DRV-104`, phone `9876543210`, code `1042`.
2. Start the shift to open the route manifest.
3. Start the active route, mark arrival at the hub, then confirm pickup.
4. At each delivery stop, mark arrival to reveal the full address.
5. Complete a stop by entering that stop's fixture OTP, drawing a signature, and moving the completion slider to at least 94%. A photo is optional.
6. Or, record a failed delivery by selecting a reason, optionally entering notes, and using the exception slider.
7. Route progress is saved locally; events queue while either the browser or network simulator is offline.
8. After the final delivery/exception, the app shows the route summary. Route, Earnings, and Inbox remain available through navigation.

The route fixture has ID `RT-RAIPUR-104`, one hub, and four customer stops (`STP-01` through `STP-04`). The customer order references are `ORD-7890` through `ORD-7893`. OTP values are held in `frontend/src/route.js`; the seeded route API can supply database-backed stop IDs and values.

## Important data and persistence contracts

Do not change these local-storage keys casually: existing users' saved demo state depends on them.

| Key | Data |
| --- | --- |
| `raipur_driver_profiles_v1` | Locally registered/edited driver profiles |
| `raipur_driver_run_v1` | Current route index, stage, selected driver, delivery statuses, route completion, ETA deadline |
| `raipur_driver_event_outbox_v1` | Local events and their `PENDING`/`SYNCED` status |
| `raipur_driver_network_simulator` | `online` or `offline` simulator choice |

Events have `event_id`, `event_type`, ISO `timestamp`, `driver_id`, `route_id`, optional `stop_id` and `order_id`, coordinates, `metadata`, and `sync_status`. IDs are generated with `crypto.randomUUID()` when supported, with a UUID-shaped fallback. Pending events are POSTed individually and marked synchronized only after a successful response. Repeated event IDs are idempotent in the API.

Supported event types are `driver.shift.started`, `stop.arrived`, `package.scanned`, `delivery.completed`, `delivery.failed`, and `driver.location.updated`. The API validates those types and IDs before storage.

## API contract

The frontend uses these relative URLs; keep the Vite proxy aligned if they change:

- `GET /api/routes/RT-RAIPUR-104` — fetch route and statuses; falls back to the fixture when unavailable.
- `GET /driver/events?driver_id=...&route_id=...` — load up to 100 synchronized events.
- `POST /driver/events` — submit one event JSON object.
- `GET http://127.0.0.1:3001/api/health` — check API/database connectivity directly.

The fixed route ID maps to the configured database route UUID on the server. Seeded API data may use UUID stop/order IDs, while fixture data uses demo-readable IDs. Preserve both `orderId` and `orderRef` behavior when displaying or recording route events.

## Device capabilities

- Geolocation is requested for location events when available and allowed. If unavailable or permission fails, the frontend emits simulated coordinates along the route.
- The photo input can request camera capture on supported mobile browsers. The preview uses a temporary object URL; the photo itself is not uploaded.
- The customer signature is drawn on canvas and gates successful completion. The signature image is not uploaded or persisted.
- Vibration is optional and only used if `navigator.vibrate` is available.
- Google Maps links open the active stop's coordinates in a new tab.
- Browser storage and device permissions are origin-scoped. There is no service worker or app-shell offline cache, so offline queue behavior assumes the app has already loaded.

## Local development

Requirements: a current Node.js LTS version and npm. From the repository root:

```powershell
npm install
# Create or edit the ignored .env; set DATABASE_URL and the two Neon IDs.
npm run dev
```

`npm run dev` starts the API on port `3001` and Vite (normally `http://localhost:5173/`). Without valid Neon settings the UI still uses its local fixture; API-backed route/event requests report the unavailable database. For seeded database behavior, use a Neon development branch, run `database/demo-seed.sql` there, configure the ignored `.env`, and restart the dev command.

### Current Neon connectivity status

The configured target is the provided `lastMileDB` Neon PostgreSQL database. The hostname resolves and TCP port 5432 is reachable, but PostgreSQL probes through both the configured pooler hostname and the corresponding direct hostname time out before authentication, and `/api/health` returns HTTP 500. Do not report the database as connected until `/api/health` returns HTTP 200 with `database: "connected"`. Recheck the active Neon branch, use a freshly rotated connection credential, and test from a trusted network without a blocking firewall/VPN. Do not put credentials in this handoff document.

Other scripts:

- `npm run dev:api` — API with Node watch mode.
- `npm run start:api` — API without watch mode.
- `npm run build` — production frontend output in `dist/`.
- `npm run preview` — serve the production build locally.

There is no configured automated test or lint script. Run `npm run build` after frontend changes.

## Constraints for future changes

- Preserve the current screen copy, styling classes, workflow ordering, and local data contracts unless the requested change explicitly alters them.
- Treat user-controlled values and API-provided values as untrusted when inserting them into HTML.
- Keep Neon credentials server-side in the ignored `.env`; do not put secrets in `frontend/`, generated frontend assets, or Markdown documentation.
- Explain when a change affects local-storage compatibility, API payloads, SQL schema, or demo behavior.
- Keep `README.md` aligned with actual behavior and commands.
- Do not describe the API as absent: route loading, event synchronization, authentication, and driver-scoped earnings exist; dispatch assignment and payout remain unimplemented.

## Known limitations

- Local passcodes are visible and stored as plain local data; this is not secure authentication.
- Route/event synchronization still targets the seeded demo driver/route. Account auth issues database-backed sessions; dispatch assignment and payout workflows are not implemented.
- Route and demo profile behavior are local; route fixtures remain the fallback and earnings remain a fixed estimate.
- Delivery images and signatures are not uploaded; photo metadata is only represented in the local event.
- Local storage is not encrypted or durable against user/browser cleanup.
- API event retries are periodic and simple; there is no exponential backoff or dead-letter handling.
- No automated test suite, linter, or formatter is configured.
