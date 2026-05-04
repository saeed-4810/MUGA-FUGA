import "./styles/index.css";
import "./i18n";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";

import { initSentry } from "./lib/sentry";
import { reportWebVitals } from "./lib/web-vitals";
import { router } from "./routes/router";

initSentry();

const container = document.getElementById("root");
if (!container) throw new Error("Root container #root not found");
createRoot(container).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
);

reportWebVitals();
