import { describe, expect, it } from 'vitest';
import { validateProgressInput } from './assigned-learning';

const context = { enrollmentId: 'e', assignmentId: 'a', blockId: 'b' };
describe('progress request validation', () => {
  it('accepts resume-only and read confirmation', () => {
    expect(() => validateProgressInput({ ...context, resumeSeconds: 99 })).not.toThrow();
    expect(() => validateProgressInput({ ...context, confirmRead: true })).not.toThrow();
  });
  it('rejects a partial interval, reverse playback and invalid numeric positions', () => {
    for (const input of [{ fromSeconds: 0 }, { fromSeconds: 20, toSeconds: 10 },
      { resumeSeconds: NaN }, { resumeSeconds: -1 }, { resumeSeconds: 1.5 }]) {
      expect(() => validateProgressInput({ ...context, ...input })).toThrow();
    }
  });
});
