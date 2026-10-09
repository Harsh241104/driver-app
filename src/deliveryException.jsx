import React from "react";
import { FAILURE_REASONS } from "./route.js";

export default function DeliveryException({ dialogRef, setOpen, failureReason, setFailureReason, setFailureSlider, failureNotes, setFailureNotes, failureSlider, failDelivery }) {
  return (
    <dialog className="modal exception-modal" ref={dialogRef} aria-labelledby="failure-title" onClick={(event) => { if (event.target === event.currentTarget) setOpen(false); }} onClose={() => setOpen(false)}>
      <div className="modal-head"><div><p className="eyebrow eyebrow-danger">DELIVERY EXCEPTION</p><h2 id="failure-title">Report an issue</h2></div><button className="modal-close" type="button" onClick={() => setOpen(false)} aria-label="Close delivery issue">×</button></div>
      <div className="modal-body">
        <fieldset className="reason-list"><legend>Why couldn't this be delivered?</legend>
          {FAILURE_REASONS.map(([value, label, detail]) => <label className="reason-option" key={value}><input type="radio" name="failure-reason" value={value} checked={failureReason === value} onChange={() => { setFailureReason(value); setFailureSlider(0); }} /><span className="radio-mark"></span><span>{label}<small>{detail}</small></span></label>)}
        </fieldset>
        <label className="modal-field notes-field" htmlFor="failure-notes">Notes <span className="optional-label">OPTIONAL</span><textarea id="failure-notes" className="text-input" rows="3" maxLength="240" placeholder="Add helpful context for dispatch..." value={failureNotes} onChange={(event) => setFailureNotes(event.target.value)} /></label>
        <div className="confirm-section confirm-danger"><div className="confirm-label"><span>HOLD &amp; SLIDE · CONFIRM DELIVERY FAILED</span><span>{failureReason ? "Ready to confirm" : "Choose a reason first"}</span></div><input className="confirm-slider" type="range" min="0" max="100" value={failureSlider} disabled={!failureReason} aria-label="Slide to confirm delivery issue" onChange={(event) => {
          const value = Number(event.target.value);
          if (value >= 94) { setFailureSlider(0); failDelivery(); } else setFailureSlider(value);
        }} /><p className="modal-footnote">The parcel will be marked failed and dispatch notified.</p></div>
      </div>
    </dialog>
  );
}
