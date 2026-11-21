// Tattered pixel paper for the popup's cards. Pure: no browser imports.
// A card of W x H art pixels gets ragged edges, torn corners, an outline, a darker rim, a few
// age stains and a 1px drop shadow, returned as SVG path data per colour (one `M x y.5 h n` run
// per horizontal stretch, drawn with stroke-width 1 and shape-rendering crispEdges).

export interface PaperPaths {
  shadow: string;
  outline: string;
  rim: string;
  paper: string;
  stain: string;
}

export const PAPER_COLORS: Record<keyof PaperPaths, string> = {
  shadow: '#1e0e08',
  outline: '#3a2419',
  rim: '#e4d2a6',
  paper: '#f3e6c6',
  stain: '#dcc493',
};

/** Small deterministic PRNG so a card keeps the same tears between renders. */
function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1103515245) + 12345) >>> 0;
    return (s >>> 1) / 2147483648;
  };
}

function depths(n: number, rnd: () => number): number[] {
  const d: number[] = [];
  while (d.length < n) {
    const run = 1 + Math.floor(rnd() * 4);
    const r = rnd();
    let v = r < 0.45 ? 0 : r < 0.8 ? 1 : 2;
    if (rnd() < 0.07) v = 3 + Math.floor(rnd() * 2);
    for (let i = 0; i < run && d.length < n; i++) d.push(v);
  }
  return d;
}

type Cell = '.' | 'd' | 'o' | 'e' | 'p' | 's';

/** The paper as a (W+1) x (H+1) grid; the extra row and column hold the shadow. */
export function paperGrid(W: number, H: number, seed: number): Cell[][] {
  const rnd = rng(seed);
  const top = depths(W, rnd);
  const bot = depths(W, rnd);
  const lef = depths(H, rnd);
  const rig = depths(H, rnd);
  const c = 4;
  const inside = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return false;
    if (y < top[x]! || y >= H - bot[x]! || x < lef[y]! || x >= W - rig[y]!) return false;
    if (x + y < c + 1) return false;
    if (W - 1 - x + y < c) return false;
    if (x + (H - 1 - y) < c - 1) return false;
    if (W - 1 - x + (H - 1 - y) < c + 1) return false;
    return true;
  };
  const stains = new Set<string>();
  for (let k = 0; k < Math.max(3, Math.round((W + H) / 20)); k++) {
    const edge = Math.floor(rnd() * 4);
    let cx: number, cy: number;
    if (edge === 0) [cx, cy] = [Math.floor(rnd() * W), 2 + Math.floor(rnd() * 3)];
    else if (edge === 1) [cx, cy] = [Math.floor(rnd() * W), H - 3 - Math.floor(rnd() * 3)];
    else if (edge === 2) [cx, cy] = [2 + Math.floor(rnd() * 3), Math.floor(rnd() * H)];
    else [cx, cy] = [W - 3 - Math.floor(rnd() * 3), Math.floor(rnd() * H)];
    const r = 1 + Math.floor(rnd() * 2);
    for (let dx = -r - 1; dx <= r + 1; dx++)
      for (let dy = -r; dy <= r; dy++)
        if ((dx * dx) / ((r + 1) * (r + 1)) + (dy * dy) / (r * r) <= 1 && rnd() < 0.8)
          stains.add(`${cx + dx},${cy + dy}`);
  }
  const n4 = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ] as const;
  const g: Cell[][] = Array.from({ length: H + 1 }, () => Array<Cell>(W + 1).fill('.'));
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (!inside(x, y)) continue;
      if (n4.some(([a, b]) => !inside(x + a, y + b))) g[y]![x] = 'o';
      else if (stains.has(`${x},${y}`)) g[y]![x] = 's';
      else if (n4.some(([a, b]) => n4.some(([p, q]) => !inside(x + a + p, y + b + q))))
        g[y]![x] = 'e';
      else g[y]![x] = 'p';
    }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) if (inside(x, y) && g[y + 1]![x + 1] === '.') g[y + 1]![x + 1] = 'd';
  return g;
}

const KEY: Record<Exclude<Cell, '.'>, keyof PaperPaths> = {
  d: 'shadow',
  o: 'outline',
  e: 'rim',
  p: 'paper',
  s: 'stain',
};

export function paperPaths(W: number, H: number, seed: number): PaperPaths {
  const out: PaperPaths = { shadow: '', outline: '', rim: '', paper: '', stain: '' };
  paperGrid(W, H, seed).forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x]!;
      if (ch === '.') {
        x++;
        continue;
      }
      let n = 1;
      while (row[x + n] === ch) n++;
      out[KEY[ch]] += `M${x} ${y}.5h${n}`;
      x += n;
    }
  });
  return out;
}
