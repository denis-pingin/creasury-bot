module.exports = {
  testTimeout: 60 * 60 * 1000,
  preset: '@shelf/jest-mongodb',
  forceExit: true,
  testPathIgnorePatterns: [
    'test/simulation.test.js',
  ],
};