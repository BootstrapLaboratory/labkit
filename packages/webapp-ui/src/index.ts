import {
  createExternalStore,
  type ExternalStoreUnsubscribe,
} from "@labkit/webapp-external-store";

export function cx(
  ...classes: Array<string | false | null | undefined>
): string {
  return classes.filter(Boolean).join(" ");
}

export function isWebappThemeName<TThemeName extends string>(
  themeNames: ReadonlyArray<TThemeName>,
  value: unknown,
): value is TThemeName {
  return (
    typeof value === "string" &&
    themeNames.some((themeName) => themeName === value)
  );
}

export type WebappThemeDefinition<TThemeValues extends object> = {
  readonly label: string;
  readonly values: TThemeValues;
};

export type WebappThemeValuesFor<TThemeContract> = {
  [K in keyof TThemeContract]: TThemeContract[K] extends string
    ? string
    : WebappThemeValuesFor<TThemeContract[K]>;
};

export type WebappThemeStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

export type WebappThemeClassList = {
  add(...classNames: string[]): void;
  remove(...classNames: string[]): void;
};

export type WebappThemeDocument = {
  documentElement: {
    classList: WebappThemeClassList;
    dataset: Record<string, string | undefined>;
  };
};

export type CreateWebappThemeControllerOptions<TThemeName extends string> = {
  defaultThemeName: TThemeName;
  document?: WebappThemeDocument | null;
  storage?: WebappThemeStorage | null;
  storageKey: string;
  themeClassByName: Record<TThemeName, string>;
  themeNames: ReadonlyArray<TThemeName>;
};

export type WebappThemeController<TThemeName extends string> = {
  applyThemeClass(nextThemeName?: TThemeName): void;
  getThemeName(): TThemeName;
  initializeThemeClass(): void;
  setThemeName(nextThemeName: TThemeName): void;
  subscribeThemeName(listener: () => void): ExternalStoreUnsubscribe;
};

export type DefineWebappThemesOptions<
  TThemes extends Record<string, WebappThemeDefinition<object>>,
  TSharedValues extends object = Record<string, never>,
  TThemeClass extends string = string,
> = {
  readonly createThemeClass: (
    values: TSharedValues & TThemes[keyof TThemes]["values"],
  ) => TThemeClass;
  readonly defaultThemeName: keyof TThemes & string;
  readonly sharedValues?: TSharedValues;
  readonly themes: TThemes;
};

export type DefinedWebappThemes<
  TThemes extends Record<string, WebappThemeDefinition<object>>,
  TThemeClass extends string = string,
> = {
  readonly defaultThemeName: keyof TThemes & string;
  readonly isThemeName: (value: unknown) => value is keyof TThemes & string;
  readonly themeClassByName: Record<keyof TThemes & string, TThemeClass>;
  readonly themeLabelByName: Record<keyof TThemes & string, string>;
  readonly themeNames: ReadonlyArray<keyof TThemes & string>;
  readonly themes: TThemes;
};

function mergeThemeValues<
  TSharedValues extends object,
  TThemeValues extends object,
>(
  sharedValues: TSharedValues | undefined,
  themeValues: TThemeValues,
): TSharedValues & TThemeValues {
  return {
    ...(sharedValues ?? {}),
    ...themeValues,
  } as TSharedValues & TThemeValues;
}

type GlobalWithThemeBrowserApis = typeof globalThis & {
  document?: WebappThemeDocument;
  localStorage?: WebappThemeStorage;
};

function getGlobalDocument(): WebappThemeDocument | null {
  return (globalThis as GlobalWithThemeBrowserApis).document ?? null;
}

function getGlobalLocalStorage(): WebappThemeStorage | null {
  return (globalThis as GlobalWithThemeBrowserApis).localStorage ?? null;
}

function resolveThemeDocument(
  document: WebappThemeDocument | null | undefined,
): WebappThemeDocument | null {
  return document === undefined ? getGlobalDocument() : document;
}

function resolveThemeStorage(
  storage: WebappThemeStorage | null | undefined,
): WebappThemeStorage | null {
  return storage === undefined ? getGlobalLocalStorage() : storage;
}

export function defineWebappThemes<
  const TThemes extends Record<string, WebappThemeDefinition<object>>,
  TSharedValues extends object = Record<string, never>,
  TThemeClass extends string = string,
>(
  options: DefineWebappThemesOptions<TThemes, TSharedValues, TThemeClass>,
): DefinedWebappThemes<TThemes, TThemeClass> {
  const themeNames = Object.keys(options.themes) as Array<
    keyof TThemes & string
  >;

  if (!themeNames.some((name) => name === options.defaultThemeName)) {
    throw new Error(
      `Default theme "${options.defaultThemeName}" is not defined.`,
    );
  }

  const themeLabelByName = Object.fromEntries(
    themeNames.map((name) => [name, options.themes[name].label]),
  ) as Record<keyof TThemes & string, string>;
  const themeClassByName = Object.fromEntries(
    themeNames.map((name) => [
      name,
      options.createThemeClass(
        mergeThemeValues(options.sharedValues, options.themes[name].values),
      ),
    ]),
  ) as Record<keyof TThemes & string, TThemeClass>;

  return {
    defaultThemeName: options.defaultThemeName,
    isThemeName: (value): value is keyof TThemes & string =>
      isWebappThemeName(themeNames, value),
    themeClassByName,
    themeLabelByName,
    themeNames,
    themes: options.themes,
  };
}

export function createWebappThemeController<TThemeName extends string>(
  options: CreateWebappThemeControllerOptions<TThemeName>,
): WebappThemeController<TThemeName> {
  if (!isWebappThemeName(options.themeNames, options.defaultThemeName)) {
    const defaultThemeName = String(options.defaultThemeName);
    throw new Error(`Default theme "${defaultThemeName}" is not defined.`);
  }

  const themeClassNames = options.themeNames.map(
    (themeName) => options.themeClassByName[themeName],
  );
  const readStoredThemeName = (): TThemeName => {
    const storage = resolveThemeStorage(options.storage);
    if (!storage) {
      return options.defaultThemeName;
    }

    try {
      const storedThemeName = storage.getItem(options.storageKey);
      return isWebappThemeName(options.themeNames, storedThemeName)
        ? storedThemeName
        : options.defaultThemeName;
    } catch {
      return options.defaultThemeName;
    }
  };
  const writeStoredThemeName = (nextThemeName: TThemeName): void => {
    const storage = resolveThemeStorage(options.storage);
    if (!storage) {
      return;
    }

    try {
      storage.setItem(options.storageKey, nextThemeName);
    } catch {
      // Ignore storage failures; the in-memory theme still updates.
    }
  };
  const themeNameStore = createExternalStore<TThemeName>(readStoredThemeName());
  const getThemeName = () => themeNameStore.getSnapshot();
  const applyThemeClass = (nextThemeName = getThemeName()): void => {
    const document = resolveThemeDocument(options.document);
    if (!document) {
      return;
    }

    const root = document.documentElement;
    root.classList.remove(...themeClassNames);
    root.classList.add(options.themeClassByName[nextThemeName]);
    root.dataset.theme = nextThemeName;
  };
  const setThemeName = (nextThemeName: TThemeName): void => {
    if (nextThemeName === getThemeName()) {
      return;
    }

    writeStoredThemeName(nextThemeName);
    applyThemeClass(nextThemeName);
    themeNameStore.setSnapshot(nextThemeName);
  };

  return {
    applyThemeClass,
    getThemeName,
    initializeThemeClass: () => {
      applyThemeClass(getThemeName());
    },
    setThemeName,
    subscribeThemeName: (listener) => themeNameStore.subscribe(listener),
  };
}
