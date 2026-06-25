import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Resolve the project's "@/..." path alias (matches tsconfig paths) so unit
// tests can import lib modules the same way the app does. The context-facts core
// (lib/contextFacts.ts) is pure and type-only at its imports, so it loads in a
// plain node test environment with no database or Next runtime.
const root = fileURLToPath(new URL(".", import.meta.url)).replace(/\/$/, "");

export default defineConfig({
  resolve: {
    alias: { "@": root },
  },
  test: {
    environment: "node",
    include: ["test/**/*.test.ts", "lib/**/*.test.ts"],
  },
});
