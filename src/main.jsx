import React from "react";
import { createRoot } from "react-dom/client";
import DriverApp from "./DriverApp.jsx";
import "../styles.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <DriverApp />
  </React.StrictMode>
);
