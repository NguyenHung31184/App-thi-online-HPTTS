import { describe, expect, it } from 'vitest';
import {
  AI_DETECTION_RULES,
  CAMERA_COVERED_RULE,
  LEAVE_EVENT_BUNDLE_MS,
  advanceDetectionWindow,
  canRecordLeaveViolation,
  createDetectionStates,
  createDetectionWindowState,
  frameLooksCovered,
  lockedDetectionKinds,
  shouldAutoSubmitForAi,
} from './proctoring-policy';

describe('proctoring policy', () => {
  it('counts blur, hidden and fullscreen signals from one action only once', () => {
    const first = 10_000;
    expect(canRecordLeaveViolation(0, first)).toBe(true);
    expect(canRecordLeaveViolation(first, first + 700)).toBe(false);
    expect(canRecordLeaveViolation(first, first + LEAVE_EVENT_BUNDLE_MS - 1)).toBe(false);
    expect(canRecordLeaveViolation(first, first + LEAVE_EVENT_BUNDLE_MS)).toBe(true);
  });

  it('confirms no-face after five scans and waits for five clean scans before rearming', () => {
    const rule = AI_DETECTION_RULES.ai_no_face;
    let state = createDetectionWindowState();
    for (let scan = 1; scan <= 4; scan += 1) {
      const result = advanceDetectionWindow(state, true, rule);
      expect(result.confirmed).toBe(false);
      state = result.state;
    }
    const confirmed = advanceDetectionWindow(state, true, rule);
    expect(confirmed.confirmed).toBe(true);
    state = confirmed.state;

    expect(advanceDetectionWindow(state, true, rule).confirmed).toBe(false);
    for (let scan = 1; scan <= 4; scan += 1) {
      state = advanceDetectionWindow(state, false, rule).state;
    }
    expect(state.armed).toBe(false);
    expect(advanceDetectionWindow(state, false, rule).state.armed).toBe(true);
  });

  it('counts a second person who stays, and is missed for a few scans, as one incident', () => {
    const rule = AI_DETECTION_RULES.ai_multiple_face;
    let state = createDetectionWindowState();
    let incidents = 0;
    const scan = (detected: boolean) => {
      const result = advanceDetectionWindow(state, detected, rule);
      state = result.state;
      if (result.confirmed) incidents += 1;
    };
    for (let i = 0; i < 10; i += 1) scan(true);
    for (let i = 0; i < 4; i += 1) scan(false);
    for (let i = 0; i < 10; i += 1) scan(true);
    expect(incidents).toBe(1);

    for (let i = 0; i < 5; i += 1) scan(false);
    for (let i = 0; i < 3; i += 1) scan(true);
    expect(incidents).toBe(2);
  });

  it('records a second person who stays again every 30 seconds, and not a missing face', () => {
    const count = (kind: 'ai_multiple_face' | 'ai_no_face', seconds: number) => {
      let state = createDetectionWindowState();
      let incidents = 0;
      let repeats = 0;
      for (let second = 1; second <= seconds; second += 1) {
        const result = advanceDetectionWindow(state, true, AI_DETECTION_RULES[kind], second * 1_000);
        state = result.state;
        if (result.confirmed) incidents += 1;
        if (result.repeated) repeats += 1;
      }
      return { incidents, repeats };
    };
    // First record at second 3, then at 33 and 63.
    expect(count('ai_multiple_face', 32)).toEqual({ incidents: 1, repeats: 0 });
    expect(count('ai_multiple_face', 63)).toEqual({ incidents: 3, repeats: 2 });
    expect(count('ai_no_face', 120)).toEqual({ incidents: 1, repeats: 0 });
  });

  it('counts 30 seconds from the reload when a locked kind was restored', () => {
    const rule = AI_DETECTION_RULES.ai_multiple_face;
    let state = createDetectionStates(['ai_multiple_face']).ai_multiple_face;
    const at = (ms: number) => {
      const result = advanceDetectionWindow(state, true, rule, ms);
      state = result.state;
      return result.confirmed;
    };
    expect(at(500_000)).toBe(false);
    expect(at(529_000)).toBe(false);
    expect(at(530_000)).toBe(true);
  });

  it('restores the locked kinds of a reloaded page and reports them back', () => {
    const states = createDetectionStates(['ai_multiple_face']);
    expect(states.ai_multiple_face.armed).toBe(false);
    expect(states.ai_no_face.armed).toBe(true);
    expect(lockedDetectionKinds(states)).toEqual(['ai_multiple_face']);
    expect(lockedDetectionKinds(createDetectionStates())).toEqual([]);
  });

  it('still confirms no-face when a face shows up in one of five scans, but not in two', () => {
    const rule = AI_DETECTION_RULES.ai_no_face;
    const run = (scans: boolean[]) => {
      let state = createDetectionWindowState();
      let confirmed = false;
      for (const detected of scans) {
        const result = advanceDetectionWindow(state, detected, rule);
        state = result.state;
        confirmed = confirmed || result.confirmed;
      }
      return confirmed;
    };
    expect(run([true, true, false, true, true])).toBe(true);
    expect(run([true, false, true, false, true])).toBe(false);
  });

  it('confirms a covered camera after three scans in a row', () => {
    let state = createDetectionWindowState();
    for (const detected of [true, true]) {
      const result = advanceDetectionWindow(state, detected, CAMERA_COVERED_RULE);
      expect(result.confirmed).toBe(false);
      state = result.state;
    }
    expect(advanceDetectionWindow(state, true, CAMERA_COVERED_RULE).confirmed).toBe(true);
  });

  it('reads a black or flat frame as covered and a normal frame as open', () => {
    const frame = (pixel: (i: number) => number) => {
      const data: number[] = [];
      for (let i = 0; i < 64; i += 1) data.push(pixel(i), pixel(i), pixel(i), 255);
      return data;
    };
    expect(frameLooksCovered(frame(() => 8))).toBe(true);
    expect(frameLooksCovered(frame(() => 120))).toBe(true);
    expect(frameLooksCovered(frame((i) => (i % 2 ? 60 : 180)))).toBe(false);
    expect(frameLooksCovered([])).toBe(false);
  });

  it('confirms a phone only when at least three of five scans are positive', () => {
    const rule = AI_DETECTION_RULES.ai_cell_phone;
    let state = createDetectionWindowState();
    for (const detected of [true, false, true, false]) {
      state = advanceDetectionWindow(state, detected, rule).state;
    }
    expect(advanceDetectionWindow(state, false, rule).confirmed).toBe(false);

    state = createDetectionWindowState();
    let confirmed = false;
    for (const detected of [true, false, true, false, true]) {
      const result = advanceDetectionWindow(state, detected, rule);
      state = result.state;
      confirmed = result.confirmed;
    }
    expect(confirmed).toBe(true);
  });

  it('auto-submits AI risk only in strict mode after two incidents', () => {
    expect(shouldAutoSubmitForAi('strict', 6, 2)).toBe(true);
    expect(shouldAutoSubmitForAi('strict', 6, 1)).toBe(false);
    expect(shouldAutoSubmitForAi('standard', 9, 3)).toBe(false);
    expect(shouldAutoSubmitForAi('supervised', 9, 3)).toBe(false);
  });
});
