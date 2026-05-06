---
title: "Project Foundation"
sidebar_label: "Project Foundation"
---

Start simple: one server package and one webapp package. Use npm workspaces,
pnpm workspaces, or another plain package manager while learning.

Rush is recommended for production monorepos because it gives deterministic
installs, dependency-aware builds, change files, and package publishing
workflow. Rush Delivery adds CI/release/deployment orchestration around Rush.

Labkit itself does not require Rush at runtime.

## Suggested Local Shape

```text
server/
  src/app.module.ts
  src/main.ts
  src/modules/*
webapp/
  src/app/*
  src/features/*
  src/shared/*
```

Keep Labkit adapters in `shared` or `modules` folders, and keep product
features in product folders. This makes it clear when code is reusable
runtime glue versus application behavior.

## Production References

- Rush Delivery tutorial:
  [Rush Delivery Tutorial](https://bootstraplaboratory.github.io/rush-delivery/docs/tutorial/)
- Rush documentation: [Rush](https://rushjs.io/)
- Complete reference app:
  [typescript_monorepo_nestjs_relay_trunk](https://github.com/BootstrapLaboratory/typescript_monorepo_nestjs_relay_trunk)
