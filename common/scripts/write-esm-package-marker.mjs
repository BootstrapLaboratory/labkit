import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const markerDirectory = path.resolve(process.cwd(), "dist/esm");

await mkdir(markerDirectory, { recursive: true });
await writeFile(
  path.join(markerDirectory, "package.json"),
  `${JSON.stringify({ type: "module" }, null, 2)}\n`,
);
