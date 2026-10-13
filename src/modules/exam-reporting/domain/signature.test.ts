import { describe, expect, it } from 'vitest';
import { attemptUploadFolder, latestSignatureFile } from './signature';

describe('signature files', () => {
  it('reads the attempt folder the upload function writes to', () => {
    expect(attemptUploadFolder('u1', 'a1')).toBe('proctoring/u1/a1');
  });

  it('picks the newest signature and ignores the other uploads of the attempt', () => {
    expect(latestSignatureFile(['start_1791900000000.jpg', 'ai_no_face_1791900001000.jpg'])).toBeNull();
    expect(latestSignatureFile(['signature_1791900002000.jpg', 'start_1791900000000.jpg', 'signature_1791900009000.jpg']))
      .toBe('signature_1791900009000.jpg');
  });
});
