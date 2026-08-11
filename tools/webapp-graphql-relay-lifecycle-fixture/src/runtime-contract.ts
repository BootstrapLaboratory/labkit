import assert from "node:assert/strict";
import { realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const fixtureRequire = createRequire(import.meta.url);

type PackageContract = {
  name: string;
  version: string;
};

function packageManifestFromEntry(entry: string): PackageContract {
  let directory = dirname(realpathSync(entry));
  while (true) {
    const manifestPath = join(directory, "package.json");
    try {
      const manifest = fixtureRequire(manifestPath) as Partial<PackageContract>;
      if (manifest.name && manifest.version) {
        return { name: manifest.name, version: manifest.version };
      }
    } catch {
      // Continue toward the filesystem root until the owning manifest is found.
    }
    const parent = dirname(directory);
    if (parent === directory) {
      throw new Error(`Could not find a package manifest for ${entry}.`);
    }
    directory = parent;
  }
}

function resolveFrom(entry: string, dependency: string): string {
  return realpathSync(createRequire(entry).resolve(dependency));
}

export type RuntimeContractEvidence = {
  labkitEntry: string;
  reactRelayEntry: string;
  reactRelayVersion: string;
  relayRuntimeEntry: string;
  relayRuntimeVersion: string;
};

export type RelayRuntimeIdentity = {
  fixtureReactRelay: string;
  fixtureRelayRuntime: string;
  labkitReactRelay: string;
  labkitRelayRuntime: string;
  reactRelayRuntime: string;
  reactRelayVersion: string;
  relayRuntimeVersion: string;
};

export function assertRelayRuntimeIdentity(
  identity: RelayRuntimeIdentity,
): void {
  assert.equal(identity.reactRelayVersion, "20.1.1");
  assert.equal(identity.relayRuntimeVersion, "20.1.1");
  assert.equal(identity.labkitReactRelay, identity.fixtureReactRelay);
  assert.equal(identity.labkitRelayRuntime, identity.fixtureRelayRuntime);
  assert.equal(identity.reactRelayRuntime, identity.fixtureRelayRuntime);
}

export function assertSingleRelayRuntime(): RuntimeContractEvidence {
  const fixtureReactRelay = realpathSync(fixtureRequire.resolve("react-relay"));
  const fixtureRelayRuntime = realpathSync(
    fixtureRequire.resolve("relay-runtime"),
  );
  const labkitEntry = realpathSync(
    fixtureRequire.resolve("@omgjs/labkit-webapp-graphql-relay"),
  );
  const labkitReactRelay = resolveFrom(labkitEntry, "react-relay");
  const labkitRelayRuntime = resolveFrom(labkitEntry, "relay-runtime");
  const reactRelayRuntime = resolveFrom(fixtureReactRelay, "relay-runtime");
  const reactRelayManifest = packageManifestFromEntry(fixtureReactRelay);
  const relayRuntimeManifest = packageManifestFromEntry(fixtureRelayRuntime);

  assertRelayRuntimeIdentity({
    fixtureReactRelay,
    fixtureRelayRuntime,
    labkitReactRelay,
    labkitRelayRuntime,
    reactRelayRuntime,
    reactRelayVersion: reactRelayManifest.version,
    relayRuntimeVersion: relayRuntimeManifest.version,
  });

  return {
    labkitEntry,
    reactRelayEntry: fixtureReactRelay,
    reactRelayVersion: reactRelayManifest.version,
    relayRuntimeEntry: fixtureRelayRuntime,
    relayRuntimeVersion: relayRuntimeManifest.version,
  };
}
