module.exports = {
  root: true,
  extends: ['@react-native', 'plugin:prettier/recommended'],
  plugins: ['import'],
  rules: {
    'import/order': [
      'error',
      {
        groups: [
          'builtin',
          'external',
          'internal',
          'parent',
          'sibling',
          'index',
          'object',
          'type',
        ],
        'newlines-between': 'never',
        alphabetize: { order: 'asc', caseInsensitive: true },
        pathGroupsExcludedImportTypes: ['builtin'],
        pathGroups: [
          { pattern: 'src/**', group: 'internal', position: 'after' },
        ],
      },
    ],
    'sort-imports': 'off',
    // Warn on explicit `any` to keep TypeScript strict mode meaningful.
    // Use `unknown` for truly unknown shapes, or narrow with a type guard.
    '@typescript-eslint/no-explicit-any': 'warn',
    // Disallow empty block statements, including empty catch clauses.
    // Intentional no-ops must include a comment explaining why.
    'no-empty': ['error', { allowEmptyCatch: false }],
  },
  settings: {
    'import/resolver': {
      typescript: {},
    },
  },
};
