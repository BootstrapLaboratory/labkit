import assert from "node:assert/strict";
import { readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const LABKIT_PACKAGE = "@omgjs/labkit-webapp-graphql-relay";
const resolvedEntry = realpathSync(
  fileURLToPath(import.meta.resolve(LABKIT_PACKAGE)),
);
const normalizedEntry = resolvedEntry.replaceAll("\\", "/");

assert.match(
  normalizedEntry,
  /\/dist\/esm\/src\/index\.js$/,
  `exports.import resolved to an unexpected entry: ${resolvedEntry}`,
);

const esmPackageMarkerPath = path.resolve(
  path.dirname(resolvedEntry),
  "..",
  "package.json",
);
const esmPackageMarker = JSON.parse(
  readFileSync(esmPackageMarkerPath, "utf8"),
) as { type?: string };
assert.equal(
  esmPackageMarker.type,
  "module",
  `${esmPackageMarkerPath} is not marked as an ESM package boundary.`,
);

process.stdout.write(`Native exports.import resolution: ${resolvedEntry}\n`);
