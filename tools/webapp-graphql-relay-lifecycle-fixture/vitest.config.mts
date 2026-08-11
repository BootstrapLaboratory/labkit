import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    fileParallelism: false,
    include: ["test/**/*.test.ts", "test/**/*.test.tsx"],
    isolate: true,
    setupFiles: ["./test/console-guard.ts"],
    testTimeout: 10_000,
  },
});
