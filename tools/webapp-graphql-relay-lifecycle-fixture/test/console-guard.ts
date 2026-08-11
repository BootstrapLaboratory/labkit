import { afterEach, beforeEach, vi } from "vitest";

let messages: string[] = [];
let expectedMessages: RegExp[] = [];
let restoreError: (() => void) | undefined;
let restoreWarn: (() => void) | undefined;

beforeEach(() => {
  messages = [];
  expectedMessages = [];
  const errorSpy = vi.spyOn(console, "error").mockImplementation((...args) => {
    messages.push(`console.error: ${args.map(String).join(" ")}`);
  });
  const warnSpy = vi.spyOn(console, "warn").mockImplementation((...args) => {
    messages.push(`console.warn: ${args.map(String).join(" ")}`);
  });
  restoreError = () => errorSpy.mockRestore();
  restoreWarn = () => warnSpy.mockRestore();
});

afterEach(() => {
  restoreError?.();
  restoreWarn?.();
  restoreError = undefined;
  restoreWarn = undefined;
  const unmatchedExpected = [...expectedMessages];
  const unexpected = messages.filter((message) => {
    const matchIndex = unmatchedExpected.findIndex((pattern) =>
      pattern.test(message),
    );
    if (matchIndex < 0) {
      return true;
    }
    unmatchedExpected.splice(matchIndex, 1);
    return false;
  });
  if (unexpected.length > 0 || unmatchedExpected.length > 0) {
    throw new Error(
      [
        unexpected.length > 0
          ? `Unexpected console output:\n${unexpected.join("\n")}`
          : undefined,
        unmatchedExpected.length > 0
          ? `Expected console output was not observed:\n${unmatchedExpected.join("\n")}`
          : undefined,
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }
});

export function expectConsoleOutput(pattern: RegExp): void {
  expectedMessages.push(pattern);
}
