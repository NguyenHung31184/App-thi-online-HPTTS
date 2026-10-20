import { describe, expect, it } from 'vitest';
import { buildExcelTemplate, readTemplateFile } from './import-template';

describe('practical exam Excel template', () => {
  it('reads back into the RTG example draft without warnings', async () => {
    const draft = await readTemplateFile(new File([await buildExcelTemplate()], 'Mau de thi thuc hanh.xlsx'));
    expect(draft.title).toBe('Vận hành cần trục giàn RTG – Khóa 44');
    expect(draft.passScore).toBe(70);
    expect(draft.config.steps).toHaveLength(4);
    expect(draft.config.ppe).toEqual(['Mũ bảo hộ', 'Giày bảo hộ', 'Áo phản quang', 'Găng tay']);
    expect(draft.config.disqualifyReasons).toHaveLength(4);
    expect(draft.config.time).not.toBeNull();
    // Same as the former SheetJS template: the "Thời gian" row becomes config.time, not a criterion.
    expect(draft.criteria).toHaveLength(8);
    expect(draft.warnings).toEqual([]);
  });
});
