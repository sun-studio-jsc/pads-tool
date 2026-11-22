import { defineConfig } from "vite";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  // Set VITE_BASE (e.g. "/playble-ads-tool/") when deploying under a subpath such as GitHub Pages.
  base: process.env.VITE_BASE || "/",
  server: {
    port: 5173,
    strictPort: true,
  },
  preview: {
    port: 5173,
    strictPort: true,
  },
  build: {
    // The remaining large chunk is mediabunny, which is already loaded on demand
    // (dynamic import in PreviewService) and can't be split further.
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/@gritsenko/cta-core") || id.includes("node_modules/jszip")) {
            return "packer";
          }
          if (id.includes("node_modules/lit") || id.includes("node_modules/@lit")) {
            return "lit";
          }
        },
      },
    },
  },
  resolve: {
    alias: {
      fw: fileURLToPath(new URL("./src/fw", import.meta.url)),
    },
  },
});
