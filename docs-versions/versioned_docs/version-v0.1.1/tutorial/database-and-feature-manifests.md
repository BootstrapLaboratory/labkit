---
title: "Database And Feature Manifests"
sidebar_label: "Database And Feature Manifests"
---

Feature manifests make database ownership explicit.

Auth persistence comes from `@omgjs/labkit-server-auth-typeorm`. Product
features export their own entities and migrations. The app composes both into
one TypeORM configuration.

## Manifest Pattern

```ts
export const featureDatabaseManifest = {
  entities: [FeatureEntity],
  migrations: [CreateFeatureTable20260501000000],
};
```

```ts
const manifest = composeServerDatabaseManifests([
  serverAuthTypeormDatabaseManifest,
  featureDatabaseManifest,
]);
```

## Migration Rule

Labkit helps detect unsafe runtime flags, but the app decides when migrations
run. Keep `synchronize` local-only. Runtime environments should run known
migrations with synchronization disabled.

The reference app keeps feature database manifests near the feature modules
that own the entities.
