// Generates placeholder art into public/assets/. Run: node scripts/gen-placeholders.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
const out = 'public/assets/sprites';
mkdirSync(out, { recursive: true });
const poses = {
  chill: '#8bc4f0',
  studious: '#a5d6a7',
  confrontation: '#ef5350',
  okay: '#ffcc80',
  beaten: '#b39ddb',
  chud: '#a1887f',
};
for (const [name, color] of Object.entries(poses)) {
  writeFileSync(
    `${out}/${name}.svg`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
<circle cx="50" cy="40" r="30" fill="#6d4c41"/><circle cx="206" cy="40" r="30" fill="#6d4c41"/>
<rect x="8" y="8" width="240" height="240" rx="28" fill="${color}" stroke="#3e2723" stroke-width="8"/>
<circle cx="90" cy="100" r="12" fill="#222"/><circle cx="166" cy="100" r="12" fill="#222"/>
<text x="128" y="190" font-family="sans-serif" font-size="30" font-weight="bold" text-anchor="middle" fill="#222">${name}</text>
</svg>
`,
  );
}
const w = (f, s) => writeFileSync(`${out}/${f}`, s);
w(
  'arm-segment.svg',
  `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect width="64" height="64" fill="#8d6e63"/><rect y="0" width="64" height="6" fill="#5d4037"/><rect y="58" width="64" height="6" fill="#5d4037"/></svg>\n`,
);
w(
  'arm-fist.svg',
  `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><rect x="4" y="4" width="88" height="88" rx="22" fill="#8d6e63" stroke="#3e2723" stroke-width="6"/><text x="48" y="56" font-family="sans-serif" font-size="20" font-weight="bold" text-anchor="middle" fill="#222">FIST</text></svg>\n`,
);
w(
  'explosion.svg',
  `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><polygon fill="#ff9800" stroke="#e65100" stroke-width="10" points="256,10 300,150 440,60 370,200 502,256 370,312 440,452 300,362 256,502 212,362 72,452 142,312 10,256 142,200 72,60 212,150"/><circle cx="256" cy="256" r="90" fill="#ffeb3b"/><text x="256" y="268" font-family="sans-serif" font-size="40" font-weight="bold" text-anchor="middle" fill="#b71c1c">BOOM</text></svg>\n`,
);
w(
  'cave.svg',
  `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256"><rect width="256" height="256" fill="#37474f"/><path d="M20 256 V130 Q128 -10 236 130 V256 Z" fill="#263238"/><text x="128" y="200" font-family="sans-serif" font-size="28" font-weight="bold" text-anchor="middle" fill="#cfd8dc">cave</text></svg>\n`,
);
const poseEntries = Object.fromEntries(
  Object.keys(poses).map((p) => [
    p,
    {
      file: `sprites/${p}.svg`,
      frames: 1,
      fps: 1,
      anchors: { bubble: [128, 10], ...(p === 'studious' ? { hand: [236, 150] } : {}) },
    },
  ]),
);
const sounds = {
  chomp: ['sounds/roblox-eating-sound.mp3'],
  punch: ['sounds/slap.mp3'],
  ow: ['sounds/oof.mp3'],
  chudSong: ['sounds/im-a-chud.mp3'],
  burst: ['sounds/rahhh.mp3'],
};
writeFileSync(
  'public/assets/manifest.json',
  JSON.stringify(
    {
      frameSize: [256, 256],
      poses: poseEntries,
      arm: { segment: 'sprites/arm-segment.svg', fist: 'sprites/arm-fist.svg' },
      sounds,
      explosion: { file: 'sprites/explosion.svg', durationMs: 1000 },
      cave: 'sprites/cave.svg',
    },
    null,
    2,
  ) + '\n',
);
