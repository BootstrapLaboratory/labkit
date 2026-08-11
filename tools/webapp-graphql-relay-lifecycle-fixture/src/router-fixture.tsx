import {
  createRouteQueryLifetime,
  loadRouteQuery,
  useRouteQueryLifetime,
  type RouteAbortSignal,
  type RouteQueryLifetime,
} from "@omgjs/labkit-webapp-graphql-relay";
import {
  Outlet,
  createRootRouteWithContext,
  createRoute,
  createRouter,
  useRouter,
  type RouterHistory,
} from "@tanstack/react-router";
import { useEffect, type ReactElement } from "react";
import { usePreloadedQuery, type PreloadedQuery } from "react-relay";
import type { Environment } from "relay-runtime";
import lifecycleItemQuery, {
  type LifecycleItemQuery,
} from "./__generated__/LifecycleItemQuery.graphql.js";
import lifecyclePrimaryQuery, {
  type LifecyclePrimaryQuery,
} from "./__generated__/LifecyclePrimaryQuery.graphql.js";
import lifecycleSecondaryQuery, {
  type LifecycleSecondaryQuery,
} from "./__generated__/LifecycleSecondaryQuery.graphql.js";
import { LifecycleLedger } from "./ledger.js";

type FixtureContext = {
  environment: Environment;
  ledger: LifecycleLedger;
};

type SingleLoaderData = {
  itemId: string;
  ledger: LifecycleLedger;
  queryLifetime: RouteQueryLifetime;
  queryReference: PreloadedQuery<LifecycleItemQuery>;
  referenceId: string;
};

type PairLoaderData = {
  itemId: string;
  ledger: LifecycleLedger;
  primaryQueryReference: PreloadedQuery<LifecyclePrimaryQuery>;
  primaryReferenceId: string;
  secondaryQueryReference: PreloadedQuery<LifecycleSecondaryQuery>;
  secondaryReferenceId: string;
  queryLifetime: RouteQueryLifetime;
};

export type LifecycleRouterOptions = {
  defaultGcTime?: number;
  defaultPreloadGcTime?: number;
  defaultPreloadStaleTime?: number;
  defaultStaleReloadMode?: "background" | "blocking";
  defaultStaleTime?: number;
  failPairAfterPrimary?: boolean;
};

function recordReferenceRelease(
  signal: RouteAbortSignal,
  ledger: LifecycleLedger,
  referenceId: string,
  operationName: string,
  itemId: string,
): void {
  signal.addEventListener(
    "abort",
    () => {
      ledger.record("reference-release", {
        itemId,
        operationName,
        referenceId,
      });
    },
    { once: true },
  );
}

export function createLifecycleRouter(
  history: RouterHistory,
  context: FixtureContext,
  options: LifecycleRouterOptions = {},
) {
  let nextReference = 1;
  const createReferenceId = (): string => {
    const referenceId = `reference-${nextReference}`;
    nextReference += 1;
    return referenceId;
  };
  const rootRoute = createRootRouteWithContext<FixtureContext>()({
    component: RootComponent,
    pendingComponent: PendingComponent,
  });
  const landingRoute = createRoute({
    component: LandingComponent,
    getParentRoute: () => rootRoute,
    path: "/",
  });
  const itemRoute = createRoute({
    component: ItemComponent,
    errorComponent: RouteErrorComponent,
    getParentRoute: () => rootRoute,
    loader: ({ abortController, context: routeContext, params, preload }) => {
      const itemId = params.itemId;
      const queryLifetime = createRouteQueryLifetime({
        routeAbortSignal: abortController.signal,
      });
      routeContext.ledger.record("loader-start", {
        itemId,
        operationName: "LifecycleItemQuery",
        preload,
      });
      const queryReference = loadRouteQuery<LifecycleItemQuery>({
        environment: routeContext.environment,
        fetchPolicy: "store-and-network",
        lifetime: queryLifetime,
        query: lifecycleItemQuery,
        variables: { id: itemId },
      });
      const referenceId = createReferenceId();
      routeContext.ledger.record("reference-create", {
        itemId,
        operationName: "LifecycleItemQuery",
        preload,
        referenceId,
      });
      recordReferenceRelease(
        queryLifetime.abortSignal,
        routeContext.ledger,
        referenceId,
        "LifecycleItemQuery",
        itemId,
      );
      return {
        itemId,
        ledger: routeContext.ledger,
        queryLifetime,
        queryReference,
        referenceId,
      } satisfies SingleLoaderData;
    },
    pendingComponent: PendingComponent,
    path: "items/$itemId",
  });
  const pairRoute = createRoute({
    component: PairComponent,
    errorComponent: RouteErrorComponent,
    getParentRoute: () => rootRoute,
    loader: ({ abortController, context: routeContext, params, preload }) => {
      const itemId = params.itemId;
      const queryLifetime = createRouteQueryLifetime({
        routeAbortSignal: abortController.signal,
      });
      routeContext.ledger.record("loader-start", {
        itemId,
        operationName: "LifecyclePrimaryQuery",
        preload,
      });
      const primaryQueryReference = loadRouteQuery<LifecyclePrimaryQuery>({
        environment: routeContext.environment,
        fetchPolicy: "store-and-network",
        lifetime: queryLifetime,
        query: lifecyclePrimaryQuery,
        variables: { id: itemId },
      });
      const primaryReferenceId = createReferenceId();
      routeContext.ledger.record("reference-create", {
        itemId,
        operationName: "LifecyclePrimaryQuery",
        preload,
        referenceId: primaryReferenceId,
      });
      recordReferenceRelease(
        queryLifetime.abortSignal,
        routeContext.ledger,
        primaryReferenceId,
        "LifecyclePrimaryQuery",
        itemId,
      );
      if (options.failPairAfterPrimary) {
        const error = new Error("Expected partial pair construction failure");
        queryLifetime.abort(error);
        throw error;
      }

      routeContext.ledger.record("loader-start", {
        itemId,
        operationName: "LifecycleSecondaryQuery",
        preload,
      });
      let secondaryQueryReference: PreloadedQuery<LifecycleSecondaryQuery>;
      try {
        secondaryQueryReference = loadRouteQuery<LifecycleSecondaryQuery>({
          environment: routeContext.environment,
          fetchPolicy: "store-and-network",
          lifetime: queryLifetime,
          query: lifecycleSecondaryQuery,
          variables: { id: itemId },
        });
      } catch (error) {
        queryLifetime.abort(error);
        throw error;
      }
      const secondaryReferenceId = createReferenceId();
      routeContext.ledger.record("reference-create", {
        itemId,
        operationName: "LifecycleSecondaryQuery",
        preload,
        referenceId: secondaryReferenceId,
      });
      recordReferenceRelease(
        queryLifetime.abortSignal,
        routeContext.ledger,
        secondaryReferenceId,
        "LifecycleSecondaryQuery",
        itemId,
      );
      return {
        itemId,
        ledger: routeContext.ledger,
        primaryQueryReference,
        primaryReferenceId,
        queryLifetime,
        secondaryQueryReference,
        secondaryReferenceId,
      } satisfies PairLoaderData;
    },
    pendingComponent: PendingComponent,
    path: "pairs/$itemId",
  });
  const routeTree = rootRoute.addChildren([landingRoute, itemRoute, pairRoute]);

  return createRouter({
    context,
    defaultGcTime: options.defaultGcTime ?? 0,
    defaultPendingMinMs: 0,
    defaultPendingMs: 0,
    defaultPreloadGcTime: options.defaultPreloadGcTime ?? 300_000,
    defaultPreloadStaleTime: options.defaultPreloadStaleTime ?? 30_000,
    defaultStaleReloadMode: options.defaultStaleReloadMode ?? "blocking",
    defaultStaleTime: options.defaultStaleTime ?? 0,
    history,
    routeTree,
  });

  function RootComponent(): ReactElement {
    return <Outlet />;
  }

  function LandingComponent(): ReactElement {
    return <main data-testid="landing">Landing</main>;
  }

  function PendingComponent(): ReactElement {
    return <main data-testid="pending">Loading</main>;
  }

  function ItemComponent(): ReactElement {
    const loaderData = itemRoute.useLoaderData() as unknown as SingleLoaderData;
    useRouteQueryLifetime(loaderData.queryLifetime);
    const data = usePreloadedQuery<LifecycleItemQuery>(
      lifecycleItemQuery,
      loaderData.queryReference,
    );
    loaderData.ledger.record("render", {
      itemId: loaderData.itemId,
      label: data.item.label,
      referenceId: loaderData.referenceId,
    });
    useEffect(() => {
      loaderData.ledger.record("mount", {
        itemId: loaderData.itemId,
        referenceId: loaderData.referenceId,
      });
      return () => {
        loaderData.ledger.record("unmount", {
          itemId: loaderData.itemId,
          referenceId: loaderData.referenceId,
        });
      };
    }, [loaderData]);
    return (
      <main data-item-id={data.item.id} data-testid="item">
        {data.item.label}
      </main>
    );
  }

  function PairComponent(): ReactElement {
    const loaderData = pairRoute.useLoaderData() as unknown as PairLoaderData;
    useRouteQueryLifetime(loaderData.queryLifetime);
    const primaryData = usePreloadedQuery<LifecyclePrimaryQuery>(
      lifecyclePrimaryQuery,
      loaderData.primaryQueryReference,
    );
    const secondaryData = usePreloadedQuery<LifecycleSecondaryQuery>(
      lifecycleSecondaryQuery,
      loaderData.secondaryQueryReference,
    );
    loaderData.ledger.record("render-pair", {
      itemId: loaderData.itemId,
      primaryReferenceId: loaderData.primaryReferenceId,
      secondaryReferenceId: loaderData.secondaryReferenceId,
    });
    useEffect(() => {
      loaderData.ledger.record("mount-pair", {
        itemId: loaderData.itemId,
        primaryReferenceId: loaderData.primaryReferenceId,
        secondaryReferenceId: loaderData.secondaryReferenceId,
      });
      return () => {
        loaderData.ledger.record("unmount-pair", {
          itemId: loaderData.itemId,
          primaryReferenceId: loaderData.primaryReferenceId,
          secondaryReferenceId: loaderData.secondaryReferenceId,
        });
      };
    }, [loaderData]);
    return (
      <main data-testid="pair">
        <span data-testid="primary">{primaryData.item.label}</span>
        <span data-testid="secondary">{secondaryData.secondaryItem.label}</span>
      </main>
    );
  }

  function RouteErrorComponent({ error }: { error: unknown }): ReactElement {
    const router = useRouter();
    const message = error instanceof Error ? error.message : String(error);
    return (
      <main data-testid="route-error">
        <span>{message}</span>
        <button
          data-testid="retry"
          onClick={() => {
            context.ledger.record("route-retry");
            void router.invalidate({ forcePending: true, sync: true });
          }}
          type="button"
        >
          Retry
        </button>
      </main>
    );
  }
}
