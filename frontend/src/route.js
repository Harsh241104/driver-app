export const ROUTE = {
  id: "RT-RAIPUR-104",
  hub: {
    id: "STP-00",
    name: "WH-RAIPUR",
    locality: "Pandri · Near Great Eastern Road",
    address: "Central Distribution Hub, Great Eastern Road, Pandri, Raipur, Chhattisgarh",
    latitude: 21.2578,
    longitude: 81.6406,
    window: "08:00 – 08:30",
    weight: 9.9
  },
  stops: [
    { id: "STP-01", orderId: "ORD-7890", name: "Ananya Sharma", locality: "Shankar Nagar", landmark: "Near City Centre Mall", address: "Flat 302, Shreeji Residency, Shankar Nagar Main Road, Raipur, Chhattisgarh 492007", window: "09:00 – 09:30", weight: 2.4, latitude: 21.2582, longitude: 81.6631, instructions: "Call on arrival · Leave at security gate", otp: "2468" },
    { id: "STP-02", orderId: "ORD-7891", name: "Rohit Verma", locality: "Telibandha", landmark: "Near Marine Drive", address: "House 18, Sector 2, Telibandha, beside Marine Drive, Raipur, Chhattisgarh 492001", window: "10:00 – 10:30", weight: 1.8, latitude: 21.2416, longitude: 81.6672, instructions: "Call on arrival · Ring bell twice", otp: "1357" },
    { id: "STP-03", orderId: "ORD-7892", name: "Meera Agrawal", locality: "Pandri", landmark: "Behind City Centre Mall", address: "B-14, Shyam Plaza Lane, near City Centre Mall, Pandri, Raipur, Chhattisgarh 492004", window: "11:00 – 11:30", weight: 3.1, latitude: 21.2619, longitude: 81.6384, instructions: "Hand over to recipient only", otp: "8642" },
    { id: "STP-04", orderId: "ORD-7893", name: "Dev Patel", locality: "Civil Lines", landmark: "Near Collectorate Garden", address: "House 6, Katora Talab Road, near Collectorate Garden, Civil Lines, Raipur, Chhattisgarh 492001", window: "12:00 – 13:00", weight: 2.7, latitude: 21.2478, longitude: 81.6509, instructions: "Please call before entering the building", otp: "5791" }
  ]
};

export const DEFAULT_PROFILE = { driverId: "DRV-104", name: "Arjun Sahu", phone: "9876543210", vehicle: "CG 04 AB 1040", otp: "1042" };

export const FAILURE_REASONS = [
  ["Customer Unreachable / Phone Switched Off", "Customer unreachable", "Phone switched off"],
  ["Incorrect / Incomplete Address", "Address issue", "Incorrect or incomplete"],
  ["Customer Refused / Package Damaged", "Refused or damaged", "Customer refused / package damaged"],
  ["Premises Closed / Gated Access Denied", "Access unavailable", "Premises closed / gated access denied"]
];

export const EVENT_COPY = {
  "driver.shift.started": ["Shift started", "Route manifest loaded for Raipur."],
  "stop.arrived": ["Arrival recorded", "Your arrival was saved on this device."],
  "package.scanned": ["Pickup confirmed", "Parcels confirmed at WH-RAIPUR."],
  "delivery.completed": ["Delivery completed", "Proof of delivery saved locally."],
  "delivery.failed": ["Delivery issue reported", "Your exception report is saved locally."],
  "driver.location.updated": ["Location update", "Driver coordinates added to the sync queue."]
};

export const KEYS = {
  outbox: "raipur_driver_event_outbox_v1",
  run: "raipur_driver_run_v1",
  profiles: "raipur_driver_profiles_v1",
  network: "raipur_driver_network_simulator"
};

export function readJson(key, fallback) {
  try {
    if (typeof localStorage === "undefined") return fallback;
    const value = JSON.parse(localStorage.getItem(key) || "null");
    return value == null ? fallback : value;
  } catch {
    return fallback;
  }
}

export function readProfiles() {
  return { [DEFAULT_PROFILE.driverId]: DEFAULT_PROFILE, ...readJson(KEYS.profiles, {}) };
}

export function normalizePhone(value) {
  return value.replace(/\D/g, "").slice(-10);
}

export function initials(name = "") {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "DR";
}

export function makeId() {
  return globalThis.crypto?.randomUUID?.() || "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (character) => {
    const random = Math.random() * 16 | 0;
    return (character === "x" ? random : (random & 3 | 8)).toString(16);
  });
}
