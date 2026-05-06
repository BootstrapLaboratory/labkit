---
title: "Browser Auth Security"
sidebar_label: "Browser Auth Security"
---

The default Labkit browser auth model keeps access tokens in memory and refresh
tokens outside JavaScript-readable storage.

## Access Token

The access token lives in `createWebappAuthSession` state. It disappears on
page reload. This reduces long-lived token exposure in localStorage.

## Session Hint

The browser stores only a non-secret hint such as:

```json
{ "kind": "authenticated", "updatedAt": 1760000000000 }
```

The hint lets the UI show a pending authenticated state while the refresh call
checks the HttpOnly cookie.

## Refresh Cookie

Cookie refresh transport requires:

- server CORS credentials enabled;
- browser requests with credentials included;
- matching cookie path and GraphQL path;
- compatible `SameSite` and `Secure` values for the runtime origin.

Labkit provides helpers on both sides, but the app owns the actual runtime
values.

## Logout

The browser clears local state before trying server logout. A stale cookie
should not trap the user in an authenticated UI.
