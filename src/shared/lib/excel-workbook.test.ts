import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { buildWorkbookBytes, excelFileName, fileDate } from './excel-workbook';

async function read(bytes: ArrayBuffer) {
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(bytes);
  return book;
}

describe('buildWorkbookBytes', () => {
  it('puts the column names on row 1 when there is no heading, so importers can read the file back', async () => {
    const book = await read(await buildWorkbookBytes([{ name: 'Cau_hoi', columns: [{ header: 'Nội dung', width: 40 }, { header: 'Điểm', width: 8, kind: 'integer' }], rows: [['Câu 1', 2]] }]));
    const ws = book.getWorksheet('Cau_hoi')!;
    expect(ws.getRow(1).values).toEqual([undefined, 'Nội dung', 'Điểm']);
    expect(ws.getCell('B2').value).toBe(2);
    expect(ws.getCell('A1').font?.bold).toBe(true);
    expect(ws.getCell('A1').font?.name).toBe('Times New Roman');
    expect(ws.views[0]).toMatchObject({ state: 'frozen', ySplit: 1 });
  });

  it('writes a report heading, then a table with real numbers, percents and local dates', async () => {
    const done = new Date(2026, 9, 21, 8, 45).getTime();
    const book = await read(await buildWorkbookBytes([{
      name: 'Ket qua',
      heading: { title: 'KẾT QUẢ THI', notes: ['Kỳ thi: QC'] },
      columns: [{ header: 'Họ tên', width: 30 }, { header: 'Điểm', width: 10, kind: 'percent' }, { header: 'Nộp bài', width: 18, kind: 'datetime' }],
      rows: [['Nguyễn An', 0.755, done], ['Trần Bình', null, null]],
    }]));
    const ws = book.getWorksheet('Ket qua')!;
    expect(ws.getCell('A3').value).toBe('TRUNG TÂM ĐÀO TẠO');
    expect(ws.getCell('A5').value).toBe('KẾT QUẢ THI');
    expect(ws.getCell('A6').value).toBe('Kỳ thi: QC');
    expect(ws.getCell('A8').value).toBe('Họ tên');
    expect(ws.getCell('B9').value).toBe(0.755);
    expect(ws.getCell('B9').numFmt).toBe('0.0%');
    const shown = ws.getCell('C9').value as Date;
    expect([shown.getUTCDate(), shown.getUTCHours(), shown.getUTCMinutes()]).toEqual([21, 8, 45]);
    expect(ws.getCell('B10').value).toBeNull();
    expect(ws.pageSetup.printTitlesRow).toBe('8:8');
  });

  it('adds footer lines after a blank row', async () => {
    const book = await read(await buildWorkbookBytes([{ name: 'Vi_du', columns: [{ header: 'A', width: 10 }], rows: [['x']], footer: ['Cách ghi', 'Dòng 2'] }]));
    const ws = book.getWorksheet('Vi_du')!;
    expect(ws.getCell('A3').value).toBeNull();
    expect(ws.getCell('A4').value).toBe('Cách ghi');
    expect(ws.getCell('A5').value).toBe('Dòng 2');
  });
});

describe('file names', () => {
  it('keeps Vietnamese and drops characters Windows refuses', () => {
    expect(excelFileName('Kết quả thi: QC/K44')).toBe('Kết quả thi- QC-K44.xlsx');
    expect(excelFileName('  ')).toBe('du-lieu.xlsx');
    expect(fileDate(new Date(2026, 9, 5).getTime())).toBe('05-10-2026');
  });
});
