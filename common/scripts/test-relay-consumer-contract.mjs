#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = path.resolve(SCRIPT_DIRECTORY, "../..");
const FIXTURE_ROOT = path.join(
  REPOSITORY_ROOT,
  "packages/webapp-graphql-relay/consumer-test",
);
const PNPM = path.join(
  REPOSITORY_ROOT,
  "common/temp/pnpm-local/node_modules/.bin/pnpm",
);
const FAILURE_ARTIFACT_ROOT = path.join(
  REPOSITORY_ROOT,
  "common/temp/relay-consumer-contract-artifacts",
);
const TARGET_PACKAGE = "@omgjs/labkit-webapp-graphql-relay";
const EXPECTED_RELAY_VERSION = "20.1.1";
const TEMPORARY_PREFIX = "labkit-relay-consumer-contract-";
const DEFAULT_COMMAND_TIMEOUT_MS = 5 * 60_000;
const CAPTURE_COMMAND_TIMEOUT_MS = 30_000;
const TERMINATION_GRACE_MS = 5_000;
const REGISTRY_AUTH_ENVIRONMENT_NAMES = [
  "NODE_AUTH_TOKEN",
  "NPM_AUTH_TOKEN",
  "NPM_CONFIG__AUTH_TOKEN",
  "NPM_TOKEN",
  "NPM_CONFIG_REGISTRY",
  "npm_config__authToken",
  "npm_config_registry",
];

const PEER_DIAGNOSTIC_PATTERN =
  /ERESOLVE|ERR_PNPM_PEER_DEP_ISSUES|invalid peer|missing peer|peer dependenc|unmet peer|✕ unmet peer|could not resolve dependency/i;

const SUPPORTED_RUNTIME_DEPENDENCIES = {
  graphql: "16.14.0",
  "graphql-ws": "6.0.8",
  react: "19.2.5",
  "react-dom": "19.2.5",
  "react-relay": EXPECTED_RELAY_VERSION,
  "relay-runtime": EXPECTED_RELAY_VERSION,
};

const SUPPORTED_DEVELOPMENT_DEPENDENCIES = {
  "@types/node": "25.6.0",
  "@types/react": "19.2.18",
  "@types/react-dom": "19.2.4",
  "@types/react-relay": "18.2.1",
  "@types/relay-runtime": "20.1.1",
  "relay-compiler": "20.1.1",
  typescript: "6.0.3",
  vite: "7.3.1",
};

const FIXTURE_SCRIPTS = {
  "build:browser": "vite build",
  "build:cjs": "tsc -p tsconfig.cjs.json",
  "build:checks": "tsc -p tsconfig.checks.json",
  "build:esm": "vite build --config vite.esm.config.ts",
  "build:ssr": "vite build --config vite.ssr.config.ts",
  "check:cjs": "node dist-cjs/cjs-smoke.js",
  "check:esm": "node dist-esm-smoke/esm-smoke.js",
  "check:esm-resolution": "node dist-checks/esm-resolution-check.js",
  "check:identity": "node dist-checks/resolution-check.js",
  "check:render": "node dist-ssr/render-smoke.js",
  relay: "relay-compiler",
  typecheck: "tsc -p tsconfig.json --noEmit",
};

function printHelp() {
  process.stdout.write(`Usage: npm run test:relay-consumer-contract

Builds ${TARGET_PACKAGE}, packs every publishable Rush project, and tests the
target tarball from clean npm and isolated pnpm consumers.

Safety note: Rush 5.175.0 treats "rush publish --pack" as a dry run. Its audited
pack branch requires "--publish --pack" to execute pnpm pack, without applying
change files or invoking a registry publish. This script adds a defensive
boundary anyway: it overlays the checkout into an independent "git clone
--no-local", removes its origin, installs/builds there, replaces inherited
user/global npm configuration with empty temporary files, scrubs npm
credential/registry environment variables, and asserts the Rush output contains
pack commands but no package-manager publish command. The script never passes
--apply, --commit, or tagging flags.

Temporary consumers are always removed. On failure, logs and compact evidence
are copied to common/temp/relay-consumer-contract-artifacts for CI upload.
`);
}

function sortRecord(record) {
  return Object.fromEntries(
    Object.entries(record).sort(([left], [right]) => left.localeCompare(right)),
  );
}

function commandDisplay(command, arguments_) {
  return [command, ...arguments_]
    .map((value) => (value.includes(" ") ? JSON.stringify(value) : value))
    .join(" ");
}

function signalProcessTree(child, signal) {
  if (!child.pid) {
    return;
  }
  try {
    if (process.platform === "win32") {
      child.kill(signal);
    } else {
      process.kill(-child.pid, signal);
    }
  } catch (error) {
    if (error?.code !== "ESRCH") {
      throw error;
    }
  }
}

function isSensitiveNpmEnvironmentName(environmentName) {
  const normalizedName = environmentName.toLowerCase();
  if (
    normalizedName === "node_auth_token" ||
    normalizedName === "npm_auth_token" ||
    normalizedName === "npm_token"
  ) {
    return true;
  }
  if (!normalizedName.startsWith("npm_config_")) {
    return false;
  }
  return /auth|token|password|username|registry|otp/.test(normalizedName);
}

async function runCommand({
  allowFailure = false,
  arguments_ = [],
  command,
  cwd = REPOSITORY_ROOT,
  environment = {},
  label,
  logsDirectory,
  scrubNpmEnvironment = false,
  timeoutMs = DEFAULT_COMMAND_TIMEOUT_MS,
  unsetEnvironment = [],
}) {
  process.stdout.write(`\n[relay-consumer] ${label}\n`);
  const result = await new Promise((resolve, reject) => {
    const childEnvironment = { ...process.env };
    if (scrubNpmEnvironment) {
      for (const environmentName of Object.keys(childEnvironment)) {
        if (isSensitiveNpmEnvironmentName(environmentName)) {
          delete childEnvironment[environmentName];
        }
      }
    }
    Object.assign(childEnvironment, {
      CI: "1",
      FORCE_COLOR: "0",
      NO_COLOR: "1",
      npm_config_color: "false",
      ...environment,
    });
    for (const environmentName of unsetEnvironment) {
      delete childEnvironment[environmentName];
    }
    const child = spawn(command, arguments_, {
      cwd,
      detached: process.platform !== "win32",
      env: childEnvironment,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let forceTerminationTimer;
    const timeout = setTimeout(() => {
      timedOut = true;
      signalProcessTree(child, "SIGTERM");
      forceTerminationTimer = setTimeout(() => {
        signalProcessTree(child, "SIGKILL");
      }, TERMINATION_GRACE_MS);
    }, timeoutMs);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      clearTimeout(timeout);
      clearTimeout(forceTerminationTimer);
      reject(error);
    });
    child.on("close", (status, signal) => {
      clearTimeout(timeout);
      clearTimeout(forceTerminationTimer);
      resolve({
        combined: `${stdout}\n${stderr}`,
        signal,
        status: status ?? 1,
        stderr,
        stdout,
        timedOut,
      });
    });
  });

  const logName = `${label.replace(/[^a-z0-9_.-]+/gi, "-").toLowerCase()}.log`;
  await writeFile(
    path.join(logsDirectory, logName),
    `$ ${commandDisplay(command, arguments_)}\n\nSTDOUT\n${result.stdout}\nSTDERR\n${result.stderr}`,
  );

  if (result.timedOut) {
    throw new Error(`${label} timed out after ${timeoutMs}ms. See ${logName}.`);
  }
  if (result.status !== 0 && !allowFailure) {
    throw new Error(
      `${label} failed with status ${result.status}${result.signal ? ` (${result.signal})` : ""}. See ${logName}.`,
    );
  }

  return result;
}

async function captureCommand(command, arguments_, cwd = REPOSITORY_ROOT) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, arguments_, {
      cwd,
      detached: process.platform !== "win32",
      env: { ...process.env, FORCE_COLOR: "0", NO_COLOR: "1" },
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let forceTerminationTimer;
    const timeout = setTimeout(() => {
      signalProcessTree(child, "SIGTERM");
      forceTerminationTimer = setTimeout(() => {
        signalProcessTree(child, "SIGKILL");
      }, TERMINATION_GRACE_MS);
    }, CAPTURE_COMMAND_TIMEOUT_MS);
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      clearTimeout(timeout);
      clearTimeout(forceTerminationTimer);
      reject(error);
    });
    child.on("close", (status) => {
      clearTimeout(timeout);
      clearTimeout(forceTerminationTimer);
      if (status !== 0) {
        reject(
          new Error(
            `${commandDisplay(command, arguments_)} failed with status ${status}: ${stderr}`,
          ),
        );
        return;
      }
      resolve(stdout);
    });
  });
}

async function readTarballManifest(tarballPath) {
  const manifestJson = await captureCommand("tar", [
    "-xOzf",
    tarballPath,
    "package/package.json",
  ]);
  return JSON.parse(manifestJson);
}

async function listTarball(tarballPath) {
  const contents = await captureCommand("tar", ["-tzf", tarballPath]);
  return contents.split("\n").filter(Boolean);
}

async function collectPackedArtifacts(releaseDirectory) {
  const tarballNames = (await readdir(releaseDirectory)).filter((entry) =>
    entry.endsWith(".tgz"),
  );
  assert.ok(tarballNames.length > 0, "Rush did not create any tarballs.");

  const artifacts = new Map();
  for (const tarballName of tarballNames) {
    const tarballPath = path.join(releaseDirectory, tarballName);
    const manifest = await readTarballManifest(tarballPath);
    assert.equal(
      artifacts.has(manifest.name),
      false,
      `Rush packed ${manifest.name} more than once.`,
    );
    artifacts.set(manifest.name, { manifest, tarballPath });
  }
  return artifacts;
}

function localRuntimeDependencyNames(manifest) {
  return Object.keys({
    ...manifest.dependencies,
    ...manifest.optionalDependencies,
  }).filter((name) => name.startsWith("@omgjs/labkit-"));
}

function collectFirstPartyClosure(artifacts) {
  const closure = new Set();
  const visit = (packageName) => {
    if (closure.has(packageName)) {
      return;
    }
    const artifact = artifacts.get(packageName);
    assert.ok(artifact, `No local tarball was packed for ${packageName}.`);
    closure.add(packageName);
    for (const dependencyName of localRuntimeDependencyNames(
      artifact.manifest,
    )) {
      visit(dependencyName);
    }
  };
  visit(TARGET_PACKAGE);
  return [...closure].sort();
}

async function validatePackedTarget(artifacts, evidenceDirectory) {
  const artifact = artifacts.get(TARGET_PACKAGE);
  assert.ok(artifact, `${TARGET_PACKAGE} was not present in Rush pack output.`);
  const { manifest, tarballPath } = artifact;

  for (const packageName of ["react-relay", "relay-runtime"]) {
    assert.equal(manifest.dependencies?.[packageName], undefined);
    assert.equal(manifest.optionalDependencies?.[packageName], undefined);
    assert.equal(
      manifest.peerDependencies?.[packageName],
      EXPECTED_RELAY_VERSION,
    );
    assert.equal(
      manifest.devDependencies?.[packageName],
      EXPECTED_RELAY_VERSION,
    );
    assert.notEqual(
      manifest.peerDependenciesMeta?.[packageName]?.optional,
      true,
      `${packageName} must remain a required peer.`,
    );
    for (const bundledField of ["bundledDependencies", "bundleDependencies"]) {
      const bundledDependencies = manifest[bundledField];
      if (Array.isArray(bundledDependencies)) {
        assert.equal(
          bundledDependencies.includes(packageName),
          false,
          `${packageName} must not be bundled by the packed package.`,
        );
      }
    }
  }

  for (const dependencyMap of [
    manifest.dependencies,
    manifest.devDependencies,
    manifest.optionalDependencies,
    manifest.peerDependencies,
  ]) {
    for (const version of Object.values(dependencyMap ?? {})) {
      assert.equal(
        String(version).startsWith("workspace:"),
        false,
        `Packed manifest retained workspace version ${version}.`,
      );
    }
  }

  const contents = await listTarball(tarballPath);
  assert.ok(contents.includes("package/dist/src/index.js"));
  assert.ok(contents.includes("package/dist/esm/package.json"));
  assert.ok(contents.includes("package/dist/esm/src/index.js"));
  assert.ok(contents.includes("package/dist/src/index.d.ts"));
  const esmPackageMarker = JSON.parse(
    await captureCommand("tar", [
      "-xOzf",
      tarballPath,
      "package/dist/esm/package.json",
    ]),
  );
  assert.equal(esmPackageMarker.type, "module");
  assert.equal(
    contents.some((entry) => entry.includes("consumer-test")),
    false,
    "The private consumer fixture leaked into the published tarball.",
  );

  await writeFile(
    path.join(evidenceDirectory, "packed-target-manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  await writeFile(
    path.join(evidenceDirectory, "packed-target-contents.txt"),
    `${contents.join("\n")}\n`,
  );
}

function createLocalDependencies(artifacts, closure) {
  assert.equal(closure.includes(TARGET_PACKAGE), true);
  return {
    [TARGET_PACKAGE]: artifacts.get(TARGET_PACKAGE).manifest.version,
  };
}

async function createScopedArtifactRegistry(artifacts, closure) {
  const packages = new Map();
  const tarballs = new Map();
  for (const packageName of closure) {
    const artifact = artifacts.get(packageName);
    assert.ok(artifact, `Cannot register missing artifact ${packageName}.`);
    const tarball = await readFile(artifact.tarballPath);
    const tarballName = `${createHash("sha512").update(tarball).digest("hex")}.tgz`;
    const metadata = {
      integrity: `sha512-${createHash("sha512").update(tarball).digest("base64")}`,
      manifest: artifact.manifest,
      shasum: createHash("sha1").update(tarball).digest("hex"),
      tarball,
      tarballName,
    };
    packages.set(packageName, metadata);
    tarballs.set(tarballName, metadata);
  }

  const requests = [];
  let baseUrl;
  const server = createServer((request, response) => {
    const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
    requests.push({
      authorization: Boolean(request.headers.authorization),
      method: request.method,
      pathname: requestUrl.pathname,
    });

    const sendJson = (status, value) => {
      const body = Buffer.from(`${JSON.stringify(value)}\n`);
      response.writeHead(status, {
        "content-length": body.length,
        "content-type": "application/json",
      });
      response.end(request.method === "HEAD" ? undefined : body);
    };

    if (requestUrl.pathname.startsWith("/tarballs/")) {
      const tarballName = decodeURIComponent(
        requestUrl.pathname.slice("/tarballs/".length),
      );
      const metadata = tarballs.get(tarballName);
      if (!metadata) {
        sendJson(404, { error: "Unknown local artifact tarball." });
        return;
      }
      response.writeHead(200, {
        "content-length": metadata.tarball.length,
        "content-type": "application/octet-stream",
      });
      response.end(request.method === "HEAD" ? undefined : metadata.tarball);
      return;
    }

    const packageName = decodeURIComponent(
      requestUrl.pathname.slice(1),
    ).toLowerCase();
    const metadata = packages.get(packageName);
    if (!metadata) {
      sendJson(404, { error: `Unknown local package ${packageName}.` });
      return;
    }
    const { manifest } = metadata;
    const publishedManifest = {
      ...manifest,
      dist: {
        integrity: metadata.integrity,
        shasum: metadata.shasum,
        tarball: `${baseUrl}tarballs/${encodeURIComponent(metadata.tarballName)}`,
      },
    };
    sendJson(200, {
      name: packageName,
      "dist-tags": { latest: manifest.version },
      versions: { [manifest.version]: publishedManifest },
    });
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });
  const address = server.address();
  assert.ok(address && typeof address === "object");
  baseUrl = `http://127.0.0.1:${address.port}/`;

  return {
    baseUrl,
    close: async () => {
      server.closeIdleConnections?.();
      server.closeAllConnections?.();
      await new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    },
    integrities: Object.fromEntries(
      [...packages].map(([packageName, metadata]) => [
        packageName,
        metadata.integrity,
      ]),
    ),
    requests,
    tarballUrls: Object.fromEntries(
      [...packages].map(([packageName, metadata]) => [
        packageName,
        `${baseUrl}tarballs/${encodeURIComponent(metadata.tarballName)}`,
      ]),
    ),
  };
}

async function configureScopedRegistry(caseDirectory, registry) {
  await writeFile(
    path.join(caseDirectory, ".npmrc"),
    `@omgjs:registry=${registry.baseUrl}\nregistry=https://registry.npmjs.org/\nalways-auth=false\n`,
  );
}

function assertScopedRegistryCoverage(requests, closure, registry, caseName) {
  assert.equal(
    requests.every((request) => request.authorization === false),
    true,
    `${caseName} sent authorization credentials to the local registry.`,
  );
  for (const packageName of closure) {
    assert.equal(
      requests.some((request) => {
        if (request.pathname.startsWith("/tarballs/")) {
          return false;
        }
        return (
          decodeURIComponent(request.pathname.slice(1)).toLowerCase() ===
          packageName
        );
      }),
      true,
      `${caseName} did not fetch ${packageName} metadata from the local registry.`,
    );
    const tarballPathname = new URL(registry.tarballUrls[packageName]).pathname;
    assert.equal(
      requests.some((request) => request.pathname === tarballPathname),
      true,
      `${caseName} did not fetch the ${packageName} local tarball.`,
    );
  }
}

async function copySupportedFixture(caseDirectory) {
  await cp(FIXTURE_ROOT, caseDirectory, {
    filter(sourcePath) {
      const relativePath = path.relative(FIXTURE_ROOT, sourcePath);
      return !(
        relativePath === "peer-stubs" ||
        relativePath.startsWith(`peer-stubs${path.sep}`)
      );
    },
    recursive: true,
  });
}

function shouldCopyToPackClone(sourcePath) {
  const relativePath = path.relative(REPOSITORY_ROOT, sourcePath);
  if (!relativePath) {
    return true;
  }
  const segments = relativePath.split(path.sep);
  if (segments.includes("node_modules") || segments.includes(".rush")) {
    return false;
  }
  return !(
    relativePath === ".git" ||
    relativePath.startsWith(`.git${path.sep}`) ||
    relativePath === path.join("common", "temp") ||
    relativePath.startsWith(`${path.join("common", "temp")}${path.sep}`)
  );
}

async function createIsolatedPackClone({ logsDirectory, temporaryRoot }) {
  const cloneDirectory = path.join(temporaryRoot, "pack-clone");
  await runCommand({
    arguments_: ["clone", "--no-local", REPOSITORY_ROOT, cloneDirectory],
    command: "git",
    label: "create-isolated-pack-clone",
    logsDirectory,
  });

  await runCommand({
    arguments_: ["-C", cloneDirectory, "remote", "remove", "origin"],
    command: "git",
    label: "remove-isolated-pack-clone-origin",
    logsDirectory,
  });

  for (const entry of await readdir(cloneDirectory)) {
    if (entry !== ".git") {
      await rm(path.join(cloneDirectory, entry), {
        force: true,
        recursive: true,
      });
    }
  }

  for (const entry of await readdir(REPOSITORY_ROOT)) {
    if (entry === ".git") {
      continue;
    }
    await cp(
      path.join(REPOSITORY_ROOT, entry),
      path.join(cloneDirectory, entry),
      {
        filter: shouldCopyToPackClone,
        force: true,
        recursive: true,
      },
    );
  }
  return cloneDirectory;
}

async function writeManifest(caseDirectory, manifest) {
  await writeFile(
    path.join(caseDirectory, "package.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
}

function supportedManifest(caseName, localDependencies) {
  return {
    name: `labkit-relay-consumer-${caseName}`,
    version: "0.0.0",
    private: true,
    type: "module",
    scripts: FIXTURE_SCRIPTS,
    dependencies: sortRecord({
      ...localDependencies,
      ...SUPPORTED_RUNTIME_DEPENDENCIES,
    }),
    devDependencies: sortRecord(SUPPORTED_DEVELOPMENT_DEPENDENCIES),
  };
}

function managerCommand(manager) {
  return manager === "npm" ? "npm" : PNPM;
}

function installArguments(manager, strict) {
  if (manager === "npm") {
    return [
      "install",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      ...(strict ? ["--strict-peer-deps"] : []),
    ];
  }

  return [
    "install",
    "--ignore-scripts",
    "--cache-dir=.pnpm-cache",
    "--config.node-linker=isolated",
    "--store-dir=.pnpm-store",
    ...(strict
      ? ["--strict-peer-dependencies", "--config.auto-install-peers=false"]
      : []),
  ];
}

async function installCase({
  allowFailure = false,
  caseDirectory,
  caseName,
  logsDirectory,
  manager,
  npmConfigurationEnvironment,
  strict = false,
}) {
  return runCommand({
    allowFailure,
    arguments_: installArguments(manager, strict),
    command: managerCommand(manager),
    cwd: caseDirectory,
    environment: {
      ...npmConfigurationEnvironment,
      NO_PROXY: "127.0.0.1,localhost",
      no_proxy: "127.0.0.1,localhost",
      ...(manager === "npm"
        ? { npm_config_cache: path.join(caseDirectory, ".npm-cache") }
        : {}),
    },
    label: `${caseName}-${manager}-${strict ? "strict" : "normal"}-install`,
    logsDirectory,
    scrubNpmEnvironment: true,
    unsetEnvironment: REGISTRY_AUTH_ENVIRONMENT_NAMES,
  });
}

function assertNoPeerDiagnostic(result, label) {
  assert.equal(
    PEER_DIAGNOSTIC_PATTERN.test(result.combined),
    false,
    `${label} emitted a peer dependency diagnostic.`,
  );
}

async function runPackageScript({
  caseDirectory,
  caseName,
  logsDirectory,
  manager,
  scriptName,
}) {
  await runCommand({
    arguments_: ["run", scriptName],
    command: managerCommand(manager),
    cwd: caseDirectory,
    label: `${caseName}-${scriptName}`,
    logsDirectory,
    timeoutMs: scriptName === "check:render" ? 15_000 : undefined,
  });
}

async function assertLocalArtifactProvenance(
  artifacts,
  caseDirectory,
  closure,
  manager,
  registry,
) {
  if (manager === "npm") {
    const lock = JSON.parse(
      await readFile(path.join(caseDirectory, "package-lock.json"), "utf8"),
    );
    for (const packageName of closure) {
      const suffix = `node_modules/${packageName}`;
      const entries = Object.entries(lock.packages ?? {}).filter(
        ([entryPath]) => entryPath.endsWith(suffix),
      );
      assert.ok(
        entries.length > 0,
        `${packageName} was absent from package-lock.json.`,
      );
      for (const [entryPath, metadata] of entries) {
        assert.match(
          metadata.resolved ?? "",
          new RegExp(
            `^${registry.tarballUrls[packageName].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
          ),
          `${packageName} was not resolved from its local registry tarball.`,
        );
        assert.equal(metadata.integrity, registry.integrities[packageName]);
        const installedManifest = JSON.parse(
          await readFile(
            path.join(caseDirectory, entryPath, "package.json"),
            "utf8",
          ),
        );
        assert.equal(installedManifest.name, packageName);
        assert.equal(
          installedManifest.version,
          artifacts.get(packageName).manifest.version,
        );
      }
    }
    return;
  }

  const pnpmLock = await readFile(
    path.join(caseDirectory, "pnpm-lock.yaml"),
    "utf8",
  );
  const virtualStoreDirectory = path.join(caseDirectory, "node_modules/.pnpm");
  const virtualStoreEntries = await readdir(virtualStoreDirectory);
  for (const packageName of closure) {
    assert.equal(
      pnpmLock.includes(registry.tarballUrls[packageName]),
      true,
      `${packageName} local tarball URL was absent from pnpm-lock.yaml.`,
    );
    assert.equal(
      pnpmLock.includes(registry.integrities[packageName]),
      true,
      `${packageName} local tarball integrity was absent from pnpm-lock.yaml.`,
    );
    const encodedName = packageName.replace("/", "+");
    const entries = virtualStoreEntries.filter((entry) =>
      entry.startsWith(`${encodedName}@`),
    );
    assert.ok(
      entries.length > 0,
      `${packageName} was absent from pnpm's virtual store.`,
    );
    assert.equal(
      entries.some((entry) => entry.includes("@file+")),
      false,
      `${packageName} retained a file-linked copy in pnpm's virtual store: ${entries.join(", ")}`,
    );
    assert.equal(
      entries.every((entry) =>
        entry.startsWith(
          `${encodedName}@${artifacts.get(packageName).manifest.version}`,
        ),
      ),
      true,
      `${packageName} resolved an unexpected version: ${entries.join(", ")}`,
    );
    for (const entry of entries) {
      const installedManifest = JSON.parse(
        await readFile(
          path.join(
            virtualStoreDirectory,
            entry,
            "node_modules",
            packageName,
            "package.json",
          ),
          "utf8",
        ),
      );
      assert.equal(installedManifest.name, packageName);
      assert.equal(
        installedManifest.version,
        artifacts.get(packageName).manifest.version,
      );
    }
  }
}

async function runSupportedCase({
  artifacts,
  caseRoot,
  closure,
  evidenceDirectory,
  localDependencies,
  logsDirectory,
  manager,
  npmConfigurationEnvironment,
  registry,
  strict,
}) {
  const caseName = `supported-${manager}-${strict ? "strict" : "normal"}`;
  const caseDirectory = path.join(caseRoot, caseName);
  await mkdir(caseDirectory, { recursive: true });
  await copySupportedFixture(caseDirectory);
  await configureScopedRegistry(caseDirectory, registry);
  await writeManifest(
    caseDirectory,
    supportedManifest(caseName, localDependencies),
  );

  const registryRequestStart = registry.requests.length;
  const installResult = await installCase({
    caseDirectory,
    caseName,
    logsDirectory,
    manager,
    npmConfigurationEnvironment,
    strict,
  });
  if (!strict) {
    assertScopedRegistryCoverage(
      registry.requests.slice(registryRequestStart),
      closure,
      registry,
      caseName,
    );
  }
  assertNoPeerDiagnostic(installResult, caseName);
  await assertLocalArtifactProvenance(
    artifacts,
    caseDirectory,
    closure,
    manager,
    registry,
  );

  const dependencyArguments =
    manager === "npm"
      ? ["ls", "--all", "--json"]
      : ["list", "--depth", "Infinity", "--json"];
  await runCommand({
    arguments_: dependencyArguments,
    command: managerCommand(manager),
    cwd: caseDirectory,
    label: `${caseName}-dependency-graph`,
    logsDirectory,
  });

  if (strict) {
    return;
  }

  for (const scriptName of [
    "relay",
    "typecheck",
    "build:checks",
    "check:identity",
    "check:esm-resolution",
    "build:cjs",
    "check:cjs",
    "build:esm",
    "check:esm",
    "build:browser",
    "build:ssr",
    "check:render",
  ]) {
    await runPackageScript({
      caseDirectory,
      caseName,
      logsDirectory,
      manager,
      scriptName,
    });
    if (scriptName === "build:cjs") {
      await writeFile(
        path.join(caseDirectory, "dist-cjs/package.json"),
        '{"type":"commonjs"}\n',
      );
    }
  }

  const viteReport = JSON.parse(
    await readFile(
      path.join(caseDirectory, "dist/relay-module-identity.json"),
      "utf8",
    ),
  );
  for (const packageName of ["react-relay", "relay-runtime"]) {
    assert.equal(viteReport[packageName]?.version, EXPECTED_RELAY_VERSION);
    assert.ok(viteReport[packageName]?.moduleCount > 0);
  }
  await writeFile(
    path.join(evidenceDirectory, `${caseName}-vite-identity.json`),
    `${JSON.stringify(viteReport, null, 2)}\n`,
  );
}

async function packPeerStubs(
  releaseDirectory,
  logsDirectory,
  npmConfigurationEnvironment,
) {
  const stubArtifacts = {};
  for (const stubName of ["react-relay", "relay-runtime"]) {
    const stubDirectory = path.join(FIXTURE_ROOT, "peer-stubs", stubName);
    await runCommand({
      arguments_: [
        "--dir",
        stubDirectory,
        "pack",
        "--pack-destination",
        releaseDirectory,
      ],
      command: PNPM,
      environment: npmConfigurationEnvironment,
      label: `pack-synthetic-${stubName}`,
      logsDirectory,
      scrubNpmEnvironment: true,
      unsetEnvironment: REGISTRY_AUTH_ENVIRONMENT_NAMES,
    });
    const expectedTarball = path.join(
      releaseDirectory,
      `${stubName}-${stubName === "react-relay" ? "99.0.0" : "99.0.0"}.tgz`,
    );
    stubArtifacts[stubName] = `file:${expectedTarball}`;
  }
  return stubArtifacts;
}

function negativeManifest({
  caseName,
  localDependencies,
  scenario,
  stubArtifacts,
}) {
  const relayDependencies =
    scenario === "unsupported"
      ? {
          "react-relay": stubArtifacts["react-relay"],
          "relay-runtime": stubArtifacts["relay-runtime"],
        }
      : scenario === "mismatched"
        ? {
            "react-relay": EXPECTED_RELAY_VERSION,
            "relay-runtime": stubArtifacts["relay-runtime"],
          }
        : {
            "relay-runtime": EXPECTED_RELAY_VERSION,
          };

  return {
    name: `labkit-relay-negative-${caseName}`,
    version: "0.0.0",
    private: true,
    dependencies: sortRecord({
      ...localDependencies,
      graphql: "16.14.0",
      react: "19.2.5",
      ...relayDependencies,
    }),
  };
}

async function assertAutoInstalledPeer(caseDirectory, packageName) {
  const requireFromConsumer = createRequire(
    path.join(caseDirectory, "negative-resolution-anchor.cjs"),
  );
  const labkitEntry = await realpath(
    requireFromConsumer.resolve(TARGET_PACKAGE),
  );
  const requireFromLabkit = createRequire(labkitEntry);
  const entryPath = await realpath(requireFromLabkit.resolve(packageName));
  let currentPath = path.dirname(entryPath);
  while (currentPath !== path.dirname(currentPath)) {
    try {
      const manifest = JSON.parse(
        await readFile(path.join(currentPath, "package.json"), "utf8"),
      );
      if (manifest.name === packageName) {
        assert.equal(manifest.version, EXPECTED_RELAY_VERSION);
        return;
      }
    } catch {
      // Keep walking to the owning package manifest.
    }
    currentPath = path.dirname(currentPath);
  }
  throw new Error(`Could not verify the auto-installed ${packageName} peer.`);
}

async function runNegativeCase({
  caseRoot,
  localDependencies,
  logsDirectory,
  manager,
  matrixSummary,
  npmConfigurationEnvironment,
  registry,
  scenario,
  strict,
  stubArtifacts,
}) {
  const caseName = `${scenario}-${manager}-${strict ? "strict" : "normal"}`;
  const caseDirectory = path.join(caseRoot, caseName);
  await mkdir(caseDirectory, { recursive: true });
  await configureScopedRegistry(caseDirectory, registry);
  const manifest = negativeManifest({
    caseName,
    localDependencies,
    scenario,
    stubArtifacts,
  });
  await writeManifest(caseDirectory, manifest);
  if (scenario === "missing") {
    assert.equal(manifest.dependencies["react-relay"], undefined);
  }

  const result = await installCase({
    allowFailure: true,
    caseDirectory,
    caseName,
    logsDirectory,
    manager,
    npmConfigurationEnvironment,
    strict,
  });
  const diagnostic = PEER_DIAGNOSTIC_PATTERN.test(result.combined);
  const behavior =
    result.status !== 0
      ? "install-failed"
      : diagnostic
        ? "install-warned"
        : "installed";

  if (scenario === "missing" && result.status === 0) {
    await assertAutoInstalledPeer(caseDirectory, "react-relay");
    matrixSummary[caseName] =
      `${behavior}; package manager auto-installed the omitted peer`;
    return;
  }

  assert.equal(
    diagnostic,
    true,
    `${caseName} did not emit an actionable peer dependency diagnostic.`,
  );
  if (strict) {
    assert.notEqual(
      result.status,
      0,
      `${caseName} unexpectedly succeeded in strict peer mode.`,
    );
  }
  matrixSummary[caseName] = behavior;
}

async function recordVersions(evidenceDirectory, logsDirectory) {
  const nodeVersion = process.version;
  const npmResult = await runCommand({
    arguments_: ["--version"],
    command: "npm",
    label: "npm-version",
    logsDirectory,
  });
  const pnpmResult = await runCommand({
    arguments_: ["--version"],
    command: PNPM,
    label: "pnpm-version",
    logsDirectory,
  });
  assert.equal(pnpmResult.stdout.trim(), "10.33.2");
  await writeFile(
    path.join(evidenceDirectory, "tool-versions.json"),
    `${JSON.stringify(
      {
        node: nodeVersion,
        npm: npmResult.stdout.trim(),
        pnpm: pnpmResult.stdout.trim(),
        relay: EXPECTED_RELAY_VERSION,
      },
      null,
      2,
    )}\n`,
  );
}

async function collectFileSnapshot(rootPath, relativePrefix = "") {
  const snapshot = {};
  let entries;
  try {
    entries = await readdir(rootPath, { withFileTypes: true });
  } catch (error) {
    if (error?.code === "ENOENT") {
      return snapshot;
    }
    throw error;
  }

  for (const entry of entries.sort((left, right) =>
    left.name.localeCompare(right.name),
  )) {
    const absolutePath = path.join(rootPath, entry.name);
    const relativePath = path.join(relativePrefix, entry.name);
    if (entry.isDirectory()) {
      Object.assign(
        snapshot,
        await collectFileSnapshot(absolutePath, relativePath),
      );
    } else if (entry.isFile()) {
      snapshot[relativePath] = (await readFile(absolutePath)).toString(
        "base64",
      );
    }
  }
  return snapshot;
}

async function snapshotLiveReleaseInputs() {
  const targetRoot = path.join(
    REPOSITORY_ROOT,
    "packages/webapp-graphql-relay",
  );
  const snapshot = {};
  for (const fileName of ["package.json", "CHANGELOG.json", "CHANGELOG.md"]) {
    snapshot[`target/${fileName}`] = (
      await readFile(path.join(targetRoot, fileName))
    ).toString("base64");
  }
  Object.assign(
    snapshot,
    Object.fromEntries(
      Object.entries(
        await collectFileSnapshot(path.join(REPOSITORY_ROOT, "common/changes")),
      ).map(([fileName, contents]) => [`changes/${fileName}`, contents]),
    ),
  );
  return snapshot;
}

async function createEmptyNpmConfiguration(temporaryRoot) {
  const configurationDirectory = path.join(temporaryRoot, "npm-config");
  const globalConfiguration = path.join(
    configurationDirectory,
    "empty-global.npmrc",
  );
  const userConfiguration = path.join(
    configurationDirectory,
    "empty-user.npmrc",
  );
  await mkdir(configurationDirectory, { recursive: true });
  await Promise.all([
    writeFile(globalConfiguration, "# Intentionally empty.\n"),
    writeFile(userConfiguration, "# Intentionally empty.\n"),
  ]);
  return {
    NPM_CONFIG_GLOBALCONFIG: globalConfiguration,
    NPM_CONFIG_USERCONFIG: userConfiguration,
    npm_config_globalconfig: globalConfiguration,
    npm_config_userconfig: userConfiguration,
  };
}

function assertSafeTemporaryRoot(temporaryRoot) {
  assert.equal(path.dirname(temporaryRoot), os.tmpdir());
  assert.equal(path.basename(temporaryRoot).startsWith(TEMPORARY_PREFIX), true);
}

async function preserveFailureEvidence(temporaryRoot) {
  await rm(FAILURE_ARTIFACT_ROOT, { force: true, recursive: true });
  await mkdir(FAILURE_ARTIFACT_ROOT, { recursive: true });
  for (const directoryName of ["evidence", "logs"]) {
    const source = path.join(temporaryRoot, directoryName);
    try {
      await cp(source, path.join(FAILURE_ARTIFACT_ROOT, directoryName), {
        recursive: true,
      });
    } catch (error) {
      if (error?.code !== "ENOENT") {
        throw error;
      }
    }
  }
}

async function main() {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    printHelp();
    return;
  }
  assert.deepEqual(
    process.argv.slice(2),
    [],
    "This command does not accept positional arguments. Use --help for details.",
  );

  await rm(FAILURE_ARTIFACT_ROOT, { force: true, recursive: true });
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), TEMPORARY_PREFIX));
  assertSafeTemporaryRoot(temporaryRoot);
  const caseRoot = path.join(temporaryRoot, "cases");
  const evidenceDirectory = path.join(temporaryRoot, "evidence");
  const logsDirectory = path.join(temporaryRoot, "logs");
  const releaseDirectory = path.join(temporaryRoot, "release");
  await Promise.all(
    [caseRoot, evidenceDirectory, logsDirectory, releaseDirectory].map(
      (directory) => mkdir(directory, { recursive: true }),
    ),
  );

  let artifactRegistry;
  let succeeded = false;
  try {
    const liveReleaseInputs = await snapshotLiveReleaseInputs();
    const npmConfigurationEnvironment =
      await createEmptyNpmConfiguration(temporaryRoot);
    await recordVersions(evidenceDirectory, logsDirectory);
    const cloneDirectory = await createIsolatedPackClone({
      logsDirectory,
      temporaryRoot,
    });
    const isolatedRushRunner = path.join(
      cloneDirectory,
      "common/scripts/install-run-rush.js",
    );
    await runCommand({
      arguments_: [isolatedRushRunner, "install"],
      command: process.execPath,
      cwd: cloneDirectory,
      environment: npmConfigurationEnvironment,
      label: "isolated-rush-install",
      logsDirectory,
      scrubNpmEnvironment: true,
      unsetEnvironment: REGISTRY_AUTH_ENVIRONMENT_NAMES,
    });
    await runCommand({
      arguments_: [isolatedRushRunner, "build", "--to", TARGET_PACKAGE],
      command: process.execPath,
      cwd: cloneDirectory,
      environment: npmConfigurationEnvironment,
      label: "isolated-rush-build-target-and-dependencies",
      logsDirectory,
      scrubNpmEnvironment: true,
      unsetEnvironment: REGISTRY_AUTH_ENVIRONMENT_NAMES,
    });

    // Rush 5.175.0 only executes packing when --publish accompanies --pack.
    // Its pack branch does not apply change files and does not registry-publish;
    // the isolated clone and output assertions add defense in depth.
    const packResult = await runCommand({
      arguments_: [
        isolatedRushRunner,
        "publish",
        "--publish",
        "--pack",
        "--include-all",
        "--release-folder",
        releaseDirectory,
      ],
      command: process.execPath,
      cwd: cloneDirectory,
      environment: npmConfigurationEnvironment,
      label: "rush-pack-publishable-artifacts",
      logsDirectory,
      scrubNpmEnvironment: true,
      unsetEnvironment: REGISTRY_AUTH_ENVIRONMENT_NAMES,
    });
    assert.match(
      packResult.combined,
      /EXECUTING:[^\n]*(?:npm|pnpm) pack/i,
      "Rush did not report an executed package-manager pack command.",
    );
    assert.match(
      packResult.combined,
      /Tarball Details/i,
      "Rush did not report any created tarballs.",
    );
    assert.doesNotMatch(
      packResult.combined,
      /EXECUTING:[^\n]*(?:npm|pnpm) publish/i,
      "Rush unexpectedly invoked a package-manager publish command.",
    );
    assert.deepEqual(
      await snapshotLiveReleaseInputs(),
      liveReleaseInputs,
      "The isolated pack changed live package, changelog, or Rush change metadata.",
    );
    await writeFile(
      path.join(evidenceDirectory, "live-release-inputs-unchanged.txt"),
      "Live package.json, changelogs, and Rush change files were byte-identical after isolated packing.\n",
    );

    const artifacts = await collectPackedArtifacts(releaseDirectory);
    await validatePackedTarget(artifacts, evidenceDirectory);
    const closure = collectFirstPartyClosure(artifacts);
    const localDependencies = createLocalDependencies(artifacts, closure);
    await writeFile(
      path.join(evidenceDirectory, "first-party-closure.json"),
      `${JSON.stringify({ closure, localDependencies }, null, 2)}\n`,
    );
    artifactRegistry = await createScopedArtifactRegistry(artifacts, closure);
    const stubArtifacts = await packPeerStubs(
      releaseDirectory,
      logsDirectory,
      npmConfigurationEnvironment,
    );

    for (const manager of ["npm", "pnpm"]) {
      await runSupportedCase({
        artifacts,
        caseRoot,
        closure,
        evidenceDirectory,
        localDependencies,
        logsDirectory,
        manager,
        npmConfigurationEnvironment,
        registry: artifactRegistry,
        strict: false,
      });
      await runSupportedCase({
        artifacts,
        caseRoot,
        closure,
        evidenceDirectory,
        localDependencies,
        logsDirectory,
        manager,
        npmConfigurationEnvironment,
        registry: artifactRegistry,
        strict: true,
      });
    }

    const matrixSummary = {};
    for (const scenario of ["unsupported", "mismatched", "missing"]) {
      for (const manager of ["npm", "pnpm"]) {
        for (const strict of [false, true]) {
          await runNegativeCase({
            caseRoot,
            localDependencies,
            logsDirectory,
            manager,
            matrixSummary,
            npmConfigurationEnvironment,
            registry: artifactRegistry,
            scenario,
            strict,
            stubArtifacts,
          });
        }
      }
    }
    await writeFile(
      path.join(evidenceDirectory, "matrix-summary.json"),
      `${JSON.stringify(matrixSummary, null, 2)}\n`,
    );
    assert.equal(
      artifactRegistry.requests.every(
        (request) => request.authorization === false,
      ),
      true,
      "A package manager sent authorization credentials to the local registry.",
    );
    await writeFile(
      path.join(evidenceDirectory, "scoped-registry-requests.json"),
      `${JSON.stringify(artifactRegistry.requests, null, 2)}\n`,
    );

    succeeded = true;
    process.stdout.write(
      `\n[relay-consumer] Negative matrix behavior:\n${JSON.stringify(matrixSummary, null, 2)}\n`,
    );
    process.stdout.write(
      "[relay-consumer] Packed npm/pnpm Relay consumer contract passed.\n",
    );
  } catch (error) {
    if (artifactRegistry) {
      await writeFile(
        path.join(evidenceDirectory, "scoped-registry-requests.json"),
        `${JSON.stringify(artifactRegistry.requests, null, 2)}\n`,
      );
    }
    await preserveFailureEvidence(temporaryRoot);
    process.stderr.write(
      `\n[relay-consumer] Failure evidence: ${FAILURE_ARTIFACT_ROOT}\n`,
    );
    throw error;
  } finally {
    await artifactRegistry?.close();
    assertSafeTemporaryRoot(temporaryRoot);
    await rm(temporaryRoot, { force: true, recursive: true });
    if (succeeded) {
      await rm(FAILURE_ARTIFACT_ROOT, { force: true, recursive: true });
    }
  }
}

await main();
