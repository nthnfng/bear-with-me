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
.bubble[hidden], .btn[hidden] { display: none; }
.face .bubble { font-size: 22px; max-width: 460px; }
.btn { pointer-events: auto; cursor: pointer; margin-top: 10px; font: inherit; font-size: 20px;
  font-weight: 700; padding: 10px 22px; border-radius: 999px; border: 3px solid #222;
  background: #ffeb3b; color: #222; }
.btn:hover { background: #fff176; }
/* TODO(Phase 2): .arm (segment tiled + fist), .pushes, chud meter, countdown. */
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
