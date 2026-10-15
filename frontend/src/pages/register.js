import "../../assets/css/pages.css";

const form = document.querySelector("#register-form");
const message = document.querySelector("#form-message");
const submitButton = form.querySelector("button[type=submit]");

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  message.hidden = true;
  submitButton.disabled = true;
  const formData = new FormData(form);
  const phone = formData.get("phone").trim();

  try {
    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: formData.get("fullName"),
        email: formData.get("email"),
        phone: phone || null,
        password: formData.get("password")
      })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Unable to create your account.");
    window.location.assign("/earnings.html");
  } catch (error) {
    message.textContent = error.message;
    message.hidden = false;
  } finally {
    submitButton.disabled = false;
  }
});
