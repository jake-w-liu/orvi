import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

// Lint the shipped TypeScript library. Generated output, fixtures, the bundled
// VS Code/Obsidian runtimes, build scripts, and tests are out of scope here;
// they have their own checks (tsc, jest, prettier).
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
      "scripts/",
      "__tests__/",
      "fixtures/",
      "**/*.html",
      "**/*.cjs"
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname
      },
      globals: { ...globals.node }
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }
      ],
      eqeqeq: ["error", "smart"],
      "prefer-const": "error",
      "no-var": "error"
    }
  }
);
