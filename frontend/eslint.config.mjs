import { defineConfig, globalIgnores } from "eslint/config";
import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default defineConfig([
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "no-empty": ["error", { allowEmptyCatch: true }],
    },
  },
  {
    files: ["src/components/pico/**/*.js"],
    languageOptions: {
      globals: {
        AbortController: "readonly",
        IntersectionObserver: "readonly",
        ResizeObserver: "readonly",
        SpeechSynthesisUtterance: "readonly",
        cancelAnimationFrame: "readonly",
        clearInterval: "readonly",
        clearTimeout: "readonly",
        console: "readonly",
        document: "readonly",
        fetch: "readonly",
        matchMedia: "readonly",
        performance: "readonly",
        requestAnimationFrame: "readonly",
        setInterval: "readonly",
        setTimeout: "readonly",
        window: "readonly",
      },
    },
  },
  globalIgnores(["dist/**", "out/**", "build/**"]),
]);
