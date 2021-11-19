'use strict';
import 'regenerator-runtime/runtime';
import { markdownEscape } from '../src/util';

describe('utils', () => {
  test('markdown escape', async () => {
    expect(markdownEscape('a')).toBe('a');
    expect(markdownEscape('a*')).toBe('a\\*');
    expect(markdownEscape('a**')).toBe('a\\*\\*');
  });
});