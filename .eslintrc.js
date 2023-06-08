module.exports = {
  extends: '@antfu',
  rules: {
    'no-void': ['off'],
    '@typescript-eslint/no-unused-vars': ['error', { ignoreRestSiblings: true, argsIgnorePattern: '^_' }],
    '@typescript-eslint/consistent-type-imports': ['off'],
    'dot-notation': ['off'],
    '@typescript-eslint/no-inferrable-types': ['error', { ignoreProperties: true }],
    '@typescript-eslint/explicit-module-boundary-types': ['error'],
  },
}
