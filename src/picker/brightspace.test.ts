import { describe, expect, it } from 'vitest';
import { findItems, textRuns, w2dCandidates, type TNode } from './brightspace';

const text = (t: string): TNode => ({ nodeType: 3, textContent: t, childNodes: [] });
function el(
  tag: string,
  kids: TNode[] = [],
  opts: { shadow?: TNode[]; attrs?: Record<string, string>; cls?: string[] } = {},
): TNode {
  const attrs = opts.attrs ?? {};
  return {
    nodeType: 1,
    tagName: tag.toUpperCase(),
    textContent: null,
    childNodes: kids,
    shadowRoot: opts.shadow ? { childNodes: opts.shadow } : null,
    getAttribute: (n) => attrs[n] ?? null,
    hasAttribute: (n) => n in attrs,
    classList: { contains: (c) => (opts.cls ?? []).includes(c) },
  };
}

describe('brightspace work to do', () => {
  // widget -> shadow -> list -> shadow -> items (each item's title inside its own shadow)
  const item = (title: string, extra: string) =>
    el('d2l-w2d-list-item', [], {
      shadow: [
        el('d2l-icon'),
        el('span', [text('Assignment:')], { cls: ['d2l-offscreen'] }),
        el('div', [text(`  ${title} `)]),
        el('div', [text(extra)]),
      ],
    });
  const widget = el('d2l-w2d-work-to-do', [], {
    shadow: [
      el('h3', [text('Overdue')]),
      el('d2l-w2d-list', [], {
        shadow: [item('Lab 4', 'Due Nov 20'), item('Essay', 'Due Nov 25')],
      }),
      el('div', [text('hidden')], { attrs: { hidden: '' } }),
    ],
  });

  it('finds items across shadow roots and takes their titles', () => {
    expect(findItems(widget)).toHaveLength(2);
    expect(w2dCandidates(widget).map((c) => c.text)).toEqual([
      'Lab 4 · Due Nov 20',
      'Essay · Due Nov 25',
    ]);
  });
  it('prefers a label attribute', () => {
    const w = el('x', [
      el('d2l-list-item', [], { attrs: { label: 'Quiz 2' }, shadow: [text('ignored')] }),
    ]);
    expect(w2dCandidates(w).map((c) => c.text)).toEqual(['Quiz 2']);
  });
  it('skips hidden and offscreen text', () => {
    expect(textRuns(widget)).not.toContain('hidden');
    expect(textRuns(widget)).not.toContain('Assignment:');
  });

  describe('typed items with slotted titles', () => {
    const typed = (tag: string, title: string, withSlot: boolean) => {
      const content = el('d2l-list-item-content', [
        el('div', [text(title)]),
        el('div', [text('Due Oct 4, 2026 11:59 PM')], { attrs: { slot: 'secondary' } }),
        el('div', [text('COMPSCI 3319A 200 LEC')], { attrs: { slot: 'supporting-info' } }),
      ]);
      return el(tag, [], {
        shadow: [
          text('Due Oct 4'),
          el('d2l-list-item-generic-layout', [], { shadow: [] }),
          content,
        ],
      });
    };
    it('matches d2l-w2d-list-item-* and reads the default-slot title', () => {
      const w = el('d2l-w2d-work-to-do', [], {
        shadow: [
          typed('d2l-w2d-list-item-content', 'Lab 4', true),
          typed('d2l-w2d-list-item-assignment', 'Essay', true),
        ],
      });
      expect(w2dCandidates(w).map((c) => c.text)).toEqual([
        'Lab 4 · COMPSCI 3319A 200 LEC · Due Oct 4',
        'Essay · COMPSCI 3319A 200 LEC · Due Oct 4',
      ]);
    });
    it('falls back to the first non-date, non-course run', () => {
      const w = el('x', [
        el('d2l-w2d-list-item-quiz', [], {
          shadow: [text('Due Oct 4'), text('COMPSCI 3319A 200 LEC'), text('Quiz 1')],
        }),
      ]);
      expect(w2dCandidates(w).map((c) => c.text)).toEqual([
        'Quiz 1 · COMPSCI 3319A 200 LEC · Due Oct 4',
      ]);
    });
  });
});

import { withSubtitles } from './brightspace';
describe('withSubtitles', () => {
  it('adds the short course and due date', () => {
    expect(
      withSubtitles('Assignment 1', [
        'Due Oct 4',
        'Due Oct 4, 2026 11:59 PM',
        'Assignment 1',
        'COMPSCI 3319A 200 LEC FW26: DATABASES I',
      ]),
    ).toBe('Assignment 1 · COMPSCI 3319A: DATABASES I · Due Oct 4');
  });
  it('keeps an unusual course name whole and works without a due date', () => {
    expect(withSubtitles('Reading', ['Reading', 'DATASCI 3000B'])).toBe('Reading · DATASCI 3000B');
    expect(withSubtitles('Quiz', ['Quiz'])).toBe('Quiz');
  });
});
