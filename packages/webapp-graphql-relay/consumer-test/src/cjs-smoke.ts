import assert from "node:assert/strict";
import * as labkit from "@omgjs/labkit-webapp-graphql-relay";
import * as relayRuntime from "relay-runtime";
import type { Client } from "graphql-ws";

const wsClient = {
  subscribe: () => () => undefined,
  terminate: () => undefined,
} as unknown as Client;

const environment = labkit.createWebappRelayEnvironment({
  auth: {
    getAccessToken: () => null,
    getAuthRequestCredentials: () => "omit",
    getAuthSession: () => null,
    hasAuthRequiredGraphqlErrors: () => false,
    refreshStoredAuthSession: async () => null,
    subscribeAuthState: () => () => undefined,
  },
  fetch: async () => ({
    json: async () => ({ data: {} }),
    ok: true,
    status: 200,
  }),
  httpEndpoint: "https://fixture.invalid/graphql",
  realtime: {
    getClient: () => wsClient,
  },
});

assert.equal(typeof labkit.loadRouteQuery, "function");
assert.equal(typeof labkit.createRouteQueryLifetime, "function");
assert.equal(typeof labkit.useRouteQueryLifetime, "function");
assert.ok(environment instanceof relayRuntime.Environment);
process.stdout.write(
  "CommonJS entrypoint uses the application Relay runtime.\n",
);
