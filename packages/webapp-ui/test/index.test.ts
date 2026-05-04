import assert from "node:assert/strict";
import test from "node:test";
import {
  createWebappThemeController,
  cx,
  defineWebappThemes,
  isWebappThemeName,
  type WebappThemeDocument,
  type WebappThemeStorage,
} from "../src/index";

function createMemoryStorage(
  initialItems: Record<string, string> = {},
): WebappThemeStorage & { read(key: string): string | undefined } {
  const items = new Map(Object.entries(initialItems));

  return {
    getItem: (key) => items.get(key) ?? null,
    read: (key) => items.get(key),
    setItem: (key, value) => {
      items.set(key, value);
    },
  };
}

function createThemeDocument(): WebappThemeDocument & {
  classNames: Set<string>;
} {
  const classNames = new Set<string>();

  return {
    classNames,
    documentElement: {
      classList: {
        add: (...nextClassNames) => {
          for (const className of nextClassNames) {
            classNames.add(className);
          }
        },
        remove: (...nextClassNames) => {
          for (const className of nextClassNames) {
            classNames.delete(className);
          }
        },
      },
      dataset: {},
    },
  };
}

test("cx joins truthy class names", () => {
  assert.equal(cx("root", false, "active", null, undefined), "root active");
});

test("cx returns an empty string when no class names are truthy", () => {
  assert.equal(cx(false, null, undefined), "");
});

test("isWebappThemeName checks values against known theme names", () => {
  assert.equal(isWebappThemeName(["light", "dark"], "light"), true);
  assert.equal(isWebappThemeName(["light", "dark"], "missing"), false);
  assert.equal(isWebappThemeName(["light", "dark"], null), false);
});

test("defineWebappThemes derives names, labels, classes, and guards", () => {
  const themes = defineWebappThemes({
    createThemeClass: (values) => `${values.font}:${values.color}`,
    defaultThemeName: "light",
    sharedValues: {
      font: "Inter",
    },
    themes: {
      light: {
        label: "Light",
        values: {
          color: "white",
        },
      },
      dark: {
        label: "Dark",
        values: {
          color: "black",
        },
      },
    },
  });

  assert.deepEqual(themes.themeNames, ["light", "dark"]);
  assert.equal(themes.defaultThemeName, "light");
  assert.deepEqual(themes.themeLabelByName, {
    light: "Light",
    dark: "Dark",
  });
  assert.deepEqual(themes.themeClassByName, {
    light: "Inter:white",
    dark: "Inter:black",
  });
  assert.equal(themes.isThemeName("light"), true);
  assert.equal(themes.isThemeName("missing"), false);
  assert.equal(themes.isThemeName(null), false);
});

test("defineWebappThemes rejects an undefined default theme", () => {
  const themes: Record<string, { label: string; values: { color: string } }> = {
    light: {
      label: "Light",
      values: {
        color: "white",
      },
    },
  };

  assert.throws(
    () => {
      defineWebappThemes({
        createThemeClass: (values) => values.color,
        defaultThemeName: "missing",
        themes,
      });
    },
    {
      message: 'Default theme "missing" is not defined.',
    },
  );
});

test("createWebappThemeController reads stored theme names and applies document classes", () => {
  const document = createThemeDocument();
  const controller = createWebappThemeController({
    defaultThemeName: "light",
    document,
    storage: createMemoryStorage({ "app:theme": "dark" }),
    storageKey: "app:theme",
    themeClassByName: {
      light: "light-theme",
      dark: "dark-theme",
    },
    themeNames: ["light", "dark"],
  });

  assert.equal(controller.getThemeName(), "dark");
  controller.initializeThemeClass();
  assert.deepEqual([...document.classNames], ["dark-theme"]);
  assert.equal(document.documentElement.dataset.theme, "dark");
});

test("createWebappThemeController falls back for invalid stored themes", () => {
  const controller = createWebappThemeController({
    defaultThemeName: "light",
    document: null,
    storage: createMemoryStorage({ "app:theme": "missing" }),
    storageKey: "app:theme",
    themeClassByName: {
      light: "light-theme",
      dark: "dark-theme",
    },
    themeNames: ["light", "dark"],
  });

  assert.equal(controller.getThemeName(), "light");
});

test("createWebappThemeController persists, applies, and emits theme changes", () => {
  const document = createThemeDocument();
  const storage = createMemoryStorage();
  const controller = createWebappThemeController({
    defaultThemeName: "light",
    document,
    storage,
    storageKey: "app:theme",
    themeClassByName: {
      light: "light-theme",
      dark: "dark-theme",
    },
    themeNames: ["light", "dark"],
  });
  let themeChanges = 0;
  const unsubscribe = controller.subscribeThemeName(() => {
    themeChanges += 1;
  });

  controller.initializeThemeClass();
  controller.setThemeName("dark");
  controller.setThemeName("dark");
  unsubscribe();
  controller.setThemeName("light");

  assert.equal(storage.read("app:theme"), "light");
  assert.deepEqual([...document.classNames], ["light-theme"]);
  assert.equal(document.documentElement.dataset.theme, "light");
  assert.equal(themeChanges, 1);
});

test("createWebappThemeController keeps in-memory state when storage fails", () => {
  const document = createThemeDocument();
  const controller = createWebappThemeController({
    defaultThemeName: "light",
    document,
    storage: {
      getItem: () => {
        throw new Error("read failed");
      },
      setItem: () => {
        throw new Error("write failed");
      },
    },
    storageKey: "app:theme",
    themeClassByName: {
      light: "light-theme",
      dark: "dark-theme",
    },
    themeNames: ["light", "dark"],
  });

  assert.equal(controller.getThemeName(), "light");
  controller.setThemeName("dark");
  assert.equal(controller.getThemeName(), "dark");
  assert.deepEqual([...document.classNames], ["dark-theme"]);
});

test("createWebappThemeController rejects an undefined default theme", () => {
  assert.throws(
    () => {
      createWebappThemeController<string>({
        defaultThemeName: "missing",
        document: null,
        storage: null,
        storageKey: "app:theme",
        themeClassByName: {
          light: "light-theme",
        },
        themeNames: ["light"],
      });
    },
    {
      message: 'Default theme "missing" is not defined.',
    },
  );
});
