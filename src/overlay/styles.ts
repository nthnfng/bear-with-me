export const CSS = `
:host { all: initial; }
.root { position: fixed; inset: 0; z-index: 2147483647; pointer-events: none;
  font-family: system-ui, sans-serif; }
.root[hidden] { display: none; }
.barry { position: fixed; display: flex; flex-direction: column; align-items: center;
  pointer-events: none; }
.barry.corner { bottom: 0; }
.barry.corner.left { left: 8px; }
.barry.corner.right { right: 8px; }
.barry.corner.middle { left: 50%; transform: translateX(-50%); }
.barry.face { left: 50%; top: 50%; transform: translate(-50%, -50%); }
.sprite { background-repeat: no-repeat; image-rendering: auto; transform-origin: center bottom; }
.face .sprite { transform-origin: center center; }
@keyframes frames { from { background-position: 0 0; } to { background-position: 100% 0; } }
.bubble { max-width: 320px; background: #fff; color: #222; border: 3px solid #222;
  border-radius: 14px; padding: 8px 12px; font-size: 15px; font-weight: 600; line-height: 1.25;
  text-align: center; margin-bottom: 6px; }
.bubble[hidden], .btn[hidden], .suggest[hidden] { display: none; }
.face .bubble { font-size: 22px; max-width: 460px; }
.btn { pointer-events: auto; cursor: pointer; margin-top: 10px; font: inherit; font-size: 20px;
  font-weight: 700; padding: 10px 22px; border-radius: 999px; border: 3px solid #222;
  background: #ffeb3b; color: #222; }
.btn:hover { background: #fff176; }
/* Reach arm: positioned at the hand, rotated toward the top-right; tiled body + fist. */
.arm { position: fixed; width: 0; height: 0; transform-origin: 0 0; pointer-events: none; }
.arm[hidden] { display: none; }
.armbody { position: absolute; left: 0; background-repeat: repeat-x; background-size: auto 100%;
  pointer-events: auto; cursor: pointer; }
.fist { position: absolute; background-size: 100% 100%; background-repeat: no-repeat;
  pointer-events: auto; cursor: pointer; }
.fighting .sprite { pointer-events: auto; cursor: pointer; }
.sprite.beaten { animation: wobble 500ms ease-in-out infinite; transform-origin: center bottom; }
@keyframes wobble { 0%, 100% { rotate: -4deg; } 50% { rotate: 4deg; } }
.hud { display: flex; flex-direction: column; align-items: center; gap: 4px; margin-bottom: 4px; }
.pill { background: #222; color: #fff; border-radius: 999px; padding: 3px 10px; font-size: 13px;
  font-weight: 700; font-variant-numeric: tabular-nums; }
.pushes { background: #d32f2f; }
.pill[hidden], .meter[hidden] { display: none; }
.meter { width: 90px; height: 10px; border: 2px solid #222; border-radius: 6px; background: #fff;
  overflow: hidden; }
.meterfill { height: 100%; background: #8d6e63; transition: width 400ms ease; }
.meter.full { border-color: #b71c1c; }
.meter.full .meterfill { background: #d32f2f; }
.suggest { position: relative; max-width: 300px; background: #fff8e1; color: #222; border: 3px solid #222;
  border-radius: 14px; padding: 8px 28px 8px 12px; font-size: 14px; font-weight: 600;
  line-height: 1.25; text-align: left; margin-bottom: 6px; pointer-events: auto; }
.suggest .x { position: absolute; top: 2px; right: 4px; border: 0; background: transparent;
  font: inherit; font-size: 18px; line-height: 1; cursor: pointer; color: #555; padding: 2px 4px; }
.flash { position: fixed; left: 50%; top: 40%; transform: translate(-50%, -50%);
  font-size: 72px; font-weight: 900; color: #ff5722; -webkit-text-stroke: 3px #222;
  animation: flash 700ms ease-out forwards; pointer-events: none; }
@keyframes flash { from { opacity: 1; transform: translate(-50%, -50%) scale(0.6); }
  to { opacity: 0; transform: translate(-50%, -90%) scale(1.4); } }
.explosion { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center;
  background: rgba(255, 255, 255, 0.0); pointer-events: auto; }
.explosion img { width: min(90vw, 90vh); height: min(90vw, 90vh); animation: boom var(--ms) ease-out forwards; }
@keyframes boom { 0% { transform: scale(0.1) rotate(-10deg); opacity: 1; }
  60% { transform: scale(1.2) rotate(5deg); opacity: 1; }
  100% { transform: scale(1.6) rotate(0); opacity: 0; } }
`;
