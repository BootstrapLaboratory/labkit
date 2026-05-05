import { useState } from "react";
import clsx from "clsx";
import Heading from "@theme/Heading";
import Layout from "@theme/Layout";
import Link from "@docusaurus/Link";
import { useColorMode } from "@docusaurus/theme-common";
import useBaseUrl from "@docusaurus/useBaseUrl";
import { Highlight, Prism, themes } from "prism-react-renderer";
import type { Language } from "prism-react-renderer";
import styles from "./index.module.css";

declare const require: (path: string) => unknown;

(globalThis as typeof globalThis & { Prism?: typeof Prism }).Prism = Prism;
require("prismjs/components/prism-typescript");

type Pillar = {
  title: string;
  description: string;
  to: string;
};

type ArchitectureExample = {
  id: string;
  label: string;
  description: string;
  languageLabel: string;
  highlightLanguage: Language;
  code: string;
};

type PackageGroup = {
  title: string;
  description: string;
  packages: readonly string[];
  to: string;
};

type PathCard = {
  title: string;
  description: string;
  to: string;
  label: string;
};

const pillars: readonly Pillar[] = [
  {
    title: "Server GraphQL",
    description:
      "Compose Nest/Apollo HTTP and websocket GraphQL setup, context factories, subscription logging, and scalar/directive/plugin helpers.",
    to: "/docs/server-composition",
  },
  {
    title: "Auth And Sessions",
    description:
      "Keep principals, access tokens, refresh cookies, provider registries, guards, roles, and lifecycle events consistent across apps.",
    to: "/docs/auth-and-sessions",
  },
  {
    title: "Browser Runtime",
    description:
      "Wire Relay, memory auth state, refresh retries, realtime reconnects, route preloading, and theme boundaries in app-owned adapters.",
    to: "/docs/webapp-composition",
  },
  {
    title: "Database Manifests",
    description:
      "Compose TypeORM entities and migrations from feature manifests while keeping auth persistence and product data ownership explicit.",
    to: "/docs/database-and-migrations",
  },
];

const examples: readonly ArchitectureExample[] = [
  {
    id: "server-module",
    label: "Server Module",
    description: "Nest GraphQL setup with auth-aware context.",
    languageLabel: "ts",
    highlightLanguage: "typescript",
    code: [
      'import { createServerAuthAccessTokenGraphqlModule } from "@omgjs/labkit-server-auth";',
      "",
      "@Module({",
      "  imports: [",
      "    IdentityModule,",
      "    FeatureModule,",
      "    createServerAuthAccessTokenGraphqlModule({",
      "      imports: [IdentityModule],",
      "      accessTokenServiceToken: AccessTokenService,",
      "      configReaderToken: ConfigService,",
      "    }),",
      "  ],",
      "})",
      "export class AppModule {}",
    ].join("\n"),
  },
  {
    id: "auth-wiring",
    label: "Auth Wiring",
    description: "Provider registry and refresh-token transport.",
    languageLabel: "ts",
    highlightLanguage: "typescript",
    code: [
      'import {',
      "  createIdentityProviderRegistryConfigProvider,",
      "  createServerAuthLocalIdentityProviderProvider,",
      "  createServerAuthRefreshTokenTransportProvider,",
      "  IDENTITY_PROVIDERS,",
      "  IdentityProviderRegistry,",
      "  ServerAuthLocalIdentityProvider,",
      '} from "@omgjs/labkit-server-auth";',
      "",
      "providers: [",
      "  createIdentityProviderRegistryConfigProvider(IdentityConfigService),",
      "  createServerAuthLocalIdentityProviderProvider({",
      "    configReaderToken: IdentityConfigService,",
      "    passwordHasherToken: PasswordService,",
      "  }),",
      "  createServerAuthRefreshTokenTransportProvider({",
      "    configReaderToken: IdentityConfigService,",
      "  }),",
      "  IdentityProviderRegistry,",
      "  {",
      "    provide: IDENTITY_PROVIDERS,",
      "    useFactory: (local: ServerAuthLocalIdentityProvider) => [local],",
      "    inject: [ServerAuthLocalIdentityProvider],",
      "  },",
      "]",
    ].join("\n"),
  },
  {
    id: "relay-environment",
    label: "Relay Environment",
    description: "Auth-aware fetch plus realtime subscriptions.",
    languageLabel: "ts",
    highlightLanguage: "typescript",
    code: [
      'import { createWebappRelayEnvironment } from "@omgjs/labkit-webapp-graphql-relay";',
      "",
      "export function createRelayEnvironment() {",
      "  return createWebappRelayEnvironment({",
      "    httpEndpoint: HTTP_ENDPOINT,",
      "    wsEndpoint: WS_ENDPOINT,",
      "    auth: {",
      "      getAccessToken,",
      "      refreshStoredAuthSession,",
      "      subscribeAuthState,",
      "      requestCredentials: \"include\",",
      "    },",
      "    realtime,",
      "  });",
      "}",
    ].join("\n"),
  },
  {
    id: "database-manifest",
    label: "Database Manifest",
    description: "Feature-owned entities and migrations.",
    languageLabel: "ts",
    highlightLanguage: "typescript",
    code: [
      'import { composeServerDatabaseManifests } from "@omgjs/labkit-server-database";',
      'import { serverAuthTypeormDatabaseManifest } from "@omgjs/labkit-server-auth-typeorm";',
      "",
      "const manifest = composeServerDatabaseManifests([",
      "  serverAuthTypeormDatabaseManifest,",
      "  chatDatabaseManifest,",
      "  billingDatabaseManifest,",
      "]);",
      "",
      "export const entities = manifest.entities;",
      "export const migrations = manifest.migrations;",
    ].join("\n"),
  },
];

const packageGroups: readonly PackageGroup[] = [
  {
    title: "Shared Contracts",
    description:
      "Runtime config parsing and auth shapes shared by server and browser packages.",
    packages: [
      "@omgjs/labkit-auth-contract",
      "@omgjs/labkit-runtime-config",
    ],
    to: "/docs/package-groups#shared-packages",
  },
  {
    title: "Server Runtime",
    description:
      "Nest config, GraphQL composition, TypeORM manifest composition, and observability helpers.",
    packages: [
      "@omgjs/labkit-server-config",
      "@omgjs/labkit-server-graphql",
      "@omgjs/labkit-server-database",
      "@omgjs/labkit-server-observability",
    ],
    to: "/docs/package-groups#server-packages",
  },
  {
    title: "Server Auth",
    description:
      "Provider registries, refresh sessions, guards, access-token helpers, and TypeORM persistence adapters.",
    packages: [
      "@omgjs/labkit-server-auth",
      "@omgjs/labkit-server-auth-typeorm",
    ],
    to: "/docs/package-groups#server-packages",
  },
  {
    title: "Browser Runtime",
    description:
      "Memory auth session, realtime connection lifecycle, Relay environment, UI helpers, and Vite build config.",
    packages: [
      "@omgjs/labkit-webapp-auth",
      "@omgjs/labkit-webapp-realtime",
      "@omgjs/labkit-webapp-graphql-relay",
      "@omgjs/labkit-webapp-ui",
    ],
    to: "/docs/package-groups#browser-packages",
  },
  {
    title: "Tooling",
    description:
      "Vite production env validation, package chunk groups, and tiny browser store primitives for adapter code.",
    packages: [
      "@omgjs/labkit-webapp-build-config",
      "@omgjs/labkit-webapp-external-store",
    ],
    to: "/docs/package-groups#browser-packages",
  },
];

const paths: readonly PathCard[] = [
  {
    title: "Start From Scratch",
    description:
      "Install the packages into a small Nest/Vite shape and get the first GraphQL path running.",
    to: "/docs/quick-start",
    label: "Open Quick Start",
  },
  {
    title: "Understand The Architecture",
    description:
      "Walk through the server, browser, auth, realtime, and database ownership model chapter by chapter.",
    to: "/docs/tutorial",
    label: "Read Tutorial",
  },
  {
    title: "Use A Package",
    description:
      "Find the package group that owns the runtime concern you want to reuse.",
    to: "/docs/package-groups",
    label: "Browse Packages",
  },
];

function HeroGraphic() {
  const logoSrc = useBaseUrl("/img/logo.svg");
  const darkLogoSrc = useBaseUrl("/img/logo-dark.svg");

  return (
    <div className={styles.heroVisual}>
      <div
        className={styles.logoFrame}
        role="img"
        aria-label="Labkit laboratory cat mark"
      >
        <img
          className={clsx(styles.heroLogo, styles.heroLogoLight)}
          src={logoSrc}
          alt=""
          aria-hidden="true"
          decoding="async"
        />
        <img
          className={clsx(styles.heroLogo, styles.heroLogoDark)}
          src={darkLogoSrc}
          alt=""
          aria-hidden="true"
          decoding="async"
        />
      </div>
      <div className={styles.visualStack} aria-label="Labkit runtime areas">
        <span>GraphQL contracts</span>
        <span>Auth sessions</span>
        <span>Relay runtime</span>
        <span>TypeORM manifests</span>
      </div>
    </div>
  );
}

function ReferenceShowcase() {
  const logoSrc = useBaseUrl("/img/logo.svg");

  return (
    <section className={styles.reference}>
      <div className={styles.referenceMark}>
        <img src={logoSrc} alt="" decoding="async" />
      </div>
      <div className={styles.referenceCopy}>
        <p className={styles.referenceEyebrow}>Production-grade reference</p>
        <Heading as="h2">See Labkit inside a full application</Heading>
        <p>
          The reference app shows the stack assembled with NestJS, GraphQL,
          Relay, auth sessions, realtime subscriptions, TypeORM, and production
          monorepo conventions. It is the complete example, not a toy demo.
        </p>
        <div className={styles.referenceActions}>
          <Link
            className={clsx(styles.button, styles.referencePrimary)}
            to="https://bootlab-example-rush-delivery.pages.dev/"
          >
            Open The Working Example
          </Link>
          <Link
            className={clsx(styles.button, styles.referenceSecondary)}
            to="https://github.com/BootstrapLaboratory/typescript_monorepo_nestjs_relay_trunk"
          >
            View The Source Tree
          </Link>
        </div>
      </div>
    </section>
  );
}

function ExampleSwitcher() {
  const [activeId, setActiveId] = useState(examples[0].id);
  const { colorMode } = useColorMode();
  const activeExample =
    examples.find((example) => example.id === activeId) ?? examples[0];
  const highlightTheme = colorMode === "dark" ? themes.oneDark : themes.github;

  function activateExample(index: number) {
    const nextExample = examples[index];
    setActiveId(nextExample.id);
    requestAnimationFrame(() => {
      document.getElementById(`example-tab-${nextExample.id}`)?.focus();
    });
  }

  return (
    <section className={styles.section} aria-labelledby="architecture-title">
      <div className={styles.sectionHeader}>
        <p className={styles.eyebrow}>Reusable wiring</p>
        <Heading as="h2" id="architecture-title">
          Architecture snippets that stay small
        </Heading>
        <p>
          The homepage snippets show the shape. Quick Start keeps the larger
          copy-paste setup where it belongs.
        </p>
      </div>

      <div
        className={styles.exampleSwitcher}
        aria-label="Labkit architecture examples"
      >
        <div
          className={styles.exampleTabs}
          role="tablist"
          aria-orientation="vertical"
        >
          {examples.map((example, index) => {
            const isActive = example.id === activeExample.id;

            return (
              <button
                key={example.id}
                type="button"
                id={`example-tab-${example.id}`}
                className={clsx(
                  styles.exampleTab,
                  isActive && styles.exampleTabActive,
                )}
                role="tab"
                aria-selected={isActive}
                aria-controls={`example-panel-${example.id}`}
                tabIndex={isActive ? 0 : -1}
                onClick={() => setActiveId(example.id)}
                onKeyDown={(event) => {
                  const isForward =
                    event.key === "ArrowDown" || event.key === "ArrowRight";
                  const isBackward =
                    event.key === "ArrowUp" || event.key === "ArrowLeft";

                  if (!isForward && !isBackward) return;

                  event.preventDefault();
                  const offset = isForward ? 1 : -1;
                  activateExample(
                    (index + offset + examples.length) % examples.length,
                  );
                }}
              >
                {example.label}
                <span>{example.description}</span>
              </button>
            );
          })}
        </div>
        <div
          id={`example-panel-${activeExample.id}`}
          className={styles.examplePanel}
          role="tabpanel"
          aria-labelledby={`example-tab-${activeExample.id}`}
        >
          <div className={styles.examplePanelBar}>
            <span />
            <span />
            <span />
            <strong>{activeExample.languageLabel}</strong>
          </div>
          <Highlight
            code={activeExample.code}
            language={activeExample.highlightLanguage}
            theme={highlightTheme}
          >
            {({ className, getLineProps, getTokenProps, style, tokens }) => (
              <pre
                className={clsx(className, styles.exampleCode)}
                style={{ ...style, background: "transparent" }}
              >
                <code>
                  {tokens.map((line, lineIndex) => (
                    <span
                      key={lineIndex}
                      {...getLineProps({
                        className: styles.exampleCodeLine,
                        line,
                      })}
                    >
                      {line.map((token, tokenIndex) => (
                        <span key={tokenIndex} {...getTokenProps({ token })} />
                      ))}
                    </span>
                  ))}
                </code>
              </pre>
            )}
          </Highlight>
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  return (
    <Layout
      title="BootstrapLaboratory"
      description="Labkit packages for Nest GraphQL, Relay, auth, realtime, and TypeORM application runtimes."
    >
      <main className={styles.page}>
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>BootstrapLaboratory / Labkit</p>
            <Heading as="h1" className={styles.heroTitle}>
              Labkit runtime packages for serious GraphQL apps
            </Heading>
            <p className={styles.heroText}>
              Reusable TypeScript packages for NestJS servers and
              React/Vite/Relay webapps: GraphQL runtime composition, auth
              sessions, realtime connections, database manifests, config
              parsing, and browser-side application adapters.
            </p>
            <div className={styles.actions}>
              <Link
                className={clsx(styles.button, styles.primary)}
                to="/docs/quick-start"
              >
                Quick Start
              </Link>
              <Link
                className={clsx(styles.button, styles.secondary)}
                to="/docs/tutorial"
              >
                Tutorial
              </Link>
              <Link
                className={clsx(styles.button, styles.tertiary)}
                to="/docs/package-groups"
              >
                Package Docs
              </Link>
            </div>
          </div>
          <HeroGraphic />
        </section>

        <ReferenceShowcase />

        <section className={styles.section} aria-labelledby="pillars-title">
          <div className={styles.sectionHeader}>
            <p className={styles.eyebrow}>Runtime pillars</p>
            <Heading as="h2" id="pillars-title">
              Reuse the boring hard parts
            </Heading>
            <p>
              Labkit keeps repeated runtime concerns portable while the
              application keeps ownership of product schema, resolvers, routes,
              UI, persistence decisions, and deployment.
            </p>
          </div>
          <div className={styles.pillars}>
            {pillars.map((pillar) => (
              <Link className={styles.pillar} key={pillar.title} to={pillar.to}>
                <Heading as="h3">{pillar.title}</Heading>
                <p>{pillar.description}</p>
                <span>Read more</span>
              </Link>
            ))}
          </div>
        </section>

        <ExampleSwitcher />

        <section className={styles.section} aria-labelledby="packages-title">
          <div className={styles.sectionHeader}>
            <p className={styles.eyebrow}>Package map</p>
            <Heading as="h2" id="packages-title">
              Pick the runtime concern you need
            </Heading>
            <p>
              Packages are intentionally small. Install the groups your app
              uses and keep framework packages as application dependencies.
            </p>
          </div>
          <div className={styles.packageGrid}>
            {packageGroups.map((group) => (
              <Link
                className={styles.packageGroup}
                key={group.title}
                to={group.to}
              >
                <Heading as="h3">{group.title}</Heading>
                <p>{group.description}</p>
                <div className={styles.packageList}>
                  {group.packages.map((packageName) => (
                    <span key={packageName}>{packageName}</span>
                  ))}
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className={styles.pathBand} aria-labelledby="paths-title">
          <div className={styles.pathInner}>
            <div className={styles.sectionHeader}>
              <p className={styles.eyebrow}>Choose your path</p>
              <Heading as="h2" id="paths-title">
                Go straight to the shape you need
              </Heading>
            </div>
            <div className={styles.pathGrid}>
              {paths.map((path) => (
                <Link className={styles.pathCard} key={path.title} to={path.to}>
                  <Heading as="h3">{path.title}</Heading>
                  <p>{path.description}</p>
                  <span>{path.label}</span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>
    </Layout>
  );
}
