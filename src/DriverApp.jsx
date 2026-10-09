import React, { useCallback, useEffect, useRef, useState } from "react";
import Auth from "./auth.jsx";
import Registration from "./registration.jsx";
import Profile from "./profile.jsx";
import Manifest from "./manifest.jsx";
import ActiveRoute from "./activeRoute.jsx";
import CompletedRoute from "./completedRoute.jsx";
import Earnings from "./earnings.jsx";
import Inbox from "./inbox.jsx";
import ProofOfDelivery from "./proofOfDelivery.jsx";
import DeliveryException from "./deliveryException.jsx";
import { DEFAULT_PROFILE, KEYS, ROUTE, initials, makeId, normalizePhone, readJson, readProfiles } from "./route.js";

const isBrowser = typeof window !== "undefined" && typeof document !== "undefined";
const isNavigatorAvailable = typeof navigator !== "undefined";

function DriverApp() {
  const savedRun = readJson(KEYS.run, null);
  const savedProfile = savedRun?.driverId ? readProfiles()[savedRun.driverId] : null;
  const [routeData, setRouteData] = useState(ROUTE);
  const [screen, setScreen] = useState(savedRun?.routeStarted ? (savedRun.routeCompleted ? "done" : "active") : "auth");
  const [profile, setProfile] = useState(savedProfile || DEFAULT_PROFILE);
  const [driverId, setDriverId] = useState(savedRun?.driverId || DEFAULT_PROFILE.driverId);
  const [stopIndex, setStopIndex] = useState(Math.min(savedRun?.currentStopIndex || 0, ROUTE.stops.length));
  const [stage, setStage] = useState(savedRun?.stage || "en-route");
  const [statuses, setStatuses] = useState(savedRun?.deliveryStatuses || {});
  const [routeStarted, setRouteStarted] = useState(Boolean(savedRun?.routeStarted));
  const [routeCompleted, setRouteCompleted] = useState(Boolean(savedRun?.routeCompleted));
  const [etaDeadline, setEtaDeadline] = useState(savedRun?.etaDeadline || (
    savedRun?.routeStarted && !savedRun?.routeCompleted && savedRun?.stage !== "arrived"
      ? Date.now() + 8 * 60 * 1000
      : null
  ));
  const [simulatorOnline, setSimulatorOnline] = useState(() => {
    try { return typeof localStorage !== "undefined" ? localStorage.getItem(KEYS.network) !== "offline" : true; } catch { return true; }
  });
  const [browserOnline, setBrowserOnline] = useState(() => (isNavigatorAvailable ? navigator.onLine : true));
  const [events, setEvents] = useState(() => {
    const stored = readJson(KEYS.outbox, []);
    return Array.isArray(stored) ? stored : [];
  });
  const [syncing, setSyncing] = useState(false);
  const [toast, setToast] = useState("");
  const [clock, setClock] = useState(() => new Date());
  const [podOpen, setPodOpen] = useState(false);
  const [failureOpen, setFailureOpen] = useState(false);
  const [registrationOpen, setRegistrationOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [identifier, setIdentifier] = useState(DEFAULT_PROFILE.driverId);
  const [loginOtp, setLoginOtp] = useState(DEFAULT_PROFILE.otp);
  const [goOnline, setGoOnline] = useState(true);
  const [registerName, setRegisterName] = useState("");
  const [registerPhone, setRegisterPhone] = useState("");
  const [registerVehicle, setRegisterVehicle] = useState("");
  const [profileName, setProfileName] = useState(profile.name);
  const [profilePhone, setProfilePhone] = useState(profile.phone);
  const [profileVehicle, setProfileVehicle] = useState(profile.vehicle);
  const [podOtp, setPodOtp] = useState("");
  const [signatureInk, setSignatureInk] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [photoUrl, setPhotoUrl] = useState("");
  const [failureReason, setFailureReason] = useState("");
  const [failureNotes, setFailureNotes] = useState("");
  const [podSlider, setPodSlider] = useState(0);
  const [failureSlider, setFailureSlider] = useState(0);
  const [etaNow, setEtaNow] = useState(Date.now());
  const [profileStatus, setProfileStatus] = useState("Profile is stored on this device.");
  const podDialog = useRef(null);
  const failureDialog = useRef(null);
  const registrationDialog = useRef(null);
  const profileDialog = useRef(null);
  const canvasRef = useRef(null);
  const canvasContext = useRef(null);
  const drawing = useRef(false);
  const inkRef = useRef(false);
  const outboxRef = useRef(events);
  const flushing = useRef(false);
  const toastTimer = useRef(null);
  const locationTimer = useRef(null);
  const photoInputRef = useRef(null);

  const currentStop = stopIndex === 0 ? routeData.hub : routeData.stops[stopIndex - 1];
  const currentStopRef = useRef(currentStop);
  const driverIdRef = useRef(driverId);
  const routeRef = useRef(routeData);
  currentStopRef.current = currentStop;
  driverIdRef.current = driverId;
  routeRef.current = routeData;
  const online = simulatorOnline && browserOnline;
  const pendingCount = events.filter((event) => event.sync_status === "PENDING").length;
  const totalWeight = routeData.stops.reduce((sum, stop) => sum + stop.weight, routeData.hub.weight);

  const showToast = useCallback((message) => {
    setToast(message);
    if (typeof window !== "undefined") {
      window.clearTimeout(toastTimer.current);
      toastTimer.current = window.setTimeout(() => setToast(""), 3000);
    }
  }, []);

  const persistRun = useCallback((patch = {}) => {
    const run = {
      currentStopIndex: stopIndex,
      stage,
      driverId,
      deliveryStatuses: statuses,
      routeStarted,
      routeCompleted,
      etaDeadline,
      ...patch
    };
    try { localStorage.setItem(KEYS.run, JSON.stringify(run)); } catch { /* Keep this run active in memory. */ }
  }, [stopIndex, stage, driverId, statuses, routeStarted, routeCompleted, etaDeadline]);

  useEffect(() => {
    try { localStorage.setItem(KEYS.outbox, JSON.stringify(events)); } catch { showToast("Device storage is full. Remove old photos and try again."); }
    outboxRef.current = events;
  }, [events, showToast]);

  useEffect(() => {
    persistRun();
  }, [persistRun]);

  useEffect(() => {
    if (!isBrowser) return undefined;
    let cancelled = false;
    fetch(`/api/routes/${encodeURIComponent(ROUTE.id)}`)
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Route request failed.");
        return payload;
      })
      .then((remoteRoute) => {
        if (cancelled || remoteRoute.id !== ROUTE.id || !remoteRoute.hub || !Array.isArray(remoteRoute.stops)) return;
        setRouteData(remoteRoute);
        const remoteStatuses = Object.fromEntries(remoteRoute.stops
          .filter((stop) => stop.status && stop.status !== "Pending")
          .map((stop) => [stop.id, stop.status]));
        if (remoteRoute.hub.status === "Completed") remoteStatuses[remoteRoute.hub.id] = "Completed";
        setStatuses((current) => ({ ...remoteStatuses, ...current }));
      })
      .catch((error) => {
        if (!cancelled) showToast(`Neon route unavailable; showing demo route. ${error.message}`);
      });
    return () => { cancelled = true; };
  }, [showToast]);

  useEffect(() => {
    if (!isBrowser || !driverId || !routeData.id) return undefined;
    let cancelled = false;
    const query = new URLSearchParams({ driver_id: driverId, route_id: routeData.id });
    fetch(`/driver/events?${query}`)
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Event request failed.");
        if (!Array.isArray(payload)) throw new Error("The events endpoint returned an invalid response.");
        return payload;
      })
      .then((remoteEvents) => {
        if (cancelled) return;
        setEvents((current) => {
          const merged = new Map(remoteEvents.map((event) => [event.event_id, { ...event, sync_status: "SYNCED" }]));
          current.forEach((event) => {
            if (event.sync_status === "PENDING" && !merged.has(event.event_id)) merged.set(event.event_id, event);
          });
          return [...merged.values()].sort((left, right) => Date.parse(left.timestamp) - Date.parse(right.timestamp));
        });
      })
      .catch((error) => {
        if (!cancelled) showToast(`Neon activity unavailable; showing device activity. ${error.message}`);
      });
    return () => { cancelled = true; };
  }, [driverId, routeData.id, showToast]);

  const flushOutbox = useCallback(async () => {
    const browserIsOnline = isNavigatorAvailable ? navigator.onLine : true;
    if (flushing.current || !(simulatorOnline && browserIsOnline)) return;
    flushing.current = true;
    setSyncing(true);
    try {
      for (const event of outboxRef.current) {
        if (event.sync_status !== "PENDING" || !(simulatorOnline && browserIsOnline)) continue;
        try {
          const response = await fetch("/driver/events", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(event)
          });
          if (!response.ok) {
            const payload = await response.json().catch(() => ({}));
            showToast(`Neon sync failed: ${payload.error || `HTTP ${response.status}`}`);
            break;
          }
          setEvents((current) => current.map((item) => item.event_id === event.event_id ? { ...item, sync_status: "SYNCED" } : item));
        } catch {
          showToast("Neon API is unavailable. Activity remains queued on this device.");
          break;
        }
      }
    } finally {
      flushing.current = false;
      setSyncing(false);
    }
  }, [showToast, simulatorOnline]);

  const appendEvent = useCallback((type, stop = currentStopRef.current, metadata = {}) => {
    const event = {
      event_id: makeId(),
      event_type: type,
      timestamp: new Date().toISOString(),
      driver_id: driverIdRef.current,
      route_id: routeRef.current.id,
      stop_id: stop?.id || null,
      order_id: stop?.orderId || null,
      latitude: metadata.latitude ?? stop?.latitude ?? 21.2514,
      longitude: metadata.longitude ?? stop?.longitude ?? 81.6296,
      metadata,
      sync_status: "PENDING"
    };
    setEvents((previous) => [...previous, event]);
    return event;
  }, []);

  useEffect(() => {
    if (online) flushOutbox();
  }, [online, flushOutbox, events.length]);

  useEffect(() => {
    if (!isBrowser) return undefined;
    const interval = window.setInterval(flushOutbox, 5000);
    const onOnline = () => setBrowserOnline(true);
    const onOffline = () => setBrowserOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [flushOutbox]);

  useEffect(() => {
    if (!isBrowser) return undefined;
    const interval = window.setInterval(() => setClock(new Date()), 60000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!isBrowser) return undefined;
    if (screen !== "active" || stage === "arrived") return undefined;
    const interval = window.setInterval(() => setEtaNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [screen, stage]);

  useEffect(() => {
    if (!photoUrl) return undefined;
    return () => URL.revokeObjectURL(photoUrl);
  }, [photoUrl]);

  useEffect(() => () => {
    if (typeof window !== "undefined") {
      window.clearTimeout(toastTimer.current);
      window.clearInterval(locationTimer.current);
    }
    if (photoUrl && typeof URL !== "undefined") URL.revokeObjectURL(photoUrl);
  }, [photoUrl]);

  useEffect(() => {
    const dialogs = [
      [podDialog.current, podOpen],
      [failureDialog.current, failureOpen],
      [registrationDialog.current, registrationOpen],
      [profileDialog.current, profileOpen]
    ];
    dialogs.forEach(([dialog, open]) => {
      if (!dialog) return;
      if (open && !dialog.open) dialog.showModal();
      if (!open && dialog.open) dialog.close();
    });
    if (podOpen) requestAnimationFrame(sizeCanvas);
  }, [podOpen, failureOpen, registrationOpen, profileOpen]);

  const switchScreen = (name) => setScreen(name);
  const buzz = (error = false) => {
    if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(error ? [70, 40, 70] : [100, 50, 100]);
  };

  const findProfile = (value) => {
    const profiles = readProfiles();
    return profiles[value.trim().toUpperCase()] || Object.values(profiles).find((item) => normalizePhone(item.phone) === normalizePhone(value));
  };

  const handleIdentifierChange = (value) => {
    setIdentifier(value);
    const found = findProfile(value);
    if (found) setLoginOtpHint(found.otp);
  };
  const [loginOtpHint, setLoginOtpHint] = useState(DEFAULT_PROFILE.otp);

  const applyProfile = (nextProfile) => {
    setProfile(nextProfile);
    setDriverId(nextProfile.driverId);
    setIdentifier(nextProfile.driverId);
    setLoginOtp(String(nextProfile.otp).padStart(4, "0").slice(-4));
    setLoginOtpHint(String(nextProfile.otp).padStart(4, "0").slice(-4));
    setProfileName(nextProfile.name);
    setProfilePhone(nextProfile.phone);
    setProfileVehicle(nextProfile.vehicle);
  };

  const startTelemetry = () => {
    if (typeof navigator !== "undefined" && "geolocation" in navigator) {
      navigator.geolocation.watchPosition(
        (position) => appendEvent("driver.location.updated", currentStopRef.current, {
          source: "gps",
          accuracy_m: Math.round(position.coords.accuracy),
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        }),
        () => startCoordinateEmitter(),
        { enableHighAccuracy: true, maximumAge: 30000, timeout: 8000 }
      );
    } else {
      startCoordinateEmitter();
    }
  };

  const startCoordinateEmitter = () => {
    if (locationTimer.current || typeof window === "undefined") return;
    const path = [
      { latitude: 21.2578, longitude: 81.6406 },
      { latitude: 21.2582, longitude: 81.6631 },
      { latitude: 21.2416, longitude: 81.6672 },
      { latitude: 21.2619, longitude: 81.6384 },
      { latitude: 21.2478, longitude: 81.6509 }
    ];
    let segment = 0;
    let fraction = 0;
    locationTimer.current = window.setInterval(() => {
      const start = path[segment];
      const end = path[(segment + 1) % path.length];
      fraction += 0.2;
      if (fraction >= 1) { fraction = 0; segment = (segment + 1) % path.length; }
      const next = path[(segment + 1) % path.length];
      appendEvent("driver.location.updated", currentStopRef.current, {
        source: "simulated",
        latitude: start.latitude + (end.latitude - start.latitude) * fraction,
        longitude: start.longitude + (end.longitude - start.longitude) * fraction,
        next_latitude: next.latitude,
        next_longitude: next.longitude
      });
    }, 10000);
  };

  const signIn = async (event) => {
    event.preventDefault();
    const found = findProfile(identifier);
    if (!identifier.trim()) { showToast("Enter your driver ID or phone number."); return; }
    if (!found) { showToast("No local driver profile found. Register first or use DRV-104."); return; }
    if (loginOtp !== found.otp) { showToast("That passcode doesn't match the demo code shown above."); return; }
    if (!goOnline) { showToast("Go online to receive your assigned route."); return; }
    const selectedProfile = found;
    applyProfile(selectedProfile);
    setRouteStarted(true);
    persistRun({ driverId: selectedProfile.driverId, routeStarted: true });
    appendEvent("driver.shift.started", routeData.hub, { driver_id: selectedProfile.driverId, route_id: routeData.id });
    startTelemetry();
    setScreen("manifest");
  };

  const beginRoute = () => {
    const deadline = etaDeadline || Date.now() + 8 * 60 * 1000;
    setRouteStarted(true);
    setEtaDeadline(deadline);
    if (stopIndex > 0 && currentStop) setStatuses((current) => ({ ...current, [currentStop.id]: "Active" }));
    persistRun({ routeStarted: true, etaDeadline: deadline });
    setScreen("active");
  };

  const markArrived = () => {
    setStage("arrived");
    setEtaDeadline(null);
    appendEvent("stop.arrived", currentStop, { geofence_triggered: false, arrival_method: "driver_tap" });
    persistRun({ stage: "arrived", etaDeadline: null });
    showToast(stopIndex === 0 ? "Hub arrival saved on device." : "Arrival saved. Full address unlocked.");
  };

  const confirmPickup = () => {
    appendEvent("package.scanned", currentStop, { scan_method: "manual_confirm", package_count: routeData.stops.length });
    const nextStatuses = { ...statuses, [routeData.stops[0].id]: "Active" };
    setStatuses(nextStatuses);
    setStopIndex(1);
    setStage("en-route");
    const deadline = Date.now() + 8 * 60 * 1000;
    setEtaDeadline(deadline);
    persistRun({ currentStopIndex: 1, stage: "en-route", deliveryStatuses: nextStatuses, etaDeadline: deadline });
    showToast("Pickup confirmed. First delivery is ready.");
  };

  const openPod = () => {
    setPodOtp("");
    setPodSlider(0);
    setSignatureInk(false);
    inkRef.current = false;
    drawing.current = false;
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    setPhotoUrl("");
    setSelectedPhoto(null);
    if (photoInputRef.current) photoInputRef.current.value = "";
    if (canvasRef.current) {
      const canvas = canvasRef.current;
      const context = canvas.getContext("2d");
      context.clearRect(0, 0, canvas.width, canvas.height);
    }
    setPodOpen(true);
  };

  const openFailure = () => {
    setFailureReason("");
    setFailureNotes("");
    setFailureSlider(0);
    setFailureOpen(true);
  };

  function sizeCanvas() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const bounds = canvas.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    const previous = inkRef.current ? canvas.toDataURL() : null;
    const ratio = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = Math.round(bounds.width * ratio);
    canvas.height = Math.round(bounds.height * ratio);
    const context = canvas.getContext("2d");
    context.scale(ratio, ratio);
    context.lineWidth = 2.5;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = "#163b30";
    canvasContext.current = context;
    if (previous) {
      const image = new Image();
      image.onload = () => context.drawImage(image, 0, 0, bounds.width, bounds.height);
      image.src = previous;
    }
  }

  const signaturePoint = (event) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
  };
  const startSignature = (event) => {
    if (!canvasContext.current) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = signaturePoint(event);
    canvasContext.current.beginPath();
    canvasContext.current.moveTo(point.x, point.y);
    drawing.current = true;
  };
  const drawSignature = (event) => {
    if (!drawing.current || !canvasContext.current) return;
    const point = signaturePoint(event);
    canvasContext.current.lineTo(point.x, point.y);
    canvasContext.current.stroke();
    if (!inkRef.current) {
      inkRef.current = true;
      setSignatureInk(true);
    }
  };
  const endSignature = () => { drawing.current = false; };
  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (canvas && canvasContext.current) canvasContext.current.clearRect(0, 0, canvas.width, canvas.height);
    inkRef.current = false;
    setSignatureInk(false);
    drawing.current = false;
  };

  const advanceAfterStop = (nextStatuses) => {
    if (stopIndex >= routeData.stops.length) {
      setRouteCompleted(true);
      setEtaDeadline(null);
      persistRun({ routeCompleted: true, etaDeadline: null, deliveryStatuses: nextStatuses });
      setScreen("done");
      return;
    }
    const nextIndex = stopIndex + 1;
    const deadline = Date.now() + 8 * 60 * 1000;
    const updatedStatuses = { ...nextStatuses, [routeData.stops[nextIndex - 1].id]: nextStatuses[routeData.stops[nextIndex - 1].id] };
    if (routeData.stops[nextIndex - 1]) updatedStatuses[routeData.stops[nextIndex - 1].id] = "Active";
    setStopIndex(nextIndex);
    setRouteCompleted(false);
    setStage("en-route");
    setEtaDeadline(deadline);
    setStatuses(updatedStatuses);
    persistRun({ currentStopIndex: nextIndex, routeCompleted: false, stage: "en-route", etaDeadline: deadline, deliveryStatuses: updatedStatuses });
  };

  const completeDelivery = () => {
    const nextStatuses = { ...statuses, [currentStop.id]: "Completed" };
    appendEvent("delivery.completed", currentStop, {
      photo_url: selectedPhoto ? `local://${encodeURIComponent(selectedPhoto.name)}` : null,
      otp_verified: true,
      signature_captured: true,
      failure_reason: null
    });
    setStatuses(nextStatuses);
    setPodOpen(false);
    buzz();
    advanceAfterStop(nextStatuses);
    showToast("Delivery completed. Proof saved on this device.");
  };

  const failDelivery = () => {
    if (!failureReason) { showToast("Choose a reason before confirming."); buzz(true); return; }
    const nextStatuses = { ...statuses, [currentStop.id]: "Failed" };
    appendEvent("delivery.failed", currentStop, {
      photo_url: null,
      otp_verified: false,
      failure_reason: failureReason,
      notes: failureNotes.trim() || null
    });
    setStatuses(nextStatuses);
    setFailureOpen(false);
    buzz(true);
    advanceAfterStop(nextStatuses);
    showToast("Delivery issue recorded. Dispatch can review it.");
  };

  const changeSimulator = () => {
    const next = !simulatorOnline;
    setSimulatorOnline(next);
    try { localStorage.setItem(KEYS.network, next ? "online" : "offline"); } catch { /* In-memory simulation remains available. */ }
  };

  const registerDriver = (event) => {
    event.preventDefault();
    const name = registerName.trim();
    const phone = normalizePhone(registerPhone);
    const vehicle = registerVehicle.trim().toUpperCase();
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
    const newProfile = { driverId: id, name, phone, vehicle, otp: String(Math.floor(1000 + Math.random() * 9000)) };
    profiles[id] = newProfile;
    try { localStorage.setItem(KEYS.profiles, JSON.stringify(profiles)); } catch {
      showToast("Could not save profile on this device.");
      return;
    }
    applyProfile(newProfile);
    setRegisterName("");
    setRegisterPhone("");
    setRegisterVehicle("");
    setRegistrationOpen(false);
    showToast(`Profile created. Demo sign-in code: ${newProfile.otp}`);
  };

  const saveProfile = (event) => {
    event.preventDefault();
    const name = profileName.trim();
    const phone = normalizePhone(profilePhone);
    const vehicle = profileVehicle.trim().toUpperCase();
    if (!name || phone.length !== 10 || !vehicle) { showToast("Enter a name, valid 10-digit mobile number, and vehicle number."); return; }
    const updated = { ...profile, name, phone, vehicle };
    const profiles = readProfiles();
    profiles[updated.driverId] = updated;
    try { localStorage.setItem(KEYS.profiles, JSON.stringify(profiles)); } catch {
      showToast("Could not save profile on this device.");
      return;
    }
    applyProfile(updated);
    setProfileStatus("Signed in for this shift. Changes save on this device.");
    persistRun({ driverId: updated.driverId });
    showToast("Driver profile saved on this device.");
  };

  const completed = routeData.stops.filter((stop) => statuses[stop.id] === "Completed");
  const initialsText = initials(profile.name);
  const navTarget = screen === "active" || screen === "done" ? "manifest" : screen;

  return (
    <>
      <div className="app-shell">
        <header className="topbar">
          <a className="brand" href="#" aria-label="Raipur Dispatch home" onClick={(event) => event.preventDefault()}>
            <span className="brand-mark" aria-hidden="true">R</span>
            <span className="brand-copy"><strong>RAHUL</strong><small>LAST MILE / DRIVER</small></span>
          </a>
          <div className="header-meta">
            <nav className={`screen-nav ${screen === "auth" ? "is-hidden" : ""}`} aria-label="Driver sections">
              <button type="button" data-screen="manifest" className={navTarget === "manifest" ? "is-selected" : ""} onClick={() => switchScreen("manifest")}>Route</button>
              <button type="button" data-screen="earnings" className={navTarget === "earnings" ? "is-selected" : ""} onClick={() => switchScreen("earnings")}>Earnings</button>
              <button type="button" data-screen="inbox" className={navTarget === "inbox" ? "is-selected" : ""} onClick={() => switchScreen("inbox")}>Inbox <span className="inbox-count">{pendingCount}</span></button>
            </nav>
            <span className={`shift-indicator ${screen !== "auth" && online ? "is-online" : ""}`}><i></i><span>{screen === "auth" ? "SHIFT NOT STARTED" : "SHIFT ACTIVE · 08:00"}</span></span>
            <button className="avatar" type="button" aria-label="Driver profile" onClick={() => {
              setProfileName(profile.name);
              setProfilePhone(profile.phone);
              setProfileVehicle(profile.vehicle);
              setProfileStatus(screen === "auth" ? "Profile is stored on this device." : "Signed in for this shift. Changes save on this device.");
              setProfileOpen(true);
            }}>{initialsText}</button>
          </div>
        </header>

        <div className="debug-bar" aria-label="Network simulator controls">
          <span className="debug-label"><span className="debug-dot"></span> NETWORK SIMULATOR</span>
          <span className="debug-copy">{online ? "Live network detection" : "Events will queue on device"}</span>
          <button className="network-toggle" type="button" aria-pressed={simulatorOnline} onClick={changeSimulator}>
            <span>Simulator {simulatorOnline ? "online" : "offline"}</span><span className="toggle-knob" aria-hidden="true"></span>
          </button>
        </div>

        <main id="app-main">
          {screen === "auth" && <Auth clock={clock} signIn={signIn} identifier={identifier} handleIdentifierChange={handleIdentifierChange} loginOtp={loginOtp} setLoginOtp={setLoginOtp} loginOtpHint={loginOtpHint} goOnline={goOnline} setGoOnline={setGoOnline} openRegistration={() => setRegistrationOpen(true)} />}
          {screen === "manifest" && <Manifest route={routeData} statuses={statuses} stopIndex={stopIndex} routeCompleted={routeCompleted} totalWeight={totalWeight} beginRoute={beginRoute} />}
          {screen === "active" && <ActiveRoute route={routeData} switchScreen={switchScreen} stopIndex={stopIndex} stage={stage} etaDeadline={etaDeadline} etaNow={etaNow} online={online} pendingCount={pendingCount} syncing={syncing} currentStop={currentStop} markArrived={markArrived} confirmPickup={confirmPickup} openPod={openPod} openFailure={openFailure} />}
          {screen === "done" && <CompletedRoute pendingCount={pendingCount} statuses={statuses} switchScreen={switchScreen} />}
          {screen === "earnings" && <Earnings route={routeData} completed={completed} />}
          {screen === "inbox" && <Inbox events={events} online={online} flushOutbox={flushOutbox} />}
        </main>

        <footer className="global-footer"><span>BUILT FOR THE LAST MILE</span><span>RAIPUR, CG <i></i> <span>{pendingCount} {pendingCount === 1 ? "EVENT" : "EVENTS"} QUEUED</span></span></footer>
      </div>

      <Registration dialogRef={registrationDialog} setOpen={setRegistrationOpen} submit={registerDriver} name={registerName} setName={setRegisterName} phone={registerPhone} setPhone={setRegisterPhone} vehicle={registerVehicle} setVehicle={setRegisterVehicle} />
      <Profile dialogRef={profileDialog} setOpen={setProfileOpen} submit={saveProfile} initialsText={initialsText} profile={profile} name={profileName} setName={setProfileName} phone={profilePhone} setPhone={setProfilePhone} vehicle={profileVehicle} setVehicle={setProfileVehicle} status={profileStatus} />
      <ProofOfDelivery dialogRef={podDialog} setOpen={setPodOpen} currentStop={currentStop} photoInputRef={photoInputRef} photoUrl={photoUrl} setSelectedPhoto={setSelectedPhoto} setPhotoUrl={setPhotoUrl} podOtp={podOtp} setPodOtp={setPodOtp} signatureInk={signatureInk} canvasRef={canvasRef} startSignature={startSignature} drawSignature={drawSignature} endSignature={endSignature} clearSignature={clearSignature} podSlider={podSlider} setPodSlider={setPodSlider} completeDelivery={completeDelivery} />
      <DeliveryException dialogRef={failureDialog} setOpen={setFailureOpen} failureReason={failureReason} setFailureReason={setFailureReason} setFailureSlider={setFailureSlider} failureNotes={failureNotes} setFailureNotes={setFailureNotes} failureSlider={failureSlider} failDelivery={failDelivery} />
      <div className={`toast ${toast ? "is-visible" : ""}`} role="status" aria-live="polite">{toast}</div>
    </>
  );
}

export default DriverApp;
