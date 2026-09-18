import tseslint from 'typescript-eslint';

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
        URL: 'readonly',
        setTimeout: 'readonly',
        describe: 'readonly',
        test: 'readonly',
        expect: 'readonly'
      }
    }
  },
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      globals: {
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly'
      }
    }
  },
  {
    files: ['apps/frontend/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "Property[key.name=/^shadow(Color|Offset|Opacity|Radius)$/]",
          message: 'React Native shadow* style props are deprecated. Use boxShadow.'
        },
        {
          selector: "JSXAttribute[name.name='pointerEvents']",
          message: 'React Native pointerEvents prop is deprecated. Use style.pointerEvents.'
        }
      ]
    }
  }
];
