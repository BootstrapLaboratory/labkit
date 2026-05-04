# @omgjs/labkit-webapp-external-store

`@omgjs/labkit-webapp-external-store` is a tiny browser-safe subscription store
primitive.

It exists so auth, realtime, and theme state can share one tested store shape
without pulling in React directly.

## Owns

- `createExternalStore`.
- Snapshot reads and writes.
- Functional snapshot updates.
- Listener subscription and unsubscribe mechanics.
- Manual emit support.

## Does Not Own

- React hooks.
- Persistence or storage backends.
- Auth, realtime, or theme policy.
- Server-side state.

## Usage

```ts
import { createExternalStore } from "@omgjs/labkit-webapp-external-store";

const store = createExternalStore({ count: 0 });

store.subscribe(() => {
  console.log(store.getSnapshot());
});

store.updateSnapshot((snapshot) => ({ count: snapshot.count + 1 }));
```

Apps can wrap `subscribe` and `getSnapshot` with `useSyncExternalStore` in
app-owned React hooks.

## Package Format

This package publishes both CommonJS and ESM entry points. Browser bundlers
should use the ESM import entry automatically.
