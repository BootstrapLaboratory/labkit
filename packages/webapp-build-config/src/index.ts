export type BuildEnv = Record<string, string | undefined>;

export type RequireProductionBuildEnvOptions = {
  appName: string;
  command: string;
  env: BuildEnv;
  envFilePath: string;
  extraHelp?: readonly string[];
  requiredEnvNames: readonly string[];
};

export type PackageModuleChunkGroupInput = {
  name: string;
  packageNames: readonly string[];
  priority: number;
};

export type PackageModuleChunkGroup = {
  name: string;
  priority: number;
  test(moduleId: string): boolean;
};

export function getMissingEnvNames(
  env: BuildEnv,
  requiredEnvNames: readonly string[],
): string[] {
  return requiredEnvNames.filter((name) => {
    const value = env[name];

    return value === undefined || value.trim().length === 0;
  });
}

export function requireProductionBuildEnv(
  options: RequireProductionBuildEnvOptions,
): void {
  if (options.command !== "build") {
    return;
  }

  const missingEnvNames = getMissingEnvNames(
    options.env,
    options.requiredEnvNames,
  );

  if (missingEnvNames.length === 0) {
    return;
  }

  throw new Error(
    [
      `Missing required production ${options.appName} environment: ${missingEnvNames.join(", ")}.`,
      `Set these variables in the build environment or in ${options.envFilePath}.`,
      ...(options.extraHelp ?? []),
    ].join(" "),
  );
}

export function isPackageModule(
  moduleId: string,
  packageNames: readonly string[],
): boolean {
  return packageNames.some((packageName) => {
    const pnpmPackageName = packageName.replace("/", "+");

    return (
      moduleId.includes(`/node_modules/${packageName}/`) ||
      moduleId.includes(`/node_modules/.pnpm/${pnpmPackageName}@`)
    );
  });
}

export function createPackageModuleChunkGroups(
  groups: readonly PackageModuleChunkGroupInput[],
): PackageModuleChunkGroup[] {
  return groups.map(({ packageNames, ...group }) => ({
    ...group,
    test: (moduleId) => isPackageModule(moduleId, packageNames),
  }));
}
