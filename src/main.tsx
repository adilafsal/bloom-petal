import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./globals.css";
import "./site-refinement.css";
import "./site-responsive.css";

createRoot(document.getElementById("root")!).render(<App />);
