// Generates placeholder art into public/assets/. Run: node scripts/gen-placeholders.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
const out = 'public/assets/sprites';
mkdirSync(out, { recursive: true });
// Placeholder bear. Real art is still needed; these just make the Arm fight readable.
const FUR = '#8d5a3b';
const DARK = '#3e2723';
const SNOUT = '#e0b48a';
const eye = (x, y, kind) => {
  if (kind === 'x')
    return `<path d="M${x - 9} ${y - 9}L${x + 9} ${y + 9}M${x + 9} ${y - 9}L${x - 9} ${y + 9}" stroke="#222" stroke-width="6" stroke-linecap="round"/>`;
  if (kind === 'flat')
    return `<path d="M${x - 11} ${y}H${x + 11}" stroke="#222" stroke-width="6" stroke-linecap="round"/>`;
  if (kind === 'happy')
    return `<path d="M${x - 10} ${y + 4}Q${x} ${y - 10} ${x + 10} ${y + 4}" stroke="#222" fill="none" stroke-width="5" stroke-linecap="round"/>`;
  return `<circle cx="${x}" cy="${y}" r="${kind === 'wide' ? 12 : 9}" fill="#222"/>`;
};
function bear({
  body = 0,
  eyes = 'dot',
  mouth = 'smile',
  brows = false,
  glasses = false,
  extra = '',
  fur = FUR,
}) {
  const rx = 100 + body;
  const cx = 128;
  const mouths = {
    smile:
      '<path d="M108 178Q128 196 148 178" stroke="#222" fill="none" stroke-width="5" stroke-linecap="round"/>',
    flat: '<path d="M112 182H144" stroke="#222" stroke-width="5" stroke-linecap="round"/>',
    open: '<ellipse cx="128" cy="184" rx="20" ry="16" fill="#5d1a1a" stroke="#222" stroke-width="4"/><rect x="116" y="170" width="24" height="7" fill="#fff"/>',
    frown:
      '<path d="M108 190Q128 172 148 190" stroke="#222" fill="none" stroke-width="5" stroke-linecap="round"/>',
  };
  return `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
<circle cx="${cx - rx + 30}" cy="52" r="30" fill="${fur}" stroke="${DARK}" stroke-width="6"/><circle cx="${cx + rx - 30}" cy="52" r="30" fill="${fur}" stroke="${DARK}" stroke-width="6"/>
<circle cx="${cx - rx + 30}" cy="52" r="14" fill="${SNOUT}"/><circle cx="${cx + rx - 30}" cy="52" r="14" fill="${SNOUT}"/>
<ellipse cx="${cx}" cy="138" rx="${rx}" ry="${100 + body / 2}" fill="${fur}" stroke="${DARK}" stroke-width="7"/>
<ellipse cx="${cx}" cy="168" rx="46" ry="36" fill="${SNOUT}"/>
<ellipse cx="${cx}" cy="150" rx="15" ry="10" fill="${DARK}"/>
${eye(92, 112, eyes)}${eye(164, 112, eyes)}
${brows ? '<path d="M70 92L108 104M186 92L148 104" stroke="#222" stroke-width="9" stroke-linecap="round"/>' : ''}
${glasses ? '<circle cx="92" cy="112" r="24" fill="rgba(200,230,255,.35)" stroke="#222" stroke-width="5"/><circle cx="164" cy="112" r="24" fill="rgba(200,230,255,.35)" stroke="#222" stroke-width="5"/><path d="M116 112H140" stroke="#222" stroke-width="5"/>' : ''}
${mouths[mouth]}
${extra}
</svg>
`;
}
const poses = {
  chill: bear({ eyes: 'happy', mouth: 'smile' }),
  // Paw at the hand anchor (236,150): the Reach arm comes out from here.
  studious: bear({
    glasses: true,
    mouth: 'flat',
    extra: `<circle cx="236" cy="150" r="16" fill="${FUR}" stroke="${DARK}" stroke-width="6"/>`,
  }),
  confrontation: bear({ body: 18, eyes: 'wide', brows: true, mouth: 'open', fur: '#a8553a' }),
  okay: bear({
    eyes: 'flat',
    mouth: 'flat',
    extra:
      '<text x="200" y="70" font-family="sans-serif" font-size="30" font-weight="bold" fill="#555">-_-</text>',
  }),
  beaten: bear({
    eyes: 'x',
    mouth: 'frown',
    extra: `<rect x="150" y="60" width="50" height="16" rx="4" fill="#fff" stroke="#999" stroke-width="3" transform="rotate(-20 175 68)"/><circle cx="62" cy="150" r="10" fill="#7e57c2" opacity=".6"/>`,
  }),
  chud: bear({ body: 26, eyes: 'wide', mouth: 'open', fur: '#a1887f' }),
};
for (const [name, svg] of Object.entries(poses)) writeFileSync(`${out}/${name}.svg`, svg);
const w = (f, s) => writeFileSync(`${out}/${f}`, s);
w(
  'arm-segment.svg',
  `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect width="64" height="64" fill="#8d5a3b"/><rect width="64" height="7" fill="#3e2723"/><rect y="57" width="64" height="7" fill="#3e2723"/><path d="M12 18l8 8M12 26l8-8M44 38l8 8M44 46l8-8" stroke="#6b3f26" stroke-width="3" stroke-linecap="round"/></svg>\n`,
);
w(
  'arm-fist.svg',
  `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><rect x="0" y="24" width="30" height="48" fill="#8d5a3b" stroke="#3e2723" stroke-width="6"/><rect x="22" y="14" width="66" height="68" rx="22" fill="#8d5a3b" stroke="#3e2723" stroke-width="6"/><path d="M60 22V74M60 40H88M60 58H88" stroke="#3e2723" stroke-width="5" stroke-linecap="round"/><rect x="22" y="2" width="34" height="22" rx="10" fill="#8d5a3b" stroke="#3e2723" stroke-width="6"/></svg>\n`,
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
