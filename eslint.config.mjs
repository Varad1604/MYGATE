// SocietyOS shared ESLint flat config (ESLint 9).
// Kept deliberately lean: correctness-oriented rules; formatting is not
// policed here (Prettier can be layered later without churn).
// @ts-check
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["**/dist/**", "**/node_modules/**", "**/.next/**", "**/*.mjs"],
  },
  ...tseslint.configs.recommended.map((c) => ({
    ...c,
    files: ["**/*.ts", "**/*.tsx"],
  })),
  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "off", // Prisma JSON bridges use it sparingly
      // NOTE: deliberately NO consistent-type-imports rule here. Its autofix
      // rewrites value imports to `import type`, which erases emitDecorator-
      // Metadata and silently breaks NestJS dependency injection.
      "no-console": ["error", { allow: ["error", "warn", "info"] }],
      "eqeqeq": ["error", "smart"],
      "prefer-const": "error",
    },
  },
);
