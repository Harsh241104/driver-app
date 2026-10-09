import React from "react";

export default function ProofOfDelivery({ dialogRef, setOpen, currentStop, photoInputRef, photoUrl, setSelectedPhoto, setPhotoUrl, podOtp, setPodOtp, signatureInk, canvasRef, startSignature, drawSignature, endSignature, clearSignature, podSlider, setPodSlider, completeDelivery }) {
  return (
    <dialog className="modal" ref={dialogRef} aria-labelledby="pod-title" onClick={(event) => { if (event.target === event.currentTarget) setOpen(false); }} onClose={() => setOpen(false)}>
      <div className="modal-head"><div><p className="eyebrow">PROOF OF DELIVERY</p><h2 id="pod-title">Close this stop</h2></div><button className="modal-close" type="button" onClick={() => setOpen(false)} aria-label="Close proof of delivery">×</button></div>
      <div className="modal-body">
        <label className="upload-zone" htmlFor="pod-photo"><span className="upload-icon" aria-hidden="true">＋</span><strong>Capture parcel or doorstep</strong><small>Camera opens on supported devices · Optional</small><input ref={photoInputRef} id="pod-photo" type="file" accept="image/*" capture="environment" onChange={(event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          if (photoUrl) URL.revokeObjectURL(photoUrl);
          setSelectedPhoto(file);
          setPhotoUrl(URL.createObjectURL(file));
        }} /></label>
        {photoUrl && <img className="photo-preview" src={photoUrl} alt="Captured proof of delivery preview" />}
        <div className="modal-field"><div className="field-label-row"><label htmlFor="delivery-otp">Customer delivery OTP</label><span className="field-hint">TEST OTP: {currentStop.otp}</span></div><input className="text-input" id="delivery-otp" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength="4" placeholder="Enter 4-digit code" value={podOtp} onChange={(event) => { setPodOtp(event.target.value.replace(/\D/g, "").slice(0, 4)); setPodSlider(0); }} /></div>
        <div className="signature-heading"><div><label>Customer signature</label><small>Ask the customer to sign below</small></div><button className="text-button" type="button" onClick={clearSignature}>Clear</button></div>
        <div className="signature-wrap"><canvas ref={canvasRef} aria-label="Signature drawing area" onPointerDown={startSignature} onPointerMove={drawSignature} onPointerUp={endSignature} onPointerCancel={endSignature} /><span className={`signature-placeholder ${signatureInk ? "is-hidden" : ""}`}>SIGN HERE</span></div>
        <div className="confirm-section"><div className="confirm-label"><span>HOLD &amp; SLIDE · COMPLETE DELIVERY</span><span>{podOtp === currentStop.otp && signatureInk ? "Ready to confirm" : podOtp !== currentStop.otp ? "Enter the customer's 4-digit OTP" : "Customer signature required"}</span></div><input className="confirm-slider" type="range" min="0" max="100" value={podSlider} disabled={podOtp !== currentStop.otp || !signatureInk} aria-label="Slide to complete delivery" onChange={(event) => {
          const value = Number(event.target.value);
          if (value >= 94) { setPodSlider(0); completeDelivery(); } else setPodSlider(value);
        }} /><p className="modal-footnote">This records proof on your device, even without signal.</p></div>
      </div>
    </dialog>
  );
}
