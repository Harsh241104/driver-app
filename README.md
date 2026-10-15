# Raipur Driver Console

A last-mile delivery driver console for a sample delivery route in Raipur, Chhattisgarh. The frontend uses plain HTML, CSS, and browser JavaScript; separate account and earnings pages use an Express API backed by Neon PostgreSQL. The original route console remains available as an offline-capable demo.

> **Demo application:** Route stops, customer OTPs, and the ₹45 per-delivery earning rate are demonstration data. Authentication uses server-side password hashes and database-backed sessions, but the app is not a production dispatch or payout service.

## Contents

- [Features](#features)
- [Technology stack](#technology-stack)
- [Requirements](#requirements)
- [Run locally](#run-locally)
- [Demo sign-in](#demo-sign-in)
- [Typical driver workflow](#typical-driver-workflow)
- [Architecture](#architecture)
- [Route and demo data](#route-and-demo-data)
- [Neon database SQL](#neon-database-sql)
- [Database fields and sample data](#database-fields-and-sample-data)
- [Modular API](#modular-api)
- [Offline behavior and data storage](#offline-behavior-and-data-storage)
- [Event synchronization](#event-synchronization)
- [Project structure](#project-structure)
- [Available scripts](#available-scripts)
- [Browser and device capabilities](#browser-and-device-capabilities)
- [Known limitations and production considerations](#known-limitations-and-production-considerations)
- [Troubleshooting](#troubleshooting)

## Features

### Driver access and profile

- Register and sign in through separate server-backed account pages.
- Keep the existing offline route-demo profile and sign-in flow available on the main page.
- Edit the current driver's name, mobile number, and vehicle registration.
- Normalize phone numbers to their final 10 digits for matching.
- Display a generated driver ID and passcode after local registration.

### Route manifest and active route

- Review a fixed route manifest, pickup hub, delivery order, delivery windows, package weights, and stop statuses.
- Start the active route and see a countdown estimate for the current stop.
- Mark arrival at the hub or customer stop.
- Reveal the complete customer address after marking arrival at a delivery stop.
- Confirm pickup at the hub and progress through the four customer deliveries.
- Open Google Maps directions for the current hub or customer stop.

### Proof of delivery

- Optionally capture or select an image using a device that supports file capture.
- Enter the demo customer delivery OTP for the current stop.
- Capture a signature using the pointer-enabled signature canvas.
- Complete the delivery with the hold-and-slide control after both the OTP and a signature are present.
- Save a delivery-completed event locally and advance to the next stop.

### Delivery exceptions

- Record a failed delivery with one of the provided reasons.
- Optionally add notes for dispatch.
- Confirm the exception with the hold-and-slide control.
- Mark the stop as failed, record a local event, and advance to the next stop.

### Connectivity, activity, and summary

- Show browser connectivity together with a separate online/offline network simulator control.
- Queue route activity locally while the app is offline or the simulator is set to offline.
- Display pending and synchronized activity in the Inbox.
- Show a demo earnings estimate based on completed deliveries (₹45 per completed stop).
- Show a route completion summary with delivered, failed, and queued totals.

## Technology stack

- **HTML, CSS, and JavaScript ES modules** for the browser interface and application state.
- **Vite 6** for the development server and production bundling.
- **Express** for a server-side API and **node-postgres (`pg`)** for Neon/PostgreSQL access.
- **CSS** in `frontend/assets/css/`.
- **Browser APIs** including `localStorage`, `fetch`, Geolocation, Canvas, object URLs, and optional vibration.

The Express API reads the Neon connection string from the server-only `DATABASE_URL` environment variable in the ignored local `.env` file. The browser never receives database credentials. Account, delivery, and earnings routes use separate controller and router modules; account sessions are stored as hashed refresh tokens in PostgreSQL and sent to the browser in an HTTP-only cookie.

## Requirements

- Node.js and npm (use a current Node.js LTS release).
- A modern browser.

The repository includes `package-lock.json` so npm can install the declared dependency versions consistently.

## Run locally

Open PowerShell in the project directory:

```powershell
cd "C:\path\to\ved-driverapp"
npm install
# Create or edit the ignored .env file and set DATABASE_URL and the Neon demo IDs.
npm run dev
```

The dev command starts the API on `http://127.0.0.1:3001` and Vite on a local development URL, usually:

```text
http://localhost:5173/
```

Open that URL in a browser. Keep the terminal running while you use the app; stop the server with **Ctrl+C**.

Before running the demo seed, create a Neon development branch. Use a Neon development branch rather than production for demo records. In that development branch:

1. Open **SQL Editor** and create a query. On a new database, run the normalized base schema in [`database/schema.sql`](./database/schema.sql) first.
2. Paste the full contents of [`database/demo-seed.sql`](./database/demo-seed.sql) and select **Run**. It adds the event tables needed by this app and inserts repeatable demo route records.
3. Confirm the development branch now has one demo driver, one route, and four route stops.
4. Set the development branch's connection string in the ignored local `.env` file as `DATABASE_URL`. Keep `sslmode=verify-full`, and set `NEON_DRIVER_USER_ID` and `NEON_ROUTE_ID` to the seeded demo UUIDs.
5. Run `npm run dev`, open the Vite URL, and sign in with the local demo credentials `DRV-104` / `1042`.
6. For database-backed accounts, open `/register.html` to create a driver account, then use `/earnings.html`. A dispatcher must assign a route to the new driver before the deliveries API returns stops.

The seed script is repeatable for its fixed demo IDs and resets those demo orders/stops to pending when re-run. Check the API connection at `http://127.0.0.1:3001/api/health`.

The API uses the UUID-based schema (`users`, `user_roles`, `refresh_tokens`, `drivers`, `vehicles`, `warehouses`, `routes`, `route_stops`, `orders`, and `order_events`) plus the `driver_events` and `earnings` tables added by the demo seed. Set the seed script's fixed UUIDs in `.env` as `NEON_DRIVER_USER_ID` and `NEON_ROUTE_ID`.

To expose the development server on the local network, use:

```powershell
npm run dev -- --host 0.0.0.0
```

Only expose the server on a trusted network. Device camera and geolocation permissions depend on the browser and secure-context rules; `localhost` is generally treated as a secure context.

## Demo sign-in

The built-in demo account is:

| Field | Value |
| --- | --- |
| Driver ID | `DRV-104` |
| Phone | `9876543210` |
| Demo passcode | `1042` |

The sign-in screen displays the passcode hint for the matching local profile. This is a usability aid for this demo and is **not authentication security**.

New profiles can be created with the registration dialog. Registration stays in the current browser's local storage; it does not contact a server or send an SMS. A generated passcode is displayed in an on-screen message after successful registration.

## Typical driver workflow

1. Sign in using the demo credentials above, or create a local profile first.
2. Review the route manifest and select **Start active route**.
3. At the hub, select **I've Arrived at the Hub**, then **Scan & Confirm Pickup**.
4. At each customer, select **I've Arrived** to reveal the delivery address.
5. To complete delivery, open the proof-of-delivery dialog, enter the stop's test OTP, draw a signature, then use the slider. A photo is optional.
6. To report an unsuccessful delivery, open **Report Delivery Issue**, choose a reason, optionally add a note, and confirm with the slider.
7. Continue through the route. Use the Route, Earnings, and Inbox navigation to view the route, demo totals, and event activity.

Each customer stop includes its test OTP in the proof-of-delivery dialog. The fixed route data is in [`frontend/src/route.js`](./frontend/src/route.js).

## Architecture

The offline route console is implemented without a frontend framework. Its screen templates and workflow controller are in one JavaScript entry module. The server-backed login, registration, and earnings pages are separate HTML entry points with dedicated page scripts:

```text
frontend/
├── index.html
├── login.html
├── register.html
├── earnings.html
├── assets/css/
│   ├── styles.css
│   └── pages.css
└── src/
    ├── main.js
    ├── route.js
    └── pages/
        ├── login.js
        ├── register.js
        └── earnings.js
backend/
├── config/
├── controllers/
├── middleware/
├── routes/
└── index.js
database/
├── schema.sql
└── demo-seed.sql
```

### Application bootstrap

- `frontend/index.html` provides the root element and loads `frontend/src/main.js` as a native JavaScript module.
- `frontend/src/main.js` imports the shared stylesheet and route helpers, renders the application into `#root`, binds browser events, and coordinates the driver workflows.

### Application state and screens

`frontend/src/main.js` owns shared application state:

- Active screen, selected driver, current stop, delivery statuses, route stage, and ETA.
- Registration/profile form state and dialog visibility.
- Proof-of-delivery and exception state.
- Offline event outbox, network state, and event synchronization.
- Driver telemetry, browser connectivity, and timers.

The app uses delegated DOM events and native `<dialog>` elements instead of framework components. Navigation is in-memory rather than URL-based. The route, earnings, Inbox, registration, profile, proof-of-delivery, and delivery-exception UI are rendered from templates in `frontend/src/main.js`.

### Shared data and helpers

`frontend/src/route.js` exports the fixed route manifest, demo driver, exception reason choices, Inbox event labels, local-storage key names, and helpers for JSON storage, phone normalization, initials, and event IDs.

### Styling

`frontend/assets/css/styles.css` and `frontend/assets/css/pages.css` contain the main console and account-page styles.

## Route and demo data

The route fixture has ID `RT-RAIPUR-104`, one pickup hub (`WH-RAIPUR`), and four customer stops (`ORD-7890` through `ORD-7893`). It includes sample names, Raipur localities and addresses, delivery windows, weights, coordinates, instructions, and OTPs.

The route data is static JavaScript, not loaded from a dispatch API. The displayed date and some labels are fixed demo copy. The weather display is also illustrative and is not a live weather integration.

## Neon database SQL

[`database/schema.sql`](./database/schema.sql) defines the normalized database, including users, drivers, orders, routes, and earnings. [`database/demo-seed.sql`](./database/demo-seed.sql) adds demo-only route fields, the event table, and repeatable route fixtures for an existing database. The Express API entry point is [`backend/index.js`](./backend/index.js).

After running the base schema and seed in a development branch, configure `.env` and restart `npm run dev`. The existing route console reads the manifest and syncs activity events to Neon. Authenticated account pages use the modular APIs below. Each delivered stop creates one earnings record at the demo rate of ₹45.

The seeded user's password is deliberately unusable; register an account at `/register.html` to use the authenticated account and earnings APIs. The original offline route console and its `/driver/events` demo endpoint still use fixed demo identity and route values and are not production authentication. Do not expose those demo endpoints publicly.

## Database fields and sample data

The full normalized table definitions, constraints, and indexes are in [`database/schema.sql`](./database/schema.sql). The API uses these fields:

| Table | Required/important fields |
| --- | --- |
| `users` | `id`, `email` or `phone`, `password_hash`, `full_name`, `is_active`, login timestamps |
| `user_roles` | `user_id`, `role` (`driver`) |
| `drivers` | `user_id`, optional `vehicle_id`, `status` |
| `vehicles` | `type`, `registration_number`, `max_weight_kg`, `max_volume_m3`, `is_active` |
| `merchants` | `name`, contact email/phone, `is_active` |
| `warehouses` | `code`, `name`, `address`, geographic `location`, `is_active` |
| `orders` | merchant/warehouse IDs, `merchant_order_ref`, `status`, recipient name/phone, delivery address/location, delivery window, weight/volume, tracking token |
| `routes` | warehouse/driver/vehicle IDs, `status`, route distance/duration and timestamps |
| `route_stops` | `route_id`, `order_id`, sequence, `status`, planned location/arrival, completion time and failure reason |
| `order_events` | order, from/to status, route stop, actor and occurrence time |
| `earnings` | `driver_id`, unique `route_stop_id`, positive `amount`, `currency`, `status`, `earned_at`, optional `paid_at` |
| `refresh_tokens` | user ID, hashed token, expiry and revocation timestamps |
| `driver_events` | event ID/type, driver, route/stop/order, coordinates, metadata, occurrence time |

The repeatable sample records in [`database/demo-seed.sql`](./database/demo-seed.sql) include driver `Arjun Sahu` (`driver.demo@raipur.example.test`, ID `10400000-0000-4000-8000-000000000001`), vehicle `CG 04 AB 1040`, hub `WH-RAIPUR`, route ID `10400000-0000-4000-8000-000000000005`, and orders `ORD-7890` through `ORD-7893`. Recipients include Ananya Sharma at Shankar Nagar (2.40 kg), Rohit Verma at Telibandha (1.80 kg), Meera Agrawal at Pandri (3.10 kg), and Dev Patel at Civil Lines (2.70 kg). Demo OTPs are `2468`, `1357`, `8642`, and `5791`. A completed stop (for example `10400000-0000-4000-8000-000000000201`) earns `45.00 INR` with initial earning status `pending`. These are development fixtures, not real customer information or usable account credentials.

## Modular API

All request and response bodies are JSON. Registration and login set an HTTP-only, same-site cookie; the browser does not store session tokens in local storage. Authenticated endpoints only return or mutate records assigned to the signed-in driver.

| Method and path | Authentication | Request | Response |
| --- | --- | --- | --- |
| `POST /api/auth/register` | No | `{ "fullName": "Asha Rao", "email": "asha@example.com", "phone": "+919876543210", "password": "at-least-8-chars" }` (`phone` optional) | `201 { "user": { "id", "email", "phone", "fullName" } }` and session cookie |
| `POST /api/auth/login` | No | `{ "email": "asha@example.com", "password": "..." }` | `200 { "user": { "id", "email", "phone", "fullName" } }` and session cookie |
| `POST /api/auth/logout` | Optional session | No body | `204`; revokes the session and clears cookie |
| `GET /api/auth/me` | Driver session | None | `200 { "user": { "id", "email", "phone", "fullName" } }` |
| `GET /api/deliveries` | Driver session | None | `200 { "deliveries": [...] }` for routes assigned to this driver |
| `POST /api/deliveries/:stopId/status` | Driver session | `{ "status": "delivered" }` or `{ "status": "failed", "failureReason": "recipient_unavailable" }` | `200 { "delivery": { "routeStopId", "orderId", "status" } }`; updates stop, order, and order history atomically |
| `GET /api/earnings` | Driver session | None | `200 { "summary": { "totalAmount", "currency", "deliveryCount" }, "earnings": [...] }` |
| `POST /api/earnings` | Driver session | `{ "routeStopId": "<completed route-stop UUID>" }` | `201 { "earning": {...} }`; records ₹45 once for an assigned completed stop; retries return the existing record |
| `GET /api/health` | Database configured | None | Database connection status |
| `GET /api/routes/:routeId`, `/driver/events` | Demo API | Route ID or event JSON | Existing route manifest and offline event sync for the fixed demo driver |

New accounts start with driver status `pending`. Dispatch must assign a route before the authenticated deliveries API can list stops. Earnings are demo estimates, not payment or payout transactions.

## Offline behavior and data storage

The browser's `localStorage` is used for local demo persistence. Current keys are declared in `frontend/src/route.js`:

| Key | Stored value |
| --- | --- |
| `raipur_driver_profiles_v1` | Locally cached driver profiles, including local registrations/edits |
| `raipur_driver_run_v1` | Route progress, selected driver, statuses, stage, and ETA deadline |
| `raipur_driver_event_outbox_v1` | Activity events and their pending/synced status |
| `raipur_driver_network_simulator` | Network simulator setting (`online` or `offline`) |

The app reads a saved route/profile when it starts and saves run state and event changes as the app updates. Browser offline events and the simulator control are combined for the displayed online state. The simulator can be used to test queueing without disconnecting the browser itself.

### Reset demo data

To clear the app's demo state, open the browser developer console on the app origin and run:

```js
localStorage.removeItem("raipur_driver_profiles_v1");
localStorage.removeItem("raipur_driver_run_v1");
localStorage.removeItem("raipur_driver_event_outbox_v1");
localStorage.removeItem("raipur_driver_network_simulator");
location.reload();
```

This removes only the app's documented local-storage entries for that origin.

## Event synchronization

Driver actions create event objects with an event ID, type, timestamp, driver/route/stop/order identifiers, coordinates, metadata, and `sync_status: "PENDING"`. Location updates and workflow events share the local event outbox.

When both the browser and simulator report online, the app attempts to POST pending events to the Express API:

```text
POST /driver/events
Content-Type: application/json
```

The request body is one event object at a time. An event is marked `SYNCED` only when the response is successful. The app also retries from a five-second interval and when the online state/event list changes.

The API stores each event in Neon and treats repeated event IDs as idempotent. A successful response marks the local event as synchronized. If the API or database is unavailable, the event remains queued on-device and the UI reports the connection problem.

## Project structure

```text
.
├── backend/
├── database/
├── docs/
├── frontend/
├── package.json
├── package-lock.json
├── vite.config.js
└── README.md
```

Generated output is written to `dist/` and is excluded from source control along with `node_modules/` and Vite's `.vite/` cache.

## Available scripts

Run scripts from the project root:

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Express API and Vite development server |
| `npm run dev:api` | Start the Express API in watch mode |
| `npm run start:api` | Start the Express API |
| `npm run build` | Build the production site into `dist/` |
| `npm run preview` | Preview the production build locally (run `npm run build` first) |

There is no dedicated test or lint script configured in `package.json`.

## Browser and device capabilities

- **Geolocation:** When available and permitted, the app records browser location updates. If unavailable or the permission request fails, it emits simulated coordinates along the sample route.
- **Camera/photo input:** The POD form accepts image files and requests environment camera capture on supported mobile browsers. The image preview uses an in-memory object URL.
- **Signature:** The customer signature is drawn on an HTML canvas and used to gate the completion action.
- **Vibration:** Optional feedback uses `navigator.vibrate` where supported.
- **Maps:** The current stop opens a Google Maps directions URL in a new tab.
- **Storage:** Profiles, route progress, and events use origin-scoped browser local storage.

## Known limitations and production considerations

- The main offline route console still uses local demo profiles and passcodes. The separate `/login.html` and `/register.html` pages use server-backed credentials.
- Route stops, customer data, OTPs, coordinates, and failure reasons are hard-coded fixtures.
- The Express API authenticates new driver accounts and scopes delivery/earnings records by driver, but dispatch assignment and payouts are not implemented.
- Earnings are a fixed demo calculation of ₹45 per completed stop, not a payout integration.
- Event delivery is a simple POST loop. Production use needs an authenticated API, server-side idempotency, robust retry/backoff, payload validation, and visible reporting for permanent failures.
- Local storage is not encrypted, is scoped to the browser origin, and may be cleared by the user or browser. It is not a durable or secure database.
- The optional POD photo is previewed locally; the event stores only a local-style filename reference, not an uploaded image. The signature gates completion but is not uploaded or included as image data in the event.
- No service worker is configured, so this is not a fully installable/offline-cached PWA. The UI can queue activity while offline after the app has loaded.
- Geolocation permission and background behavior vary by browser/device. The app does not provide background tracking guarantees.
- There is no configured automated test suite, formatter, or linter in the current package scripts.

Before production deployment, connect real authentication and dispatch APIs, define secure storage and photo/signature handling, add server-side authorization and event validation, and add automated tests for route and delivery workflows.

## Troubleshooting

### Neon connection times out

The API health endpoint at `http://127.0.0.1:3001/api/health` must return HTTP 200 with `{"status":"ok","database":"connected"}`. In the current local setup, the Neon hostname resolves and TCP port 5432 accepts a connection, but PostgreSQL connections through both the configured pooler hostname and the corresponding direct hostname time out before authentication. This means database connectivity is not yet confirmed; a reachable TCP port alone does not prove the PostgreSQL/TLS session is working.

Check that the Neon project and branch are active, copy a fresh connection string from the Neon dashboard, and put it in the ignored `.env` with `sslmode=verify-full`. Restart the API after changing `.env`. If the failure persists, try the connection from another trusted network and inspect local firewall/VPN rules for PostgreSQL TLS traffic. The previously shared database password should be rotated before reuse. Never paste database credentials into source files or Markdown.

### `Unknown command: "dev"`

Use npm's run-script syntax:

```powershell
npm run dev
```

### `npm run dev` cannot find dependencies

Install the dependencies from the project root, then start Vite:

```powershell
npm install
npm run dev
```

### The app does not open at the expected port

Use the exact **Local** URL shown by Vite. If port `5173` is already in use, Vite may select a different port and print that URL in the terminal.

### Events remain queued

Pending events remain queued unless the Express API is running, configured with Neon, and returns a successful HTTP response. Check `http://127.0.0.1:3001/api/health` and the API terminal for connection details.
# driver-app
