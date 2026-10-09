import React from "react";

export default function Profile({ dialogRef, setOpen, submit, initialsText, profile, name, setName, phone, setPhone, vehicle, setVehicle, status }) {
  return (
    <dialog className="modal account-modal" ref={dialogRef} aria-labelledby="profile-title" onClick={(event) => { if (event.target === event.currentTarget) setOpen(false); }} onClose={() => setOpen(false)}>
      <div className="modal-head"><div><p className="eyebrow">DRIVER ACCOUNT</p><h2 id="profile-title">Your profile</h2></div><button className="modal-close" type="button" onClick={() => setOpen(false)} aria-label="Close driver profile">×</button></div>
      <form className="modal-body account-form" onSubmit={submit} noValidate>
        <div className="profile-id-row"><span className="profile-avatar">{initialsText}</span><span><strong>{profile.driverId}</strong><small>RAIPUR DRIVER</small></span></div>
        <label className="account-field" htmlFor="profile-name">Full name<input className="text-input" id="profile-name" autoComplete="name" required value={name} onChange={(event) => setName(event.target.value)} /></label>
        <label className="account-field" htmlFor="profile-phone">Mobile number<input className="text-input" id="profile-phone" type="tel" inputMode="tel" autoComplete="tel" required value={phone} onChange={(event) => setPhone(event.target.value)} /></label>
        <label className="account-field" htmlFor="profile-vehicle">Vehicle / registration number<input className="text-input" id="profile-vehicle" autoComplete="off" required value={vehicle} onChange={(event) => setVehicle(event.target.value)} /></label>
        <button className="button button-primary button-wide" type="submit">Save profile</button>
        <p className="profile-status">{status}</p>
      </form>
    </dialog>
  );
}
