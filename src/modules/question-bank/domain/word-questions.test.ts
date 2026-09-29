import { describe, expect, it } from 'vitest';
import { parseXml, readDocxBlocks } from './docx-reader';
import { buildWordSheet, proposeMarking, readWordQuestions } from './word-questions';
import { planImport } from './question-import';

// Small .docx bodies written by hand in the shapes found in the center's files.

type Run = string | { text: string; red?: boolean; bold?: boolean; highlight?: boolean; underline?: boolean; br?: boolean };

function run(item: Run): string {
  const value = typeof item === 'string' ? { text: item } : item;
  const props = [
    value.red ? '<w:color w:val="FF0000"/>' : '',
    value.bold ? '<w:b/>' : '',
    value.highlight ? '<w:highlight w:val="yellow"/>' : '',
    value.underline ? '<w:u w:val="single"/>' : '',
  ].join('');
  const parts = value.text.split('\n').map((line) => `<w:t xml:space="preserve">${line.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</w:t>`);
  return `<w:r><w:rPr>${props}</w:rPr>${parts.join('<w:br/>')}</w:r>`;
}

function p(runs: Run[] | Run, options: { num?: string; level?: string; image?: string } = {}): string {
  const list = Array.isArray(runs) ? runs : [runs];
  const numbering = options.num ? `<w:pPr><w:numPr><w:ilvl w:val="${options.level ?? '0'}"/><w:numId w:val="${options.num}"/></w:numPr></w:pPr>` : '';
  const image = options.image
    ? `<w:r><w:drawing><wp:anchor><a:graphic><a:graphicData><pic:pic><pic:blipFill><a:blip r:embed="${options.image}"/></pic:blipFill></pic:pic></a:graphicData></a:graphic></wp:anchor></w:drawing></w:r>`
    : '';
  return `<w:p>${numbering}${list.map(run).join('')}${image}</w:p>`;
}

function table(rows: string[][]): string {
  return `<w:tbl>${rows.map((cells) => `<w:tr>${cells.map((cell) => `<w:tc>${cell}</w:tc>`).join('')}</w:tr>`).join('')}</w:tbl>`;
}

const NUMBERING = `<w:numbering>
  <w:abstractNum w:abstractNumId="0"><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="lowerLetter"/><w:lvlText w:val="%1)"/></w:lvl></w:abstractNum>
  <w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>
  <w:num w:numId="2"><w:abstractNumId w:val="0"/></w:num>
  <w:num w:numId="3"><w:abstractNumId w:val="0"/><w:lvlOverride w:ilvl="0"><w:startOverride w:val="2"/></w:lvlOverride></w:num>
</w:numbering>`;

const RELS = `<Relationships>
  <Relationship Id="rId5" Type="image" Target="media/image1.png"/>
  <Relationship Id="rId6" Type="image" Target="media/image2.emf"/>
  <Relationship Id="rId9" Type="hyperlink" Target="https://example.com" TargetMode="External"/>
</Relationships>`;

function read(body: string) {
  const blocks = readDocxBlocks({ document: `<w:document><w:body>${body}<w:sectPr/></w:body></w:document>`, numbering: NUMBERING, relationships: RELS });
  return readWordQuestions(blocks);
}

function sheet(body: string, marking = proposeMarking(read(body))) {
  return buildWordSheet(read(body), marking);
}

const numbered = (texts: Run[], num = '1') => texts.map((text) => p(text, { num })).join('');

describe('parseXml', () => {
  it('decodes entities and keeps self-closing tags empty', () => {
    const root = parseXml('<a x="1 &amp; 2"><b/><c>&lt;tag&gt; &#7907;</c></a>');
    const a = root.children[0];
    expect(a.attrs.x).toBe('1 & 2');
    expect(a.children.map((node) => node.name)).toEqual(['b', 'c']);
    expect(a.children[1].children[0].text).toBe('<tag> ợ');
  });
});

describe('readWordQuestions', () => {
  it('reads numbered options, red answers, pictures, and skips the header and signature', () => {
    const body = [
      table([[p('TRUNG TÂM ĐÀO TẠO', { image: 'rId5' })]]),
      p({ text: 'CÂU HỎI VÀ ĐÁP ÁN', bold: true }),
      p([{ text: 'Câu 1.', bold: true }, ' Khi nâng hàng, vị trí nguy hiểm nhất là ', { text: 'vị trí nào', bold: true }, '?']),
      numbered([{ text: 'Phía dưới tải trọng đang nâng', red: true }, 'Bên cạnh cabin', 'Ngoài khu vực làm việc']),
      p([{ text: 'Câu 2:', bold: true }, ' Hãy cho biết móc ngáo sau đây thuộc loại nào?'], { image: 'rId5' }),
      numbered(['Móc ngáo cân bằng', { text: 'Móc ngáo tự xoay', red: true }], '2'),
      p('Nơi nhận:'),
      p('- Lưu TTĐT.'),
    ].join('');
    const result = sheet(body);
    expect(result.errors).toEqual([]);
    expect(result.rows.map((row) => [row.label, row.stem, row.optionTexts, row.answer, row.imageFile])).toEqual([
      ['Câu 1', 'Khi nâng hàng, vị trí nguy hiểm nhất là vị trí nào?', ['Phía dưới tải trọng đang nâng', 'Bên cạnh cabin', 'Ngoài khu vực làm việc'], 'A', ''],
      ['Câu 2', 'Hãy cho biết móc ngáo sau đây thuộc loại nào?', ['Móc ngáo cân bằng', 'Móc ngáo tự xoay'], 'B', 'image1.png'],
    ]);
    expect(result.rows[1].imagePath).toBe('word/media/image1.png');
  });

  it('splits typed options, several on one line, and keeps the mark of each', () => {
    const result = sheet([
      p('Câu 25: Số vòng cáp tối thiểu trên tang là mấy vòng?'),
      p(['a. 5 vòng\t\tb. 4 vòng\t\t', { text: 'c. 3 vòng', red: true }, '\t\td. 2 vòng']),
    ].join(''));
    expect(result.rows[0].optionTexts).toEqual(['5 vòng', '4 vòng', '3 vòng', '2 vòng']);
    expect(result.rows[0].answer).toBe('C');
  });

  it('reads a question typed in one paragraph with manual line breaks', () => {
    const result = sheet(p([
      { text: 'Câu 3.', bold: true },
      ' Dao cách ly dùng để làm gì?\nA. Cắt dòng tải\t\tB. Cắt ngắn mạch\n',
      { text: 'C. Đóng cắt không tải', red: true },
      '\t\tD. Điều chỉnh điện áp',
    ]));
    expect(result.rows[0].stem).toBe('Dao cách ly dùng để làm gì?');
    expect(result.rows[0].optionTexts).toEqual(['Cắt dòng tải', 'Cắt ngắn mạch', 'Đóng cắt không tải', 'Điều chỉnh điện áp']);
    expect(result.rows[0].answer).toBe('C');
  });

  it('starts the next question when "Câu N+1" is typed on an option line', () => {
    const result = sheet([
      p('Câu 45. Mất điện đột ngột thì làm gì đầu tiên?'),
      numbered(['Thoát khỏi cabin', { text: 'Dùng hệ thống hạ tải khẩn cấp', red: true }]),
      p('Bật lại cầu dao.\nCâu 46. Có người vào khu vực nâng hạ thì làm gì?', { num: '1' }),
      numbered([{ text: 'Ngừng vận hành', red: true }, 'Bấm còi rồi làm tiếp'], '2'),
    ].join(''));
    expect(result.rows.map((row) => [row.label, row.optionTexts.length, row.answer])).toEqual([['Câu 45', 3, 'B'], ['Câu 46', 2, 'A']]);
    expect(result.rows[1].stem).toBe('Có người vào khu vực nâng hạ thì làm gì?');
  });

  it('continues a stem over several lines and joins a wrapped option line with a note', () => {
    const result = sheet([
      p('Câu 27: Hình dưới đây mô tả cơ cấu phanh'),
      p('trên trục động cơ, thuộc loại nào?'),
      numbered([{ text: 'Lực kẹp, hệ số ma sát,', red: true }]),
      p({ text: 'đường kính phanh hiệu quả', red: true }),
      numbered(['Tải trọng vật nâng']),
    ].join(''));
    expect(result.rows[0].stem).toBe('Hình dưới đây mô tả cơ cấu phanh trên trục động cơ, thuộc loại nào?');
    expect(result.rows[0].optionTexts[0]).toBe('Lực kẹp, hệ số ma sát, đường kính phanh hiệu quả');
    expect(result.rows[0].reviewNotes).toEqual(['Đoạn "đường kính phanh hiệu quả" được nối vào cuối phương án A.']);
  });

  it('uses a PHẦN heading as topic but not "PHẦN LÝ THUYẾT"', () => {
    const result = sheet([
      p('PHẦN LÝ THUYẾT'),
      p('PHẦN II – KIẾN THỨC KỸ THUẬT'),
      p('Câu 1. Câu hỏi?'),
      numbered([{ text: 'Đúng', red: true }, 'Sai']),
    ].join(''));
    expect(result.rows[0].topic).toBe('KIẾN THỨC KỸ THUẬT');
  });
});

describe('answers', () => {
  const twoQuestions = (answerA: Run, extra = '') => [
    p('Câu 1. Câu một?'),
    numbered([answerA, 'Phương án hai']),
    extra,
    p('Câu 2. Câu hai?'),
    numbered(['Một', { text: 'Hai', highlight: true }], '2'),
  ].join('');

  it('proposes the marking most questions use once, and reads with the chosen one', () => {
    const body = [
      p('Câu 1. Một?'), numbered([{ text: 'A', highlight: true }, 'B']),
      p('Câu 2. Hai?'), numbered(['A', { text: 'B', highlight: true }], '2'),
      p('Câu 3. Ba?'), numbered([{ text: 'A', red: true }, 'B'], '3'),
    ].join('');
    expect(proposeMarking(read(body))).toBe('highlight');
    const byColor = sheet(body, 'color');
    expect(byColor.rows.map((row) => row.label)).toEqual(['Câu 3']);
    expect(byColor.errors.map((error) => error.label)).toEqual(['Câu 1', 'Câu 2']);
  });

  it('does not take bold emphasis for an answer when red is the marking', () => {
    const result = sheet([
      p(['Câu 8. Thao tác nào ', { text: 'không an toàn', bold: true }, '?']),
      numbered(['Nâng trong giới hạn', { text: 'Nâng quá tải', red: true }, { text: 'Cảnh báo tải trọng gió', bold: true }]),
    ].join(''), 'color');
    expect(result.rows[0].answer).toBe('B');
  });

  it('reads a "Đáp án:" line and reports a disagreement with the mark', () => {
    const agree = sheet(twoQuestions({ text: 'Phương án một', red: true }, p('Đáp án: A')), 'color');
    expect(agree.rows[0].answer).toBe('A');
    const disagree = sheet(twoQuestions({ text: 'Phương án một', red: true }, p('Đáp án: B')), 'color');
    expect(disagree.errors[0]).toMatchObject({ label: 'Câu 1', reason: 'Đáp án theo chữ màu đỏ là A, theo dòng "Đáp án:" là B.' });
  });

  it('reads an answer list and an answer table after a "ĐÁP ÁN" heading', () => {
    const questions = [p('Câu 1. Một?'), numbered(['A', 'B']), p('Câu 2. Hai?'), numbered(['A', 'B', 'C'], '2')].join('');
    const list = sheet(`${questions}${p('ĐÁP ÁN')}${p('1-B; 2. C')}`, null);
    expect(list.rows.map((row) => row.answer)).toEqual(['B', 'C']);
    const grid = sheet(`${questions}${p('BẢNG ĐÁP ÁN')}${table([[p('1'), p('2')], [p('A'), p('C')]])}`, null);
    expect(grid.rows.map((row) => row.answer)).toEqual(['A', 'C']);
  });

  it('reports questions without an answer and a file without any', () => {
    const result = sheet([p('Câu 1. Một?'), numbered(['A', 'B'])].join(''));
    expect(result.errors[0].reason).toBe('Không thấy đáp án đúng.');
    expect(result.notices[0]).toMatch(/^File không có đáp án/);
  });

  it('stores two marked options as multiple choice with a note', () => {
    const result = sheet([p('Câu 1. Một?'), numbered([{ text: 'A', red: true }, 'B', { text: 'C', red: true }])].join(''), 'color');
    expect(result.rows[0]).toMatchObject({ answer: 'A;C', questionType: 'Nhiều đáp án' });
    expect(result.rows[0].reviewNotes[0]).toMatch(/^2 phương án được đánh dấu/);
  });
});

describe('flags', () => {
  it('reports the same question with different answers', () => {
    const question = (answer: number, num: string) => numbered(['Cảnh báo quá tải', 'Cảm biến tải trọng'].map((text, index) => (index === answer ? { text, red: true } : text)), num);
    const result = sheet([p('Câu 28: Load cell là thiết bị nào?'), question(1, '1'), p('Câu 40: Load cell là thiết bị nào?'), question(0, '2')].join(''), 'color');
    expect(result.rows).toEqual([]);
    expect(result.errors.map((error) => error.reason)).toEqual([
      'Cùng nội dung nhưng khác đáp án (Câu 28: B; Câu 40: A).',
      'Cùng nội dung nhưng khác đáp án (Câu 28: B; Câu 40: A).',
    ]);
  });

  it('reports options that restart at "a" (missing or mistyped "Câu" line)', () => {
    const result = sheet([
      p('Câu 12. Một?'),
      p([{ text: 'a) Chống sét', red: true }, '\tb) Cách ly\tc) Đo\td) Đếm']),
      p('Cây 13. Hai?'),
      p(['a) Một\tb) Hai\t', { text: 'c) Ba', red: true }]),
    ].join(''), 'color');
    expect(result.errors[0].reason).toMatch(/^Phương án thứ 5 lại bắt đầu từ a/);
  });

  it('flags a first option shown as "b)" (option a stuck to the stem)', () => {
    const result = sheet([p('Câu 39: Các yếu tố ảnh hưởng tới phanh'), numbered(['Mô men phanh', { text: 'Đáp án a, b đúng', red: true }], '3')].join(''), 'color');
    expect(result.rows[0].reviewNotes).toEqual(['Phương án đầu tiên ghi "b)": có thể phương án a nằm lẫn trong đề bài.']);
  });

  it('keeps letters counting across questions that share one Word list', () => {
    const result = sheet([p('Câu 1. Một?'), numbered([{ text: 'A', red: true }, 'B']), p('Câu 2. Hai?'), numbered([{ text: 'A', red: true }, 'B'])].join(''), 'color');
    expect(result.rows[1].reviewNotes).toEqual(['Phương án đầu tiên ghi "c)": có thể phương án a nằm lẫn trong đề bài.']);
  });

  it('refuses pictures a browser cannot show and flags a second picture', () => {
    const emf = sheet([p('Câu 1. Một?', { image: 'rId6' }), numbered([{ text: 'A', red: true }, 'B'])].join(''), 'color');
    expect(emf.errors[0].reason).toMatch(/^Ảnh của câu ở dạng EMF/);
    const two = readWordQuestions(readDocxBlocks({
      document: `<w:document><w:body>${p('Câu 1. Một?', { image: 'rId5' })}${p('', { image: 'rId6' })}${numbered([{ text: 'A', red: true }, 'B'])}</w:body></w:document>`,
      numbering: NUMBERING,
      relationships: RELS,
    }));
    expect(buildWordSheet(two, 'color').rows[0].reviewNotes).toEqual(['Câu có 2 ảnh, chỉ lấy ảnh đầu tiên.']);
  });

  it('flows into the import plan with labels, and review rows are marked', () => {
    const result = sheet([
      p('Câu 1. Một?'), numbered([{ text: 'A', red: true }, 'B']),
      p('Câu 2. Hai?'), numbered([{ text: 'A', red: true }, 'B', { text: 'C', red: true }], '2'),
      p('Câu 3. Một?'), numbered([{ text: 'A', red: true }, 'B'], '3'),
    ].join(''), 'color');
    const plan = planImport({ rows: result.rows, headerRecognized: true }, {
      validateMediaUrl: () => ({ valid: true }),
      imageSizes: new Map(),
      existingKeys: new Set(),
    });
    expect(plan.ready.map((row) => [row.label, row.needsReview])).toEqual([['Câu 1', false], ['Câu 2', true]]);
    expect(plan.duplicates).toEqual([{ line: 3, label: 'Câu 3', stem: 'Một?', reason: 'Trùng câu 1 trong file.' }]);
  });
});

describe('two-column options and explanations', () => {
  it('reads a Word-numbered option followed by a typed one and orders them by letter', () => {
    const result = sheet([
      p('Câu 3. Hỏng phanh giữa đường thì làm gì?'),
      p(['Nhảy khỏi xe                 ', { text: 'c) Giảm ga, về số thấp', red: true }], { num: '1' }),
      p('Tắt máy ngay                 d) Bấm còi liên tục', { num: '1' }),
    ].join(''), 'color');
    expect(result.rows[0].optionTexts).toEqual(['Nhảy khỏi xe', 'Tắt máy ngay', 'Giảm ga, về số thấp', 'Bấm còi liên tục']);
    expect(result.rows[0].answer).toBe('C');
    expect(result.rows[0].reviewNotes).toEqual([]);
  });

  it('reads typed columns "A. …⇥ ⇥ C. …" and keeps "đáp án a, c. đúng" as one option', () => {
    const result = sheet([
      p('Câu 175. Khối điều khiển nào?'),
      p([{ text: 'A. KDU Trước', red: true }, ' 	 	 C. KDU Sau']),
      p('B. KDU khung chụp		D. đáp án a, c. đúng'),
    ].join(''), 'color');
    expect(result.rows[0].optionTexts).toEqual(['KDU Trước', 'KDU khung chụp', 'KDU Sau', 'đáp án a, c. đúng']);
    expect(result.rows[0].answer).toBe('A');
  });

  it('splits repeated letters in columns and flags the question', () => {
    const result = sheet([
      p('Câu 148. Phát hiện cháy thì làm gì đầu tiên?'),
      p(['\tB. Gọi cứu hỏa\t\tB. Rời khỏi trạm\nC. Dùng nước\t\t', { text: 'C. Cắt điện khu vực cháy', red: true }]),
    ].join(''), 'color');
    expect(result.rows[0].optionTexts).toEqual(['Gọi cứu hỏa', 'Rời khỏi trạm', 'Dùng nước', 'Cắt điện khu vực cháy']);
    expect(result.rows[0].answer).toBe('D');
    expect(result.rows[0].reviewNotes[0]).toMatch(/^Phương án đầu tiên ghi "b\)"/);
  });

  it('skips a "Giải thích:" paragraph and what follows it up to the next question', () => {
    const result = sheet([
      p('Câu 94. Mạch sao – tam giác cần mấy contactor?'),
      p(['2		', { text: 'b. 3', red: true }], { num: '1' }),
      p('c. 4		d. 1'),
      p('Giải thích: Mạch gồm 3 contactor:'),
      p('KM1 (chính), KM2 (sao), KM3 (tam giác).'),
      p('Câu 95. Câu sau?'),
      numbered([{ text: 'Có', red: true }, 'Không'], '2'),
    ].join(''), 'color');
    expect(result.rows[0].optionTexts).toEqual(['2', '3', '4', '1']);
    expect(result.rows[0].answer).toBe('B');
    expect(result.rows[0].reviewNotes).toEqual([]);
    expect(result.notices).toContain('Bỏ qua phần "Giải thích" ở 1 câu: ngân hàng câu hỏi chưa có chỗ lưu lời giải thích.');
  });

  it('notes an answer marked on only part of its words, but not for a black full stop', () => {
    const partly = sheet([
      p('Câu 8. Tủ điện ngoài trời cần gì?'),
      p('Đặt trên nền', { num: '1' }),
      p(['Có ', { text: 'mái che, khoá tủ và nối đất', red: true }], { num: '1' }),
      p('Câu 9. Hai?'),
      p('Sai', { num: '2' }),
      p([{ text: 'Tất cả vấn đề trên', red: true }, '.'], { num: '2' }),
    ].join(''), 'color');
    expect(partly.rows.map((row) => [row.answer, row.reviewNotes])).toEqual([
      ['B', ['Đáp án B chỉ có một phần chữ được đánh dấu (chữ màu đỏ): kiểm tra lại đáp án.']],
      ['B', []],
    ]);
  });
});

describe('question type tags', () => {
  const plan = (rows: ReturnType<typeof sheet>['rows']) => planImport({ rows, headerRecognized: true }, {
    validateMediaUrl: () => ({ valid: true }),
    imageSizes: new Map(),
    existingKeys: new Set(),
  });

  it('reads [Đúng/Sai] with red statements as true', () => {
    const result = sheet([
      p('Câu 5. [Đúng/Sai] [Khó] [4 điểm] Về an toàn vận hành cẩu:'),
      numbered([{ text: 'Kiểm tra khu vực trước khi nâng.', red: true }, 'Được nâng vượt tải 20%.', { text: 'Hạn vị hoạt động trước mỗi ca.', red: true }]),
    ].join(''), 'color');
    expect(result.rows[0]).toMatchObject({ stem: 'Về an toàn vận hành cẩu:', answer: 'Đ;S;Đ', questionType: 'Đúng/Sai', difficulty: 'hard', points: '4' });
    const [ready] = plan(result.rows).ready;
    expect(ready.payload).toMatchObject({ question_type: 'true_false_multi', points: 4, difficulty: 'hard' });
    expect(JSON.parse(ready.payload.answer_key)).toEqual(['T', 'F', 'T']);
  });

  it('reads [Nối cột] from a two-column table, one right pair per row', () => {
    const result = sheet([
      p('Câu 6. [Nối cột] Nối thiết bị với chức năng:'),
      table([[p('Bộ chống lắc'), p('Hãm lắc container')], [p('Công tắc hành trình'), p('Ngắt mạch; báo lỗi')], [p('Thiết bị đo tải'), p('Ngắt tời khi quá tải')]]),
    ].join(''), 'color');
    expect(result.rows[0]).toMatchObject({ optionTexts: ['Bộ chống lắc', 'Công tắc hành trình', 'Thiết bị đo tải'], keys: 'Hãm lắc container;Ngắt mạch, báo lỗi;Ngắt tời khi quá tải', questionType: 'Nối đôi' });
    expect(result.rows[0].reviewNotes).toEqual(['Dấu ";" trong "Ngắt mạch; báo lỗi" được đổi thành ",".']);
    const [ready] = plan(result.rows).ready;
    expect(ready.payload.question_type).toBe('matching');
  });

  it('reports a [Nối cột] question without a full table', () => {
    const result = sheet([p('Câu 6. [Nối cột] Nối:'), table([[p('Trái'), p('Phải')], [p('Chỉ trái'), p('')]])].join(''), 'color');
    expect(result.errors[0].reason).toBe('Hàng 2 của bảng nối cột thiếu cột phải.');
  });

  it('reads [Sắp xếp] with the steps in the right order', () => {
    const result = sheet([p('Câu 7. [Sắp xếp] Thứ tự nâng hàng:'), numbered(['Kiểm tra tải trọng', 'Móc cẩu', 'Ra lệnh nâng'])].join(''), 'color');
    expect(result.rows[0]).toMatchObject({ answer: 'A;B;C', questionType: 'Kéo thả' });
    expect(plan(result.rows).ready[0].payload.question_type).toBe('drag_drop');
  });

  it('reads [Tự luận] with "Ý chấm:" lines, 2 points when missing', () => {
    const result = sheet([
      p('Câu 8. [Tự luận] Nêu nguyên nhân tai nạn lao động tại cảng.'),
      p('Ý chấm: sai quy trình | 3'),
      p('Ý chấm: thiếu bảo hộ'),
    ].join(''), 'color');
    expect(result.rows[0]).toMatchObject({ optionTexts: [], keys: 'sai quy trình|3;thiếu bảo hộ|2', questionType: 'Tự luận' });
    const [ready] = plan(result.rows).ready;
    expect(ready.payload.question_type).toBe('main_idea');
    expect(JSON.parse(ready.payload.answer_key)).toEqual([{ text: 'sai quy trình', points: 3 }, { text: 'thiếu bảo hộ', points: 2 }]);
  });

  it('keeps [Nhiều đáp án] with one mark and refuses [Trắc nghiệm] with two', () => {
    const multi = sheet([p('Câu 1. [Nhiều đáp án] Một?'), numbered([{ text: 'A', red: true }, 'B'])].join(''), 'color');
    expect(multi.rows[0]).toMatchObject({ answer: 'A', questionType: 'Nhiều đáp án', reviewNotes: [] });
    const single = sheet([p('Câu 1. [Trắc nghiệm] Một?'), numbered([{ text: 'A', red: true }, { text: 'B', red: true }])].join(''), 'color');
    expect(single.errors[0].reason).toBe('Nhãn [Trắc nghiệm] nhưng có 2 phương án được đánh dấu (A, B).');
  });

  it('reports an unknown tag', () => {
    const result = sheet([p('Câu 1. [Video] Một?'), numbered([{ text: 'A', red: true }, 'B'])].join(''), 'color');
    expect(result.errors[0].reason).toMatch(/^Không hiểu nhãn \[Video\]\. Nhãn dùng được:/);
  });
});
