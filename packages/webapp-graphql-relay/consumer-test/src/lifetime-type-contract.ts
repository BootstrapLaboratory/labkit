import type {
  LoadRouteQueryLifetimeOptions,
  LoadRouteQueryOptions,
  RouteAbortSignal,
  RouteQueryLifetime,
} from "@omgjs/labkit-webapp-graphql-relay";
import type { Environment, OperationType } from "relay-runtime";

type LifetimeContractQuery = OperationType & {
  readonly response: { readonly viewer: { readonly id: string } };
  readonly variables: Record<string, never>;
};

const baseOptions = {
  environment: {} as Environment,
  query: {} as never,
  variables: {},
};
const lifetime = {} as RouteQueryLifetime;
const abortSignal = {} as RouteAbortSignal;

export const lifetimeOptions: LoadRouteQueryLifetimeOptions<LifetimeContractQuery> =
  {
    ...baseOptions,
    lifetime,
  };

export const legacyAbortOptions: LoadRouteQueryOptions<LifetimeContractQuery> =
  {
    ...baseOptions,
    abortSignal,
  };

export const mixedOwnershipOptions: LoadRouteQueryLifetimeOptions<LifetimeContractQuery> =
  {
    ...baseOptions,
    // @ts-expect-error The lifetime and raw abort-signal inputs are exclusive.
    abortSignal,
    lifetime,
  };

// @ts-expect-error Every route query load requires one ownership input.
export const missingOwnershipOptions: LoadRouteQueryLifetimeOptions<LifetimeContractQuery> =
  baseOptions;
