import React from "react";
import ReactDOM from "react-dom/client";
import { FloatingPet } from "./FloatingPet";
import "./FloatingPet.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <FloatingPet />
  </React.StrictMode>,
);
