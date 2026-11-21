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
    expect(w2dCandidates(widget).map((c) => c.text)).toEqual(['Lab 4', 'Essay']);
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
});
