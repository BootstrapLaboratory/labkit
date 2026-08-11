import assert from "node:assert/strict";
import {
  createRouteQueryLifetime,
  createWebappRelayEnvironment,
  loadRouteQuery,
  useRouteQueryLifetime,
} from "@omgjs/labkit-webapp-graphql-relay";
import type { Client } from "graphql-ws";
import { Environment } from "relay-runtime";

const wsClient = {
  subscribe: () => () => undefined,
  terminate: () => undefined,
} as unknown as Client;

const environment = createWebappRelayEnvironment({
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

assert.equal(typeof loadRouteQuery, "function");
assert.equal(typeof createRouteQueryLifetime, "function");
assert.equal(typeof useRouteQueryLifetime, "function");
assert.ok(environment instanceof Environment);
process.stdout.write("ESM entrypoint uses the application Relay runtime.\n");
