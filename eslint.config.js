export default [
  {
    ignores: ['node_modules/**', 'dist/**', 'coverage/**']
  },
  {
    files: ['**/*.js', '**/*.jsx'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: {
          jsx: true
        }
      },
      globals: {
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        document: 'readonly',
        window: 'readonly',
        navigator: 'readonly',
        describe: 'readonly',
        test: 'readonly',
        expect: 'readonly'
      }
    }
  }
];
