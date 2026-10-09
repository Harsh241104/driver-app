import React from "react";

export default function Earnings({ route, completed }) {
  return (
    <section className="screen data-screen" aria-labelledby="earnings-title">
      <div className="page-head"><div><p className="eyebrow">DRIVER ACCOUNT <span className="eyebrow-line"></span> RAIPUR</p><h1 id="earnings-title">Earnings<span className="title-period">.</span></h1></div><span className="route-tag">TODAY · 05 OCT</span></div>
      <div className="earnings-total"><div><span className="summary-label">TODAY'S ESTIMATED PAY</span><strong>₹{(completed.length * 45).toLocaleString("en-IN")}</strong><small>Final amount confirmed after dispatch reconciliation</small></div><span className="earnings-coin" aria-hidden="true">₹</span></div>
      <div className="earning-metrics"><div><span>DELIVERY PAY</span><strong>₹{(completed.length * 45).toLocaleString("en-IN")}</strong></div><div><span>COMPLETED STOPS</span><strong>{completed.length}</strong></div><div><span>ROUTE</span><strong>{route.id}</strong></div></div>
      <div className="section-head"><div><p className="eyebrow">SHIFT ACTIVITY</p><h2>Completed orders</h2></div><span className="list-caption">TODAY</span></div>
      <ol className="earning-list">{completed.length ? completed.map((stop) => <li className="earning-row" key={stop.id}><span className="earning-check">✓</span><span className="earning-order"><strong>#{stop.orderRef || stop.orderId}</strong><small>{stop.locality} · {stop.name}</small></span><span className="earning-amount">₹45</span></li>) : <li className="empty-state"><span className="empty-state-mark">₹</span><strong>No completed orders yet</strong><small>Completed stops will appear here.</small></li>}</ol>
      <p className="data-disclaimer">Demo estimate only. A connected dispatch service is required for actual payout data.</p>
    </section>
  );
}
