import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Workspace } from "@/components/editor/workspace";
import "./styles.css";

const root = document.getElementById("root");
if (!root) {
  throw new Error("Missing #root");
}

createRoot(root).render(
  <StrictMode>
    <Workspace />
  </StrictMode>,
);
