import "../../assets/css/pages.css";

const form = document.querySelector("#login-form");
const message = document.querySelector("#form-message");
const submitButton = form.querySelector("button[type=submit]");

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  message.hidden = true;
  submitButton.disabled = true;
  const formData = new FormData(form);

  try {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: formData.get("email"),
        password: formData.get("password")
      })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Unable to sign in.");
    window.location.assign("/earnings.html");
  } catch (error) {
    message.textContent = error.message;
    message.hidden = false;
  } finally {
    submitButton.disabled = false;
  }
});
