import { createRoot } from "react-dom/client";
import AppShell from "./components/AppShell.jsx";
import "./styles.css";

// Note: React.StrictMode removed to prevent double-mounting issues with Mapbox GL
const root = createRoot(document.getElementById("root"));
root.render(<AppShell />);
