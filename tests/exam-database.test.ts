import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

const student = '00000000-0000-0000-0000-000000000001';
const other = '00000000-0000-0000-0000-000000000002';
const teacher = '00000000-0000-0000-0000-000000000003';
const exam = '10000000-0000-0000-0000-000000000001';
const windowId = '20000000-0000-0000-0000-000000000001';
const question = '30000000-0000-0000-0000-000000000001';
const sessionId = '40000000-0000-0000-0000-000000000001';
const classId = '50000000-0000-0000-0000-000000000001';
const moduleId = '60000000-0000-0000-0000-000000000001';
let db: PGlite;

async function sql<T = Record<string, unknown>>(query: string, params: unknown[] = []) {
  return (await db.query<T>(query, params)).rows;
}
async function login(id: string, role = 'authenticated') {
  await db.exec('RESET ROLE');
  await sql("SELECT set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.role',$2,false)", [id, role]);
  await db.exec(`SET ROLE ${role}`);
}
async function attempt(expired = false, trial = false) {
  await db.exec('RESET ROLE');
  if (trial) await sql('UPDATE exam_windows SET is_trial = true WHERE id=$1', [windowId]);
  const [row] = await sql<{ id: string }>(`INSERT INTO attempts(user_id,exam_id,window_id,started_at,question_ids,answers)
    VALUES($1,$2,$3,(extract(epoch from clock_timestamp())*1000)::bigint - $4,ARRAY[$5::uuid],$6::jsonb) RETURNING id`,
  [student, exam, windowId, expired ? 120000 : 0, question, JSON.stringify({ [question]: 'A' })]);
  await login(student);
  return row.id;
}
async function finalize(id: string, answer = 'A', disqualify = false) {
  const [row] = await sql<{ result: { ok: boolean; score: number; total_max: number } }>(
    'SELECT finalize_exam_attempt($1,$2::jsonb,$3) result', [id, JSON.stringify({ [question]: answer }), disqualify]);
  return row.result;
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth; GRANT USAGE ON SCHEMA auth TO anon,authenticated,service_role;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT current_setting('request.jwt.claim.role',true) $$;
    CREATE TABLE profiles(id uuid PRIMARY KEY,student_id uuid,role text,exam_role text);
    CREATE TABLE enrollments(student_id uuid,class_id uuid,is_deleted boolean DEFAULT false);
    CREATE FUNCTION get_my_role() RETURNS text LANGUAGE sql SECURITY DEFINER AS $$ SELECT role FROM profiles WHERE id=auth.uid() $$;
    CREATE FUNCTION get_my_exam_role() RETURNS text LANGUAGE sql SECURITY DEFINER AS $$ SELECT exam_role FROM profiles WHERE id=auth.uid() $$;
    CREATE FUNCTION get_my_student_id() RETURNS uuid LANGUAGE sql SECURITY DEFINER AS $$ SELECT student_id FROM profiles WHERE id=auth.uid() $$;`);
  const migration = (name: string) => readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8');
  await db.exec((await migration('001_mvp_tables.sql')).split('-- Policy tạm:')[0]);
  await db.exec((await migration('008_occupations_and_question_bank.sql')).split('-- Seed')[0]);
  await db.exec(await migration('007_practical_exam_tables.sql'));
  await db.exec(`ALTER TABLE attempts ADD question_ids uuid[], ADD total_max numeric;
    ALTER TABLE question_bank ADD is_deleted boolean DEFAULT false;
    ALTER TABLE exam_windows ADD is_trial boolean DEFAULT false;
    ALTER TABLE practical_exam_templates ADD module_id uuid;
    CREATE TABLE attempt_question_scores(attempt_id uuid,question_id uuid,score numeric,max_points numeric,PRIMARY KEY(attempt_id,question_id));
    GRANT USAGE ON SCHEMA public TO anon,authenticated,service_role;
    GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated,service_role;
    CREATE POLICY attempts_own ON attempts FOR SELECT TO authenticated USING(user_id=auth.uid());`);
  for (const file of ['20260929090000_atomic_exam_submission.sql','20260929091000_secure_practical_submission.sql','20260929092000_exam_sync_outbox.sql']) await db.exec(await migration(file));
  // Columns and tables start_exam_attempt reads in production (class ids are text there).
  await db.exec(`ALTER TABLE exam_windows ALTER class_id TYPE text, ADD exam_ids uuid[], ADD max_attempts int;
    ALTER TABLE exams ADD locked_at timestamptz, ADD is_deleted boolean DEFAULT false;
    ALTER TABLE question_bank ADD module_id uuid, ADD status text DEFAULT 'published';
    CREATE TABLE exam_access_failures(user_id uuid,window_id uuid,failure_count int,last_failed_at timestamptz,PRIMARY KEY(user_id,window_id));`);
  await db.exec(await migration('20260930160000_resume_in_progress_attempt.sql'));
  await db.exec(await migration('20260930160140_ai_proctoring_policy.sql'));
  await db.exec(await migration('20261003090000_practical_field_grading_sync.sql'));
  await sql('INSERT INTO profiles VALUES($1,$1,\'student\',NULL),($2,$2,\'student\',NULL),($3,NULL,\'teacher\',\'teacher\')',[student,other,teacher]);
  await sql('INSERT INTO enrollments(student_id,class_id) VALUES($1,$2)',[student,classId]);
  await sql("INSERT INTO exams(id,title,duration_minutes,module_id) VALUES($1,'Exam',1,$2)",[exam,moduleId]);
  await sql("INSERT INTO exam_windows(id,exam_id,class_id,start_at,end_at,access_code) VALUES($1,$2,$3,0,9999999999999,'123')",[windowId,exam,classId]);
  await sql("INSERT INTO occupations(id,name) VALUES($1,'Course')",[moduleId]);
  await sql("INSERT INTO question_bank(id,occupation_id,stem,answer_key) VALUES($1,$2,'Original','A')",[question,moduleId]);
  await sql("INSERT INTO practical_exam_templates(id,title,module_id) VALUES($1,'Practical',$2)",[exam,moduleId]);
  await sql("INSERT INTO practical_exam_sessions(id,template_id,class_id,start_at,end_at,access_code) VALUES($1,$2,$3,0,9999999999999,'123')",[sessionId,exam,classId]);
}, 30000);
beforeEach(async () => { await db.exec('RESET ROLE; BEGIN'); });
afterEach(async () => { await db.exec('ROLLBACK; RESET ROLE'); });
afterAll(async () => { await db.close(); });

describe('theory submission and immutable papers', () => {
  it('saves and grades an early submission atomically', async () => {
    const id = await attempt();
    expect(await finalize(id,'B')).toMatchObject({ ok:true,score:0 });
  });
  it('grades saved answers after expiry and rejects late replacement answers', async () => {
    const id = await attempt(true);
    expect(await finalize(id,'B')).toMatchObject({ ok:true,score:1 });
  });
  it('returns the same result after a lost response / duplicate submission', async () => {
    const id = await attempt();
    const first = await finalize(id);
    expect(await finalize(id,'B')).toEqual(first);
    await db.exec('RESET ROLE');
    expect((await sql('SELECT * FROM exam_sync_jobs WHERE attempt_id=$1',[id])).length).toBe(1);
  });
  it('does not let another student submit the paper', async () => {
    const id = await attempt(); await login(other);
    await expect(finalize(id)).rejects.toThrow('forbidden');
  });
  it('retains the question, key and points after editing or retiring its bank row', async () => {
    const id = await attempt(); await db.exec('RESET ROLE');
    await sql("UPDATE question_bank SET stem='Changed',answer_key='B',points=10,is_deleted=true WHERE id=$1",[question]);
    await login(student);
    const [q] = await sql('SELECT * FROM get_questions_for_attempt($1)',[id]);
    expect(q).toMatchObject({ stem:'Original',points:1 });
    expect(q).not.toHaveProperty('answer_key');
    expect(await finalize(id)).toMatchObject({ score:1,total_max:1 });
  });
  it('does not expose another student paper', async () => {
    const id = await attempt(); await login(other);
    expect(await sql('SELECT * FROM get_questions_for_attempt($1)',[id])).toEqual([]);
  });
  it('keeps the issued deadline when the exam settings change', async () => {
    const id = await attempt();
    const [before] = await sql('SELECT * FROM get_attempt_window_context($1)',[id]);
    await db.exec('RESET ROLE');
    await sql('UPDATE exams SET duration_minutes=120 WHERE id=$1',[exam]);
    await login(student);
    expect(await sql('SELECT * FROM get_attempt_window_context($1)',[id])).toEqual([before]);
  });
  it('denies direct access to private answer snapshots', async () => {
    await attempt();
    await expect(sql('SELECT * FROM exam_private.attempt_papers')).rejects.toThrow('permission denied');
  });
  it('rolls back invalid question answers without completing the attempt', async () => {
    const id = await attempt();
    await db.exec('SAVEPOINT bad_answer');
    await expect(sql('SELECT finalize_exam_attempt($1,$2::jsonb)',[id,JSON.stringify({[other]:'A'})])).rejects.toThrow('invalid_question_answer');
    await db.exec('ROLLBACK TO bad_answer');
    expect((await sql('SELECT status FROM attempts WHERE id=$1',[id]))[0].status).toBe('in_progress');
  });
  it('finalizes a violation after expiry without saving late answers', async () => {
    const id = await attempt(true);
    expect(await finalize(id,'B',true)).toMatchObject({ ok:true,score:0,total_max:1 });
  });
  it('finishes abandoned expired papers through the server worker', async () => {
    const id = await attempt(true); await login('', 'service_role');
    expect((await sql('SELECT finalize_expired_exam_attempts() count'))[0].count).toBe(1);
    expect((await sql('SELECT status FROM attempts WHERE id=$1',[id]))[0].status).toBe('completed');
  });
  it('does not queue trial grades', async () => {
    const id = await attempt(false,true); await finalize(id); await db.exec('RESET ROLE');
    expect(await sql('SELECT * FROM exam_sync_jobs')).toEqual([]);
  });
});

describe('practical authorization', () => {
  it('blocks direct student score edits even on their own attempt', async () => {
    await login(student);
    const [a] = await sql<{id:string}>('SELECT * FROM start_practical_attempt($1,$2)',[sessionId,'123']);
    expect(await sql("UPDATE practical_attempts SET total_score=10,status='graded' WHERE id=$1 RETURNING id",[a.id])).toEqual([]);
    expect((await sql('SELECT status,total_score FROM practical_attempts WHERE id=$1',[a.id]))[0]).toEqual({status:'pending_upload',total_score:null});
  });
  it('checks enrollment at the database boundary', async () => {
    await login(other);
    await expect(sql('SELECT * FROM start_practical_attempt($1,$2)',[sessionId,'123'])).rejects.toThrow('session_not_allowed');
  });
  it('checks the code on the server', async () => {
    await login(student);
    await expect(sql('SELECT * FROM start_practical_attempt($1,$2)',[sessionId,'wrong'])).rejects.toThrow('invalid_access_code');
  });
  it('requires evidence at submission, even when bypassing the browser', async () => {
    await login(student);
    const [a] = await sql<{id:string}>('SELECT * FROM start_practical_attempt($1,$2)',[sessionId,'123']);
    await expect(sql('SELECT * FROM submit_practical_attempt($1)',[a.id])).rejects.toThrow('evidence_required');
  });
  it('blocks direct insertion of a pre-graded student attempt', async () => {
    await login(student);
    await expect(sql("INSERT INTO practical_attempts(session_id,user_id,status,total_score) VALUES($1,$2,'graded',10)",[sessionId,student])).rejects.toThrow('row-level security');
  });
  it('allows submission once, locks evidence after submission, preserves SCC grading', async () => {
    await login(student);
    const [a] = await sql<{id:string}>('SELECT * FROM start_practical_attempt($1,$2)',[sessionId,'123']);
    await sql("INSERT INTO practical_attempt_photos(attempt_id,file_url) VALUES($1,'evidence.jpg')",[a.id]);
    expect((await sql('SELECT * FROM submit_practical_attempt($1)',[a.id]))[0].status).toBe('submitted');
    expect(await sql('DELETE FROM practical_attempt_photos WHERE attempt_id=$1 RETURNING id',[a.id])).toEqual([]);
    await login(teacher);
    expect((await sql("UPDATE practical_attempts SET total_score=8,status='graded' WHERE id=$1 RETURNING total_score",[a.id]))[0].total_score).toBe('8');
  });
});

describe('durable sync queue', () => {
  it('leases each job once and retries failures with a delay', async () => {
    const id = await attempt(); await finalize(id); await login('', 'service_role');
    const [job] = await sql<{id:string;lease_token:string}>('SELECT * FROM claim_exam_sync_job()');
    expect(await sql('SELECT * FROM claim_exam_sync_job()')).toEqual([]);
    await sql('SELECT finish_exam_sync_job($1,$2,false,$3)',[job.id,job.lease_token,'timeout']);
    expect(await sql('SELECT * FROM claim_exam_sync_job()')).toEqual([]);
    expect((await sql('SELECT status,last_error FROM exam_sync_jobs'))[0]).toEqual({status:'pending',last_error:'timeout'});
  });
  it('recovers an abandoned lease and rejects the old worker completion', async () => {
    const id = await attempt(); await finalize(id); await login('', 'service_role');
    const [job] = await sql<{id:string;lease_token:string}>('SELECT * FROM claim_exam_sync_job()');
    await sql("UPDATE exam_sync_jobs SET lease_until=now()-interval '1 second' WHERE id=$1",[job.id]);
    const [retry] = await sql<{lease_token:string}>('SELECT * FROM claim_exam_sync_job()');
    expect(retry.lease_token).not.toBe(job.lease_token);
    expect((await sql('SELECT finish_exam_sync_job($1,$2,true) finished',[job.id,job.lease_token]))[0].finished).toBe(false);
  });
  it('never retries an older result over a newer successful result', async () => {
    const id = await attempt(); await finalize(id); await login('', 'service_role');
    await sql("INSERT INTO exam_sync_jobs(source,attempt_id,target_key,completed_at,status) SELECT source,$1,target_key,completed_at+interval '1 second','success' FROM exam_sync_jobs",[other]);
    expect(await sql('SELECT * FROM claim_exam_sync_job()')).toEqual([]);
    expect((await sql('SELECT status FROM exam_sync_jobs WHERE attempt_id=$1',[id]))[0].status).toBe('superseded');
  });
  it('queues a field-graded practical attempt under its TTDT student id', async () => {
    const [a] = await sql<{id:string}>("INSERT INTO practical_attempts(session_id,student_id,status) VALUES($1,'ttdt-student','grading') RETURNING id",[sessionId]);
    await sql("UPDATE practical_attempts SET status='graded',total_score=82,graded_at=now() WHERE id=$1",[a.id]);
    expect((await sql('SELECT source,target_key FROM exam_sync_jobs WHERE attempt_id=$1',[a.id]))[0])
      .toEqual({source:'practical',target_key:`practical:ttdt-student:${classId}:${moduleId}`});
  });
  it('does not queue a student who was not eligible to sit', async () => {
    const [a] = await sql<{id:string}>("INSERT INTO practical_attempts(session_id,student_id,status) VALUES($1,'ttdt-student','not_eligible') RETURNING id",[sessionId]);
    expect(await sql('SELECT 1 FROM exam_sync_jobs WHERE attempt_id=$1',[a.id])).toEqual([]);
    await expect(sql("INSERT INTO practical_attempts(session_id,status) VALUES($1,'grading')",[sessionId])).rejects.toThrow('owner_check');
  });
  it('does not expose claims to student callers', async () => {
    await login(student);
    await expect(sql('SELECT * FROM claim_exam_sync_job()')).rejects.toThrow('permission denied');
  });
});

describe('entering an exam window again', () => {
  async function start(code = '123') {
    const [row] = await sql<{ id: string | null }>('SELECT (start_exam_attempt($1,$2)).id id', [windowId, code]);
    return row.id;
  }
  async function ready(maxAttempts = 2) {
    await db.exec('RESET ROLE');
    await sql(`UPDATE exams SET locked_at=now(), blueprint='[{"count":1,"topic":"*","difficulty":"*"}]' WHERE id=$1`, [exam]);
    await sql('UPDATE question_bank SET module_id=$2 WHERE id=$1', [question, moduleId]);
    await sql('UPDATE exam_windows SET max_attempts=$2 WHERE id=$1', [windowId, maxAttempts]);
    await login(student);
  }

  it('returns the open attempt with its paper and saved answers', async () => {
    await ready();
    const first = await start();
    await sql('SELECT save_attempt_answers($1,$2::jsonb)', [first, JSON.stringify({ [question]: 'B' })]);
    expect(await start()).toBe(first);
    await db.exec('RESET ROLE');
    expect(await sql('SELECT count(*)::int n FROM attempts WHERE user_id=$1', [student])).toEqual([{ n: 1 }]);
    expect(await sql('SELECT count(*)::int n FROM exam_private.attempt_papers WHERE attempt_id=$1', [first])).toEqual([{ n: 1 }]);
    expect(await sql('SELECT answers FROM attempts WHERE id=$1', [first])).toEqual([{ answers: { [question]: 'B' } }]);
  });

  it('grades an open attempt past its deadline, then starts a new one', async () => {
    const old = await attempt(true);
    await ready();
    const next = await start();
    expect(next).not.toBe(old);
    await db.exec('RESET ROLE');
    expect(await sql('SELECT status, score::float FROM attempts WHERE id=$1', [old])).toEqual([{ status: 'completed', score: 1 }]);
  });

  it('still applies the attempt limit after grading an expired attempt', async () => {
    await attempt(true);
    await ready(1);
    await expect(start()).rejects.toThrow('attempt_limit_reached');
  });

  it('refuses a wrong access code even with an open attempt', async () => {
    await ready();
    const first = await start();
    expect(first).toBeTruthy();
    expect(await start('999')).toBeNull();
  });
});

describe('durable AI proctoring policy', () => {
  async function record(id: string, event: string) {
    return (await sql<{ should_auto_submit: boolean; risk_score: number; incident_count: number }>(
      'SELECT should_auto_submit,risk_score,incident_count FROM record_ai_proctoring_incident($1,$2,$3::jsonb)',
      [id, event, JSON.stringify({ evidence_path: `${event}.jpg` })],
    ))[0];
  }

  it('keeps AI incidents review-only in standard mode', async () => {
    const id = await attempt();
    expect(await record(id, 'ai_cell_phone')).toMatchObject({
      risk_score: 3,
      incident_count: 1,
      should_auto_submit: false,
    });
  });

  it('auto-submits strict mode only after the threshold and two independent incidents', async () => {
    const id = await attempt();
    await db.exec('RESET ROLE');
    await sql("UPDATE exam_windows SET proctoring_mode='strict',ai_risk_threshold=6 WHERE id=$1", [windowId]);
    await login(student);
    expect(await record(id, 'ai_cell_phone')).toMatchObject({ risk_score: 3, should_auto_submit: false });
    expect(await record(id, 'ai_multiple_face')).toMatchObject({ risk_score: 5, should_auto_submit: false });
    expect(await record(id, 'ai_no_face')).toMatchObject({
      risk_score: 6,
      incident_count: 3,
      should_auto_submit: true,
    });
  });

  it('rejects incidents submitted for another student attempt', async () => {
    const id = await attempt();
    await login(other);
    await expect(record(id, 'ai_no_face')).rejects.toThrow('attempt_not_in_progress_or_forbidden');
  });

  it('blocks direct client insertion of AI incidents', async () => {
    const id = await attempt();
    await expect(sql(
      "INSERT INTO attempt_audit_logs(attempt_id,event,metadata) VALUES($1,'ai_no_face',$2::jsonb)",
      [id, JSON.stringify({ machine_confirmed: true, risk_points: 999 })],
    )).rejects.toThrow('row-level security');
  });

  it('removes a rejected AI incident from the risk score', async () => {
    const id = await attempt();
    await record(id, 'ai_cell_phone');
    await db.exec('RESET ROLE');
    const [log] = await sql<{ id: string }>("SELECT id FROM attempt_audit_logs WHERE attempt_id=$1 AND event='ai_cell_phone'", [id]);
    await login(teacher);
    await sql("SELECT review_ai_proctoring_incident($1,'rejected')", [log.id]);
    const [state] = await sql<{ risk_score: number; incident_count: number }>('SELECT risk_score,incident_count FROM get_ai_proctoring_state($1)', [id]);
    expect(state).toEqual({ risk_score: 0, incident_count: 0 });
  });

  it('ignores malformed audit metadata instead of breaking the policy RPC', async () => {
    const id = await attempt();
    await db.exec('RESET ROLE');
    await sql(
      "INSERT INTO attempt_audit_logs(attempt_id,event,metadata) VALUES($1,'ai_no_face',$2::jsonb)",
      [id, JSON.stringify({ machine_confirmed: 'invalid', risk_points: 'invalid' })],
    );
    await login(student);
    const [state] = await sql<{ risk_score: number; incident_count: number }>(
      'SELECT risk_score,incident_count FROM get_ai_proctoring_state($1)',
      [id],
    );
    expect(state).toEqual({ risk_score: 0, incident_count: 0 });
  });
});
