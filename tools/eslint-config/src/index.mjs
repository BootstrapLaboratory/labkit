import eslint from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";
import globals from "globals";
import tseslint from "typescript-eslint";

const commonIgnores = [
  ".docusaurus/**",
  "build/**",
  "coverage/**",
  "dist/**",
  "node_modules/**",
  "storybook-static/**",
  "eslint.config.*",
];

const sharedTypeScriptRules = {
  "@typescript-eslint/no-explicit-any": "off",
  "@typescript-eslint/no-floating-promises": "warn",
  "@typescript-eslint/no-unsafe-argument": "warn",
  "@typescript-eslint/no-unused-vars": [
    "error",
    {
      argsIgnorePattern: "^_",
      caughtErrorsIgnorePattern: "^_",
      varsIgnorePattern: "^_",
    },
  ],
  "@typescript-eslint/require-await": "off",
};

const testTypeScriptRules = {
  "@typescript-eslint/no-floating-promises": "off",
  "@typescript-eslint/no-unsafe-assignment": "off",
  "@typescript-eslint/no-unsafe-call": "off",
  "@typescript-eslint/no-unsafe-member-access": "off",
  "@typescript-eslint/no-unsafe-return": "off",
};

const javaScriptRules = {
  "no-unused-vars": [
    "error",
    {
      argsIgnorePattern: "^_",
      caughtErrorsIgnorePattern: "^_",
      varsIgnorePattern: "^_",
    },
  ],
};

function mergeGlobals(...globalSets) {
  return Object.assign({}, ...globalSets);
}

export function createTypeScriptProjectConfig({
  extraIgnores = [],
  sourceGlobals = {},
  testGlobals = globals.node,
  tsconfigRootDir,
}) {
  if (!tsconfigRootDir) {
    throw new Error("createTypeScriptProjectConfig requires tsconfigRootDir.");
  }

  return tseslint.config(
    {
      ignores: [...commonIgnores, ...extraIgnores],
    },
    eslint.configs.recommended,
    ...tseslint.configs.recommendedTypeChecked,
    eslintConfigPrettier,
    {
      files: ["**/*.{ts,tsx}"],
      languageOptions: {
        globals: sourceGlobals,
        parserOptions: {
          projectService: true,
          tsconfigRootDir,
        },
      },
      rules: sharedTypeScriptRules,
    },
    {
      files: ["**/*.{spec,test}.{ts,tsx}", "test/**/*.{ts,tsx}"],
      languageOptions: {
        globals: testGlobals,
      },
      rules: testTypeScriptRules,
    },
  );
}

export function createNodeTypeScriptConfig(options) {
  return createTypeScriptProjectConfig({
    ...options,
    sourceGlobals: mergeGlobals(globals.node, options?.sourceGlobals),
    testGlobals: mergeGlobals(globals.node, options?.testGlobals),
  });
}

export function createBrowserTypeScriptConfig(options) {
  return createTypeScriptProjectConfig({
    ...options,
    sourceGlobals: mergeGlobals(globals.browser, options?.sourceGlobals),
    testGlobals: mergeGlobals(
      globals.node,
      globals.browser,
      options?.testGlobals,
    ),
  });
}

export function createUniversalTypeScriptConfig(options) {
  return createTypeScriptProjectConfig({
    ...options,
    testGlobals: mergeGlobals(globals.node, options?.testGlobals),
  });
}

export function createNodeBrowserTypeScriptConfig(options) {
  return createTypeScriptProjectConfig({
    ...options,
    sourceGlobals: mergeGlobals(
      globals.node,
      globals.browser,
      options?.sourceGlobals,
    ),
    testGlobals: mergeGlobals(
      globals.node,
      globals.browser,
      options?.testGlobals,
    ),
  });
}

export function createNodeJavaScriptConfig({ extraIgnores = [] } = {}) {
  return [
    {
      ignores: [...commonIgnores, ...extraIgnores],
    },
    eslint.configs.recommended,
    eslintConfigPrettier,
    {
      files: ["**/*.{js,mjs,cjs}"],
      languageOptions: {
        ecmaVersion: "latest",
        globals: globals.node,
        sourceType: "module",
      },
      rules: javaScriptRules,
    },
  ];
}
