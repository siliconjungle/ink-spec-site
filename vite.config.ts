import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        home: resolve(import.meta.dirname, "index.html"),
        guide: resolve(import.meta.dirname, "guide.html"),
        reference: resolve(import.meta.dirname, "reference.html"),
        performance: resolve(import.meta.dirname, "performance.html"),
        json: resolve(import.meta.dirname, "json.html"),
      },
    },
  },
});
