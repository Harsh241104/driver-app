import "../../assets/css/pages.css";

const welcome = document.querySelector("#welcome");
const message = document.querySelector("#page-message");
const total = document.querySelector("#total-earned");
const count = document.querySelector("#delivery-count");
const list = document.querySelector("#earnings-list");
const signOutButton = document.querySelector("#sign-out");
const currency = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" });
const dateFormat = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" });

function addCell(row, value) {
  const cell = document.createElement("td");
  cell.textContent = value ?? "—";
  row.append(cell);
}

async function loadEarnings() {
  try {
    const sessionResponse = await fetch("/api/auth/me");
    if (sessionResponse.status === 401) {
      welcome.textContent = "Sign in to review earnings linked to your completed deliveries.";
      message.textContent = "You are not signed in. ";
      for (const [label, href] of [["Sign in", "/login.html"], ["create an account", "/register.html"]]) {
        const link = document.createElement("a");
        link.href = href;
        link.textContent = label;
        message.append(link);
        if (href === "/login.html") message.append(" or ");
        else message.append(".");
      }
      return;
    }
    const session = await sessionResponse.json();
    if (!sessionResponse.ok) throw new Error(session.error || "Unable to load your account.");

    signOutButton.hidden = false;
    welcome.textContent = `Signed in as ${session.user.fullName}.`;
    const response = await fetch("/api/earnings");
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Unable to load earnings.");

    total.textContent = currency.format(result.summary.totalAmount);
    count.textContent = `${result.summary.deliveryCount} completed ${result.summary.deliveryCount === 1 ? "delivery" : "deliveries"}`;
    if (result.earnings.length === 0) {
      message.textContent = "No completed deliveries have been recorded yet.";
      return;
    }

    for (const earning of result.earnings) {
      const row = document.createElement("tr");
      addCell(row, earning.merchant_order_ref);
      addCell(row, earning.recipient_name);
      addCell(row, earning.locality);
      addCell(row, currency.format(Number(earning.amount)));
      addCell(row, earning.status);
      addCell(row, dateFormat.format(new Date(earning.earned_at)));
      list.append(row);
    }
  } catch (error) {
    message.textContent = error.message;
  }
}

signOutButton.addEventListener("click", async () => {
  signOutButton.disabled = true;
  try {
    const response = await fetch("/api/auth/logout", { method: "POST" });
    if (!response.ok) {
      const result = await response.json();
      throw new Error(result.error || "Unable to sign out.");
    }
    window.location.assign("/login.html");
  } catch (error) {
    message.textContent = error.message;
    signOutButton.disabled = false;
  }
});

loadEarnings();
