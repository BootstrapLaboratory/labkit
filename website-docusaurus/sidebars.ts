import type { SidebarsConfig } from "@docusaurus/plugin-content-docs";
import { buildSidebar } from "./src/lib/docsTree.mjs";

const sidebars = buildSidebar() satisfies SidebarsConfig;

export default sidebars;
