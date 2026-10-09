import React from "react";

export default function CompletedRoute({ pendingCount, statuses, switchScreen }) {
  return (
    <section className="screen done-screen" aria-labelledby="done-title">
      <div className="done-mark" aria-hidden="true">✓</div><p className="eyebrow">RUN COMPLETE · RAIPUR</p><h1 id="done-title">Every stop,<br /><em>accounted for.</em></h1>
      <p className="done-copy">{pendingCount ? "Your route is complete. Events are safely queued on this device until a connection is available." : "Your route is complete. All route events are saved on this device."}</p>
      <div className="done-summary"><div><strong>{Object.values(statuses).filter((value) => value === "Completed").length}</strong><span>DELIVERED</span></div><div><strong>{Object.values(statuses).filter((value) => value === "Failed").length}</strong><span>ISSUES</span></div><div><strong>{pendingCount}</strong><span>QUEUED</span></div></div>
      <button className="button button-primary button-wide" type="button" onClick={() => switchScreen("manifest")}>View route summary <span className="button-arrow" aria-hidden="true">→</span></button>
    </section>
  );
}
