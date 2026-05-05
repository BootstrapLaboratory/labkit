# Theme

Add a small theme controller. Labkit owns theme selection mechanics; the app
owns CSS classes and visual values.

## `webapp/src/shared/theme/theme-store.ts`

```ts
import { useSyncExternalStore } from "react";
import {
  createWebappThemeController,
  defineWebappThemes,
} from "@omgjs/labkit-webapp-ui";

const themes = defineWebappThemes({
  createThemeClass: (values: { className: string }) => values.className,
  defaultThemeName: "light",
  themes: {
    light: { label: "Light", values: { className: "theme-light" } },
    dark: { label: "Dark", values: { className: "theme-dark" } },
  },
});

const themeController = createWebappThemeController({
  defaultThemeName: themes.defaultThemeName,
  storageKey: "webapp:theme",
  themeClassByName: themes.themeClassByName,
  themeNames: themes.themeNames,
});

export const themeNames = themes.themeNames;
export const themeLabelByName = themes.themeLabelByName;
export const getThemeName = themeController.getThemeName;
export const setThemeName = themeController.setThemeName;
export const applyThemeClass = themeController.applyThemeClass;
export const initializeThemeClass = themeController.initializeThemeClass;

export function useThemeName() {
  return useSyncExternalStore(
    themeController.subscribeThemeName,
    themeController.getThemeName,
    themeController.getThemeName,
  );
}
```

## `webapp/src/index.css`

```css
.theme-light {
  color-scheme: light;
  --app-bg: #ffffff;
  --app-text: #15171a;
}

.theme-dark {
  color-scheme: dark;
  --app-bg: #15171a;
  --app-text: #f7f8fa;
}

body {
  margin: 0;
  background: var(--app-bg);
  color: var(--app-text);
}
```

## Apply The Class

```tsx
import { useEffect } from "react";
import { applyThemeClass, useThemeName } from "./shared/theme/theme-store";

export function ThemeRuntime() {
  const themeName = useThemeName();

  useEffect(() => {
    applyThemeClass(themeName);
  }, [themeName]);

  return null;
}
```

If you use vanilla-extract, keep theme class creation in `.css.ts` files and
use the same controller shape from a normal `.ts` adapter.
