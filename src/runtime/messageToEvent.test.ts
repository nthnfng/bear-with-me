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

  it('maps Stop Slacking and slack length changes from the popup', () => {
    expect(popupMessageToEvent({ type: 'stopSlackPass' }, 9)).toEqual({
      type: 'slackPassStopped',
      now: 9,
    });
    expect(popupMessageToEvent({ type: 'changeSlackPass', durationMs: 600_000 }, 9)).toEqual({
      type: 'slackPassChanged',
      now: 9,
      durationMs: 600_000,
    });
    expect(isPopupMessage({ type: 'stopSlackPass' })).toBe(true);
    expect(isPopupMessage({ type: 'changeSlackPass' })).toBe(true);
  });

  it('maps gotUp from a page and from the popup to the same event', () => {
    expect(contentMessageToEvent({ type: 'gotUp' }, 7, 100)).toEqual({ type: 'gotUp', now: 100 });
    expect(popupMessageToEvent({ type: 'gotUp' }, 100)).toEqual({ type: 'gotUp', now: 100 });
    // Pages send it too; the runtime's popup branch handles it, so it must be recognised there.
    expect(isPopupMessage({ type: 'gotUp' })).toBe(true);
  });
});
