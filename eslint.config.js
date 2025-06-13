// eslint.config.js
export default [
  {
    // Define the environment
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        // Node.js globals
        process: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        module: 'readonly',
        require: 'readonly',
        // Jest globals
        jest: 'readonly',
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
      },
    },
    // Specify project files to lint
    files: ['**/*.js'],
    ignores: ['node_modules/**', 'dist/**', 'coverage/**'],
    // Define rules          
    rules: {
      indent: 'off', // Disable indent rule due to mixed indentation styles
      'linebreak-style': 'off',
      quotes: ['warn', 'single'], // Change to warning
      semi: ['error', 'always'],
      'no-unused-vars': ['warn'],
      'no-console': 'off' // Allow console statements for now
    },
  },
];
