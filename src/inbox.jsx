import React from "react";
import { EVENT_COPY } from "./route.js";

export default function Inbox({ events, online, flushOutbox }) {
  return (
    <section className="screen data-screen" aria-labelledby="inbox-title">
      <div className="page-head"><div><p className="eyebrow">SHIFT UPDATES <span className="eyebrow-line"></span> RAIPUR</p><h1 id="inbox-title">Inbox<span className="title-period">.</span></h1></div><button className="button button-secondary inbox-refresh" type="button" onClick={flushOutbox}>Refresh</button></div>
      <div className="inbox-status"><span className="connectivity-dot"></span><span>{online ? "Device activity · network available" : "Device activity · offline queue active"}</span></div>
      <div className="section-head"><div><p className="eyebrow">DISPATCH + DEVICE</p><h2>Recent activity</h2></div><span className="list-caption">{String(events.length).padStart(2, "0")} UPDATES</span></div>
      <ol className="inbox-list">{events.length ? events.slice().reverse().map((item) => {
        const [title, message] = EVENT_COPY[item.event_type] || [item.event_type, "Driver activity recorded."];
        const queued = item.sync_status === "PENDING";
        const timestamp = new Date(item.timestamp).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
        return <li className="inbox-row" key={item.event_id}><span className={`inbox-icon ${queued ? "is-queued" : ""}`}>{queued ? "↥" : "✓"}</span><span className="inbox-message"><strong>{title}{item.order_id ? ` · ${item.order_id}` : ""}</strong><small>{message}</small><time>{timestamp}</time></span><span className={`inbox-event-status ${queued ? "is-queued" : ""}`}>{queued ? "QUEUED" : "SYNCED"}</span></li>;
      }) : <li className="empty-state"><span className="empty-state-mark">↥</span><strong>No activity yet</strong><small>Route and dispatch updates will appear here.</small></li>}</ol>
    </section>
  );
}
