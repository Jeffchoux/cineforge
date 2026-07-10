import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
    coverage: {
      // Rapport imprimé à chaque `npm test` (donc publié dans les logs CI).
      provider: "v8",
      reporter: ["text-summary", "json-summary", "html"],
      reportsDirectory: "./coverage",
      // Seuils gardés sur le cœur déterministe et testable (moteur + logique UI
      // extraite). Les vues purement présentationnelles (landing) et le câblage
      // React (couvert en e2e Playwright) restent hors du gate pour ne pas
      // transformer la couverture en bruit ; ils apparaissent dans le rapport.
      include: [
        "src/lib/engine/**/*.ts",
        "src/lib/rate-limit.ts",
        "src/components/studio/helpers.ts",
      ],
      exclude: ["src/lib/engine/index.ts", "src/lib/engine/types.ts", "**/*.d.ts"],
      thresholds: { lines: 85, functions: 85, branches: 72, statements: 85 },
    },
  },
});
