import { defineConfig } from "vitest/config";

export default defineConfig({
  server: { port: 5173, proxy: { "/api": "http://127.0.0.1:8787" } },
  preview: { proxy: { "/api": "http://127.0.0.1:8787" } },
  build: { target: "es2022", sourcemap: true, chunkSizeWarningLimit: 900 },
  test: { environment: "node", include: ["test/**/*.test.ts"] },
});
