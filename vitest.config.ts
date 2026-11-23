import { defineConfig } from "vitest/config";
import path from "node:path";
import react from "@vitejs/plugin-react";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "node",
          environment: "node",
          globals: true,
          setupFiles: ["./tests/setup.ts"],
          include: ["tests/**/*.test.ts"],
          exclude: ["tests/components/**/*.test.tsx", "tests/e2e-pw/**"],
          testTimeout: 30000,
          hookTimeout: 30000,
          server: {
            deps: {
              inline: ["next-auth"],
            },
          },
          // Node tests execute integration suites against PostgreSQL and Redis.
          // Sequential file execution prevents database transaction conflicts, race conditions,
          // and shared seed data collisions.
          fileParallelism: false,
        },
        resolve: {
          alias: {
            "@": path.resolve(__dirname, "./src"),
            "server-only": path.resolve(__dirname, "./tests/empty-module.ts"),
            "next/server": path.resolve(__dirname, "./node_modules/next/server.js"),
          },
        },
      },
      {
        plugins: [react()],
        test: {
          name: "dom",
          environment: "jsdom",
          globals: true,
          setupFiles: ["./tests/setup-dom.ts"],
          include: ["tests/components/**/*.test.tsx"],
          exclude: ["tests/e2e-pw/**"],
          testTimeout: 15000,
          hookTimeout: 15000,
          // DOM / component tests execute strictly within jsdom memory with isolated component trees
          // and mocked API contexts. Having zero database or shared process dependencies makes them
          // completely safe to run in parallel across worker threads.
          fileParallelism: true,
        },
        resolve: {
          alias: {
            "@": path.resolve(__dirname, "./src"),
            "server-only": path.resolve(__dirname, "./tests/empty-module.ts"),
            "next/server": path.resolve(__dirname, "./node_modules/next/server.js"),
          },
        },
      },
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "json-summary", "html"],
      include: ["src/**"],
      exclude: [
        "src/**/*.d.ts",
        "src/generated/**",
        "src/app/**/page.tsx",
        "src/app/**/layout.tsx",
      ],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "server-only": path.resolve(__dirname, "./tests/empty-module.ts"),
      "next/server": path.resolve(__dirname, "./node_modules/next/server.js"),
    },
  },
});
