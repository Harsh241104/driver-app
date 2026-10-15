import "../assets/css/styles.css";
import {
  DEFAULT_PROFILE,
  EVENT_COPY,
  FAILURE_REASONS,
  KEYS,
  ROUTE,
  initials,
  makeId,
  normalizePhone,
  readJson,
  readProfiles
} from "./route.js";

const root = document.querySelector("#root");
const savedRun = readJson(KEYS.run, null);
const storedEvents = readJson(KEYS.outbox, []);
const storedProfile = savedRun?.driverId ? readProfiles()[savedRun.driverId] : null;
let savedNetworkSetting = "online";
try {
  savedNetworkSetting = localStorage.getItem(KEYS.network) || "online";
} catch {
  // Keep the online simulator default when browser storage is unavailable.
}

const state = {
  route: ROUTE,
  screen: savedRun?.routeStarted ? (savedRun.routeCompleted ? "done" : "active") : "auth",
  profile: storedProfile || DEFAULT_PROFILE,
  driverId: savedRun?.driverId || DEFAULT_PROFILE.driverId,
  stopIndex: Math.min(savedRun?.currentStopIndex || 0, ROUTE.stops.length),
  stage: savedRun?.stage || "en-route",
  statuses: savedRun?.deliveryStatuses || {},
  routeStarted: Boolean(savedRun?.routeStarted),
  routeCompleted: Boolean(savedRun?.routeCompleted),
  etaDeadline: savedRun?.etaDeadline || (savedRun?.routeStarted && !savedRun?.routeCompleted && savedRun?.stage !== "arrived"
    ? Date.now() + 8 * 60 * 1000
    : null),
  simulatorOnline: savedNetworkSetting !== "offline",
  browserOnline: navigator.onLine,
  events: Array.isArray(storedEvents) ? storedEvents : [],
  syncing: false,
  identifier: DEFAULT_PROFILE.driverId,
  loginOtp: DEFAULT_PROFILE.otp,
  loginOtpHint: DEFAULT_PROFILE.otp,
  goOnline: true,
  registerName: "",
  registerPhone: "",
  registerVehicle: "",
  profileName: (storedProfile || DEFAULT_PROFILE).name,
  profilePhone: (storedProfile || DEFAULT_PROFILE).phone,
  profileVehicle: (storedProfile || DEFAULT_PROFILE).vehicle,
  profileStatus: "Profile is stored on this device.",
  podOtp: "",
  podSlider: 0,
  signatureInk: false,
  selectedPhoto: null,
  photoUrl: "",
  failureReason: "",
  failureNotes: "",
  failureSlider: 0,
  toast: "",
  clock: new Date(),
  etaNow: Date.now()
};

let toastTimer;
let locationTimer;
let flushing = false;
let drawing = false;
let signatureContext = null;
let inkRef = false;
let photoInput;

const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, (character) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;"
}[character]));
const online = () => state.simulatorOnline && state.browserOnline;
const pendingCount = () => state.events.filter((event) => event.sync_status === "PENDING").length;
const currentStop = () => state.stopIndex === 0 ? state.route.hub : state.route.stops[state.stopIndex - 1];
const totalWeight = () => state.route.stops.reduce((sum, stop) => sum + Number(stop.weight), Number(state.route.hub.weight));
const completedStops = () => state.route.stops.filter((stop) => state.statuses[stop.id] === "Completed");
const formatWeight = (value) => Number(value || 0).toFixed(1);

function persistRun(patch = {}) {
  const run = {
    currentStopIndex: state.stopIndex,
    stage: state.stage,
    driverId: state.driverId,
    deliveryStatuses: state.statuses,
    routeStarted: state.routeStarted,
    routeCompleted: state.routeCompleted,
    etaDeadline: state.etaDeadline,
    ...patch
  };
  try {
    localStorage.setItem(KEYS.run, JSON.stringify(run));
  } catch {
    showToast("Could not save route progress on this device.");
  }
}

function saveEvents() {
  try {
    localStorage.setItem(KEYS.outbox, JSON.stringify(state.events));
  } catch {
    showToast("Device storage is full. Remove old photos and try again.");
  }
}

function showToast(message) {
  state.toast = message;
  const toast = document.querySelector(".toast");
  if (toast) {
    toast.textContent = message;
    toast.classList.add("is-visible");
  }
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    state.toast = "";
    document.querySelector(".toast")?.classList.remove("is-visible");
  }, 3000);
}

function findProfile(value) {
  const profiles = readProfiles();
  return profiles[String(value).trim().toUpperCase()]
    || Object.values(profiles).find((item) => normalizePhone(item.phone) === normalizePhone(String(value)));
}

function applyProfile(profile) {
  state.profile = profile;
  state.driverId = profile.driverId;
  state.identifier = profile.driverId;
  state.loginOtp = String(profile.otp).padStart(4, "0").slice(-4);
  state.loginOtpHint = state.loginOtp;
  state.profileName = profile.name;
  state.profilePhone = profile.phone;
  state.profileVehicle = profile.vehicle;
}

function appendEvent(type, stop = currentStop(), metadata = {}) {
  const event = {
    event_id: makeId(),
    event_type: type,
    timestamp: new Date().toISOString(),
    driver_id: state.driverId,
    route_id: state.route.id,
    stop_id: stop?.id || null,
    order_id: stop?.orderId || null,
    latitude: metadata.latitude ?? stop?.latitude ?? 21.2514,
    longitude: metadata.longitude ?? stop?.longitude ?? 81.6296,
    metadata,
    sync_status: "PENDING"
  };
  state.events.push(event);
  saveEvents();
  renderChrome();
  if (online()) flushOutbox();
  return event;
}

async function flushOutbox() {
  if (flushing || !online() || !state.events.some((event) => event.sync_status === "PENDING")) return;
  flushing = true;
  state.syncing = true;
  updateConnectionIndicators();
  try {
    for (const event of state.events) {
      if (event.sync_status !== "PENDING" || !online()) continue;
      try {
        const response = await fetch("/driver/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(event)
        });
        if (!response.ok) {
          let payload = {};
          try { payload = await response.json(); } catch { /* The response may not contain JSON. */ }
          showToast(`Neon sync failed: ${payload.error || `HTTP ${response.status}`}`);
          break;
        }
        state.events = state.events.map((item) => item.event_id === event.event_id ? { ...item, sync_status: "SYNCED" } : item);
        saveEvents();
      } catch {
        showToast("Neon API is unavailable. Activity remains queued on this device.");
        break;
      }
    }
  } finally {
    flushing = false;
    state.syncing = false;
    renderChrome();
    if (state.screen === "inbox" || state.screen === "done") renderMain();
  }
}

function renderChrome() {
  const count = pendingCount();
  const nav = document.querySelector(".screen-nav");
  if (nav) {
    const inboxButton = nav.querySelector('[data-screen="inbox"]');
    if (inboxButton) inboxButton.innerHTML = `Inbox <span class="inbox-count">${count}</span>`;
  }
  const footerQueue = document.querySelector(".global-footer > span:last-child > span");
  if (footerQueue) footerQueue.textContent = `${count} ${count === 1 ? "EVENT" : "EVENTS"} QUEUED`;
  updateConnectionIndicators();
}

function renderMain() {
  const main = document.querySelector("#app-main");
  if (main) main.innerHTML = renderScreen();
  renderChrome();
}

function updateConnectionIndicators() {
  const isOnline = online();
  const copy = document.querySelector(".debug-copy");
  if (copy) copy.textContent = isOnline ? "Live network detection" : "Events will queue on device";
  const toggle = document.querySelector(".network-toggle");
  if (toggle) {
    toggle.setAttribute("aria-pressed", String(state.simulatorOnline));
    const label = toggle.querySelector("span");
    if (label) label.textContent = `Simulator ${state.simulatorOnline ? "online" : "offline"}`;
  }
  const shift = document.querySelector(".shift-indicator");
  if (shift) shift.classList.toggle("is-online", state.screen !== "auth" && isOnline);
  const pill = document.querySelector(".connectivity-pill");
  if (pill) {
    pill.classList.toggle("is-offline", !isOnline);
    pill.classList.toggle("is-syncing", isOnline && state.syncing);
    const label = pill.querySelector("span:last-child");
    if (label) {
      label.textContent = !isOnline ? `Offline · ${pendingCount()} queued`
        : state.syncing ? `Syncing · ${pendingCount()} queued`
          : pendingCount() ? `Online · ${pendingCount()} queued` : "Online · Synced";
    }
  }
}

function renderAuth() {
  const clock = new Intl.DateTimeFormat("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" }).format(state.clock);
  return `<section class="screen auth-screen" aria-labelledby="auth-title">
    <div class="auth-aside">
      <p class="eyebrow">RAIPUR · CHHATTISGARH <span class="eyebrow-line"></span></p>
      <h1 id="auth-title">Every delivery,<br /><em>accounted for.</em></h1>
      <p class="intro-copy">Your route, your proof, your pace. Sign in to bring today's run online.</p>
      <div class="weather-line"><span class="sun-icon" aria-hidden="true">☀</span><span><strong>32°</strong> Raipur · Clear skies</span><span class="weather-time">${clock}</span></div>
    </div>
    <div class="auth-card">
      <div class="card-heading"><div><p class="eyebrow">DRIVER ACCESS</p><h2>Start your shift</h2></div><span class="card-step">01 <span>/ 03</span></span></div>
      <form id="sign-in-form" novalidate>
        <label for="driver-id">Driver ID or phone number</label>
        <div class="input-wrap"><span class="input-prefix" aria-hidden="true">ID</span><input id="driver-id" name="driver-id" autocomplete="username" inputmode="text" value="${escapeHtml(state.identifier)}" required /></div>
        <div class="field-label-row"><label for="login-otp-1">One-time passcode</label><span class="field-hint">DEMO CODE: ${escapeHtml(state.loginOtpHint)}</span></div>
        <div class="otp-row" aria-label="4 digit one-time passcode">${Array.from({ length: 4 }, (_, index) => `<input class="otp-box" ${index === 0 ? 'id="login-otp-1"' : ""} aria-label="Passcode digit ${index + 1}" inputmode="numeric" maxlength="1" value="${escapeHtml(state.loginOtp[index] === " " ? "" : state.loginOtp[index] || "")}" />`).join("")}</div>
        <div class="online-choice"><div class="online-copy"><span class="online-light"></span><span><strong>Ready to go online</strong><small>Receive your assigned route</small></span></div><label class="switch" aria-label="Go online"><input id="go-online" type="checkbox" ${state.goOnline ? "checked" : ""} /><span class="switch-track"></span></label></div>
        <button class="button button-primary button-wide" type="submit"><span>Start shift</span><span class="button-arrow" aria-hidden="true">→</span></button>
        <p class="privacy-note"><span aria-hidden="true">▣</span> Your shift events save on this device, even offline.</p>
        <p class="register-prompt">New to the driver app? <button type="button" class="text-button" data-action="open-registration">Register as a driver</button></p>
      </form>
    </div>
    <footer class="screen-foot"><span>DISPATCH SYSTEMS</span><span>BUILD 2.4.1 · RAIPUR</span></footer>
  </section>`;
}

function renderManifest() {
  const route = state.route;
  const stops = [{ ...route.hub, isPickup: true }, ...route.stops.map((stop) => ({ ...stop, isPickup: false }))];
  return `<section class="screen manifest-screen" aria-labelledby="manifest-title">
    <div class="page-head"><div><p class="eyebrow">MONDAY, 05 OCTOBER <span class="eyebrow-line"></span> RUN 01</p><h1 id="manifest-title">Your route<span class="title-period">.</span></h1></div><span class="route-tag"><span class="route-tag-dot"></span> READY TO DEPART</span></div>
    <div class="manifest-summary"><div class="route-primary"><span class="summary-label">ROUTE MANIFEST</span><strong>${escapeHtml(route.id)}</strong><span class="route-start">Raipur Central Hub <span aria-hidden="true">→</span> City loop</span></div>
      <div class="summary-grid"><div class="summary-stat"><strong>${String(route.stops.length + 1).padStart(2, "0")}</strong><span>STOPS</span></div><div class="summary-stat"><strong>${formatWeight(totalWeight())}<span> kg</span></strong><span>TOTAL LOAD</span></div><div class="summary-stat hub-stat"><strong>WH-RAIPUR</strong><span>PICKUP HUB</span></div></div>
    </div>
    <div class="section-head"><div><p class="eyebrow">IN ORDER OF VISIT</p><h2 id="stop-list-title">Stop sequence <span id="delivery-count">${String(route.stops.length).padStart(2, "0")} DELIVERIES</span></h2></div><span class="list-caption">${String(route.stops.length + 1).padStart(2, "0")} TOTAL STOPS</span></div>
    <ol class="manifest-list" aria-labelledby="stop-list-title">${stops.map((stop, index) => {
      const status = stop.isPickup ? (state.stopIndex > 0 ? "Completed" : "Pickup") : (state.statuses[stop.id] || "Pending");
      const chipClass = status === "Completed" ? "is-complete" : status === "Failed" ? "is-failed" : status === "Active" ? "is-active" : "";
      return `<li class="manifest-row ${stop.isPickup ? "manifest-row--pickup" : ""}"><span class="manifest-number">${String(index).padStart(2, "0")}</span>
        <span class="manifest-place"><strong>${escapeHtml(stop.isPickup ? stop.name : stop.locality)}</strong><span>${escapeHtml(stop.isPickup ? stop.locality : `${stop.name} · ${stop.landmark}`)}</span></span>
        <span class="manifest-meta"><strong>${escapeHtml(stop.window)}</strong><span>${formatWeight(stop.weight)} kg</span></span>
        <span class="status-chip ${chipClass}">${stop.isPickup && status === "Pickup" ? "PICKUP" : escapeHtml(status.toUpperCase())}</span></li>`;
    }).join("")}</ol>
    <aside class="manifest-note"><span class="note-icon" aria-hidden="true">i</span><span>Pickup is first. Stops stay in sequence so every parcel is accounted for.</span></aside>
    <div class="sticky-action"><button class="button button-primary button-wide" data-action="begin-route" ${state.routeCompleted ? "disabled" : ""} type="button"><span>${state.routeCompleted ? "Route complete" : "Start active route"}</span><span class="button-arrow" aria-hidden="true">→</span></button></div>
  </section>`;
}

function renderActiveRoute() {
  const stop = currentStop();
  const secondsLeft = Math.max(0, Math.ceil(((state.etaDeadline || (state.etaNow + 8 * 60 * 1000)) - state.etaNow) / 1000));
  const position = state.stage === "arrived" ? 2 : state.stopIndex === 0 ? 0 : 1;
  const progress = state.stopIndex === 0 ? (state.stage === "arrived" ? 8 : 0)
    : Math.min(100, 15 + (state.stopIndex - 1) / state.route.stops.length * 80 + (state.stage === "arrived" ? 10 : 0));
  const labels = ["Pickup", "Drop", "Arrived", "POD"];
  return `<section class="screen active-screen" aria-labelledby="active-title">
    <div class="active-topline"><button class="back-button" type="button" aria-label="Back to route manifest" data-screen="manifest">←</button>
      <div class="stop-counter"><span class="eyebrow">ACTIVE RUN</span><strong>STOP ${state.stopIndex + 1} <span>OF ${state.route.stops.length + 1}</span></strong></div>
      <div class="eta-block"><span class="eyebrow">ETA COUNTDOWN</span><strong>${state.stage === "arrived" ? "AT DESTINATION" : `${String(Math.floor(secondsLeft / 60)).padStart(2, "0")}:${String(secondsLeft % 60).padStart(2, "0")} LEFT`}</strong></div>
      <div class="connectivity-pill ${!online() ? "is-offline" : state.syncing ? "is-syncing" : ""}" aria-live="polite"><span class="connectivity-dot"></span><span>${!online() ? `Offline · ${pendingCount()} queued` : state.syncing ? `Syncing · ${pendingCount()} queued` : pendingCount() ? `Online · ${pendingCount()} queued` : "Online · Synced"}</span></div>
    </div>
    <div class="route-progress"><span style="width:${progress}%"></span></div>
    <div class="stepper" aria-label="Delivery progress">${labels.map((label, index) => `${index ? '<span class="step-connector"></span>' : ""}<div class="step-item ${index === position ? "is-current" : ""} ${index < position ? "is-complete" : ""}"><span class="step-node">${String(index + 1).padStart(2, "0")}</span><span class="step-name">${label}</span></div>`).join("")}</div>
    <div class="stop-type-row"><span class="stop-type">${state.stopIndex === 0 ? "PICKUP · HUB" : "CUSTOMER DROP"}</span><span class="stop-sequence-label">${state.stopIndex === 0 ? "ORIGIN / 01" : `DELIVERY / ${String(state.stopIndex).padStart(2, "0")}`}</span></div>
    <article class="delivery-card"><div class="delivery-card-head"><div><p class="eyebrow">${state.stopIndex === 0 ? "COLLECTION POINT" : `DELIVER TO · ${escapeHtml(stop.name.toUpperCase())}`}</p><h1 id="active-title">${escapeHtml(state.stopIndex === 0 ? stop.name : stop.locality)}<span class="title-period">.</span></h1></div><span class="parcel-icon" aria-hidden="true">▧</span></div>
      <div class="location-row"><span class="pin-icon" aria-hidden="true">⌖</span><div><strong>${escapeHtml(state.stopIndex === 0 ? stop.locality : `${stop.locality} · ${stop.landmark}`)}</strong><span>${state.stopIndex === 0 ? "Raipur Central Distribution Hub" : "Raipur, Chhattisgarh"}</span></div></div>
      ${state.stage === "arrived" && state.stopIndex > 0 ? `<div class="address-reveal"><span class="address-lock" aria-hidden="true">⌖</span><div><span class="eyebrow">FULL DELIVERY ADDRESS</span><strong>${escapeHtml(stop.address)}</strong></div></div>` : ""}
      ${state.stopIndex > 0 ? `<div class="parcel-details"><div><span class="detail-label">PARCEL</span><strong>#${escapeHtml(stop.orderRef || stop.orderId)}</strong></div><div><span class="detail-label">WEIGHT</span><strong>${formatWeight(stop.weight)} kg</strong></div><div><span class="detail-label">WINDOW</span><strong>${escapeHtml(stop.window)}</strong></div></div>` : ""}
      <div class="instruction-badge"><span aria-hidden="true">✳</span><span>${escapeHtml(stop.instructions || "Scan all parcels before leaving the hub.")}</span></div>
    </article>
    <a class="button button-map button-wide" href="https://www.google.com/maps/dir/?api=1&amp;destination=${encodeURIComponent(`${stop.latitude},${stop.longitude}`)}" target="_blank" rel="noopener"><span class="map-glyph" aria-hidden="true">↗</span><span>Open in Google Maps</span></a>
    <div class="action-panel">${state.stage !== "arrived"
      ? `<button class="button button-primary button-wide" type="button" data-action="mark-arrived"><span>${state.stopIndex === 0 ? "I've Arrived at the Hub" : "I've Arrived"}</span><span class="button-arrow" aria-hidden="true">→</span></button>`
      : state.stopIndex === 0
        ? '<button class="button button-primary button-wide" type="button" data-action="confirm-pickup"><span>Scan &amp; Confirm Pickup</span><span class="button-arrow" aria-hidden="true">→</span></button>'
        : '<button class="button button-primary button-wide" type="button" data-action="open-pod"><span>Capture Proof of Delivery (POD)</span><span class="button-arrow" aria-hidden="true">→</span></button><button class="button button-soft-danger button-wide" type="button" data-action="open-failure"><span>Report Delivery Issue</span><span aria-hidden="true">↗</span></button>'}
    </div><p class="offline-caption"><span class="save-check" aria-hidden="true">✓</span> Actions save instantly on this device</p>
  </section>`;
}

function renderCompletedRoute() {
  return `<section class="screen done-screen" aria-labelledby="done-title"><div class="done-mark" aria-hidden="true">✓</div><p class="eyebrow">RUN COMPLETE · RAIPUR</p><h1 id="done-title">Every stop,<br /><em>accounted for.</em></h1>
    <p class="done-copy">${pendingCount() ? "Your route is complete. Events are safely queued on this device until a connection is available." : "Your route is complete. All route events are saved on this device."}</p>
    <div class="done-summary"><div><strong>${Object.values(state.statuses).filter((value) => value === "Completed").length}</strong><span>DELIVERED</span></div><div><strong>${Object.values(state.statuses).filter((value) => value === "Failed").length}</strong><span>ISSUES</span></div><div><strong>${pendingCount()}</strong><span>QUEUED</span></div></div>
    <button class="button button-primary button-wide" type="button" data-screen="manifest">View route summary <span class="button-arrow" aria-hidden="true">→</span></button></section>`;
}

function renderEarnings() {
  const done = completedStops();
  const pay = (done.length * 45).toLocaleString("en-IN");
  return `<section class="screen data-screen" aria-labelledby="earnings-title"><div class="page-head"><div><p class="eyebrow">DRIVER ACCOUNT <span class="eyebrow-line"></span> RAIPUR</p><h1 id="earnings-title">Earnings<span class="title-period">.</span></h1></div><span class="route-tag">TODAY · 05 OCT</span></div>
    <div class="earnings-total"><div><span class="summary-label">TODAY'S ESTIMATED PAY</span><strong>₹${pay}</strong><small>Final amount confirmed after dispatch reconciliation</small></div><span class="earnings-coin" aria-hidden="true">₹</span></div>
    <div class="earning-metrics"><div><span>DELIVERY PAY</span><strong>₹${pay}</strong></div><div><span>COMPLETED STOPS</span><strong>${done.length}</strong></div><div><span>ROUTE</span><strong>${escapeHtml(state.route.id)}</strong></div></div>
    <div class="section-head"><div><p class="eyebrow">SHIFT ACTIVITY</p><h2>Completed orders</h2></div><span class="list-caption">TODAY</span></div>
    <ol class="earning-list">${done.length ? done.map((stop) => `<li class="earning-row"><span class="earning-check">✓</span><span class="earning-order"><strong>#${escapeHtml(stop.orderRef || stop.orderId)}</strong><small>${escapeHtml(stop.locality)} · ${escapeHtml(stop.name)}</small></span><span class="earning-amount">₹45</span></li>`).join("") : '<li class="empty-state"><span class="empty-state-mark">₹</span><strong>No completed orders yet</strong><small>Completed stops will appear here.</small></li>'}</ol>
    <p class="data-disclaimer">Demo estimate only. A connected dispatch service is required for actual payout data.</p></section>`;
}

function renderInbox() {
  return `<section class="screen data-screen" aria-labelledby="inbox-title"><div class="page-head"><div><p class="eyebrow">SHIFT UPDATES <span class="eyebrow-line"></span> RAIPUR</p><h1 id="inbox-title">Inbox<span class="title-period">.</span></h1></div><button class="button button-secondary inbox-refresh" type="button" data-action="refresh">Refresh</button></div>
    <div class="inbox-status"><span class="connectivity-dot"></span><span>${online() ? "Device activity · network available" : "Device activity · offline queue active"}</span></div>
    <div class="section-head"><div><p class="eyebrow">DISPATCH + DEVICE</p><h2>Recent activity</h2></div><span class="list-caption">${String(state.events.length).padStart(2, "0")} UPDATES</span></div>
    <ol class="inbox-list">${state.events.length ? state.events.slice().reverse().map((item) => {
      const [title, message] = EVENT_COPY[item.event_type] || [item.event_type, "Driver activity recorded."];
      const queued = item.sync_status === "PENDING";
      const timestamp = new Date(item.timestamp).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
      return `<li class="inbox-row"><span class="inbox-icon ${queued ? "is-queued" : ""}">${queued ? "↥" : "✓"}</span><span class="inbox-message"><strong>${escapeHtml(title)}${item.order_id ? ` · ${escapeHtml(item.order_id)}` : ""}</strong><small>${escapeHtml(message)}</small><time>${escapeHtml(timestamp)}</time></span><span class="inbox-event-status ${queued ? "is-queued" : ""}">${queued ? "QUEUED" : "SYNCED"}</span></li>`;
    }).join("") : '<li class="empty-state"><span class="empty-state-mark">↥</span><strong>No activity yet</strong><small>Route and dispatch updates will appear here.</small></li>'}</ol></section>`;
}

function renderScreen() {
  return ({
    auth: renderAuth,
    manifest: renderManifest,
    active: renderActiveRoute,
    done: renderCompletedRoute,
    earnings: renderEarnings,
    inbox: renderInbox
  }[state.screen] || renderAuth)();
}

function renderRegistrationDialog() {
  return `<dialog class="modal account-modal" id="registration-dialog" aria-labelledby="registration-title"><div class="modal-head"><div><p class="eyebrow">DRIVER ONBOARDING</p><h2 id="registration-title">Create your driver profile</h2></div><button class="modal-close" type="button" data-action="close-registration" aria-label="Close registration">×</button></div>
    <form class="modal-body account-form" id="registration-form" novalidate><p class="account-intro">Your details stay on this device in this demo. Registration is available offline.</p>
    <label class="account-field" for="register-name">Full name<input class="text-input" id="register-name" autocomplete="name" required placeholder="e.g. Arjun Sahu" value="${escapeHtml(state.registerName)}" /></label>
    <label class="account-field" for="register-phone">Mobile number<input class="text-input" id="register-phone" type="tel" inputmode="tel" autocomplete="tel" required maxlength="16" placeholder="10-digit mobile number" value="${escapeHtml(state.registerPhone)}" /></label>
    <label class="account-field" for="register-vehicle">Vehicle / registration number<input class="text-input" id="register-vehicle" autocomplete="off" required placeholder="e.g. CG 04 AB 1234" value="${escapeHtml(state.registerVehicle)}" /></label>
    <button class="button button-primary button-wide" type="submit">Create driver profile <span class="button-arrow" aria-hidden="true">→</span></button><p class="account-footnote">A demo sign-in code will be generated locally. No SMS is sent.</p></form></dialog>`;
}

function renderProfileDialog() {
  return `<dialog class="modal account-modal" id="profile-dialog" aria-labelledby="profile-title"><div class="modal-head"><div><p class="eyebrow">DRIVER ACCOUNT</p><h2 id="profile-title">Your profile</h2></div><button class="modal-close" type="button" data-action="close-profile" aria-label="Close driver profile">×</button></div>
    <form class="modal-body account-form" id="profile-form" novalidate><div class="profile-id-row"><span class="profile-avatar">${escapeHtml(initials(state.profile.name))}</span><span><strong>${escapeHtml(state.profile.driverId)}</strong><small>RAIPUR DRIVER</small></span></div>
    <label class="account-field" for="profile-name">Full name<input class="text-input" id="profile-name" autocomplete="name" required value="${escapeHtml(state.profileName)}" /></label>
    <label class="account-field" for="profile-phone">Mobile number<input class="text-input" id="profile-phone" type="tel" inputmode="tel" autocomplete="tel" required value="${escapeHtml(state.profilePhone)}" /></label>
    <label class="account-field" for="profile-vehicle">Vehicle / registration number<input class="text-input" id="profile-vehicle" autocomplete="off" required value="${escapeHtml(state.profileVehicle)}" /></label>
    <button class="button button-primary button-wide" type="submit">Save profile</button><p class="profile-status">${escapeHtml(state.profileStatus)}</p></form></dialog>`;
}

function renderPodDialog() {
  const stop = currentStop();
  return `<dialog class="modal" id="pod-dialog" aria-labelledby="pod-title"><div class="modal-head"><div><p class="eyebrow">PROOF OF DELIVERY</p><h2 id="pod-title">Close this stop</h2></div><button class="modal-close" type="button" data-action="close-pod" aria-label="Close proof of delivery">×</button></div>
    <div class="modal-body"><label class="upload-zone" for="pod-photo"><span class="upload-icon" aria-hidden="true">＋</span><strong>Capture parcel or doorstep</strong><small>Camera opens on supported devices · Optional</small><input id="pod-photo" type="file" accept="image/*" capture="environment" /></label>
    ${state.photoUrl ? `<img class="photo-preview" src="${escapeHtml(state.photoUrl)}" alt="Captured proof of delivery preview" />` : ""}
    <div class="modal-field"><div class="field-label-row"><label for="delivery-otp">Customer delivery OTP</label><span class="field-hint">TEST OTP: ${escapeHtml(stop.otp)}</span></div><input class="text-input" id="delivery-otp" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="4" placeholder="Enter 4-digit code" value="${escapeHtml(state.podOtp)}" /></div>
    <div class="signature-heading"><div><label>Customer signature</label><small>Ask the customer to sign below</small></div><button class="text-button" type="button" data-action="clear-signature">Clear</button></div>
    <div class="signature-wrap"><canvas id="signature-canvas" aria-label="Signature drawing area"></canvas><span class="signature-placeholder ${state.signatureInk ? "is-hidden" : ""}">SIGN HERE</span></div>
    <div class="confirm-section"><div class="confirm-label"><span>HOLD &amp; SLIDE · COMPLETE DELIVERY</span><span id="pod-confirm-hint">${podHint()}</span></div><input class="confirm-slider" id="pod-slider" type="range" min="0" max="100" value="${state.podSlider}" ${podReady() ? "" : "disabled"} aria-label="Slide to complete delivery" /><p class="modal-footnote">This records proof on your device, even without signal.</p></div></div></dialog>`;
}

function podReady() {
  return state.podOtp === currentStop().otp && state.signatureInk;
}

function podHint() {
  return podReady() ? "Ready to confirm" : state.podOtp !== currentStop().otp ? "Enter the customer's 4-digit OTP" : "Customer signature required";
}

function renderFailureDialog() {
  return `<dialog class="modal exception-modal" id="failure-dialog" aria-labelledby="failure-title"><div class="modal-head"><div><p class="eyebrow eyebrow-danger">DELIVERY EXCEPTION</p><h2 id="failure-title">Report an issue</h2></div><button class="modal-close" type="button" data-action="close-failure" aria-label="Close delivery issue">×</button></div>
    <div class="modal-body"><fieldset class="reason-list"><legend>Why couldn't this be delivered?</legend>${FAILURE_REASONS.map(([value, label, detail]) => `<label class="reason-option"><input type="radio" name="failure-reason" value="${escapeHtml(value)}" ${state.failureReason === value ? "checked" : ""} /><span class="radio-mark"></span><span>${escapeHtml(label)}<small>${escapeHtml(detail)}</small></span></label>`).join("")}</fieldset>
    <label class="modal-field notes-field" for="failure-notes">Notes <span class="optional-label">OPTIONAL</span><textarea id="failure-notes" class="text-input" rows="3" maxlength="240" placeholder="Add helpful context for dispatch...">${escapeHtml(state.failureNotes)}</textarea></label>
    <div class="confirm-section confirm-danger"><div class="confirm-label"><span>HOLD &amp; SLIDE · CONFIRM DELIVERY FAILED</span><span id="failure-confirm-hint">${state.failureReason ? "Ready to confirm" : "Choose a reason first"}</span></div><input class="confirm-slider" id="failure-slider" type="range" min="0" max="100" value="${state.failureSlider}" ${state.failureReason ? "" : "disabled"} aria-label="Slide to confirm delivery issue" /><p class="modal-footnote">The parcel will be marked failed and dispatch notified.</p></div></div></dialog>`;
}

function render() {
  const navTarget = state.screen === "active" || state.screen === "done" ? "manifest" : state.screen;
  const previousCanvas = document.getElementById("signature-canvas");
  let signatureData = null;
  if (inkRef && previousCanvas) signatureData = previousCanvas.toDataURL();
  const mainContent = renderScreen();
  const activeDialog = document.querySelector("dialog[open]")?.id || "";
  const rootHtml = `<div class="app-shell">
    <header class="topbar"><a class="brand" href="#" aria-label="Raipur Dispatch home"><span class="brand-mark" aria-hidden="true">R</span><span class="brand-copy"><strong>RAHUL</strong><small>LAST MILE / DRIVER</small></span></a>
      <div class="header-meta"><nav class="screen-nav ${state.screen === "auth" ? "is-hidden" : ""}" aria-label="Driver sections"><button type="button" data-screen="manifest" class="${navTarget === "manifest" ? "is-selected" : ""}">Route</button><button type="button" data-screen="earnings" class="${navTarget === "earnings" ? "is-selected" : ""}">Earnings</button><button type="button" data-screen="inbox" class="${navTarget === "inbox" ? "is-selected" : ""}">Inbox <span class="inbox-count">${pendingCount()}</span></button></nav>
        <span class="shift-indicator ${state.screen !== "auth" && online() ? "is-online" : ""}"><i></i><span>${state.screen === "auth" ? "SHIFT NOT STARTED" : "SHIFT ACTIVE · 08:00"}</span></span>
        <button class="avatar" type="button" aria-label="Driver profile" data-action="open-profile">${escapeHtml(initials(state.profile.name))}</button></div></header>
    <div class="debug-bar" aria-label="Network simulator controls"><span class="debug-label"><span class="debug-dot"></span> NETWORK SIMULATOR</span><span class="debug-copy">${online() ? "Live network detection" : "Events will queue on device"}</span><button class="network-toggle" type="button" aria-pressed="${state.simulatorOnline}"><span>Simulator ${state.simulatorOnline ? "online" : "offline"}</span><span class="toggle-knob" aria-hidden="true"></span></button></div>
    <main id="app-main">${mainContent}</main>
    <footer class="global-footer"><span>BUILT FOR THE LAST MILE</span><span>RAIPUR, CG <i></i> <span>${pendingCount()} ${pendingCount() === 1 ? "EVENT" : "EVENTS"} QUEUED</span></span></footer>
    </div>
    <div id="dialog-host">${renderRegistrationDialog()}${renderProfileDialog()}${renderPodDialog()}${renderFailureDialog()}</div>
    <div class="toast ${state.toast ? "is-visible" : ""}" role="status" aria-live="polite">${escapeHtml(state.toast)}</div>`;
  root.innerHTML = rootHtml;
  if (activeDialog) {
    const dialog = document.getElementById(activeDialog);
    if (dialog) dialog.showModal();
  }
  if (activeDialog === "pod-dialog") {
    requestAnimationFrame(() => sizeCanvas(signatureData));
  }
  if (state.screen === "active" && state.stage !== "arrived") {
    state.etaNow = Date.now();
  }
  renderChrome();
}

function openDialog(id) {
  if (id === "pod-dialog") {
    state.podOtp = "";
    state.podSlider = 0;
    state.signatureInk = false;
    inkRef = false;
    state.selectedPhoto = null;
    if (state.photoUrl) URL.revokeObjectURL(state.photoUrl);
    state.photoUrl = "";
    render();
    document.getElementById("pod-dialog")?.showModal();
    requestAnimationFrame(() => sizeCanvas());
    return;
  }
  if (id === "failure-dialog") {
    state.failureReason = "";
    state.failureNotes = "";
    state.failureSlider = 0;
    render();
    document.getElementById("failure-dialog")?.showModal();
    return;
  }
  const dialog = document.getElementById(id);
  if (dialog && !dialog.open) dialog.showModal();
}

function closeDialog(id) {
  document.getElementById(id)?.close();
}

function signIn(event) {
  event.preventDefault();
  const found = findProfile(state.identifier);
  if (!state.identifier.trim()) { showToast("Enter your driver ID or phone number."); return; }
  if (!found) { showToast("No local driver profile found. Register first or use DRV-104."); return; }
  if (state.loginOtp !== found.otp) { showToast("That passcode doesn't match the demo code shown above."); return; }
  if (!state.goOnline) { showToast("Go online to receive your assigned route."); return; }
  applyProfile(found);
  state.routeStarted = true;
  persistRun({ driverId: found.driverId, routeStarted: true });
  appendEvent("driver.shift.started", state.route.hub, { driver_id: found.driverId, route_id: state.route.id });
  startTelemetry();
  state.screen = "manifest";
  render();
}

function beginRoute() {
  const deadline = state.etaDeadline || Date.now() + 8 * 60 * 1000;
  state.routeStarted = true;
  state.etaDeadline = deadline;
  if (state.stopIndex > 0) state.statuses[currentStop().id] = "Active";
  persistRun({ routeStarted: true, etaDeadline: deadline });
  state.screen = "active";
  render();
}

function markArrived() {
  state.stage = "arrived";
  state.etaDeadline = null;
  appendEvent("stop.arrived", currentStop(), { geofence_triggered: false, arrival_method: "driver_tap" });
  persistRun({ stage: "arrived", etaDeadline: null });
  showToast(state.stopIndex === 0 ? "Hub arrival saved on device." : "Arrival saved. Full address unlocked.");
  render();
}

function confirmPickup() {
  appendEvent("package.scanned", currentStop(), { scan_method: "manual_confirm", package_count: state.route.stops.length });
  state.statuses[state.route.stops[0].id] = "Active";
  state.stopIndex = 1;
  state.stage = "en-route";
  state.etaDeadline = Date.now() + 8 * 60 * 1000;
  persistRun({ currentStopIndex: 1, stage: state.stage, deliveryStatuses: state.statuses, etaDeadline: state.etaDeadline });
  showToast("Pickup confirmed. First delivery is ready.");
  state.screen = "active";
  render();
}

function advanceAfterStop(nextStatuses) {
  state.statuses = nextStatuses;
  if (state.stopIndex >= state.route.stops.length) {
    state.routeCompleted = true;
    state.etaDeadline = null;
    persistRun({ routeCompleted: true, etaDeadline: null, deliveryStatuses: nextStatuses });
    state.screen = "done";
    return;
  }
  const nextIndex = state.stopIndex + 1;
  state.stopIndex = nextIndex;
  state.routeCompleted = false;
  state.stage = "en-route";
  state.etaDeadline = Date.now() + 8 * 60 * 1000;
  if (state.route.stops[nextIndex - 1]) state.statuses[state.route.stops[nextIndex - 1].id] = "Active";
  persistRun({ currentStopIndex: nextIndex, routeCompleted: false, stage: "en-route", etaDeadline: state.etaDeadline, deliveryStatuses: state.statuses });
}

function completeDelivery() {
  const stop = currentStop();
  const nextStatuses = { ...state.statuses, [stop.id]: "Completed" };
  appendEvent("delivery.completed", stop, {
    photo_url: state.selectedPhoto ? `local://${encodeURIComponent(state.selectedPhoto.name)}` : null,
    otp_verified: true,
    signature_captured: true,
    failure_reason: null
  });
  state.statuses = nextStatuses;
  closeDialog("pod-dialog");
  if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
  advanceAfterStop(nextStatuses);
  showToast("Delivery completed. Proof saved on this device.");
  render();
}

function failDelivery() {
  if (!state.failureReason) { showToast("Choose a reason before confirming."); if (navigator.vibrate) navigator.vibrate([70, 40, 70]); return; }
  const stop = currentStop();
  const nextStatuses = { ...state.statuses, [stop.id]: "Failed" };
  appendEvent("delivery.failed", stop, {
    photo_url: null,
    otp_verified: false,
    failure_reason: state.failureReason,
    notes: state.failureNotes.trim() || null
  });
  state.statuses = nextStatuses;
  closeDialog("failure-dialog");
  if (navigator.vibrate) navigator.vibrate([70, 40, 70]);
  advanceAfterStop(nextStatuses);
  showToast("Delivery issue recorded. Dispatch can review it.");
  render();
}

function changeSimulator() {
  state.simulatorOnline = !state.simulatorOnline;
  try {
    localStorage.setItem(KEYS.network, state.simulatorOnline ? "online" : "offline");
  } catch {
    showToast("Could not save network simulator setting on this device.");
  }
  render();
  if (online()) flushOutbox();
}

function registerDriver(event) {
  event.preventDefault();
  const name = state.registerName.trim();
  const phone = normalizePhone(state.registerPhone);
  const vehicle = state.registerVehicle.trim().toUpperCase();
  if (!name || phone.length !== 10 || !vehicle) { showToast("Enter your name, a valid 10-digit mobile number, and vehicle number."); return; }
  const profiles = readProfiles();
  if (Object.values(profiles).some((item) => normalizePhone(item.phone) === phone)) {
    showToast("A driver profile already uses this phone. Sign in with that number.");
    return;
  }
  const suffix = phone.slice(-3);
  let id = `DRV-${suffix}`;
  let sequence = 1;
  while (profiles[id]) id = `DRV-${suffix}-${sequence++}`;
  const profile = { driverId: id, name, phone, vehicle, otp: String(Math.floor(1000 + Math.random() * 9000)) };
  profiles[id] = profile;
  try {
    localStorage.setItem(KEYS.profiles, JSON.stringify(profiles));
  } catch {
    showToast("Could not save profile on this device.");
    return;
  }
  applyProfile(profile);
  state.registerName = "";
  state.registerPhone = "";
  state.registerVehicle = "";
  closeDialog("registration-dialog");
  render();
  showToast(`Profile created. Demo sign-in code: ${profile.otp}`);
}

function saveProfile(event) {
  event.preventDefault();
  const name = state.profileName.trim();
  const phone = normalizePhone(state.profilePhone);
  const vehicle = state.profileVehicle.trim().toUpperCase();
  if (!name || phone.length !== 10 || !vehicle) { showToast("Enter a name, valid 10-digit mobile number, and vehicle number."); return; }
  const updated = { ...state.profile, name, phone, vehicle };
  const profiles = readProfiles();
  profiles[updated.driverId] = updated;
  try {
    localStorage.setItem(KEYS.profiles, JSON.stringify(profiles));
  } catch {
    showToast("Could not save profile on this device.");
    return;
  }
  applyProfile(updated);
  state.profileStatus = "Signed in for this shift. Changes save on this device.";
  persistRun({ driverId: updated.driverId });
  closeDialog("profile-dialog");
  render();
  showToast("Driver profile saved on this device.");
}

function sizeCanvas(previousData = null) {
  const canvas = document.getElementById("signature-canvas");
  if (!canvas) return;
  const bounds = canvas.getBoundingClientRect();
  if (!bounds.width || !bounds.height) return;
  const ratio = Math.max(1, window.devicePixelRatio || 1);
  canvas.width = Math.round(bounds.width * ratio);
  canvas.height = Math.round(bounds.height * ratio);
  const context = canvas.getContext("2d");
  context.scale(ratio, ratio);
  context.lineWidth = 2.5;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.strokeStyle = "#163b30";
  signatureContext = context;
  if (previousData) {
    const image = new Image();
    image.onload = () => context.drawImage(image, 0, 0, bounds.width, bounds.height);
    image.src = previousData;
  }
}

function startTelemetry() {
  if ("geolocation" in navigator) {
    navigator.geolocation.watchPosition(
      (position) => appendEvent("driver.location.updated", currentStop(), {
        source: "gps",
        accuracy_m: Math.round(position.coords.accuracy),
        latitude: position.coords.latitude,
        longitude: position.coords.longitude
      }),
      startCoordinateEmitter,
      { enableHighAccuracy: true, maximumAge: 30000, timeout: 8000 }
    );
  } else {
    startCoordinateEmitter();
  }
}

function startCoordinateEmitter() {
  if (locationTimer) return;
  const path = [
    { latitude: 21.2578, longitude: 81.6406 },
    { latitude: 21.2582, longitude: 81.6631 },
    { latitude: 21.2416, longitude: 81.6672 },
    { latitude: 21.2619, longitude: 81.6384 },
    { latitude: 21.2478, longitude: 81.6509 }
  ];
  let segment = 0;
  let fraction = 0;
  locationTimer = window.setInterval(() => {
    const start = path[segment];
    const end = path[(segment + 1) % path.length];
    fraction += 0.2;
    if (fraction >= 1) { fraction = 0; segment = (segment + 1) % path.length; }
    const next = path[(segment + 1) % path.length];
    appendEvent("driver.location.updated", currentStop(), {
      source: "simulated",
      latitude: start.latitude + (end.latitude - start.latitude) * fraction,
      longitude: start.longitude + (end.longitude - start.longitude) * fraction,
      next_latitude: next.latitude,
      next_longitude: next.longitude
    });
  }, 10000);
}

async function loadRemoteRoute() {
  try {
    const response = await fetch(`/api/routes/${encodeURIComponent(ROUTE.id)}`);
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Route request failed.");
    if (payload.id !== ROUTE.id || !payload.hub || !Array.isArray(payload.stops)) return;
    state.route = payload;
    const remoteStatuses = Object.fromEntries(payload.stops.filter((stop) => stop.status && stop.status !== "Pending").map((stop) => [stop.id, stop.status]));
    if (payload.hub.status === "Completed") remoteStatuses[payload.hub.id] = "Completed";
    state.statuses = { ...remoteStatuses, ...state.statuses };
    renderMain();
  } catch (error) {
    showToast(`Neon route unavailable; showing demo route. ${error.message}`);
  }
}

async function loadRemoteEvents() {
  if (!state.driverId || !state.route.id) return;
  const query = new URLSearchParams({ driver_id: state.driverId, route_id: state.route.id });
  try {
    const response = await fetch(`/driver/events?${query}`);
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Event request failed.");
    if (!Array.isArray(payload)) throw new Error("The events endpoint returned an invalid response.");
    const merged = new Map(payload.map((event) => [event.event_id, { ...event, sync_status: "SYNCED" }]));
    state.events.forEach((event) => {
      if (event.sync_status === "PENDING" && !merged.has(event.event_id)) merged.set(event.event_id, event);
    });
    state.events = [...merged.values()].sort((left, right) => Date.parse(left.timestamp) - Date.parse(right.timestamp));
    saveEvents();
    renderChrome();
    if (state.screen === "inbox" || state.screen === "done") renderMain();
  } catch (error) {
    showToast(`Neon activity unavailable; showing device activity. ${error.message}`);
  }
}

root.addEventListener("click", (event) => {
  if (event.target.closest(".brand")) {
    event.preventDefault();
    return;
  }
  const button = event.target.closest("[data-action], [data-screen], .network-toggle");
  if (!button) return;
  if (button.matches(".network-toggle")) { changeSimulator(); return; }
  if (button.dataset.screen) {
    state.screen = button.dataset.screen;
    render();
    return;
  }
  switch (button.dataset.action) {
    case "open-registration":
      openDialog("registration-dialog");
      break;
    case "open-profile":
      state.profileName = state.profile.name;
      state.profilePhone = state.profile.phone;
      state.profileVehicle = state.profile.vehicle;
      state.profileStatus = state.screen === "auth" ? "Profile is stored on this device." : "Signed in for this shift. Changes save on this device.";
      render();
      document.getElementById("profile-dialog")?.showModal();
      break;
    case "close-registration": closeDialog("registration-dialog"); break;
    case "close-profile": closeDialog("profile-dialog"); break;
    case "close-pod":
      if (state.photoUrl) URL.revokeObjectURL(state.photoUrl);
      state.photoUrl = "";
      state.selectedPhoto = null;
      closeDialog("pod-dialog");
      break;
    case "close-failure": closeDialog("failure-dialog"); break;
    case "begin-route": beginRoute(); break;
    case "mark-arrived": markArrived(); break;
    case "confirm-pickup": confirmPickup(); break;
    case "open-pod": openDialog("pod-dialog"); break;
    case "open-failure": openDialog("failure-dialog"); break;
    case "clear-signature":
      if (signatureContext) {
        const canvas = document.getElementById("signature-canvas");
        signatureContext.clearRect(0, 0, canvas.width, canvas.height);
      }
      inkRef = false;
      state.signatureInk = false;
      document.querySelector(".signature-placeholder")?.classList.remove("is-hidden");
      document.getElementById("pod-slider").disabled = true;
      document.getElementById("pod-confirm-hint").textContent = state.podOtp === currentStop().otp ? "Customer signature required" : "Enter the customer's 4-digit OTP";
      break;
    case "refresh": flushOutbox(); break;
  }
});

root.addEventListener("input", (event) => {
  const target = event.target;
  if (target.id === "driver-id") {
    state.identifier = target.value;
    const found = findProfile(state.identifier);
    if (found) {
      state.loginOtpHint = found.otp;
      const hint = root.querySelector(".field-hint");
      if (hint) hint.textContent = `DEMO CODE: ${found.otp}`;
    }
  } else if (target.classList.contains("otp-box")) {
    const boxes = [...root.querySelectorAll(".otp-box")];
    const index = boxes.indexOf(target);
    const digit = target.value.replace(/\D/g, "").slice(-1);
    target.value = digit;
    const digits = state.loginOtp.padEnd(4, " ").slice(0, 4).split("");
    digits[index] = digit || " ";
    state.loginOtp = digits.join("");
    if (digit) boxes[index + 1]?.focus();
  } else if (target.id === "register-name") state.registerName = target.value;
  else if (target.id === "register-phone") state.registerPhone = target.value;
  else if (target.id === "register-vehicle") state.registerVehicle = target.value;
  else if (target.id === "profile-name") state.profileName = target.value;
  else if (target.id === "profile-phone") state.profilePhone = target.value;
  else if (target.id === "profile-vehicle") state.profileVehicle = target.value;
  else if (target.id === "delivery-otp") {
    state.podOtp = target.value.replace(/\D/g, "").slice(0, 4);
    target.value = state.podOtp;
    state.podSlider = 0;
    const ready = podReady();
    document.getElementById("pod-slider").disabled = !ready;
    document.getElementById("pod-slider").value = "0";
    document.getElementById("pod-confirm-hint").textContent = podHint();
  } else if (target.id === "failure-notes") state.failureNotes = target.value;
});

root.addEventListener("change", (event) => {
  const target = event.target;
  if (target.id === "go-online") state.goOnline = target.checked;
  else if (target.name === "failure-reason") {
    state.failureReason = target.value;
    state.failureSlider = 0;
    const slider = document.getElementById("failure-slider");
    slider.disabled = false;
    slider.value = "0";
    document.getElementById("failure-confirm-hint").textContent = "Ready to confirm";
  } else if (target.id === "pod-photo") {
    const file = target.files?.[0];
    if (!file) return;
    if (state.photoUrl) URL.revokeObjectURL(state.photoUrl);
    state.selectedPhoto = file;
    state.photoUrl = URL.createObjectURL(file);
    const existing = document.querySelector(".photo-preview");
    if (existing) existing.src = state.photoUrl;
    else target.closest(".modal-body").insertAdjacentHTML("afterbegin", `<img class="photo-preview" src="${escapeHtml(state.photoUrl)}" alt="Captured proof of delivery preview" />`);
  }
});

root.addEventListener("submit", (event) => {
  if (event.target.id === "sign-in-form") signIn(event);
  else if (event.target.id === "registration-form") registerDriver(event);
  else if (event.target.id === "profile-form") saveProfile(event);
});

root.addEventListener("keydown", (event) => {
  if (event.target.classList.contains("otp-box") && event.key === "Backspace" && !event.target.value) {
    event.target.previousElementSibling?.focus();
  }
});

root.addEventListener("pointerdown", (event) => {
  const canvas = event.target.closest("#signature-canvas");
  if (!canvas || !signatureContext) return;
  event.preventDefault();
  canvas.setPointerCapture(event.pointerId);
  const bounds = canvas.getBoundingClientRect();
  signatureContext.beginPath();
  signatureContext.moveTo(event.clientX - bounds.left, event.clientY - bounds.top);
  drawing = true;
});
root.addEventListener("pointermove", (event) => {
  const canvas = event.target.closest("#signature-canvas");
  if (!canvas || !drawing || !signatureContext) return;
  const bounds = canvas.getBoundingClientRect();
  signatureContext.lineTo(event.clientX - bounds.left, event.clientY - bounds.top);
  signatureContext.stroke();
  if (!inkRef) {
    inkRef = true;
    state.signatureInk = true;
    document.querySelector(".signature-placeholder")?.classList.add("is-hidden");
    document.getElementById("pod-slider").disabled = !podReady();
    document.getElementById("pod-confirm-hint").textContent = podHint();
  }
});
root.addEventListener("pointerup", () => { drawing = false; });
root.addEventListener("pointercancel", () => { drawing = false; });
root.addEventListener("input", (event) => {
  if (event.target.id === "pod-slider") {
    const value = Number(event.target.value);
    if (value >= 94 && podReady()) {
      state.podSlider = 0;
      completeDelivery();
    } else state.podSlider = value;
  } else if (event.target.id === "failure-slider") {
    const value = Number(event.target.value);
    if (value >= 94 && state.failureReason) {
      state.failureSlider = 0;
      failDelivery();
    } else state.failureSlider = value;
  }
});

for (const id of ["registration-dialog", "profile-dialog", "pod-dialog", "failure-dialog"]) {
  root.addEventListener("click", (event) => {
    const dialog = document.getElementById(id);
    if (event.target === dialog) {
      if (id === "pod-dialog" && state.photoUrl) {
        URL.revokeObjectURL(state.photoUrl);
        state.photoUrl = "";
        state.selectedPhoto = null;
      }
      dialog.close();
    }
  });
  root.addEventListener("close", (event) => {
    if (event.target.id === id) renderChrome();
  }, true);
}

window.addEventListener("online", () => {
  state.browserOnline = true;
  renderChrome();
  flushOutbox();
});
window.addEventListener("offline", () => {
  state.browserOnline = false;
  renderChrome();
});

render();
loadRemoteRoute();
loadRemoteEvents();
window.setInterval(() => flushOutbox(), 5000);
window.setInterval(() => {
  state.clock = new Date();
  if (state.screen === "auth") {
    const weatherTime = document.querySelector(".weather-time");
    if (weatherTime) weatherTime.textContent = new Intl.DateTimeFormat("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" }).format(state.clock);
  }
}, 60000);
window.setInterval(() => {
  if (state.screen === "active" && state.stage !== "arrived") {
    state.etaNow = Date.now();
    const eta = document.querySelector(".eta-block strong");
    if (eta) {
      const seconds = Math.max(0, Math.ceil(((state.etaDeadline || (state.etaNow + 8 * 60 * 1000)) - state.etaNow) / 1000));
      eta.textContent = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")} LEFT`;
    }
  }
}, 1000);
window.addEventListener("resize", sizeCanvas);
