// Pure key filter for the input eater: which keydowns Barry eats.
// Everything is eaten except modifier-only presses, function keys (F5, F12, ...) and
// Ctrl/Cmd/Alt combos, so the user can always reload, devtools, or close the tab.

export interface KeyLike {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
}

const MODIFIER_KEYS = new Set([
  'Control',
  'Shift',
  'Alt',
  'Meta',
  'AltGraph',
  'CapsLock',
  'NumLock',
  'ScrollLock',
  'OS',
  'Fn',
  'Dead',
  'Process',
  'Unidentified',
]);

export function shouldEatKey(e: KeyLike): boolean {
  if (MODIFIER_KEYS.has(e.key)) return false;
  if (/^F\d{1,2}$/.test(e.key)) return false;
  if (e.ctrlKey || e.metaKey || e.altKey) return false;
  return true;
}
