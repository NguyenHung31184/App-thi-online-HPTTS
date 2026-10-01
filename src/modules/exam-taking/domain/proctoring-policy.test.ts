import { describe, expect, it } from 'vitest';
import {
  AI_DETECTION_RULES,
  LEAVE_EVENT_BUNDLE_MS,
  advanceDetectionWindow,
  canRecordLeaveViolation,
  createDetectionWindowState,
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

  it('confirms no-face after six scans and waits for three clean scans before rearming', () => {
    const rule = AI_DETECTION_RULES.ai_no_face;
    let state = createDetectionWindowState();
    for (let scan = 1; scan <= 5; scan += 1) {
      const result = advanceDetectionWindow(state, true, rule);
      expect(result.confirmed).toBe(false);
      state = result.state;
    }
    const confirmed = advanceDetectionWindow(state, true, rule);
    expect(confirmed.confirmed).toBe(true);
    state = confirmed.state;

    expect(advanceDetectionWindow(state, true, rule).confirmed).toBe(false);
    for (let scan = 1; scan <= 3; scan += 1) {
      state = advanceDetectionWindow(state, false, rule).state;
    }
    expect(state.armed).toBe(true);
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
