const antfu = require('@antfu/eslint-config').default

module.exports = antfu({
  rules: {
    'no-void': ['off'],
    '@typescript-eslint/consistent-type-imports': ['off'],
    'dot-notation': ['off'],
    'ts/consistent-type-imports': ['off'],
    'ts/no-unsafe-function-type': ['off'],
  },
}, {
  ignores: ['*.md', '*.yaml'],
})
