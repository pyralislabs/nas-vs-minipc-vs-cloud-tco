import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          maximumDefaultProjectFileMatchCount_THIS_WILL_SLOW_DOWN_LINTING: 20,
          allowDefaultProject: [
            "tests/cli/*.ts",
            "tests/core/*.ts",
            "tests/fixtures/*.ts",
            "tests/format/*.ts",
            "tests/package/*.ts",
            "tests/schema/*.ts",
            "tests/widget/*.ts",
            "eslint.config.js",
          ],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/switch-exhaustiveness-check": "error",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/restrict-template-expressions": "off",
      "@typescript-eslint/no-non-null-assertion": "warn",
      "@typescript-eslint/no-unnecessary-condition": "warn",
      "prefer-const": "error",
    },
  },
  {
    files: ["src/core/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "ajv",
              message: "src/core/ must not depend on Ajv.",
            },
            {
              name: "commander",
              message: "src/core/ must not depend on Commander.",
            },
          ],
          patterns: [
            {
              group: ["node:*", "fs", "path", "os", "process", "child_process"],
              message: "src/core/ must not depend on Node APIs.",
            },
          ],
        },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector: 'CallExpression[callee.name="Decimal"]',
          message: "Use the money helpers from src/core/money.ts to construct Decimal values.",
        },
        {
          selector: 'NewExpression[callee.name="Decimal"]',
          message: "Use the money helpers from src/core/money.ts to construct Decimal values.",
        },
      ],
    },
  },
  {
    files: ["src/widget/**"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            'MemberExpression[property.name="innerHTML"], MemberExpression[property.name="outerHTML"], CallExpression[callee.property.name="insertAdjacentHTML"]',
          message: "Widget must not use innerHTML, outerHTML, or insertAdjacentHTML.",
        },
      ],
    },
  },
  {
    ignores: [
      "dist/",
      "coverage/",
      "node_modules/",
      ".wrangler/",
      "src/schema/validator.precompiled.mjs",
      "*.tgz",
      "vite.config.ts",
      "vitest.config.ts",
      "worker/index.ts",
      "scripts/",
      "eslint.config.js",
    ],
  },
);
