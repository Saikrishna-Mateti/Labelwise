const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const eslintPluginPrettierRecommended = require('eslint-plugin-prettier/recommended');

module.exports = defineConfig([
  expoConfig,
  eslintPluginPrettierRecommended,
  {
    ignores: ['dist/*', 'ios/*', 'android/*'],
  },
  {
    // Scoring stays pure: no UI, platform, network or storage code.
    files: ['src/scoring/**/*.ts'],
    ignores: ['src/scoring/__tests__/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: ['react', 'react-*', 'expo', 'expo-*', '@tanstack/*', '../data/*', '../*/*'] },
      ],
    },
  },
]);
