const globals = require('globals');

module.exports = [
  { ignores: ['node_modules/**', 'dist/**', '.playwright-mcp/**', 'test-results/**', 'playwright-report/**'] },
  {
    files: ['js/**/*.js', 'tools/**/*.js'],
    languageOptions: { sourceType: 'script', globals: globals.browser }
  },
  {
    files: ['**/*.cjs'],
    languageOptions: { sourceType: 'commonjs', globals: globals.node }
  },
  {
    files: ['tools/ci/*.spec.cjs'],
    languageOptions: { globals: globals.browser }
  },
  {
    rules: {
      'no-undef': 'error',
      'no-dupe-args': 'error',
      'no-dupe-keys': 'error',
      'no-unreachable': 'error',
      'no-unsafe-finally': 'error',
      'valid-typeof': 'error',
      'constructor-super': 'error'
    }
  }
];
