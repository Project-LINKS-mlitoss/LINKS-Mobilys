// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import "leaflet/dist/leaflet.css";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";

if (import.meta.env.VITE_ENV_MODE === "development") {
  (async () => {
    const { worker } = await import("./mocks/browser");
    worker.start();
  })();
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
);
