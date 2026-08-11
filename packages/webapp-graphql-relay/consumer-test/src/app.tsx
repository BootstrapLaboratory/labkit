import {
  createWebappRelayEnvironment,
  loadRouteQuery,
  type GraphqlRelayAuthAdapter,
} from "@omgjs/labkit-webapp-graphql-relay";
import { Suspense, type ReactElement } from "react";
import {
  RelayEnvironmentProvider,
  usePreloadedQuery,
  type PreloadedQuery,
} from "react-relay";
import type { Client } from "graphql-ws";
import { createOperationDescriptor, type Disposable } from "relay-runtime";
import fixtureQuery, {
  type FixtureOperationQuery,
} from "./__generated__/FixtureOperationQuery.graphql";

export const EXPECTED_VIEWER_NAME = "Packed Relay consumer";

const auth: GraphqlRelayAuthAdapter = {
  getAccessToken: () => null,
  getAuthRequestCredentials: () => "omit",
  getAuthSession: () => null,
  hasAuthRequiredGraphqlErrors: () => false,
  refreshStoredAuthSession: async () => null,
  subscribeAuthState: () => () => undefined,
};

const wsClient = {
  subscribe: () => () => undefined,
  terminate: () => undefined,
} as unknown as Client;

function FixtureView({
  queryReference,
}: {
  queryReference: PreloadedQuery<FixtureOperationQuery>;
}): ReactElement {
  const data = usePreloadedQuery(fixtureQuery, queryReference);
  return <strong data-contract-result>{data.viewer.name}</strong>;
}

export function createFixtureTree(): {
  dispose(): void;
  ready: Promise<void>;
  tree: ReactElement;
} {
  const environment = createWebappRelayEnvironment({
    auth,
    fetch: async () => ({
      json: async () => ({
        data: {
          viewer: {
            id: "fixture-viewer",
            name: EXPECTED_VIEWER_NAME,
          },
        },
      }),
      ok: true,
      status: 200,
    }),
    httpEndpoint: "https://fixture.invalid/graphql",
    realtime: {
      getClient: () => wsClient,
    },
  });
  const abortController = new AbortController();
  const operation = createOperationDescriptor(fixtureQuery, {});
  const initialSnapshot = environment.lookup(operation.fragment);
  let readinessSubscription: Disposable | undefined;
  const ready = new Promise<void>((resolve) => {
    if (!initialSnapshot.isMissingData) {
      resolve();
      return;
    }

    readinessSubscription = environment.subscribe(
      initialSnapshot,
      (snapshot) => {
        if (!snapshot.isMissingData) {
          readinessSubscription?.dispose();
          readinessSubscription = undefined;
          resolve();
        }
      },
    );
  });
  const queryReference = loadRouteQuery<FixtureOperationQuery>({
    abortSignal: abortController.signal,
    environment,
    fetchPolicy: "network-only",
    query: fixtureQuery,
    variables: {},
  });

  return {
    dispose: () => {
      readinessSubscription?.dispose();
      queryReference.dispose();
    },
    ready,
    tree: (
      <RelayEnvironmentProvider environment={environment}>
        <Suspense fallback={<span>Loading fixture</span>}>
          <FixtureView queryReference={queryReference} />
        </Suspense>
      </RelayEnvironmentProvider>
    ),
  };
}
