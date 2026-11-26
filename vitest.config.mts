import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  oxc: {
    jsx: {
      runtime: "automatic",
    },
  },

  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
    fileParallelism: false,
  },

  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "."),
      "server-only": path.resolve(
        import.meta.dirname,
        "tests/server-only-stub.ts"
      ),
    },
  },
});
