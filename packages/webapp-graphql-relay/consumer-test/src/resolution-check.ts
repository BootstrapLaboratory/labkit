import assert from "node:assert/strict";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const LABKIT_PACKAGE = "@omgjs/labkit-webapp-graphql-relay";
const EXPECTED_RELAY_VERSION = "20.1.1";
const applicationRequire = createRequire(import.meta.url);

function findPackageRoot(entryPath: string, expectedName: string): string {
  let currentPath = path.dirname(realpathSync(entryPath));
  while (currentPath !== path.dirname(currentPath)) {
    const manifestPath = path.join(currentPath, "package.json");
    if (existsSync(manifestPath)) {
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
        name?: string;
      };
      if (manifest.name === expectedName) {
        return currentPath;
      }
    }
    currentPath = path.dirname(currentPath);
  }
  throw new Error(
    `Could not find the ${expectedName} package root from ${entryPath}.`,
  );
}

function resolveCanonical(
  requireFrom: NodeJS.Require,
  packageName: string,
): string {
  return realpathSync(requireFrom.resolve(packageName));
}

function readPackageVersion(entryPath: string, packageName: string): string {
  const packageRoot = findPackageRoot(entryPath, packageName);
  return (
    JSON.parse(
      readFileSync(path.join(packageRoot, "package.json"), "utf8"),
    ) as { version: string }
  ).version;
}

const labkitEntry = resolveCanonical(applicationRequire, LABKIT_PACKAGE);
const labkitRequire = createRequire(labkitEntry);
const reactRelayEntry = resolveCanonical(applicationRequire, "react-relay");
const reactRelayRequire = createRequire(reactRelayEntry);

const resolutions: Record<string, Record<string, string>> = {
  "react-relay": {
    application: reactRelayEntry,
    labkit: resolveCanonical(labkitRequire, "react-relay"),
  },
  "relay-runtime": {
    application: resolveCanonical(applicationRequire, "relay-runtime"),
    labkit: resolveCanonical(labkitRequire, "relay-runtime"),
    reactRelay: resolveCanonical(reactRelayRequire, "relay-runtime"),
  },
};

for (const [packageName, packageResolutions] of Object.entries(resolutions)) {
  const uniquePaths = new Set(Object.values(packageResolutions));
  assert.equal(
    uniquePaths.size,
    1,
    `${packageName} resolved to multiple implementations: ${JSON.stringify(packageResolutions)}`,
  );
  const applicationResolution = packageResolutions.application;
  assert.ok(applicationResolution);
  assert.equal(
    readPackageVersion(applicationResolution, packageName),
    EXPECTED_RELAY_VERSION,
  );
}

const labkitRoot = findPackageRoot(labkitEntry, LABKIT_PACKAGE);
for (const packageName of ["react-relay", "relay-runtime"]) {
  assert.equal(
    existsSync(path.join(labkitRoot, "node_modules", packageName)),
    false,
    `${packageName} is nested privately below the installed Labkit package.`,
  );
}

process.stdout.write(
  `${JSON.stringify({ labkitEntry, resolutions }, null, 2)}\n`,
);
