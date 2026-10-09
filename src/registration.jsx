import React from "react";

export default function Registration({ dialogRef, setOpen, submit, name, setName, phone, setPhone, vehicle, setVehicle }) {
  return (
    <dialog className="modal account-modal" ref={dialogRef} aria-labelledby="registration-title" onClick={(event) => { if (event.target === event.currentTarget) setOpen(false); }} onClose={() => setOpen(false)}>
      <div className="modal-head"><div><p className="eyebrow">DRIVER ONBOARDING</p><h2 id="registration-title">Create your driver profile</h2></div><button className="modal-close" type="button" onClick={() => setOpen(false)} aria-label="Close registration">×</button></div>
      <form className="modal-body account-form" onSubmit={submit} noValidate>
        <p className="account-intro">Your details stay on this device in this demo. Registration is available offline.</p>
        <label className="account-field" htmlFor="register-name">Full name<input className="text-input" id="register-name" autoComplete="name" required placeholder="e.g. Arjun Sahu" value={name} onChange={(event) => setName(event.target.value)} /></label>
        <label className="account-field" htmlFor="register-phone">Mobile number<input className="text-input" id="register-phone" type="tel" inputMode="tel" autoComplete="tel" required maxLength="16" placeholder="10-digit mobile number" value={phone} onChange={(event) => setPhone(event.target.value)} /></label>
        <label className="account-field" htmlFor="register-vehicle">Vehicle / registration number<input className="text-input" id="register-vehicle" autoComplete="off" required placeholder="e.g. CG 04 AB 1234" value={vehicle} onChange={(event) => setVehicle(event.target.value)} /></label>
        <button className="button button-primary button-wide" type="submit">Create driver profile <span className="button-arrow" aria-hidden="true">→</span></button>
        <p className="account-footnote">A demo sign-in code will be generated locally. No SMS is sent.</p>
      </form>
    </dialog>
  );
}
