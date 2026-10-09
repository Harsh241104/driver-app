import React from "react";

export default function Auth({ clock, signIn, identifier, handleIdentifierChange, loginOtp, setLoginOtp, loginOtpHint, goOnline, setGoOnline, openRegistration }) {
  return (
    <section className="screen auth-screen" aria-labelledby="auth-title">
      <div className="auth-aside">
        <p className="eyebrow">RAIPUR · CHHATTISGARH <span className="eyebrow-line"></span></p>
        <h1 id="auth-title">Every delivery,<br /><em>accounted for.</em></h1>
        <p className="intro-copy">Your route, your proof, your pace. Sign in to bring today's run online.</p>
        <div className="weather-line"><span className="sun-icon" aria-hidden="true">☀</span><span><strong>32°</strong> Raipur · Clear skies</span><span className="weather-time">{new Intl.DateTimeFormat("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" }).format(clock)}</span></div>
      </div>
      <div className="auth-card">
        <div className="card-heading"><div><p className="eyebrow">DRIVER ACCESS</p><h2>Start your shift</h2></div><span className="card-step">01 <span>/ 03</span></span></div>
        <form onSubmit={signIn} noValidate>
          <label htmlFor="driver-id">Driver ID or phone number</label>
          <div className="input-wrap"><span className="input-prefix" aria-hidden="true">ID</span><input id="driver-id" name="driver-id" autoComplete="username" inputMode="text" value={identifier} required onChange={(event) => handleIdentifierChange(event.target.value)} /></div>
          <div className="field-label-row"><label htmlFor="login-otp-1">One-time passcode</label><span className="field-hint">DEMO CODE: {loginOtpHint}</span></div>
          <div className="otp-row" aria-label="4 digit one-time passcode">
            {Array.from({ length: 4 }, (_, index) => (
              <input key={index} className="otp-box" id={index === 0 ? "login-otp-1" : undefined} aria-label={`Passcode digit ${index + 1}`} inputMode="numeric" maxLength="1" value={loginOtp[index] === " " ? "" : loginOtp[index] || ""} onChange={(event) => {
                const digit = event.target.value.replace(/\D/g, "").slice(-1);
                setLoginOtp((old) => {
                  const digits = old.padEnd(4, " ").slice(0, 4).split("");
                  digits[index] = digit || " ";
                  return digits.join("");
                });
                if (digit) event.target.nextElementSibling?.focus();
              }} onKeyDown={(event) => {
                if (event.key === "Backspace" && (!loginOtp[index] || loginOtp[index] === " ")) event.target.previousElementSibling?.focus();
              }} />
            ))}
          </div>
          <div className="online-choice"><div className="online-copy"><span className="online-light"></span><span><strong>Ready to go online</strong><small>Receive your assigned route</small></span></div><label className="switch" aria-label="Go online"><input type="checkbox" checked={goOnline} onChange={(event) => setGoOnline(event.target.checked)} /><span className="switch-track"></span></label></div>
          <button className="button button-primary button-wide" type="submit"><span>Start shift</span><span className="button-arrow" aria-hidden="true">→</span></button>
          <p className="privacy-note"><span aria-hidden="true">▣</span> Your shift events save on this device, even offline.</p>
          <p className="register-prompt">New to the driver app? <button type="button" className="text-button" onClick={openRegistration}>Register as a driver</button></p>
        </form>
      </div>
      <footer className="screen-foot"><span>DISPATCH SYSTEMS</span><span>BUILD 2.4.1 · RAIPUR</span></footer>
    </section>
  );
}
