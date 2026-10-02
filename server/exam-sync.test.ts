import type { SupabaseClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { afterEach, describe, expect, it, vi } from 'vitest';
import maintenance from '../api/exam-maintenance';
import { deliverGrade, processSyncJob, type SyncJob } from './exam-sync';

const config = { url: 'https://ttdt.example/grades', apiKey: 'test-key' };
const job: SyncJob = { id: 'job', source: 'theory', attempt_id: 'attempt', lease_token: 'lease' };

function fakeDatabase(overrides: Record<string, unknown> = {}) {
  const log = vi.fn(async () => ({ error: null }));
  const update = vi.fn(() => ({ eq: async () => ({ error: null }) }));
  const rpc = vi.fn(async () => ({ data: true, error: null }));
  const rows: Record<string, unknown> = {
    attempts: { id:'attempt',user_id:'student',status:'completed',score:0.8,raw_score:8,completed_at:1000,exam_id:'exam',window_id:'window' },
    profiles: { student_id:'student-code' },
    exams: { module_id:'module',title:'Exam',pass_threshold:0.7 },
    exam_windows: { class_id:'class',is_trial:false },
    practical_attempts: { id:'field',user_id:null,student_id:'ttdt-student',status:'graded',total_score:82,is_disqualified:false,session_id:'session',graded_at:'2026-10-09T03:00:00Z' },
    practical_exam_sessions: { class_id:'class',template_id:'template' },
    practical_exam_templates: { module_id:'module',pass_score:70 },
    ...overrides,
  };
  const admin = {
    from: (table: string) => {
      const query = {
        select: () => query, eq: () => query,
        single: async () => ({ data: rows[table],error:null }),
        maybeSingle: async () => ({ data: rows[table],error:null }),
        insert: log, update,
      };
      return query;
    }, rpc,
  } as unknown as SupabaseClient;
  return { admin,log,update,rpc };
}

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe('TTDT delivery', () => {
  it('requires application acknowledgment, not just HTTP 200', async () => {
    const send = vi.fn<typeof fetch>().mockResolvedValue(new Response('{"success":false}',{status:200}));
    await expect(deliverGrade(config,{},send)).rejects.toThrow('TTDT HTTP 200');
  });
  it('rejects an HTML error page even if a proxy returns HTTP 200', async () => {
    const send = vi.fn<typeof fetch>().mockResolvedValue(new Response('<html>Error</html>'));
    await expect(deliverGrade(config,{},send)).rejects.toThrow('dữ liệu không hợp lệ');
  });
  it('logs a timeout and releases the job for retry instead of losing it', async () => {
    const { admin,log,update,rpc } = fakeDatabase();
    vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new Error('timeout')));
    expect(await processSyncJob(admin,job,config)).toEqual({ success:false,message:'timeout' });
    expect(log).toHaveBeenCalledWith(expect.objectContaining({ status:'failed',response:'timeout',attempt_id:'attempt' }));
    expect(update).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledWith('finish_exam_sync_job',expect.objectContaining({p_success:false,p_error:'timeout',p_lease_token:'lease'}));
  });
  it('records success only after TTDT acknowledges the server-built score', async () => {
    const { admin,log,rpc } = fakeDatabase();
    const send = vi.fn().mockResolvedValue(new Response('{"success":true}'));
    vi.stubGlobal('fetch',send);
    expect((await processSyncJob(admin,job,config)).success).toBe(true);
    expect(JSON.parse(send.mock.calls[0][1].body)).toMatchObject({final_exam_score:8,student_id:'student-code'});
    expect(log).toHaveBeenCalledWith(expect.objectContaining({status:'success'}));
    expect(rpc).toHaveBeenCalledWith('finish_exam_sync_job',expect.objectContaining({p_success:true}));
  });
  it('sends a field-graded practical total on 10 under the TTDT student id', async () => {
    const { admin } = fakeDatabase();
    const send = vi.fn().mockResolvedValue(new Response('{"success":true}'));
    vi.stubGlobal('fetch',send);
    expect((await processSyncJob(admin,{ ...job,source:'practical',attempt_id:'field' },config)).success).toBe(true);
    expect(JSON.parse(send.mock.calls[0][1].body)).toMatchObject({ source:'practical',student_id:'ttdt-student',final_exam_score:8.2,passed:true,disqualified:false });
  });
  it('sends 0 and not passed for a disqualified practical attempt', async () => {
    const { admin } = fakeDatabase({ practical_attempts: { id:'field',user_id:null,student_id:'s',status:'graded',total_score:75,is_disqualified:true,session_id:'session' } });
    const send = vi.fn().mockResolvedValue(new Response('{"success":true}'));
    vi.stubGlobal('fetch',send);
    await processSyncJob(admin,{ ...job,source:'practical',attempt_id:'field' },config);
    expect(JSON.parse(send.mock.calls[0][1].body)).toMatchObject({ final_exam_score:0,passed:false,disqualified:true });
  });
  it('reports an expired lease instead of declaring delivery complete', async () => {
    const { admin,rpc } = fakeDatabase();
    rpc.mockResolvedValue({data:false,error:null});
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('{"success":true}')));
    await expect(processSyncJob(admin,job,config)).rejects.toThrow('hết hiệu lực');
  });
});

describe('maintenance authentication', () => {
  it.each([undefined, 'wrong'])('rejects absent or invalid cron credentials (%s)', async (header) => {
    vi.stubEnv('CRON_SECRET','expected-secret');
    const response = { setHeader:vi.fn(),status:vi.fn(),end:vi.fn() };
    response.status.mockReturnValue(response);
    await maintenance({method:'GET',headers:{authorization:header}} as VercelRequest,response as unknown as VercelResponse);
    expect(response.status).toHaveBeenCalledWith(401);
  });
});
