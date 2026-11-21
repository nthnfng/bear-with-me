import { describe, expect, it } from 'vitest';
import { contentMessageToEvent, isPopupMessage, popupMessageToEvent } from './messageToEvent';

describe('messageToEvent', () => {
  it('stamps tab id and now on content messages', () => {
    expect(contentMessageToEvent({ type: 'eaten', kind: 'click' }, 7, 100)).toEqual({
      type: 'eaten',
      now: 100,
      tabId: 7,
      kind: 'click',
    });
    expect(contentMessageToEvent({ type: 'hello' }, 7, 100)).toBeNull();
  });

  it('maps popup dev and override messages', () => {
    expect(popupMessageToEvent({ type: 'setModeOverride', override: 'lockIn' }, 5)).toEqual({
      type: 'modeOverrideSet',
      now: 5,
      override: 'lockIn',
    });
    expect(popupMessageToEvent({ type: 'refreshSchedule' }, 5)).toBeNull();
    expect(isPopupMessage({ type: 'dev' })).toBe(true);
    expect(isPopupMessage({ type: 'hello' })).toBe(false);
  });
});
