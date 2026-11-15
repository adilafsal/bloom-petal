import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./globals.css";
import "./site-refinement.css";
import "./site-responsive.css";
import "./motion.css";
import "./typography.css";

if ("scrollRestoration" in history) {
  history.scrollRestoration = "manual";
}

createRoot(document.getElementById("root")!).render(<App />);