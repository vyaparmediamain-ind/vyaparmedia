import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const themeConsistencyPlugin = {
  meta: {
    name: "theme-consistency",
    version: "1.0.0",
  },
  rules: {
    "no-hardcoded-theme-bg": {
      meta: {
        type: "problem",
        docs: {
          description:
            "Disallow hardcoded bg-white, bg-black, bg-slate-*, bg-gray-* classes. Use semantic tokens from DESIGN_TOKENS.md.",
        },
        schema: [],
        messages: {
          forbiddenClass:
            "Regression Guard: Hardcoded class '{{className}}' is forbidden. Replace with semantic tokens (e.g., bg-background, bg-card, bg-muted, bg-primary, etc.) per DESIGN_TOKENS.md.",
        },
      },
      create(context) {
        const forbiddenPattern = /\bbg-(?:white|black|slate-\w+|gray-\w+)(?:\/\d+)?\b/g;

        function checkText(node, text) {
          if (typeof text !== "string") return;
          const matches = text.match(forbiddenPattern);
          if (matches) {
            for (const match of matches) {
              context.report({
                node,
                messageId: "forbiddenClass",
                data: { className: match },
              });
            }
          }
        }

        return {
          Literal(node) {
            if (typeof node.value === "string") {
              checkText(node, node.value);
            }
          },
          TemplateElement(node) {
            if (node.value && typeof node.value.raw === "string") {
              checkText(node, node.value.raw);
            }
          },
        };
      },
    },
  },
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "coverage/**",
  ]),
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "react/no-unescaped-entities": "off",
      "@typescript-eslint/no-unused-vars": ["warn", { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_", "caughtErrorsIgnorePattern": "^_" }],
      "@typescript-eslint/no-require-imports": "off",
      "@next/next/no-img-element": "off",
      "react-hooks/set-state-in-effect": "off"
    }
  },
  {
    files: ["src/**/*.{ts,tsx,js,jsx}"],
    plugins: {
      "theme-consistency": themeConsistencyPlugin,
    },
    rules: {
      "theme-consistency/no-hardcoded-theme-bg": "error",
    },
  },
  {
    files: ["scripts/**/*.{ts,js,mjs}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/ban-ts-comment": "error",
      "@typescript-eslint/no-unused-vars": ["warn", { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_", "caughtErrorsIgnorePattern": "^_" }]
    }
  },
  {
    files: ["tests/**/*.{ts,tsx,js,jsx}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": ["warn", { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_", "caughtErrorsIgnorePattern": "^_" }]
    }
  }
]);

export default eslintConfig;
