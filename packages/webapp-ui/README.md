# @omgjs/labkit-webapp-ui

`@omgjs/labkit-webapp-ui` owns browser UI framework helpers and contracts.

It intentionally does not own concrete product components or visual design.
Current boundaries:

- Labkit UI: framework helpers and reusable UI contracts.
- App UI: concrete components, visual tokens, themes, and product design.
- Future shared design system: create a separate package when a second webapp
  creates real pressure to share buttons, fields, layouts, or theme values.

The package can provide helpers for defining and selecting app-owned themes,
but the app still owns its token contract, visual values, generated CSS theme
classes, and concrete components.

Theme controllers may handle browser storage, document root class application,
and subscription mechanics. Apps still provide theme names, CSS class names,
storage keys, and React hooks or provider integration.

## Owns

- `cx` for class-name composition.
- Theme-name validation.
- Theme definition derivation.
- Theme-value typing helpers.
- Persisted theme controller mechanics.
- Document root class application mechanics.

## Does Not Own

- Button, field, surface, layout, or navigation components.
- Vanilla-extract token contracts.
- Theme values.
- Generated theme classes.
- Feature visual composition.
- Storybook stories.

## Usage

```ts
import { createTheme } from "@vanilla-extract/css";
import {
  createWebappThemeController,
  defineWebappThemes,
  type WebappThemeValuesFor,
} from "@omgjs/labkit-webapp-ui";
import { vars } from "./tokens.css";

type ThemeValues = WebappThemeValuesFor<typeof vars>;

export const themes = defineWebappThemes({
  createThemeClass: (themeValues: ThemeValues) =>
    createTheme(vars, themeValues),
  defaultThemeName: "dark",
  themes: {
    dark: { label: "Dark", values: darkThemeValues },
    light: { label: "Light", values: lightThemeValues },
  },
});

export const themeController = createWebappThemeController({
  defaultThemeName: themes.defaultThemeName,
  themeClassByName: themes.themeClassByName,
  themeNames: themes.themeNames,
  storageKey: "webapp:theme",
});
```

Applications usually wrap the controller with app-owned React hooks and keep
all visual implementation in the app. When using vanilla-extract, keep
`defineWebappThemes` calls in `.css.ts` files so generated theme classes remain
serializable, then use a normal `.ts` app adapter to create the persisted theme
controller.

## Release Channel

This package is published on npm as part of the Labkit release train. Patch
releases may include documentation-only clarifications, so consumers can update
within the same minor line without expecting runtime API changes.

## Package Format

This package publishes both CommonJS and ESM entry points. Browser bundlers
should use the ESM import entry automatically.
