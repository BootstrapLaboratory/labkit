---
id: "tutorial"
title: "Tutorial"
sidebar_label: "Tutorial"
description: "Guided architecture build-out."
---

This tutorial explains how Labkit helps build a full GraphQL server/client app
without copying a whole application framework into every project.

The complete reference implementation is
[deployed here](https://bootlab-example-rush-delivery.pages.dev/) and lives in
the
[typescript_monorepo_nestjs_relay_trunk repository](https://github.com/BootstrapLaboratory/typescript_monorepo_nestjs_relay_trunk).

## What We Are Building

The tutorial builds the architecture behind a real-time app:

- NestJS GraphQL server;
- React/Vite webapp;
- Relay data layer;
- memory access-token auth;
- HttpOnly refresh cookie flow;
- GraphQL websocket subscriptions;
- TypeORM/PostgreSQL feature manifests;
- app-owned UI and feature code over Labkit runtime packages.

The chapters focus on ownership. Labkit removes repeated runtime setup, but it
does not remove app decisions.
