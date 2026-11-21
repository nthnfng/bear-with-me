// Shadow-root styles. The animation classes are ported from demo/barry/barry.css (the team's
// demo); only how Barry looks lives here, never what he does (ADR 0001).
export const CSS = `
:host { all: initial; }
.root { position: fixed; inset: 0; z-index: 2147483647; pointer-events: none;
  font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace; --ink: #1e1a16; }
.root[hidden] { display: none; }

/* placement: the column of bubble, hud, stage and button */
.barry { position: fixed; display: flex; flex-direction: column; align-items: center;
  pointer-events: none; }
.barry.corner { bottom: 0; }
.barry.corner.left { left: 8px; }
.barry.corner.right { right: 8px; }
.barry.corner.middle { left: 50%; transform: translateX(-50%); }
.barry.face { left: 50%; top: 50%; transform: translate(calc(-50% + var(--sway, 0px)), -50%); }
.barry.dancing { transition: transform .9s ease-in-out; }
.stage { position: relative; display: flex; justify-content: center; }

/* every sprite is a div with a PNG strip as its background, scaled with crisp pixels */
.sprite { image-rendering: pixelated; background-repeat: no-repeat; transform-origin: 50% 100%; }
.face .sprite { transform-origin: 50% 50%; }
.barry.fighting .sprite, .barry.clickable .sprite { pointer-events: auto; cursor: pointer; }

/* idle: breathe (squash from the feet) */
.breathe { animation: breathe 1.6s ease-in-out infinite; }
@keyframes breathe { 50% { transform: scale(1.04, .95); } }
/* burst in: pop from the bottom with overshoot */
.pop { animation: pop .45s cubic-bezier(.34,1.56,.64,1); }
@keyframes pop { 0% { transform: scale(0); } 60% { transform: scale(1.25,.85); } 100% { transform: scale(1); } }
.pop.fast { animation-duration: .25s; }
/* chomp: quick squash */
.chomp { animation: chomp .18s ease-out; }
@keyframes chomp { 50% { transform: scale(1.15,.85); } }
/* punch: white flash + shake */
.hit { animation: hit .3s steps(2); }
@keyframes hit { 0% { filter: brightness(3); translate: -6px 0; } 50% { filter: none; translate: 6px 0; } 100% { translate: 0 0; } }
/* squash flat, then stretch up: swaps between poses */
.squash { animation: squash .15s ease-in forwards; }
@keyframes squash { to { transform: scale(1.25, .7); } }
.unsquash { animation: unsquash .35s cubic-bezier(.34,1.56,.64,1); }
@keyframes unsquash { 0% { transform: scale(1.25, .7); } 60% { transform: scale(.9, 1.12); } 100% { transform: scale(1); } }
/* one slow happy jump */
.slowjump { animation: slowjump .9s ease-in-out; }
@keyframes slowjump { 0%, 100% { translate: 0 0; } 45% { translate: 0 -28px; } }
/* max chud: bounce while singing */
.bounce { animation: bounce .4s steps(2) infinite; }
@keyframes bounce { 50% { transform: translateY(-8px) scale(.96, 1.04); } }

/* speech bubble: CSS, so it stretches to any text */
.bubble { position: relative; max-width: 320px; background: #fff; color: var(--ink);
  border: 4px solid var(--ink); padding: 6px 10px; font-weight: 600; font-size: 14px; line-height: 1.3;
  text-align: center; margin-bottom: 16px; }
.bubble::after { content: ""; position: absolute; left: 50%; bottom: -12px; width: 12px; height: 12px;
  background: #fff; border-right: 4px solid var(--ink); border-bottom: 4px solid var(--ink);
  rotate: 45deg; translate: -50% 0; }
.bubble[hidden], .btn[hidden], .suggest[hidden], .pill[hidden], .arm[hidden],
.stars[hidden] { display: none; }
.bubble.popin, .suggest.popin { animation: pop .3s cubic-bezier(.34,1.56,.64,1); transform-origin: 50% 100%; }
.bubble img { image-rendering: pixelated; width: 21px; height: 21px; vertical-align: -4px; margin-right: 4px; }
.bubble .count { font-variant-numeric: tabular-nums; }
.face .bubble { font-size: 22px; max-width: 460px; }
.suggest { position: relative; max-width: 300px; background: #fff; color: var(--ink);
  border: 4px solid var(--ink); padding: 6px 28px 6px 10px; font-size: 14px; font-weight: 600;
  line-height: 1.3; text-align: left; margin-bottom: 16px; pointer-events: auto; }
.suggest::after { content: ""; position: absolute; left: 50%; bottom: -12px; width: 12px; height: 12px;
  background: #fff; border-right: 4px solid var(--ink); border-bottom: 4px solid var(--ink);
  rotate: 45deg; translate: -50% 0; }
.suggest .x { position: absolute; top: 2px; right: 4px; border: 0; background: transparent;
  font: inherit; font-size: 18px; line-height: 1; cursor: pointer; color: #555; padding: 2px 4px; }
.btn { pointer-events: auto; cursor: pointer; margin-top: 10px; font: inherit; font-size: 20px;
  font-weight: 700; padding: 8px 20px; border: 4px solid var(--ink); background: #86b04a; color: var(--ink); }
.btn:hover { background: #9cc65a; }


/* the stretchy arm: drawn in code (white bar + dark outline); a wide invisible hit area for punching */
.arm { position: fixed; width: 0; height: 0; transform-origin: 0 50%; pointer-events: none; }
.armbar { position: absolute; left: 0; top: calc(var(--th) / -2); height: var(--th); width: 0;
  background: #fff; border: var(--bw) solid var(--ink); border-radius: var(--bw); box-sizing: content-box;
  pointer-events: auto; cursor: pointer; }
.armbar::before { content: ""; position: absolute; inset: -14px -4px; }
.armfist { position: absolute; top: calc(var(--th) / -2 - var(--bw)); width: calc(var(--th) * 2); height: calc(var(--th) * 2);
  background: #fff; border: var(--bw) solid var(--ink); border-radius: var(--bw); box-sizing: content-box;
  pointer-events: auto; cursor: pointer; translate: -50% 0; }
.armfist.hit { animation: hit .3s steps(2); }

/* floating text: "chomp!", "POW", music notes; stars spin over knocked-down Barry */
.float { position: absolute; left: 50%; top: -6px; font-weight: 800; font-size: 18px; color: var(--ink);
  pointer-events: none; white-space: nowrap; transform: translateX(-50%);
  text-shadow: -1px -1px 0 #fff, 1px -1px 0 #fff, -1px 1px 0 #fff, 1px 1px 0 #fff;
  animation: floatUp .8s ease-out forwards; }
.face .float { font-size: 30px; }
@keyframes floatUp { to { translate: 0 -40px; opacity: 0; } }
.stars { position: absolute; left: 50%; top: -26px; margin-left: -14px; font-size: 30px; line-height: 1; color: #f6d04d;
  text-shadow: 0 0 2px var(--ink), 0 0 2px var(--ink); animation: spin 1s linear infinite; pointer-events: none; }
@keyframes spin { to { rotate: 360deg; } }

/* explosion: backdrop eats clicks while the tab is closing; pixel particles drawn in code */
.explosion { position: fixed; inset: 0; pointer-events: auto; }
.particle { position: absolute; pointer-events: none; }
.flash { position: fixed; left: 50%; top: 40%; transform: translate(-50%, -50%);
  font-size: 72px; font-weight: 900; color: #ff5722; -webkit-text-stroke: 3px var(--ink);
  animation: flash 700ms ease-out forwards; pointer-events: none; }
@keyframes flash { from { opacity: 1; transform: translate(-50%, -50%) scale(0.6); }
  to { opacity: 0; transform: translate(-50%, -90%) scale(1.4); } }
.burstflash { position: fixed; inset: 0; background: radial-gradient(circle, rgba(255,255,255,.85), rgba(255,235,59,.35) 45%, transparent 70%);
  animation: burstflash 450ms ease-out forwards; pointer-events: none; }
@keyframes burstflash { from { opacity: 1; } to { opacity: 0; } }

@media (prefers-reduced-motion: reduce) {
  .breathe, .pop, .chomp, .hit, .squash, .unsquash, .slowjump, .bounce, .float, .stars,
  .bubble.popin, .suggest.popin, .armfist.hit { animation: none !important; }
  .float { opacity: 1; }
  .barry.dancing { transition: none; }
  .burstflash { display: none; }
  .flash { animation: none; opacity: 1; }
}
`;
