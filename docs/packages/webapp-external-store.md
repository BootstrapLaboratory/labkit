# @omgjs/labkit-webapp-external-store

Tiny subscription-store primitive for browser runtime state.

## Install

```bash
npm install @omgjs/labkit-webapp-external-store
```

Runtime: browser or framework-light UI runtime. Package format: CommonJS and
ESM.

## Public API Groups

- `createExternalStore`.
- `ExternalStore`, listener, updater, and unsubscribe types.

## Owns

This package owns snapshot reads, snapshot writes, functional updates,
subscriptions, unsubscriptions, and manual emit.

## App Still Owns

The app owns React hooks, persistence, server state, auth policy, realtime
policy, theme policy, and any domain-specific store shape.

## Minimal Usage

```ts
import { createExternalStore } from "@omgjs/labkit-webapp-external-store";

const counter = createExternalStore({ value: 0 });

const unsubscribe = counter.subscribe(() => {
  console.log(counter.getSnapshot());
});

counter.updateSnapshot((snapshot) => ({ value: snapshot.value + 1 }));
unsubscribe();
```

## Runtime Notes

Wrap `subscribe` and `getSnapshot` with `useSyncExternalStore` in app-owned
React hooks.

Package README and source:
[`../../packages/webapp-external-store/README.md`](../../packages/webapp-external-store/README.md),
[`../../packages/webapp-external-store/src/index.ts`](../../packages/webapp-external-store/src/index.ts).
