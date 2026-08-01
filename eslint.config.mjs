import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

const sharedRules = {
  eqeqeq: ["error", "smart"],
  "prefer-const": "error",
  "no-var": "error",
  "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }]
};

// Lints the shipped TypeScript library (src/, type-checked) plus the build
// scripts (syntactic only). Generated output, fixtures, the bundled
// VS Code/Obsidian runtimes, the playground, fuzz harnesses, and tests have
// their own checks (tsc, jest, prettier) and are out of scope here.
export default tseslint.config(
  {
    ignores: [
      "dist/",
      "coverage/",
      ".site/",
      "node_modules/",
      "playground/",
      "vscode/",
      "integrations/",
      "benchmarks/",
      "fuzz/",
      "__tests__/",
      "fixtures/",
      "**/*.html",
      "**/*.cjs",
      "orvi.config.example.js"
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.ts"],
    extends: tseslint.configs.recommendedTypeChecked,
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname
      },
      globals: { ...globals.node }
    },
    rules: {
      ...sharedRules,
      "@typescript-eslint/no-explicit-any": "off"
    }
  },
  {
    files: ["scripts/**/*.mjs", "*.mjs"],
    languageOptions: {
      globals: { ...globals.node }
    },
    rules: sharedRules
  }
);
