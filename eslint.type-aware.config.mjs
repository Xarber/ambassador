import { defineConfig } from "eslint/config";
import baseConfig from "./eslint.config.mjs";

const eslintTypeAwareConfig = defineConfig([
  ...baseConfig,
  {
    files: ["**/*.ts", "**/*.tsx", "**/*.mts", "**/*.cts"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-unnecessary-condition": "error",
      "@typescript-eslint/switch-exhaustiveness-check": "error",
      "@typescript-eslint/no-unnecessary-type-assertion": "error",
      "@typescript-eslint/no-unsafe-type-assertion": "error",
      "@typescript-eslint/strict-boolean-expressions": "warn",
      "@typescript-eslint/only-throw-error": "warn",
    },
  },
]);

export default eslintTypeAwareConfig;
