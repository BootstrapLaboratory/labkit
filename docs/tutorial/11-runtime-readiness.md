# Runtime Readiness

Labkit docs do not teach deployment. They do explain runtime constraints that
must be correct before any deployment platform can work.

## Check These Inputs

- `GRAPHQL_PATH` matches browser HTTP and websocket endpoint paths.
- `CORS_ORIGIN` includes the webapp origin when cookie auth is used.
- Refresh cookie path, `SameSite`, and `Secure` match the runtime origin.
- `VITE_GRAPHQL_HTTP` and `VITE_GRAPHQL_WS` are present in production builds.
- Database synchronization is disabled when migrations run.
- Realtime pub/sub is shared when the server scales beyond one process.
- Server and browser package formats are consumed from package root imports.

## What To Link Out

Use Rush Delivery, the reference app, or your app's deployment docs for:

- cloud provider setup;
- CI credentials;
- package release;
- static hosting;
- backend runtime services;
- database provider provisioning.

Labkit stays focused on library behavior and application runtime composition.
