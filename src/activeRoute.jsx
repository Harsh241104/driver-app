import React from "react";

export default function ActiveRoute({ route, switchScreen, stopIndex, stage, etaDeadline, etaNow, online, pendingCount, syncing, currentStop, markArrived, confirmPickup, openPod, openFailure }) {
  const secondsLeft = Math.max(0, Math.ceil(((etaDeadline || (etaNow + 8 * 60 * 1000)) - etaNow) / 1000));
  const position = stage === "arrived" ? 2 : stopIndex === 0 ? 0 : 1;
  return (
    <section className="screen active-screen" aria-labelledby="active-title">
      <div className="active-topline">
        <button className="back-button" type="button" aria-label="Back to route manifest" onClick={() => switchScreen("manifest")}>←</button>
        <div className="stop-counter"><span className="eyebrow">ACTIVE RUN</span><strong>STOP {stopIndex + 1} <span>OF {route.stops.length + 1}</span></strong></div>
        <div className="eta-block"><span className="eyebrow">ETA COUNTDOWN</span><strong>{stage === "arrived" ? "AT DESTINATION" : `${String(Math.floor(secondsLeft / 60)).padStart(2, "0")}:${String(secondsLeft % 60).padStart(2, "0")} LEFT`}</strong></div>
        <div className={`connectivity-pill ${!online ? "is-offline" : syncing ? "is-syncing" : ""}`} aria-live="polite"><span className="connectivity-dot"></span><span>{!online ? `Offline · ${pendingCount} queued` : syncing ? `Syncing · ${pendingCount} queued` : pendingCount ? `Online · ${pendingCount} queued` : "Online · Synced"}</span></div>
      </div>
      <div className="route-progress"><span style={{ width: `${stopIndex === 0 ? (stage === "arrived" ? 8 : 0) : Math.min(100, 15 + (stopIndex - 1) / route.stops.length * 80 + (stage === "arrived" ? 10 : 0))}%` }}></span></div>
      <div className="stepper" aria-label="Delivery progress">
        {["Pickup", "Drop", "Arrived", "POD"].map((label, index) => (
          <React.Fragment key={label}>{index > 0 && <span className="step-connector"></span>}<div className={`step-item ${index === position ? "is-current" : ""} ${index < position ? "is-complete" : ""}`}><span className="step-node">{String(index + 1).padStart(2, "0")}</span><span className="step-name">{label}</span></div></React.Fragment>
        ))}
      </div>
      <div className="stop-type-row"><span className="stop-type">{stopIndex === 0 ? "PICKUP · HUB" : "CUSTOMER DROP"}</span><span className="stop-sequence-label">{stopIndex === 0 ? "ORIGIN / 01" : `DELIVERY / ${String(stopIndex).padStart(2, "0")}`}</span></div>
      <article className="delivery-card">
        <div className="delivery-card-head"><div><p className="eyebrow">{stopIndex === 0 ? "COLLECTION POINT" : `DELIVER TO · ${currentStop.name.toUpperCase()}`}</p><h1 id="active-title">{stopIndex === 0 ? currentStop.name : currentStop.locality}<span className="title-period">.</span></h1></div><span className="parcel-icon" aria-hidden="true">▧</span></div>
        <div className="location-row"><span className="pin-icon" aria-hidden="true">⌖</span><div><strong>{stopIndex === 0 ? currentStop.locality : `${currentStop.locality} · ${currentStop.landmark}`}</strong><span>{stopIndex === 0 ? "Raipur Central Distribution Hub" : "Raipur, Chhattisgarh"}</span></div></div>
        {stage === "arrived" && stopIndex > 0 && <div className="address-reveal"><span className="address-lock" aria-hidden="true">⌖</span><div><span className="eyebrow">FULL DELIVERY ADDRESS</span><strong>{currentStop.address}</strong></div></div>}
        {stopIndex > 0 && <div className="parcel-details"><div><span className="detail-label">PARCEL</span><strong>#{currentStop.orderRef || currentStop.orderId}</strong></div><div><span className="detail-label">WEIGHT</span><strong>{currentStop.weight.toFixed(1)} kg</strong></div><div><span className="detail-label">WINDOW</span><strong>{currentStop.window}</strong></div></div>}
        <div className="instruction-badge"><span aria-hidden="true">✳</span><span>{currentStop.instructions || "Scan all parcels before leaving the hub."}</span></div>
      </article>
      <a className="button button-map button-wide" href={`https://www.google.com/maps/dir/?api=1&destination=${currentStop.latitude},${currentStop.longitude}`} target="_blank" rel="noopener"><span className="map-glyph" aria-hidden="true">↗</span><span>Open in Google Maps</span></a>
      <div className="action-panel">
        {stage !== "arrived" ? <button className="button button-primary button-wide" type="button" onClick={markArrived}><span>{stopIndex === 0 ? "I've Arrived at the Hub" : "I've Arrived"}</span><span className="button-arrow" aria-hidden="true">→</span></button> : stopIndex === 0
          ? <button className="button button-primary button-wide" type="button" onClick={confirmPickup}><span>Scan &amp; Confirm Pickup</span><span className="button-arrow" aria-hidden="true">→</span></button>
          : <><button className="button button-primary button-wide" type="button" onClick={openPod}><span>Capture Proof of Delivery (POD)</span><span className="button-arrow" aria-hidden="true">→</span></button><button className="button button-soft-danger button-wide" type="button" onClick={openFailure}><span>Report Delivery Issue</span><span aria-hidden="true">↗</span></button></>}
      </div>
      <p className="offline-caption"><span className="save-check" aria-hidden="true">✓</span> Actions save instantly on this device</p>
    </section>
  );
}
