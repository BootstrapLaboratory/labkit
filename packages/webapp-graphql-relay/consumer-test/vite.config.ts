import { existsSync, readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { defineConfig, type Plugin } from "vite";

const EXPECTED_RELAY_VERSION = "20.1.1";
const LABKIT_PACKAGE_PATH =
  "/@omgjs/labkit-webapp-graphql-relay/dist/esm/src/index.js";
const RELAY_PACKAGES = ["react-relay", "relay-runtime"] as const;

function findPackageRoot(moduleId: string, packageName: string): string | null {
  let currentPath = moduleId.replace(/^\0/, "").split("?", 1)[0];
  if (!path.isAbsolute(currentPath) || !existsSync(currentPath)) {
    return null;
  }

  currentPath = path.dirname(currentPath);
  while (currentPath !== path.dirname(currentPath)) {
    const manifestPath = path.join(currentPath, "package.json");
    if (existsSync(manifestPath)) {
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
        name?: string;
      };
      if (manifest.name === packageName) {
        return realpathSync(currentPath);
      }
    }
    currentPath = path.dirname(currentPath);
  }

  return null;
}

function relayModuleIdentityPlugin(): Plugin {
  return {
    name: "labkit-relay-module-identity",
    generateBundle() {
      const moduleIds = [...this.getModuleIds()];
      const normalizedModuleIds = moduleIds.map((moduleId) =>
        moduleId.replaceAll("\\", "/"),
      );
      const labkitEsmEntries = normalizedModuleIds.filter((moduleId) =>
        moduleId.includes(LABKIT_PACKAGE_PATH),
      );
      if (labkitEsmEntries.length !== 1) {
        this.error(
          `Expected Vite to select one Labkit ESM entry, found ${labkitEsmEntries.length}: ${labkitEsmEntries.join(", ")}`,
        );
      }
      const report: Record<string, unknown> = {
        labkitEsmEntry: labkitEsmEntries[0],
      };

      for (const packageName of RELAY_PACKAGES) {
        const roots = new Set<string>();
        let moduleCount = 0;
        for (const moduleId of moduleIds) {
          const root = findPackageRoot(moduleId, packageName);
          if (root) {
            roots.add(root);
            moduleCount += 1;
          }
        }

        if (roots.size !== 1) {
          this.error(
            `Expected one ${packageName} implementation in the Vite graph, found ${roots.size}: ${[
              ...roots,
            ].join(", ")}`,
          );
        }

        const [packageRoot] = roots;
        const manifest = JSON.parse(
          readFileSync(path.join(packageRoot, "package.json"), "utf8"),
        ) as { version?: string };
        if (manifest.version !== EXPECTED_RELAY_VERSION) {
          this.error(
            `Expected ${packageName}@${EXPECTED_RELAY_VERSION}, found ${String(manifest.version)}`,
          );
        }

        report[packageName] = {
          moduleCount,
          packageRoot,
          version: manifest.version,
        };
      }

      this.emitFile({
        type: "asset",
        fileName: "relay-module-identity.json",
        source: `${JSON.stringify(report, null, 2)}\n`,
      });
    },
  };
}

export default defineConfig({
  build: {
    manifest: true,
  },
  plugins: [relayModuleIdentityPlugin()],
  resolve: {
    preserveSymlinks: false,
  },
});
