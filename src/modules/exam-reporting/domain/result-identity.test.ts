import { describe, expect, it } from 'vitest';
import { displayDate, resultIdentity } from './result-identity';

describe('resultIdentity', () => {
  const record = { name: 'Đinh Quốc Huy', dob: '1988-08-18', idCardNumber: '031088011304', studentCode: 'hv100238' };

  it('takes the student record before the tab session and the account', () => {
    expect(resultIdentity(record, { student_name: 'Tên cũ', student_dob: '1/1/2000', id_card_number: '0' }, { name: 'hv100238@hptts.vn' }))
      .toEqual({ fullName: 'Đinh Quốc Huy', dob: '18/08/1988', cccd: '031088011304' });
  });

  it('falls back to what the CCCD check left in the tab', () => {
    expect(resultIdentity(null, { student_name: 'Nguyễn Văn A', student_dob: '2000-02-03', id_card_number: '012' }, null))
      .toEqual({ fullName: 'Nguyễn Văn A', dob: '03/02/2000', cccd: '012' });
  });

  it('never shows the login of the exam account as the person', () => {
    expect(resultIdentity(null, null, { name: 'hv100238@hptts.vn' })).toEqual({ fullName: '—', dob: '—', cccd: '—' });
    expect(resultIdentity({ ...record, name: ' ' }, null, { name: 'Trần Thị B' }).fullName).toBe('Trần Thị B');
  });

  it('keeps a date that is not yyyy-mm-dd as written', () => {
    expect(displayDate('18/08/1988')).toBe('18/08/1988');
  });
});
