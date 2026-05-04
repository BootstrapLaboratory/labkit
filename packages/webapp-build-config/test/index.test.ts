import assert from "node:assert/strict";
import test from "node:test";
import {
  createPackageModuleChunkGroups,
  getMissingEnvNames,
  isPackageModule,
  requireProductionBuildEnv,
} from "../src/index";

test("getMissingEnvNames treats undefined and blank env values as missing", () => {
  assert.deepEqual(
    getMissingEnvNames(
      {
        EMPTY_VALUE: "",
        PRESENT_VALUE: "ready",
        SPACES_VALUE: "   ",
      },
      ["EMPTY_VALUE", "MISSING_VALUE", "PRESENT_VALUE", "SPACES_VALUE"],
    ),
    ["EMPTY_VALUE", "MISSING_VALUE", "SPACES_VALUE"],
  );
});

test("requireProductionBuildEnv only validates production build commands", () => {
  assert.doesNotThrow(() => {
    requireProductionBuildEnv({
      appName: "webapp",
      command: "serve",
      env: {},
      envFilePath: "apps/webapp/.env.production",
      requiredEnvNames: ["VITE_GRAPHQL_HTTP"],
    });
  });
});

test("requireProductionBuildEnv throws with actionable production env guidance", () => {
  assert.throws(
    () => {
      requireProductionBuildEnv({
        appName: "webapp",
        command: "build",
        env: { VITE_GRAPHQL_HTTP: "   " },
        envFilePath: "apps/webapp/.env.production",
        extraHelp: [
          "GitHub Actions should map WEBAPP_VITE_GRAPHQL_HTTP/WS repository variables to VITE_GRAPHQL_HTTP/WS before the webapp build runs.",
        ],
        requiredEnvNames: ["VITE_GRAPHQL_HTTP", "VITE_GRAPHQL_WS"],
      });
    },
    {
      message:
        "Missing required production webapp environment: VITE_GRAPHQL_HTTP, VITE_GRAPHQL_WS. Set these variables in the build environment or in apps/webapp/.env.production. GitHub Actions should map WEBAPP_VITE_GRAPHQL_HTTP/WS repository variables to VITE_GRAPHQL_HTTP/WS before the webapp build runs.",
    },
  );
});

test("requireProductionBuildEnv accepts configured production env", () => {
  assert.doesNotThrow(() => {
    requireProductionBuildEnv({
      appName: "webapp",
      command: "build",
      env: {
        VITE_GRAPHQL_HTTP: "https://example.com/graphql",
        VITE_GRAPHQL_WS: "wss://example.com/graphql",
      },
      envFilePath: "apps/webapp/.env.production",
      requiredEnvNames: ["VITE_GRAPHQL_HTTP", "VITE_GRAPHQL_WS"],
    });
  });
});

test("isPackageModule matches node_modules and pnpm workspace package paths", () => {
  assert.equal(
    isPackageModule("/workspace/apps/webapp/node_modules/react/index.js", [
      "react",
    ]),
    true,
  );
  assert.equal(
    isPackageModule(
      "/workspace/common/temp/node_modules/.pnpm/@tanstack+react-router@1.0.0/node_modules/@tanstack/react-router/dist/index.js",
      ["@tanstack/react-router"],
    ),
    true,
  );
  assert.equal(
    isPackageModule(
      "/workspace/common/temp/node_modules/.pnpm/react-dom@1.0.0/node_modules/react-dom/index.js",
      ["react"],
    ),
    false,
  );
});

test("createPackageModuleChunkGroups creates stable package test functions", () => {
  const groups = createPackageModuleChunkGroups([
    {
      name: "react-vendor",
      packageNames: ["react"],
      priority: 30,
    },
  ]);

  assert.equal(groups.length, 1);
  assert.equal(groups[0].name, "react-vendor");
  assert.equal(groups[0].priority, 30);
  assert.equal(
    groups[0].test("/workspace/apps/webapp/node_modules/react/index.js"),
    true,
  );
  assert.equal(
    groups[0].test(
      "/workspace/apps/webapp/node_modules/relay-runtime/index.js",
    ),
    false,
  );
});
