import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/bungee/400.css";
import "@fontsource-variable/bricolage-grotesque";
import "@fontsource-variable/martian-mono";
import "./styles.css";
import App from "./App.tsx";
import { track } from "./lib/analytics.ts";

track("pageview");

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
