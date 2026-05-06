---
title: "Webapp UI"
sidebar_label: "Webapp UI"
---

Browser UI helpers and contracts without product components.

## Install

```bash
npm install @omgjs/labkit-webapp-ui
```

Runtime: browser UI. Package format: CommonJS and ESM.

## Public API Groups

- `cx`.
- `isWebappThemeName`.
- `WebappThemeValuesFor`.
- `defineWebappThemes`.
- `createWebappThemeController`.
- theme storage, document, and controller types.

## Owns

This package owns class-name composition, typed theme derivation, theme-name
validation, persisted theme selection, document root class application, and
theme subscription mechanics.

## App Still Owns

The app owns components, design tokens, generated CSS theme classes, visual
values, layout, navigation, Storybook stories, and product interaction design.

## Minimal Usage

```ts
import {
  createWebappThemeController,
  defineWebappThemes,
} from "@omgjs/labkit-webapp-ui";

const themes = defineWebappThemes({
  createThemeClass: (values) => createTheme(vars, values),
  defaultThemeName: "dark",
  themes: {
    dark: { label: "Dark", values: darkThemeValues },
    light: { label: "Light", values: lightThemeValues },
  },
});

export const themeController = createWebappThemeController({
  defaultThemeName: themes.defaultThemeName,
  storageKey: "webapp:theme",
  themeClassByName: themes.themeClassByName,
  themeNames: themes.themeNames,
});
```

## Runtime Notes

Keep vanilla-extract `defineWebappThemes` calls in `.css.ts` files when they
create CSS classes. Create the persisted controller in a normal app adapter.

Package README and source:
[`../../packages/webapp-ui/README.md`](https://github.com/BootstrapLaboratory/labkit/blob/v0.1.1/packages/webapp-ui/README.md),
[`../../packages/webapp-ui/src/index.ts`](https://github.com/BootstrapLaboratory/labkit/blob/v0.1.1/packages/webapp-ui/src/index.ts).
