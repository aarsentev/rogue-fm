import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

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
    // The Python ML dir (scripts + virtualenv). Its .venv bundles third-party
    // JS (matplotlib, sklearn) that has nothing to do with the app.
    "ml/**",
    // Generated Prisma client — machine output, not ours to lint.
    "app/generated/**",
  ]),
]);

export default eslintConfig;
