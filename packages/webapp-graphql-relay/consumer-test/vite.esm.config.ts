import { defineConfig } from "vite";

export default defineConfig({
  build: {
    emptyOutDir: true,
    outDir: "dist-esm-smoke",
    rollupOptions: {
      output: {
        entryFileNames: "esm-smoke.js",
      },
    },
    ssr: "src/esm-smoke.ts",
  },
  ssr: {
    noExternal: true,
  },
});
