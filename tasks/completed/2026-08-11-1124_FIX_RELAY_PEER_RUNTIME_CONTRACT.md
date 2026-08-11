# Fix Relay Peer Runtime Contract

Status: completed and released on 2026-08-11.
Created: 2026-08-11
Classification: packaging/runtime bug with a breaking public package-contract
change.
Primary package: `@omgjs/labkit-webapp-graphql-relay`.
Released version:
[`@omgjs/labkit-webapp-graphql-relay@3.0.0`](https://www.npmjs.com/package/@omgjs/labkit-webapp-graphql-relay/v/3.0.0).
Release guidance: fulfilled by the package-scoped major Rush change and the
post-merge CI release flow.
Related follow-up:
[Harden TanStack Router and Relay Route-Query Lifecycles](../2026-08-11-1124_HARDEN_TANSTACK_RELAY_ROUTE_LIFECYCLES.md).

## Decision Summary

`@omgjs/labkit-webapp-graphql-relay` creates Relay environments and preloaded
query references that are consumed by application-owned React providers and
hooks. Before this fix, the package installed `react-relay` and `relay-runtime`
as private production dependencies. A consumer could therefore execute one
Relay implementation inside Labkit and another in application code.

The correction is to make the consumer own one explicitly supported Relay
version pair:

- move `react-relay` and `relay-runtime` from `dependencies` to required,
  non-optional `peerDependencies`;
- keep the same pair in `devDependencies` so Labkit can build and test itself;
- initially support the exact `20.1.1`/`20.1.1` pair;
- prove canonical module identity through publish-equivalent consumer tests;
- document direct consumer installation and migration;
- release the new dependency expectation as a major package-contract change.

Do not use a Vite alias, package-manager override, or application-specific
dedupe setting as the library fix. Such settings may be diagnostic tools, but
the published package must not own a private stateful Relay graph.

## Confirmed Repository Evidence

- Before this fix, the
  [package manifest](../../packages/webapp-graphql-relay/package.json) declared
  `react-relay` and `relay-runtime` as `^20.1.1` production dependencies. The
  range resolved to 20.1.1 in the Rush lockfile.
- The [package source](../../packages/webapp-graphql-relay/src/index.ts) imports
  runtime values from both packages, creates Relay `Environment` instances,
  and calls React Relay `loadQuery` through `loadRouteQuery`.
- Public option and return types also reference Relay types, so type-resolution
  behavior is part of the consumer contract.
- `react-relay@20.1.1` depends on exactly `relay-runtime@20.1.1` in
  [the lockfile](../../common/config/rush/pnpm-lock.yaml). Two independent broad
  peer ranges would not express that correlated pair requirement.
- Labkit already declares React as a peer and development dependency in the
  package manifest.
- The pre-fix metadata contradicted the
  [package groups documentation](../../docs/package-groups.md), which assigns
  React and Relay ownership to the application.
- The package publishes CommonJS, ESM, and declaration entrypoints. All three
  consumer surfaces must resolve the consumer-owned Relay pair.

## Goals

- Prevent supported consumers from installing or bundling a Labkit-private
  `react-relay` or `relay-runtime` implementation.
- Make the exact supported Relay pair explicit in package metadata, tests, and
  documentation.
- Produce a deterministic diagnostic before application rendering when a
  consumer selects an unsupported or mismatched pair, according to the tested
  package-manager mode.
- Verify the packed npm artifact rather than relying only on workspace links or
  source-level unit tests.
- Prove that Labkit-created environments and query references interoperate with
  application-owned `RelayEnvironmentProvider`, `usePreloadedQuery`, and Relay
  runtime imports.
- Preserve both CommonJS and ESM package entrypoints.
- Give existing consumers an actionable migration path.
- Prepare the correct Rush release metadata and let the repository's post-merge
  CI publish the package.

## Non-Goals

- Do not claim Relay 21 or any other additional Relay pair is supported.
- Do not use a broad or multi-major peer range until every admitted pair and
  cross-pair combination has an enforceable compatibility strategy.
- Do not redesign `loadRouteQuery` ownership, TanStack Router cache behavior,
  browser history, retry behavior, or multi-query route lifecycles here. Those
  belong to the related lifecycle task.
- Do not add TanStack Router to the public package dependencies or peers.
- Do not make `@types/react-relay`, `@types/relay-runtime`, or
  `relay-compiler` runtime peers merely because a fixture needs them. Audit and
  document their consumer development-time role separately.
- Do not add bundler aliases, package-manager overrides, or forced hoisting as
  the supported production solution.
- Do not change unrelated GraphQL, authentication, or realtime behavior.
- Do not manually edit package versions or changelogs.
- Do not publish directly from the local workspace. Repository commits, pull
  requests, and the configured post-merge CI release are in scope for this
  execution.
- Do not hand-edit generated Docusaurus docs or archived documentation.

## Architecture And Contract Rules

### Required peers

Both Relay packages are required peers because the source imports them
unconditionally. Marking either peer optional would replace a dependency
diagnostic with a missing-module or incompatible-runtime failure.

The initial supported pair is:

| Package         | Supported version |
| --------------- | ----------------- |
| `react-relay`   | `20.1.1`          |
| `relay-runtime` | `20.1.1`          |

Use exact peer and development versions for this release. If independent
testing proves another pair should be supported, stop and update the contract
design before widening metadata. A range such as `^20.1.1` or a union of two
majors cannot by itself guarantee that `react-relay` and the consumer's direct
`relay-runtime` selection remain a matched pair.

Keep the existing React peer unless the supported-pair tests prove its current
range is incompatible. The fixture must select a React version inside the
intersection of Labkit's and React Relay's declared peer ranges.

### Meaning of runtime coherence

For a supported consumer, all of the following must resolve the same canonical
implementation of each Relay package:

- application imports;
- Labkit's CommonJS entrypoint;
- Labkit's ESM entrypoint;
- the `react-relay` dependency on `relay-runtime`;
- the Vite production module graph.

Peer metadata expresses the supported contract, but it cannot defeat consumer
flags that ignore peers, aliases, overrides, or package managers that only warn
on conflicts. Scope the guarantee to consumers that satisfy the required peers
without such escape hatches.

### Package-manager behavior

Pin and record every package-manager mode in the fixture. At minimum cover:

- npm as bundled with the repository's supported Node 24 runtime;
- pnpm 10.33.2 with its normal isolated linker behavior;
- strict-peer modes for deterministic negative-case failure.

A normal unsupported install may either fail or emit a captured, actionable
peer diagnostic depending on the manager and configuration. A strict negative
fixture must fail before typecheck, build, or render. Do not assert that every
package manager always hard-fails by default.

## Publish-Equivalent Consumer Fixture

Create package-owned private fixture sources outside the package's compiled
`test` tree, for example:

`packages/webapp-graphql-relay/consumer-test`

The fixture and its runner must not be included in the published package. Do
not place TypeScript fixture sources under the current `test/**/*.ts` include,
because those files compile into `dist` and the package publishes
`dist/**/*`.

Add one stable repository command that:

1. builds the publishable packages;
2. creates a temporary release directory and independent `git clone --no-local`
   under an exact `mktemp -d` root, then overlays the current checkout without
   sharing mutable package sources or Git remotes;
3. uses Rush 5.175.0's tarball flow only inside that disposable clone
   (`rush publish --publish --pack --include-all --release-folder <temp>`),
   which requires `--publish` to execute but diverts output to local tarballs
   because `--pack` is present;
4. keeps the executable publish-mode command isolated as defense in depth;
   Rush 5.175.0's `--include-all --pack` branch does not apply pending change
   files, but a future command regression or accidental flag must not mutate
   the live checkout;
5. never passes apply, commit, tagging, or registry flags, and confirms from
   Rush output, source inspection, and the temporary release directory that
   the command only invokes `pnpm pack` and does not publish to a registry;
6. installs the local tarball and its local first-party dependency closure into
   clean consumer directories;
7. runs the npm and pnpm matrices without workspace linking;
8. removes only the exact clone and temporary directories it created;
9. preserves useful install logs as CI artifacts when a case fails.

The consumer must import Labkit from its package root. It must not import
`src`, use a workspace symlink, or silently substitute a registry copy of the
package under test. Inspect the packed manifest to confirm Rush replaced every
`workspace:*` reference appropriately.

Keep the orchestration outside a nested Rush bulk command if Rush cannot safely
invoke its pack flow recursively. Prefer a root script and a dedicated PR
validation step after the normal Rush build/test/verify sequence.

### Fixture application

Use a small, domain-neutral React/Vite application containing:

- one minimal GraphQL schema;
- one fixture-owned Relay operation and compiler-generated artifact;
- a deterministic in-memory or mocked GraphQL transport;
- a Labkit-created Relay environment;
- `loadRouteQuery` using the default React Relay loader;
- an application-owned `RelayEnvironmentProvider`;
- an application-owned component that reads the reference with
  `usePreloadedQuery`;
- an assertion that a known non-null field renders successfully.

Pin compatible `react`, `react-dom`, `relay-compiler`,
`@types/react-relay`, and `@types/relay-runtime` versions in the fixture. Do not
use a production service, product schema, network sleeps, warmed store, or
application-specific authentication.

### Required consumer matrix

| ID  | Install shape                                                   | Expected result                                                                                                                                     |
| --- | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| S1  | npm with both exact supported peers declared directly           | Clean install, typecheck, CJS/ESM checks, Vite build, and render smoke pass without peer diagnostics                                                |
| S2  | isolated pnpm with both exact supported peers declared directly | Same result as S1 and one canonical Relay graph                                                                                                     |
| S3  | strict npm and pnpm modes with the supported pair               | Both installs succeed without missing or invalid peers                                                                                              |
| N1  | one synthetic or pinned unsupported coherent pair               | Normal mode fails or emits the expected peer diagnostic; strict mode fails before build/render                                                      |
| N2  | `react-relay` and `relay-runtime` selected from different pairs | The mismatch is diagnosed; strict mode fails before build/render                                                                                    |
| N3  | one required Relay peer omitted                                 | Missing-peer behavior is recorded, including manager auto-installation where applicable; the documented contract still requires a direct dependency |

Do not use `--force`, legacy peer modes, aliases, overrides, hoisted linkers, or
manual edits of installed packages to make a matrix case pass.

Prefer tiny local packages with the Relay package names and deliberately
unsupported versions for peer-resolution-only negative cases. Never execute
those stubs. This keeps the permanent diagnostic test independent of an
unvalidated or later-unpublished Relay release.

### Resolution assertions

For each supported install:

- record package-manager dependency output;
- resolve both Relay package paths from the application and from the installed
  Labkit package context;
- resolve `relay-runtime` from the installed `react-relay` context;
- compare canonical real paths and versions;
- assert there is no nested private Relay implementation below Labkit;
- assert the Vite production graph contains only the supported implementation;
- run a CommonJS require smoke test;
- run an ESM import smoke test;
- compile a consumer with `skipLibCheck` disabled;
- run the real provider/query-hook rendering smoke test.

Do not infer identity solely from matching version strings or successful
rendering.

## Work Plan

### Phase 1 - Independent Baseline And Artifact Harness

- [x] Read `AGENTS.md`, `.ai/conventions.md`, `.ai/architecture.md`, and the
      task-specific task-file, documentation, and library-release rules before
      implementation.
- [x] Read the current package manifest, source imports, lockfile, entrypoints,
      package docs, and release rules before editing.
- [x] Inspect `git status --short` and preserve unrelated changes.
- [x] Record the exact Node, npm, Rush, pnpm, React, and Relay versions used by
      the repository.
- [x] Capture the current workspace and packed dependency graphs, clearly
      distinguishing manifest ranges from resolved versions.
- [x] Establish the publish-equivalent pack command and prove that local
      first-party tarballs, rather than registry or workspace copies, are under
      test.
- [x] Add the isolated consumer runner, fixture schema, operation, generated
      artifact, and deterministic transport.
- [x] Reproduce the current private-versus-consumer graph at the package
      resolution boundary before changing metadata.
- [x] Keep pre-fix diagnostic evidence, but do not make an unsupported runtime
      rendering failure the permanent post-fix expectation.

Phase 1 is complete when the repository can deterministically inspect and
exercise the publish-equivalent artifact outside the Rush workspace graph.

### Phase 2 - Correct Package Metadata

- [x] Remove `react-relay` and `relay-runtime` from production dependencies.
- [x] Add both as required exact `20.1.1` peer dependencies.
- [x] Add both as exact `20.1.1` development dependencies.
- [x] Preserve the compatible React peer and development setup.
- [x] Regenerate Rush/pnpm install state using repository commands; do not hand
      edit the lockfile.
- [x] Build CommonJS, ESM, and declarations and confirm they retain bare Relay
      imports resolved by the consumer.
- [x] Inspect the tarball manifest and contents.
- [x] Confirm that satisfying peers does not install a Labkit-private Relay
      implementation.

Phase 2 is complete when package metadata and the packed artifact express the
same exact, consumer-owned Relay contract.

### Phase 3 - Permanent Contract Tests And CI

- [x] Implement every supported and negative matrix row.
- [x] Add canonical path/version assertions for the application, Labkit,
      React Relay, CommonJS, ESM, and Vite boundaries.
- [x] Add consumer typechecking with strict library checks.
- [x] Add the real provider/load/read rendering smoke test.
- [x] Ensure the supported cases produce no peer warning or unexpected console
      error.
- [x] Ensure strict negative cases stop before rendering.
- [x] Add a stable root command for the packed-consumer contract.
- [x] Wire the command into PR validation outside any unsafe nested Rush
      invocation.
- [x] Keep the fast existing unit tests unchanged except where metadata or
      fixture support requires a focused correction.

Phase 3 is complete when a private dependency regression, unsupported pair, or
entrypoint-specific split fails CI deterministically.

### Phase 4 - Documentation And Migration

Update the current source documentation:

- [x] [Package README](../../packages/webapp-graphql-relay/README.md): direct
      install command, exact supported pair, singleton/coherence rule, and
      package-manager diagnostic limitations.
- [x] [Package reference](../../docs/packages/webapp-graphql-relay.md): required
      peers, supported versions, types/compiler expectations, and migration.
- [x] [Package groups](../../docs/package-groups.md): make the typical browser
      install consistent with application-owned framework dependencies.
- [x] [Quick-start install](../../docs/quick-start/README.md): pin the compatible
      runtime pair and align development-time Relay tooling.
- [x] Review other current Relay installation or composition pages and update
      only statements affected by this contract.
- [x] Explain how consumers can inspect their graph with their package manager,
      align direct dependencies, remove temporary overrides, and verify one
      canonical pair.
- [x] State that unsupported pairs are not compatibility targets merely because
      a package manager allows installation with a warning.

At task creation the documentation line is already `vNext`. Recheck before
implementation. Do not create or edit archived docs unless a new documentation
release line is intentionally started and the required tag preflight succeeds.
Do not hand-edit `website-docusaurus/docs`.

Phase 4 is complete when the package manifest, package README, root docs, and
consumer fixture describe the same contract.

### Phase 5 - Rush Release And Validation

- [x] Create a major Rush change for only
      `@omgjs/labkit-webapp-graphql-relay` with a message describing the new
      required Relay peer contract and migration.
- [x] Do not manually change the package version or generated changelogs.
- [x] Verify Rush change metadata against the target branch without fetching or
      committing through Rush.
- [x] Run the focused package and packed-consumer commands while developing.
- [x] Run the full required validation listed below.
- [x] Record the exact supported pair, matrix results, tarball contents, and
      any manager-specific diagnostic differences in this task.
- [x] Leave npm publication to the repository's post-merge CI release flow;
      do not invoke a credentialed local publish.
- [x] After publication, verify a clean external consumer installs the expected
      major version and one Relay graph without an override or alias.

Phase 5 is complete only after CI publishes the release and clean external npm
and pnpm consumers verify the published artifact. Local publication is not part
of implementation completion.

## Execution Record

Pull request
[#2](https://github.com/BootstrapLaboratory/labkit/pull/2) merged the
implementation as `c70924b0971b9fc5d7f000f3c35f23204c08a183` after the full
PR validation workflow passed. Post-merge
[package-release run 31496679087, attempt 4](https://github.com/BootstrapLaboratory/labkit/actions/runs/31496679087/attempts/4)
published `3.0.0` and pushed generated release commit
`1fb192b3ebf9bdd9c07e72999b5658b934cb8790` to `main`. The generated commit
updated the package version and changelogs and consumed the one package-scoped
major Rush change file.

The npm registry reports `3.0.0` as `latest`, with tarball SHA-1
`ac872dc6bed0a20953131d13d9483cd1e0ba2abe` and SHA-512 integrity
`sha512-ZWLxYha2XfraJ5J33Gp+ZC6qz7u/1OxBMb6q/JXJB5aLh/AVVg6Pbt3FQN81w9quTuAN6mcq+BMYm9UTzT0GxQ==`.
An independent download reproduced the SHA-1 and confirmed the exact required
Relay peers, absence of production/optional/bundled Relay declarations, and
the expected CommonJS, ESM, declaration, ESM marker, and README payload.

Cold external consumers then installed the registry release with npm 11.16.0
strict peers and repository-pinned pnpm 10.33.2 using its isolated linker,
strict peers, and peer auto-installation disabled. Both installed one physical
`react-relay@20.1.1` and one physical `relay-runtime@20.1.1`. Application,
Labkit, and React Relay resolution reached the same canonical runtime path.
CommonJS environment identity, native ESM export resolution, and Vite-bundled
ESM execution all passed without an override, alias, workspace link, or local
tarball substitution.

Release attempts 1-3 stopped only at npm authentication: two unauthorized
`E404` responses and one explicit bypass-2FA `E403`. No version was published
by those attempts. After the repository secret was replaced with a valid
package-scoped, bypass-enabled granular token, attempt 4 completed. The three
generated-only `publish-*` branches stranded by the failed attempts were
audited and deleted; the unrelated older May release branch was preserved.

Implementation and the final packed-consumer run used Node `24.18.0`, npm
`11.16.0`, Rush `5.175.0`, and the repository-pinned pnpm `10.33.2`. The
workspace resolved React `19.2.6`; the external fixture pinned React and React
DOM `19.2.5`. Every supported case used the exact
`react-relay@20.1.1`/`relay-runtime@20.1.1` pair.

The runner built in an independent `git clone --no-local`, removed its remote,
and used Rush's `--publish --pack` branch only inside that clone. It verified
that the live package manifest, changelogs, and Rush change files stayed
byte-identical. A loopback scoped registry served the packed first-party
runtime closure, and both package-manager lockfiles were checked for the local
tarball URLs and SHA-512 integrity values. The target tarball contained the
CommonJS entrypoint, ESM entrypoint and `type: module` marker, declarations, and
README; it contained neither `consumer-test` nor a `workspace:` specifier. The
packed manifest contained the exact required peers and exact development
dependencies, with no production, optional, bundled, or optional-peer Relay
declaration.

Both normal npm and isolated pnpm supported consumers passed Relay compilation,
strict TypeScript compilation with `skipLibCheck: false`, native package export
resolution, CommonJS execution, Vite ESM execution and singleton graph checks,
a browser production build, and a real provider/load/hook render. Strict npm
and strict isolated pnpm supported installs also passed without a peer
diagnostic.

The final negative install matrix was:

| Case                       | npm normal     | npm strict     | pnpm normal    | pnpm strict |
| -------------------------- | -------------- | -------------- | -------------- | ----------- |
| Unsupported coherent pair  | Failed         | Failed         | Warned         | Failed      |
| Mismatched pair            | Failed         | Failed         | Warned         | Failed      |
| Omitted `react-relay` peer | Auto-installed | Auto-installed | Auto-installed | Failed      |

Auto-install behavior does not change the documented requirement that the
application declare both exact peers directly. No negative fixture proceeded
to typecheck, build, or render.

Local repository validation on 2026-08-11 produced these results:

- `npm run rush:install` passed. It retained the existing, non-failing
  `@nestjs/apollo` playground-plugin peer warning in `server-graphql`.
- `npm run rush:build` and `npm run rush:lint` passed for all 15 projects.
- Serialized `rush test` and `rush verify` passed for all 15 projects.
- `npm run site:docusaurus:check` passed its sync, typecheck, and production
  build.
- `trunk check -a -y` ran but returned the repository's pre-existing findings:
  Dockerfile `hadolint` rules, `pinact` parse failures for older workflow action
  tags, generated changelog Markdown style, and dependency advisories in the
  Rush and Docusaurus lockfiles. Its unrelated autoformats were reverted.
- A follow-up Trunk check of all files changed by this task passed after
  excluding only the repository-wide `pinact`, `osv-scanner`, and `grype`
  findings. The newly added upload action is pinned to the verified v7 commit
  and is not one of the remaining `pinact` failures.
- After the implementation commit, the target-branch/no-fetch Rush change
  verification found the one package-scoped major change file. A read-only
  `rush publish` preview selected no other update and resolved
  `@omgjs/labkit-webapp-graphql-relay` from `2.0.0` to `3.0.0`.

## Validation

Run focused package and consumer checks first. Before handoff, run:

```bash
npm run rush:install
npm run rush:build
npm run rush:lint
node common/scripts/install-run-rush.js test --parallelism 1
node common/scripts/install-run-rush.js verify --parallelism 1
npm run site:docusaurus:check
trunk check -a -y
```

Also run the new packed-consumer command independently and verify the Rush
change file with the repository's target-branch/no-fetch flow. Report any
unavailable command or unrelated failure as a validation gap rather than
hiding it.

## Acceptance Criteria

- [x] The packed manifest declares both Relay packages only as required peers
      plus development dependencies, not private production dependencies.
- [x] The initial supported pair is exactly 20.1.1/20.1.1 and no broader
      compatibility is claimed.
- [x] A publish-equivalent local tarball, not a workspace/source link, is the
      authority for consumer assertions.
- [x] The packed fixture uses local first-party artifacts and cannot silently
      substitute the registry package under test.
- [x] Clean npm and isolated pnpm consumers that declare the supported pair
      install without peer diagnostics.
- [x] Unsupported and mismatched cases produce the documented manager-specific
      diagnostics and fail in strict mode before build/render; omitted-peer
      behavior is recorded explicitly when a manager auto-installs the exact
      peer instead of diagnosing it.
- [x] Application, Labkit, React Relay, CommonJS, ESM, and Vite resolve one
      canonical implementation for each Relay package in supported installs.
- [x] Consumer typechecking passes with `skipLibCheck` disabled.
- [x] A real application provider and hook consume a Labkit-created environment
      and query reference successfully.
- [x] The Vite production build contains no second Relay graph.
- [x] Package unit, type, build, lint, and verify checks pass.
- [x] Package README, current root docs, and migration guidance match the
      released dependency contract.
- [x] A major Rush change exists only for the affected public package.
- [x] No package version, changelog, generated current-doc copy, or archived doc
      was edited manually.
- [x] The full repository validation and Trunk cleanup pass, or every remaining
      gap is reported precisely.
- [x] The task records post-release clean-consumer verification without
      performing a local publish.
- [x] This file is moved to `tasks/completed` only after all applicable items
      are complete.
