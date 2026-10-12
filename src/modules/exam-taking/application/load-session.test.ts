import { describe, expect, it, vi } from 'vitest';
import type { Attempt, Exam } from '../../../types';
import { loadTheorySession } from './load-session';

// The session reader is injected in every test; the real one pulls in the Supabase client, which needs env on import.
vi.mock('../../../platform/supabase/client', () => ({ supabase: {}, isSupabaseConfigured: () => false }));

const attempt: Attempt = { id: 'attempt', user_id: 'owner', exam_id: 'exam', window_id: 'window', status: 'in_progress', started_at: 1000, answers: { q: 'A' } };
const exam = { id: 'exam', duration_minutes: 10 } as Exam;
const source = () => ({
  getAttempt: vi.fn(async () => attempt), getExam: vi.fn(async () => exam),
  getQuestions: vi.fn(async () => []), getWindowContext: vi.fn(async () => ({ end_at: 2000, is_trial: false, class_id: 'class' })),
});

describe('load owned theory session', () => {
  it('checks the owner before loading an exam or paper', async () => {
    const data = source();
    await expect(loadTheorySession('attempt', 'stranger', data)).rejects.toThrow('quyền');
    expect(data.getExam).not.toHaveBeenCalled();
    expect(data.getQuestions).not.toHaveBeenCalled();
  });

  it('redirects completed attempts without fetching paper or window', async () => {
    const data = source();
    data.getAttempt.mockResolvedValue({ ...attempt, status: 'completed' });
    expect((await loadTheorySession('attempt', 'owner', data)).kind).toBe('completed');
    expect(data.getQuestions).not.toHaveBeenCalled();
    expect(data.getWindowContext).not.toHaveBeenCalled();
  });

  it('keeps saved answers and the server deadline and loads independent reads together', async () => {
    const data = source();
    let finishQuestions!: (questions: []) => void;
    data.getQuestions.mockImplementation(() => new Promise((resolve) => { finishQuestions = resolve; }));
    const loading = loadTheorySession('attempt', 'owner', data);
    await vi.waitFor(() => expect(data.getWindowContext).toHaveBeenCalledWith('attempt'));
    finishQuestions([]);
    const result = await loading;
    expect(result).toMatchObject({ kind: 'ready', answers: { q: 'A' }, deadline: 2000 });
  });

  it('propagates loading failures instead of opening an empty exam', async () => {
    const data = source();
    data.getQuestions.mockRejectedValue(new Error('network failed'));
    await expect(loadTheorySession('attempt', 'owner', data)).rejects.toThrow('network failed');
  });
});
