import { defineConfig } from "vite";

export default defineConfig({
  build: {
    emptyOutDir: true,
    outDir: "dist-ssr",
    rollupOptions: {
      output: {
        entryFileNames: "render-smoke.js",
      },
    },
    ssr: "src/render-smoke.tsx",
  },
  ssr: {
    noExternal: true,
  },
});
