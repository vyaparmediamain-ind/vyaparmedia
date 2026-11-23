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

const deadUiPlugin = {
  meta: {
    name: "dead-ui",
    version: "1.0.0",
  },
  rules: {
    "no-noop-onclick": {
      meta: {
        type: "problem",
        docs: {
          description: "Disallow noop onClick handlers like onClick={() => {}}.",
        },
        schema: [],
        messages: {
          forbiddenNoop: "Regression Guard: Empty noop onClick handlers are forbidden. Wire action or remove handler.",
        },
      },
      create(context) {
        return {
          JSXAttribute(node) {
            if (node.name?.name === "onClick" && node.value?.type === "JSXExpressionContainer") {
              const expr = node.value.expression;
              if (expr && expr.type === "ArrowFunctionExpression") {
                if (expr.body && expr.body.type === "BlockStatement" && expr.body.body.length === 0) {
                  context.report({ node, messageId: "forbiddenNoop" });
                }
              }
            }
          },
        };
      },
    },
    "no-hash-href": {
      meta: {
        type: "problem",
        docs: {
          description: "Disallow href='#' or href='' placeholder links.",
        },
        schema: [],
        messages: {
          forbiddenHref: "Regression Guard: Placeholder href='{{value}}' is forbidden. Use a valid route or a semantic button.",
        },
      },
      create(context) {
        return {
          JSXAttribute(node) {
            if (node.name?.name === "href" && node.value?.type === "Literal") {
              if (node.value.value === "#" || node.value.value === "") {
                context.report({
                  node,
                  messageId: "forbiddenHref",
                  data: { value: String(node.value.value) },
                });
              }
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
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/preserve-manual-memoization": "off"
    }
  },
  {
    files: ["src/**/*.{ts,tsx,js,jsx}"],
    plugins: {
      "theme-consistency": themeConsistencyPlugin,
      "dead-ui": deadUiPlugin,
    },
    rules: {
      "theme-consistency/no-hardcoded-theme-bg": "error",
      "dead-ui/no-noop-onclick": "error",
      "dead-ui/no-hash-href": "error",
      "no-empty": ["error", { "allowEmptyCatch": false }],
      "@typescript-eslint/no-non-null-assertion": "error",
      "no-console": ["error", { "allow": ["warn", "error", "info", "debug"] }],
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
