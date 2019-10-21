const detectEditors = require('../');

test('Test getAvailableShells()', (done)=> {
  expect.assertions(3);
  detectEditors
    .getAvailableShells()
    .then((shells)=> {
      expect(shells.length).toBeGreaterThan(0);
      expect(shells[0]).toHaveProperty('shell');
      expect(shells[0]).toHaveProperty('path');
      done();
    });
});
