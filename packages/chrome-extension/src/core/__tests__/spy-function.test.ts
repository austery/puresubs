/**
 * Tests for spy-function module
 */

import { spyFunction, spyFunctionString } from '../spy-function';

describe('spy-function', () => {
  it('should export spyFunction as a function', () => {
    expect(typeof spyFunction).toBe('function');
  });

  it('should export spyFunctionString as a string', () => {
    expect(typeof spyFunctionString).toBe('string');
    expect(spyFunctionString.length).toBeGreaterThan(0);
  });
});
