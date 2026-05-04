import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createUniversalTypeScriptConfig } from "@labkit/eslint-config";

const tsconfigRootDir = dirname(fileURLToPath(import.meta.url));

export default createUniversalTypeScriptConfig({ tsconfigRootDir });
