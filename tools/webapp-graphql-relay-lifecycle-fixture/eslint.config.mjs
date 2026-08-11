import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createNodeBrowserTypeScriptConfig } from "@omgjs/labkit-eslint-config";

const tsconfigRootDir = dirname(fileURLToPath(import.meta.url));

export default createNodeBrowserTypeScriptConfig({
  extraIgnores: [
    "dist-browser/**",
    "playwright-report/**",
    "test-results/**",
    "vite.config.mts",
    "vitest.config.mts",
  ],
  tsconfigRootDir,
});
