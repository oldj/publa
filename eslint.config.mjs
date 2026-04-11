import js from '@eslint/js'
import typescript from '@typescript-eslint/eslint-plugin'
import typescriptParser from '@typescript-eslint/parser'
import prettier from 'eslint-config-prettier'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import globals from 'globals'

const customGlobals = {
  AbortController: 'readonly',
  AbortSignal: 'readonly',
  NodeJS: 'readonly',
  React: 'readonly',
}

const hybridGlobals = {
  ...globals.browser,
  ...globals.node,
  ...customGlobals,
}

export default [
  js.configs.recommended,
  prettier, // 直接包含 prettier 配置对象
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
      globals: hybridGlobals,
    },
    plugins: {
      '@typescript-eslint': typescript,
      react,
      'react-hooks': reactHooks,
    },
    rules: {
      // TypeScript 相关规则
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          args: 'none',
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-redeclare': 'error',
      '@typescript-eslint/naming-convention': [
        'warn',
        // 普通变量使用 camelCase 或 PascalCase，或以下划线开头
        {
          selector: 'variableLike',
          format: ['camelCase', 'PascalCase', 'UPPER_CASE'],
          leadingUnderscore: 'allow',
          trailingUnderscore: 'allow',
        },
        // 测试导出允许使用双下划线包裹的名称，例如 __testing__
        {
          selector: 'variable',
          modifiers: ['const'],
          format: null,
          filter: {
            regex: '^__.+__$',
            match: true,
          },
        },
        // 常量（const 声明的变量）允许多种格式
        {
          selector: 'variable',
          modifiers: ['const'],
          format: ['camelCase', 'PascalCase', 'UPPER_CASE'],
          leadingUnderscore: 'allow',
          trailingUnderscore: 'allow',
        },
        // 枚举成员允许 UPPER_CASE
        {
          selector: 'enumMember',
          format: ['UPPER_CASE'],
          leadingUnderscore: 'allow',
          trailingUnderscore: 'allow',
        },
      ],

      // React 相关规则
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      'react/jsx-uses-react': 'off',
      'react/jsx-uses-vars': 'error',

      // 通用规则
      'no-unused-vars': 'off', // 禁用原生规则，使用 TypeScript 专用规则
      // 'no-console': 'warn',
      'no-debugger': 'error',
      'prefer-const': 'off',
      'no-var': 'error',
      'no-redeclare': 'off', // 禁用原生规则，使用 TypeScript 专用规则
      'no-irregular-whitespace': [
        'warn',
        { skipStrings: true, skipComments: true, skipTemplates: true },
      ],
      'no-empty': 'warn',
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
  },
  // 为 .mjs 文件配置 Node.js 环境
  {
    files: ['**/*.mjs'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...customGlobals,
      },
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
  },
  {
    ignores: [
      'dist/',
      'build/',
      'dist-*/',
      'build-*/',
      'scripts/',
      'node_modules/',
      '*.js',
      '*.mjs',
      '*.d.ts',
    ],
  },
]
