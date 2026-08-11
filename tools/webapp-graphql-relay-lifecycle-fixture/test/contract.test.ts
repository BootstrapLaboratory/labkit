import assert from "node:assert/strict";
import { loadRouteQuery } from "@omgjs/labkit-webapp-graphql-relay";
import { test } from "vitest";
import type { PreloadedQuery } from "react-relay";
import type { Environment, OperationType } from "relay-runtime";
import { assertRelayRuntimeIdentity } from "../src/runtime-contract.js";

type ContractQuery = OperationType & {
  response: { readonly item: { readonly id: string } };
  variables: { id: string };
};

function loadTrackedReference(
  signal: AbortSignal,
  dispose: () => void,
): PreloadedQuery<ContractQuery> {
  // Keep permanent coverage for the deprecated abort-only compatibility arm.
  return loadRouteQuery<ContractQuery>({
    abortSignal: signal,
    environment: {} as Environment,
    loadQuery: () => ({ dispose }) as PreloadedQuery<ContractQuery>,
    query: {} as never,
    variables: { id: "contract" },
  });
}

test("B3: an already-aborted signal disposes exactly once", () => {
  const controller = new AbortController();
  controller.abort();
  let disposals = 0;
  loadTrackedReference(controller.signal, () => {
    disposals += 1;
  });
  controller.abort();
  assert.equal(disposals, 1);
});

test("repeated abort notifications dispose each independently owned reference once", () => {
  const controller = new AbortController();
  const disposals = [0, 0];
  loadTrackedReference(controller.signal, () => {
    disposals[0] += 1;
  });
  loadTrackedReference(controller.signal, () => {
    disposals[1] += 1;
  });
  controller.abort();
  controller.abort();
  assert.deepEqual(disposals, [1, 1]);
});

test("the runtime preflight rejects a duplicate Relay path", () => {
  assert.throws(() =>
    assertRelayRuntimeIdentity({
      fixtureReactRelay: "/fixture/react-relay",
      fixtureRelayRuntime: "/fixture/relay-runtime",
      labkitReactRelay: "/fixture/react-relay",
      labkitRelayRuntime: "/nested/relay-runtime",
      reactRelayRuntime: "/fixture/relay-runtime",
      reactRelayVersion: "20.1.1",
      relayRuntimeVersion: "20.1.1",
    }),
  );
});
