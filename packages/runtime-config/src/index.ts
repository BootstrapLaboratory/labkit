const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);
const FALSE_VALUES = new Set(["0", "false", "no", "off"]);

export type NumberParseOptions = {
  max?: number;
  min?: number;
};

export function parseBoolean(
  value: string | null | undefined,
  fallback: boolean,
): boolean {
  if (value === undefined || value === null) {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();

  if (TRUE_VALUES.has(normalized)) {
    return true;
  }

  if (FALSE_VALUES.has(normalized)) {
    return false;
  }

  return fallback;
}

export function parseNumber(
  value: string | null | undefined,
  fallback: number,
): number {
  if (value === undefined || value === null) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

export function parseFiniteNumber(
  value: string | null | undefined,
  fallback: number,
  options: NumberParseOptions = {},
): number {
  if (value === undefined || value === null || value.trim() === "") {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  if (options.min !== undefined && parsed < options.min) {
    return fallback;
  }

  if (options.max !== undefined && parsed > options.max) {
    return fallback;
  }

  return parsed;
}

export function parseList(value: string | null | undefined): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}
