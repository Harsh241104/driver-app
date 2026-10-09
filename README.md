# Raipur Driver Console

A React-based last-mile delivery driver console for a sample delivery route in Raipur, Chhattisgarh. The app demonstrates driver sign-in and registration, a route manifest, step-by-step delivery tracking, proof of delivery, delivery exceptions, a local event queue, and a demo earnings and activity view.

> **Demo application:** Driver profiles, route stops, customer OTPs, earnings, and event synchronization are demonstration data and behavior. The app does not include a production authentication service, dispatch backend, payment service, or server-side persistence.

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
- [Offline behavior and data storage](#offline-behavior-and-data-storage)
- [Event synchronization](#event-synchronization)
- [Project structure](#project-structure)
- [Available scripts](#available-scripts)
- [Browser and device capabilities](#browser-and-device-capabilities)
- [Known limitations and production considerations](#known-limitations-and-production-considerations)
- [Troubleshooting](#troubleshooting)

## Features

### Driver access and profile

- Sign in with a locally stored driver ID or mobile number and a four-digit demo passcode.
- Create a driver profile on the current browser/device.
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

- **React 19** for the user interface and component state.
- **Vite 6** for the development server and production bundling.
- **Express** for a server-side API and **node-postgres (`pg`)** for Neon/PostgreSQL access.
- **JavaScript ES modules** and JSX.
- **CSS** in the root-level `styles.css`.
- **Browser APIs** including `localStorage`, `fetch`, Geolocation, Canvas, object URLs, and optional vibration.

The Express API reads the Neon connection string from the server-only `DATABASE_URL` environment variable. The browser never receives database credentials. Route data and delivery-event synchronization are available through the API. Sign-in, driver registration, and profile edits remain local demo flows.

## Requirements

- Node.js and npm (use a current Node.js LTS release).
- A modern browser.

The repository includes `package-lock.json` so npm can install the declared dependency versions consistently.

## Run locally

Open PowerShell in the project directory:

```powershell
cd "C:\path\to\ved-driverapp"
npm install
Copy-Item .env.example .env
# Edit .env and replace DATABASE_URL with the connection string from your Neon development branch.
npm run dev
```

The dev command starts the API on `http://127.0.0.1:3001` and Vite on a local development URL, usually:

```text
http://localhost:5173/
```

Open that URL in a browser. Keep the terminal running while you use the app; stop the server with **Ctrl+C**.

Before running the demo seed, create a Neon development branch. The screenshot showed the **production** branch; do not seed demo records into production. In that development branch:

1. Open **SQL Editor** and create a query.
2. Paste the full contents of [`neon-demo-seed.sql`](./neon-demo-seed.sql) and select **Run**.
3. Confirm the development branch now has one demo driver, one route, and four route stops.
4. Copy the development branch's connection string into the ignored local `.env` file as `DATABASE_URL`. Keep `sslmode=verify-full`; the demo driver and route UUIDs are already listed in `.env.example`.
5. Run `npm run dev`, open the Vite URL, and sign in with the local demo credentials `DRV-104` / `1042`.

The seed script is repeatable for its fixed demo IDs and resets those demo orders/stops to pending when re-run. Check the API connection at `http://127.0.0.1:3001/api/health`.

The API uses the UUID-based schema already in your Neon project (`users`, `drivers`, `vehicles`, `warehouses`, `routes`, `route_stops`, and `orders`) plus the `driver_events` table added by the demo seed. The seed script's two fixed UUIDs are already in `.env.example`. Confirm they are present in `.env` as `NEON_DRIVER_USER_ID` and `NEON_ROUTE_ID`.

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

Each customer stop includes its test OTP in the proof-of-delivery dialog. The fixed route data is in [`src/route.js`](./src/route.js).

## Architecture

The app separates its screen and dialog UI from the central state and workflow controller:

```text
index.html
└── src/main.jsx
    ├── styles.css
    └── src/DriverApp.jsx
        ├── screen components
        ├── workflow/dialog components
        └── src/route.js (fixture data, local-storage helpers, event labels)
```

### Application bootstrap

- `index.html` provides the root element and loads `src/main.jsx`.
- `src/main.jsx` imports React, `DriverApp`, and `styles.css`, then mounts the app inside `React.StrictMode`.

### App controller

`src/DriverApp.jsx` owns shared state and coordinates application behavior:

- Active screen, selected driver, current stop, delivery statuses, route stage, and ETA.
- Registration/profile form state and dialog visibility.
- Proof-of-delivery and exception state.
- Offline event outbox, network state, and event synchronization.
- Driver telemetry and browser event/timer cleanup.

The controller passes state and callbacks to presentational screen and dialog components. Navigation uses React state; it is not a URL-based router.

### Screen components

| File | Responsibility |
| --- | --- |
| `src/auth.jsx` | Driver sign-in screen and entry point to registration |
| `src/manifest.jsx` | Route summary, ordered stop list, and route-start action |
| `src/activeRoute.jsx` | Current stop, ETA, arrival details, map link, and stop actions |
| `src/completedRoute.jsx` | Delivered/failed/queued route summary |
| `src/earnings.jsx` | Demo pay estimate and completed-order list |
| `src/inbox.jsx` | Local event activity and queue/sync status |

### Workflow/dialog components

| File | Responsibility |
| --- | --- |
| `src/registration.jsx` | Create a local driver profile |
| `src/profile.jsx` | Edit the current local profile |
| `src/proofOfDelivery.jsx` | Optional photo, OTP, signature, and completion slider |
| `src/deliveryException.jsx` | Failure reason, optional note, and exception confirmation |

### Shared data and helpers

`src/route.js` exports the fixed route manifest, demo driver, exception reason choices, Inbox event labels, local-storage key names, and helpers for JSON storage, phone normalization, initials, and event IDs.

### Styling

`styles.css` contains the global styles, component styles, and responsive layout rules. Components use descriptive class names from this shared stylesheet.

## Route and demo data

The route fixture has ID `RT-RAIPUR-104`, one pickup hub (`WH-RAIPUR`), and four customer stops (`ORD-7890` through `ORD-7893`). It includes sample names, Raipur localities and addresses, delivery windows, weights, coordinates, instructions, and OTPs.

The route data is static JavaScript, not loaded from a dispatch API. The displayed date and some labels are fixed demo copy. The weather display is also illustrative and is not a live weather integration.

## Neon database SQL and API

[`neon-demo-seed.sql`](./neon-demo-seed.sql) adapts the existing normalized Neon schema by adding demo-only route fields and an event table, then inserting repeatable sample rows. [`database.sql`](./database.sql) is a separate starter schema for a fresh database and is **not** the script to run against your existing schema. The Express implementation is in [`server/index.js`](./server/index.js).

After running the seed in a development branch, configure `.env` and restart `npm run dev`. The app reads the route manifest/status from Neon and syncs activity events to Neon. Earnings uses the app's demo rate against completed route statuses.

The passcodes, OTPs, customer names, and addresses are sample data. The seeded user has no usable database password, and app sign-in remains the existing local demo flow. The local API is not production authentication: it does not issue user sessions or authorize driver ownership of event writes. Do not expose it publicly. Production deployment needs authenticated and authorized API endpoints.

## Offline behavior and data storage

The browser's `localStorage` is used for local demo persistence. Current keys are declared in `src/route.js`:

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
├── index.html
├── database.sql
├── neon-demo-seed.sql
├── package.json
├── package-lock.json
├── server/
│   └── index.js
├── styles.css
├── vite.config.js
└── src/
    ├── DriverApp.jsx
    ├── activeRoute.jsx
    ├── auth.jsx
    ├── completedRoute.jsx
    ├── deliveryException.jsx
    ├── earnings.jsx
    ├── inbox.jsx
    ├── main.jsx
    ├── manifest.jsx
    ├── profile.jsx
    ├── proofOfDelivery.jsx
    ├── registration.jsx
    └── route.js
```

Generated output is written to `dist/` and is excluded from source control along with `node_modules/` and Vite's `.vite/` cache.

## Available scripts

Run scripts from the project root:

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Vite development server |
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

- Sign-in and registration are local demo flows. Passcodes are stored with local profiles and displayed in the UI; do not use this as real identity verification.
- Route stops, customer data, OTPs, coordinates, and failure reasons are hard-coded fixtures.
- The app has no backend implementation for dispatch, event ingestion, identity, route assignment, or earnings.
- Earnings are a fixed demo calculation of ₹45 per completed stop, not a payout integration.
- Event delivery is a simple POST loop. Production use needs an authenticated API, server-side idempotency, robust retry/backoff, payload validation, and visible reporting for permanent failures.
- Local storage is not encrypted, is scoped to the browser origin, and may be cleared by the user or browser. It is not a durable or secure database.
- The optional POD photo is previewed locally; the event stores only a local-style filename reference, not an uploaded image. The signature gates completion but is not uploaded or included as image data in the event.
- No service worker is configured, so this is not a fully installable/offline-cached PWA. The UI can queue activity while offline after the app has loaded.
- Geolocation permission and background behavior vary by browser/device. The app does not provide background tracking guarantees.
- There is no configured automated test suite, formatter, or linter in the current package scripts.

Before production deployment, connect real authentication and dispatch APIs, define secure storage and photo/signature handling, add server-side authorization and event validation, and add automated tests for route and delivery workflows.

## Troubleshooting

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

The repository does not include the `/driver/events` backend. Pending events are expected to remain queued unless a compatible endpoint is available and returns a successful HTTP response.
# driver-app
