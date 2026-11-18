// @ts-check
import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/coverage/**",
      "**/.expo/**",
      "**/.wrangler/**",
      "apps/mobile/expo-env.d.ts",
      "**/ios/**",
      "**/android/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },
  {
    files: ["apps/mobile/**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks },
    languageOptions: {
      globals: { __DEV__: "readonly" },
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
    },
  },
  {
    // docs/design.md §7: components use theme tokens only. Raw colors live in theme/tokens.ts.
    files: ["apps/mobile/src/**/*.{ts,tsx}"],
    ignores: ["apps/mobile/src/theme/tokens.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "Literal[value=/^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/]",
          message: "Use a theme token from useTheme() instead of a raw hex color.",
        },
        {
          selector: "Literal[value=/^(?:rgb|rgba|hsl|hsla)\\(/]",
          message: "Use a theme token from useTheme() instead of a raw color.",
        },
      ],
    },
  },
  {
    // Metro resolves static images through require(); jest.mock factories cannot use import.
    files: ["apps/mobile/src/lib/brand.ts", "apps/mobile/jest.setup.ts"],
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
  {
    // Tests may print diagnostic output.
    files: ["**/*.test.ts", "**/*.test.tsx"],
    rules: { "no-console": "off" },
  },
  prettier,
);
