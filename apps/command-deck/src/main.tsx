import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { initAI } from "./ai/provider";
import { recoverInterruptedWork } from "./core/engine";
import "./styles.css";

// Persisted stores hydrate synchronously from localStorage; simulated work that
// was mid-flight when the page closed is marked failed so it can be retried.
recoverInterruptedWork();
void initAI();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
