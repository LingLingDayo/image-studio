import js from '@eslint/js';
import vue from 'eslint-plugin-vue';
import tseslint from 'typescript-eslint';
import { defineConfig, globalIgnores } from 'eslint/config';

const typedFiles = ['**/*.ts', '**/*.tsx', '**/*.mts', '**/*.cts', '**/*.vue'];

export default defineConfig(
  globalIgnores(['node_modules/**', 'dist/**', 'dist-ssr/**', 'coverage/**', '.temp/**']),
  js.configs.recommended,
  ...tseslint.configs.recommended.map((config) => ({ ...config, files: typedFiles })),
  ...vue.configs['flat/essential'],
  {
    files: typedFiles,
    rules: {
      // DOM 和类型声明由 vue-tsc 检查，避免 no-undef 误报 TypeScript 的类型名称。
      'no-undef': 'off',
      'no-empty': ['error', { allowEmptyCatch: true }],
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrors: 'none'
      }],
      // 历史协议边界与测试桩暂保留 any，不将接入 lint 变成全库类型重写。
      '@typescript-eslint/no-explicit-any': 'off'
    }
  },
  {
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: { parser: tseslint.parser, extraFileExtensions: ['.vue'] }
    },
    rules: {
      'vue/multi-word-component-names': ['error', { ignores: ['Tooltip'] }]
    }
  },
  {
    files: [
      'src/core/services/optimizer/**/*.ts',
      'src/core/storage/BackupService.ts',
      'src/core/storage/backup/**/*.ts',
      'src/composables/usePromptOptimizer.ts'
    ],
    rules: { '@typescript-eslint/no-explicit-any': 'error' }
  }
);
