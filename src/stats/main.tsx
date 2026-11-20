import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/bungee/400.css";
import "@fontsource-variable/bricolage-grotesque";
import "@fontsource-variable/martian-mono";
import "../styles.css";
import "./stats.css";
import { StatsApp } from "./StatsApp.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <StatsApp />
  </StrictMode>,
);
