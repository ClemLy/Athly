import js from "@eslint/js";
import globals from "globals";

export default [
  {
    ignores: ["node_modules/**", "eslint.config.mjs"],
  },
  js.configs.recommended,
  {
    files: ["**/*.{js,mjs,cjs}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "commonjs",
      globals: {
        ...globals.node,
        ...globals.jest,
      },
    },
    rules: {
      // On autorise les variables inutilisées si elles commencent par "_"
      "no-unused-vars": ["error", { 
        "argsIgnorePattern": "^_",
        "varsIgnorePattern": "^_",
        "caughtErrorsIgnorePattern": "^_" 
      }],
      "no-undef": "error",
    },
  },
];