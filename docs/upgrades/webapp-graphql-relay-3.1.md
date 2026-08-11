# Upgrade Webapp GraphQL Relay To 3.1

`@omgjs/labkit-webapp-graphql-relay` 3.1 adds explicit route-query lifetime
ownership for Relay query references created by a router loader. Applications
that pass a TanStack Router loader signal directly to `loadRouteQuery` should
migrate mounted route queries to the lifetime API.

The change is additive. Existing raw-`abortSignal` calls still compile and keep
their abort-scoped semantics, but that input is now deprecated. A loader signal
alone is not sufficient when React can keep the previous route mounted while
replacement data is pending.

## Upgrade The Package

Keep the application-owned Relay pair exact while upgrading Labkit:

```bash
npm install @omgjs/labkit-webapp-graphql-relay@^3.1.0 \
  react-relay@20.1.1 relay-runtime@20.1.1
```

With pnpm:

```bash
pnpm add @omgjs/labkit-webapp-graphql-relay@^3.1.0 \
  react-relay@20.1.1 relay-runtime@20.1.1
```

Run the Relay compiler and TypeScript check after the code migration below.
The 3.1 package keeps the 3.0 Relay peer contract and adds no TanStack runtime
dependency.

## Who Needs To Migrate

Migrate when all of these are true:

- a route loader creates one or more Relay preloaded query references;
- the route component consumes them with `usePreloadedQuery`;
- the loader passes its router abort signal directly to `loadRouteQuery`.

Code that loads work which is guaranteed never to become a mounted React
resource can temporarily keep the deprecated raw `abortSignal` path. Do not
use that path for a preload that may later be promoted into a mounted route.

The required Relay peer pair remains `react-relay@20.1.1` and
`relay-runtime@20.1.1`.

## Before

This pattern can dispose the previous route's query reference while React is
still presenting that route during a pending navigation:

```ts
loader: ({ abortController, context, params }) => ({
  queryRef: loadRouteQuery({
    abortSignal: abortController.signal,
    environment: context.relayEnvironment,
    query: UserRouteQuery,
    variables: { id: params.userId },
  }),
});
```

## After: One Query

Create one lifetime for the loader invocation. Pass it to `loadRouteQuery`,
return the lifetime with the query reference, and mount the lifetime hook in
the route component before consuming the query reference.

```tsx
import {
  createRouteQueryLifetime,
  loadRouteQuery,
  useRouteQueryLifetime,
} from "@omgjs/labkit-webapp-graphql-relay";
import { usePreloadedQuery } from "react-relay";

export const userRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "users/$userId",
  pendingComponent: UserRoutePending,
  loader: ({ abortController, context, params }) => {
    const queryLifetime = createRouteQueryLifetime({
      routeAbortSignal: abortController.signal,
    });

    try {
      return {
        queryLifetime,
        queryRef: loadRouteQuery({
          environment: context.relayEnvironment,
          fetchPolicy: "store-and-network",
          lifetime: queryLifetime,
          query: UserRouteQuery,
          variables: { id: params.userId },
        }),
      };
    } catch (error) {
      queryLifetime.abort(error);
      throw error;
    }
  },
  component: UserRoute,
});

function UserRoute() {
  const { queryLifetime, queryRef } = userRoute.useLoaderData();
  useRouteQueryLifetime(queryLifetime);
  const data = usePreloadedQuery(UserRouteQuery, queryRef);

  return <main>{data.user.name}</main>;
}
```

The route signal owns the lifetime while loader work is pending or cached. The
hook adds mounted ownership. A router abort releases the route owner, but Relay
work is disposed only after the final mounted owner also releases it. Network
completion does not release ownership.

## Multiple Queries And Partial Construction

Use one lifetime for every query reference created by the same loader. If
construction fails after any reference was created, call `abort(error)` before
rethrowing so all already-created work is released.

```ts
loader: ({ abortController, context, params }) => {
  const queryLifetime = createRouteQueryLifetime({
    routeAbortSignal: abortController.signal,
  });

  try {
    const profileQueryRef = loadRouteQuery({
      environment: context.relayEnvironment,
      lifetime: queryLifetime,
      query: ProfileRouteQuery,
      variables: { id: params.userId },
    });
    const permissionsQueryRef = loadRouteQuery({
      environment: context.relayEnvironment,
      lifetime: queryLifetime,
      query: PermissionsRouteQuery,
      variables: { id: params.userId },
    });

    return { queryLifetime, profileQueryRef, permissionsQueryRef };
  } catch (error) {
    queryLifetime.abort(error);
    throw error;
  }
};
```

The component calls `useRouteQueryLifetime(queryLifetime)` once, then consumes
both references. The references may resolve, fail, or retry independently; the
lifetime releases the group only when its final owner is gone.

The `lifetime` and `abortSignal` inputs are mutually exclusive. The lifetime's
child `abortSignal` is still available for composing other abort-aware work
into the same ownership domain, but it should not be passed back to
`loadRouteQuery`.

If application code wraps `loadRouteQuery`, change mounted-route wrapper
parameters to `LoadRouteQueryLifetimeOptions<TQuery>`. The existing
`LoadRouteQueryOptions<TQuery>` name remains source-compatible for abort-only
wrappers, but it is deprecated. Keeping separate public types avoids forcing a
3.1 compile break on existing wrappers while making the lifetime-first overload
the primary API.

## Router Policy

The validated TanStack Router policy reloads before rendering a query reference
from a retired loader invocation:

```ts
const router = createRouter({
  routeTree,
  context,
  defaultGcTime: 0,
  defaultStaleTime: 0,
  defaultPreloadStaleTime: 30_000,
  defaultStaleReloadMode: "blocking",
});
```

Also provide an explicit route `pendingComponent`. Keep these ownership rules:

- do not reuse loader data containing a released query reference;
- do not use a timeout or grace period to delay disposal;
- let the router signal release loader/preload ownership;
- let `useRouteQueryLifetime` release mounted ownership;
- call terminal `abort(error)` on partial construction failure;
- create a fresh lifetime and fresh references for retry or replacement;
- keep product history, freshness, retry UI, and route structure app-owned.

Preload promotion uses the same loader lifetime. An unused preload is released
when the router retires or clears it. A promoted preload gains mounted ownership
when its component commits.

## Strict Mode And Suspense

No application-specific Strict Mode workaround is required. The hook holds
complementary commit-time and passive mounted leases. This covers the interval
before passive effects run and prevents Suspense's temporary layout-effect
disconnection from releasing a query reference whose previous UI is still
visible.

Do not call `createRouteQueryLifetime` or `loadRouteQuery` during React render.
Create them in the loader and call the hook unconditionally in the route
component.

## Retry, Errors, And Teardown

On retry or invalidation, create a new loader lifetime. The old lifetime stays
valid while its mounted UI remains visible and releases after replacement
commits. Late responses from superseded work cannot re-own a terminal lifetime.

For application shutdown or a recreated router/runtime:

1. navigate to a route that owns no Relay query references when practical;
2. clear retired router cache entries;
3. unmount the React root;
4. dispose the application Relay/realtime runtime.

Every release callback and terminal `abort()` call is idempotent. Do not retain
a lifetime or query reference across Relay environment or router recreation.

## Verification Checklist

After migrating:

1. run Relay compilation, TypeScript checking, and the production Vite build;
2. verify initial entry, pending replacement, rapid navigation, back/forward,
   preload promotion/cancel, retry, and final teardown;
3. repeat pending replacement and multi-query paths under React Strict Mode;
4. confirm the supported single Relay runtime graph described in the
   [package reference](../packages/webapp-graphql-relay.md#required-relay-peers).

See [Webapp Composition](../webapp-composition.md) for the application boundary
and the [GraphQL Contract](../graphql-contract.md) for query ownership rules.
