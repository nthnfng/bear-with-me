import { describe, expect, it } from 'vitest';
import { paperGrid, paperPaths } from './paper';

describe('tattered paper', () => {
  it('is the same for the same size and seed', () => {
    expect(paperPaths(40, 20, 7)).toEqual(paperPaths(40, 20, 7));
    expect(paperPaths(40, 20, 7)).not.toEqual(paperPaths(40, 20, 8));
  });

  it('keeps the paper inside the card and the shadow one pixel down-right', () => {
    const g = paperGrid(30, 12, 3);
    expect(g).toHaveLength(13);
    expect(g[0]).toHaveLength(31);
    // The extra column and row only ever hold shadow.
    g.forEach((row) => expect(['.', 'd']).toContain(row[30]));
    g[12]!.forEach((c) => expect(['.', 'd']).toContain(c));
    // The middle is solid paper, the corners are torn away.
    expect(['p', 's', 'e']).toContain(g[6]![15]);
    expect(g[0]![0]).toBe('.');
  });

  it('outlines every paper pixel that touches the outside', () => {
    const g = paperGrid(24, 10, 11);
    const isPaper = (x: number, y: number) => ['o', 'e', 'p', 's'].includes(g[y]?.[x] ?? '.');
    for (let y = 0; y < 10; y++)
      for (let x = 0; x < 24; x++) {
        if (!isPaper(x, y)) continue;
        const open = [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ].some(([a, b]) => !isPaper(x + a!, y + b!));
        if (open) expect(g[y]![x]).toBe('o');
      }
  });
});
