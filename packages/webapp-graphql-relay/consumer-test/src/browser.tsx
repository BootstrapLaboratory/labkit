import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createFixtureTree } from "./app";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Fixture root element was not found.");
}

const fixture = createFixtureTree();
createRoot(rootElement).render(<StrictMode>{fixture.tree}</StrictMode>);
