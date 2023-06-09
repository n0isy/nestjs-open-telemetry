module.exports = {
  roots: ['<rootDir>/src'],
  testMatch: ['**/tests/*.+(ts|js)'],
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
  },
  testEnvironment: 'node',
}
