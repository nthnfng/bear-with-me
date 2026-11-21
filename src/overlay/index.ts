// Workstream D: page overlay. Draws the TabView it's given and reports user input.
// No behaviour here: see docs/adr/0001-pure-brain-dumb-renderers.md.

import type { TabView } from '../contracts';

export interface Overlay {
  render(view: TabView): void;
}

export function mountOverlay(): Overlay {
  // TODO(WS-D): shadow-root host, sprites, input eater, media pause, Reach arm, effects.
  return {
    render(view) {
      console.log('[barry] view', view);
    },
  };
}
