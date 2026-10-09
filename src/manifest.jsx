import React from "react";

export default function Manifest({ route, statuses, stopIndex, routeCompleted, totalWeight, beginRoute }) {
  return (
    <section className="screen manifest-screen" aria-labelledby="manifest-title">
      <div className="page-head"><div><p className="eyebrow">MONDAY, 05 OCTOBER <span className="eyebrow-line"></span> RUN 01</p><h1 id="manifest-title">Your route<span className="title-period">.</span></h1></div><span className="route-tag"><span className="route-tag-dot"></span> READY TO DEPART</span></div>
      <div className="manifest-summary">
        <div className="route-primary"><span className="summary-label">ROUTE MANIFEST</span><strong>{route.id}</strong><span className="route-start">Raipur Central Hub <span aria-hidden="true">→</span> City loop</span></div>
        <div className="summary-grid"><div className="summary-stat"><strong>{String(route.stops.length + 1).padStart(2, "0")}</strong><span>STOPS</span></div><div className="summary-stat"><strong>{totalWeight.toFixed(1)}<span> kg</span></strong><span>TOTAL LOAD</span></div><div className="summary-stat hub-stat"><strong>WH-RAIPUR</strong><span>PICKUP HUB</span></div></div>
      </div>
      <div className="section-head"><div><p className="eyebrow">IN ORDER OF VISIT</p><h2 id="stop-list-title">Stop sequence <span id="delivery-count">{String(route.stops.length).padStart(2, "0")} DELIVERIES</span></h2></div><span className="list-caption">{String(route.stops.length + 1).padStart(2, "0")} TOTAL STOPS</span></div>
      <ol className="manifest-list" aria-labelledby="stop-list-title">
        {[{ ...route.hub, isPickup: true }, ...route.stops.map((stop) => ({ ...stop, isPickup: false }))].map((stop, index) => {
          const status = stop.isPickup ? (stopIndex > 0 ? "Completed" : "Pickup") : (statuses[stop.id] || "Pending");
          const chipClass = status === "Completed" ? "is-complete" : status === "Failed" ? "is-failed" : status === "Active" ? "is-active" : "";
          return <li className={`manifest-row ${stop.isPickup ? "manifest-row--pickup" : ""}`} key={stop.id}>
            <span className="manifest-number">{String(index).padStart(2, "0")}</span>
            <span className="manifest-place"><strong>{stop.isPickup ? stop.name : stop.locality}</strong><span>{stop.isPickup ? stop.locality : `${stop.name} · ${stop.landmark}`}</span></span>
            <span className="manifest-meta"><strong>{stop.window}</strong><span>{stop.weight.toFixed(1)} kg</span></span>
            <span className={`status-chip ${chipClass}`}>{stop.isPickup && status === "Pickup" ? "PICKUP" : status.toUpperCase()}</span>
          </li>;
        })}
      </ol>
      <aside className="manifest-note"><span className="note-icon" aria-hidden="true">i</span><span>Pickup is first. Stops stay in sequence so every parcel is accounted for.</span></aside>
      <div className="sticky-action"><button className="button button-primary button-wide" disabled={routeCompleted} type="button" onClick={beginRoute}><span>{routeCompleted ? "Route complete" : "Start active route"}</span><span className="button-arrow" aria-hidden="true">→</span></button></div>
    </section>
  );
}
