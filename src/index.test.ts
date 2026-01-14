import { describe, it, expect } from 'vitest';
import { greet } from './index.js';

describe('greet', () => {
  it('returns a greeting with the provided name', () => {
    expect(greet('Alice')).toBe('Hello, Alice!');
  });
});
