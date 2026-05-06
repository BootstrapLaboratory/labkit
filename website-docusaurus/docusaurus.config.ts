import type { Config } from "@docusaurus/types";
import type * as Preset from "@docusaurus/preset-classic";
import { themes as prismThemes } from "prism-react-renderer";

const repository =
  process.env.GITHUB_REPOSITORY ?? "BootstrapLaboratory/labkit";
const repositoryName = repository.split("/").at(-1) ?? "labkit";
const isProjectPages = repositoryName !== "bootstraplaboratory.github.io";
const baseUrl =
  process.env.PAGES_BASE_PATH ?? (isProjectPages ? `/${repositoryName}/` : "/");
const url =
  process.env.PAGES_SITE_URL ?? "https://bootstraplaboratory.github.io";
const currentDocsVersion = "vNext";
const archivedDocsVersions = ["v0.1.1"];

const config: Config = {
  title: "Labkit",
  tagline:
    "Reusable TypeScript runtime packages for Nest GraphQL and Relay apps.",
  favicon: "img/favicon.svg",

  url,
  baseUrl,
  organizationName: "BootstrapLaboratory",
  projectName: "labkit",
  trailingSlash: true,

  future: {
    v4: true,
    faster: true,
  },

  onBrokenLinks: "throw",
  markdown: {
    hooks: {
      onBrokenMarkdownLinks: "warn",
    },
  },

  i18n: {
    defaultLocale: "en",
    locales: ["en"],
  },

  presets: [
    [
      "classic",
      {
        docs: {
          path: "docs",
          routeBasePath: "docs",
          sidebarPath: "./sidebars.ts",
          lastVersion: "current",
          versions: {
            current: {
              label: currentDocsVersion,
              path: "",
              banner: "none",
              badge: false,
            },
            ...Object.fromEntries(
              archivedDocsVersions.map((version) => [
                version,
                {
                  label: version,
                  banner: "unmaintained",
                },
              ]),
            ),
          },
          editUrl:
            "https://github.com/BootstrapLaboratory/labkit/edit/main/",
        },
        blog: false,
        theme: {
          customCss: "./src/css/custom.css",
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    image: "img/logo.svg",
    colorMode: {
      defaultMode: "light",
      respectPrefersColorScheme: false,
    },
    navbar: {
      title: "Labkit",
      logo: {
        alt: "Labkit",
        src: "img/logo.svg",
        srcDark: "img/logo-dark.svg",
      },
      items: [
        {
          type: "docSidebar",
          sidebarId: "docsSidebar",
          position: "left",
          label: "Docs",
        },
        {
          type: "docSidebar",
          sidebarId: "quickStartSidebar",
          label: "Quick Start",
          position: "left",
        },
        {
          type: "docSidebar",
          sidebarId: "tutorialSidebar",
          label: "Tutorial",
          position: "left",
        },
        {
          type: "docsVersionDropdown",
          label: currentDocsVersion,
          position: "right",
        },
        {
          href: "https://github.com/BootstrapLaboratory/labkit",
          label: "GitHub",
          position: "right",
        },
      ],
    },
    footer: {
      style: "dark",
      links: [
        {
          title: "Docs",
          items: [
            {
              label: "Quick Start",
              to: "/docs/quick-start",
            },
            {
              label: "Tutorial",
              to: "/docs/tutorial",
            },
            {
              label: "Package Groups",
              to: "/docs/package-groups",
            },
          ],
        },
        {
          title: "Project",
          items: [
            {
              label: "GitHub",
              href: "https://github.com/BootstrapLaboratory/labkit",
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} Bootstrap Laboratory.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
