/** The student row linked to the signed-in exam account, as `get_my_exam_student` returns it. */
export interface StudentRecord {
  name: string | null;
  dob: string | null;
  idCardNumber: string | null;
  studentCode: string | null;
}

export interface ResultIdentity {
  fullName: string;
  dob: string;
  cccd: string;
}

const EMPTY = '—';

function clean(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** yyyy-mm-dd becomes dd/mm/yyyy; anything else is shown as written. */
export function displayDate(value: string): string {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
}

/**
 * Who the result belongs to. The student record wins, then what the CCCD check left in this tab. An exam account
 * is named after its login ("hv100238@hptts.vn"), so a name that looks like a login is never shown as a person.
 */
export function resultIdentity(
  record: StudentRecord | null,
  session: { student_name?: string; student_dob?: string; id_card_number?: string } | null,
  account: { student_name?: string; name?: string } | null,
): ResultIdentity {
  const names = [record?.name, session?.student_name, account?.student_name, account?.name].map(clean);
  const dob = clean(record?.dob) || clean(session?.student_dob);
  return {
    fullName: names.find((name) => name !== '' && !name.includes('@')) ?? EMPTY,
    dob: dob ? displayDate(dob) : EMPTY,
    cccd: clean(record?.idCardNumber) || clean(session?.id_card_number) || EMPTY,
  };
}
