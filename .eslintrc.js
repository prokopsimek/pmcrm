module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    project: ['./tsconfig.json', './apps/*/tsconfig.json', './packages/*/tsconfig.json'],
  },
  env: {
    node: true,
    es2022: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
    'plugin:import/recommended',
    'plugin:import/typescript',
    'prettier',
  ],
  plugins: ['@typescript-eslint', 'import', 'simple-import-sort', 'unused-imports'],
  settings: {
    'import/resolver': {
      typescript: {
        alwaysTryTypes: true,
        project: ['./tsconfig.json', './apps/*/tsconfig.json', './packages/*/tsconfig.json'],
      },
    },
  },
  rules: {
    // TypeScript strict rules - NO 'any' types
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-unsafe-assignment': 'error',
    '@typescript-eslint/no-unsafe-member-access': 'error',
    '@typescript-eslint/no-unsafe-call': 'error',
    '@typescript-eslint/no-unsafe-return': 'error',
    '@typescript-eslint/no-unsafe-argument': 'error',
    '@typescript-eslint/explicit-function-return-type': [
      'error',
      {
        allowExpressions: true,
        allowTypedFunctionExpressions: true,
        allowHigherOrderFunctions: true,
      },
    ],
    '@typescript-eslint/explicit-module-boundary-types': 'error',
    '@typescript-eslint/strict-boolean-expressions': 'error',
    '@typescript-eslint/no-non-null-assertion': 'error',
    '@typescript-eslint/no-unused-vars': 'off', // Handled by unused-imports plugin
    '@typescript-eslint/consistent-type-imports': [
      'error',
      { prefer: 'type-imports', fixable: 'code' },
    ],
    '@typescript-eslint/consistent-type-exports': 'error',
    '@typescript-eslint/naming-convention': [
      'error',
      {
        selector: 'interface',
        format: ['PascalCase'],
        prefix: ['I'],
      },
      {
        selector: 'typeAlias',
        format: ['PascalCase'],
      },
      {
        selector: 'enum',
        format: ['PascalCase'],
      },
      {
        selector: 'enumMember',
        format: ['UPPER_CASE'],
      },
    ],

    // Error handling patterns
    '@typescript-eslint/no-throw-literal': 'error',
    '@typescript-eslint/prefer-promise-reject-errors': 'error',
    'no-console': ['warn', { allow: ['warn', 'error'] }],

    // Import organization
    'simple-import-sort/imports': [
      'error',
      {
        groups: [
          // Node.js builtins
          ['^node:'],
          // External packages
          ['^@?\\w'],
          // Internal packages
          ['^(@|~)/'],
          // Parent imports
          ['^\\.\\.(?!/?$)', '^\\.\\./?$'],
          // Other relative imports
          ['^\\./(?=.*/)(?!/?$)', '^\\.(?!/?$)', '^\\./?$'],
          // Type imports
          ['^.+\\.?(types|interface|dto)$'],
        ],
      },
    ],
    'simple-import-sort/exports': 'error',
    'import/first': 'error',
    'import/newline-after-import': 'error',
    'import/no-duplicates': 'error',
    'import/no-unresolved': 'error',
    'import/no-cycle': 'error',
    'import/no-default-export': 'warn',

    // Unused imports
    'unused-imports/no-unused-imports': 'error',
    'unused-imports/no-unused-vars': [
      'error',
      {
        vars: 'all',
        varsIgnorePattern: '^_',
        args: 'after-used',
        argsIgnorePattern: '^_',
      },
    ],

    // Code quality
    'no-debugger': 'error',
    'no-alert': 'error',
    'prefer-const': 'error',
    'no-var': 'error',
    'object-shorthand': 'error',
    'prefer-template': 'error',
    'prefer-arrow-callback': 'error',
    'no-nested-ternary': 'error',
    complexity: ['warn', 10],
    'max-lines': ['warn', { max: 500, skipBlankLines: true, skipComments: true }],
    'max-depth': ['warn', 4],
  },
  overrides: [
    {
      // Next.js specific rules
      files: ['apps/web/**/*.{ts,tsx}'],
      env: {
        browser: true,
      },
      extends: ['plugin:react/recommended', 'plugin:react-hooks/recommended'],
      plugins: ['react', 'react-hooks'],
      rules: {
        'react/react-in-jsx-scope': 'off',
        'react/prop-types': 'off',
        'import/no-default-export': 'off', // Next.js pages require default exports
      },
    },
    {
      // Test files
      files: ['**/*.test.ts', '**/*.test.tsx', '**/*.spec.ts', '**/*.spec.tsx'],
      env: {
        jest: true,
      },
      rules: {
        '@typescript-eslint/no-unsafe-assignment': 'off',
        '@typescript-eslint/no-explicit-any': 'off',
      },
    },
    {
      // Configuration files
      files: ['*.config.{js,ts}', '.eslintrc.js'],
      rules: {
        'import/no-default-export': 'off',
        '@typescript-eslint/no-var-requires': 'off',
      },
    },
  ],
};
