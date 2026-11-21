import { describe, expect, it } from 'vitest';
import { joinDeep, splitDeep } from './deep';

describe('deep selectors', () => {
  it('round-trips segments', () => {
    const s = joinDeep(['d2l-list', 'ul > li']);
    expect(s).toBe('d2l-list >>> ul > li');
    expect(splitDeep(s)).toEqual(['d2l-list', 'ul > li']);
  });
  it('a plain selector is one segment', () => {
    expect(splitDeep('ul > li')).toEqual(['ul > li']);
  });
});
