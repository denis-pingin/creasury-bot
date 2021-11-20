module.exports = function() {
  return {
    autoDetect: true,
    tests: [
      'test/simulation.test.js',
    ],
    workers: {
      initial: 1,
      regular: 1,
      restart: true,
    },
  };
};