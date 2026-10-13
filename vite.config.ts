import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        guide: resolve(import.meta.dirname, "index.html"),
        reference: resolve(import.meta.dirname, "reference.html"),
        performance: resolve(import.meta.dirname, "performance.html"),
        json: resolve(import.meta.dirname, "json.html"),
      },
    },
  },
});
