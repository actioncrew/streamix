import angularEslintPlugin from '@angular-eslint/eslint-plugin';
import angularEslintTemplatePlugin from '@angular-eslint/eslint-plugin-template';
import typescriptEslintPlugin from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';
import { defineConfig } from 'eslint-define-config';
import eslintPluginImport from 'eslint-plugin-import';
import unusedImportsPlugin from 'eslint-plugin-unused-imports';

export default defineConfig({
  languageOptions: {
    parser: typescriptParser,
    parserOptions: {
      project: './tsconfig.json',
      sourceType: 'module',
    },
    ecmaVersion: 2022,
  },
  plugins: {
    '@typescript-eslint': typescriptEslintPlugin,
    'unused-imports': unusedImportsPlugin,
    'import': eslintPluginImport,
    '@angular-eslint': angularEslintPlugin,
    '@angular-eslint/template': angularEslintTemplatePlugin,
  },
  rules: {
    // Base ESLint rules
    'no-unused-vars': 'off',

    // TypeScript ESLint rules
    '@typescript-eslint/adjacent-overload-signatures': 'warn',
    '@typescript-eslint/no-unused-vars': ['warn', {
      argsIgnorePattern: '^_',
    }],

    // Unused imports rules
    'unused-imports/no-unused-imports': 'warn',
    'unused-imports/no-unused-vars': [
      'warn',
      {
        vars: 'all',
        varsIgnorePattern: '^_',
        args: 'after-used',
        argsIgnorePattern: '^_',
      }
    ],

    // Import rules
    'import/no-unused-modules': 'warn',

    // Angular ESLint rules
    '@angular-eslint/component-class-suffix': 'warn',
    '@angular-eslint/directive-class-suffix': 'warn',
    '@angular-eslint/no-empty-lifecycle-method': 'warn'
  },
  ignores: ['**/dist/**', '**/docs/**', '**/node_modules/**'],
  files: ['**/*.ts', '**/*.tsx']
});
