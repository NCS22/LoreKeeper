import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Import boundaries from .claude/rules/architecture.md, section 9.
// ESLint replaces (does not merge) the options of a rule when several config
// objects match the same file, so each object below lists every restriction
// that applies to its folder.

const DEEP_MODULE_IMPORT_PATTERN = {
  group: ["@/modules/*/*"],
  message:
    "Import another module only through its public interface: '@/modules/<module>'. Files inside a module use relative imports.",
};

const FRAMEWORK_AND_SDK_PATHS = [
  "@prisma/client",
  "next",
  "react",
  "better-auth",
].map((name) => ({
  name,
  message: `'${name}' belongs to the presentation or infrastructure layer and cannot be used here.`,
}));

const FRAMEWORK_AND_SDK_SUBPATH_PATTERN = {
  group: ["@prisma/client/*", "next/*", "react/*", "better-auth/*"],
  message:
    "Framework and SDK packages belong to the presentation or infrastructure layer and cannot be used here.",
};

const INFRASTRUCTURE_PATTERN = {
  group: ["**/infrastructure", "**/infrastructure/**"],
  message: "Domain and application code never depend on infrastructure.",
};

const APPLICATION_PATTERN = {
  group: ["**/application", "**/application/**"],
  message: "Domain code never depends on the application layer.",
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        { patterns: [DEEP_MODULE_IMPORT_PATTERN] },
      ],
    },
  },
  {
    files: ["src/modules/*/application/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: FRAMEWORK_AND_SDK_PATHS,
          patterns: [
            DEEP_MODULE_IMPORT_PATTERN,
            FRAMEWORK_AND_SDK_SUBPATH_PATTERN,
            INFRASTRUCTURE_PATTERN,
          ],
        },
      ],
    },
  },
  {
    files: ["src/modules/*/domain/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: FRAMEWORK_AND_SDK_PATHS,
          patterns: [
            DEEP_MODULE_IMPORT_PATTERN,
            FRAMEWORK_AND_SDK_SUBPATH_PATTERN,
            INFRASTRUCTURE_PATTERN,
            APPLICATION_PATTERN,
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
