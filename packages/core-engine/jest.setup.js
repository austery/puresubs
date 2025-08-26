// Jest setup file
// Mock fetch for testing
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    status: 200,
    text: () => Promise.resolve('<!DOCTYPE html><html><body>Test HTML</body></html>'),
    json: () => Promise.resolve({}),
  })
);
