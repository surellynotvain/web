// flat ESLint config for Next.js 15 using the compat shim, since
// eslint-config-next still ships a classic "extends" config.
import { FlatCompat } from "@eslint/eslintrc";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const config = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "public/**",
      "data/**",
      "additions/**",
      "scripts/**",
      "deploy/**",
      "next-env.d.ts",
    ],
  },
  {
    rules: {
      // we already sanitize with DOMPurify; the warning on blog/[slug] is noise
      "react/no-danger": "off",
      "@next/next/no-img-element": "warn",
    },
  },
];

export default config;
