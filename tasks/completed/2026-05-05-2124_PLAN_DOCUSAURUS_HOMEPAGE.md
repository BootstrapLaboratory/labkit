# Plan Docusaurus Homepage

## Status

Completed.

## Goal

Replace the copied Rush Delivery homepage with a Labkit homepage that introduces
`BootstrapLaboratory | Labkit` clearly, routes users into Docs, Quick Start,
and Tutorial, and gives a prominent accent to the production-grade reference
implementation.

## Current Problem

The current homepage still talks like Rush Delivery:

- browser title is effectively `Rush Delivery | Labkit`;
- hero copy says "Dagger module for Rush monorepos";
- primary heading is `DETECT / BUILD / PACKAGE / DEPLOY / VALIDATE`;
- code examples are Rush Delivery CI examples;
- visual asset is the Rush Delivery orbital pipeline.

This should become a Labkit-specific homepage. Rush and Rush Delivery can be
linked as production monorepo references, but they should not be the homepage
frame.

## Page Title

Use Docusaurus `Layout` title:

```tsx
<Layout
  title="BootstrapLaboratory"
  description="Labkit packages for Nest GraphQL, Relay, auth, realtime, and TypeORM application runtimes."
>
```

Expected browser/page title: `BootstrapLaboratory | Labkit`.

## Proposed Homepage Structure

### 1. Hero

Purpose: immediate identity and positioning.

Content:

- eyebrow: `BootstrapLaboratory / Labkit`
- heading: `Reusable runtime packages for serious GraphQL apps`
- short copy: explain NestJS server, React/Vite/Relay webapp, auth, realtime,
  database manifests, and browser runtime helpers in one compact paragraph.
- primary CTA: `Quick Start`
- secondary CTA: `Tutorial`
- tertiary link or compact CTA: `Package Docs`

Visual:

- use a Labkit cat/laboratory-kitty asset as the main mark or hero visual;
- do not switch the navbar logo as part of this task unless explicitly chosen.

### 2. Production-Grade Example Accent

Purpose: make the working example feel important, trustworthy, and presentable.

This should be a second hero-like block or large accent box, not a small footer
link. It should be cute, confident, and visually distinct from normal content.

Content:

- heading idea: `See Labkit in a production-grade app`
- supporting copy: the reference app shows the full stack assembled with
  NestJS, GraphQL, Relay, auth sessions, realtime subscriptions, TypeORM, and
  production monorepo conventions.
- big primary link:
  [Open the working example](https://bootlab-example-rush-delivery.pages.dev/)
- secondary link:
  [View the source tree](https://github.com/BootstrapLaboratory/typescript_monorepo_nestjs_relay_trunk)

Presentation notes:

- enough font size and spacing to feel like a real showcase;
- use a cute wrapper, such as a lab-kitty badge/mark, without making it childish;
- make it clear this is a complete reference implementation, not a toy demo.

### 3. Runtime Pillars

Purpose: explain the core value in four scannable blocks.

Blocks:

- `Server GraphQL`: Nest/Apollo context, HTTP and websocket GraphQL setup,
  subscription logging.
- `Auth And Sessions`: principal contract, access tokens, refresh cookies,
  lifecycle events.
- `Browser Runtime`: Relay environment, auth session, realtime reconnects,
  route preloading.
- `Database Manifests`: TypeORM composition, auth persistence adapter,
  migration safety.

Each block should link to the relevant docs page.

### 4. Architecture Code Switcher

Purpose: replace Rush Delivery CI snippets with Labkit runtime snippets.

Tabs:

- `Server Module`: `createServerAuthAccessTokenGraphqlModule`.
- `Auth Wiring`: identity provider registry and refresh-token transport
  providers.
- `Relay Environment`: `createWebappRelayEnvironment`.
- `Database Manifest`: `composeServerDatabaseManifests`.

Homepage snippets should be short. Full copy-paste code belongs in Quick Start.

### 5. Package Map

Purpose: help package-oriented users find the right entry point quickly.

Groups:

- Shared contracts.
- Server runtime.
- Server auth.
- Browser runtime.
- Tooling.

Each group should link to Package Groups or direct package docs.

### 6. Choose Your Path

Purpose: final navigation block.

Cards:

- `Start From Scratch` -> Quick Start.
- `Understand The Architecture` -> Tutorial.
- `Use A Package` -> Package Groups.

## Authoring Approach

Keep homepage content in `website-docusaurus/src/pages/index.tsx` using small
typed arrays:

```ts
const pillars = [];
const examples = [];
const packageGroups = [];
const paths = [];
```

This keeps copy easy to review and avoids scattering content across JSX.

Expected file scope:

- `website-docusaurus/src/pages/index.tsx`
- `website-docusaurus/src/pages/index.module.css`
- `website-docusaurus/docusaurus.config.ts`

Optional file scope only if explicitly chosen:

- `website-docusaurus/static/img/logo.svg`
- `website-docusaurus/static/img/favicon.svg`
- `website-docusaurus/static/img/logo-options/*`

## Content To Remove

- Rush Delivery hero text.
- Dagger/Rush CI code examples.
- `DETECT / BUILD / PACKAGE / DEPLOY / VALIDATE`.
- Rush Delivery orbital pipeline as the main homepage visual.
- Deployment/release messaging, except links in the reference/production
  monorepo context.

## Validation

- Run `npm run site:docusaurus:check`.
- Review desktop and mobile homepage layout after implementation.
- Verify links:
  - Quick Start.
  - Tutorial.
  - Package Groups.
  - working example.
  - source repository.

## Checklist

- [x] Replace homepage page title and meta description.
- [x] Replace hero content with Labkit positioning.
- [x] Add prominent production-grade example accent block.
- [x] Replace Rush Delivery examples with Labkit architecture snippets.
- [x] Add runtime pillars.
- [x] Add package map.
- [x] Add choose-your-path navigation block.
- [x] Remove Rush Delivery homepage visual/copy.
- [x] Validate Docusaurus build.
